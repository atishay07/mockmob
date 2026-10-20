// The Mob's ways to play on the website (owner D167, 20 Oct; D168/D169: no new screens).
//   Sprint             5 questions, raced question by question (the existing game)
//   Your own round     10, 15 or 20 questions (the existing game)
//   Timed race         5 or 10 minutes, as many questions as you can; friends' runs race your pace as ghosts
//   Full mock together the full paper (50 questions, 60 minutes); the whole Mob sits it within 24 hours, then compares
//                      full mark sheets
// Live or anytime is one choice in the same "Start a game" sheet. A race reuses the run, the podium and the moments; a
// full mock reuses the full-mock runner (/test, mode full) and the result's mark-sheet reveal, and lines the sheets up on
// the podium. Pure: the components only draw. The server's contract is web/1020-mob-formats (fixtures in
// data/tests/fixtures/mob_v3): game.minutes (race 5|10, mock 60), a race serves one question at a time (/answer's
// `next`), the clock starts at /run, ghosts carry a variable number of arrivals, the mock is sat through
// /api/mob/paper/start { mob, game } and its podium carries `sheets`.
//
// Safety, as everywhere in the Mob: nothing here shows a right answer before the game closes, nothing names or counts a
// member who has not played, and a private member's sheet shows no numbers.
import { stopwatch, when } from './playModel.mjs';

export const RACE_MINUTES = Object.freeze([5, 10]);
export const MOCK = Object.freeze({ count: 50, minutes: 60, marks: 250 });
export const FORMATS = Object.freeze(['sprint', 'round', 'race', 'mock']);
// The race clock turns warm in its last half-minute (no pressure words; the colour only).
export const RACE_LOW_MS = 30_000;
// After an answer in a race, how long your option shows right or not before the next question rises.
export const RACE_FEEDBACK_MS = Object.freeze({ right: 520, wrong: 760, skip: 0 });

export const isRace = (g) => g?.format === 'race';
export const isMock = (g) => g?.format === 'mock';
export const raceMinutes = (g) => (RACE_MINUTES.includes(Number(g?.minutes)) ? Number(g.minutes) : 5);

/** The word for a game of this format: "Kabir's race", "Your full mock". */
export function formatWord(format) {
  if (format === 'race') return 'race';
  if (format === 'mock') return 'full mock';
  if (format === 'round') return 'round';
  if (format === 'rematch') return 'rematch';
  return 'sprint';
}

/**
 * The format tiles of the "Start a game" sheet from the server's `starts` block: which can be started, and which are
 * locked (with billing on, a free member sees the full mock with the Pro tag; nothing here decides a plan).
 */
export function formatTiles(starts) {
  const s = starts || {};
  const allowed = new Set(s.formats || []);
  const locked = new Set(s.locked || []);
  return FORMATS.map((format) => ({
    format,
    can: Boolean(s.can) && allowed.has(format) && !locked.has(format),
    locked: locked.has(format) || !s.can || !allowed.has(format),
    pro: Boolean(s.billingOn) && locked.has(format),
  }));
}

/** POST /api/mob/game's body for the sheet's choice. A full mock is always anytime; a rematch keeps its own shape. */
export function startBody({ format, count = 10, minutes = 5, mode = 'async', chapter = null, rematchOf = null, liveAllowed = false }) {
  if (rematchOf) return { format: 'rematch', mode: liveAllowed ? mode : 'async', count, chapter: chapter || null, rematchOf };
  if (format === 'mock') return { format: 'mock', mode: 'async' };
  const m = liveAllowed && mode === 'live' ? 'live' : 'async';
  if (format === 'race') return { format: 'race', minutes: RACE_MINUTES.includes(minutes) ? minutes : 5, mode: m, chapter: chapter || null };
  return { format: format === 'round' ? 'round' : 'sprint', mode: m, count: format === 'round' ? count : 5, chapter: chapter || null };
}

/**
 * The full-mock runner for a Mob's full mock: the existing /test runner in full mode, started on the Mob's route
 * (/api/mob/paper/start { mob, game }). The key names only this device's draft; the server derives its own.
 */
export function mockRunnerHref({ subject, mobId, gameId, memberId = 'me' }) {
  return `/test?${new URLSearchParams({
    subject: subject || '', mode: 'full', count: String(MOCK.count), mob: '1', mobId: mobId || '', game: gameId || '',
    generationKey: `mob-game-${gameId}-${memberId}`,
  })}`;
}

// ---------------------------------------------------------------------------------------------------
// The race
// ---------------------------------------------------------------------------------------------------

/** The race clock: what is left on the server clock, "m:ss", and whether it is in its last half-minute. */
export function raceClock(endsAtMs, serverNowMs) {
  const left = Math.max(0, (Number(endsAtMs) || 0) - (Number(serverNowMs) || 0));
  return { left, text: stopwatch(Math.ceil(left / 1000)), low: left > 0 && left <= RACE_LOW_MS, over: left <= 0 };
}

