// Post-mock SWOT and "Do these next" (data/mock_swot.js). Scenario inputs live in
// data/tests/fixtures/swot/*.json; the app's contract file is contract_v1.json.
// Regenerate them after a deliberate change with:  SWOT_FIXTURES_WRITE=1 node --test data/tests/mock_swot.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as repair from '../mistake_repair.js';
import { scoreSession } from '../recovery.js';
import { isValidTopSyllabusPair } from '../canonical_syllabus.js';
import { buildMissedBefore } from '../../src/components/recovery/repairRun.js';
import { buildSwot, resultHistory, SWOT_RULES, SWOT_COPY } from '../mock_swot.js';
import { buildMistakeInsights } from '../mistake_insights.js';
import { buildMistakeLab } from '../mistake_lab.js';
import { buildLedger } from '../attempt_ledger.js';
import { getCanonicalChapters } from '../canonical_syllabus.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'swot');
const WRITE = process.env.SWOT_FIXTURES_WRITE === '1';
const DAY = 86_400_000;
const at = (d) => Date.UTC(2026, 9, d, 4, 30); // 10:00 IST on d Oct 2026

// ---------- A small factory: questions are scored by the real server scorer (scoreSession) ----------

// spec: [chapter, 'RRWB..', { first: {index: firstAnswer}, secs: [..], unopened: [..], prefix, shared: {index: qid} }]
function paper(prefix, blocks) {
  const qs = [];
  let n = 0;
  for (const [chapter, pattern, extra = {}] of blocks) {
    [...pattern].forEach((o, i) => {
      n++;
      const id = extra.shared?.[i] ?? `${prefix}-${n}`;
      const key = id.length % 4;
      qs.push({ id, chapter, outcome: o, key, first: extra.first?.[i], secs: extra.secs?.[i] ?? 45, unopened: extra.unopened?.includes(i) || false, options: extra.options ?? 4, given: extra.given?.[i], marked: extra.marked?.includes(i) || false });
    });
  }
  return qs;
}

function makeAttempt({ id, subject = 'accountancy', mode = 'full', day, qs, telemetry = true, version = 'server_snapshot_v1' }) {
  const questions = qs.map((q) => ({ id: q.id, chapter: q.chapter, question: `Question ${q.id}`, difficulty: 'medium',
    options: Array.from({ length: q.options }, (_, i) => ({ text: `Option ${'ABCD'[i]} of ${q.id}` })), correctIndex: q.key }));
  const answers = {};
  const finalOf = (q) => (q.outcome === 'R' ? q.key : q.outcome === 'W' ? (q.given ?? (q.key + 1) % q.options) : null);
  for (const q of qs) { const f = finalOf(q); if (f !== null) answers[q.id] = f; }
  const events = [];
  if (telemetry) {
    let t = 0; let seq = 0;
    for (const q of qs) {
      if (q.unopened) continue;
      events.push({ seq: ++seq, qid: q.id, at: t, type: 'visit' });
      if (Number.isInteger(q.first)) events.push({ seq: ++seq, qid: q.id, at: t + 500, type: 'answer', answer: q.first });
      if (q.marked) events.push({ seq: ++seq, qid: q.id, at: t + 700, type: 'mark', marked: true });
      const f = finalOf(q);
      if (f !== null) events.push({ seq: ++seq, qid: q.id, at: t + q.secs * 1000 - 200, type: 'answer', answer: f });
      t += q.secs * 1000;
    }
  }
  const scored = scoreSession(questions, answers, events);
  if (!telemetry) { scored.recovery.telemetry = 'invalid'; scored.recovery.timeline = []; }
  return { id, userId: 'student-1', subject, score: scored.score, correct: scored.correct, wrong: scored.wrong, unattempted: scored.unattempted,
    total: scored.total, details: scored.details, questionsSnapshot: questions,
    selectionMeta: { mode, scoringVersion: version, recovery: scored.recovery }, mode, completedAt: at(day) };
}

// The filler that makes a 50-question mock (29 questions, mostly right).
const filler = (wrongs = 'RRRR', admission = 'RRRW') => [
  ['Goodwill Valuation', 'RRRR'], ['Admission of Partner', admission], ['Retirement & Death of Partner', 'RRRR'],
  ['Financial Statements of Company', 'RRRB'], ['Analysis of Financial Statements', 'RRRR'],
  ['Comparative & Common Size Statements', wrongs], ['Profit & Loss Appropriation Account', 'RRRRR'],
];

function threeMocks() {
  const q1 = makeAttempt({ id: 'quick-1', mode: 'quick', day: 3, version: 'server_practice_v1', qs: paper('q1', [['Partnership Fundamentals', 'RRRRRRRRRW']]) });
  const q2 = makeAttempt({ id: 'quick-2', mode: 'quick', day: 8, version: 'server_practice_v1', qs: paper('q2', [['Share Capital', 'RRWWWWWWWW']]) });
  const m1 = makeAttempt({ id: 'mock-1', day: 5, qs: paper('m1', [
    ['Accounting Ratios', 'RRWWB', { shared: { 2: 'ar-shared-1', 3: 'ar-shared-2' } }], ['Partnership Fundamentals', 'RRRR'], ['Share Capital', 'RRRR'],
    ['Debentures', 'RRRR'], ['Cash Flow Statement', 'RRRR'], ...filler('RRRR', 'RRRR') ]) });
  const m2 = makeAttempt({ id: 'mock-2', day: 10, qs: paper('m2', [
    ['Accounting Ratios', 'RWWRB'], ['Partnership Fundamentals', 'RRRR'], ['Share Capital', 'RWWW'],
    ['Debentures', 'RRRR'], ['Cash Flow Statement', 'RRWW'], ...filler() ]) });
  // This mock: two right-to-wrong changes and two repeat misses in Accounting Ratios, quick wrong answers, a slipped chapter.
  const m3 = makeAttempt({ id: 'mock-3', day: 15, qs: paper('m3', [
    ['Accounting Ratios', 'RWWWB', { shared: { 1: 'ar-shared-1', 2: 'ar-shared-2' }, first: { 1: 'key', 2: 'key' }, secs: [50, 12, 9, 14, 30] }],
    ['Partnership Fundamentals', 'RRRR'], ['Share Capital', 'RRWW', { secs: [40, 40, 11, 70] }],
    ['Debentures', 'RWWB', { secs: [60, 15, 80, 20] }], ['Cash Flow Statement', 'RRWB'], ...filler('RRRW') ]).map((q) => (q.first === 'key' ? { ...q, first: q.key } : q)) });
  const later = makeAttempt({ id: 'quick-later', mode: 'quick', day: 16, version: 'server_practice_v1', qs: paper('ql', [['Accounting Ratios', 'RRRRRRRWWB']]) });
  return { attempt: m3, allAttempts: [later, m3, q2, m2, m1, q1], answerReviews: {}, answerReviewState: 'ready', now: at(17) };
}

