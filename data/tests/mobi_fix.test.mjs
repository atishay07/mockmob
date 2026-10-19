// Fix it for good (C-dec 3 and 3b, 20 Oct 2026): the repair as Mobi's flagship job, 1 credit on every plan. The second fresh
// check (slot 2), "held" when every check is right, and the student's own history of the trap. No database, no model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openCheck, answerCheck, checkLinks, checkSlot } from '../../src/services/recovery/repairCheck.js';
import { mistakeId } from '../../src/services/recovery/repairFlow.js';
import { slotKeys } from '../../src/services/recovery/repairCheckStore.js';
import { heldOf, trapHistoryFrom, fixJob, FIX_PRICE, FIX_CHECKS, FIX_STEPS } from '../mobi_fix.js';
import { REPAIR_CREDIT_COST, correctIndexOf } from '../mistake_repair.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const fx = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/repair4/pool_goodwill.json', import.meta.url)), 'utf8'));
const user = { id: 'u1' };
const MID = mistakeId('u1', 'a1', 'q_mistake');
const OP = `repair:${MID}:req_0123456789abcdef`;
const snapshot = { id: 'q_mistake', subject: 'accountancy', chapter: 'Partnership Accounts', question: fx.mistake.question, options: fx.mistake.options.map((o) => ({ ...o })), correctIndex: 0 };
const attempt = { id: 'a1', userId: 'u1', subject: 'accountancy', completedAt: Date.parse('2026-10-14T10:00:00Z'), questionsSnapshot: [snapshot], details: [{ qid: 'q_mistake', isCorrect: false, givenIndex: 1 }] };

/** The repair check over fakes, with both slots on one receipt, as repairCheckStore keeps them. */
function harness() {
  const state = { receipt: { repair: { rule: 'Super profit is average profit minus normal profit.', trap_type: 'wrong_rule' } }, seen: new Set(fx.seen), rows: new Map(fx.candidates.map((c) => [c.id, { ...c }])) };
  const calls = [];
  const deps = {
    now: () => Date.parse('2026-10-16T20:00:00Z'),
    loadAttempt: async () => attempt,
    loadQuestion: async () => ({ data: { ...fx.mistake }, error: null }),
    findRepairReservation: async () => ({ operation_key: OP, receipt: state.receipt }),
    loadChapterCandidates: async () => [...state.rows.values()],
    loadSeen: async () => new Set(state.seen),
    loadExcluded: async () => new Set(),
    verifyPublished: async (ids) => new Map(ids.filter((id) => state.rows.has(id)).map((id) => [id, state.rows.get(id)])),
    claimOffer: async ({ offer, replaces, slot = 1 }) => {
      const k = slotKeys(slot);
      calls.push(['offer', slot, offer.checkQuestionId]);
      if (state.receipt[k.check]) return { ok: false, existing: null };
      if ((state.receipt[k.offered]?.checkQuestionId ?? null) !== replaces) return { ok: false, existing: state.receipt[k.offered] || null };
      state.receipt = { ...state.receipt, [k.offered]: offer }; return { ok: true };
    },
    recordSeen: async ({ questionId }) => { state.seen.add(questionId); },
    patchOffer: async ({ patch, slot = 1 }) => { const k = slotKeys(slot); state.receipt = { ...state.receipt, [k.offered]: { ...state.receipt[k.offered], ...patch } }; },
    claimCheck: async ({ check, slot = 1 }) => {
      const k = slotKeys(slot);
      calls.push(['claim', slot]);
      if (state.receipt[k.check]) return { ok: false, existing: state.receipt[k.check] };
      state.receipt = { ...state.receipt, [k.check]: check }; return { ok: true };
    },
    patchCheck: async ({ patch, slot = 1 }) => { const k = slotKeys(slot); state.receipt = { ...state.receipt, [k.check]: { ...state.receipt[k.check], ...patch } }; },
    recordProgress: async () => {},
    scheduleRevise: async (args) => ({ count: args.rows.length, dueDay: args.rows[0].due_day }),
  };
  const open = (slot) => openCheck({ user, attemptId: 'a1', questionId: 'q_mistake', deps, slot });
  const answer = (slot, checkQuestionId, pick) => answerCheck({ user, attemptId: 'a1', questionId: 'q_mistake', checkQuestionId, pick, requestId: `req_${slot}_0123456789abcd`, deps, slot });
  return { deps, state, calls, open, answer };
}
const keyPick = (h, slot) => {
  const k = slotKeys(slot);
  const row = h.state.rows.get(h.state.receipt[k.offered].checkQuestionId);
  const stored = correctIndexOf(row);
  const keyText = (row.options[stored]?.text ?? row.options[stored]);
  return { id: row.id, keyText };
};

test('the job: 1 credit on every plan, two fresh checks, shown in the owner order', () => {
  assert.equal(FIX_PRICE, 1);
  assert.equal(REPAIR_CREDIT_COST, FIX_PRICE, 'the repair charges exactly the job price');
  assert.equal(FIX_CHECKS, 2);
  assert.deepEqual(FIX_STEPS, ['trap', 'why_your_option', 'why_key', 'rule', 'check_1', 'check_2']);
  // No plan makes it free (C-dec 3b): the repair flow never looks at the plan when it reserves.
  const flow = read('src/services/recovery/repairFlow.js');
  assert.match(flow, /deps\.reserve\(\{ userId: user\.id, amount: REPAIR_CREDIT_COST, action: 'score_recovery_repair', operationKey \}\)/);
  assert.doesNotMatch(flow, /isPaidUser|isPremium|fair ?use/i);
});

