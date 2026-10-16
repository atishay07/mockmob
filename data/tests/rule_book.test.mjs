// The Rule book, the rule in force, the rule check and the start sheet line (data/rule_book.js; spec
// tmp/mistake-lab-v4/SPEC.md 4.8, 4.10, 4.12). Fixtures: scripts/mistake-lab/build-s3-fixtures.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRuleBook, buildRuleCheck, ruleInForce, activeRule, ruleRows, startSheetLines, measureHabit, parseRuleId,
  choosableRule, bookRules, HABIT_TEXT, RULE_RULES, strategyFor, attemptStart,
} from '../rule_book.js';
import { mockRecord } from '../across_mocks.js';
import { LAB_COPY } from '../mistake_lab.js';
import { wilson } from '../prepos_insights.js';
import { scoreSession } from '../recovery.js';
import { repairRulesFrom } from '../../src/lib/server/ruleBook.js';
import { mistakeKey } from '../../src/lib/server/repairRecord.js';
import { resolveRule } from '../../src/lib/server/playbook.js';
import { mock, S3 } from '../../scripts/mistake-lab/build-s3-fixtures.mjs';

const { USER, T0, DAY, M1, M2, M3, M4, PRACTICE, M5_KEPT, M5_NOT, M5_PLAIN, RESERVATIONS, PLAYBOOK } = S3;
const HISTORY = [M4, PRACTICE, M3, M2, M1];
const REPAIRS = repairRulesFrom({ userId: USER, reservations: RESERVATIONS, attempts: HISTORY });
const BOOK = buildRuleBook({ attempts: HISTORY, repairs: REPAIRS, playbook: PLAYBOOK });
const iso = (ms) => new Date(ms).toISOString();
const row = (ruleId, at, attemptId = 'm4', text = null) => ({ attempt_id: attemptId, strategy: strategyFor(ruleId), reflection: text ?? HABIT_TEXT[ruleId.split(':')[1]] ?? 'A rule.', evidence_state: 'active', created_at: iso(at) });

test('the habit rules are worded exactly as the ledger\'s do lines', () => {
  assert.equal(HABIT_TEXT.changes, LAB_COPY.groups.changed_from_right.do);
  assert.equal(HABIT_TEXT.long_stay, LAB_COPY.groups.long_stay.do);
  assert.equal(HABIT_TEXT.never_opened, LAB_COPY.groups.never_opened.do);
  assert.equal(HABIT_TEXT.marked, 'Answer the questions you mark for review.');
  assert.deepEqual(BOOK.habits.rules.map((r) => r.text), RULE_RULES.habitOrder.map((k) => HABIT_TEXT[k]));
});

test('below 3 timed mocks the habit rules wait, and the gate says so in words', () => {
  for (const [attempts, n] of [[[], 0], [[M1], 1], [[M1, M3, PRACTICE], 2]]) {
    const book = buildRuleBook({ attempts, repairs: [], playbook: [] });
    assert.equal(book.habits.state, 'below_gate');
    assert.equal(book.habits.gateLine, `Rules from how you take papers need 3 timed mocks. You have ${n} of 3.`);
    assert.deepEqual(book.habits.rules, []);
    assert.equal(book.repairs.empty, 'Your first repair adds a rule here.');
    assert.equal(book.count, 0);
    assert.equal(book.countLabel, 'Your rules (0)');
  }
});