function scenarios() {
  const out = {};
  out.three_mocks_repeat_loss = threeMocks();
  out.first_mock = { attempt: makeAttempt({ id: 'first', day: 6, qs: paper('f', [['Accounting Ratios', 'RRWWW'], ['Share Capital', 'RRRB'], ['Debentures', 'RRWB'], ['Cash Flow Statement', 'RRRW'], ...filler()]) }), allAttempts: null, answerReviews: {}, answerReviewState: 'ready', now: at(7) };
  out.first_mock.allAttempts = [out.first_mock.attempt];
  const noTel = makeAttempt({ id: 'no-tel', day: 6, telemetry: false, qs: paper('nt', [['Accounting Ratios', 'RRRW'], ['Share Capital', 'RRRB'], ['Debentures', 'RRRW'], ['Cash Flow Statement', 'RRRW'], ...filler()]) });
  out.no_telemetry = { attempt: noTel, allAttempts: [noTel], answerReviews: {}, answerReviewState: 'ready', now: at(7) };
  const held = makeAttempt({ id: 'held', day: 6, qs: paper('h', [['Accounting Ratios', 'RRWWB'], ['Share Capital', 'RRRB'], ['Debentures', 'RRWB'], ['Cash Flow Statement', 'RRRW'], ...filler()]) });
  out.held_and_corrected = { attempt: held, allAttempts: [held], answerReviewState: 'ready', now: at(7),
    answerReviews: { 'h-3': { state: 'under_review', originalIndex: 0 }, 'h-4': { state: 'corrected', originalIndex: 1, currentIndex: 2, adjustment: 6 } } };
  out.checks_pending = { ...out.first_mock, answerReviewState: 'unavailable' };
  const practice = makeAttempt({ id: 'practice', mode: 'quick', day: 6, version: 'server_practice_v1', qs: paper('p', [['Share Capital', 'RRRRRWWWWW']]) });
  out.practice_not_available = { attempt: practice, allAttempts: [practice], answerReviews: {}, answerReviewState: 'ready', now: at(7) };
  const few = makeAttempt({ id: 'few', day: 6, qs: paper('fw', [['Accounting Ratios', 'RRRRWBBBBB'], ['Share Capital', 'RRWBBBBBBB'], ['Debentures', 'BBBBBBBBBB'], ['Cash Flow Statement', 'BBBBBBBBBB'], ['Goodwill Valuation', 'BBBBBBBBBB']]) });
  out.too_few = { attempt: few, allAttempts: [few], answerReviews: {}, answerReviewState: 'ready', now: at(7) };
  const three = threeMocks();
  const nta = (a) => ({ ...a, id: `nta-${a.id}`, mode: 'nta', selectionMeta: { ...a.selectionMeta, mode: 'nta' } });
  const ntaAll = three.allAttempts.map((a) => (a.selectionMeta.mode === 'full' ? nta(a) : a));
  out.nta_mock = { attempt: ntaAll.find((a) => a.id === 'nta-mock-3'), allAttempts: ntaAll, answerReviews: {}, answerReviewState: 'ready', now: at(17) };
  // Nothing in any quadrant, so the plan falls back to a mixed set. No telemetry: threats say pace is not judged.
  const quiet = makeAttempt({ id: 'quiet', day: 6, telemetry: false, qs: paper('qt', [
    ['Accounting Ratios', 'RRRW'], ['Share Capital', 'RRRW'], ['Debentures', 'RRRW'], ['Cash Flow Statement', 'RRRW'], ['Goodwill Valuation', 'RRRW'],
    ['Admission of Partner', 'RRRW'], ['Retirement & Death of Partner', 'RRRW'], ['Financial Statements of Company', 'RRRW'], ['Analysis of Financial Statements', 'RRRW'],
    ['Comparative & Common Size Statements', 'RRRW'], ['Profit & Loss Appropriation Account', 'RRRWB'], ['Partnership Fundamentals', 'RRRWB']]) });
  out.all_quadrants_empty = { attempt: quiet, allAttempts: [quiet], answerReviews: {}, answerReviewState: 'ready', now: at(7) };
  // Strengths only, every syllabus chapter already answered: nothing for the plan except the mixed fallback.
  const allChapters = ['Partnership Fundamentals', 'Profit & Loss Appropriation Account', 'Change in Profit Sharing Ratio', 'Goodwill Valuation', 'Admission of Partner',
    'Retirement & Death of Partner', 'Dissolution of Partnership', 'Dissolution of Partnership Firm', 'Share Capital', 'Debentures', 'Financial Statements of Company',
    'Analysis of Financial Statements', 'Comparative & Common Size Statements', 'Accounting Ratios', 'Cash Flow Statement', 'Computerized Accounting System'];
  const strongPast = [1, 2, 3].map((d) => makeAttempt({ id: `strong-q${d}`, mode: 'quick', day: d, version: 'server_practice_v1', qs: paper(`sq${d}`, [['Partnership Fundamentals', 'RRRRR']]) }));
  const strong = makeAttempt({ id: 'strong', day: 6, telemetry: false, qs: paper('st', allChapters.map((c, i) => [c, i === 0 ? 'RRRR' : i % 5 === 0 ? 'RRW' : 'RRR'])) });
  out.mixed_plan_fallback = { attempt: strong, allAttempts: [strong, ...strongPast], answerReviews: {}, answerReviewState: 'ready', now: at(7) };
  for (const s of Object.values(out)) s.missedBefore = buildMissedBefore(s.allAttempts, s.attempt.id);
  return out;
}

