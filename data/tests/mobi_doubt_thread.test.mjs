// Mobi's doubt thread (C-dec 3 and 3b, 20 Oct 2026): 1 credit opens a thread on every plan; the follow-up is free and capped;
// nothing is charged on any failure; the 2 questions are verified bank questions, never invented. No database, no model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  openThread, followUpThread, answerThreadCheck, attachThreadChecks, readThread, resolveAnchor, chooseThreadChecks,
  THREAD_FOLLOW_UPS, THREAD_CHECKS, THREAD_CREDIT_COST, THREAD_FOLLOW_UP_MAX_TOKENS, THREAD_COPY,
} from '../../src/services/mobi/doubtThread.js';
import { createThreadStore } from '../../src/services/mobi/threadStore.js';
import { runModelReply } from '../../src/services/prepos/modelReply.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const user = { id: 'u1' };
const REQ = 'req_0123456789abcdef';

const bankRow = (id, { family = null, chapter = 'Share Capital', key = 1 } = {}) => ({
  id, subject: 'accountancy', chapter, topic: 'Issue of shares', status: 'live', verification_state: 'verified', family_id: family,
  question: `Question ${id}: which of these is right about shares issued at a premium?`,
  options: [`Option one for ${id}`, `Option two for ${id}`, `Option three for ${id}`, `Option four for ${id}`],
  correct_index: key, correctIndex: key, explanation: `Because option two is the rule for ${id}.`,
});

/** One in-memory mentor_sessions table and the bank, as the thread store and the check reads see them. */
function harness({ rows = [bankRow('q1'), bankRow('q2'), bankRow('q3')], seen = [], excluded = [], verifyFails = false, reply = 'Goodwill by super profit: ...', replyFails = false, followFails = false } = {}) {
  const sessions = new Map();
  const calls = [];
  let n = 0;
  const wallet = { reserved: 0, committed: 0, released: 0 };
  const deps = {
    now: () => Date.parse('2026-10-20T12:00:00Z'),
    createThread: async ({ userId, title, thread }) => { const id = `00000000-0000-4000-8000-00000000000${++n}`; sessions.set(id, { user: userId, title, thread }); calls.push(['create']); return id; },
    loadThread: async ({ id, userId }) => { const s = sessions.get(id); return s && s.user === userId ? { id, thread: s.thread } : null; },
    updateThread: async ({ id, thread }) => { sessions.get(id).thread = thread; calls.push(['update', thread.state]); return true; },
    claimFollowUp: async ({ id, used }) => { const t = sessions.get(id).thread; if (t.followUpsUsed !== used) return false; t.followUpsUsed = used + 1; calls.push(['claim']); return true; },
    returnFollowUp: async ({ id, used }) => { const t = sessions.get(id).thread; if (t.followUpsUsed !== used) return false; t.followUpsUsed = used - 1; calls.push(['giveBack']); return true; },
    attachChecks: async ({ id, checks, subject, chapter }) => { const t = sessions.get(id).thread; if (t.checks.length) return false; Object.assign(t, { checks, subject, chapter }); return true; },
    claimCheckResult: async ({ id, slot, result }) => { const c = sessions.get(id).thread.checks[slot]; if (c.result) return { existing: c.result }; c.result = result; return { ok: true }; },
    loadChapterCandidates: async ({ chapter }) => rows.filter((r) => r.chapter === chapter),
    loadSeen: async () => new Set(seen),
    loadExcluded: async () => new Set(excluded),
    verifyPublished: async (ids) => { if (verifyFails) throw new Error('down'); return new Map(rows.filter((r) => ids.includes(r.id)).map((r) => [r.id, r])); },
    recordSeen: async ({ questionId }) => { calls.push(['seen', questionId]); },
    recordProgress: async ({ right }) => { calls.push(['progress', right]); },
    generate: async (args) => { calls.push(['generate', args.maxTokens, args.requestKey]); return followFails ? { ok: false, data: null, failure: { kind: 'timeout' } } : { ok: true, data: { reply: 'Follow-up answer.', cards: [], actions: [] }, usage: { provider: 'openai', model: 'gpt-6-luna', inputTokens: 900, outputTokens: 200 } }; },
    sanitize: (d) => ({ reply: d.reply, cards: [], actions: [] }),
  };
  // The opening reply goes through the real reserve -> commit | release lifecycle, over a fake wallet.
  const replyDeps = {
    reserve: async ({ amount }) => { wallet.reserved += amount; calls.push(['reserve', amount]); return { ok: true }; },
    markExecuting: async () => ({ ok: true }),
    commit: async () => { wallet.committed += 1; calls.push(['commit']); return { ok: true }; },
    release: async () => { wallet.released += 1; calls.push(['release']); return { ok: true }; },
    generate: async () => (replyFails ? { ok: false, data: null, failure: { kind: 'provider_error' } } : { ok: true, data: { reply, cards: [], actions: [] }, usage: { provider: 'openai', model: 'gpt-6-luna', inputTokens: 2000, outputTokens: 300 } }),
    sanitize: (d) => ({ reply: d.reply, cards: [], actions: [] }),
  };
  deps.runReply = ({ creditCost }) => runModelReply({ user, message: 'Explain share premium', requestId: REQ, creditCost, gateOpen: true, deps: replyDeps });
  return { deps, sessions, calls, wallet };
}

