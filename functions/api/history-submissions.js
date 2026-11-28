const maxBytes = 32768;
const thankYou = '/history/thank-you/';
const allowedOrigins = new Set(['https://iowabowlingcoaches.org', 'https://www.iowabowlingcoaches.org']);
const previewOrigin = 'https://history-contributions.iowa-bowling-coaches.pages.dev';

async function notify(env, { name, email, message, link, id, preview }) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.HISTORY_MAIL_ACCOUNT}/email/sending/send`, {
    method: 'POST',
    // Workers supports manual redirects; never follow one with the bearer token.
    redirect: 'manual',
    signal: AbortSignal.timeout(8000),
    headers: { Authorization: `Bearer ${env.HISTORY_MAIL_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.HISTORY_MAIL_FROM,
      to: env.HISTORY_MAIL_TO,
      subject: `${preview ? '[TEST] ' : ''}Iowa bowling history contribution #${id}`,
      text: [
        preview ? 'Synthetic preview test. Not an archive contribution.' : 'A contribution was saved in the private history inbox.',
        `Name: ${name || '(not provided)'}`,
        `Contributor reply email: ${email || '(not provided)'}`,
        `Document link: ${link || '(not provided)'}`,
        '',
        message,
      ].join('\n'),
    }),
  });
  const { success, result, errors } = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = errors?.[0]?.code;
    return { sent: false, status: Number.isInteger(code) ? `HTTP ${response.status}, code ${code}` : `HTTP ${response.status}` };
  }
  const sent = success === true && Boolean(result?.message_id) &&
    [...(result.delivered || []), ...(result.queued || [])].some(address => address.toLowerCase() === env.HISTORY_MAIL_TO.toLowerCase());
  return { sent, status: sent ? 'accepted' : 'recipient not accepted' };
}

function reply(status, message, extra = {}) {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra },
  });
}

export async function onRequest({ request, env }) {
  const origin = new URL(request.url).origin;
  const preview = origin === previewOrigin && env.HISTORY_TEST_KEY?.length >= 32;
  if (request.method === 'GET' && preview) {
    return reply(200, '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>History inbox delivery test</title><h1>History inbox delivery test</h1><form method="post" action="/api/history-submissions"><label>Preview test key <input type="password" name="preview_key" autocomplete="off" required></label><input type="hidden" name="message" value="Synthetic bowling archive delivery test. No real contribution."><button type="submit">Send synthetic test</button></form></html>', {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      'X-Robots-Tag': 'noindex',
    });
  }
  if (request.method !== 'POST') return reply(405, 'Please use the contribution form.', { Allow: 'POST' });
  if ((!allowedOrigins.has(origin) && !preview) || request.headers.get('Origin') !== origin) return reply(403, 'Please submit from the Iowa Bowling Coaches website.');
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
  if (preview && (request.headers.get('X-History-Test-Key') ?? fields.get('preview_key')) !== env.HISTORY_TEST_KEY) {
    return reply(403, 'A preview test key is required.');
  }
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
  if (!env.HISTORY_INBOX || !/^[a-f0-9]{32}$/i.test(env.HISTORY_MAIL_ACCOUNT ?? '') ||
      !env.HISTORY_MAIL_TOKEN || !env.HISTORY_MAIL_FROM || !env.HISTORY_MAIL_TO) {
    return reply(503, 'Your contribution was not saved. Go back and try again later.');
  }
  let id;
  try {
    const result = await env.HISTORY_INBOX.prepare(`
      INSERT INTO history_submissions (name, email, message, link)
      SELECT ?, ?, ?, ?
      WHERE (SELECT COUNT(*) FROM history_submissions WHERE received_at >= unixepoch() - 60) < 20
    `).bind(name || null, email || null, message, link || null).run();
    if (result.meta.changes === 0) return reply(429, 'The form is busy. Go back and try again in a minute.', { 'Retry-After': '60' });
    if (result.success && result.meta.changes === 1) id = result.meta.last_row_id;
  } catch { /* Never log submission content. */ }
  if (!Number.isSafeInteger(id) || id < 1) return reply(503, 'Your contribution could not be confirmed. Go back and try again later.');
  let delivery = { sent: false, status: 'request failed' };
  try { delivery = await notify(env, { name, email, message, link, id, preview }); } catch { /* Do not expose provider response details. */ }
  if (!delivery.sent) {
    console.warn('History inbox notification failed for submission ID', id);
    if (preview) return reply(502, `Test submission #${id} was saved, but email sending could not be confirmed (${delivery.status}).`);
  }
  if (preview) return reply(200, `Test submission #${id} was saved and accepted for email delivery.`);
  return accepted();
}