// ---------- Fixtures on disk ----------

const NAMES = ['three_mocks_repeat_loss', 'first_mock', 'no_telemetry', 'held_and_corrected', 'checks_pending', 'practice_not_available', 'too_few', 'nta_mock', 'all_quadrants_empty', 'mixed_plan_fallback'];
const swotOf = (s) => buildSwot({ attempt: s.attempt, allAttempts: s.allAttempts, answerReviews: s.answerReviews, answerReviewState: s.answerReviewState, missedBefore: s.missedBefore, now: s.now });
const insightsOf = (s) => buildMistakeInsights({ attempt: s.attempt, allAttempts: s.allAttempts, missedBefore: s.missedBefore, answerReviews: s.answerReviews });

if (WRITE) {
  mkdirSync(DIR, { recursive: true });
  const built = scenarios();
  for (const name of NAMES) writeFileSync(join(DIR, `${name}.json`), `${JSON.stringify(built[name])}\n`);
  const s = built.three_mocks_repeat_loss;
  writeFileSync(join(DIR, 'contract_v1.json'), `${JSON.stringify({ attemptId: s.attempt.id, mistakeInsights: insightsOf(s), swot: swotOf(s) }, null, 2)}\n`);
}

const load = (name) => JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8'));
const FIX = Object.fromEntries(NAMES.map((n) => [n, load(n)]));
const OUT = Object.fromEntries(NAMES.map((n) => [n, swotOf(FIX[n])]));

// ---------- Truth rules over every generated string ----------

// The patterns of spec A.4 step 7, kept here so this suite does not depend on the order packets land.
const STUDENT_CLAIMS = [
  /\byou\s+(?:probably\s+|likely\s+|may\s+have\s+|might\s+have\s+)?(?:rushed|panicked|guessed|skimmed|misread|overthought)\b/i,
  /\byou(?:'re|\s+are|\s+were)\s+(?:careless|rushing|nervous|tired|confused|lazy)\b/i,
  /\byou\s+(?:did\s*n[o']?t|didn't|did\s+not)\s+(?:read|think|check|notice)\b/i,
];
const claimsAboutStudent = (t) => STUDENT_CLAIMS.some((p) => p.test(t)) || (typeof repair.claimsAboutStudent === 'function' && repair.claimsAboutStudent(t));

function strings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) { if (!['id', 'href', 'chapter', 'kind', 'state', 'quadrant', 'subject', 'mode', 'timing', 'planId', 'evidence'].includes(k)) strings(v, out); }
  return out;
}

test('fixtures on disk match the factory (regenerate with SWOT_FIXTURES_WRITE=1)', () => {
  const built = scenarios();
  for (const name of NAMES) assert.deepEqual(FIX[name], JSON.parse(JSON.stringify(built[name])), name);
});

test('every SWOT and record string: no "!", em dash or middle dot, no truth-rule or student-claim match', () => {
  for (const name of NAMES) {
    const texts = [...strings(OUT[name]), ...strings(insightsOf(FIX[name]))];
    for (const t of texts) {
      assert.ok(!/[!—·]/.test(t), `${name}: ${t}`);
      assert.equal(repair.violatesTruthRules(t), false, `${name}: ${t}`);
      assert.equal(claimsAboutStudent(t), false, `${name}: ${t}`);
      assert.ok(!/\b(?:rank|percentile|will score|predict)/i.test(t), `${name}: ${t}`);
      assert.equal(t[0], t[0].toUpperCase(), `${name}: sentence case: ${t}`);
    }
  }
});

test('states: practice is not_available, checks pending and too few carry only a message', () => {
  assert.deepEqual(OUT.practice_not_available, { version: 1, state: 'not_available', message: null, basis: null, quadrants: [], plan: [] });
  assert.deepEqual(OUT.checks_pending, { version: 1, state: 'checks_pending', message: SWOT_COPY.checksPending, basis: null, quadrants: [], plan: [] });
  assert.deepEqual(OUT.too_few, { version: 1, state: 'too_few', message: SWOT_COPY.tooFew, basis: null, quadrants: [], plan: [] });
  const device = { ...FIX.first_mock.attempt, selectionMeta: { ...FIX.first_mock.attempt.selectionMeta, scoringVersion: 'legacy' } };
  assert.equal(buildSwot({ attempt: device, allAttempts: [device] }).state, 'not_available');
});

