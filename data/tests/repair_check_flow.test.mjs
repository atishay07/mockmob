import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openCheck, answerCheck, checkStatus, checkLinks, publicResult } from '../../src/services/recovery/repairCheck.js';
import { runRepair, mistakeId } from '../../src/services/recovery/repairFlow.js';
import { storedOrder } from '../repair_check.js';

const fx = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/repair4/pool_goodwill.json', import.meta.url)), 'utf8'));
const contract = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/repair4/contract_check_v1.json', import.meta.url)), 'utf8'));
const user = { id: 'u1' };
const REQ = 'req_0123456789abcdef';
const REQ2 = 'req_fedcba9876543210';
const MID = mistakeId('u1', 'a1', 'q_mistake');
const OP = `repair:${MID}:${REQ}`;
const NOW = Date.parse('2026-10-16T20:00:00Z');
const RULE = 'Super profit is average profit minus normal profit.';

const snapshot = { id: 'q_mistake', subject: 'accountancy', chapter: 'Partnership Accounts', question: fx.mistake.question, options: fx.mistake.options.map((o) => ({ ...o })), correctIndex: 0 };
const attempt = { id: 'a1', userId: 'u1', subject: 'accountancy', completedAt: Date.parse('2026-10-14T10:00:00Z'), questionsSnapshot: [snapshot], details: [{ qid: 'q_mistake', isCorrect: false, givenIndex: 1 }] };

function harness(over = {}) {
  const calls = [];
  const state = {
    receipt: over.receipt === undefined ? { repair: { rule: RULE, trap_type: 'wrong_rule' } } : over.receipt,
    seen: new Set(over.seen ?? fx.seen),
    published: new Set(over.published ?? fx.candidates.map((c) => c.id)),
    rows: new Map(fx.candidates.map((c) => [c.id, { ...c }])),
    claimed: 0,
  };
  const deps = {
    now: () => NOW,
    loadAttempt: async () => ('attempt' in over ? over.attempt : attempt),
    loadQuestion: async () => ({ data: 'live' in over ? over.live : { ...fx.mistake }, error: null }),
    findRepairReservation: async () => { calls.push(['reservation']); if (over.reservationError) throw new Error('db'); return state.receipt ? { operation_key: OP, receipt: state.receipt } : null; },
    loadChapterCandidates: async () => { calls.push(['candidates']); if (over.candidatesError) throw new Error('db'); return [...state.rows.values()]; },
    loadSeen: async (args) => { calls.push(['seen', args.userId]); if (over.seenError) throw new Error('db'); return new Set(state.seen); },
    loadExcluded: async () => { calls.push(['excluded']); if (over.excludedError) throw new Error('db'); return new Set(over.excluded ?? []); },
    verifyPublished: async (ids) => { calls.push(['verify', ids]); return new Map(ids.filter((id) => state.published.has(id)).map((id) => [id, state.rows.get(id)])); },
    claimCheck: async ({ check }) => {
      calls.push(['claim']);
      if (over.claimError) throw new Error('db');
      if (over.claimLoses) return { ok: false, existing: over.claimLoses };
      if (state.receipt.check) return { ok: false, existing: state.receipt.check };
      state.receipt = { ...state.receipt, check }; state.claimed += 1; return { ok: true };
    },
    patchCheck: async ({ patch }) => { calls.push(['patch']); if (over.patchError) throw new Error('db'); state.receipt = { ...state.receipt, check: { ...state.receipt.check, ...patch } }; },
    recordProgress: async (args) => { calls.push(['progress', args]); if (over.progressError) throw new Error('db'); },
    scheduleRevise: async (args) => { calls.push(['revise', args]); if (over.reviseError) throw new Error('db'); if (over.reviseMissing) return null; return { count: args.rows.length, dueDay: args.rows[0].due_day }; },
  };
  return { deps, calls, state, open: (extra = {}) => openCheck({ user, attemptId: 'a1', questionId: 'q_mistake', deps, ...extra }), answer: (extra = {}) => answerCheck({ user, attemptId: 'a1', questionId: 'q_mistake', checkQuestionId: 'q_concept', pick: 0, requestId: REQ, deps, ...extra }) };
}
const kinds = (calls) => calls.map((c) => c[0]);
const displayOf = (stored, text) => stored.options.find((o) => o.text === text).index;

