// Lane arena-a (19 Nov 2026): Progress, Your standing, Your papers and Wallet read in one look. The derived figures each have
// a pure model; these tests hold their edge cases (rank inside the top ten, one student, zero balance, unknown, too few answers).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { finishedWeeks, recordFigures, weekGoal, weekMarks, MIN_ANSWERS_FOR_SHARE } from '../../src/components/recovery/progressWeek.mjs';
import { gapLine, heroFigures, ladderRows, ordinal } from '../../src/app/(app)/leaderboard/standingModel.mjs';
import { repairBar } from '../../src/components/review/repairBar.mjs';
import { covers, coversLine, linePrice, COVER_THINGS } from '../../src/app/(app)/wallet/walletCovers.mjs';
import { buildRibbon, buildWeek } from '../../src/lib/rhythmView.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

// ---------- Progress ----------
const rhythm = {
  weekStart: '2026-11-16', studyDays: 2, daysGoal: 4, metThisWeek: false, studyDayDates: ['2026-11-17', '2026-11-18'],
  history: [
    { weekStart: '2026-11-09', studyDays: 4, goal: 4, met: true },
    { weekStart: '2026-11-02', studyDays: 0, goal: 4, met: false, paused: true },
    { weekStart: '2026-10-26', studyDays: 2, goal: 4, met: false },
  ],
};

test('this week: counted days are filled bubbles, today is ringed, days ahead are faint; the bubbles agree with the count', () => {
  const marks = weekMarks(buildWeek(rhythm, '2026-11-18'));
  assert.equal(marks.length, 7);
  assert.deepEqual(marks.map((m) => m.look), ['none', 'done', 'done', 'none', 'none', 'none', 'none']);
  assert.equal(marks[2].today, true);
  assert.equal(marks[2].name, 'Today');
  assert.deepEqual(marks.map((m) => m.ahead), [false, false, false, true, true, true, true]);
  assert.equal(marks.filter((m) => m.look === 'done').length, rhythm.studyDays, 'never more ticks than counted study days');
  const notYet = weekMarks(buildWeek({ ...rhythm, studyDays: 0, studyDayDates: [] }, '2026-11-18'));
  assert.equal(notYet[2].look, 'today');
});

test('this week: the streak adds only a rest pass or a pause day, never a tick', () => {
  const streak = { week: [{ day: '2026-11-16', state: 'rested' }, { day: '2026-11-17', state: 'practised' }, { day: '2026-11-19', state: 'paused' }, { day: '2026-11-15', state: 'made_up' }] };
  const marks = weekMarks(buildWeek(rhythm, '2026-11-19'), streak);
  assert.equal(marks[0].look, 'rested');
  assert.match(marks[0].said, /rest pass/);
  assert.equal(marks[1].look, 'done', 'a counted day stays counted');
  assert.equal(marks[3].look, 'paused');
  assert.equal(weekMarks(buildWeek(rhythm, '2026-11-19'), { week: [], today: { paused: true } })[3].look, 'paused', 'today paused for exams');
  assert.deepEqual(weekMarks(null), []);
});

test('the goal line is the existing figure, split for size', () => {
  assert.deepEqual(weekGoal(rhythm), { figure: '2 of 4', words: 'study days this week', met: false });
  assert.equal(weekGoal({ ...rhythm, daysGoal: 1, studyDays: 1, metThisWeek: true }).words, 'study day this week');
  assert.equal(weekGoal(null), null);
});

test('finished weeks: one mark each, oldest first, this week left out; met, paused and missed as shapes with words', () => {
  const { title, marks } = finishedWeeks(buildRibbon(rhythm));
  assert.equal(title, 'Goal met in 1 of your 3 finished weeks');
  assert.deepEqual(marks.map((m) => m.kind), ['missed', 'paused', 'met']);
  assert.equal(marks[0].days, 2);
  assert.match(marks[2].words, /goal met/);
  assert.match(marks[1].words, /paused/);
  const first = finishedWeeks(buildRibbon({ ...rhythm, history: [] }));
  assert.equal(first.title, 'Your first week');
  assert.deepEqual(first.marks, []);
});

