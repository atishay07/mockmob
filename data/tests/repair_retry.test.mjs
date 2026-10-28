// Mistake Repair, "try it once more before the key", and the rule carried back onto Revise.
// The words and the order match the app (flutter_app review/copy.dart, review/widgets/retry_first.dart; brief
// docs/design-decisions/app-practice-review-1016.md section 4). The server marks every try; the try is never charged for.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  RETRY_COPY, markRetry, retryPickOf, retryReceipt, retryKind, retryVerdict, retryOptionWords, retryMood, requestRetry, reviseRuleBody, REVISE_RULE_COPY,
} from '../repair_retry.mjs';
import { markRetryAnswer } from '../../src/services/recovery/repairRetry.js';
import { runRepair, mistakeId } from '../../src/services/recovery/repairFlow.js';
import { answerRevise, RULE_BUDGET_MS } from '../../src/lib/server/revise.js';
import { ruleForQuestion, repairRulesFrom } from '../../src/lib/server/ruleBook.js';
import { repairMood } from '../repair_presentation.mjs';
import { fakeDb } from '../../scripts/mistake-lab/fake-db.mjs';
import { USER, REVISE_NOW, reviseWorld } from '../../scripts/mistake-lab/build-s4-fixtures.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
// Code only: the comments explain what a file does not do, in the words the check looks for.
const code = (rel) => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ---------- Marking and words ----------

test('the server marks a try against the paper\'s own key: right, the same wrong pick, or a different wrong pick', () => {
  const ctx = { keyIndex: 2, chosenIndex: 1, optionCount: 4 };
  assert.deepEqual(markRetry({ ...ctx, pick: 2 }), { ok: true, retry: { pick: 2, right: true, same: false, keyIndex: 2, chosenIndex: 1 } });
  assert.deepEqual(markRetry({ ...ctx, pick: 1 }), { ok: true, retry: { pick: 1, right: false, same: true, keyIndex: 2, chosenIndex: 1 } });
  assert.deepEqual(markRetry({ ...ctx, pick: 3 }), { ok: true, retry: { pick: 3, right: false, same: false, keyIndex: 2, chosenIndex: 1 } });
  for (const pick of [-1, 4, 1.5, '2', null, undefined, NaN, 8]) assert.deepEqual(markRetry({ ...ctx, pick }), { ok: false, reason: 'invalid_pick' }, String(pick));
});

test('the pick comes from retry_pick (the app) or retryPick; anything but a whole number is no pick', () => {
  assert.equal(retryPickOf({ retry_pick: 2 }), 2);
  assert.equal(retryPickOf({ retryPick: 0 }), 0);
  assert.equal(retryPickOf({ retry_pick: 0, retryPick: 3 }), 0);
  for (const body of [null, {}, { retry_pick: '2' }, { retry_pick: 1.2 }, { retry_pick: null }, { retry_pick: [1] }]) assert.equal(retryPickOf(body), null);
});

test('the verdict is said in words, the same as the app: right, still the same pick, a different pick', () => {
  const right = { pick: 2, right: true, same: false, keyIndex: 2, chosenIndex: 1 };
  const still = { pick: 1, right: false, same: true, keyIndex: 2, chosenIndex: 1 };
  const different = { pick: 3, right: false, same: false, keyIndex: 2, chosenIndex: 1 };
  assert.deepEqual(retryVerdict(right), { kind: 'right', title: 'Right this time.', line: 'Here is why it holds.' });
  assert.deepEqual(retryVerdict(still), { kind: 'still', title: 'Still B.', line: 'The key is C. Here is the trap.' });
  assert.deepEqual(retryVerdict(different), { kind: 'different', title: 'D this time. The key is C.', line: 'Here is why C.' });
  assert.equal(retryVerdict(null), null);
  assert.equal(retryVerdict({ pick: 1 }), null, 'a marking with no key says nothing');
  // The verdict is read from the pick and the key, never from the `right` flag a client could send.
  assert.equal(retryKind({ pick: 1, right: true, keyIndex: 2, chosenIndex: 1 }), 'still');
  for (const text of [RETRY_COPY.title, RETRY_COPY.hint, retryVerdict(right).title, retryVerdict(still).title, retryVerdict(different).title, retryVerdict(different).line]) {
    assert.doesNotMatch(text, /[!—·→]|\p{Extended_Pictographic}/u, text);
  }
});