test('GET: one fresh question in the bank option order, with no key, no explanation and no marks; the same on a reload; free', async () => {
  const h = harness();
  const first = await h.open();
  assert.equal(first.http, 200);
  assert.equal(first.body.status, 'ready');
  assert.equal(first.body.charged, 0);
  assert.equal(first.body.check.checkQuestionId, 'q_concept');
  assert.equal(first.body.check.basis, 'concept');
  assert.deepEqual(first.body.check.pool, { unseen: 3, ofChapter: 9 });
  assert.equal(first.body.check.rule, RULE);
  assert.deepEqual(first.body.check.options.map((o) => o.index), [0, 1, 2, 3]);
  const serialised = JSON.stringify(first.body);
  assert.doesNotMatch(serialised, /correct_answer|correctIndex|"key"|isKey|explanation|Goodwill is super profit divided/);
  const again = await h.open();
  assert.deepEqual(again.body, first.body, 'a reload shows the same question in the same order');
  assert.deepEqual(first.body.check.options.map((o) => o.text), storedOrder().map((i) => fx.candidates[0].options[i].text));
  assert.deepEqual(Object.keys(first.body).sort(), Object.keys(contract.get.ready.body).filter((k) => k !== 'notes').sort());
  assert.deepEqual(Object.keys(first.body.check).sort(), Object.keys(contract.get.ready.body.check).sort());
  assert.deepEqual(first.body, { ...first.body, ...checkLinks('a1', 'q_mistake') });
});

test('GET: never a seen, held, same-family, near-copy, passage or 3-option question; never one the publication gate refuses', async () => {
  const h = harness({ seen: ['q_seen', 'q_concept', 'q_topic'], published: ['q_chapter', 'q_topic'] });
  const r = await h.open();
  assert.equal(r.body.check.checkQuestionId, 'q_chapter');
  // The gate refuses everything the cheap filters left: nothing is offered, and the reason says so with its counts.
  const none = await harness({ published: [] }).open();
  assert.equal(none.http, 200);
  assert.deepEqual({ status: none.body.status, reason: none.body.reason, pool: none.body.pool }, { status: 'none', reason: 'no_unseen', pool: { ofChapter: 9, unseen: 0 } });
  // Held through an open dispute (the excluded set), through every route.
  const held = await harness({ excluded: ['q_concept', 'q_topic', 'q_chapter'] }).open();
  assert.equal(held.body.status, 'none');
  assert.equal(held.body.message, contract.reasons.no_unseen);
});

test('GET: the walk down the ranked list reads full rows in small batches and stops at the first accepted question', async () => {
  const h = harness();
  await h.open();
  const verifies = h.calls.filter((c) => c[0] === 'verify');
  assert.equal(verifies.length, 1);
  assert.deepEqual(verifies[0][1], ['q_concept', 'q_topic', 'q_chapter']);
});

test('GET: a passage-linked mistake has no check; a failed seen-lookup offers nothing (fail closed); a missing repair says repair_first', async () => {
  const passageLive = { ...fx.mistake, passage_text: 'A passage about a firm.', question_type: 'case_study' };
  const p = await harness({ live: passageLive, attempt: { ...attempt, questionsSnapshot: [{ ...snapshot, passageText: 'A passage about a firm.' }] } }).open();
  assert.equal(p.body.status, 'none');
  assert.equal(p.body.reason, 'passage_format');
  const lookup = await harness({ seenError: true }).open();
  assert.equal(lookup.http, 503);
  assert.deepEqual({ status: lookup.body.status, reason: lookup.body.reason, charged: lookup.body.charged }, { status: 'none', reason: 'lookup_failed', charged: 0 });
  assert.equal(lookup.body.message, contract.reasons.lookup_failed);
  const dispute = await harness({ excludedError: true }).open();
  assert.equal(dispute.http, 503, 'a held question must never slip through a failed lookup');
  assert.equal(dispute.body.reason, 'check_unavailable');
  const nothing = await harness({ receipt: null }).open();
  assert.equal(nothing.http, 409);
  assert.equal(nothing.body.error, 'repair_first');
  assert.equal(nothing.body.message, contract.reasons.repair_first);
  const noRepair = await harness({ receipt: { provider: 'x' } }).open();
  assert.equal(noRepair.body.error, 'repair_first');
  assert.equal((await harness({ reservationError: true }).open()).http, 503);
});