test('structure: 4 quadrants in order, caps hold, items or empty, a chapter named once, plan of at most 3 valid chapters', () => {
  for (const name of NAMES) {
    const s = OUT[name];
    if (s.state !== 'ready') continue;
    assert.deepEqual(s.quadrants.map((q) => q.id), ['strength', 'weakness', 'opportunity', 'threat'], name);
    for (const q of s.quadrants) {
      assert.ok(q.items.length <= SWOT_RULES.caps[q.id], `${name} ${q.id} cap`);
      assert.ok((q.items.length > 0) !== (typeof q.empty === 'string'), `${name} ${q.id}: items or empty`);
      const weights = q.items.map((i) => i.id);
      assert.equal(new Set(weights).size, weights.length);
    }
    const chapters = s.quadrants.flatMap((q) => q.items).map((i) => i.chapter).filter(Boolean);
    assert.equal(new Set(chapters).size, chapters.length, `${name}: chapter named once`);
    assert.ok(s.plan.length >= 1 && s.plan.length <= 3, name);
    const planChapters = s.plan.map((p) => p.practice.chapter).filter(Boolean);
    assert.equal(new Set(planChapters).size, planChapters.length);
    for (const p of s.plan) {
      if (p.practice.chapter) assert.ok(isValidTopSyllabusPair(p.practice.subject, p.practice.chapter), `${name}: ${p.practice.chapter}`);
      assert.ok([5, 10, 15, 20].includes(p.practice.count));
      assert.equal(p.practice.mode, 'quick');
      assert.ok(p.href.startsWith(`/dashboard?subject=${p.practice.subject}&mode=quick&count=${p.practice.count}`));
    }
    const planIds = new Set(s.plan.map((p) => p.id));
    for (const item of s.quadrants.flatMap((q) => q.items)) if (item.planId) assert.ok(planIds.has(item.planId));
  }
});

test('three mocks: repeat loss leads the plan, with the later set; chapters, changes and repeats are named', () => {
  const s = OUT.three_mocks_repeat_loss;
  const items = Object.fromEntries(s.quadrants.flatMap((q) => q.items).map((i) => [i.id, i]));
  const loss = items['repeat_loss:Accounting Ratios'];
  assert.ok(loss);
  assert.equal(loss.title, 'Accounting Ratios in each of your last 3 mocks');
  assert.equal(loss.detail, 'Marks lost here: 17, 17 and 23, oldest first.');
  assert.equal(loss.planId, 'p1');
  assert.deepEqual(s.plan[0], {
    id: 'p1', label: 'Practise 10 on Accounting Ratios', reason: 'Marks lost here in each of your last 3 mocks.',
    practice: { subject: 'accountancy', mode: 'quick', count: 10, chapter: 'Accounting Ratios' },
    href: '/dashboard?subject=accountancy&mode=quick&count=10&chapter=Accounting%20Ratios',
    later: { at: at(16), right: 7, of: 10, line: 'A set on this chapter on 16 Oct: 7 right of 10.' },
  });
  assert.equal(items['strong_chapter:Partnership Fundamentals'].detail, '21 right of 22 across 4 papers, 4 of 4 in this one.');
  assert.equal(items['chapter_slipped:Debentures'].detail, '1 of 3 right here, against 8 of 8 before.');
  assert.equal(items['weak_chapter:Share Capital'].detail, '9 right of 22 across 4 papers. In this one: 2 of 4 right, 12 marks lost.');
  assert.equal(items.changes_hurt.detail, '2 answers were right before you changed them. Those changes cost 12 marks.');
  assert.equal(s.plan[1].label, 'Practise 10 on Debentures');
  assert.equal(s.plan[1].reason, '1 of 3 right here, against 8 of 8 before.');
  assert.equal(s.plan[2].label, 'Practise 10 on Share Capital');
  assert.equal(s.plan[2].reason, '12 marks lost here in this paper, and 9 right of 22 across 4 papers.');
  assert.equal(s.basis.line, 'From 50 of 50 questions in this paper and 116 earlier answers in Accountancy across 4 papers.');
  assert.equal(s.basis.heldLine, null);
  assert.equal(s.basis.timing, 'recorded');
});

test('first mock: no history items, the first-paper basis line', () => {
  const s = OUT.first_mock;
  assert.equal(s.basis.line, 'From 46 of 46 questions in this paper. There is no earlier Accountancy record to compare yet.');
  const kinds = s.quadrants.flatMap((q) => q.items).map((i) => i.kind);
  for (const k of ['strong_chapter', 'weak_chapter', 'close_chapter', 'chapter_slipped', 'repeat_loss', 'untried', 'repeat_misses']) assert.ok(!kinds.includes(k), k);
  assert.ok(kinds.includes('weak_chapter_paper'));
  const weak = s.quadrants[1].items.find((i) => i.kind === 'weak_chapter_paper');
  assert.match(weak.detail, /One paper is a small sample\.$/);
});

test('no telemetry: threats say pace is not judged', () => {
  const threat = OUT.no_telemetry.quadrants.find((q) => q.id === 'threat');
  assert.deepEqual(threat.items, []);
  assert.equal(threat.empty, 'Pace is not judged: time per question was not recorded for this paper.');
  assert.equal(OUT.no_telemetry.basis.timing, 'not_recorded');
});

test('held and corrected questions are left out, with the held line', () => {
  const s = OUT.held_and_corrected;
  assert.equal(s.basis.counted, 44);
  assert.equal(s.basis.total, 46);
  assert.equal(s.basis.held, 2);
  assert.equal(s.basis.heldLine, '2 questions under re-check or corrected are left out of this read.');
  assert.match(s.basis.line, /^From 44 of 46 questions in this paper\./);
  const ledger = buildLedger(FIX.held_and_corrected.attempt, [], { answerReviews: FIX.held_and_corrected.answerReviews });
  assert.equal(ledger.paper.get('Accounting Ratios').n, 3);
  assert.equal(SWOT_COPY.held(1), '1 question under re-check or corrected is left out of this read.');
});

test('NTA mocks follow the same rules as Full mocks', () => {
  const full = OUT.three_mocks_repeat_loss;
  const nta = OUT.nta_mock;
  assert.equal(nta.state, 'ready');
  const strip = (s) => JSON.parse(JSON.stringify(s).replace(/nta-mock-/g, 'mock-'));
  assert.deepEqual(strip(nta), full);
});