test('the record: four figures with what each is out of; no percentage from fewer than five answers; none is not zero', () => {
  assert.equal(MIN_ANSWERS_FOR_SHARE, 5);
  const full = recordFigures({ sessions: 2, answered: 20, correct: 12, checks: 0, playbook: 1 });
  assert.deepEqual(full.map((f) => f.label), ['Practice sessions', 'Answered right', 'Concept checks', 'Playbook entries']);
  assert.equal(full[1].value, '60%');
  assert.equal(full[1].note, '12 of 20 answers');
  assert.equal(full[1].share, 0.6);
  const few = recordFigures({ sessions: 1, answered: 4, correct: 3 });
  assert.equal(few[1].value, '3 of 4');
  assert.equal(few[1].share, undefined, 'no bar from four answers');
  assert.doesNotMatch(few[1].value, /%/);
  assert.equal(recordFigures({ sessions: 1, answered: 5, correct: 5 })[1].value, '100%');
  const none = recordFigures({});
  assert.equal(none[1].value, 'None yet');
  assert.equal(none[2].note, 'None completed yet');
});

// ---------- Your standing ----------
const ten = Array.from({ length: 10 }, (_, i) => ({ place: i + 1, points: 1400 - i * 25, mocks: 16 - (i % 3) }));
const below = { rank: 63, of: 213, tests: 12, average: 62, points: 744, toNext: 14, top: 30, ladder: ten };

test('the ladder: ten places, a gap row with the places between, then your row with the points to the place above', () => {
  const rows = ladderRows(below);
  assert.equal(rows.length, 12);
  assert.deepEqual(rows[10], { kind: 'gap', places: 52, text: '52 more places' });
  assert.equal(rows[11].you, true);
  assert.equal(rows[11].place, 63);
  assert.equal(rows[11].gap, '14 points to 62nd');
  assert.equal(rows[0].share, 1, 'one scale: the largest total shown is the full bar');
  assert.ok(Math.abs(rows[11].share - 744 / 1400) < 1e-9);
  assert.equal(rows.filter((r) => r.you).length, 1);
  assert.equal(gapLine({ rank: 2, toNext: 1 }), '1 point to 1st');
  assert.equal(ordinal(112), '112th');
});

test('the ladder: rank inside the ten marks that row, with no gap row; rank 11 has no gap row either', () => {
  const inside = ladderRows({ ...below, rank: 4, points: ten[3].points, toNext: 25 });
  assert.equal(inside.length, 10);
  assert.equal(inside.findIndex((r) => r.you), 3);
  assert.equal(inside[3].gap, '25 points to 3rd');
  const first = ladderRows({ ...below, rank: 1, points: ten[0].points, toNext: 0 });
  assert.equal(first[0].you, true);
  assert.equal(first[0].gap, null, 'first place has no place above');
  const eleventh = ladderRows({ ...below, rank: 11, points: 1100, toNext: 75 });
  assert.equal(eleventh.length, 11);
  assert.equal(eleventh.some((r) => r.kind === 'gap'), false);
});

test('the ladder: a small board (one student, or under 20) has none, and the hero carries every figure once', () => {
  const one = { rank: 1, of: 1, tests: 3, average: 70, points: 210, toNext: 0, top: null, ladder: null };
  assert.equal(ladderRows(one), null);
  const h = heroFigures(one, null);
  assert.deepEqual(h.figs.map((f) => f.key), ['mocks', 'average', 'points']);
  assert.equal(h.next, 'first');
  const small = { ...one, rank: 3, of: 6, toNext: 20 };
  assert.equal(heroFigures(small, null).next, 'gap');
  const rows = ladderRows(below);
  const onLadder = heroFigures(below, rows);
  assert.deepEqual(onLadder.figs.map((f) => f.key), ['average'], 'points and mocks are on your row, not said twice');
  assert.equal(onLadder.next, null, 'the gap is written on your row');
  assert.equal(ladderRows({ ...below, points: null }).some((r) => r.you), false, 'unknown points: no made-up row');
});