test('GET: follows the repair eligibility (not your session, not a mistake, held or corrected mistake) and validates its input', async () => {
  assert.equal((await harness({ attempt: { ...attempt, userId: 'someone_else' } }).open()).http, 404);
  assert.equal((await harness({ attempt: { ...attempt, details: [{ qid: 'q_mistake', isCorrect: true, givenIndex: 0 }] } }).open()).http, 422);
  const held = await harness({ live: { ...fx.mistake, verification_state: 'disputed' } }).open();
  assert.equal(held.http, 409);
  assert.equal(held.body.error, 'question_under_review');
  const changed = await harness({ live: { ...fx.mistake, correct_answer: 'B' } }).open();
  assert.equal(changed.http, 409);
  assert.equal(changed.body.error, 'key_changed');
  for (const bad of [{ attemptId: '' }, { attemptId: 5 }, { questionId: null }, { attemptId: 'x'.repeat(161) }]) {
    const r = await harness().open(bad);
    assert.equal(r.http, 422);
    assert.deepEqual(r.body, contract.get.errors['422']);
  }
});

test('POST right: marks against the key, stores once on the receipt, writes progress and Revise, charges nothing and touches no credit', async () => {
  const h = harness();
  const ready = await h.open();
  const keyText = 'Super profit and the normal rate of return';
  const pick = ready.body.check.options.find((o) => o.text === keyText).index;
  const r = await h.answer({ pick });
  assert.equal(r.http, 200);
  assert.equal(r.body.status, 'answered');
  assert.equal(r.body.replayed, false);
  assert.equal(r.body.charged, 0);
  assert.equal(r.body.result.right, true);
  assert.deepEqual(r.body.result.key, { index: pick, text: keyText });
  assert.deepEqual(r.body.result.picked, { index: pick, text: keyText });
  assert.equal(r.body.result.explanation, 'Goodwill is super profit divided by the normal rate of return.');
  assert.equal(r.body.result.ruleLine, RULE);
  assert.match(r.body.result.line, /^Right on a new question from the same concept\./);
  assert.equal(r.body.result.basis, 'concept');
  assert.equal(r.body.result.options.filter((o) => o.isKey).length, 1);
  assert.equal(r.body.result.options.find((o) => o.isKey).text, keyText);
  assert.deepEqual(r.body.result.revise, { scheduled: true, nextAt: '2026-10-17T18:30:00.000Z', dueDay: '2026-10-18', whenLabel: 'tomorrow', cards: 1 });
  assert.deepEqual(Object.keys(r.body).sort(), Object.keys(contract.post.ok.body).filter((k) => k !== 'result').concat('result').sort());
  assert.deepEqual(Object.keys(r.body.result).sort(), Object.keys(contract.post.ok.body.result).sort());
  assert.deepEqual(kinds(h.calls).filter((k) => ['claim', 'progress', 'revise', 'patch'].includes(k)), ['claim', 'progress', 'revise', 'patch']);
  const progress = h.calls.find((c) => c[0] === 'progress')[1];
  assert.equal(progress.right, true);
  assert.equal(progress.row.id, 'q_concept');
  assert.equal(progress.pickedStored, 0, 'progress is written in the stored option order');
  const revise = h.calls.find((c) => c[0] === 'revise')[1];
  assert.deepEqual(revise.rows.map((x) => x.question_id), ['q_mistake'], 'a right check sends the mistake back to Revise');
  assert.equal(h.state.receipt.check.requestId, REQ);
  assert.equal(h.state.receipt.check.progressRecorded, true);
  assert.equal(h.state.receipt.repair.rule, RULE, 'the repair on the receipt is untouched');
  // No credit function exists on the deps at all: there is no way for this flow to reserve, commit or release.
  for (const name of ['reserve', 'commit', 'release', 'markExecuting', 'generate']) assert.equal(name in h.deps, false);
});

test('POST wrong: the key and the explanation are shown, the missed question and the mistake both go to Revise tomorrow', async () => {
  const h = harness();
  const ready = await h.open();
  const wrongPick = ready.body.check.options.find((o) => o.text === 'Sales and the purchase returns').index;
  const r = await h.answer({ pick: wrongPick });
  assert.equal(r.body.result.right, false);
  assert.equal(r.body.result.key.text, 'Super profit and the normal rate of return');
  assert.equal(r.body.result.picked.text, 'Sales and the purchase returns');
  assert.match(r.body.result.line, /^Missed on a new question from the same concept\. It is in Revise tomorrow\./);
  assert.deepEqual(h.calls.find((c) => c[0] === 'revise')[1].rows.map((x) => x.question_id), ['q_mistake', 'q_concept']);
  assert.equal(h.calls.find((c) => c[0] === 'progress')[1].right, false);
  assert.equal(r.body.result.revise.cards, 2);
});

