// Marks trend's analysis blocks (lane insight, 18 Nov 2026): the pure models behind Your chapters, Your pace and Where your
// marks go. Every figure is checked against the stored fields it comes from and the constants it must never retype.
import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreSession } from '../../../data/recovery.js';
import { STATE_LABELS, CHAPTER_RULES } from '../../../data/chapter_state.js';
import { resolveChapter, unitsFor } from '../../../data/cuet_syllabus.js';
import { isTopSubject } from '../../../data/canonical_syllabus.js';
import { TEST_MODES } from '../../../data/test_modes.js';
import { NEXT_MOVE_RULES } from '../../../data/result_next_move.mjs';
import { buildTimeDecisions } from '../../../data/time_decisions.js';
import { buildChapters, chapterLosses } from './chapters.mjs';
import { buildPace, paperMedian, PACE_ROWS } from './pace.mjs';
import { changesOf, marksSplit } from './marks.mjs';
import { buildInsight, mapSubjects } from './build.mjs';
import {
  CUET_PACE_SEC, LOST, MAP_COPY, MAP_LABELS, MARKS_COPY, PACE_COPY, bookTitle, changesLine, clock, countLine, lostLine, mapIsEmpty, paceScale,
  paceWord, practiseHref, rightLine, signed, tileName, triedLine,
} from './words.mjs';

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-18T12:00:00+05:30');
const OPTIONS = ['A', 'B', 'C', 'D'].map((key) => ({ key, text: key }));
const syllabus = { unitsFor, resolveChapter, isTop: isTopSubject };

// A progress row as user_question_progress stores it.
let qn = 0;
const prog = (subject, chapter, correct, over = {}) => ({
  question_id: `p${(qn += 1)}`, subject, chapter, attempt_count: 1, last_correct: correct, last_attempted_at: new Date(NOW - DAY).toISOString(), ...over,
});
const answers = (subject, chapter, right, wrong, over = {}) => [
  ...Array.from({ length: right }, () => prog(subject, chapter, true, over)),
  ...Array.from({ length: wrong }, () => prog(subject, chapter, false, over)),
];

// A paper scored by the real scorer, with its device record: `spec` is [chapter, outcome ('r' | 'w' | 'b'), seconds].
function paper(id, subject, daysAgo, spec, { mode = 'quick', scoring = 'server_practice_v1', changeFirst = -1 } = {}) {
  const questions = spec.map(([chapter], i) => ({ id: `${id}-q${i}`, chapter, difficulty: 'medium', correctIndex: 0, options: OPTIONS, question: `Q${i}` }));
  const picks = {};
  const events = [];
  let seq = 1;
  let at = 500;
  spec.forEach(([, outcome, seconds = 50], i) => {
    const qid = questions[i].id;
    events.push({ seq: seq++, qid, at, type: 'visit' });
    if (i === changeFirst) events.push({ seq: seq++, qid, at: at + 300, type: 'answer', answer: 2 });
    if (outcome !== 'b') { const answer = outcome === 'r' ? 0 : 1; events.push({ seq: seq++, qid, at: at + 600, type: 'answer', answer }); picks[qid] = answer; }
    at += seconds * 1000;
  });
  events.push({ seq: seq++, qid: questions.at(-1).id, at: at + 10, type: 'visit' });
  const scored = scoreSession(questions, picks, events, at + 1000);
  return { id, subject, ...scored, questionsSnapshot: questions, selectionMeta: { mode, scoringVersion: scoring, recovery: scored.recovery }, completedAt: NOW - daysAgo * DAY };
}
const many = (chapter, outcome, n, seconds = 50) => Array.from({ length: n }, () => [chapter, outcome, seconds]);

// ---------------------------------------------------------------- the words

test('the map says chapter state\'s own words, and "Not tried" for a chapter with no answer', () => {
  assert.deepEqual({ ...MAP_LABELS, none: STATE_LABELS.none }, { ...STATE_LABELS });
  assert.equal(MAP_LABELS.none, 'Not tried');
  assert.equal(MAP_COPY.title, 'Your chapters');
  assert.equal(MAP_COPY.sub, 'Every chapter of your subjects, in book order.');
  assert.equal(MAP_COPY.practise, `Practise ${NEXT_MOVE_RULES.setSize} on this chapter`);
  assert.equal(MAP_COPY.practise, 'Practise 10 on this chapter');
  assert.equal(MAP_COPY.keycards, 'Open Key cards');
  assert.equal(triedLine(8, 15), '8 of 15 chapters tried');
  assert.equal(rightLine(7, 12), '7 of 12 right');
  // A tile is read out by the name it shows, then the book's full name, then its state (the full name is reachable by focus).
  assert.equal(tileName({ name: 'Goodwill Valuation', title: 'Goodwill: Nature and Valuation', label: 'Needs work' }), 'Goodwill Valuation, Goodwill: Nature and Valuation. Needs work');
  assert.equal(tileName({ name: 'Planning', title: 'Planning', label: 'Not tried' }), 'Planning. Not tried');
  assert.equal(bookTitle('Retirement/Death of a Partner'), 'Retirement and Death of a Partner');
});

