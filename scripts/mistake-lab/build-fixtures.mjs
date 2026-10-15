// Builds the Mistake Lab test fixtures and the three contracts the app reads (spec tmp/mistake-lab-v4/SPEC.md 7).
//   node scripts/mistake-lab/build-fixtures.mjs          writes data/tests/fixtures/mistake_lab/*.json
// Every question, option and count here is illustrative: never real bank rows, never real students. The papers are
// scored by the real server scorer (data/recovery.js scoreSession) and the contracts by the real builder, so
// data/tests/mistake_lab.test.mjs can check that the committed contracts equal what the code builds today.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreSession } from '../../data/recovery.js';
import { buildMistakeLab } from '../../data/mistake_lab.js';
import { cohortForAttempt, optionHash } from '../../data/cohort_picks.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const FIXTURE_DIR = join(ROOT, 'data', 'tests', 'fixtures', 'mistake_lab');
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 15, 6, 30); // 15 Oct 2026, 12:00 IST: after the sample snapshot's cutoff

const CHAPTERS = ['Partnership Fundamentals', 'Share Capital', 'Accounting Ratios', 'Cash Flow Statement', 'Depreciation'];
const optionsFor = (id) => [`${id} statement one`, `${id} statement two`, `${id} statement three`, `${id} statement four`];
const question = (n, prefix, key) => ({ id: `${prefix}${n}`, chapter: CHAPTERS[(n - 1) % CHAPTERS.length], question: `Illustrative question ${n}`, options: optionsFor(`${prefix}${n}`), correctIndex: key });

function events() {
  const ev = [];
  let seq = 1;
  return {
    ev,
    visit: (qid, at) => ev.push({ seq: seq++, qid, at, type: 'visit' }),
    answer: (qid, at, answer) => ev.push({ seq: seq++, qid, at, type: 'answer', answer }),
    mark: (qid, at, marked) => ev.push({ seq: seq++, qid, at, type: 'mark', marked }),
  };
}

// ---------- The 50-question Full mock: every group, 5 changes, 1 held ----------
// Final outcomes: 30 right, 12 wrong, 8 blank (6 never opened). Gap 112.
const FULL = (() => {
  const P = 'q';
  const keyOf = (n) => (n * 7) % 4; // the key moves around the four positions
  const qs = Array.from({ length: 50 }, (_, i) => question(i + 1, P, keyOf(i + 1)));
  const wrongOf = (n) => (keyOf(n) + 2) % 4;
  const otherWrongOf = (n) => (keyOf(n) + 1) % 4;
  const plan = {
    3: { kind: 'quick' }, 5: { kind: 'long', ms: 150000 }, 8: { kind: 'w_then_key' }, 12: { kind: 'long', ms: 135000 },
    14: { kind: 'held' }, 17: { kind: 'key_then_wrong_later' }, 19: { kind: 'quick' }, 22: { kind: 'wrong_wrong' },
    26: { kind: 'wrong' }, 28: { kind: 'long_blank', ms: 125000 }, 31: { kind: 'key_then_wrong' }, 33: { kind: 'quick' },
    38: { kind: 'wrong' }, 40: { kind: 'wrong_then_clear' }, 42: { kind: 'wrong' },
  };
  const e = events();
  const answers = {};
  let t = 0;
  for (let n = 1; n <= 44; n++) {
    const id = `${P}${n}`;
    const p = plan[n] || { kind: 'right' };
    e.visit(id, t);
    let stay = 50000;
    if (p.kind === 'right') { e.answer(id, t + 30000, keyOf(n)); answers[id] = keyOf(n); }
    if (p.kind === 'quick') { stay = 12000; e.answer(id, t + 8000, wrongOf(n)); answers[id] = wrongOf(n); }
    if (p.kind === 'long') { stay = p.ms; e.answer(id, t + p.ms - 10000, wrongOf(n)); answers[id] = wrongOf(n); }
    if (p.kind === 'long_blank') { stay = p.ms; e.mark(id, t + 60000, true); }
    if (p.kind === 'held') { stay = 40000; e.answer(id, t + 25000, wrongOf(n)); answers[id] = wrongOf(n); }
    if (p.kind === 'wrong') { stay = 45000; e.answer(id, t + 35000, wrongOf(n)); answers[id] = wrongOf(n); }
    if (p.kind === 'wrong_wrong') { stay = 60000; e.answer(id, t + 20000, otherWrongOf(n)); e.answer(id, t + 50000, wrongOf(n)); answers[id] = wrongOf(n); }
    if (p.kind === 'w_then_key') { stay = 40000; e.answer(id, t + 30000, wrongOf(n)); answers[id] = keyOf(n); }
    if (p.kind === 'key_then_wrong_later') { stay = 100000; e.answer(id, t + 20000, keyOf(n)); answers[id] = wrongOf(n); }
    if (p.kind === 'key_then_wrong') { stay = 80000; e.answer(id, t + 15000, keyOf(n)); e.answer(id, t + 70000, wrongOf(n)); answers[id] = wrongOf(n); }
    if (p.kind === 'wrong_then_clear') { stay = 40000; e.answer(id, t + 15000, wrongOf(n)); e.answer(id, t + 32000, null); }
    t += stay;
  }
  // Return visits at the end: Q8 is changed to its key; Q17 (right at first) is changed to a wrong option after 90 s.
  e.visit('q8', t); e.answer('q8', t + 25000, keyOf(8)); t += 30000;
  e.visit('q17', t); e.answer('q17', t + 90000, wrongOf(17));
  const s = scoreSession(qs, answers, e.ev);
  return {
    description: 'Full mock, 50 questions: every ledger group, 5 answer changes (one right then changed after a return visit, taking over 3 minutes in all), Q14 held, Q45 to Q50 never opened.',
    attempt: { id: 'lab-full-1', subject: 'accountancy', completedAt: T0, questionsSnapshot: qs, details: s.details,
      selectionMeta: { mode: 'full', durationMinutes: 60, scoringVersion: 'server_snapshot_v1', recovery: s.recovery } },
    answerReviews: { q14: { state: 'under_review' } },
  };
})();