test('POST is idempotent: the same request again, a new request id and any other question all get the stored answer back and write nothing twice', async () => {
  const h = harness();
  const ready = await h.open();
  const r1 = await h.answer({ pick: ready.body.check.options[0].index });
  const writes = () => kinds(h.calls).filter((k) => ['claim', 'progress', 'revise', 'patch'].includes(k)).length;
  const before = writes();
  const replay = await h.answer({ pick: 3 });
  assert.equal(replay.body.replayed, true);
  assert.equal(replay.body.charged, 0);
  assert.deepEqual(replay.body.result, r1.body.result, 'the first answer counts: a different pick on a retry is ignored');
  const newRequest = await h.answer({ pick: 2, requestId: REQ2 });
  assert.deepEqual(newRequest.body.result, r1.body.result);
  const otherQuestion = await h.answer({ pick: 1, checkQuestionId: 'q_topic', requestId: REQ2 });
  assert.deepEqual(otherQuestion.body.result, r1.body.result, 'one check per repair');
  assert.equal(writes(), before, 'no claim, progress, Revise or patch on a replay');
  assert.equal(h.state.claimed, 1);
  // And GET after the answer shows the stored result, with the same options in the order the student saw.
  const after = await h.open();
  assert.equal(after.body.status, 'answered');
  assert.deepEqual(after.body.result, r1.body.result);
  assert.deepEqual(after.body.check.options.map((o) => o.text), ready.body.check.options.map((o) => o.text));
});

test('POST race: when another request claimed the receipt first, the loser returns that answer and writes no progress or Revise', async () => {
  const winner = { ...publicResult({ right: false, checkQuestionId: 'q_concept', pick: 1, key: { index: 0, text: 'k' }, picked: { index: 1, text: 'p' }, explanation: '', line: 'x', basis: 'concept', basisLine: 'y', options: [], answeredAt: 'z' }) };
  const h = harness({ claimLoses: winner });
  const r = await h.answer({ pick: 1 });
  assert.equal(r.body.replayed, true);
  assert.equal(r.body.result.right, false);
  assert.equal(h.calls.some((c) => c[0] === 'progress' || c[0] === 'revise'), false);
});

test('POST validation: ids, request id and pick are checked before any read', async () => {
  for (const bad of [{ attemptId: '' }, { questionId: 3 }, { checkQuestionId: undefined }, { requestId: 'short' }, { requestId: 'has spaces in it 1234567' }, { requestId: undefined }]) {
    const h = harness();
    const r = await h.answer(bad);
    assert.equal(r.http, 422, JSON.stringify(bad));
    assert.equal(r.body.error, 'invalid_request');
    assert.equal(h.calls.length, 0, 'nothing was read');
  }
  for (const pick of [-1, 4, 1.5, '2', null, undefined, Number.NaN]) {
    const r = await harness().answer({ pick });
    assert.equal(r.http, 422);
    assert.deepEqual(r.body.error, 'invalid_pick');
    assert.equal(r.body.message, contract.reasons.invalid_pick);
  }
  assert.equal((await harness({ receipt: null }).answer()).body.error, 'repair_first');
});

test('POST: a question that is no longer offerable (seen since, held, invented, refused by the gate) is refused as check_changed and nothing is written', async () => {
  for (const [label, over, id] of [
    ['seen since the offer', { seen: ['q_seen', 'q_concept'] }, 'q_concept'],
    ['held since the offer', { excluded: ['q_concept'] }, 'q_concept'],
    ['never a candidate', {}, 'q_invented'],
    ['a family-mate of the mistake', {}, 'q_family'],
    ['the gate refused it', { published: ['q_topic'] }, 'q_concept'],
    ['the mistake itself', {}, 'q_mistake'],
  ]) {
    const h = harness(over);
    const r = await h.answer({ checkQuestionId: id });
    assert.equal(r.http, 409, label);
    assert.equal(r.body.error, 'check_changed', label);
    assert.equal(r.body.message, contract.reasons.check_changed);
    assert.equal(h.calls.some((c) => ['claim', 'progress', 'revise'].includes(c[0])), false, label);
  }
});

