// Builds the Mistake Lab slice 4 contracts (spec tmp/mistake-lab-v4/SPEC.md 4.7 second part, 4.8, 4.11 and "Slice 4").
//   node scripts/mistake-lab/build-s4-fixtures.mjs          writes data/tests/fixtures/mistake_lab/
//     contract_traps_v1.json   { paper: lab.traps, sheet: GET /api/me/traps, states: the empty sheet }
//     contract_later_v1.json   { prove: lab.prove.later (and the variants), revise: GET /api/me/revise, answers:
//                                POST /api/me/revise/answer for a right, a wrong and a final recall, end: the end lines }
// Every question, option, repair and count is illustrative: never real bank rows, never real students. The trap tags are
// built by the real builders (data/trap_atlas.js, data/lab_loop.js buildLabSlice4), the Revise body and answers by the
// real server module (src/lib/server/revise.js) over an in-memory stand-in for the database, so data/tests/trap_atlas.test.mjs
// and data/tests/revise.test.mjs can check that the committed files equal what the code builds today, and the app reads the
// same files byte for byte.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { optionHash } from '../../data/option_hash.js';
import { buildMistakeLab } from '../../data/mistake_lab.js';
import { buildLabSlice4 } from '../../data/lab_loop.js';
import { buildTrapsMeet, indexAtlas } from '../../data/trap_atlas.js';
import { buildLater, endLine } from '../../data/revise.js';
import { getRevise, answerRevise } from '../../src/lib/server/revise.js';
import { fakeDb } from './fake-db.mjs';
import { FIXTURE_DIR } from './build-fixtures.mjs';

const DAY = 86_400_000;
export const T0 = Date.UTC(2026, 9, 15, 6, 30); // 15 Oct 2026, 12:00 IST
export const USER = 'student-fixture-1';

// ---------- Questions ----------
const plain = (id, chapter, stem, options, key, extra = {}) => ({ id, chapter, question: stem, options, correctIndex: key, ...extra });
const AR = [
  'Both A and R are true and R is the correct explanation of A.',
  'Both A and R are true but R is not the correct explanation of A.',
  'A is true but R is false.',
  'A is false but R is true.',
];