test('each habit\'s evidence carries its Wilson interval, and a rule below its minimum states its gate', () => {
  const byId = Object.fromEntries(BOOK.habits.rules.map((r) => [r.id, r]));
  for (const r of BOOK.habits.rules.filter((x) => !x.gated)) {
    const w = wilson(r.interval.k, r.interval.n);
    assert.deepEqual(r.interval, { k: r.interval.k, n: r.interval.n, pct: w.pct, low: w.low, high: w.high }, r.id);
  }
  assert.match(byId['habit:changes'].evidence, /^Right answers changed to wrong in your last 4 timed mocks: \d+ of \d+ changes, costing \d+ marks\.$/);
  assert.match(byId['habit:long_stay'].evidence, /^Answers after 2 minutes: \d+ right of \d+\. Faster answers: \d+ right of \d+\.$/);
  assert.match(byId['habit:never_opened'].evidence, /^Never opened: \d+, \d+ and \d+ of 50 in your last 3 mocks, oldest first\.$/);
  assert.equal(byId['habit:marked'].gated, true, 'only one mock carries marks, so fewer than 15 marked answers');
  assert.match(byId['habit:marked'].evidence, /^This evidence opens at 15 marked answers\. You have \d+\.$/);
  assert.equal(byId['habit:marked'].interval, null);
  // The changes rule's marks: 6 for every change from the key to another option.
  const k = byId['habit:changes'].interval.k;
  assert.match(byId['habit:changes'].evidence, new RegExp(`costing ${k * 6} marks`));
  // Under its minimum of 10 changes, the changes rule states its gate.
  const few = buildRuleBook({ attempts: [mock({ id: 'a', day: 0, plan: { 2: 'kw' } }), mock({ id: 'b', day: 1 }), mock({ id: 'c', day: 2 })] });
  assert.equal(few.habits.rules[0].evidence, 'This evidence opens at 10 answer changes. You have 1.');
});

test('rules from repairs: the receipt\'s rule and hook, by chapter, newest first; a repeated rule keeps the newest', () => {
  assert.deepEqual(BOOK.repairs.chapters.map((c) => c.chapter), ['Accounting Ratios', 'Share Capital', 'Cash Flow Statement']);
  const ratios = BOOK.repairs.chapters[0].rules;
  assert.equal(ratios.length, 1, 'the same rule from an older repair in the same chapter is not listed twice');
  assert.equal(ratios[0].number, 37);
  const share = BOOK.repairs.chapters[1].rules[0];
  assert.deepEqual([share.text, share.hook], ['Calls in arrears are deducted from called-up capital, never added.', 'Arrears are owed to you, not paid.']);
  const cash = BOOK.repairs.chapters[2].rules[0];
  assert.equal(cash.text, 'Operating activities are the main revenue-producing activities of the business.', 'a v1 receipt gives its idea to keep');
  assert.equal(cash.hook, null);
  assert.equal(BOOK.count, 3 + 4);
  assert.equal(BOOK.countLabel, 'Your rules (7)');
});

test('repair receipts only become rules for the student\'s own wrong answers, and only when shown in full', () => {
  const other = repairRulesFrom({ userId: 'someone-else', reservations: RESERVATIONS, attempts: HISTORY });
  assert.deepEqual(other, [], 'another student\'s key never matches');
  const half = [{ operation_key: `repair:${mistakeKey(USER, 'm4', 'm4-q16')}:r1`, updated_at: iso(T0 + 5 * DAY), repair: { why_right: 'x', trap: 'x' } }];
  assert.deepEqual(repairRulesFrom({ userId: USER, reservations: half, attempts: HISTORY }), [], 'a payload that cannot be shown in full gives no rule');
  const right = [{ operation_key: `repair:${mistakeKey(USER, 'm4', 'm4-q1')}:r1`, updated_at: iso(T0 + 5 * DAY), repair: { key_idea: 'A rule.', why_tempting: 'x', why_wrong: 'x' } }];
  assert.deepEqual(repairRulesFrom({ userId: USER, reservations: right, attempts: HISTORY }), [], 'a right answer has no repair');
  assert.equal(REPAIRS.length, 4);
});