test('POST marks against today\'s key: a key corrected after the offer scores by the new key text', async () => {
  const h = harness();
  const ready = await h.open();
  h.state.rows.set('q_concept', { ...h.state.rows.get('q_concept'), correct_answer: 'B' });
  const oldKey = ready.body.check.options.find((o) => o.text === 'Super profit and the normal rate of return').index;
  const r = await h.answer({ pick: oldKey });
  assert.equal(r.body.result.right, false);
  assert.equal(r.body.result.key.text, 'Drawings and the closing capital');
  // A row that no longer passes answer integrity is refused, not scored.
  const broken = harness();
  broken.state.rows.set('q_concept', { ...broken.state.rows.get('q_concept'), options: broken.state.rows.get('q_concept').options.slice(0, 3) });
  const refused = await broken.answer();
  assert.equal(refused.http, 409);
  assert.equal(broken.calls.some((c) => c[0] === 'claim'), false);
});

test('POST: a failed progress write or a missing revise_cards table never fails the answer; it says what was not done', async () => {
  const noProgress = harness({ progressError: true });
  const a = await noProgress.answer();
  assert.equal(a.http, 200);
  assert.equal(noProgress.state.receipt.check.progressRecorded, false);
  const noRevise = harness({ reviseMissing: true });
  const b = await noRevise.answer({ pick: 3 });
  assert.equal(b.http, 200);
  assert.deepEqual(b.body.result.revise, { scheduled: false, reason: 'unavailable', nextAt: null });
  assert.doesNotMatch(b.body.result.line, /Revise/);
  const reviseThrows = await harness({ reviseError: true }).answer();
  assert.equal(reviseThrows.http, 200);
  assert.equal(reviseThrows.body.result.revise.scheduled, false);
  const patchFails = await harness({ patchError: true }).answer();
  assert.equal(patchFails.http, 200);
  // Storing the answer is the one thing that must work: if it cannot be claimed nothing else is written.
  const claimFails = harness({ claimError: true });
  const c = await claimFails.answer();
  assert.equal(c.http, 503);
  assert.equal(c.body.reason, 'check_unavailable');
  assert.equal(claimFails.calls.some((x) => x[0] === 'progress' || x[0] === 'revise'), false);
});

test('checkStatus: ready, none, answered, not saved and unchecked; never question text or a key; never longer than its budget', async () => {
  const links = checkLinks('a1', 'q_mistake');
  const ready = await checkStatus({ user, attemptId: 'a1', questionId: 'q_mistake', deps: harness().deps });
  assert.deepEqual(ready, { available: true, reason: null, message: null, status: 'ready', ...links });
  assert.deepEqual(ready, { ...contract.repairResponseGains.examples.ready, ...links });
  const none = await checkStatus({ user, attemptId: 'a1', questionId: 'q_mistake', deps: harness({ published: [] }).deps });
  assert.deepEqual(none, { ...contract.repairResponseGains.examples.none, ...links });
  const answeredH = harness();
  await answeredH.answer();
  assert.deepEqual(await checkStatus({ user, attemptId: 'a1', questionId: 'q_mistake', deps: answeredH.deps }), { ...contract.repairResponseGains.examples.answered, ...links });
  const unsaved = await checkStatus({ user, attemptId: 'a1', questionId: 'q_mistake', deps: harness().deps, committed: false });
  assert.deepEqual([unsaved.available, unsaved.status, unsaved.reason], [false, 'none', 'not_saved']);
  const failed = await checkStatus({ user, attemptId: 'a1', questionId: 'q_mistake', deps: harness({ candidatesError: true }).deps });
  assert.deepEqual({ ...contract.repairResponseGains.examples.unchecked, ...links }, { ...failed, reason: 'check_unavailable', message: contract.reasons.check_unavailable });
  const slow = harness();
  slow.deps.loadChapterCandidates = () => new Promise(() => {});
  const t0 = Date.now();
  const timedOut = await checkStatus({ user, attemptId: 'a1', questionId: 'q_mistake', deps: slow.deps, budgetMs: 40 });
  assert.equal(timedOut.status, 'unchecked');
  assert.ok(Date.now() - t0 < 1000);
  const serialised = JSON.stringify(ready);
  assert.doesNotMatch(serialised, /q_concept|correct|explanation|"options"|"question"/i);
});

