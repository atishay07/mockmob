// Builds the Mistake Lab slice 3 fixtures and contracts (spec tmp/mistake-lab-v4/SPEC.md 4.7 to 4.10, 4.12).
//   node scripts/mistake-lab/build-s3-fixtures.mjs          writes data/tests/fixtures/mistake_lab/
//     across_mocks_input.json        five timed mocks, a practice set, repairs, playbook rows (one student)
//     contract_across_v1.json        lab.acrossMocks (and GET /api/me/rules acrossMocks)
//     contract_rules_v1.json         { book: GET /api/me/rules book, summary: lab.rules, playbook: GET /api/me/playbook }
//     contract_rulecheck_v1.json     lab.prove.ruleCheck, one case per state
//     contract_repair_order_v1.json  lab.repairOrder on the slice 1 Full mock with its illustrative cohort read
// Every question, option, repair and count is illustrative: never real bank rows, never real students. Papers are
// scored by the real server scorer and every contract is built by the real builders, so data/tests/lab_loop.test.mjs
// can check that the committed files equal what the code builds today.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreSession } from '../../data/recovery.js';
import { buildMistakeLab } from '../../data/mistake_lab.js';
import { buildAcrossMocks } from '../../data/across_mocks.js';
import { buildRuleBook, ruleSummary, buildRuleCheck, ruleInForce, HABIT_TEXT, strategyFor } from '../../data/rule_book.js';
import { buildRepairOrder } from '../../data/repair_order.js';
import { repairRulesFrom } from '../../src/lib/server/ruleBook.js';
import { mistakeKey } from '../../src/lib/server/repairRecord.js';
import { playbookBody, resolveRule } from '../../src/lib/server/playbook.js';
import { buildAll, FIXTURE_DIR } from './build-fixtures.mjs';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 10, 6, 30); // 10 Oct 2026, 12:00 IST
const USER = 'student-fixture-1';
const CHAPTERS = ['Share Capital', 'Accounting Ratios', 'Cash Flow Statement', 'Partnership Fundamentals', 'Depreciation'];
const SUBJECT_CHAPTERS = { accountancy: CHAPTERS, economics: ['National Income', 'Money and Banking', 'Government Budget', 'Balance of Payments', 'Elasticity'] };

/**
 * One timed mock of `n` questions, scored by the real scorer. `plan` maps a question number to:
 *   unopened | blank (opened, left blank) | wrong | long (150 s, wrong) | longRight (150 s, right)
 *   kw / wk / ww (key to wrong, wrong to key, wrong to another wrong), with `later` for a change on a return visit
 * `marked` numbers carry a mark for review (only with `capture`, which also sends via and an end event).
 */
function mock({ id, subject = 'accountancy', day, n = 50, plan = {}, marked = [], capture = false, mode = 'full' }) {
  const chapters = SUBJECT_CHAPTERS[subject];
  const qs = Array.from({ length: n }, (_, i) => ({
    id: `${id}-q${i + 1}`, chapter: chapters[i % chapters.length], question: `Illustrative question ${i + 1}`,
    options: [0, 1, 2, 3].map((k) => `${id} q${i + 1} statement ${k + 1}`), correctIndex: (i * 3) % 4,
  }));
  const key = (i) => qs[i].correctIndex;
  const wrongA = (i) => (key(i) + 1) % 4;
  const wrongB = (i) => (key(i) + 2) % 4;
  const ev = [];
  let seq = 1;
  const visit = (qid, at) => ev.push({ seq: seq++, qid, at, type: 'visit', ...(capture ? { via: 'next' } : {}) });
  const answer = (qid, at, a) => ev.push({ seq: seq++, qid, at, type: 'answer', answer: a });
  const markEv = (qid, at) => ev.push({ seq: seq++, qid, at, type: 'mark', marked: true });
  const answers = {};
  const returns = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    const num = i + 1;
    const p = plan[num] || 'right';
    const kind = typeof p === 'string' ? p : p.kind;
    const later = typeof p === 'object' && p.later;
    if (kind === 'unopened') continue;
    const qid = qs[i].id;
    visit(qid, t);
    let stay = 68000;
    if (capture && marked.includes(num)) markEv(qid, t + 5000);
    if (kind === 'right') { answer(qid, t + 40000, key(i)); answers[qid] = key(i); }
    if (kind === 'wrong') { answer(qid, t + 40000, wrongB(i)); answers[qid] = wrongB(i); }
    if (kind === 'blank') stay = 45000;
    if (kind === 'long') { stay = 150000; answer(qid, t + 140000, wrongB(i)); answers[qid] = wrongB(i); }
    if (kind === 'longRight') { stay = 150000; answer(qid, t + 140000, key(i)); answers[qid] = key(i); }
    const firstOf = { kw: key(i), wk: wrongA(i), ww: wrongA(i) }[kind];
    const finalOf = { kw: wrongB(i), wk: key(i), ww: wrongB(i) }[kind];
    if (firstOf !== undefined) {
      answer(qid, t + 20000, firstOf);
      if (later) returns.push({ qid, final: finalOf });
      else answer(qid, t + 45000, finalOf);
      answers[qid] = finalOf;
    }
    t += stay;
  }
  // Return visits at the end, each changing its answer.
  for (const r of returns) { visit(r.qid, t); answer(r.qid, t + 30000, r.final); t += 40000; }
  if (capture) ev.push({ seq: seq++, qid: ev.at(-1).qid, at: t + 5000, type: 'end', reason: 'submit' });
  const s = scoreSession(qs, answers, ev, 60 * 60 * 1000);
  return {
    id, subject, completedAt: T0 + day * DAY, total: n, questionsSnapshot: qs, details: s.details,
    selectionMeta: { mode, durationMinutes: 60, scoringVersion: 'server_snapshot_v1', recovery: s.recovery },
    mode,
  };
}