// ---------- The 10-question quick set: a pick-then-clear and a last-question quick pick ----------
const QUICK = (() => {
  const P = 'k';
  const qs = Array.from({ length: 10 }, (_, i) => question(i + 1, P, i % 4));
  const key = (n) => (n - 1) % 4;
  const wrong = (n) => (key(n) + 1) % 4;
  const e = events();
  const answers = {};
  let t = 0;
  for (let n = 1; n <= 10; n++) {
    const id = `${P}${n}`;
    e.visit(id, t);
    let stay = 40000;
    if (n === 2) { stay = 30000; } // opened, left blank
    else if (n === 4) { e.answer(id, t + 10000, key(n)); e.answer(id, t + 25000, null); } // the key, then cleared
    else if (n === 6) { stay = 9000; e.answer(id, t + 6000, wrong(n)); answers[id] = wrong(n); } // quick wrong
    else if (n === 10) { e.answer(id, t + 5000, wrong(n)); answers[id] = wrong(n); break; } // last question: nothing after
    else { e.answer(id, t + 20000, key(n)); answers[id] = key(n); }
    t += stay;
  }
  const s = scoreSession(qs, answers, e.ev);
  return {
    description: 'Quick set, 10 questions: Q4 picked the key then cleared it (right, then changed), Q6 wrong in 9 s, Q10 the last question opened with a wrong pick after 5 s (not a quick pick: its time after the last tap is unknown), Q2 opened and left blank.',
    attempt: { id: 'lab-quick-1', subject: 'accountancy', completedAt: T0 + DAY, questionsSnapshot: qs, details: s.details,
      selectionMeta: { mode: 'quick', scoringVersion: 'server_practice_v1', recovery: s.recovery } },
    answerReviews: {},
  };
})();

