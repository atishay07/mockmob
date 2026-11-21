// The Benchmarks row story of the home page's one-place frame (owner LK365, 21 Nov 2026: the old row's animation "is extremely
// lackluster"; show the feature working, not a paragraph). Pure data, node-testable (data/tests/story_rival_1121.test.mjs).
// RivalStory.jsx draws the screens; this file holds the script and every figure the screens print.
//
// Where each rule comes from (nothing here is invented; sample marks obey these rules):
//   * The three levels, their target accuracy, seconds a question, credit cost and score multiplier:
//     src/services/ai-rival/rivalProfiles.js (RIVAL_PROFILES: NORTH_CAMPUS_RIVAL is the Daily Benchmark, HANSRAJ_LEVEL the
//     College Benchmark, SRCC_DREAM the DU Target Benchmark).
//   * Questions: the lobby's default count, 10 (src/components/ai/AIRivalArena.jsx, useState(10)).
//   * The time limit: max(5, round(count x seconds a question / 60) + 2) minutes (createAIRivalBattle.js).
//   * The score: round(right x 10 x multiplier); accuracy = right over answered; equal scores go to the faster total time
//     (scoreRivalBattle.js). The result's words: its title (AIRivalArena.jsx ResultScreen) and its rank title (titleFor).
//   * The daily benchmark is free once a day on the free plan (src/services/usage/getDailyUsage.js LIMITS.free
//     basicRivalBattles: 1), and the tour slide says so (homeCopy.mjs buildTour, id rival, its first point).
//   * The standing: the sum of every mock's points, all time (src/lib/server/standing.js, supabase mm_leaderboard); a mock's
//     points are max(0, round((5 x right - wrong) / (5 x questions) x 100)) (data/recovery.js scoreSession). A benchmark run
//     is not a mock and adds nothing to it, so the last beat says what does: a finished mock.
//   * The sample standing (63rd, 744 points over 12 mocks, 14 points to the place above, 213 students) is the ranks fixture's
//     own (src/app/preview/arena/ArenaPreviewClient.jsx, /api/leaderboard).
import { RIVAL_PROFILES } from '../../../services/ai-rival/rivalProfiles.js';
import { buildTour } from '../homeCopy.mjs';

const SLIDE = buildTour().find((s) => s.id === 'rival');

export const QUESTIONS = 10;
export const FREE_DAILY_RUNS = 1; // getDailyUsage.js LIMITS.free.basicRivalBattles
export const SUBJECT = 'Economics'; // a sample subject, one of the 15 the bank covers

// The ladder, highest first, as the tour slide names it: "daily, college or DU level".
const LEVEL_KEYS = Object.freeze([['du', 'SRCC_DREAM', 'DU level'], ['college', 'HANSRAJ_LEVEL', 'College level'], ['daily', 'NORTH_CAMPUS_RIVAL', 'Daily']]);
export const timeLimitMinutes = (count, perQuestion) => Math.max(5, Math.round((count * perQuestion) / 60) + 2);
export const creditWords = (n) => `${n} ${n === 1 ? 'credit' : 'credits'}`; // creditCopy.mjs creditCount

export const LEVELS = Object.freeze(LEVEL_KEYS.map(([id, key, short]) => {
  const p = RIVAL_PROFILES[key];
  return Object.freeze({
    id, key, short, name: p.name,
    accuracy: Math.round(p.targetAccuracy * 100),
    perQuestion: p.avgTimePerQuestion,
    multiplier: p.difficultyMultiplier,
    free: p.freeAllowed,
    access: p.creditCost > 0 ? creditWords(p.creditCost) : p.freeAllowed ? 'Free today' : 'With Pro',
    minutes: timeLimitMinutes(QUESTIONS, p.avgTimePerQuestion),
  });
}));
export const DEFAULT_LEVEL = 'daily'; // the lobby's default pick, "recommended today"
export const STORY_LEVEL = 'du'; // the level the cursor picks
export const levelOf = (id) => LEVELS.find((l) => l.id === id) ?? LEVELS.find((l) => l.id === DEFAULT_LEVEL);