test('all quadrants empty: one quiet line each and a mixed fallback plan', () => {
  const s = OUT.all_quadrants_empty;
  assert.deepEqual(s.quadrants.map((q) => q.empty), [SWOT_COPY.empty.strength, SWOT_COPY.empty.weakness, SWOT_COPY.empty.opportunity, SWOT_COPY.empty.threatNotRecorded]);
  assert.deepEqual(s.plan, [{ id: 'p1', label: 'Practise 10 mixed questions', reason: 'No single chapter stands out yet. A mixed set adds to your record.',
    practice: { subject: 'accountancy', mode: 'quick', count: 10, chapter: null }, href: '/dashboard?subject=accountancy&mode=quick&count=10', later: null }]);
});

test('strengths alone still give the mixed fallback', () => {
  const s = OUT.mixed_plan_fallback;
  assert.ok(s.quadrants[0].items.length > 0);
  assert.equal(s.plan.length, 1);
  assert.equal(s.plan[0].label, 'Practise 10 mixed questions');
});

test('not opened and blanks gates, and the question list format', () => {
  const qs = paper('no', [['Accounting Ratios', 'RRRRRRRRRR'], ['Share Capital', 'RRRRRRRRRR'], ['Debentures', 'RRRRRRRRRR'], ['Cash Flow Statement', 'RRRRRRRBBB', { unopened: [7, 8, 9] }], ['Goodwill Valuation', 'RRRRRRBBBB', { unopened: [6, 7, 8, 9] }]]);
  const a = makeAttempt({ id: 'not-opened', day: 6, qs });
  const s = buildSwot({ attempt: a, allAttempts: [a], now: at(7) });
  const items = s.quadrants.flatMap((q) => q.items);
  const notOpened = items.find((i) => i.kind === 'not_opened');
  assert.equal(notOpened.detail, '7 of 50 questions were never opened: Q38, Q39, Q40, Q47, Q48 and 2 more.', 'every count with its denominator');
  assert.equal(notOpened.planId, 'p1');
  assert.deepEqual(s.plan[0].practice, { subject: 'accountancy', mode: 'quick', count: 20, chapter: null });
  assert.equal(s.plan[0].label, 'Practise 20, timed');
  assert.equal(s.plan[0].reason, '7 of 50 questions were never opened. Quick sets give 60 seconds a question.');
  const blanks = items.find((i) => i.kind === 'blanks');
  assert.equal(blanks.detail, `7 of 50 questions left blank: 35 marks not earned.${SWOT_COPY.blanksFourOptions}`);
  // Held questions are not counted, so the denominator is the counted questions, as in the basis line.
  const heldOne = buildSwot({ attempt: a, allAttempts: [a], answerReviews: { 'no-1': { state: 'under_review', originalIndex: 0 } }, now: at(7) });
  assert.match(heldOne.quadrants.flatMap((q) => q.items).find((i) => i.kind === 'blanks').detail, /^7 of 49 questions left blank: 35 marks not earned\./);
  assert.match(heldOne.basis.line, /^From 49 of 50 questions/);
});

test('repeat misses carry their denominator: k of the m questions of this paper that were missed before', () => {
  const shared = { shared: { 0: 'rm-a', 1: 'rm-b', 2: 'rm-c' } };
  const before = makeAttempt({ id: 'rm-1', day: 3, telemetry: false, qs: paper('rm1', [['Share Capital', 'WWWR', shared], ...filler()]) });
  const cur = makeAttempt({ id: 'rm-2', day: 6, telemetry: false, qs: paper('rm2', [['Share Capital', 'WWRR', shared], ...filler()]) });
  const all = [cur, before];
  const s = buildSwot({ attempt: cur, allAttempts: all, missedBefore: buildMissedBefore(all, cur.id), now: at(7) });
  const item = s.quadrants.flatMap((q) => q.items).find((i) => i.kind === 'repeat_misses');
  assert.equal(item.detail, '2 of the 3 questions you had missed before were wrong again.', 'rm-c was missed before and is right today: in m, not in k');
  assert.deepEqual(item.questions, [1, 2]);
  assert.deepEqual(item.evidence, { questions: 2, missedBefore: 3 });
  // A miss after this paper is not "before".
  const afterOnly = buildSwot({ attempt: before, allAttempts: all, missedBefore: buildMissedBefore(all, before.id), now: at(7) });
  assert.ok(!afterOnly.quadrants.flatMap((q) => q.items).some((i) => i.kind === 'repeat_misses'));
});

test('untried says what was checked: no answers in the last N papers of the record, every paper in that span looked at', () => {
  const past = [1, 2, 3].map((d) => makeAttempt({ id: `ut-q${d}`, mode: 'quick', day: d, version: 'server_practice_v1', qs: paper(`ut${d}`, [['Partnership Fundamentals', 'RRRRR']]) }));
  const cur = makeAttempt({ id: 'ut-mock', day: 6, telemetry: false, qs: paper('utm', [['Accounting Ratios', 'RRRW'], ['Share Capital', 'RRRW'], ['Debentures', 'RRRW'], ['Cash Flow Statement', 'RRRW'], ...filler()]) });
  const inRecord = new Set([...cur.questionsSnapshot.map((q) => q.chapter), 'Partnership Fundamentals']);
  const open = getCanonicalChapters('accountancy').filter((c) => !inRecord.has(c));
  assert.ok(open.length >= 4, 'the fixture leaves at least 4 syllabus chapters open');
  // A paper scored on the device is not in the record, but it falls inside the record's span (day 4), so a chapter it
  // answered is not called untried. One from before the span (30 Sep) does not count against the claim.
  const device = makeAttempt({ id: 'ut-device', mode: 'quick', day: 4, version: 'legacy', qs: paper('utd', [[open[0], 'RRWRR']]) });
  const older = makeAttempt({ id: 'ut-older', mode: 'quick', day: 0, version: 'legacy', qs: paper('uto', [[open[1], 'RRRRR']]) });
  const s = buildSwot({ attempt: cur, allAttempts: [cur, ...past, device, older], now: at(7) });
  const item = s.quadrants.flatMap((q) => q.items).find((i) => i.kind === 'untried');
  const expected = open.slice(1);
  const list = expected.length > 3 ? `${expected.slice(0, 3).join(', ')} and ${expected.length - 3} more` : `${expected.slice(0, -1).join(', ')} and ${expected[expected.length - 1]}`;
  assert.equal(item.title, 'Chapters with no recent answers');
  assert.equal(item.detail, `${expected.length} syllabus chapters have no answers in your last 4 Accountancy papers: ${list}.`, 'N = this paper and the 3 earlier record papers');
  assert.equal(item.evidence.recordPapers, 4);
  assert.ok(!item.evidence.chapters.includes(open[0]), 'answered in a paper inside the span');
  assert.doesNotMatch(item.detail, /yet|from you/);
  const row = s.plan.find((p) => p.practice.chapter === expected[0]);
  assert.equal(row.reason, 'No answers in this chapter in your last 4 Accountancy papers.');
});

