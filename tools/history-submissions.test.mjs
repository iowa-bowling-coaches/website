import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onRequest } from '../functions/api/history-submissions.js';

const origin = 'https://iowabowlingcoaches.org';
const endpoint = origin + '/api/history-submissions';

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
      HISTORY_INBOX: { prepare(sql) {
        assert.match(sql, /INSERT INTO history_submissions/);
        return { bind(...values) {
          return { async run() { if (changes) saved.push(values); return { success: true, meta: { changes } }; } };
        } };
      } },
    },
  };
}

test('valid form stores only submitted fields and then redirects', async () => {
  const { saved, env } = inbox();
  const response = await send({ message: '  I have a 2009 program. ', link: 'https://example.org/program' }, env);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('Location'), '/history/thank-you/');
  assert.deepEqual(saved, [[null, null, 'I have a 2009 program.', 'https://example.org/program']]);
  assert.equal(await response.text(), '');
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