const anchor = { subject: 'accountancy', chapter: 'Share Capital' };

test('the rules: 1 credit a thread, 1 follow-up, 2 questions, a short follow-up', () => {
  assert.equal(THREAD_CREDIT_COST, 1);
  assert.equal(THREAD_FOLLOW_UPS, 1);
  assert.equal(THREAD_CHECKS, 2);
  assert.ok(THREAD_FOLLOW_UP_MAX_TOKENS <= 500);
});

test('opening a thread charges 1 credit once, commits it, and ends with 2 verified bank questions (no key sent)', async () => {
  const h = harness();
  const r = await openThread({ user, message: 'Explain share premium', requestId: REQ, anchor, deps: h.deps });
  assert.equal(r.http, 200);
  assert.equal(r.out.charged, 1);
  assert.deepEqual(h.calls.filter((c) => c[0] === 'reserve'), [['reserve', 1]]);
  assert.equal(h.wallet.committed, 1);
  assert.equal(h.wallet.released, 0);
  assert.equal(r.checks.length, 2);
  for (const c of r.checks) {
    assert.ok(['q1', 'q2', 'q3'].includes(c.checkQuestionId));
    assert.equal(c.options.length, 4);
    assert.equal('correct_index' in c || 'key' in c || 'explanation' in c, false, 'no key or explanation before the answer');
  }
  assert.deepEqual(r.thread, { id: r.threadId, followUpsLeft: 1, followUpsMax: 1, subject: 'accountancy', chapter: 'Share Capital' });
  const stored = h.sessions.get(r.threadId).thread;
  assert.equal(stored.state, 'open');
  assert.equal(stored.checks.length, 2);
  assert.equal(h.calls.filter((c) => c[0] === 'seen').length, 2, 'each question is recorded as seen before it is shown');
});

test('the follow-up is free: it never reserves a credit, and the second follow-up is refused as thread_full', async () => {
  const h = harness();
  const r = await openThread({ user, message: 'Explain share premium', requestId: REQ, anchor, deps: h.deps });
  const reservesBefore = h.calls.filter((c) => c[0] === 'reserve').length;
  const f1 = await followUpThread({ user, threadId: r.threadId, message: 'And at a discount?', requestId: 'req_follow_000000001', deps: h.deps });
  assert.equal(f1.http, 200);
  assert.equal(f1.thread.followUpsLeft, 0);
  const gen = h.calls.find((c) => c[0] === 'generate');
  assert.equal(gen[1], THREAD_FOLLOW_UP_MAX_TOKENS, 'the follow-up is a short call');
  const f2 = await followUpThread({ user, threadId: r.threadId, message: 'One more?', requestId: 'req_follow_000000002', deps: h.deps });
  assert.equal(f2.http, 409);
  assert.equal(f2.body.error, 'thread_full');
  assert.equal(f2.body.charged, 0);
  assert.equal(f2.body.message, THREAD_COPY.full);
  assert.equal(h.calls.filter((c) => c[0] === 'reserve').length, reservesBefore, 'no follow-up ever touched the wallet');
  assert.equal(h.calls.filter((c) => c[0] === 'generate').length, 1, 'a refused follow-up never calls the model');
});

test('a failed opening reply releases the credit, closes the thread, and charges nothing', async () => {
  const h = harness({ replyFails: true });
  const r = await openThread({ user, message: 'Explain share premium', requestId: REQ, anchor, deps: h.deps });
  assert.notEqual(r.http, 200);
  assert.equal(r.body.charged, 0);
  assert.equal(h.wallet.committed, 0);
  assert.equal(h.wallet.released, 1);
  const [id] = h.sessions.keys();
  assert.equal(h.sessions.get(id).thread.state, 'failed');
  const f = await followUpThread({ user, threadId: id, message: 'Follow-up?', requestId: 'req_follow_000000001', deps: h.deps });
  assert.equal(f.http, 404, 'a failed thread has no follow-up');
});