// Four timed mocks (three Accountancy, one Economics) and a practice set that never counts as a timed mock.
const M1 = mock({ id: 'm1', day: 0, plan: { 3: 'kw', 7: 'wk', 9: { kind: 'kw', later: true }, 12: 'long', 15: 'wrong', 18: 'ww', 21: 'longRight', 24: { kind: 'wk', later: true }, 30: 'blank', 44: 'unopened', 45: 'unopened', 46: 'unopened', 47: 'unopened', 48: 'unopened', 49: 'unopened', 50: 'unopened', 33: 'wrong', 36: { kind: 'ww', later: true } } });
const M2 = mock({ id: 'm2', day: 1, subject: 'economics', plan: { 2: 'wk', 5: 'kw', 8: { kind: 'wk', later: true }, 11: 'long', 14: 'wrong', 19: { kind: 'kw', later: true }, 23: 'ww', 27: 'longRight', 31: 'blank', 47: 'unopened', 48: 'unopened', 49: 'unopened', 50: 'unopened', 35: 'wrong' } });
const M3 = mock({ id: 'm3', day: 2, plan: { 4: 'wk', 6: { kind: 'wk', later: true }, 10: 'kw', 13: 'long', 17: 'wrong', 20: { kind: 'ww', later: true }, 22: 'long', 26: 'ww', 29: 'blank', 38: 'wrong', 45: 'unopened', 46: 'unopened', 47: 'unopened', 48: 'unopened', 49: 'unopened', 50: 'unopened', 41: { kind: 'kw', later: true } } });
const M4 = mock({ id: 'm4', day: 4, capture: true, marked: [5, 11, 16, 25, 34, 40], plan: { 2: 'kw', 5: 'blank', 8: { kind: 'wk', later: true }, 11: 'wrong', 14: 'long', 16: 'wrong', 19: 'ww', 23: { kind: 'wk', later: true }, 25: 'blank', 28: 'longRight', 32: 'wk', 37: 'wrong', 47: 'unopened', 48: 'unopened', 49: 'unopened', 50: 'unopened', 43: { kind: 'kw', later: true } } });
const PRACTICE = (() => {
  const m = mock({ id: 'p1', day: 3, n: 10, mode: 'quick', plan: { 2: 'wrong', 4: 'kw' } });
  return { ...m, selectionMeta: { ...m.selectionMeta, mode: 'quick', durationMinutes: undefined, scoringVersion: 'server_practice_v1' }, mode: 'quick' };
})();
// The mock taken after the rule was chosen: every question opened (the rule kept) or 4 never opened (not kept).
const M5_KEPT = mock({ id: 'm5', day: 6, capture: true, marked: [7, 19], plan: { 3: 'kw', 7: 'blank', 12: 'long', 19: 'wrong', 22: 'wk', 31: 'wrong' } });
const M5_NOT = mock({ id: 'm5', day: 6, capture: true, marked: [7, 19], plan: { 3: 'kw', 7: 'blank', 12: 'long', 19: 'wrong', 22: 'wk', 31: 'wrong', 47: 'unopened', 48: 'unopened', 49: 'unopened', 50: 'unopened' } });
const M5_PLAIN = mock({ id: 'm5', day: 6, plan: { 3: 'kw', 12: 'long', 19: 'wrong', 22: 'wk' } }); // no slice 2 capture: no marks recorded