// ---------- A paper scored in the browser (no record), an inconsistent record, and nothing missed ----------
function plainPaper(prefix, outcomes, meta) {
  const qs = outcomes.split('').map((_, i) => question(i + 1, prefix, i % 4));
  const details = qs.map((q, i) => {
    const o = outcomes[i];
    const given = o === 'R' ? q.correctIndex : o === 'W' ? (q.correctIndex + 1) % 4 : null;
    return { qid: q.id, givenIndex: given, isCorrect: given === null ? null : given === q.correctIndex };
  });
  return { questionsSnapshot: qs, details, selectionMeta: meta };
}
const NO_TIMELINE = {
  description: 'A 12-question paper scored in the browser before server scoring: no device record, so the basic split.',
  attempt: { id: 'lab-device-1', subject: 'accountancy', completedAt: T0 - 40 * DAY, ...plainPaper('d', 'RRWRBRWWRRBR', { mode: 'quick' }) },
  answerReviews: {},
};
const INCONSISTENT = {
  description: 'A server-scored paper whose device record did not match the submitted answers.',
  attempt: { id: 'lab-inconsistent-1', subject: 'accountancy', completedAt: T0 - 2 * DAY,
    ...plainPaper('i', 'RWRRBRWRRR', { mode: 'quick', scoringVersion: 'server_practice_v1', recovery: { version: 1, telemetry: 'inconsistent', observed: { answerChanges: [] }, timeline: [] } }) },
  answerReviews: {},
};
const NO_MISSED = (() => {
  const qs = Array.from({ length: 10 }, (_, i) => question(i + 1, 'm', (i + 2) % 4));
  const e = events();
  const answers = {};
  qs.forEach((q, i) => { e.visit(q.id, i * 30000); e.answer(q.id, i * 30000 + 20000, q.correctIndex); answers[q.id] = q.correctIndex; });
  const s = scoreSession(qs, answers, e.ev);
  return {
    description: 'Every answer right: nothing missed, the heading only.',
    attempt: { id: 'lab-none-1', subject: 'accountancy', completedAt: T0 + 2 * DAY, questionsSnapshot: qs, details: s.details,
      selectionMeta: { mode: 'quick', scoringVersion: 'server_practice_v1', recovery: s.recovery } },
    answerReviews: {},
  };
})();

// ---------- An NTA paper served in a shuffled option order ----------
// The stored question keeps options in its own order; the paper shows them in `optionOrder` (served position i shows
// stored option optionOrder[i]). The snapshot of the paper holds the served order, so its key index is a served index.
const NTA = (() => {
  const stored = Array.from({ length: 10 }, (_, i) => question(i + 1, 'n', 0));
  const orders = [[2, 0, 3, 1], [1, 3, 0, 2], [3, 2, 1, 0], [0, 2, 1, 3], [2, 3, 0, 1], [1, 0, 3, 2], [3, 1, 2, 0], [2, 1, 0, 3], [0, 3, 2, 1], [1, 2, 3, 0]];
  const qs = stored.map((q, i) => {
    const order = orders[i];
    return { ...q, options: order.map((k) => q.options[k]), correctIndex: order.indexOf(q.correctIndex), optionOrder: order, optionsShuffled: true };
  });
  const e = events();
  const answers = {};
  qs.forEach((q, i) => {
    e.visit(q.id, i * 60000);
    const pick = i < 6 ? q.correctIndex : (q.correctIndex + 1) % 4;
    if (i === 8) return; // Q9 opened, left blank
    e.answer(q.id, i * 60000 + 40000, pick); answers[q.id] = pick;
  });
  const s = scoreSession(qs, answers, e.ev);
  return {
    description: 'NTA paper, 10 questions, every question shown in a shuffled option order that differs from the stored order.',
    attempt: { id: 'lab-nta-1', subject: 'accountancy', completedAt: T0 + 3 * DAY, questionsSnapshot: qs, details: s.details,
      selectionMeta: { mode: 'nta', durationMinutes: 60, scoringVersion: 'server_snapshot_v1', recovery: s.recovery } },
    answerReviews: {},
  };
})();