/** The 10-question paper that shows every kind of tag, and every reason a tag stays off. */
export function labPaper() {
  const qs = [
    plain('p1-q1', 'Share Capital', 'Illustrative question 1 (a named trap, from a repair)', ['Illustrative option 1a', 'Illustrative option 1b', 'Illustrative option 1c', 'Illustrative option 1d'], 0),
    plain('p1-q2', 'Accounting Ratios', 'Assertion (A): illustrative statement. Reason (R): illustrative statement.', AR, 0, { questionType: 'assertion_reason' }),
    plain('p1-q3', 'Cash Flow Statement', 'Match List I with List II. Illustrative items A to D against I to IV.', ['A-II, B-I, C-IV, D-III', 'A-II, B-I, C-III, D-IV', 'A-I, B-II, C-III, D-IV', 'A-III, B-IV, C-I, D-II'], 0, { questionType: 'match_the_following' }),
    plain('p1-q4', 'Depreciation', 'Arrange the illustrative events A to D in the correct order.', ['B-A-D-C', 'B-A-C-D', 'A-B-C-D', 'D-C-B-A'], 0, { questionType: 'sequence_ordering' }),
    plain('p1-q5', 'Share Capital', 'Illustrative question 5 (repairs disagree on the trap)', ['Illustrative option 5a', 'Illustrative option 5b', 'Illustrative option 5c', 'Illustrative option 5d'], 0),
    plain('p1-q6', 'Accounting Ratios', 'Illustrative question 6 (the key loses to a wrong option)', ['Illustrative option 6a', 'Illustrative option 6b', 'Illustrative option 6c', 'Illustrative option 6d'], 0),
    plain('p1-q7', 'Cash Flow Statement', 'Illustrative question 7 (held for re-check)', ['Illustrative option 7a', 'Illustrative option 7b', 'Illustrative option 7c', 'Illustrative option 7d'], 0),
    plain('p1-q8', 'Depreciation', 'Illustrative question 8 (answered right)', ['Illustrative option 8a', 'Illustrative option 8b', 'Illustrative option 8c', 'Illustrative option 8d'], 0),
    plain('p1-q9', 'Share Capital', 'Illustrative question 9 (left blank)', ['Illustrative option 9a', 'Illustrative option 9b', 'Illustrative option 9c', 'Illustrative option 9d'], 0),
    plain('p1-q10', 'Accounting Ratios', 'Illustrative question 10 (wrong, no trap named yet)', ['Illustrative option 10a', 'Illustrative option 10b', 'Illustrative option 10c', 'Illustrative option 10d'], 0),
  ];
  // Final answers: wrong on 1 to 7 and 10 (the picked option is index 1), right on 8, blank on 9.
  const picks = { 'p1-q1': 1, 'p1-q2': 1, 'p1-q3': 1, 'p1-q4': 1, 'p1-q5': 1, 'p1-q6': 1, 'p1-q7': 1, 'p1-q8': 0, 'p1-q9': null, 'p1-q10': 1 };
  const details = qs.map((q) => {
    const given = picks[q.id];
    return given === null ? { qid: q.id, givenIndex: null, isCorrect: null } : { qid: q.id, givenIndex: given, isCorrect: given === q.correctIndex };
  });
  return { id: 'p1', subject: 'accountancy', mode: 'full', completedAt: T0, questionsSnapshot: qs, details, selectionMeta: { mode: 'full', durationMinutes: 60 }, total: qs.length };
}

/** Atlas rows (indexAtlas input) for the lab paper: a clean row, a disagreeing row, a row on the flagged question, a row on the held one. */
export function labAtlasRows(paper = labPaper()) {
  const hash = (qid, i) => optionHash(paper.questionsSnapshot.find((q) => q.id === qid).options[i]);
  const row = (qid, i, type, agreeing, disagreeing = 0) => ({ qid, option_hash: hash(qid, i), trap_type: type, repairs_agreeing: agreeing, repairs_disagreeing: disagreeing, source: 'repair' });
  return [
    row('p1-q1', 1, 'look_alike_term', 3),
    row('p1-q5', 1, 'reversed', 2, 1),
    row('p1-q6', 1, 'wrong_rule', 2),
    row('p1-q7', 1, 'partly_true', 1),
  ];
}

/** The illustrative cohort read the Lab shows on the flagged question: 32 of 60 picked B, 10 picked the key. */
export const labCohort = Object.freeze({
  since: '2026-04-21', until: '2026-10-15', coverage: { compared: 1, total: 10 },
  byQid: { 'p1-q6': { n: 60, right: 10, counts: [10, 32, 10, 8], keyIndex: 0 } },
});

export function buildPaperContracts() {
  const paper = labPaper();
  const answerReviews = { 'p1-q7': { state: 'under_review', originalIndex: 0 } };
  const lab = buildMistakeLab({ attempt: paper, answerReviews, cohort: labCohort });
  const atlas = indexAtlas(labAtlasRows(paper));
  const slice4 = buildLabSlice4({ attempt: paper, allAttempts: [paper], answerReviews, lab, atlas, cards: null, now: T0 + 3_600_000 });
  return { paper, answerReviews, lab, atlas, slice4 };
}

