// Mob v3 on the web, part 2: playing a game (MOB-BUILD-SPEC-V3 5.3 R1 to R9, 5.6 M4 to M7).
// Pure: the words, the times, the ruler, the pace chip and the podium's reveal. The components only draw.
//
// Every sentence is the app's own (flutter_app/lib/features/social/v3/copy_v3.dart), in the owner's voice:
// plain and warm, no exclamation marks, no arrows, the 12-hour clock in IST, no price and nobody's plan.
// Safety (spec 6): nothing here names or counts a member who has not played, nothing shows a right answer
// before the game closes, and the trap is "most of you", never a count.
import { ghostPace } from '../../../../lib/mob/games.mjs';

export { ghostPace };

export const LETTERS = ['A', 'B', 'C', 'D', 'E'];
export const FOLD_PAPER = Object.freeze({
  dart: '#5FBEF2', dogear: '#FF8FA0', hexa: '#5562D9', kandil: '#F4B04A', hop: '#33BFA0', crane: '#B98CF5',
  stamp: '#EFE6D2', naav: '#E3DCCB', tally: '#F2A07E', patang: '#E2404A', sticky: '#9BAF8E', cutting: '#B9814F',
});
export const FOLD_CREASES = Object.freeze({ dart: 1, dogear: 1, hexa: 1, kandil: 1, hop: 3, crane: 3, stamp: 3, naav: 2, tally: 2, patang: 2, sticky: 2, cutting: 2 });
export const FOLD_NAMES = Object.freeze({
  dart: 'Dart', dogear: 'Dog-ear', hexa: 'Hexa', kandil: 'Kandil', hop: 'Hop', crane: 'Crane', stamp: 'Stamp',
  naav: 'Naav', tally: 'Tally', patang: 'Patang', sticky: 'Sticky', cutting: 'Cutting',
});
export const isFoldKey = (k) => typeof k === 'string' && Object.hasOwn(FOLD_PAPER, k);
// Poses shipped on the web (public/mob/folds). Shrug and wave are not drawn yet; "not this one" uses think.
export const FOLD_POSES = Object.freeze(['idle', 'cheer', 'think']);
export const foldSrc = (key, pose = 'idle') => (isFoldKey(key) ? `/mob/folds/fold-${key}-${FOLD_POSES.includes(pose) ? pose : pose === 'shrug' ? 'think' : 'idle'}.webp` : null);
export const foldHeadSrc = (key) => (isFoldKey(key) ? `/mob/folds/fold-${key}-head.webp` : null);

// ---------------------------------------------------------------------------------------------------
// Time, always IST, 12-hour
// ---------------------------------------------------------------------------------------------------
const IST_MS = 330 * 60_000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ms = (at) => (at instanceof Date ? at.getTime() : typeof at === 'number' ? at : Date.parse(at));
const ist = (at) => new Date(ms(at) + IST_MS);