test('the rule in force for a mock is the newest one chosen before it started', () => {
  assert.deepEqual(activeRule(PLAYBOOK), { id: 'habit:never_opened', kind: 'habit', text: HABIT_TEXT.never_opened, since: iso(T0 + 5 * DAY) });
  const start = attemptStart(M5_NOT);
  assert.equal(start, M5_NOT.completedAt - mockRecord(M5_NOT).lengthMs);
  assert.equal(ruleInForce(PLAYBOOK, M5_NOT).id, 'habit:never_opened');
  assert.equal(ruleInForce(PLAYBOOK, M4).id, 'habit:changes', 'the older choice was in force for the mock before');
  assert.equal(ruleInForce(PLAYBOOK, M1), null, 'no rule had been chosen yet');
  // A rule chosen after the mock started is not in force for it.
  const late = [row('habit:long_stay', start + 60000, 'm4'), ...PLAYBOOK];
  assert.equal(ruleInForce(late, M5_NOT).id, 'habit:never_opened');
  // Rows of the old free-text note are not rules.
  const notes = [{ attempt_id: 'm4', strategy: 'two_pass', reflection: 'A note.', created_at: iso(T0 + 6 * DAY) }, ...PLAYBOOK];
  assert.deepEqual(ruleRows(notes).map((r) => r.id), ['habit:never_opened', 'habit:changes']);
});

test('the rule check is arithmetic only: kept, not kept, with the timed mock before in brackets', () => {
  const rule = ruleInForce(PLAYBOOK, M5_NOT);
  const notKept = buildRuleCheck({ attempt: M5_NOT, attempts: [M5_NOT, ...HISTORY], rule });
  const prev = mockRecord(M4).rows.filter((r) => !r.opened).length;
  assert.equal(notKept.state, 'not_kept');
  assert.equal(notKept.result, `Not kept: 4 of 50 questions never opened (last mock: ${prev} of 50).`);
  assert.equal(notKept.line, 'Your rule: open every question once before you go deep on any.');
  assert.equal(notKept.text, `${notKept.line} ${notKept.result}`);
  assert.deepEqual(notKept.numbers, { now: 4, total: 50, last: prev, lastTotal: 50 });
  const kept = buildRuleCheck({ attempt: M5_KEPT, attempts: [M5_KEPT, ...HISTORY], rule });
  assert.equal(kept.state, 'kept');
  assert.equal(kept.result, `Kept: every question opened (last mock: ${prev} of 50 never opened).`);
  // With no timed mock before it, no bracket.
  const alone = buildRuleCheck({ attempt: M5_KEPT, attempts: [M5_KEPT], rule });
  assert.equal(alone.result, 'Kept: every question opened.');
  assert.equal(alone.fine, 'Counted from your device\'s record of this mock.');
  // No rule, or a practice set: no check at all.
  assert.equal(buildRuleCheck({ attempt: M5_KEPT, attempts: HISTORY, rule: null }), null);
  assert.equal(buildRuleCheck({ attempt: PRACTICE, attempts: HISTORY, rule }), null);
  // Never a claim about what the rule gained.
  for (const c of [notKept, kept, alone]) assert.ok(!/gain|would|could|because|helped you/i.test(JSON.stringify(c)), c.text);
});

test('every habit is measured on the record; a mock without marks captured cannot check the marked rule', () => {
  const recKept = mockRecord(M5_KEPT);
  for (const key of RULE_RULES.habitOrder) {
    const rule = { id: `habit:${key}`, kind: 'habit', text: HABIT_TEXT[key] };
    const c = buildRuleCheck({ attempt: M5_KEPT, attempts: [M5_KEPT, ...HISTORY], rule });
    const m = measureHabit(key, recKept);
    assert.equal(c.numbers.now, m.n, key);
    assert.equal(c.state, key === 'marked' && m.total === 0 ? 'counted' : m.n === 0 ? 'kept' : 'not_kept', key);
  }
  const plain = buildRuleCheck({ attempt: M5_PLAIN, attempts: [M5_PLAIN, ...HISTORY], rule: { id: 'habit:marked', kind: 'habit', text: HABIT_TEXT.marked } });
  assert.equal(plain.state, 'not_checked');
  assert.equal(plain.result, 'This mock\'s record has no marks for review, so this rule could not be checked.');
  const marked = measureHabit('marked', recKept);
  assert.deepEqual(marked, { n: 1, total: 2 }, 'Q7 marked and left blank, Q19 marked and answered');
  // A mock scored in the browser has no record to check a habit on.
  const device = structuredClone(M5_KEPT);
  device.selectionMeta.scoringVersion = undefined;
  assert.equal(buildRuleCheck({ attempt: device, attempts: HISTORY, rule: { id: 'habit:changes', kind: 'habit', text: HABIT_TEXT.changes } }).state, 'not_checked');
});