test('the contract file is real buildSwot and buildMistakeInsights output for the 3-mock fixture', () => {
  const contract = JSON.parse(readFileSync(join(DIR, 'contract_v1.json'), 'utf8'));
  const s = FIX.three_mocks_repeat_loss;
  assert.deepEqual(contract, JSON.parse(JSON.stringify({ attemptId: s.attempt.id, mistakeInsights: insightsOf(s), swot: swotOf(s) })));
});

test('the record line and the SWOT record evidence give the same numbers', () => {
  const s = FIX.three_mocks_repeat_loss;
  const insights = insightsOf(s);
  const shareCapitalWrong = s.attempt.questionsSnapshot.filter((q) => q.chapter === 'Share Capital').map((q) => q.id).find((id) => insights[id]);
  const line = insights[shareCapitalWrong].lines.find((l) => l.kind === 'chapter');
  assert.equal(line.text, 'Share Capital so far: 9 right of 22 answered across 4 papers, this one included.');
  const item = OUT.three_mocks_repeat_loss.quadrants.flatMap((q) => q.items).find((i) => i.id === 'weak_chapter:Share Capital');
  const { right, answered, papers } = item.evidence.record;
  assert.deepEqual(insights[shareCapitalWrong].evidence.chapter, { right, answered, papers });
});

test('the route helper: a failed history read still returns, with swot null, lab null and mistakeInsights {}', async () => {
  const s = FIX.three_mocks_repeat_loss;
  const warned = [];
  const failed = await resultHistory({ attempt: s.attempt, loadAttempts: async () => { throw new Error('db down'); }, recapOf: () => ({}), missedBeforeOf: () => ({}), warn: (n) => warned.push(n) });
  assert.deepEqual(failed, { recap: null, missedBefore: {}, mistakeInsights: {}, lab: null, swot: null });
  assert.deepEqual(warned, ['history']);
  const off = await resultHistory({ attempt: s.attempt, loadAttempts: async () => s.allAttempts, recapOf: () => null, missedBeforeOf: buildMissedBefore, swotEnabled: false });
  assert.ok(!('swot' in off));
  const ok = await resultHistory({ attempt: s.attempt, loadAttempts: async () => s.allAttempts, recapOf: () => ({ tone: 'default' }), missedBeforeOf: buildMissedBefore, now: s.now });
  // The Mistake Lab is built (no cohort reader given), and the SWOT leaves out what its ledger already shows.
  assert.deepEqual(ok.lab, buildMistakeLab({ attempt: s.attempt, answerReviews: s.answerReviews }));
  assert.equal(ok.lab.state, 'ready');
  assert.deepEqual(ok.swot, buildSwot({ ...s, ledgerGroups: ok.lab.groups.map((g) => g.id) }));
  assert.deepEqual(ok.swot.plan, swotOf(s).plan);
  assert.deepEqual(ok.mistakeInsights, insightsOf(s));
  const broken = await resultHistory({ attempt: s.attempt, loadAttempts: async () => s.allAttempts, recapOf: () => { throw new Error('x'); }, missedBeforeOf: buildMissedBefore, now: s.now });
  assert.equal(broken.recap, null);
  assert.equal(broken.swot.state, 'ready');
});

test('the route helper: until the answer checks are ready, no record lines are built, as the SWOT says checks_pending', async () => {
  const s = FIX.three_mocks_repeat_loss;
  assert.ok(Object.keys(insightsOf(s)).length > 0, 'the same attempt has record lines once the checks are ready');
  for (const state of ['loading', 'unavailable', 'failed', undefined, null]) {
    const out = await resultHistory({ attempt: s.attempt, answerReviewState: state, loadAttempts: async () => s.allAttempts, recapOf: () => null, missedBeforeOf: buildMissedBefore, now: s.now });
    if (state === undefined) { assert.ok(Object.keys(out.mistakeInsights).length > 0, 'the default is ready'); continue; }
    assert.deepEqual(out.mistakeInsights, {}, String(state));
    assert.equal(out.lab, null, String(state));
    assert.equal(out.swot.state, 'checks_pending', String(state));
    assert.ok(Object.keys(out.missedBefore).length > 0, 'the earlier-miss facts do not depend on the checks');
  }
});

test('fixture directory exists with every scenario', () => {
  for (const name of [...NAMES, 'contract_v1']) assert.ok(existsSync(join(DIR, `${name}.json`)), name);
  assert.ok(DAY > 0);
});

