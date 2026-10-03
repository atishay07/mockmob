import test from 'node:test';
import assert from 'node:assert/strict';
import { runModelReply, operationKeyFor, PREPOS_PAUSED_MESSAGE } from '../../src/services/prepos/modelReply.js';

const user = { id: 'usr_1' };
const requestId = 'req_0123456789abcdef';

function harness(over = {}) {
  const calls = [];
  const deps = {
    reserve: async (a) => { calls.push(['reserve', a.operationKey]); return over.reserve ? over.reserve(a) : { ok: true, state: 'reserved', balance: 9 }; },
    markExecuting: async (k) => { calls.push(['executing', k]); return over.markExecuting ? over.markExecuting(k) : { ok: true }; },
    generate: async (a) => { calls.push(['generate', a.requestKey]); if (over.generate) return over.generate(a); return { ok: true, data: { reply: 'Practise Goodwill.' }, usage: { provider: 'fixture', model: 'm', inputTokens: 10, outputTokens: 5 } }; },
    sanitize: (d) => (over.sanitize ? over.sanitize(d) : { reply: d.reply, actions: [] }),
    commit: async (k) => { calls.push(['commit', k]); return over.commit ? over.commit(k) : { ok: true }; },
    release: async (k, why) => { calls.push(['release', k, why]); if (over.release) return over.release(k, why); return { ok: true }; },
  };
  return { deps, calls, run: (extra = {}) => runModelReply({ user, message: 'hi', requestId, gateOpen: true, deps, ...extra }) };
}
const kinds = (calls) => calls.map((c) => c[0]);

test('the operation key is one stable string per student action, and rejects weak ids', () => {
  assert.equal(operationKeyFor('usr_1', requestId), `prepos:usr_1:${requestId}`);
  assert.equal(operationKeyFor('usr_1', 'short'), null);
  assert.equal(operationKeyFor('', requestId), null);
});

test('gate closed: nothing is reserved, nothing is called, the paused message is shown', async () => {
  const h = harness();
  const out = await h.run({ gateOpen: false });
  assert.equal(out.status, 'paused');
  assert.equal(out.message, PREPOS_PAUSED_MESSAGE);
  assert.deepEqual(h.calls, []);
});

test('happy path: reserve, execute, generate, then commit once with the provider receipt', async () => {
  const h = harness();
  const out = await h.run();
  assert.equal(out.status, 'answered');
  assert.equal(out.charged, 1);
  assert.deepEqual(kinds(h.calls), ['reserve', 'executing', 'generate', 'commit']);
  assert.equal(new Set(h.calls.map((c) => c[1])).size, 1, 'one operation key end to end, also used as the provider request key');
});

test('insufficient credits blocks before any model call and says questions about the record are free', async () => {
  const h = harness({ reserve: () => ({ ok: false, error: 'insufficient_ai_credits', balance: 0 }) });
  const out = await h.run();
  assert.equal(out.http, 402);
  assert.deepEqual(kinds(h.calls), ['reserve']);
  assert.match(out.message, /free/);
});

test('a provider timeout or exception releases the credit', async () => {
  for (const generate of [() => { throw new Error('timeout'); }, () => ({ ok: false, error: 'timeout' })]) {
    const h = harness({ generate });
    const out = await h.run();
    assert.equal(out.status, 'failed');
    assert.equal(out.charged, 0);
    assert.deepEqual(kinds(h.calls), ['reserve', 'executing', 'generate', 'release']);
    assert.match(out.message, /No credits were used/);
  }
});

test('unusable output (schema invalid or empty reply) releases instead of committing', async () => {
  for (const over of [{ generate: () => ({ ok: true, data: { reply: 'x' }, schemaValid: false }) }, { sanitize: () => ({ reply: '  ' }) }]) {
    const h = harness(over);
    const out = await h.run();
    assert.equal(out.status, 'failed');
    assert.equal(kinds(h.calls).includes('commit'), false);
    assert.equal(kinds(h.calls).at(-1), 'release');
  }
});

test('the same student action arriving twice never runs the model twice', async () => {
  const h = harness({ reserve: () => ({ ok: true, idempotent: true, state: 'committed' }) });
  const out = await h.run();
  assert.equal(out.status, 'duplicate');
  assert.deepEqual(kinds(h.calls), ['reserve']);
  const inflight = harness({ reserve: () => ({ ok: true, idempotent: true, state: 'executing' }) });
  assert.equal((await inflight.run()).status, 'in_progress');
  const released = harness({ reserve: () => ({ ok: false, error: 'operation_released' }) });
  const again = await released.run();
  assert.equal(again.status, 'resend');
  assert.equal(again.charged, 0);
});

test('ledger or database failure fails closed: a missing RPC pauses; a failed release says the credit returns on its own', async () => {
  const missing = harness({ reserve: () => { throw new Error('function does not exist'); } });
  assert.equal((await missing.run()).status, 'paused');
  const stuck = harness({ generate: () => ({ ok: false }), release: () => { throw new Error('db down'); } });
  const out = await stuck.run();
  assert.match(out.message, /returns automatically/);
  assert.equal(out.charged, 0);
});

test('a failed commit keeps the reply but charges nothing; the expiry sweep returns the held credit', async () => {
  const h = harness({ commit: () => { throw new Error('db blip'); } });
  const out = await h.run();
  assert.equal(out.status, 'answered');
  assert.equal(out.commitDeferred, true);
  assert.equal(out.charged, 0);
  assert.equal(kinds(h.calls).includes('release'), false, 'never both answer and release inline');
});