// ---- the repair response itself -------------------------------------------------------------------------------------------
const passage = { id: 'q_mistake', status: 'live', verification_state: 'verified', options: fx.mistake.options.map((o) => ({ ...o })), correct_answer: 'A', subject: 'accountancy', chapter: 'Partnership Accounts' };
const good = {
  solved_index: 0, agrees_with_key: true, trap_type: 'wrong_rule',
  trap: 'Adding the two profits looks like a total.',
  why_wrong: 'Super profit is an excess, so it is a difference, not a sum.',
  why_right: 'Average profit minus normal profit is the excess over a normal return.',
  contrast: 'A sum would be total profit. The question asks for the excess, so a difference.',
  others: [{ index: 2, why: 'It reverses the order and gives a negative figure.' }, { index: 3, why: 'A ratio is not a profit amount.' }],
  rule: RULE, memory_hook: 'Excess means subtract.', another_way: 'Ask what is left after the normal return is paid.',
};
function repairHarness(over = {}) {
  const calls = [];
  const check = harness();
  const deps = {
    now: () => NOW,
    loadAttempt: async () => attempt,
    loadQuestion: async () => ({ data: passage, error: null }),
    evidenceEligible: () => false,
    findStored: async () => over.stored ?? null,
    findRepairTraps: async () => [],
    findOpenReservations: async () => [],
    gateOpen: () => true,
    reserve: async (a) => { calls.push(['reserve', a.operationKey]); return { ok: true, state: 'reserved', balance: 9 }; },
    markExecuting: async () => ({ ok: true }),
    commit: async (k, receipt) => { calls.push(['commit', k, receipt]); return over.commit ? over.commit() : { ok: true }; },
    release: async (k, why) => { calls.push(['release', k, why]); return { ok: true }; },
    generate: async () => ({ ok: true, data: good, usage: { provider: 'openai', model: 'gpt-6-luna', inputTokens: 1, outputTokens: 1 }, fallbackUsed: false, failure: null }),
    withhold: async () => {},
    readWallet: async () => ({ total: 8, state: 'ok' }),
    log: () => {},
  };
  if (over.withCheck !== false) {
    deps.checkStatus = async (args) => { calls.push(['checkStatus', args.committed, !!args.preloaded.attempt, !!args.preloaded.current, args.preloaded.reservation?.receipt?.repair?.rule ?? null]); return checkStatus({ ...args, deps: check.deps }); };
  }
  const config = { route: { provider: 'openai', model: 'gpt-6-luna' }, effort: { repair: 'low', secondOpinion: 'high' }, fallbackRoute: null };
  return { calls, check, run: () => runRepair({ user, attemptId: 'a1', questionId: 'q_mistake', requestId: REQ, startedAt: NOW, deps, config }) };
}

test('the repair response gains check on explained and stored, with no second charge and no extra credit call', async () => {
  const h = repairHarness();
  const { http, body } = await h.run();
  assert.equal(http, 200);
  assert.equal(body.status, 'explained');
  assert.equal(body.charged, 1);
  assert.equal(body.check.available, true);
  assert.equal(body.check.status, 'ready');
  assert.equal(body.check.askHref, '/mentor?tab=ask&q=a1:q_mistake');
  assert.deepEqual(h.calls.map((c) => c[0]), ['reserve', 'commit', 'checkStatus'], 'one reserve and one commit: the check adds no charge');
  assert.equal(h.calls[2][1], true);
  assert.equal(h.calls[2][4], RULE, 'the just-committed receipt is handed over, so the status needs no extra read');
  const stored = repairHarness({ stored: { ...good, trap_type: 'wrong_rule', generatedAt: '2026-10-16T01:00:00Z', version: 3 } });
  const s = await stored.run();
  assert.equal(s.body.status, 'stored');
  assert.equal(s.body.charged, 0);
  assert.equal(s.body.check.status, 'ready');
  assert.deepEqual(stored.calls.map((c) => c[0]), ['checkStatus']);
});

test('a repair that could not be saved says so on check; a dead check service never breaks the repair', async () => {
  const unsaved = repairHarness({ commit: async () => ({ ok: false }) });
  const a = await unsaved.run();
  assert.equal(a.http, 200);
  assert.equal(a.body.status, 'explained');
  assert.equal(a.body.check.reason, 'not_saved');
  assert.equal(a.body.check.available, false);
  const none = repairHarness({ withCheck: false });
  const b = await none.run();
  assert.equal(b.http, 200);
  assert.equal('check' in b.body, false, 'an old wiring without the check dep leaves the response as it was');
  const throws = repairHarness();
  throws.check.deps.loadChapterCandidates = async () => { throw new Error('boom'); };
  const c = await throws.run();
  assert.equal(c.http, 200);
  assert.equal(c.body.check.status, 'unchecked');
});
