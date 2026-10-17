// The repair run on the result page, as plain data and pure functions (tested in
// data/tests/repair_run.test.mjs). The app has the same run as a screen (flutter_app
// lib/features/review: RunTrack, EndingModel, ReviewCopy); this file keeps the website's words and
// rules the same. Nothing here reads the page, the clock or storage unless it is handed in, and
// nothing claims a repair the server has not acknowledged.
import { hasExplanation, REPAIR_OUTCOMES } from '../../../data/repair_presentation.mjs';
import { attemptedWhen } from '../../../data/repair_paper.mjs';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ---------- Words (ReviewCopy in the app) ----------

export const RUN_COPY = Object.freeze({
  progress: (i, n) => `${i} of ${plural(n, 'mistake')}`,
  trackLabel: 'Repair progress',
  trackHint: 'Use the arrow keys to step between mistakes you have opened.',
  trackGo: 'Show this mistake',
  finishForNow: 'Finish for now',
  finish: 'Finish',
  segment: (i, n, state) => `Mistake ${i} of ${n}, ${state}`,
  states: Object.freeze({
    current: 'on screen',
    done: 'repaired',
    reviewed: 'read with the key',
    setAside: 'set aside',
    seen: 'opened',
    upcoming: 'not reached yet',
  }),
  missedBefore: (source, date) => `You also missed this question in ${source} on ${date}.`,
  // F17: with the time it was attempted, in the one stamp the rest of the record uses ("Mock 2, 12 Oct, 9:40 pm").
  missedBeforeAt: (source, when) => `You also missed this question in ${source}${when ? `, ${when}` : ''}.`,
  openThatResult: 'Open that result',
  missedTimes: (n) => (n === 2 ? 'Missed twice' : `Missed ${n} times`),
  endingUnit: (n) => (n === 1 ? 'mistake repaired' : 'mistakes repaired'),
  // The four steps of a mistake, the same words as the app's ReviewCopy (found, repaired, retested,
  // stillRight, lifeCaption, lifeSpoken in flutter_app lib/features/review/copy.dart). Found: the
  // question was answered wrong. Repaired: the server acknowledged a repair. Retested (right on a new
  // question on the same idea) and Still right (right again later) have no source yet, so they are
  // never lit and the line says so.
  stages: Object.freeze(['Found', 'Repaired', 'Retested', 'Still right']),
  stagesLabel: 'Steps: Found, Repaired, Retested, Still right',
  laterSteps: 'The last two steps test you with new questions on the same idea. They are not ready yet.',
  nothingTitle: 'Nothing repaired this time',
  mobiRepaired: 'Mobi, pleased with the repair',
  mobiNothing: 'Mobi, ready for another try',
  trySameAgain: 'Try the same mistakes again',
  openReview: 'Open Review',
  firstRepair: 'This is your first repair.',
});

// ---------- The track ----------

const SETTLED_ASIDE = new Set(['held_for_recheck', 'corrected_key']);

/**
 * One segment per mistake of the run, in paper order. Built only from real outcomes: an explanation
 * the server acknowledged (explained, stored) is `done`; a held key is `setAside`; the mistake on
 * screen is `current`; one reached before and left unsettled (a failure, a call still out, "could not
 * explain") is `seen`; the rest are `upcoming`. `current` is also kept as a flag, so a repaired
 * mistake that is on screen is both.
 */
export function runSegments({ ids = [], numbers = {}, outcomes = {}, reached = new Set(), current = null } = {}) {
  return ids.map((id) => {
    const outcome = outcomes[id];
    let state;
    if (hasExplanation(outcome)) state = 'done';
    else if (SETTLED_ASIDE.has(outcome)) state = 'setAside';
    else if (id === current) state = 'current';
    else if (reached.has(id)) state = 'seen';
    else state = 'upcoming';
    return { id, number: numbers[id] ?? null, state, current: id === current };
  });
}

/** A segment can be shown again when the student has already reached it (never one still ahead). */
export function canGoTo(segments, i) {
  const s = segments[i];
  return Boolean(s) && (s.state !== 'upcoming' || s.current);
}

export function segmentLabel(segments, i) {
  const s = segments[i];
  const word = RUN_COPY.states[s.state];
  const label = s.current && s.state !== 'current' ? `${word}, ${RUN_COPY.states.current}` : word;
  return RUN_COPY.segment(i + 1, segments.length, label);
}

/** The nearest reached segment before (dir -1) or after (dir 1) `from`, or -1. */
export function stepIndex(segments, from, dir) {
  for (let i = from + dir; i >= 0 && i < segments.length; i += dir) {
    if (canGoTo(segments, i)) return i;
  }
  return -1;
}

// A flick counts as a step when it is mostly sideways, long enough and fast enough (the app's
// minimum fling speed is 320 px/s). Right is "back", left is "forward".
export const SWIPE = Object.freeze({ minDistance: 48, minVelocity: 320, sideways: 1.6 });
export function swipeIntent({ dx = 0, dy = 0, ms = 0 } = {}) {
  const ax = Math.abs(dx);
  if (ax < SWIPE.minDistance || ax < Math.abs(dy) * SWIPE.sideways) return null;
  const velocity = ms > 0 ? (ax / ms) * 1000 : Infinity;
  if (velocity < SWIPE.minVelocity) return null;
  return dx > 0 ? 'prev' : 'next';
}