test('the long-stay rule reads single visits: two short visits to one question keep it', () => {
  const qs = Array.from({ length: 3 }, (_, i) => ({ id: `v${i}`, chapter: 'Share Capital', options: ['a', 'b', 'c', 'd'].map((o) => `${o}${i}`), correctIndex: 0 }));
  const ev = [
    { seq: 1, qid: 'v0', at: 0, type: 'visit' }, { seq: 2, qid: 'v0', at: 60000, type: 'answer', answer: 0 },
    { seq: 3, qid: 'v1', at: 70000, type: 'visit' }, { seq: 4, qid: 'v1', at: 100000, type: 'answer', answer: 0 },
    { seq: 5, qid: 'v0', at: 110000, type: 'visit' }, { seq: 6, qid: 'v2', at: 180000, type: 'visit' }, { seq: 7, qid: 'v2', at: 200000, type: 'answer', answer: 0 },
    { seq: 8, qid: 'v2', at: 205000, type: 'end', reason: 'submit' },
  ];
  const s = scoreSession(qs, { v0: 0, v1: 0, v2: 0 }, ev, 3600000);
  const attempt = { id: 'lv', subject: 'accountancy', completedAt: T0, questionsSnapshot: qs, details: s.details, selectionMeta: { mode: 'full', durationMinutes: 60, scoringVersion: 'server_snapshot_v1', recovery: s.recovery } };
  const rec = mockRecord(attempt);
  assert.equal(rec.rows[0].ms, 140000, 'v0 had 2m 20s in all');
  assert.equal(rec.rows[0].longestVisitMs, 70000, 'but no single visit of 2 minutes');
  assert.deepEqual(measureHabit('long_stay', rec), { n: 0, total: 3 });
});

test('a repair rule is counted on its chapter: right of all its questions, this mock and the one before', () => {
  const share = BOOK.repairs.chapters.find((c) => c.chapter === 'Share Capital').rules[0];
  const rule = resolveRule({ id: share.id, kind: 'repair', text: share.text, since: iso(T0 + 5 * DAY) }, BOOK);
  assert.deepEqual([rule.chapter, rule.subject], ['Share Capital', 'accountancy']);
  const c = buildRuleCheck({ attempt: M5_KEPT, attempts: [M5_KEPT, ...HISTORY], rule });
  const count = (a) => { const qs = a.questionsSnapshot.filter((q) => q.chapter === 'Share Capital'); return [qs.filter((q) => a.details.find((d) => d.qid === q.id)?.isCorrect === true).length, qs.length]; };
  const [r, n] = count(M5_KEPT); const [r2, n2] = count(M4);
  assert.equal(c.state, 'counted');
  assert.equal(c.result, `Share Capital in this mock: ${r} right of ${n} (last mock: ${r2} right of ${n2}).`);
  assert.equal(c.line, 'Your rule: Calls in arrears are deducted from called-up capital, never added.', 'a repair\'s words are kept as written');
  // A mock in another subject has no question on the chapter.
  const econ = buildRuleCheck({ attempt: M2, attempts: HISTORY, rule });
  assert.match(econ.result, /^Share Capital had no questions in this mock/);
  // A repair no longer on the record cannot be checked.
  const gone = buildRuleCheck({ attempt: M5_KEPT, attempts: HISTORY, rule: { id: 'repair:0123456789abcdef01234567', kind: 'repair', text: 'A rule.', chapter: null } });
  assert.equal(gone.state, 'not_checked');
});