test('the count line names only the states that are there, strongest first, in plain counts', () => {
  assert.equal(countLine({ strong: 6, mid: 3, weak: 2, thin: 0, none: 3 }), '6 holding, 3 getting there, 2 need work, 3 not tried');
  assert.equal(countLine({ weak: 1, thin: 2 }), '1 needs work, 2 with too few answers');
  assert.equal(countLine({ none: 15 }), '15 not tried');
  assert.equal(countLine({}), null);
  assert.equal(lostLine(24, 3), '24 marks in 3 papers');
  assert.equal(lostLine(0, 2), 'None in 2 papers');
  assert.equal(lostLine(5, 1), '5 marks in 1 paper');
  assert.equal(lostLine(0, 0), null, 'a chapter no paper asked has no marks line, not a zero');
});

test('Practise opens the very link Your papers\' chapter row opens', () => {
  const review = (subject, name) => `/dashboard?${new URLSearchParams({ subject, mode: 'quick', count: String(NEXT_MOVE_RULES.setSize), chapter: name })}`;
  assert.equal(practiseHref('accountancy', 'Goodwill Valuation'), review('accountancy', 'Goodwill Valuation'));
  assert.equal(practiseHref('accountancy', 'Profit & Loss Appropriation Account'), '/dashboard?subject=accountancy&mode=quick&count=10&chapter=Profit+%26+Loss+Appropriation+Account');
});

test('CUET\'s pace comes from NTA mode\'s own constants, and a figure is a clock with its word', () => {
  assert.equal(CUET_PACE_SEC, TEST_MODES.nta.fixedDurationSec / TEST_MODES.nta.fixedCount);
  assert.equal(PACE_COPY.sub(), `CUET gives you ${clock(CUET_PACE_SEC)} a question.`);
  assert.equal(PACE_COPY.sub(), 'CUET gives you 1:12 a question.');
  assert.equal(PACE_COPY.none, 'Sit one timed mock and your pace shows here.');
  assert.deepEqual([clock(0), clock(9), clock(58), clock(72), clock(125), clock(59.6)], ['0:00', '0:09', '0:58', '1:12', '2:05', '1:00']);
  assert.deepEqual([paceWord(58), paceWord(72), paceWord(90)], ['under pace', 'on pace', 'over pace']);
  assert.equal(paceScale([{ medianSec: 58 }]), 90, 'the scale reaches past CUET\'s pace');
  assert.equal(paceScale([{ medianSec: 140 }]), 165);
});

test('the marks split\'s words: its papers, signs and the marking line from the constants', () => {
  assert.equal(MARKS_COPY.sub(6), 'Across your 6 papers on record.');
  assert.equal(MARKS_COPY.sub(1), 'Across your 1 paper on record.');
  assert.equal(MARKS_COPY.rule, '+5 per right, −1 per wrong');
  assert.deepEqual([signed(3), signed(-2), signed(0)], ['+3', '−2', '0']);
  assert.equal(changesLine({ papers: 6, count: 7, net: 3 }, 6), 'Changed answers: +3 marks across 7 changes.');
  assert.equal(changesLine({ papers: 2, count: 1, net: -1 }, 6), 'Changed answers: −1 mark across 1 change, in 2 replayed sessions.');
  assert.equal(changesLine({ papers: 2, count: 0, net: 0 }, 6), 'No changed answers recorded.');
  assert.equal(changesLine(null, 6), null, 'no replayed paper: no line');
});

// ---------------------------------------------------------------- Your chapters