test('the copy is the app\'s copy word for word', () => {
  const dart = readFileSync(resolve(root, '..', 'wt-owner/flutter_app/lib/features/review/copy.dart'), 'utf8');
  const want = {
    tryTitle: RETRY_COPY.title, tryHint: RETRY_COPY.hint, checkMyAnswer: RETRY_COPY.check, checkMyAnswerNeedsPick: RETRY_COPY.checkNeedsPick,
    showReasonNow: RETRY_COPY.showReasonNow, yourPickNow: RETRY_COPY.yourPickNow, yourPickAndKey: RETRY_COPY.yourPickAndKey, keyWord: RETRY_COPY.key,
    verdictRight: 'Right this time.', verdictRightLine: 'Here is why it holds.', reopenLead: RETRY_COPY.reopenLead, keyExplanationFree: RETRY_COPY.keyFree,
  };
  for (const [name, text] of Object.entries(want)) assert.ok(dart.includes(`static const ${name} = '${text}';`), `${name}: ${text}`);
  assert.ok(dart.includes("static String yourPickIn(String source) => 'Your pick in $source';"));
});

test('the options carry words, never colour alone: the key, your pick now, your pick in the paper, your pick and the key', () => {
  assert.deepEqual(retryOptionWords({ pick: 3, keyIndex: 2, chosenIndex: 1 }, 'this paper'), { 2: 'Key', 3: 'Your pick now', 1: 'Your pick in this paper' });
  assert.deepEqual(retryOptionWords({ pick: 1, keyIndex: 2, chosenIndex: 1 }, 'Mock 2'), { 2: 'Key', 1: 'Your pick now' });
  assert.deepEqual(retryOptionWords({ pick: 2, keyIndex: 2, chosenIndex: 1 }, 'Mock 2'), { 2: 'Your pick and the key', 1: 'Your pick in Mock 2' });
  assert.deepEqual(retryOptionWords(null), {});
  assert.equal(RETRY_COPY.yourPickIn(null), 'Your pick in this paper');
});

test('the receipt keeps the marking and the time, and nothing else', () => {
  const stored = retryReceipt({ pick: 3, right: false, same: false, keyIndex: 2, chosenIndex: 1 }, Date.parse('2026-10-16T06:00:00Z'));
  assert.deepEqual(stored, { pick: 3, right: false, same: false, keyIndex: 2, chosenIndex: 1, at: '2026-10-16T06:00:00.000Z' });
});

test('Mobi listens while the student chooses and answers the verdict with its own act', () => {
  assert.equal(retryMood(null), 'try');
  assert.equal(repairMood('try'), 'listen');
  assert.equal(repairMood(retryMood('right')), 'correct');
  assert.equal(repairMood(retryMood('still')), 'sympathy');
  assert.equal(repairMood(retryMood('different')), 'encourage');
});

// ---------- The call ----------

const reply = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const MARKED = { pick: 3, right: false, same: false, keyIndex: 2, chosenIndex: 1 };

