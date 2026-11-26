const maxBytes = 32768;
const thankYou = '/history/thank-you/';
const allowedOrigins = new Set(['https://iowabowlingcoaches.org', 'https://www.iowabowlingcoaches.org']);

function reply(status, message, extra = {}) {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra },
  });
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return reply(405, 'Please use the contribution form.', { Allow: 'POST' });
  const origin = new URL(request.url).origin;
  if (!allowedOrigins.has(origin) || request.headers.get('Origin') !== origin) return reply(403, 'Please submit from the Iowa Bowling Coaches website.');
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/x-www-form-urlencoded' || !request.body) {
    return reply(415, 'Please use the contribution form. Attachments are not accepted.');
  }
  if (Number(request.headers.get('Content-Length')) > maxBytes) return reply(413, 'Your submission is too large. Please use a link to share documents.');
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let body = '';
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        return reply(413, 'Your submission is too large. Please use a link to share documents.');
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } catch {
    return reply(400, 'The submission could not be read. Go back and try again.');
  }
  const fields = new URLSearchParams(body);
  const accepted = () => reply(303, null, { Location: thankYou });
  if (fields.get('website')) return accepted();
  const [name, email, message, link] = ['name', 'email', 'message', 'link'].map(key => (fields.get(key) ?? '').trim());
  const emailOk = !email || (email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  let linkOk = !link;
  if (link && link.length <= 1000) {
    try {
      const url = new URL(link);
      linkOk = ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
    } catch { /* report invalid link below */ }
  }
  if (!message || message.length > 4000 || name.length > 120 || !emailOk || !linkOk) {
    return reply(400, 'Go back and check your message, reply email, or document link.');
  }
  try {
    const result = await env.HISTORY_INBOX.prepare(`
      INSERT INTO history_submissions (name, email, message, link)
      SELECT ?, ?, ?, ?
      WHERE (SELECT COUNT(*) FROM history_submissions WHERE received_at >= unixepoch() - 60) < 20
    `).bind(name || null, email || null, message, link || null).run();
    if (result.meta.changes === 0) return reply(429, 'The form is busy. Go back and try again in a minute.', { 'Retry-After': '60' });
    if (result.success && result.meta.changes === 1) return accepted();
  } catch { /* Never log submission content. */ }
  return reply(503, 'Your contribution was not saved. Go back and try again later.');
}
