import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onRequest } from '../functions/api/history-submissions.js';

const origin = 'https://iowabowlingcoaches.org';
const endpoint = origin + '/api/history-submissions';
const previewOrigin = 'https://history-contributions.iowa-bowling-coaches.pages.dev';
const fakeRecipient = 'private-recipient@example.org';

function send(fields, env = {}, overrides = {}) {
  const request = new Request(endpoint, {
    method: 'POST', headers: { Origin: origin }, body: new URLSearchParams(fields), ...overrides,
  });
  return onRequest({ request, env });
}

function inbox(changes = 1) {
  const saved = [];
  return {
    saved,
    env: {
      HISTORY_MAIL_ACCOUNT: '0'.repeat(32),
      HISTORY_MAIL_TOKEN: 'synthetic-token',
      HISTORY_MAIL_FROM: 'archive@example.org',
      HISTORY_MAIL_TO: fakeRecipient,
      HISTORY_INBOX: { prepare(sql) {
        assert.match(sql, /INSERT INTO history_submissions/);
        return { bind(...values) {
          return { async run() { if (changes) saved.push(values); return { success: true, meta: { changes, last_row_id: 7 } }; } };
        } };
      } },
    },
  };
}

function mockEmail(t, saved, disposition = 'delivered') {
  return t.mock.method(globalThis, 'fetch', async (_, options) => {
    assert.equal(saved.length, 1, 'Save before sending mail');
    const body = JSON.parse(options.body);
    assert.equal(body.to, fakeRecipient, 'Form values must not control the recipient');
    assert.match(body.text, /2009 program/);
    return Response.json({ success: true, result: { message_id: 'synthetic-id', [disposition]: [fakeRecipient] } });
  });
}

test('valid form saves privately, notifies the configured inbox and then redirects', async t => {
  const { saved, env } = inbox();
  const mail = mockEmail(t, saved);
  const response = await send({ message: '  I have a 2009 program. ', link: 'https://example.org/program', to: 'other@example.org' }, env);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('Location'), '/history/thank-you/');
  assert.deepEqual(saved, [[null, null, 'I have a 2009 program.', 'https://example.org/program']]);
  assert.equal(await response.text(), '');
  assert.equal(mail.mock.callCount(), 1);
});

test('no public read access or cross-origin writes', async () => {
  const { saved, env } = inbox();
  assert.equal((await onRequest({ request: new Request(endpoint), env })).status, 405);
  assert.equal((await send({ message: 'Test' }, env, { headers: { Origin: 'https://example.org' } })).status, 403);
  assert.deepEqual(saved, []);
});

test('invalid, oversized and bot submissions never reach storage', async () => {
  const { saved, env } = inbox();
  for (const fields of [{ message: '' }, { message: 'Test', email: 'invalid' }, { message: 'Test', link: 'javascript:alert(1)' }, { message: 'x'.repeat(4001) }]) {
    assert.equal((await send(fields, env)).status, 400);
  }
  assert.equal((await send({ message: 'x'.repeat(33000) }, env)).status, 413);
  assert.equal((await send({ message: 'Test', website: 'spam' }, env)).status, 303);
  assert.deepEqual(saved, []);
});

test('rate cap and storage failures do not report success', async () => {
  assert.equal((await send({ message: 'Test' }, inbox(0).env)).status, 429);
  assert.equal((await send({ message: 'Test' })).status, 503);
});

test('preview writes require the test key and report only synthetic test status', async t => {
  const { saved, env } = inbox();
  const mail = mockEmail(t, saved, 'queued');
  env.HISTORY_TEST_KEY = 'x'.repeat(32);
  const preview = key => onRequest({
    env, request: new Request(previewOrigin + '/api/history-submissions', {
      method: 'POST', headers: { Origin: previewOrigin, 'X-History-Test-Key': key },
      body: new URLSearchParams({ message: 'Test 2009 program.' }),
    }),
  });
  assert.equal((await preview('invalid')).status, 403);
  const result = await preview(env.HISTORY_TEST_KEY);
  assert.equal(result.status, 200);
  assert.match(await result.text(), /^Test submission #7 was saved/);
  assert.equal(mail.mock.callCount(), 1);
  assert.match(JSON.parse(mail.mock.calls[0].arguments[1].body).subject, /^\[TEST\]/);
});

test('a rejected email does not discard the public submission', async t => {
  const { saved, env } = inbox();
  mockEmail(t, saved, 'suppressed_recipients');
  t.mock.method(console, 'warn', () => {});
  assert.equal((await send({ message: 'A 2009 program.' }, env)).status, 303);
  assert.equal(saved.length, 1);
  assert.equal(console.warn.mock.callCount(), 1);
});