/** "2:05 PM". */
export function clock(at) {
  const t = ist(at);
  if (Number.isNaN(t.getTime())) return '';
  const h = t.getUTCHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(t.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "Wednesday 28 Oct". */
export function day(at) {
  const t = ist(at);
  if (Number.isNaN(t.getTime())) return '';
  return `${WEEKDAYS[t.getUTCDay()]} ${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}`;
}

/** "2:05 PM tomorrow", "8:44 PM" (today), "2:05 PM yesterday", else "2:05 PM on Saturday 24 Oct". */
export function when(at, now) {
  const a = ist(at);
  const n = ist(now);
  if (Number.isNaN(a.getTime())) return '';
  const da = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const dn = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  const diff = Math.round((da - dn) / 86_400_000);
  const c = clock(at);
  if (diff === 0) return c;
  if (diff === 1) return `${c} tomorrow`;
  if (diff === -1) return `${c} yesterday`;
  return `${c} on ${day(at)}`;
}

/** "m:ss" for the stopwatch chip. */
export function stopwatch(seconds) {
  const s = Math.min(99 * 60 + 59, Math.max(0, Math.floor(Number(seconds) || 0)));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------------------------------
// Words (copy_v3.dart, R1 to R9)
// ---------------------------------------------------------------------------------------------------
export function joinNames(names) {
  const list = (names || []).filter(Boolean);
  if (list.length <= 1) return list[0] || '';
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}
export const ordinal = (n) => ({ 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth' }[n] || String(n));
const kindWord = (format) => (format === 'round' ? 'round' : format === 'rematch' ? 'rematch' : 'sprint');

export const COPY = Object.freeze({
  // R1
  runsToRace: (n) => (n === 0 ? 'Set the first run' : n === 1 ? '1 run to race' : `${n} runs to race`),
  rulerCaption: 'Where everyone is. Never what they picked.',
  questionOf: (i, n) => `Question ${i} of ${n}`,
  marksRule: '+5 if right, -1 if wrong',
  skip: 'Skip',
  lockIn: (letter) => `Lock in ${letter}`,
  pickAnAnswer: 'Pick an answer',
  saving: 'Saving your answer',
  right: 'Right.',
  rightThree: 'Right. Three in a row.',
  rightLine: '+5 marks. Your Mob only sees that you moved on.',
  notThisOne: 'Not this one.',
  wrongLine: (closes, now) => `-1 mark. The right answer and why open for everyone when the game closes at ${when(closes, now)}.`,
  skippedLine: 'Skipped. No marks either way.',
  nextQuestion: 'Next question',
  seeHowYouDid: 'See how you did',
  friendFinished: (name) => `${name} finished. Take your time.`,
  ghostFinished: (name) => `${name}'s run reached the flag. Take your time.`,
  playedAll: (n) => `You played all ${n}.`,
  marks: (m) => (m === 1 || m === -1 ? `${m} mark` : `${m} marks`),
  marksWord: (m) => (m === 1 || m === -1 ? 'mark' : 'marks'),
  leaveRun: 'Leave this run?',
  leaveRunLine: 'Your answers so far are saved. You can come back until your time runs out.',
  keepPlaying: 'Keep playing',
  leave: 'Leave',
  countdownNextN: (n) => `Question 1 of ${n} is next. +5 if right, -1 if wrong, 0 if you skip.`,
  threeInARow: '3 in a row',
  delta: (d) => (d > 0 ? `+${d}` : `${d}`),
  runLoading: 'Getting the questions ready',
  closeRun: 'Leave this run',
  back: 'Back',
  runClock: (mmss) => `Time on this run, ${mmss}`,
  optionLabel: (letter, text) => `Option ${letter}, ${text}`,
  optionRight: 'right, plus 5',
  optionWrong: 'not this one, minus 1',
  rulerLabel: 'Where everyone is on the ruler',
  rulerAt: (name, q, n) => `${name} is on question ${q} of ${n}`,
  rulerDone: (name) => `${name} reached the flag`,
  // The game card before a run (D2 and D4, and P2's line for anytime games).
  gameTitle: (game) => (game?.title ? game.title : !game?.host || game.host.you ? `Your ${kindWord(game?.format)}` : `${game.host.name}'s ${kindWord(game.format)}`),
  playKey: (game) => (!game?.host || game.host.you ? `Play your ${kindWord(game?.format)}` : `Play ${game.host.name}'s ${kindWord(game.format)}`),
  openLine: (game, now) => {
    const what = game.chapter ? `${game.count} ${game.chapter} questions` : `${game.count} ${game.subjectName} questions`;
    const race = (game.runs || []).some((r) => r.finished !== false) ? 'Race the runs so far.' : 'Be the first to set a run.';
    return `${what}. ${race}${game.closesAt ? ` Open until ${when(game.closesAt, now)}.` : ''}`;
  },
  runsSoFar: (runs, now) => {
    const done = (runs || []).filter((r) => r.finished !== false);
    if (!done.length) return null;
    return `Runs so far: ${done.map((r) => (r.at ? `${r.name}, ${when(r.at, now)}.` : `${r.name}.`)).join(' ')}`;
  },
  anytimeLine: 'Everyone gets the same questions for 24 hours and races the runs before them.',
  roomStarted: (startedAt, closes, now) => `The room started at ${clock(startedAt)}. You can still play it until ${when(closes, now)}.`,
  playItNow: 'Play it now',
  playedAt: (at, closes, now) => `You played at ${when(at, now)}. Places can change until ${when(closes, now)}.`,
  seePodium: 'See the podium',
  seePodiumSoFar: 'See the podium so far',
  backToDen: 'Back to the den',
  // R7
  soFar: 'So far',
  finalLabel: 'Final',
  onTopSoFar: (name) => (name === 'You' ? "You're on top so far" : `${name} is on top so far`),
  cameFirst: (name) => (name === 'You' ? 'You came first' : `${name} came first`),
  sharedTop: (names, soFar) => (soFar ? `${joinNames(names)} share the top so far` : `${joinNames(names)} came first together`),
  placesCanChange: (closes, now) => `Places can change until ${when(closes, now)}.`,
  tieLine: (tie) => `${joinNames(tie.names)} tie on ${tie.marks}, so ${tie.names.includes('You') ? 'you' : 'they'} share ${ordinal(tie.place)}.`,
  together: (right, of) => `Your Mob got ${right} of ${of} right together.`,
  private: 'Private',
  everyonesMoment: "See everyone's moment",
  askRematch: 'Ask for a rematch',
  everyonesMarks: "Everyone's marks",
  onlyYouTitle: "You're the first to finish.",
  onlyYouLine: 'Places fill in as friends play.',
  skipShow: 'Skip',
  rematchAsked: 'You asked your Mob for a rematch.',
  placeOf: (p) => ({ 1: 'First place', 2: 'Second place', 3: 'Third place' }[p] || `Place ${p}`),
  // R8
  momentsTitle: "Everyone's moment",
  trapCardTitle: 'The question that caught most of you',
  trapCaught: (n) => `Question ${n} caught most of you.`,
  stepNow: '1. Now: See why, then one fresh question.',
  stepCheck: (opens) => `2. ${day(opens)}: One more checks the fix holds.`,
  trapProgress: (mob, n, of) => `${mob} has fixed ${n} of ${of} traps. Crane comes at ${of}.`,
  answersOpenAt: (closes, now) => `The answers open when the game closes at ${when(closes, now)}. Fix it together starts then.`,
  sendSticker: 'Send your Mob a sticker',
  fixTogether: (n) => `Fix question ${n} together`,
  stickerSent: 'Sent to your Mob.',
  // R9
  fixTitle: 'Fix it together',
  fixSub: (mob) => `${mob}, one trap`,
  question: (n) => `Question ${n}`,
  whyLooked: 'Why it looked right',
  pathNow: 'Now. One fresh question like it, only for you.',
  pathCheck: (opens) => `${day(opens)}. One more, to check the fix holds.`,
  fixShelf: 'When 2 of you pass on Wednesday, the trap counts as fixed. 3 fixed traps bring Crane to every shelf.',
  ofThree: (n, of) => `${n} of ${of}`,
  tryFresh: 'Try a fresh question',
  checkOpens: (opens) => `Your check opens on ${day(opens)}.`,
  fixRight: 'Right. That one is fixed for you.',
  fixWrong: 'Not this one. Here is why.',
  fixTogetherDone: 'Two of you passed the check, so this trap is fixed together.',
  yourPick: 'Your pick',
  rightAnswer: 'The right answer',
  freshTitle: 'One fresh question, only for you',
  checkTitle: 'The check: one more like it',
  takeCheck: 'Take the check',
  checkKey: 'Check my answer',
  bubbleLabel: (letter, yours, right) => `Option ${letter}${yours ? ', your pick' : ''}${right ? ', the right answer' : ''}`,
  // Loading and failure
  loadFailed: "Your game didn't load.",
  gameClosed: 'This game has closed. Its answers are open now.',
  fixNotYet: 'This opens when the game closes.',
  timeUp: 'Your time on this game ran out. Questions you did not answer count as skipped.',
  fixClosedNone: 'No question caught most of your Mob in this game, so there is no trap to fix.',
  tryAgain: 'Try again',
  generic: "That didn't go through. Try again.",
  offline: "You're offline. Nothing changed.",
  yourMob: 'Your Mob',
});

export const STICKERS = Object.freeze([
  { kind: 'nice_one', label: 'Nice one' },
  { kind: 'so_close', label: 'So close' },
  { kind: 'teach_me', label: 'Teach me' },
  { kind: 'again', label: 'Again?' },
]);

/** The moment sentence (spec 3.6 kinds, the server report's fields). Never about the trap question. */
export function momentSentence(m, count) {
  switch (m?.kind) {
    case 'all_right': return `All ${m.count ?? count} right.`;
    case 'fastest_right': return `Fastest right answer: question ${m.number ?? (Number.isInteger(m.q) ? m.q + 1 : 1)} in ${m.seconds ?? 0} seconds.`;
    case 'quickest_finish': return `Quickest finish: all ${m.count ?? count} in ${stopwatch(m.seconds ?? 0)}.`;
    case 'three_in_a_row': return `Three right in a row: questions ${m.from ?? 1} to ${m.to ?? 3}.`;
    case 'no_minus': return 'No minus marks.';
    default: return `Played all ${m?.count ?? count}.`;
  }
}

/** The server's sentence for a failure: its own message first, then offline, then a plain fallback. */
export function errorSentence(err) {
  if (err?.message && err?.code) return err.message;
  if (err?.offline) return COPY.offline;
  return COPY.generic;
}

// ---------------------------------------------------------------------------------------------------
// The run (R1 to R6)
// ---------------------------------------------------------------------------------------------------

/** The first question not yet answered, from the server's stored answers (a resumed run). */
export function nextQuestionIndex(answers, count) {
  const done = new Set((answers || []).map((a) => a.q));
  for (let i = 0; i < count; i += 1) if (!done.has(i)) return i;
  return count;
}

/** The streak of right answers ending at the latest answer (for "Right. Three in a row.", at exactly 3). */
export function rightStreak(answers) {
  let n = 0;
  const sorted = [...(answers || [])].sort((a, b) => (a.elapsedMs ?? 0) - (b.elapsedMs ?? 0));
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (sorted[i].correct === true) n += 1;
    else break;
  }
  return n;
}

/** The pace chip after your latest answer (R4): the ghost nearest you at your latest index. Null before the first answer. */
export function paceChip(answers, ghosts) {
  const list = answers || [];
  if (!list.length || !(ghosts || []).length) return null;
  const latest = list.reduce((a, b) => ((b.elapsedMs ?? 0) >= (a.elapsedMs ?? 0) ? b : a));
  return ghostPace(latest.elapsedMs ?? 0, list.length - 1, ghosts);
}

/** Where a ghost is at run time `t` (ms): the number it stands over (1 to count), and whether it reached the flag. */
export function ghostAt(ghost, t, count) {
  const arrivals = (ghost?.arrivalsMs || []).filter(Number.isFinite);
  const finishedMs = Number.isFinite(ghost?.finishedMs) ? ghost.finishedMs : arrivals[arrivals.length - 1];
  if (Number.isFinite(finishedMs) && t >= finishedMs && arrivals.length >= count) return { at: count, finished: true, arrivedMs: finishedMs };
  let done = 0;
  while (done < arrivals.length && arrivals[done] <= t) done += 1;
  return { at: Math.min(count, done + 1), finished: false, arrivedMs: done ? arrivals[done - 1] : 0 };
}

/**
 * The racers on the ruler: you plus every ghost, each with its number and its depth on a shared number
 * (spec 0.3 call 1): the later arrival stands 10 px up, at 0.86 and 70% brightness, behind and a little aside.
 */
export function rulerRacers({ count, ghosts, you, t }) {
  const racers = [];
  for (const g of ghosts || []) {
    const pos = ghostAt(g, t, count);
    racers.push({ id: `g:${g.memberId}`, name: g.name, fold: g.fold, colour: g.colour ?? 0, ghost: true, you: false, ...pos });
  }
  if (you) racers.push({ id: 'you', name: 'You', fold: you.fold, colour: you.colour ?? 0, ghost: false, you: true, at: Math.min(count, (you.answered || 0) + 1), finished: Boolean(you.finished), arrivedMs: you.arrivedMs ?? 0 });
  const groups = new Map();
  for (const r of racers) {
    const key = r.finished ? 'flag' : r.at;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
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
  return racers;
}

/** Name above a racer: initials when 5 race (Folds drop to 48 px). */
export const racerLabel = (name, compact) => (compact ? String(name || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() : name);

// ---------------------------------------------------------------------------------------------------
// The podium (R7, M7)
// ---------------------------------------------------------------------------------------------------
export const PLINTH_HEIGHT = Object.freeze({ 1: 132, 2: 96, 3: 72 });
// When each place's plinth unfolds (ms): third, then second, then first; shared places unfold together.
export const UNFOLD_AT = Object.freeze({ 3: 1000, 2: 1600, 1: 2200 });
export const COUNT_MS = 720;
export const LAND_MS = 420 + 220;
export const PODIUM_END_MS = 4800;

/**
 * Lay the podium out from the server's body. Entries keep the server's fields; the stage is ordered for the
 * eye (second, first, third: the first in the middle), the floor holds places over 3, and a Private member
 * (no marks) stands with the floor's table with no place.
 */
export function podiumLayout(podium, now) {
  const places = (podium?.places || []).map((p) => ({ ...p, shownName: p.you ? 'You' : p.name, private: !Number.isFinite(p.marks) }));
  const soFar = Boolean(podium?.soFar);
  const headline = podium?.headline;
  const together = headline && Number.isFinite(headline.right) && Number.isFinite(headline.of) ? COPY.together(headline.right, headline.of) : null;
  const sub = soFar ? COPY.soFar : COPY.finalLabel;
  if (podium?.showPodium === false) {
    return { mode: 'table', sub, title: COPY.everyonesMarks, line: soFar && podium.closesAt ? COPY.placesCanChange(podium.closesAt, now) : null, tieLine: null, together, stage: [], floor: places };
  }
  const placed = places.filter((p) => Number.isInteger(p.place) && !p.private);
  const unplaced = places.filter((p) => !Number.isInteger(p.place) || p.private);
  if (places.length === 1 && places[0].you) {
    return { mode: 'only', sub, title: COPY.onlyYouTitle, line: COPY.onlyYouLine, tieLine: null, together, stage: [], floor: places };
  }
  const tops = placed.filter((p) => p.place === 1).map((p) => p.shownName);
  const title = tops.length > 1 ? COPY.sharedTop(tops, soFar) : tops.length === 1 ? (soFar ? COPY.onTopSoFar(tops[0]) : COPY.cameFirst(tops[0])) : COPY.everyonesMarks;
  const stageList = placed.filter((p) => p.place <= 3).sort((a, b) => a.place - b.place);
  const floor = [...placed.filter((p) => p.place > 3), ...unplaced];
  // The first in the middle; the rest alternate left and right, so (2, 1, 2) and (2, 1, 3) read as a podium.
  const ordered = [];
  stageList.forEach((p, i) => { if (i === 0) ordered.push(p); else if (i % 2 === 1) ordered.unshift(p); else ordered.push(p); });
  const tie = podium?.tie && Array.isArray(podium.tie.names) ? COPY.tieLine(podium.tie) : null;
  const stage = ordered.map((p) => ({ ...p, height: PLINTH_HEIGHT[p.place] || 60, unfoldAt: UNFOLD_AT[p.place] ?? 1000 }));
  const base = countBases(stage, floor);
  for (const s of stage) s.countFrom = base.get(s.place) ?? 0;
  return { mode: 'podium', sub, title, line: soFar && podium.closesAt ? COPY.placesCanChange(podium.closesAt, now) : null, tieLine: tie, together, stage, floor };
}

/**
 * Where each place's count starts (F10): third rolls from the highest floor mark or 0, second from third's, first
 * from second's. So the order on the stage is true in every frame.
 */
export function countBases(stage, floor) {
  const floorTop = Math.max(0, ...floor.filter((f) => Number.isFinite(f.marks)).map((f) => f.marks));
  const byPlace = new Map();
  for (const s of stage) if (!byPlace.has(s.place)) byPlace.set(s.place, s.marks);
  const order = [...byPlace.keys()].sort((a, b) => b - a); // lowest place first (3, 2, 1)
  const base = new Map();
  let below = floorTop;
  for (const place of order) {
    base.set(place, Math.min(below, byPlace.get(place)));
    below = byPlace.get(place);
  }
  return base;
}

/** The marks a stage entry shows at time `t` of the reveal (null before its plinth has landed). */
export function shownMarks(entry, t) {
  const start = entry.unfoldAt + LAND_MS;
  if (t < start) return null;
  const k = Math.min(1, (t - start) / COUNT_MS);
  const eased = 1 - (1 - k) ** 3;
  return Math.round(entry.countFrom + (entry.marks - entry.countFrom) * eased);
}