/** Arrow keys step on a desktop; anything with a modifier, or typing in a field, is left alone. */
export function arrowIntent(event) {
  if (!event || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  const tag = String(event.target?.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || event.target?.isContentEditable) return null;
  if (event.key === 'ArrowLeft') return 'prev';
  if (event.key === 'ArrowRight') return 'next';
  return null;
}

// ---------- "You missed this before" ----------

const MOCK_MODES = new Set(['full', 'nta']);
const wasWrong = (d) => d?.isCorrect === false && Number.isInteger(d?.givenIndex);
const byTime = (a, b) => (Number(a?.completedAt) || 0) - (Number(b?.completedAt) || 0) || String(a?.id).localeCompare(String(b?.id));

/** "Mock 7" is the count of the student's mocks in the same subject up to and including this one; practice is "Quick practice". */
export function sourceLabel(attempts, attempt) {
  const mode = attempt?.selectionMeta?.mode || attempt?.mode;
  if (!MOCK_MODES.has(mode)) return 'Quick practice';
  const mocks = (attempts || []).filter((a) => a.subject === attempt.subject && MOCK_MODES.has(a?.selectionMeta?.mode || a?.mode)).sort(byTime);
  const index = mocks.findIndex((a) => a.id === attempt.id);
  return `Mock ${index >= 0 ? index + 1 : mocks.length + 1}`;
}

/** sourceLabel for every attempt at once (one pass per subject instead of one sort per attempt): Map<attemptId, label>. */
export function sourceLabels(attempts) {
  const out = new Map();
  const bySubject = new Map();
  for (const a of attempts || []) {
    const mode = a?.selectionMeta?.mode || a?.mode;
    if (!MOCK_MODES.has(mode)) { out.set(a.id, 'Quick practice'); continue; }
    if (!bySubject.has(a.subject)) bySubject.set(a.subject, []);
    bySubject.get(a.subject).push(a);
  }
  for (const mocks of bySubject.values()) {
    mocks.sort(byTime);
    mocks.forEach((a, i) => { if (!out.has(a.id)) out.set(a.id, `Mock ${i + 1}`); });
  }
  return out;
}

/**
 * For the server to attach to the result of one attempt: for each question the student got wrong in
 * `attemptId`, the other attempts where the same question was also answered wrong, newest first.
 * Real records only (the same question id marked wrong). Questions missed once are left out.
 */
export function buildMissedBefore(attempts, attemptId) {
  const list = attempts || [];
  const current = list.find((a) => a.id === attemptId);
  if (!current) return {};
  const out = {};
  for (const d of current.details || []) {
    if (!wasWrong(d)) continue;
    const others = list
      .filter((a) => a.id !== attemptId && (a.details || []).some((x) => x.qid === d.qid && wasWrong(x)))
      .sort((a, b) => byTime(b, a))
      .map((a) => ({ attemptId: a.id, completedAt: Number(a.completedAt) || null, source: sourceLabel(list, a) }));
    if (others.length) out[d.qid] = others;
  }
  return out;
}

/** What the client trusts from `attempt.missedBefore[qid]`: well-formed entries only, newest first. Absent means missed once. */
export function earlierMisses(attempt, qid) {
  const raw = attempt?.missedBefore?.[qid];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && typeof m.attemptId === 'string' && m.attemptId && typeof m.source === 'string' && m.source.trim() && Number.isFinite(Number(m.completedAt)))
    .map((m) => ({ attemptId: m.attemptId, source: m.source.trim(), completedAt: Number(m.completedAt) }))
    .sort((a, b) => b.completedAt - a.completedAt);
}

export const missedCount = (attempt, qid) => earlierMisses(attempt, qid).length + 1;

/** "12 October", in India time like the rest of the record. */
export function dayMonth(ms) {
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });
}

export function earlierMissLine(miss, format = dayMonth) {
  return miss ? RUN_COPY.missedBefore(miss.source, format(miss.completedAt)) : null;
}

/** The same line with the day and time it was attempted ("You also missed this question in Mock 2, 12 Oct, 9:40 pm."). */
export function earlierMissAt(miss, now = Date.now()) {
  return miss ? RUN_COPY.missedBeforeAt(miss.source, attemptedWhen(miss.completedAt, now)) : null;
}

// ---------- The ending ----------

/**
 * What the ending says, from the run's real outcomes. Only an explanation the server acknowledged as
 * new (`explained`) counts as repaired now; `stored` is a reopened earlier repair; a held key is set
 * aside; a mistake the student reached that did not settle (a failed call, "could not explain") is
 * a miss; the rest were never opened.
 */