// ---------- The illustrative cohort snapshot ----------
// Counts per option RELATIVE to the stored key: [key, key + 1, key + 2, key + 3] (positions mod 4). In the Full mock a
// wrong answer is key + 2 and the first wrong pick of a wrong-to-wrong change is key + 1. Illustrative, never real rows.
const COUNTS = {
  q1: [12, 1, 2, 0], q2: [11, 1, 0, 1], q3: [1, 4, 2, 1], q4: [12, 3, 2, 1], q5: [8, 2, 3, 1], q6: [15, 3, 4, 2],
  q7: [22, 1, 3, 2], q9: [12, 5, 1, 2], q10: [14, 2, 2, 3], q11: [16, 3, 2, 2], q12: [21, 1, 3, 1], q13: [10, 4, 3, 2],
  q14: [12, 3, 3, 3], q15: [18, 2, 2, 2], q16: [16, 2, 2, 1], q17: [19, 3, 8, 1], q18: [13, 2, 1, 1], q19: [11, 6, 2, 2],
  q20: [17, 2, 2, 2], q22: [30, 3, 5, 2], q23: [12, 3, 1, 1], q24: [14, 3, 2, 1], q25: [18, 1, 1, 1], q26: [9, 4, 0, 3],
  q27: [14, 1, 1, 1], q29: [13, 1, 3, 2], q30: [15, 1, 1, 1], q31: [6, 2, 1, 1], q32: [16, 1, 2, 1], q34: [12, 2, 3, 1],
  q36: [15, 1, 2, 2], q38: [9, 6, 2, 6], q40: [10, 3, 2, 0], q41: [13, 2, 2, 2], q42: [18, 1, 2, 1],
  n1: [9, 2, 1, 2], n2: [8, 3, 1, 1], n7: [6, 1, 5, 2], n8: [4, 1, 9, 0],
};
function sampleSnapshot() {
  const all = [...FULL.attempt.questionsSnapshot, ...NTA.attempt.questionsSnapshot];
  const questions = {};
  for (const [qid, counts] of Object.entries(COUNTS)) {
    const q = all.find((x) => x.id === qid);
    // Stored order: the NTA fixture's served options are mapped back through optionOrder.
    const storedOptions = q.optionOrder ? q.optionOrder.map((_, k) => q.options[q.optionOrder.indexOf(k)]) : q.options;
    const storedKey = q.optionOrder ? q.optionOrder[q.correctIndex] : q.correctIndex;
    const picks = {};
    counts.forEach((c, j) => { if (c > 0) picks[optionHash(storedOptions[(storedKey + j) % 4])] = c; });
    const n = counts.reduce((s, c) => s + c, 0);
    if (n < 10) continue; // the real snapshot keeps only questions with 10 or more answers
    questions[qid] = { n, keyHash: optionHash(storedOptions[storedKey]), picks };
  }
  return { version: 1, illustrative: true, since: '2026-04-21', until: '2026-10-15', builtAt: '2026-10-15T05:00:00.000Z', questions };
}

export function buildAll() {
  const snapshot = sampleSnapshot();
  const inputs = {
    full_mock_input: FULL, quick_set_input: QUICK, no_timeline_input: NO_TIMELINE,
    inconsistent_input: INCONSISTENT, no_missed_input: NO_MISSED, nta_shuffled_input: NTA,
  };
  const cohortOf = (input) => cohortForAttempt({ attempt: input.attempt, allAttempts: [], answerReviews: input.answerReviews, snapshot });
  const fullCohort = cohortOf(FULL);
  // The slice 1 contracts keep the slice 1 shape byte for byte: slice 2's replay and time are in contract_replay_v1
  // (scripts/mistake-lab/build-replay-fixtures.mjs), so the app's copies of these three files never go stale.
  const v1 = ({ replay, time, ...lab }) => lab;
  const contracts = {
    contract_ready_v1: v1(buildMistakeLab({ attempt: FULL.attempt, answerReviews: FULL.answerReviews, cohort: fullCohort })),
    contract_basic_v1: v1(buildMistakeLab({ attempt: NO_TIMELINE.attempt, answerReviews: NO_TIMELINE.answerReviews, cohort: null })),
    contract_none_v1: v1(buildMistakeLab({ attempt: NO_MISSED.attempt, answerReviews: NO_MISSED.answerReviews, cohort: null })),
  };
  return { inputs, snapshot, fullCohort, contracts };
}

const json = (v) => `${JSON.stringify(v, null, 2)}\n`;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { inputs, snapshot, fullCohort, contracts } = buildAll();
  mkdirSync(FIXTURE_DIR, { recursive: true });
  for (const [name, value] of Object.entries(inputs)) writeFileSync(join(FIXTURE_DIR, `${name}.json`), json(value));
  writeFileSync(join(FIXTURE_DIR, 'cohort_snapshot_sample.json'), json(snapshot));
  // The full mock's cohort read, for the browser preview (data/cohort_picks.js is server-only).
  writeFileSync(join(FIXTURE_DIR, 'full_mock_cohort.json'), json(fullCohort));
  for (const [name, value] of Object.entries(contracts)) writeFileSync(join(FIXTURE_DIR, `${name}.json`), json(value));
  console.log(`wrote ${Object.keys(inputs).length + 2 + Object.keys(contracts).length} files to ${FIXTURE_DIR}`);
}