test('a retake with no other earlier paper: the first-paper basis line, and no history item beside it', () => {
  const cur = FIX.first_mock.attempt;
  const original = { ...structuredClone(cur), id: 'first-original', completedAt: cur.completedAt - 2 * DAY };
  const all = [cur, original];
  const s = buildSwot({ attempt: cur, allAttempts: all, answerReviews: {}, answerReviewState: 'ready', missedBefore: buildMissedBefore(all, cur.id), now: cur.completedAt + 1000 });
  assert.match(s.basis.line, /There is no earlier Accountancy record to compare yet\.$/);
  const kinds = s.quadrants.flatMap((q) => q.items).map((i) => i.kind);
  for (const k of ['repeat_misses', 'repeat_loss', 'chapter_slipped', 'untried']) assert.ok(!kinds.includes(k), k);
});

test('a weak chapter that fails the syllabus check gets no plan row, and the mixed row does not claim nothing stands out', () => {
  const cur = structuredClone(FIX.first_mock.attempt);
  for (const q of cur.questionsSnapshot) if (q.chapter === 'Accounting Ratios') q.chapter = 'Ratios (legacy name)';
  const s = buildSwot({ attempt: cur, allAttempts: [cur], answerReviews: {}, answerReviewState: 'ready', missedBefore: {}, now: cur.completedAt + 1000 });
  const weak = s.quadrants[1].items.find((i) => i.chapter === 'Ratios (legacy name)');
  assert.ok(weak); assert.equal(weak.planId, null);
  assert.deepEqual(s.plan.map((p) => [p.practice.chapter, p.reason]), [[null, SWOT_COPY.mixedOnly]]);
  assert.equal(OUT.mixed_plan_fallback.plan[0].reason, SWOT_COPY.mixed);
});

// ---------- The Mistake Lab ledger beside the SWOT (spec tmp/mistake-lab-v4/SPEC.md 7, slice 1) ----------

test('with the ledger on the page, the items it already shows leave the quadrants; "Do these next" is unchanged', () => {
  const s = FIX.three_mocks_repeat_loss;
  const base = swotOf(s);
  const lab = buildMistakeLab({ attempt: s.attempt, answerReviews: s.answerReviews });
  const ledgerGroups = lab.groups.map((g) => g.id);
  assert.ok(ledgerGroups.includes('changed_from_right'));
  const withLedger = buildSwot({ ...s, ledgerGroups });
  const kinds = (swot) => swot.quadrants.flatMap((q) => q.items.map((i) => i.kind));
  assert.ok(kinds(base).includes('changes_hurt'), 'the base read names the changes');
  for (const [kind, covers] of Object.entries(SWOT_RULES.ledgerCovers)) {
    if (covers.some((id) => ledgerGroups.includes(id))) assert.ok(!kinds(withLedger).includes(kind), kind);
  }
  assert.deepEqual(withLedger.plan, base.plan);
  assert.deepEqual(withLedger.basis, base.basis);
  // Chapter items stay: the ledger is about how marks were lost, not which chapters.
  for (const k of kinds(base).filter((k) => !SWOT_RULES.ledgerCovers[k])) assert.ok(kinds(withLedger).includes(k), k);
});

test('a quadrant the ledger empties says where its item went; without ledgerGroups every fixture is unchanged', () => {
  const qs = paper('lc', [['Accounting Ratios', 'RRRRRRRRRR'], ['Share Capital', 'RRRRRRRRRR'], ['Debentures', 'RRRRRRRRRR'], ['Cash Flow Statement', 'RRRRRRRBBB', { unopened: [7, 8, 9] }], ['Goodwill Valuation', 'RRRRRRBBBB', { unopened: [6, 7, 8, 9] }]]);
  const a = makeAttempt({ id: 'ledger-covers', day: 6, qs });
  const base = buildSwot({ attempt: a, allAttempts: [a], now: at(7) });
  const quadrant = (swot, id) => swot.quadrants.find((q) => q.id === id);
  assert.deepEqual(quadrant(base, 'threat').items.map((i) => i.kind), ['not_opened']);
  assert.deepEqual(quadrant(base, 'opportunity').items.map((i) => i.kind), ['blanks']);
  const covered = buildSwot({ attempt: a, allAttempts: [a], now: at(7), ledgerGroups: ['never_opened'] });
  assert.deepEqual(quadrant(covered, 'threat').items, []);
  assert.equal(quadrant(covered, 'threat').empty, SWOT_COPY.empty.inLedger);
  assert.equal(quadrant(covered, 'opportunity').empty, SWOT_COPY.empty.inLedger);
  assert.equal(SWOT_COPY.empty.inLedger, "This paper's version is in Where your marks went, above.");
  assert.deepEqual(covered.plan, base.plan, 'the timed practice row stays');
  // A quadrant that was empty anyway keeps its own empty line.
  assert.equal(quadrant(covered, 'strength').empty, quadrant(base, 'strength').empty);
  for (const name of NAMES) assert.deepEqual(buildSwot({ ...FIX[name], ledgerGroups: null }), OUT[name], name);
});

test('the route helper: the cohort reader feeds the Lab; when it fails the Lab is built without it', async () => {
  const s = FIX.three_mocks_repeat_loss;
  const seen = [];
  const cohort = { since: '2026-04-21', until: '2026-10-15', coverage: { compared: 0, total: 50 }, byQid: {} };
  const ok = await resultHistory({ attempt: s.attempt, loadAttempts: async () => s.allAttempts, recapOf: () => null, missedBeforeOf: buildMissedBefore, now: s.now,
    cohortOf: async (args) => { seen.push(Object.keys(args).sort().join(',')); return cohort; } });
  assert.deepEqual(seen, ['allAttempts,answerReviews,attempt']);
  assert.deepEqual(ok.lab.cohort.fine[0], 'No question in this paper has answers from 10 or more other students yet.');
  const warned = [];
  const failed = await resultHistory({ attempt: s.attempt, loadAttempts: async () => s.allAttempts, recapOf: () => null, missedBeforeOf: buildMissedBefore, now: s.now,
    cohortOf: async () => { throw new Error('snapshot unreadable'); }, warn: (n) => warned.push(n) });
  assert.deepEqual(warned, ['cohort']);
  assert.equal(failed.lab.state, 'ready');
  assert.equal(failed.lab.cohort, null);
});