export function endingModel({ ids = [], outcomes = {}, reached = new Set() } = {}) {
  const repairedNow = [];
  const repairedEarlier = [];
  const setAside = [];
  const missed = [];
  const untouched = [];
  for (const id of ids) {
    const o = outcomes[id];
    if (o === 'explained') repairedNow.push(id);
    else if (o === 'stored') repairedEarlier.push(id);
    else if (SETTLED_ASIDE.has(o)) setAside.push(id);
    else if (reached.has(id) || REPAIR_OUTCOMES.includes(o)) missed.push(id);
    else untouched.push(id);
  }
  return {
    repaired: repairedNow.length,
    repairedNow, repairedEarlier, setAside, missed, untouched,
    left: missed.length + untouched.length,
    nothing: repairedNow.length === 0,
  };
}

/** The mistakes "Try the same mistakes again" opens: with nothing repaired, the run's open ones; otherwise the misses. */
export function retryIds(model) {
  return model.nothing ? [...model.missed, ...model.untouched] : [...model.missed];
}

/** The one fact the number does not carry: what is left, and what is set aside. */
export function endingFact({ left = 0, setAside = 0 } = {}) {
  return [
    left === 0 ? 'Nothing left from this paper.' : `${left} left from this paper.`,
    setAside > 0 ? `${setAside} set aside while ${setAside === 1 ? 'its key is' : 'their keys are'} checked.` : null,
  ].filter(Boolean).join(' ');
}

export function nothingLine({ setAside = 0 } = {}) {
  return setAside > 0 ? `${setAside} set aside. They stay in Review.` : 'Your mistakes stay in Review.';
}

/** "tonight" from 4:00 PM to 4:59 AM, otherwise "today" (the app's rule). */
export function tonightOrToday(date = new Date()) {
  const hour = date.getHours();
  return hour >= 16 || hour < 5 ? 'tonight' : 'today';
}
export const finishFor = (date) => `Finish for ${tonightOrToday(date)}`;
export const retryLine = (n, chapter) => `${plural(n, 'mistake')}${chapter ? `, ${chapter}` : ''}`;

/** The ending's Mobi act: the real outcome. Quiet and Off are applied by the Mobi component itself. */
export function endingAct(model) {
  return model.nothing ? 'encourage' : 'proud';
}

// ---------- Mobi in the repair ----------

/** The act for a repair state. `correct` plays once per mistake; a rebuild or a return never celebrates again. */
export function repairAct(mood, { cheered = false } = {}) {
  if (!mood) return null;
  if (mood === 'correct' && cheered) return 'idle';
  return mood;
}

/** The mood under the act, the app's RepairMobi: curious while it works, happy for a repair, concerned after a failure, calm otherwise. */
export const REPAIR_MOBI_MOOD = Object.freeze({ think: 'curious', loading: 'curious', correct: 'happy', hello: 'calm', oops: 'concerned', encourage: 'concerned', rest: 'calm' });

/** A set that says yes the first time for a key. */
export function createOnceGate() {
  const seen = new Set();
  return { claim: (key) => (seen.has(key) ? false : (seen.add(key), true)), has: (key) => seen.has(key), size: () => seen.size };
}
// One gate for the page's lifetime: leaving a row, folding it or coming back to it never celebrates again.
export const cheerGate = createOnceGate();

/** What a tap on Mobi plays while a repair is on screen: a small nod; three quick taps a tilt, or a cheer once the server has acknowledged a repair. */
export function tapAct({ taps = 1, acknowledged = false } = {}) {
  if (taps >= 3) return acknowledged ? 'cheer' : 'tilt';
  return 'nod';
}

export const TAP_CYCLE = Object.freeze(['hello', 'tilt', 'correct', 'startle']);
const TAP_CYCLE_NOTHING = Object.freeze(['hello', 'tilt', 'nod', 'wave']);
export const TAP_IDLE_RESET_MS = 8000;
export const TAP_VISIT_CAP = 6;

/**
 * The ending's tap cycle (the app's MobiTapCycle.standard): hello, tilt, correct, startle, one act per
 * tap, never the same act twice in a row, starting again after 8 s without a tap, and at most six
 * acts per visit (then nothing plays; the squash is the caller's). Acts the site does not have yet
 * are skipped. With nothing repaired it never plays `correct`, so a tap cannot claim a repair.
 */
export function createTapCycle({ repaired = true, has = () => true, now = () => Date.now() } = {}) {
  const cycle = (repaired ? TAP_CYCLE : TAP_CYCLE_NOTHING).filter((a) => has(a));
  let index = 0;
  let last = null;
  let lastAt = -Infinity;
  let count = 0;
  return {
    tap() {
      const t = now();
      if (t - lastAt > TAP_IDLE_RESET_MS) { index = 0; last = null; }
      lastAt = t;
      if (count >= TAP_VISIT_CAP || !cycle.length) return null;
      let act = cycle[index % cycle.length];
      if (act === last && cycle.length > 1) { index += 1; act = cycle[index % cycle.length]; }
      index += 1;
      last = act;
      count += 1;
      return act;
    },
    reset() { index = 0; last = null; lastAt = -Infinity; count = 0; },
  };
}

/** A press held this long on Mobi replays the ending's own reaction. */
export const LONG_PRESS_MS = 450;