test('the thread row is written before any charge: if it cannot be, nothing is reserved', async () => {
  const h = harness();
  h.deps.createThread = async () => { throw new Error('db down'); };
  const r = await openThread({ user, message: 'x', requestId: REQ, anchor, deps: h.deps });
  assert.equal(r.http, 503);
  assert.equal(r.body.charged, 0);
  assert.equal(h.calls.filter((c) => c[0] === 'reserve').length, 0);
});

test('a failed follow-up gives the slot back and charges nothing', async () => {
  const h = harness({ followFails: true });
  const r = await openThread({ user, message: 'Explain share premium', requestId: REQ, anchor, deps: h.deps });
  const f = await followUpThread({ user, threadId: r.threadId, message: 'And at a discount?', requestId: 'req_follow_000000001', deps: h.deps });
  assert.equal(f.http, 502);
  assert.equal(f.body.charged, 0);
  assert.equal(h.sessions.get(r.threadId).thread.followUpsUsed, 0, 'the follow-up is still there');
  assert.ok(h.calls.some((c) => c[0] === 'giveBack'));
});

test('another student cannot use a thread', async () => {
  const h = harness();
  const r = await openThread({ user, message: 'Explain share premium', requestId: REQ, anchor, deps: h.deps });
  const f = await followUpThread({ user: { id: 'u2' }, threadId: r.threadId, message: 'Mine now?', requestId: 'req_follow_000000001', deps: h.deps });
  assert.equal(f.http, 404);
});

test('the questions: never seen, never disputed, never invented; none left says so and charges nothing extra', async () => {
  const h = harness({ seen: ['q1'], excluded: ['q2'] });
  const r = await openThread({ user, message: 'Explain share premium', requestId: REQ, anchor, deps: h.deps });
  assert.deepEqual(r.checks.map((c) => c.checkQuestionId), ['q3']);
  const none = harness({ seen: ['q1', 'q2', 'q3'] });
  const r2 = await openThread({ user, message: 'Explain share premium', requestId: REQ, anchor, deps: none.deps });
  assert.deepEqual(r2.checks, []);
  assert.equal(r2.checksNote, THREAD_COPY.noQuestions);
  assert.equal(none.wallet.committed, 1, 'the answer was delivered; the thread is still the one credit');
});

test('two questions of the same family are never both offered', async () => {
  const h = harness({ rows: [bankRow('q1', { family: 'f1' }), bankRow('q2', { family: 'f1' }), bankRow('q3', { family: 'f2' })] });
  const found = await chooseThreadChecks({ threadId: 't', userId: 'u1', subject: 'accountancy', chapter: 'Share Capital', deps: h.deps });
  assert.equal(found.rows.length, 2);
  assert.notEqual(found.rows[0].family_id, found.rows[1].family_id);
});

test('a bank read that fails offers nothing and says the questions come back on reopening', async () => {
  const h = harness({ verifyFails: true });
  const r = await openThread({ user, message: 'Explain share premium', requestId: REQ, anchor, deps: h.deps });
  assert.equal(r.http, 200);
  assert.deepEqual(r.checks, []);
  assert.equal(r.checksNote, THREAD_COPY.checksUnavailable);
});

test('no chapter: the reply stands, and the student picks the chapter to attach the 2 questions once (free)', async () => {
  const h = harness();
  const r = await openThread({ user, message: 'I do not get premium', requestId: REQ, anchor: null, deps: h.deps });
  assert.deepEqual(r.checks, []);
  assert.equal(r.checksNote, THREAD_COPY.noChapter);
  const catalog = [{ subject: 'accountancy', chapter: 'Share Capital' }];
  const a = await attachThreadChecks({ user, threadId: r.threadId, subject: 'accountancy', chapter: 'Share Capital', catalog, deps: h.deps });
  assert.equal(a.http, 200);
  assert.equal(a.body.checks.length, 2);
  const again = await attachThreadChecks({ user, threadId: r.threadId, subject: 'accountancy', chapter: 'Share Capital', catalog, deps: h.deps });
  assert.equal(again.body.checks.length, 2, 'the second call reads the same two back');
  assert.equal(h.calls.filter((c) => c[0] === 'reserve').length, 1, 'attaching never charges');
});