// Your sample run: 10 questions, 8 right (Q3 and Q7 wrong), 9 minutes in all.
export const YOU_RIGHT = Object.freeze([true, true, false, true, true, true, false, true, true, true]);
export const YOU_SECONDS = Object.freeze([48, 62, 51, 57, 44, 66, 49, 58, 52, 53]);
// The target's run: its accuracy of the 10 rounded to whole answers, at its own seconds a question (a spread around the
// average that sums to it, as the simulated benchmark's times spread around it).
const SPREAD = [-3, 4, -7, 2, -1, 7, -4, 1, -2, 3];
const MISS_ORDER = [4, 8, 1, 6];

const sum = (a) => a.reduce((s, n) => s + n, 0);
export const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.max(0, sec) % 60).padStart(2, '0')}`;
export const score = (right, multiplier) => Math.round(right * 10 * multiplier);
export const mockPoints = ({ right, wrong, total }) => Math.max(0, Math.round(((5 * right - wrong) / (total * 5)) * 100));

/** The whole run against one level: both lanes, both scores, the result as the real result screen words it. */
export function runFor(levelId) {
  const level = levelOf(levelId);
  const targetRightCount = Math.round((level.accuracy / 100) * QUESTIONS);
  const misses = new Set(MISS_ORDER.slice(0, QUESTIONS - targetRightCount));
  const target = {
    right: Array.from({ length: QUESTIONS }, (_, i) => !misses.has(i)),
    seconds: SPREAD.map((d) => level.perQuestion + d),
  };
  const youRight = YOU_RIGHT.filter(Boolean).length;
  const youTime = sum(YOU_SECONDS);
  const targetTime = sum(target.seconds);
  const you = { right: youRight, answered: QUESTIONS, accuracy: Math.round((youRight / QUESTIONS) * 100), seconds: youTime, pace: Math.round(youTime / QUESTIONS), score: score(youRight, level.multiplier) };
  const them = { right: targetRightCount, accuracy: Math.round((targetRightCount / QUESTIONS) * 100), seconds: targetTime, pace: Math.round(targetTime / QUESTIONS), score: score(targetRightCount, level.multiplier) };
  const result = you.score > them.score ? 'win' : you.score < them.score ? 'loss' : you.seconds < them.seconds ? 'win' : you.seconds > them.seconds ? 'loss' : 'tie';
  const title = result === 'win' ? 'You cleared the benchmark.' : result === 'tie' ? 'You tied the benchmark.' : 'The benchmark found a gap.';
  const rank = result === 'win' ? (you.accuracy >= 85 ? 'Clean victory' : 'Victory') : result === 'tie' ? 'Dead heat' : you.accuracy >= 60 ? 'Close miss' : 'Ground to gain';
  const short = them.right - you.right;
  let gap;
  if (result === 'win') gap = `You held ${you.accuracy}% at ${you.pace} s a question. Its pace is ${them.pace} s.`;
  else if (short > 0) gap = `${short === 1 ? 'One more right answer' : `${short} more right answers`} ties it at ${them.score}. Then pace decides: ${you.pace} s a question against ${them.pace} s.`;
  else gap = `Same score, so pace decides: ${you.pace} s a question against ${them.pace} s.`;
  // The gap in a few words, for a narrow screen, where the bars say the rest (critic round, 21 Nov 2026 evening).
  const gapShort = result === 'win' ? 'You beat the target.' : short > 0 ? `${short === 1 ? 'One more right' : `${short} more right`} ties it.` : 'Same score. Pace decides.';
  // The clock: the time limit, stepping down by your seconds on each answer.
  const limit = level.minutes * 60;
  let used = 0;
  const ticks = [clock(limit), ...YOU_SECONDS.map((s) => { used += s; return clock(limit - used); })];
  return { level, target, you, them, result, title, rank, gap, gapShort, limit, ticks, youRight: YOU_RIGHT, youSeconds: YOU_SECONDS };
}

// The run plays fast: one second of the demo stands for SCALE seconds of the run.
// 216 (critic round, 21 Nov 2026 evening): the run's 9 minutes play in 2.5 s, so the row keeps to 13 s of script.
export const SCALE = 216;
/** When each answer lands, in ms after Start, for a lane's seconds. */
export const landings = (seconds) => { let t = 0; return seconds.map((s) => { t += s; return Math.round((t / SCALE) * 1000); }); };
export const RUN_MS = Math.max(...landings(YOU_SECONDS)) + 200;

// The standing: the ranks fixture's student, then one more finished mock (a full 50-question paper, 38 right, 10 wrong).
export const MOCK = Object.freeze({ subject: SUBJECT, right: 38, wrong: 10, total: 50 });
export const MOCK_MARKS = 5 * MOCK.right - MOCK.wrong; // 180 of 250
export const MOCK_POINTS = mockPoints(MOCK); // 72
export const STANDING = Object.freeze({
  students: 213,
  above: Object.freeze({ place: 61, points: 822, mocks: 15 }),
  next: Object.freeze({ place: 62, points: 758, mocks: 13 }),
  you: Object.freeze({ place: 63, points: 744, mocks: 12 }),
});
export const STANDING_AFTER = Object.freeze({
  you: Object.freeze({ place: STANDING.next.place, points: STANDING.you.points + MOCK_POINTS, mocks: STANDING.you.mocks + 1 }),
  next: Object.freeze({ place: STANDING.you.place }),
});
export const ordinal = (n) => { const r = n % 100; if (r >= 11 && r <= 13) return `${n}th`; return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th'}`; };
export const pointsTo = (gap) => `${gap} ${gap === 1 ? 'point' : 'points'} to the next place up`;
export const FREE_LINE = `${SLIDE.points[0]} every day.`; // "The daily benchmark is free every day."
export const CLIMB_MS = 700; // the mock's points land this long after the standing opens