test('the start sheet: the rule and the last mock\'s number, before the clock, from the newest timed mock', () => {
  const rule = resolveRule(activeRule(PLAYBOOK), BOOK);
  const lines = startSheetLines({ rule, attempts: HISTORY });
  const last = mockRecord(M4).rows.filter((r) => !r.opened).length;
  assert.deepEqual(lines, { rule: 'Your rule for this mock: open every question once before you go deep on any.', last: `Last mock: ${last} of 50 questions never opened.` });
  assert.equal(startSheetLines({ rule: null, attempts: HISTORY }), null);
  assert.deepEqual(startSheetLines({ rule, attempts: [PRACTICE] }), { rule: lines.rule, last: null }, 'no timed mock yet: the rule alone');
  const changes = startSheetLines({ rule: { id: 'habit:changes', kind: 'habit', text: HABIT_TEXT.changes }, attempts: HISTORY });
  assert.match(changes.last, /^Last mock: (\d+ of \d+ changes went from right to wrong|no right answer changed to wrong, over \d+ changes|no answer changes)\.$/);
  const marked = startSheetLines({ rule: { id: 'habit:marked', kind: 'habit', text: HABIT_TEXT.marked }, attempts: HISTORY });
  assert.match(marked.last, /^Last mock: (\d+ of \d+ questions you marked were left blank|every question you marked was answered)\.$/);
  // A repair rule of another subject stays off that subject's sheet.
  const share = BOOK.repairs.chapters.find((c) => c.chapter === 'Share Capital').rules[0];
  const repairRule = resolveRule({ id: share.id, kind: 'repair', text: share.text }, BOOK);
  assert.equal(startSheetLines({ rule: repairRule, attempts: HISTORY, subject: 'economics' }), null);
  assert.match(startSheetLines({ rule: repairRule, attempts: HISTORY, subject: 'accountancy' }).last, /^Last Accountancy mock: Share Capital, \d+ right of \d+\.$/);
});

test('rule ids parse strictly, and only a rule in the student\'s own book can be chosen', () => {
  for (const bad of [null, '', 'habit:', 'habit:sleep', 'repair:xyz', 'repair:0123456789ABCDEF01234567', `habit:${'x'.repeat(70)}`, 42, 'rule:habit:changes']) assert.equal(parseRuleId(bad), null, String(bad));
  assert.deepEqual(parseRuleId('habit:never_opened'), { kind: 'habit', key: 'never_opened' });
  assert.deepEqual(parseRuleId('repair:0123456789abcdef01234567'), { kind: 'repair', key: '0123456789abcdef01234567' });
  assert.equal(choosableRule(BOOK, 'habit:changes').text, HABIT_TEXT.changes);
  assert.equal(choosableRule(BOOK, 'repair:0123456789abcdef01234567'), null, 'a repair that is not the student\'s');
  const early = buildRuleBook({ attempts: [M1], repairs: REPAIRS, playbook: [] });
  assert.equal(choosableRule(early, 'habit:changes'), null, 'habit rules wait for 3 timed mocks');
  assert.equal(bookRules(BOOK).length, BOOK.count);
});

test('every rule string keeps the copy rules', () => {
  const strings = (v, out = []) => { if (typeof v === 'string') out.push(v); else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out)); return out; };
  const texts = [...strings(LAB_COPY.rules), ...strings(LAB_COPY.ruleCheck), ...strings(LAB_COPY.startSheet), ...strings(LAB_COPY.repairOrder), ...strings(BOOK)];
  for (const s of texts) {
    assert.ok(!/[!—·]/.test(s), s);
    assert.ok(!/\(-\d/.test(s) && !/ -\d/.test(s), `hyphen used as a minus: ${s}`);
    assert.ok(!/\b(would|could) have\b|\bpotential\b|\bgained you\b|\brushed\b|\boverthink/i.test(s), s);
  }
});