// ---------- Your papers ----------
test('the repair bar: the two ends of one line, its share, and no bar when nothing was found', () => {
  const bar = repairBar({ toRepair: 21, repaired: 9, toRepairNote: 'across 10 chapters', repairedNote: '6 held, 1 slipped, 2 waiting to be checked' });
  assert.deepEqual([bar.open, bar.repaired, bar.total], [21, 9, 30]);
  assert.equal(bar.share, 0.3);
  assert.equal(bar.openNote, 'across 10 chapters');
  const all = repairBar({ toRepair: 0, repaired: 4, toRepairNote: 'Every mistake is repaired', repairedNote: '4 held' });
  assert.equal(all.share, 1);
  const none = repairBar({ toRepair: 0, repaired: 0, toRepairNote: 'No mistakes yet', repairedNote: 'None yet' });
  assert.equal(none.total, 0);
  assert.equal(none.repairedNote, '', 'no "None yet" beside a missing bar');
  assert.equal(repairBar(null).total, 0);
});

// ---------- Wallet ----------
test('what the balance covers: floor of balance over price; hidden for Included, a price of 0 or an unknown balance', () => {
  assert.equal(covers(108, 1), 108);
  assert.equal(covers(108, 50), 2);
  assert.equal(covers(49, 50), 0);
  assert.equal(covers(0, 1), 0, 'a known zero balance covers 0');
  assert.equal(covers(null, 1), null);
  assert.equal(covers(undefined, 1), null);
  assert.equal(covers(108, 0), null);
  assert.equal(covers(108, null), null);
  assert.equal(coversLine('reply', 108, 1), 'covers 108 written answers');
  assert.equal(coversLine('mock', 108, 50), 'covers 2 full mocks');
  assert.equal(coversLine('mock', 60, 50), 'covers 1 full mock');
  assert.equal(coversLine('question', 0, 1), 'covers 0 practice questions');
  assert.equal(coversLine('question', null, 1), null);
  const prices = { reply: 1, repair: 1, question: 1, fullMock: 50 };
  assert.equal(linePrice('question', prices, true), null, 'Pro practice is Included: no count');
  assert.equal(linePrice('mock', prices, false), 50);
  assert.deepEqual(Object.keys(COVER_THINGS), ['reply', 'repair', 'question', 'mock']);
});

// ---------- The pages use the models ----------
test('the four pages read their figures from the models, and keep every control', () => {
  const lb = read('src/app/(app)/leaderboard/LeaderboardPageClient.jsx');
  assert.match(lb, /ladderRows\(standing\)/);
  assert.match(lb, /<details className="lb-how">/);
  assert.match(lb, /className="lb-go" data-page-primary=""/);
  assert.doesNotMatch(lb, /lb-pace/, 'the pace bar repeated two figures; the ladder row carries them');
  const rv = read('src/components/review/ReviewChapters.jsx');
  assert.match(rv, /repairBar\(stats\)/);
  assert.doesNotMatch(rv, /rv8-repair-queue/);
  const wl = read('src/app/(app)/wallet/WalletPageClient.jsx');
  assert.match(wl, /coversLine\(row\.key, split\.total, linePrice\(row\.key, PRICES, isPro\)\)/);
  const rc = read('src/components/RhythmCard.jsx');
  assert.match(rc, /weekMarks\(week, streakBody\)/);
  assert.match(rc, /onClick=\{\(\) => openStreakSheet\(\)\}/, 'the streak mark opens the streak sheet');
  assert.match(rc, /aria-pressed=\{picked === i\}/, 'a finished week says itself on tap');
  const ov = read('src/components/RecoveryOverview.jsx');
  assert.match(ov, /recordFigures\(\{ sessions: review\.length, answered, correct, checks: data\.progress\.length, playbook: data\.playbook\.length \}\)/);
});