// ---------- The student's record behind "Traps you meet" ----------
// A look-alike trap met 10 times (4 of the first 5 caught, 1 of the last 5), a wrong-rule trap met 6 times (1 of the first 2,
// 3 of the last 4), an assertion-reason link met 3 times, and a partly-true option met twice (under the 3-chance floor).
function trapQuestion(id, type) {
  return plain(id, 'Share Capital', `Illustrative question ${id}`, [`${id} key`, `${id} trap`, `${id} other`, `${id} also other`], 0, { _trap: type });
}
export function sheetInputs() {
  const rows = [];
  const attempts = [];
  const add = (day, list, picks, extra = {}) => {
    const qs = list.map((q) => ({ ...q })); // keep the type out of the stored question
    qs.forEach((q) => { delete q._trap; });
    attempts.push({
      id: `s-${attempts.length + 1}`, subject: 'accountancy', mode: 'quick', completedAt: T0 + day * DAY,
      questionsSnapshot: [...qs, ...(extra.formatQuestions || [])],
      details: [...list.map((q, i) => ({ qid: q.id, givenIndex: picks[i], isCorrect: picks[i] === q.correctIndex })), ...(extra.formatDetails || [])],
    });
  };
  const L = Array.from({ length: 10 }, (_, i) => trapQuestion(`l${i + 1}`, 'look_alike_term'));
  const W = Array.from({ length: 6 }, (_, i) => trapQuestion(`w${i + 1}`, 'wrong_rule'));
  const P = Array.from({ length: 2 }, (_, i) => trapQuestion(`x${i + 1}`, 'partly_true'));
  const arQ = (n) => plain(`ar${n}`, 'Accounting Ratios', `Assertion (A): illustrative ${n}. Reason (R): illustrative ${n}.`, AR, 0, { questionType: 'assertion_reason' });
  // Earlier days (13 to 15 days before the paper), later days (7 to 5 days before).
  add(-14, [L[0], L[1], L[2], W[0], W[1]], [1, 1, 1, 1, 0], { formatQuestions: [arQ(1)], formatDetails: [{ qid: 'ar1', givenIndex: 1, isCorrect: false }] });
  add(-13, [L[3], L[4], P[0]], [1, 0, 1]);
  add(-7, [L[5], L[6], L[7], W[2], W[3], W[4], W[5]], [1, 0, 0, 1, 1, 1, 0], { formatQuestions: [arQ(2)], formatDetails: [{ qid: 'ar2', givenIndex: 0, isCorrect: true }] });
  add(-6, [L[8], L[9], P[1]], [0, 0, 0], { formatQuestions: [arQ(3)], formatDetails: [{ qid: 'ar3', givenIndex: 1, isCorrect: false }] });
  for (const q of [...L, ...W, ...P]) rows.push({ qid: q.id, option_hash: optionHash(q.options[1]), trap_type: q._trap, repairs_agreeing: 2, repairs_disagreeing: 0, source: 'repair' });
  return { attempts, atlasRows: rows };
}

export function buildSheetContracts() {
  const { attempts, atlasRows } = sheetInputs();
  const sheet = buildTrapsMeet({ attempts, atlas: indexAtlas(atlasRows) });
  const empty = buildTrapsMeet({ attempts: [], atlas: null });
  return { attempts, atlasRows, sheet, empty };
}

// ---------- Revise ----------
const revQuestion = (n, over = {}) => ({
  id: `r-q${n}`, subject: 'accountancy', chapter: ['Share Capital', 'Accounting Ratios', 'Cash Flow Statement'][n % 3], question: `Illustrative revise question ${n}`,
  body: `Illustrative revise question ${n}`, options: ['a', 'b', 'c', 'd'].map((k, i) => ({ key: k.toUpperCase(), text: `Illustrative option ${n}${k}` })), correct_answer: 'B',
  status: 'live', is_deleted: false, verification_state: 'verified', explanation: `Illustrative stored explanation ${n}.`, passage_text: null, ...over,
});
export const REVISE_NOW = Date.UTC(2026, 9, 16, 6, 30); // 16 Oct 2026, 12:00 IST
const card = (n, over) => ({ user_id: USER, question_id: `r-q${n}`, box: 1, due_day: '2026-10-16', state: 'active', right_total: 0, last_recalled_day: null, key_hash: null, wrong_at: null, created_at: '2026-10-15T07:00:00.000Z', updated_at: '2026-10-15T07:00:00.000Z', ...over });
const progressRow = (n, key, at) => ({ user_id: USER, question_id: `r-q${n}`, last_correct: false, last_selected_key: key, last_attempted_at: at });