/** How many questions a ghost had answered `t` ms into its run. */
export function ghostCountAt(ghost, t) {
  const arrivals = (ghost?.arrivalsMs || []).filter(Number.isFinite);
  let n = 0;
  while (n < arrivals.length && arrivals[n] <= t) n += 1;
  return n;
}

/**
 * The race's pace chip: you against the ghost nearest you in questions answered at the same moment of the run.
 * "2 questions ahead of Riya", "1 question behind Kabir", "Level with Riya". Null before your first answer.
 */
export function racePace(answered, t, ghosts) {
  if (!(answered > 0) || !(ghosts || []).length) return null;
  let best = null;
  for (const g of ghosts) {
    const theirs = ghostCountAt(g, t);
    const d = answered - theirs;
    if (!best || Math.abs(d) < Math.abs(best.delta)) best = { name: g.name, delta: d };
  }
  if (!best) return null;
  if (best.delta === 0) return { ...best, text: `Level with ${best.name}` };
  const n = Math.abs(best.delta);
  const q = n === 1 ? '1 question' : `${n} questions`;
  return { ...best, text: best.delta > 0 ? `${q} ahead of ${best.name}` : `${q} behind ${best.name}` };
}

/**
 * How many numbers the race's ruler shows: at least 10, then in fives, always 2 past the furthest racer, never past
 * the pool. The ruler grows as the race does, so a 10-minute race never starts as 60 tiny cells.
 */
export function raceWindow(furthest, pool) {
  const cap = Math.max(1, Number(pool) || 30);
  const need = Math.max(10, Math.ceil(((Number(furthest) || 0) + 2) / 5) * 5);
  return Math.min(cap, need);
}

/** Which numbers on a race ruler of `n` carry a label: 1, every 5th, and the one you are on. */
export const raceLabelled = (k, n, here) => n <= 12 || k === 1 || k % 5 === 0 || k === here;

/**
 * The racers on a race's ruler: you plus every ghost, each over the question it is on (answered + 1), stopping at its
 * last answer once its time is up. Nobody reaches a flag: the clock ends a race, not a count. Two on one number stand
 * in depth exactly as in a sprint (spec 0.3 call 1).
 */
export function raceRacers({ ghosts, you, t, minutes, pool }) {
  const limit = (minutes || 5) * 60_000;
  const racers = [];
  for (const g of ghosts || []) {
    const n = ghostCountAt(g, Math.min(t, limit));
    const arrivals = (g.arrivalsMs || []).filter(Number.isFinite);
    const over = t >= limit || n >= (Number(pool) || Infinity);
    racers.push({ id: `g:${g.memberId}`, name: g.name, fold: g.fold, colour: g.colour ?? 0, ghost: true, you: false, at: over ? Math.max(1, n) : n + 1, finished: false, arrivedMs: n ? arrivals[n - 1] : 0 });
  }
  if (you) {
    const n = Number(you.answered) || 0;
    racers.push({ id: 'you', name: 'You', fold: you.fold, colour: you.colour ?? 0, ghost: false, you: true, at: you.finished ? Math.max(1, n) : n + 1, finished: false, arrivedMs: you.arrivedMs ?? 0 });
  }
  const furthest = racers.reduce((m, r) => Math.max(m, r.at), 0);
  const window = raceWindow(furthest, pool);
  for (const r of racers) r.at = Math.min(window, r.at);
  const groups = new Map();
  for (const r of racers) {
    if (!groups.has(r.at)) groups.set(r.at, []);
    groups.get(r.at).push(r);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.arrivedMs - b.arrivedMs || (a.you ? -1 : b.you ? 1 : 0));
    list.forEach((r, i) => {
      r.depth = i;
      r.lift = i * 10;
      r.scale = i === 0 ? 1 : 0.86;
      r.brightness = i === 0 ? 1 : 0.7;
      r.aside = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 30;
    });
  }
  return { racers, window };
}

// ---------------------------------------------------------------------------------------------------
// Words (the owner's voice: plain, warm, grammatical; no exclamation marks, arrows, emoji or hype)
// ---------------------------------------------------------------------------------------------------
const theirs = (g) => (!g?.host || g.host.you || (g.youId && g.host.memberId === g.youId) ? 'Your' : `${g.host.name}'s`);
const what = (g) => g?.chapter || g?.subjectName || 'your subject';