test('answering: marked by the server against the key, first answer counts, a question not offered is refused', async () => {
  const h = harness();
  const r = await openThread({ user, message: 'Explain share premium', requestId: REQ, anchor, deps: h.deps });
  const c = r.checks[0];
  const keyText = `Option two for ${c.checkQuestionId}`;
  const keyDisplay = c.options.findIndex((o) => o.text === keyText);
  const wrong = (keyDisplay + 1) % 4;
  const first = await answerThreadCheck({ user, threadId: r.threadId, checkQuestionId: c.checkQuestionId, pick: wrong, requestId: 'req_answer_00000001', deps: h.deps });
  assert.equal(first.http, 200);
  assert.equal(first.body.result.right, false);
  assert.equal(first.body.result.key.index, keyDisplay);
  assert.match(first.body.result.explanation, /Because option two/);
  const second = await answerThreadCheck({ user, threadId: r.threadId, checkQuestionId: c.checkQuestionId, pick: keyDisplay, requestId: 'req_answer_00000002', deps: h.deps });
  assert.equal(second.body.replayed, true);
  assert.equal(second.body.result.right, false, 'the first answer counts');
  assert.equal(h.calls.filter((x) => x[0] === 'progress').length, 1);
  const foreign = await answerThreadCheck({ user, threadId: r.threadId, checkQuestionId: 'q_not_offered', pick: 0, requestId: 'req_answer_00000003', deps: h.deps });
  assert.equal(foreign.http, 422);
  const view = await readThread({ user, threadId: r.threadId, deps: h.deps });
  assert.equal(view.body.results[c.checkQuestionId].right, false);
});

test('resolveAnchor: a sent chapter is kept; a typed doubt matches a chapter only when every word of its name is there', () => {
  const catalog = [{ subject: 'accountancy', chapter: 'Share Capital' }, { subject: 'accountancy', chapter: 'Change in Profit Sharing Ratio' }, { subject: 'economics', chapter: 'Money and Banking' }];
  assert.deepEqual(resolveAnchor({ subject: 'accountancy', chapter: 'share capital', catalog }), { subject: 'accountancy', chapter: 'Share Capital', source: 'sent' });
  assert.equal(resolveAnchor({ subject: 'physics', chapter: 'Optics', catalog }), null, 'not a subject of this student');
  assert.deepEqual(resolveAnchor({ message: 'Why does the profit sharing ratio change on admission?', catalog }), { subject: 'accountancy', chapter: 'Change in Profit Sharing Ratio', source: 'matched' });
  assert.equal(resolveAnchor({ message: 'What is goodwill?', catalog }), null);
});

test('the thread store claims the follow-up and the first answer with conditional writes', async () => {
  const filters = [];
  const row = { id: '11111111-1111-4111-8111-111111111111', metadata: { mode: 'mentor', thread: { state: 'open', followUpsUsed: 0, checks: [{ checkQuestionId: 'q1', optionHashes: [] }] } } };
  const q = {
    select() { return this; }, eq(k, v) { filters.push(['eq', k, v]); return this; }, is(k, v) { filters.push(['is', k, v]); return this; },
    maybeSingle: async () => ({ data: row, error: null }), update() { return this; },
    then(resolve) { resolve({ data: [{ id: row.id }], error: null }); },
  };
  const store = createThreadStore({ db: { from: () => q } });
  assert.equal(await store.claimFollowUp({ id: row.id, userId: 'u1', used: 0 }), true);
  assert.ok(filters.some((f) => f[0] === 'eq' && f[1] === 'metadata->thread->>followUpsUsed' && f[2] === '0'));
  await store.claimCheckResult({ id: row.id, userId: 'u1', slot: 0, result: { right: true } });
  assert.ok(filters.some((f) => f[0] === 'is' && f[1] === 'metadata->thread->checks->0->result' && f[2] === null));
  assert.equal(await store.loadThread({ id: 'not-a-uuid', userId: 'u1' }), null, 'a malformed id never reaches the database');
});

test('the chat route: a doubt opens a thread at 1 credit; a follow-up is free; a chaptered doubt never takes the record path', () => {
  const chat = read('src/app/api/ai/mentor/chat/route.js');
  assert.match(chat, /const doubt = \(typeof payload\.subject === 'string'/);
  assert.match(chat, /!threadId && !doubt && insights \? answerFromInsights/);
  assert.match(chat, /openThread\(\{ user: dbUser, message, requestId: payload\.requestId, anchor/);
  assert.match(chat, /followUpThread\(/);
  assert.match(chat, /charge: NO_CHARGE, thread: done\.thread/, 'the follow-up reply says nothing was charged');
  // Every follow-up still goes through the runtime guard with the student's own cap (generate -> generateAIResponse with the spend user).
  assert.match(read('src/services/prepos/replyDeps.js'), /generate: \(\{ requestKey, tier, mode, message, context, maxTokens = null \}\) => generateAIResponse\(\{\s*requestKey, tier, \.\.\.spendUserFor\(user\)/);
});