test('chapter states from raw rows: never tried, under six answers, then the Wilson bands; no percentage anywhere', () => {
  const progress = [
    ...answers('accountancy', 'Partnership Fundamentals', 12, 0), // strong
    ...answers('accountancy', 'Goodwill Valuation', 6, 6), // mid
    ...answers('accountancy', 'Admission of Partner', 1, 9), // weak
    ...answers('accountancy', 'Share Capital', 4, 1), // thin: 5 answers
    ...answers('accountancy', 'Debentures', 1, 0), // thin: 1 answer
  ];
  const map = buildChapters({ subjects: ['accountancy'], unitsFor, resolveChapter, progress, now: NOW });
  assert.equal(map.state, 'ready');
  const [acc] = map.subjects;
  const by = Object.fromEntries(acc.chapters.map((c) => [c.name, c]));
  assert.equal(by['Partnership Fundamentals'].state, 'strong');
  assert.equal(by['Partnership Fundamentals'].label, 'Holding');
  assert.equal(by['Goodwill Valuation'].label, 'Getting there');
  assert.equal(by['Admission of Partner'].label, 'Needs work');
  assert.equal(by['Share Capital'].label, 'Too few answers');
  assert.equal(by['Share Capital'].n, CHAPTER_RULES.minAnswers - 1);
  assert.equal(by.Debentures.label, 'Too few answers');
  assert.equal(by['Cash Flow Statement'].state, 'none');
  assert.equal(by['Cash Flow Statement'].label, 'Not tried');
  assert.deepEqual([by['Cash Flow Statement'].n, by['Cash Flow Statement'].lastAt], [0, null]);
  assert.equal(acc.tried, 5);
  assert.equal(acc.total, acc.chapters.length);
  assert.deepEqual(acc.counts, { strong: 1, mid: 1, weak: 1, thin: 2, none: acc.total - 5 });
  assert.doesNotMatch(JSON.stringify(map), /%|percent|mastered|mastery/i);
});

test('chapters in book order, the saved option keeps its part only, and each question counts once by its latest answer', () => {
  const book = unitsFor('accountancy', {}).flatMap((u) => u.chapters.map((c) => c.key));
  const all = buildChapters({ subjects: ['accountancy'], unitsFor, resolveChapter, now: NOW }).subjects[0];
  assert.deepEqual(all.chapters.map((c) => c.key), book, 'no option saved: every chapter, in the syllabus order');
  const afs = buildChapters({ subjects: ['accountancy'], unitsFor, resolveChapter, optionOf: () => 'AFS', now: NOW }).subjects[0];
  assert.ok(afs.chapters.every((c) => c.name !== 'Computerized Accounting System'));
  assert.equal(afs.total, all.total - 1);
  const twice = [
    prog('accountancy', 'Goodwill Valuation', false, { question_id: 'same', last_attempted_at: new Date(NOW - 5 * DAY).toISOString() }),
    prog('accountancy', 'Goodwill Valuation', true, { question_id: 'same', last_attempted_at: new Date(NOW - DAY).toISOString() }),
    prog('accountancy', 'Goodwill Valuation', true, { attempt_count: 0 }), // seen, never answered
  ];
  const g = buildChapters({ subjects: ['accountancy'], unitsFor, resolveChapter, progress: twice, now: NOW }).subjects[0].chapters.find((c) => c.name === 'Goodwill Valuation');
  assert.deepEqual([g.n, g.right, g.lastAt], [1, 1, NOW - DAY]);
});

test('a held Mob paper\'s questions are out of every chapter count; an unread record is an error, not "Not tried"', () => {
  const rows = answers('accountancy', 'Admission of Partner', 0, 8);
  const held = new Set(rows.slice(0, 5).map((r) => r.question_id));
  const c = buildChapters({ subjects: ['accountancy'], unitsFor, resolveChapter, progress: rows, heldQids: held, now: NOW }).subjects[0].chapters.find((x) => x.name === 'Admission of Partner');
  assert.deepEqual([c.n, c.state], [3, 'thin']);
  assert.deepEqual(buildChapters({ subjects: ['accountancy'], unitsFor, resolveChapter, progress: rows, incomplete: true }), { state: 'error' });
});

test('marks lost per chapter: 6 for a wrong answer, 5 for a blank, from CUET\'s marking; papers counted once each', () => {
  assert.deepEqual(LOST, { wrong: TEST_MODES.nta.marking.right - TEST_MODES.nta.marking.wrong, blank: TEST_MODES.nta.marking.right - TEST_MODES.nta.marking.blank });
  assert.deepEqual(LOST, { wrong: NEXT_MOVE_RULES.gapWrong, blank: NEXT_MOVE_RULES.gapBlank }, 'the figures Your papers prices chapters with');
  const p1 = paper('a1', 'accountancy', 2, [['Goodwill Valuation', 'w'], ['Goodwill Valuation', 'b'], ['Goodwill Valuation', 'r'], ['Admission of Partner', 'r']]);
  const p2 = paper('a2', 'accountancy', 1, [['Partnership', 'w'], ['Not A Chapter', 'w']]); // an alias, then an unknown name
  const losses = chapterLosses([p1, p2], resolveChapter);
  assert.deepEqual(losses.get(resolveChapter('accountancy', 'Goodwill Valuation').key), { lost: 6 + 5, wrong: 1, blank: 1, papers: 1 });
  assert.equal(resolveChapter('accountancy', 'Partnership').name, 'Partnership Fundamentals', 'the alias resolves');
  assert.deepEqual(losses.get(resolveChapter('accountancy', 'Partnership Fundamentals').key), { lost: 6, wrong: 1, blank: 0, papers: 1 });
  assert.equal([...losses.keys()].length, 3, 'the unknown name is skipped');
  assert.deepEqual(losses.get(resolveChapter('accountancy', 'Admission of Partner').key), { lost: 0, wrong: 0, blank: 0, papers: 1 });
  const map = buildChapters({ subjects: ['accountancy'], unitsFor, resolveChapter, papers: [p1, p2], now: NOW }).subjects[0];
  const row = map.chapters.find((c) => c.name === 'Goodwill Valuation');
  assert.deepEqual([row.lost, row.papers, row.state], [11, 1, 'none'], 'papers price a chapter; only answers give it a state');
});