// ------------------------------------------------------------------ the script (CursorDemo steps)
const hook = (name) => `[data-demo="rival-${name}"]`;
export const RIVAL_STORY = Object.freeze({
  id: 'rival',
  title: SLIDE.title,
  steps: Object.freeze([
    // 1. The ladder; the cursor picks DU level, and the target line shows its target.
    { say: 'Pick the level you are aiming for.', focus: '.st-rival__ladder', wait: 650 },
    { target: hook(`level-${STORY_LEVEL}`), move: 650, click: true, dwell: 300 },
    { focus: '.st-rival__target', wait: 750 },
    // 2. Start: the clock steps down, the two lanes fill, answers tick right and wrong.
    { say: 'Race that target on the clock.', focus: '.st-rival__go', wait: 500 },
    { target: hook('start'), move: 560, click: true, dwell: 150 },
    // `exact`: the run ends on the screen's own clock (RUN_MS after Start); Submit wakes only then.
    { focus: '.st-rival__race', wait: RUN_MS + 50, exact: true },
    // 3. Submit: the result. The why is a picture (critic round, 21 Nov 2026 evening): accuracy and pace as paired bars that
    // grow side by side, the gap on yours marked in the volt, and the gap in a few words under them.
    { say: 'See how far off you were, and why.', focus: '.st-rival__submit-row', wait: 500 },
    { target: hook('submit'), move: 520, click: true, dwell: 600 },
    { focus: '.st-rival__compare', wait: 1200 },
    // 4. The standing: a finished mock's points land and your row moves up one place.
    { say: 'Every mock you finish adds to your standing.', focus: '.st-rival__tabs', wait: 500 },
    { target: hook('standing'), move: 560, click: true, dwell: CLIMB_MS },
    { focus: '.st-rival__ladder-you', wait: 1100 },
  ].map((s) => Object.freeze(s))),
});