// ---------- Marked for review (recovery.marks) ----------

// 50 questions: the marked block first (its pattern), then 15 more right and the usual filler.
const markedPaper = (pattern, marked, { id = 'marked-paper' } = {}) => makeAttempt({ id, day: 6, qs: paper(id, [
  ['Accounting Ratios', pattern, { marked }], ['Share Capital', 'RRRRRRRRRRRRRRR'], ...filler()]) });
const itemsOf = (swot) => swot.quadrants.flatMap((q) => q.items.map((i) => ({ ...i, quadrant: q.id })));

test('marked for review: marked and answered counts with their denominator, blanks as an opportunity with a plan row', () => {
  const a = markedPaper('RRWRBB', [0, 1, 2, 3, 4, 5]);
  assert.equal(a.questionsSnapshot.length, 50);
  assert.equal(a.selectionMeta.recovery.marks.length, 6, 'the record keeps the marks');
  const s = buildSwot({ attempt: a, allAttempts: [a], now: at(7) });
  const item = itemsOf(s).find((i) => i.kind === 'marked_review');
  assert.equal(item.quadrant, 'opportunity');
  assert.equal(item.title, 'Marked for review, left blank');
  assert.equal(item.detail, 'You marked 6 of 50 questions for review and answered 4 of them: 3 right, 1 wrong. 2 stayed blank: 10 marks not earned. On average an answer scores more than a blank when it is right more than 1 time in 6, under +5 for right and −1 for wrong.');
  assert.deepEqual(item.questions, [5, 6], 'the marked questions left blank');
  assert.deepEqual(item.evidence, { marked: 6, answered: 4, right: 3, wrong: 1, blank: 2, counted: 50 });
  const row = s.plan.find((p) => p.id === item.planId);
  assert.equal(row.reason, '2 of the 6 questions you marked for review were left blank.');
  assert.deepEqual(row.practice, { subject: 'accountancy', mode: 'quick', count: 20, chapter: null });
});

test('marked for review: a marked blank alone gives no plan row; answered marks are a strength or a weakness only on their own numbers', () => {
  const one = buildSwot({ attempt: markedPaper('RRWRRB', [0, 1, 2, 5], { id: 'm-one' }), allAttempts: [], now: at(7) });
  const blankOne = itemsOf(one).find((i) => i.kind === 'marked_review');
  assert.equal(blankOne.quadrant, 'opportunity');
  assert.match(blankOne.detail, /^You marked 4 of 50 questions for review and answered 3 of them: 2 right, 1 wrong\. 1 stayed blank: 5 marks not earned\./);
  assert.equal(blankOne.planId, null, 'one blank is not a plan row');

  const strong = itemsOf(buildSwot({ attempt: markedPaper('RRRRRW', [0, 1, 2, 3, 4, 5], { id: 'm-strong' }), allAttempts: [], now: at(7) })).find((i) => i.kind === 'marked_review');
  assert.equal(strong.quadrant, 'strength');
  assert.equal(strong.detail, 'You marked 6 of 50 questions for review and answered all of them: 5 right, 1 wrong.');

  const weak = itemsOf(buildSwot({ attempt: markedPaper('WWWWRR', [0, 1, 2, 3, 4], { id: 'm-weak' }), allAttempts: [], now: at(7) })).find((i) => i.kind === 'marked_review');
  assert.equal(weak.quadrant, 'weakness');
  assert.equal(weak.detail, 'You marked 5 of 50 questions for review and answered all of them: 1 right, 4 wrong.');
  assert.deepEqual(weak.questions, [1, 2, 3, 4]);

  const even = itemsOf(buildSwot({ attempt: markedPaper('RRRWWW', [0, 1, 2, 3, 4, 5], { id: 'm-even' }), allAttempts: [], now: at(7) }));
  assert.ok(!even.some((i) => i.kind === 'marked_review'), 'three right and three wrong says nothing either way');
});

test('marked for review: under 3 marked, no marks recorded, or a paper from before the capture says nothing', () => {
  const few = itemsOf(buildSwot({ attempt: markedPaper('RRWRRB', [0, 5], { id: 'm-few' }), allAttempts: [], now: at(7) }));
  assert.ok(!few.some((i) => i.kind === 'marked_review'));
  const none = markedPaper('RRWRRB', [], { id: 'm-none' });
  assert.ok(!Array.isArray(none.selectionMeta.recovery.marks) || none.selectionMeta.recovery.marks.length === 0);
  assert.ok(!itemsOf(buildSwot({ attempt: none, allAttempts: [], now: at(7) })).some((i) => i.kind === 'marked_review'));
  // A device-scored paper carries no record at all.
  const device = makeAttempt({ id: 'm-dev', day: 6, telemetry: false, qs: paper('md', [['Accounting Ratios', 'RRWRBB', { marked: [0, 1, 2, 3, 4, 5] }], ['Share Capital', 'RRRRRRRRRRRRRRR'], ...filler()]) });
  assert.ok(!itemsOf(buildSwot({ attempt: device, allAttempts: [], now: at(7) })).some((i) => i.kind === 'marked_review'));
});

test('marked for review: held questions are left out of the counts and the denominator', () => {
  const a = markedPaper('RRWRBB', [0, 1, 2, 3, 4, 5], { id: 'm-held' });
  const s = buildSwot({ attempt: a, allAttempts: [a], answerReviews: { 'm-held-3': { state: 'under_review', originalIndex: 0 } }, now: at(7) });
  const item = itemsOf(s).find((i) => i.kind === 'marked_review');
  assert.match(item.detail, /^You marked 5 of 49 questions for review and answered 3 of them: 3 right, 0 wrong\. 2 stayed blank: 10 marks not earned\./);
  assert.equal(item.evidence.counted, 49);
});