export const FORMAT_COPY = Object.freeze({
  // The sheet's tiles: what each way to play is, in a line.
  sprint: 'Sprint',
  sprintSub: '5 questions, raced question by question',
  round: 'Your own round',
  roundSub: '10, 15 or 20 questions',
  race: 'Timed race',
  raceSub: '5 or 10 minutes. As many as you can.',
  mock: 'Full mock together',
  mockSub: 'The full paper. Everyone sits it within 24 hours.',
  // The sheet's choices under the tiles.
  howLong: 'How long',
  minutes: (m) => `${m} minutes`,
  raceHow: 'Everyone gets the same clock. Friends who play later race your run as a ghost.',
  raceLiveHow: 'Live starts everyone on one 3, 2, 1, with the same clock. Anyone who misses it can race the runs for 24 hours.',
  mockHow: `Everyone sits the full paper, ${MOCK.count} questions in ${MOCK.minutes} minutes, any time in the next 24 hours. Then you compare full mark sheets.`,
  mockCovers: (subject) => `The whole of ${subject}, like the real paper`,
  startTheRace: 'Start the race',
  openTheMock: 'Open the full mock',
  proTag: 'Pro',

  // The game card and the den's rows.
  title: (g) => `${theirs(g)} ${formatWord(g?.format)}`,
  raceOpenLine: (g, now) => {
    const race = (g.runs || []).some((r) => r.finished !== false) ? 'Race the runs so far.' : 'Be the first to set a run.';
    return `${raceMinutes(g)} minutes on ${what(g)}. Answer as many as you can. ${race}${g.closesAt ? ` Open until ${when(g.closesAt, now)}.` : ''}`;
  },
  raceRow: (g, now) => `${raceMinutes(g)} minutes, as many as you can. Open until ${g.closesAt ? when(g.closesAt, now) : 'tomorrow'}.`,
  raceLiveLine: (g) => `A ${raceMinutes(g)}-minute race on ${what(g)}. As many as you can.`,
  raceRule: (m) => `${m} minutes on the clock. +5 if right, -1 if wrong, 0 if you skip.`,
  mockOpenLine: (g, now) => `${MOCK.count} ${g.subjectName || ''} questions in ${MOCK.minutes} minutes, like the real paper.${g.closesAt ? ` Sit it by ${when(g.closesAt, now)}, then compare mark sheets.` : ''}`.replace(/\s+/g, ' '),
  mockRow: (g, now) => `${MOCK.count} questions, ${MOCK.minutes} minutes. Open until ${g.closesAt ? when(g.closesAt, now) : 'tomorrow'}.`,
  mockRule: 'The real paper: +5 if right, -1 if wrong, 0 if you skip. The answers open for everyone when it closes.',
  playRace: (g) => `Play ${theirs(g) === 'Your' ? 'your' : theirs(g)} race`,
  sitMock: 'Sit the full mock',
  carryOn: 'Carry on with your paper',
  satMock: 'You sat the full mock.',
  seeSheets: 'See the mark sheets',
  seeSheetsSoFar: 'See the mark sheets so far',
  sheetsTitle: 'Mark sheets',
  sheetsWait: (closes, now) => `The answers open for everyone at ${when(closes, now)}.`,
  mockSubHead: `Full mock, ${MOCK.count} questions in ${MOCK.minutes} minutes`,
  ofMarks: (of) => `of ${of}`,
  yourResult: 'Your result',
  resultRowTitle: "Your Mob's full mock",
  resultRowLine: 'Your mark sheet sits beside your friends' on the podium. Places can change until the paper closes.',
  /** Finished sittings only, names and times (F2): nobody who has not sat it is named or counted. Null with none. */
  satSoFar: (runs, now) => {
    const done = (runs || []).filter((r) => r.finished !== false);
    if (!done.length) return null;
    return `Sat so far: ${done.map((r) => (r.at ? `${r.name}, ${when(r.at, now)}.` : `${r.name}.`)).join(' ')}`;
  },

  // The race run.
  getSet: 'Get set',
  questionN: (n) => `Question ${n}`,
  timeLeft: (mmss) => `Time left, ${mmss}`,
  raceDone: (n, m) => (n === 0 ? `No answers in ${m} minutes.` : n === 1 ? `You answered 1 question in ${m} minutes.` : `You answered ${n} in ${m} minutes.`),
  raceAll: (n) => `You answered all ${n}.`,
  raceTime: 'Time.',
  raceCounts: ({ right = 0, wrong = 0, skipped = 0 } = {}) => `${right} right, ${wrong} wrong, ${skipped} skipped.`,
  answeredOf: (n) => (n === 1 ? '1 answered' : `${n} answered`),
  rightShort: 'Right, plus 5.',
  wrongShort: 'Not this one, minus 1.',

  // The mark sheet on the podium.
  outOf: (marks, of) => `${marks} of ${of}`,
  sheetLine: (s) => `${s.right} right, ${s.wrong} wrong, ${s.skipped} skipped`,
  accuracy: (a) => `${a}% accuracy`,
  took: (ms) => {
    const min = Math.max(1, Math.round((Number(ms) || 0) / 60_000));
    return min === 1 ? 'in 1 minute' : `in ${min} minutes`;
  },
  privateSheet: 'Keeps marks private',
  sectionsLabel: (name) => `${name}, by section`,
});