test('the map draws the picked subjects the syllabus knows, in the student\'s order; empty until something is tried', () => {
  assert.deepEqual(mapSubjects(['business_studies', 'accountancy', 'business_studies', 'not_a_subject', ''], isTopSubject), ['business_studies', 'accountancy']);
  const empty = buildChapters({ subjects: ['accountancy', 'business_studies'], unitsFor, resolveChapter, now: NOW });
  assert.equal(mapIsEmpty(empty), true);
  assert.deepEqual(empty.subjects.map((s) => [s.id, s.tried]), [['accountancy', 0], ['business_studies', 0]]);
  const one = buildChapters({ subjects: ['accountancy'], unitsFor, resolveChapter, progress: [prog('accountancy', 'Debentures', true)], now: NOW });
  assert.equal(mapIsEmpty(one), false);
});

// ---------------------------------------------------------------- Your pace

test('pace rows: newest last, at most eight, papers with no usable timing left out', () => {
  const timed = (id, daysAgo, seconds, opts) => paper(id, 'accountancy', daysAgo, many('Goodwill Valuation', 'r', 12, seconds), opts);
  const papers = [
    ...Array.from({ length: 10 }, (_, i) => timed(`t${i}`, 20 - i, 40 + i * 5)), // t9 is the newest timed one
    timed('device', 0.5, 50, { scoring: 'client_v1' }), // scored in the browser: no record to time
    paper('short', 'accountancy', 0.4, many('Goodwill Valuation', 'r', 5, 60)), // 5 timed questions: no median named
    paper('quick', 'accountancy', 0.3, many('Goodwill Valuation', 'r', 12, 1)), // every question under 2 s
  ];
  const labels = new Map([['t9', 'Mock 9']]);
  const pace = buildPace(papers, { labels, nameOf: () => 'Accountancy' });
  assert.equal(pace.paceSec, CUET_PACE_SEC);
  assert.equal(pace.papers.length, PACE_ROWS);
  assert.deepEqual(pace.papers.map((r) => r.id), ['t2', 't3', 't4', 't5', 't6', 't7', 't8', 't9']);
  assert.ok(pace.papers.every((r, i, all) => i === 0 || all[i - 1].at <= r.at), 'oldest first, newest last');
  assert.equal(pace.papers.at(-1).name, 'Mock 9');
  assert.equal(pace.papers[0].name, 'Quick practice');
  assert.equal(pace.papers.at(-1).medianSec, 85);
  assert.equal(paperMedian(papers.find((p) => p.id === 'short')), null);
  assert.equal(paperMedian(papers.find((p) => p.id === 'device')), null);
  assert.equal(paperMedian(papers.find((p) => p.id === 'quick')), null);
  assert.deepEqual(buildPace([]).papers, []);
});

test('a row\'s median is the one the paper\'s own result names', () => {
  const p = paper('m1', 'accountancy', 1, [...many('Goodwill Valuation', 'r', 6, 30), ...many('Goodwill Valuation', 'w', 5, 95)]);
  const row = paperMedian(p);
  const lab = buildTimeDecisions(p);
  assert.equal(row.timed, 11);
  assert.equal(lab.state, 'ready');
  assert.equal(row.medianSec, Math.round(lab.medianMs / 1000));
  assert.equal(row.medianSec, 30, 'six of eleven questions at 30 s: the median is 30 s');
});

// ---------------------------------------------------------------- Where your marks go