test('slot 2 offers a second, different fresh question; slot 1 is unchanged', async () => {
  const h = harness();
  const one = await h.open(1);
  assert.equal(one.body.status, 'ready');
  const two = await h.open(2);
  assert.equal(two.body.status, 'ready');
  assert.notEqual(two.body.check.checkQuestionId, one.body.check.checkQuestionId);
  assert.equal(two.body.slot, 2);
  assert.match(two.body.href, /&slot=2$/);
  assert.equal(two.body.charged, 0, 'the checks are part of the one credit');
  assert.ok(h.state.receipt.offered && h.state.receipt.offered2, 'each slot keeps its own offer on the receipt');
  // A reload of slot 1 keeps its question; slot 1 never takes slot 2's.
  assert.equal((await h.open(1)).body.check.checkQuestionId, one.body.check.checkQuestionId);
  assert.equal((await h.open(2)).body.check.checkQuestionId, two.body.check.checkQuestionId);
});

test('held: both checks right holds the fix; recorded on the receipt; a wrong one does not', async () => {
  const h = harness();
  const c1 = (await h.open(1)).body.check;
  const c2 = (await h.open(2)).body.check;
  const k1 = keyPick(h, 1); const k2 = keyPick(h, 2);
  const r1 = await h.answer(1, c1.checkQuestionId, c1.options.find((o) => o.text === k1.keyText).index);
  assert.equal(r1.body.result.right, true);
  assert.equal(r1.body.held, null, 'one of two is not yet held');
  assert.match(r1.body.heldLine, /One check right/);
  const r2 = await h.answer(2, c2.checkQuestionId, c2.options.find((o) => o.text === k2.keyText).index);
  assert.equal(r2.body.result.right, true);
  assert.equal(r2.body.held, true);
  assert.match(r2.body.heldLine, /Both checks right\. This fix is held\./);
  assert.ok(h.state.receipt.check?.right && h.state.receipt.check2?.right, 'both answers are stored on the receipt (the held record)');
  // The answers replay unchanged, and say held again.
  const again = await h.answer(2, c2.checkQuestionId, 0);
  assert.equal(again.body.replayed, true);
  assert.equal(again.body.held, true);
});

test('a wrong check is never held', () => {
  assert.deepEqual(heldOf({ check: { right: true }, check2: { right: false } }).held, false);
  assert.deepEqual(heldOf({ check: { right: false } }).held, false);
  assert.equal(heldOf({ check: { right: true } }).held, null);
  assert.equal(heldOf({ check: { right: true } }, { secondOffered: false }).held, true, 'no second question could be offered: the first decides alone');
  assert.equal(heldOf({ check: { right: true }, offered2: { checkQuestionId: 'x' } }, { secondOffered: false }).held, null, 'a second question was offered: it must be answered');
  assert.deepEqual(heldOf({}), { held: null, heldLine: null });
});

test('slot parsing and links: only 2 means the second; old links stay the first', () => {
  assert.equal(checkSlot('2'), 2);
  assert.equal(checkSlot(2), 2);
  for (const v of [undefined, null, '1', 'x', 3]) assert.equal(checkSlot(v), 1);
  assert.doesNotMatch(checkLinks('a', 'q').href, /slot/);
  assert.match(checkLinks('a', 'q', 2).href, /&slot=2$/);
  assert.deepEqual(slotKeys(1), { offered: 'offered', check: 'check' });
  assert.deepEqual(slotKeys(2), { offered: 'offered2', check: 'check2' });
});

test('the trap history: the student own record of that trap, never for an unnamed trap', () => {
  const rows = [{ trapType: 'missed_not_except', caught: 4, of: 6 }, { trapType: 'reversed', caught: 1, of: 3 }];
  assert.deepEqual(trapHistoryFrom(rows, 'missed_not_except'), { caught: 4, chances: 6, line: 'This trap has caught you 4 times in 6 chances. This fix is aimed at it.' });
  assert.equal(trapHistoryFrom(rows, 'reversed').line, 'This trap has caught you once in 3 chances.');
  assert.equal(trapHistoryFrom(rows, 'other'), null);
  assert.equal(trapHistoryFrom(rows, 'extreme_word'), null);
  for (const r of [trapHistoryFrom(rows, 'missed_not_except'), trapHistoryFrom(rows, 'reversed')]) assert.doesNotMatch(r.line, /!/);
});

test('the mobi block names your pick, the key and the trap; no crowd line yet', () => {
  const question = { options: ['Average profit', 'Normal profit', 'Capital employed', 'Goodwill'] };
  const job = fixJob({ repair: { trap_type: 'wrong_rule' }, question, chosenIndex: 1, keyIndex: 0, history: null });
  assert.deepEqual(job.yourPick, { index: 1, text: 'Normal profit' });
  assert.deepEqual(job.key, { index: 0, text: 'Average profit' });
  assert.equal(job.trap.type, 'wrong_rule');
  assert.equal(job.crowd, null);
  assert.equal(fixJob({ repair: { trap_type: 'other' }, question, chosenIndex: 1, keyIndex: 0 }).trap, null);
  const flow = read('src/services/recovery/repairFlow.js');
  assert.match(flow, /status: 'stored', repair: withLegacyAliases\(stored\), pattern, \.\.\.\(check \? \{ check \} : \{\}\), mobi, charged: 0/, 'a stored repair reopens free with the job');
  assert.match(flow, /status: 'explained', repair: withLegacyAliases\(repair\), pattern, \.\.\.\(check \? \{ check \} : \{\}\), mobi, charged,/);
});