export function reviseWorld() {
  const questions = Array.from({ length: 8 }, (_, i) => revQuestion(i + 1));
  questions[5] = revQuestion(6, { status: 'pending', verification_state: 'disputed' }); // held for re-check: never asked
  const cards = [
    card(1, { box: 1, due_day: '2026-10-16' }),
    card(2, { box: 2, due_day: '2026-10-16', right_total: 1, last_recalled_day: '2026-10-13' }),
    card(3, { box: 4, due_day: '2026-10-16', right_total: 3, last_recalled_day: '2026-09-25' }),
    card(4, { box: 3, due_day: '2026-10-19', right_total: 2, last_recalled_day: '2026-10-12' }),
    card(6, { box: 1, due_day: '2026-10-16' }),
    card(7, { box: 1, due_day: '2026-10-17' }),
  ];
  // A wrong answer on record that has no card yet (seeded on the read): r-q5 two days ago.
  const progress = [progressRow(5, 'A', '2026-10-14T09:00:00.000Z')];
  return { questions, cards, progress };
}

export async function buildReviseContracts() {
  const world = reviseWorld();
  const db = fakeDb({ questions: world.questions, progress: world.progress, cards: world.cards });
  const got = await getRevise(USER, { db, now: REVISE_NOW });
  const answers = {};
  const take = async (name, qid, choice) => { answers[name] = (await answerRevise(USER, { questionId: qid, choice }, { db, now: REVISE_NOW })).body; };
  await take('right', 'r-q1', 1); // box 1 to box 2
  await take('wrong', 'r-q2', 0); // back to box 1
  await take('done', 'r-q3', 1); // box 4 recalled right: done
  const later = {
    scheduled: buildLater({ attempt: labPaper(), allAttempts: [labPaper()], answerReviews: { 'p1-q7': { state: 'under_review' } }, cards: null, now: T0 + 3_600_000 }),
    withCards: buildLater({
      attempt: labPaper(), allAttempts: [labPaper()], answerReviews: { 'p1-q7': { state: 'under_review' } }, now: T0 + 2 * DAY,
      cards: new Map([['p1-q1', { question_id: 'p1-q1', box: 1, due_day: '2026-10-16', state: 'active' }], ['p1-q2', { question_id: 'p1-q2', box: 2, due_day: '2026-10-19', state: 'active' }], ['p1-q3', { question_id: 'p1-q3', box: 4, due_day: '2026-11-06', state: 'retired' }]]),
    }),
  };
  return { world, revise: got.body, answers, later, end: { both: endLine({ right: 8, wrong: 2 }), right: endLine({ right: 3 }), wrong: endLine({ wrong: 2 }) } };
}

export async function buildS4() {
  const { slice4 } = buildPaperContracts();
  const { sheet, empty } = buildSheetContracts();
  const rev = await buildReviseContracts();
  return {
    contracts: {
      contract_traps_v1: { paper: slice4.traps, sheet, empty },
      contract_later_v1: { prove: rev.later.scheduled, proveWithCards: rev.later.withCards, revise: rev.revise, answers: rev.answers, end: rev.end },
    },
  };
}

const json = (v) => `${JSON.stringify(v, null, 2)}\n`;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { contracts } = await buildS4();
  mkdirSync(FIXTURE_DIR, { recursive: true });
  for (const [name, value] of Object.entries(contracts)) writeFileSync(join(FIXTURE_DIR, `${name}.json`), json(value));
  console.log(`wrote ${Object.keys(contracts).length} files to ${FIXTURE_DIR}`);
}