const iso = (ms) => new Date(ms).toISOString();
// Committed repairs: two v3 receipts (rule and memory hook), one v1 receipt (the idea to keep, no hook), and one v3
// receipt repeating a rule already in its chapter (the newest stays).
const RESERVATIONS = [
  { attempt: M4, q: 11, at: T0 + 4 * DAY + 3600000, repair: { why_right: 'Illustrative.', trap: 'Illustrative.', why_wrong: 'Illustrative.', trap_type: 'look_alike_term', rule: 'Calls in arrears are deducted from called-up capital, never added.', memory_hook: 'Arrears are owed to you, not paid.' } },
  { attempt: M4, q: 37, at: T0 + 4 * DAY + 3700000, repair: { why_right: 'Illustrative.', trap: 'Illustrative.', why_wrong: 'Illustrative.', trap_type: 'wrong_rule', rule: 'Quick assets leave out inventory and prepaid expenses.', memory_hook: '' } },
  { attempt: M3, q: 38, at: T0 + 2 * DAY + 3600000, repair: { why_tempting: 'Illustrative.', why_wrong: 'Illustrative.', key_idea: 'Operating activities are the main revenue-producing activities of the business.', next_step: 'Illustrative.' } },
  { attempt: M3, q: 17, at: T0 + 2 * DAY + 3500000, repair: { why_right: 'Illustrative.', trap: 'Illustrative.', why_wrong: 'Illustrative.', trap_type: 'look_alike_term', rule: 'Quick assets leave out inventory and prepaid expenses.', memory_hook: 'Quick means cash soon.' } },
].map(({ attempt, q, at, repair }) => ({ operation_key: `repair:${mistakeKey(USER, attempt.id, `${attempt.id}-q${q}`)}:req-${q}`, updated_at: iso(at), repair }));

// The rule chosen after the fourth Accountancy mock (an older choice retired), before the mock that checks it.
const PLAYBOOK = [
  { id: 2, attempt_id: 'm4', strategy: strategyFor('habit:never_opened'), reflection: HABIT_TEXT.never_opened, evidence_state: 'active', created_at: iso(T0 + 5 * DAY) },
  { id: 1, attempt_id: 'm3', strategy: strategyFor('habit:changes'), reflection: HABIT_TEXT.changes, evidence_state: 'retired', created_at: iso(T0 + 2 * DAY + 7200000) },
];

export function buildS3() {
  const history = [M4, PRACTICE, M3, M2, M1];
  const repairs = repairRulesFrom({ userId: USER, reservations: RESERVATIONS, attempts: history });
  const book = buildRuleBook({ attempts: history, repairs, playbook: PLAYBOOK });
  const sources = { repairs, playbook: PLAYBOOK };
  const input = {
    description: 'One student: four timed mocks with a device record (three Accountancy, one Economics; the newest with slice 2 capture and marks), a practice set, four committed repairs, and the rule chosen after the newest mock. m5 is the mock taken after the rule: kept, not kept, and without capture.',
    userId: USER, attempts: history, reservations: RESERVATIONS, playbook: PLAYBOOK,
    after: { kept: M5_KEPT, notKept: M5_NOT, plain: M5_PLAIN },
  };

  const check = (attempt, rule) => buildRuleCheck({ attempt, attempts: [attempt, ...history], rule: resolveRule(rule, book) });
  const inForce = ruleInForce(PLAYBOOK, M5_NOT);
  const repairRule = book.repairs.chapters.find((ch) => ch.chapter === 'Share Capital').rules[0];
  const rulecheck = {
    not_kept: check(M5_NOT, inForce),
    kept: check(M5_KEPT, inForce),
    counted: check(M5_KEPT, { id: repairRule.id, kind: 'repair', text: repairRule.text, since: iso(T0 + 5 * DAY) }),
    not_checked: check(M5_PLAIN, { id: 'habit:marked', kind: 'habit', text: HABIT_TEXT.marked, since: iso(T0 + 5 * DAY) }),
  };

  const { inputs, fullCohort } = buildAll();
  const full = inputs.full_mock_input;
  const lab = buildMistakeLab({ attempt: full.attempt, answerReviews: full.answerReviews, cohort: fullCohort });

  return {
    input,
    contracts: {
      contract_across_v1: buildAcrossMocks({ attempts: history }),
      contract_rules_v1: { book, summary: ruleSummary(book), playbook: playbookBody({ attempts: history, sources }) },
      contract_rulecheck_v1: rulecheck,
      contract_repair_order_v1: buildRepairOrder({ lab, attempt: full.attempt, answerReviews: full.answerReviews }),
    },
  };
}

const json = (v) => `${JSON.stringify(v, null, 2)}\n`;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { input, contracts } = buildS3();
  mkdirSync(FIXTURE_DIR, { recursive: true });
  writeFileSync(join(FIXTURE_DIR, 'across_mocks_input.json'), json(input));
  for (const [name, value] of Object.entries(contracts)) writeFileSync(join(FIXTURE_DIR, `${name}.json`), json(value));
  console.log(`wrote ${1 + Object.keys(contracts).length} files to ${FIXTURE_DIR}`);
}