test('the marks split sums to every mark not earned: 5 x questions - (5 x right - 1 x wrong)', () => {
  const papers = [
    paper('k1', 'accountancy', 3, [...many('Goodwill Valuation', 'r', 7), ...many('Goodwill Valuation', 'w', 3), ...many('Goodwill Valuation', 'b', 2)]),
    paper('k2', 'accountancy', 2, [...many('Admission of Partner', 'r', 4), ...many('Admission of Partner', 'w', 5), ...many('Admission of Partner', 'b', 1)]),
  ];
  const right = papers.reduce((s, p) => s + p.correct, 0);
  const wrong = papers.reduce((s, p) => s + p.wrong, 0);
  const blank = papers.reduce((s, p) => s + p.unattempted, 0);
  const questions = papers.reduce((s, p) => s + p.total, 0);
  const split = marksSplit({ papers: papers.length, wrong, blank });
  const { right: R, wrong: W } = TEST_MODES.nta.marking;
  assert.equal(split.total, R * questions - (R * right + W * wrong));
  assert.equal(split.total, split.wrong.marks + split.blank.marks);
  assert.deepEqual([split.wrong.count, split.wrong.marks, split.blank.count, split.blank.marks], [8, 48, 3, 15]);
  assert.equal(marksSplit({ papers: 0, wrong: 0, blank: 0 }), null, 'fewer than one paper: no block');
  assert.deepEqual(marksSplit({ papers: 2, wrong: 0, blank: 0 }), { papers: 2, wrong: { count: 0, marks: 0 }, blank: { count: 0, marks: 0 }, total: 0 });
});

test('changed answers come only from papers with a matched device record, both directions counted', () => {
  const gain = paper('c1', 'accountancy', 2, many('Goodwill Valuation', 'r', 3), { changeFirst: 0 }); // C to A: +6
  const loss = paper('c2', 'accountancy', 1, many('Goodwill Valuation', 'w', 3), { changeFirst: 1 }); // C to B: 0 (wrong to wrong)
  const plain = paper('c3', 'accountancy', 0.5, many('Goodwill Valuation', 'r', 3));
  const device = { ...plain, id: 'c4', selectionMeta: { mode: 'quick', scoringVersion: 'client_v1' } };
  const out = changesOf([gain, loss, plain, device]);
  assert.equal(out.papers, 3);
  assert.equal(out.count, 2);
  assert.equal(out.net, gain.recovery.observed.answerChanges[0].markEffect + loss.recovery.observed.answerChanges[0].markEffect);
  assert.equal(changesOf([device]), null);
});

// ---------------------------------------------------------------- the whole insight

test('Free gets the map and the split; the pace rows and changed answers are Pro\'s and are not sent to Free', () => {
  const papers = [paper('x1', 'accountancy', 2, many('Goodwill Valuation', 'w', 12, 80), { changeFirst: 0 }), paper('x2', 'accountancy', 1, many('Goodwill Valuation', 'r', 12, 40))];
  const progress = { rows: answers('accountancy', 'Goodwill Valuation', 12, 12), incomplete: false };
  const base = { attempts: papers, openAttempts: papers, progress, syllabus, now: NOW };
  const free = buildInsight({ ...base, user: { isPremium: false, subjects: ['accountancy'] } });
  const pro = buildInsight({ ...base, user: { isPremium: true, subjects: ['accountancy'] } });
  assert.equal(free.plan, 'free');
  assert.deepEqual(free.pace, { state: 'locked', paceSec: CUET_PACE_SEC });
  assert.equal(free.marks.changes, null);
  assert.equal(free.marks.changesLocked, true);
  assert.equal(free.chapters.state, 'ready');
  assert.equal(free.marks.state, 'ready');
  assert.doesNotMatch(JSON.stringify(free.pace), /medianSec/);
  assert.equal(pro.pace.state, 'ready');
  assert.equal(pro.pace.papers.length, 2);
  assert.equal(pro.marks.changes.count, 1);
  assert.deepEqual(free.chapters, pro.chapters, 'the map is the same on both plans');
  // The account unread: its subjects and plan are unknown, so those blocks are failed reads, never an empty map or a lock.
  const unread = buildInsight({ ...base, user: null });
  assert.deepEqual([unread.chapters.state, unread.pace.state, unread.marks.state], ['error', 'error', 'ready']);
  // One block failing leaves the others.
  const broken = buildInsight({ ...base, user: { isPremium: true, subjects: ['accountancy'] }, syllabus: { ...syllabus, unitsFor: () => { throw new Error('x'); } } });
  assert.deepEqual([broken.chapters.state, broken.pace.state, broken.marks.state], ['error', 'ready', 'ready']);
  assert.equal(buildInsight({ ...base, attempts: [], openAttempts: [], user: { isPremium: true, subjects: [] } }).marks.state, 'none');
});