test('a try is marked, declined (the repair then says why) or failed (the pick is kept), and a timeout is a failure', async () => {
  const seen = [];
  const spy = async (url, init) => { seen.push([url, JSON.parse(init.body)]); return reply(200, { ok: true, status: 'marked', retry: MARKED })(); };
  assert.deepEqual(await requestRetry(spy, { attemptId: 'a1', questionId: 'q1', retry_pick: 3 }), { kind: 'marked', retry: MARKED });
  assert.deepEqual(seen, [['/api/recovery/retry', { attemptId: 'a1', questionId: 'q1', retry_pick: 3 }]]);
  assert.deepEqual(await requestRetry(reply(409, { ok: false, error: 'question_under_review', message: 'x' }), {}), { kind: 'declined' });
  assert.deepEqual(await requestRetry(reply(422, { ok: false, error: 'not_a_mistake' }), {}), { kind: 'declined' });
  assert.deepEqual(await requestRetry(reply(503, { ok: false, error: 'question_unavailable' }), {}), { kind: 'failed' });
  assert.deepEqual(await requestRetry(reply(429, { ok: false, error: 'rate_limited' }), {}), { kind: 'failed' });
  assert.deepEqual(await requestRetry(reply(200, { ok: true, retry: { pick: 9 } }), {}), { kind: 'failed' }, 'a marking with no key is not a verdict');
  assert.deepEqual(await requestRetry(async () => { throw new TypeError('offline'); }, {}), { kind: 'failed' });
  assert.deepEqual(await requestRetry(async () => ({ ok: false, status: 500, json: async () => { throw new Error('html'); } }), {}), { kind: 'failed' });
  const hang = (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
  assert.deepEqual(await requestRetry(hang, {}, { timeoutMs: 5 }), { kind: 'failed' });
});

// ---------- The free route's service ----------

const options = [{ key: 'A', text: 'Credited to the old partners' }, { key: 'B', text: 'Credited to all partners equally' }, { key: 'C', text: 'Debited to the new partner' }, { key: 'D', text: 'Carried to revaluation' }];
const snapshot = { id: 'q1', subject: 'accountancy', chapter: 'Goodwill', question: 'Where does the new partner\'s goodwill go?', options, correctIndex: 2 };
const attempt = { id: 'a1', userId: 'u1', subject: 'accountancy', questionsSnapshot: [snapshot], details: [{ qid: 'q1', isCorrect: false, givenIndex: 1 }] };
const live = { id: 'q1', status: 'live', verification_state: 'verified', options: options.map((o) => ({ ...o })), correct_answer: 'C' };
const user = { id: 'u1' };
const retryDeps = (over = {}) => ({
  loadAttempt: async () => ('attempt' in over ? over.attempt : attempt),
  loadQuestion: async () => ({ data: 'live' in over ? over.live : live, error: over.error ?? null }),
});

test('the free service marks a try and sends back the marking, nothing else: no key text, no explanation, no credit', async () => {
  for (const [pick, want] of [[2, 'right'], [1, 'still'], [0, 'different'], [3, 'different']]) {
    const { http, body } = await markRetryAnswer({ user, attemptId: 'a1', questionId: 'q1', pick, deps: retryDeps() });
    assert.equal(http, 200);
    assert.equal(body.charged, 0);
    assert.equal(retryKind(body.retry), want);
    assert.deepEqual(Object.keys(body).sort(), ['charged', 'ok', 'retry', 'status']);
    assert.deepEqual(Object.keys(body.retry).sort(), ['chosenIndex', 'keyIndex', 'pick', 'right', 'same']);
  }
});

test('the free service refuses what the repair refuses: another student, a correct answer, a question under re-check, a bad pick', async () => {
  const run = (over, pick = 2) => markRetryAnswer({ user, attemptId: 'a1', questionId: 'q1', pick, deps: retryDeps(over) });
  assert.equal((await run({ attempt: { ...attempt, userId: 'someone-else' } })).http, 404);
  assert.equal((await run({ attempt: null })).http, 404);
  const right = await run({ attempt: { ...attempt, details: [{ qid: 'q1', isCorrect: true, givenIndex: 2 }] } });
  assert.equal(right.http, 422); assert.equal(right.body.error, 'not_a_mistake');
  const held = await run({ live: { ...live, status: 'pending', verification_state: 'disputed' } });
  assert.equal(held.http, 409); assert.equal(held.body.error, 'question_under_review');
  assert.equal((await run({}, 4)).http, 422);
  assert.equal((await run({}, null)).body.error, 'invalid_pick');
  assert.equal((await run({ error: { message: 'down' }, live: null })).http, 503);
  for (const [attemptId, questionId] of [['', 'q1'], ['a1', ''], [null, 'q1'], ['a'.repeat(161), 'q1']]) {
    assert.equal((await markRetryAnswer({ user, attemptId, questionId, pick: 2, deps: retryDeps() })).http, 422);
  }
  for (const r of [right, held]) assert.equal(r.body.charged, 0);
});

test('the free route spends nothing: no credit code, no model, no write', () => {
  const route = code('src/app/api/recovery/retry/route.js');
  const service = code('src/services/recovery/repairRetry.js');
  for (const file of [route, service]) {
    assert.doesNotMatch(file, /reserve|commit|release|wallet|generateAIResponse|providers|\.insert\(|\.update\(|\.upsert\(|\.rpc\(/);
  }
  assert.match(route, /checkRateLimit\(request, \{ route: '\/api\/recovery\/retry'/);
  assert.match(route, /if \(!session\?\.user\?\.id\) return Response\.json\(\{ ok: false, error: 'Unauthorized' \}, \{ status: 401/);
});

// ---------- The paid repair carries the pick, and the server marks it ----------

const T0 = Date.parse('2026-10-16T06:00:00Z');
const REQ = 'req_0123456789abcdef';
const good = {
  solved_index: 2, agrees_with_key: true, trap_type: 'wrong_rule', trap: 'The old ratio is the first one you see.', why_wrong: 'A new ratio is stated.',
  why_right: 'Sacrifice is old share minus new share.', contrast: 'If the new partner took the old ratio, A would fit.',
  others: [{ index: 0, why: 'This assumes the old ratio.' }, { index: 3, why: 'This is a different account.' }],
  rule: 'Sacrifice is old share minus new share, for each partner.', memory_hook: 'What you had, minus what you keep.', another_way: 'Put every share over 10.',
};
const usage = { provider: 'openai', model: 'gpt-6-luna', inputTokens: 300, outputTokens: 120 };
const config = { route: { provider: 'openai', model: 'gpt-6-luna' }, effort: { repair: 'low', secondOpinion: 'high' }, fallbackRoute: null };
function harness(over = {}) {
  const calls = [];
  const deps = {
    now: () => T0,
    loadAttempt: async () => attempt,
    loadQuestion: async () => ({ data: live, error: null }),
    evidenceEligible: () => false,
    findStored: async () => over.stored ?? null,
    findRepairTraps: async () => [],
    findOpenReservations: async () => [],
    gateOpen: () => true,
    reserve: async (a) => { calls.push(['reserve', a.amount, a.operationKey]); return { ok: true, state: 'reserved', balance: 9 }; },
    markExecuting: async () => ({ ok: true }),
    commit: async (k, receipt) => { calls.push(['commit', k, receipt]); return { ok: true }; },
    release: async (k, why) => { calls.push(['release', k, why]); return { ok: true }; },
    generate: async () => (over.failed ? { ok: false, data: null, usage: null, fallbackUsed: false, failure: { stage: 'primary', kind: 'timeout' } } : { ok: true, data: good, usage, fallbackUsed: false, failure: null }),
    withhold: async () => {},
    readWallet: async () => ({ total: 8, state: 'ok' }),
    log: () => {},
  };
  return { deps, calls, run: (extra = {}) => runRepair({ user, attemptId: 'a1', questionId: 'q1', requestId: REQ, startedAt: T0, deps, config, ...extra }) };
}

test('a fresh repair with a try marks it on the server, stores the marking on the receipt and charges the one credit it always charged', async () => {
  const h = harness();
  const { http, body } = await h.run({ retryPick: 3 });
  assert.equal(http, 200);
  assert.equal(body.status, 'explained');
  assert.deepEqual(body.retry, { pick: 3, right: false, same: false, keyIndex: 2, chosenIndex: 1 });
  assert.equal(body.charged, 1);
  const reserves = h.calls.filter((c) => c[0] === 'reserve');
  assert.equal(reserves.length, 1, 'the try adds no second charge');
  assert.equal(reserves[0][1], 1);
  const commit = h.calls.find((c) => c[0] === 'commit');
  assert.deepEqual(commit[2].retry, { pick: 3, right: false, same: false, keyIndex: 2, chosenIndex: 1, at: '2026-10-16T06:00:00.000Z' });
  assert.equal(commit[2].repair.rule, good.rule, 'the repair itself is unchanged');
});

test('the client\'s idea of right is never trusted: a pick is only ever marked against the key on the server', async () => {
  const h = harness();
  const { body } = await h.run({ retryPick: 1, retry: { right: true }, retryRight: true });
  assert.equal(body.retry.right, false);
  assert.equal(body.retry.same, true);
  const right = await harness().run({ retryPick: 2 });
  assert.equal(right.body.retry.right, true);
});

test('no pick, or a pick that is not an option, is no try: the repair is exactly what it was', async () => {
  for (const retryPick of [undefined, null, 9, -1, 1.5, '2']) {
    const h = harness();
    const { http, body } = await h.run({ retryPick });
    assert.equal(http, 200, String(retryPick));
    assert.equal('retry' in body, false, String(retryPick));
    assert.equal('retry' in h.calls.find((c) => c[0] === 'commit')[2], false);
  }
});

test('a saved repair opened again has no try: the pick is ignored and it stays free', async () => {
  const stored = { ...good, version: 3, generatedAt: '2026-10-14T06:00:00.000Z', model: 'gpt-6-luna' };
  const h = harness({ stored });
  const { http, body } = await h.run({ retryPick: 2 });
  assert.equal(http, 200);
  assert.equal(body.status, 'stored');
  assert.equal(body.charged, 0);
  assert.equal('retry' in body, false);
  assert.equal(h.calls.filter((c) => c[0] === 'reserve').length, 0);
});

test('a repair that fails still gives the credit back, with a try or without one', async () => {
  const h = harness({ failed: true });
  const { body } = await h.run({ retryPick: 2 });
  assert.equal(body.ok, false);
  assert.equal(body.charged, 0);
  assert.equal(h.calls.filter((c) => c[0] === 'release').length, 1);
  assert.equal(h.calls.filter((c) => c[0] === 'commit').length, 0);
});

test('the repair route and the service pass the pick through; the component sends only what the server marked', () => {
  assert.match(read('src/app/api/recovery/repair/route.js'), /retryPick: retryPickOf\(body\)/);
  assert.match(read('src/services/recovery/mistakeRepair.js'), /retryPick = null/);
  assert.match(read('src/services/recovery/mistakeRepair.js'), /startedAt, deps, retryPick, config:/);
  const component = read('src/components/recovery/MistakeRepair.jsx');
  assert.match(component, /\.\.\.\(retryRef\.current \? \{ retry_pick: retryRef\.current\.pick \} : \{\}\)/);
  assert.match(component, /retryRef\.current = outcome\.kind === 'marked' \? outcome\.retry : null;/);
  assert.match(component, /function skip\(\) \{ retryRef\.current = null; setRetry\(null\); run\(\); \}/, '"Show the reason now" sends no pick');
});

// ---------- The rule comes back onto Revise ----------

const reviseOpts = (extra = {}) => ({ db: fakeDb(reviseWorld()), now: REVISE_NOW, ...extra });
const RULE = { rule: 'Sacrifice is old share minus new share, for each partner.', hook: 'What you had, minus what you keep.', repairedAt: '2026-10-14T09:00:00.000Z', day: 'Wed 14 Oct' };

test('Revise returns the student\'s own rule with the answer, right or wrong, and only then', async () => {
  const asked = [];
  const ruleFor = async (userId, questionId) => { asked.push([userId, questionId]); return RULE; };
  const right = (await answerRevise(USER, { questionId: 'r-q1', choice: 1 }, reviseOpts({ ruleFor }))).body;
  assert.equal(right.ok, true);
  assert.deepEqual(right.rule, { text: RULE.rule, hook: RULE.hook, day: 'Wed 14 Oct' });
  const wrong = (await answerRevise(USER, { questionId: 'r-q2', choice: 0 }, reviseOpts({ ruleFor }))).body;
  assert.equal(wrong.correct, false);
  assert.deepEqual(wrong.rule, right.rule);
  assert.deepEqual(asked, [[USER, 'r-q1'], [USER, 'r-q2']]);
  // Never on the question itself: the GET that asks it has no rule, so the rule can never be a hint.
  const get = read('src/lib/server/revise.js');
  assert.doesNotMatch(get.slice(get.indexOf('export function reviseItem'), get.indexOf('async function loadCards')), /rule/i);
});

test('no repair, a failing read or a slow one means no rule, and the answer is graded all the same', async () => {
  const none = (await answerRevise(USER, { questionId: 'r-q1', choice: 1 }, reviseOpts({ ruleFor: async () => null }))).body;
  assert.equal(none.ok, true); assert.equal('rule' in none, false);
  const broke = (await answerRevise(USER, { questionId: 'r-q2', choice: 1 }, reviseOpts({ ruleFor: async () => { throw new Error('down'); } }))).body;
  assert.equal(broke.ok, true); assert.equal('rule' in broke, false);
  const empty = (await answerRevise(USER, { questionId: 'r-q3', choice: 1 }, reviseOpts({ ruleFor: async () => ({ rule: '   ', hook: 'x' }) }))).body;
  assert.equal('rule' in empty, false, 'a blank rule is no rule');
  assert.equal((await answerRevise(USER, { questionId: 'r-q4', choice: 1 }, reviseOpts())).body.error, 'not_due', 'the grading rules are unchanged');
  assert.ok(RULE_BUDGET_MS <= 3000, 'a free extra never holds the answer back for long');
});

test('the rule body is cut to its caps and carries only the words, the hook and the day', () => {
  const body = reviseRuleBody({ rule: 'r'.repeat(900), hook: 'h'.repeat(500), repairedAt: 'x', day: 'Wed 14 Oct', secret: 'no' });
  assert.deepEqual(Object.keys(body).sort(), ['day', 'hook', 'text']);
  assert.equal(body.text.length, 600); assert.equal(body.hook.length, 300);
  assert.deepEqual(reviseRuleBody({ rule: 'R', hook: '  ', repairedAt: '2026-10-14T09:00:00Z' }, () => 'Wed 14 Oct'), { text: 'R', hook: null, day: 'Wed 14 Oct' });
  assert.equal(reviseRuleBody(null), null);
  assert.equal(REVISE_RULE_COPY.from('Wed 14 Oct'), 'From your repair on Wed 14 Oct.');
  assert.equal(REVISE_RULE_COPY.from(null), 'From your repair.');
});

const attemptsFor = (qid) => [{ id: 'a9', userId: 'u1', subject: 'accountancy', questionsSnapshot: [{ id: qid, chapter: 'Goodwill' }], details: [{ qid, isCorrect: false, givenIndex: 1 }] }];
const reservation = (attemptId, qid, repair, at) => ({ operation_key: `repair:${mistakeId('u1', attemptId, qid)}:req_0123456789abcdef`, updated_at: at, repair });
const repairDb = (rows, error = null) => ({ from: () => { const q = { select: () => q, eq: () => q, not: () => q, order: () => q, limit: async () => ({ data: rows, error }) }; return q; } });

test('the rule of the newest committed repair of this question is found across the student\'s papers', async () => {
  const older = { ...good, rule: 'An older rule.', version: 3 };
  const newer = { ...good, version: 3 };
  const attempts = [...attemptsFor('q1'), { ...attemptsFor('q1')[0], id: 'a10' }];
  const db = repairDb([reservation('a9', 'q1', older, '2026-10-12T09:00:00.000Z'), reservation('a10', 'q1', newer, '2026-10-14T09:00:00.000Z')]);
  const found = await ruleForQuestion('u1', 'q1', { db, attemptsOf: async () => attempts });
  assert.deepEqual(found, { rule: good.rule, hook: good.memory_hook, repairedAt: '2026-10-14T09:00:00.000Z', day: 'Wed 14 Oct' });
  assert.equal(repairRulesFrom({ userId: 'u1', reservations: [], attempts }).length, 0);
  assert.equal(await ruleForQuestion('u1', 'other', { db, attemptsOf: async () => attempts }), null, 'a question never repaired has no rule');
  assert.equal(await ruleForQuestion('u1', 'q1', { db: repairDb([], null), attemptsOf: async () => attempts }), null);
  assert.equal(await ruleForQuestion('u1', 'q1', { db: repairDb(null, { message: 'down' }), attemptsOf: async () => attempts }), null);
  assert.equal(await ruleForQuestion('u1', '', { db, attemptsOf: async () => attempts }), null);
  assert.equal(await ruleForQuestion('u2', 'q1', { db: repairDb([reservation('a9', 'q1', newer, '2026-10-14T09:00:00.000Z')]), attemptsOf: async () => attempts }), null, 'another student\'s repair is not found');
});

test('the Revise route asks for the rule from the student\'s own repairs and the card shows it after the answer', () => {
  const route = read('src/app/api/me/revise/answer/route.js');
  assert.match(route, /ruleFor: \(userId, questionId\) => ruleForQuestion\(userId, questionId, \{ attemptsOf: \(\) => Database\.getAttempts\(userId\) \}\)/);
  const run = read('src/components/revise/ReviseRun.jsx');
  assert.ok(run.indexOf('result.rule ?') > run.indexOf('{result.line}') && run.indexOf('result.rule ?') < run.indexOf('{result.explanation ?'), 'line, the rule, then the book explanation');
  assert.match(run, /REVISE_RULE_COPY\.label/);
  const css = read('src/components/revise/revise.css');
  const rule = css.slice(css.indexOf('.rvs-rule {'), css.indexOf('.rvs-result__why'));
  assert.doesNotMatch(rule, /background|box-shadow|border-radius|border-left/, 'one hairline, not a second card');
});

// ---------- The screen ----------

const ROOT_URL = pathToFileURL(`${root}/`).href;
const reactUrl = pathToFileURL(createRequire(resolve(root, 'package.json')).resolve('react')).href;
const HOOKS = `
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const ROOT = ${JSON.stringify(ROOT_URL)};
const REACT = ${JSON.stringify(reactUrl)};
const STUBS = {
  'next/link': "import React from '" + REACT + "'; export default function Link({ href, children, prefetch, ...rest }) { return React.createElement('a', { href, ...rest }, children); }",
  './RepairMobi': 'export default function RepairMobi() { return null; }',
  './KeyReviewNotice': 'export default function KeyReviewNotice() { return null; }',
  './AnswerCorrectionNotice': 'export default function AnswerCorrectionNotice() { return null; }',
};
const ours = (url) => typeof url === 'string' && url.startsWith(ROOT) && !url.includes('/node_modules/');
const isFile = (url) => { try { return statSync(fileURLToPath(url)).isFile(); } catch { return false; } };
export async function resolve(specifier, context, next) {
  if (Object.hasOwn(STUBS, specifier)) return { url: 'stub:' + specifier, shortCircuit: true };
  if (specifier.endsWith('.css')) return { url: 'stub:css', shortCircuit: true };
  if (ours(context.parentURL) && (specifier.startsWith('@/') || specifier.startsWith('./') || specifier.startsWith('../'))) {
    const base = specifier.startsWith('@/') ? new URL('src/' + specifier.slice(2), ROOT).href : new URL(specifier, context.parentURL).href;
    for (const ext of ['', '.js', '.jsx', '.mjs']) if (isFile(base + ext)) return { url: base + ext, shortCircuit: true };
  }
  return next(specifier, context);
}
let swc = null;
export async function load(url, context, next) {
  if (url === 'stub:css') return { format: 'module', source: 'export default null;', shortCircuit: true };
  if (url.startsWith('stub:')) return { format: 'module', source: STUBS[url.slice(5)], shortCircuit: true };
  if (url.endsWith('.jsx')) {
    if (!swc) { swc = createRequire(new URL('package.json', ROOT))('next/dist/build/swc'); await swc.loadBindings?.(); }
    const file = fileURLToPath(url);
    const out = await swc.transform(await readFile(file, 'utf8'), { filename: file, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2022' }, module: { type: 'es6' } });
    return { format: 'module', source: out.code, shortCircuit: true };
  }
  return next(url, context);
}
`;
let loaded = null;
async function screens() {
  if (loaded) return loaded;
  register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);
  const [tryMod, done, React, server] = await Promise.all([
    import(pathToFileURL(resolve(root, 'src/components/recovery/RepairTry.jsx')).href),
    import(pathToFileURL(resolve(root, 'src/components/recovery/MistakeRepair.jsx')).href),
    import('react'),
    import('react-dom/server'),
  ]);
  loaded = {
    attempt: (props) => server.renderToStaticMarkup(React.createElement(tryMod.default, props)),
    verdict: (props) => server.renderToStaticMarkup(React.createElement(tryMod.RepairVerdict, props)),
    done: (props) => server.renderToStaticMarkup(React.createElement(done.RepairDone, props)),
  };
  return loaded;
}
const textOf = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const QUESTION = { text: 'Where does the new partner\'s goodwill go?', passage: null };
const OPTIONS = options.map((o) => o.text);
const tryProps = { number: 11, question: QUESTION, options: OPTIONS, before: 1, source: null, onPick() {}, onCheck() {}, onSkip() {}, cost: null, mobi: null };

test('before the check the question comes back with no key and no marks, the old pick tagged in words, and "Check my answer" off until a pick', async () => {
  const { attempt: render } = await screens();
  const html = render({ ...tryProps, phase: 'pick', pick: null });
  const text = textOf(html);
  assert.match(text, /Question 11 Try it once more before the reason\./);
  assert.ok(text.includes(QUESTION.text));
  for (const option of OPTIONS) assert.ok(text.includes(option));
  assert.match(html, /<fieldset[^>]*>/);
  assert.equal((html.match(/type="radio"/g) || []).length, 4, 'a radio group');
  assert.match(text, /Your pick in this paper/);
  assert.doesNotMatch(text, /\bKey\b|Your pick now|Right this time|Correct answer/, 'nothing says which option is right');
  assert.doesNotMatch(html, /data-kind=/);
  assert.match(html, /<button[^>]*class="[^"]*mr-try__check[^"]*"[^>]*disabled=""[^>]*aria-label="Check my answer, pick an option first"/);
  assert.match(text, /Pick one\. Your first answer here counts\./);
  assert.match(text, /Show the reason now/);
  assert.match(html, /data-before="true"/);
  const picked = render({ ...tryProps, phase: 'pick', pick: 3 });
  assert.doesNotMatch(picked, /mr-try__check[^>]*disabled/);
  assert.match(picked, /data-picked="true"/);
  assert.match(picked, /<input[^>]*checked=""[^>]*value="3"/);
});

test('after the check the options lock and carry their words, and the verdict comes first under them', async () => {
  const { attempt: render } = await screens();
  const retry = { pick: 3, right: false, same: false, keyIndex: 2, chosenIndex: 1 };
  const html = render({ ...tryProps, phase: 'checked', pick: 3, retry, children: 'THE_WAIT_LINE' });
  const text = textOf(html);
  assert.match(html, /<fieldset[^>]*disabled=""/);
  assert.match(html, /data-kind="key"[^>]*>(?:(?!<\/label>).)*Key</s);
  assert.match(html, /data-kind="mine"[^>]*>(?:(?!<\/label>).)*Your pick now</s);
  assert.match(text, /Your pick in this paper/, 'the paper\'s pick keeps its tag');
  assert.ok(text.indexOf('D this time. The key is C.') > text.indexOf(OPTIONS[3]), 'the verdict is under the options');
  assert.ok(text.indexOf('Here is why C.') > text.indexOf('D this time. The key is C.'));
  assert.ok(text.indexOf('THE_WAIT_LINE') > text.indexOf('Here is why C.'), 'then what is happening to the reason');
  assert.doesNotMatch(text, /Check my answer|Pick one\./, 'the pick step is over');
  assert.match(html, /role="status"/);
});

test('a right second try says so plainly, and a still-wrong one leads into the trap', async () => {
  const { attempt: render } = await screens();
  const right = textOf(render({ ...tryProps, phase: 'checked', pick: 2, retry: { pick: 2, right: true, same: false, keyIndex: 2, chosenIndex: 1 } }));
  assert.match(right, /Right this time\. Here is why it holds\./);
  assert.match(right, /Your pick and the key/);
  const still = textOf(render({ ...tryProps, phase: 'checked', pick: 1, retry: { pick: 1, right: false, same: true, keyIndex: 2, chosenIndex: 1 } }));
  assert.match(still, /Still B\. The key is C\. Here is the trap\./);
  assert.doesNotMatch(still, /Your pick in this paper/, 'the paper\'s pick is the pick now');
});

test('a failed check keeps the pick and says what to do', async () => {
  const { attempt: render } = await screens();
  const html = render({ ...tryProps, phase: 'pick', pick: 3, failed: true });
  assert.match(textOf(html), /We could not check that answer\. Your pick is kept\. Try again, or show the reason now\./);
  assert.match(html, /role="alert"/);
  assert.match(html, /<input[^>]*checked=""[^>]*value="3"/);
  assert.match(textOf(render({ ...tryProps, phase: 'checking', pick: 3 })), /Checking your answer\./);
});

test('the finished repair opens on the verdict, then the heading and the reason; without a try it is unchanged', async () => {
  const { done: render } = await screens();
  const state = {
    status: 'explained', charged: 1, wallet: { total: 43, state: 'ok' }, practiceHref: null,
    repair: { version: 3, trap_type: 'wrong_rule', trap: 'T', why_wrong: 'W', why_right: 'R', others: [], rule: 'The rule.', memory_hook: 'H', another_way: 'A', why_tempting: 'T', key_idea: 'The rule.', model: 'x', generatedAt: '2026-10-16T06:00:00.000Z' },
  };
  const base = { chosen: 'B', answer: 'C', number: 11, scheme: 'cuet', folded: true, onToggleFold() {} };
  const withTry = textOf(render({ ...base, state, retry: { pick: 3, right: false, same: false, keyIndex: 2, chosenIndex: 1 } }));
  assert.ok(withTry.indexOf('D this time. The key is C.') > withTry.indexOf('Q11.'));
  assert.ok(withTry.indexOf('D this time. The key is C.') < withTry.indexOf('The wrong rule applied'));
  assert.ok(withTry.indexOf('The wrong rule applied') < withTry.indexOf('Keep this'), 'the rule follows the reason');
  const plain = textOf(render({ ...base, state }));
  assert.doesNotMatch(plain, /this time|Right this time|Still /);
  const none = render({ ...base, state, retry: { pick: 9 } });
  assert.doesNotMatch(none, /mr-verdict/, 'a marking that cannot be read shows no verdict');
});

test('the styles put the paper\'s own options away while the try is on screen, and the verdict moves without a shake', () => {
  const css = read('src/components/recovery/repair-try.css');
  const rules = code('src/components/recovery/repair-try.css');
  assert.match(css, /\.rp-q__body:has\(\.mr--try\) > :is\(\.rp-options, \.rp-expl, \.ml-others\) \{ display: none; \}/);
  assert.match(css, /min-height: 56px/, 'rows are at least 56 px');
  assert.match(css, /@keyframes mr-verdict-in \{ from \{ opacity: 0; transform: translateY\(8px\); \}/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*mr-fade 120ms/);
  assert.doesNotMatch(rules, /shake|transition: all|scale\(0\)|ease-in[^-]/);
  assert.doesNotMatch(rules, /background-clip: text|text-shadow|box-shadow:\s*(?!\s|none)|gradient/, 'no gradient text, no glow, no shadow');
  for (const rule of css.split('\n').filter((l) => /animation:/.test(l) && !/@keyframes/.test(l))) {
    assert.match(rule, /:root:not\(\[data-motion='reduced'\]\)|mr-fade 120ms/, `motion is gated: ${rule.trim().slice(0, 90)}`);
  }
});

test('the result page asks the screen to skip the try for a repair it already has, and hands it the question and the old pick', () => {
  const page = read('src/app/(app)/result/[id]/ResultPageClient.jsx');
  assert.match(page, /before=\{given\} repaired=\{Array\.isArray\(attempt\.repairedIds\) && attempt\.repairedIds\.includes\(q\.id\)\}/);
  assert.match(page, /question=\{\{ text: displayValue\(q\.question \?\? q\.body, ''\), passage:/);
  const route = read('src/app/api/attempts/[id]/route.js');
  assert.match(route, /repairedIds = \[\.\.\.new Set\(\(sources\.repairs \|\| \[\]\)\.filter\(\(r\) => r\.attemptId === attempt\.id\)/);
  assert.match(route, /\.\.\.\(repairedIds \? \{ repairedIds \} : \{\}\)/);
});
