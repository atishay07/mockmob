// What happened in the student's day, and the one act Mobi plays for it. The same table as the app
// (flutter_app lib/core/mascot/mobi_moments.dart, MobiMoments), so the same event gets the same
// reaction on both sides. Pages name the moment; this picks the act. Pure: no browser, no clock
// (the caller passes the time), so it is unit-tested (data/tests/mobi_moments.test.mjs).
//
// Play an event with `mobiAct(scope, mobiMoment('saveConfirmed'))` (mobiEvents.js), and ask
// mobiRation.js whether it may play right now (once a day, once a run, one per 2.5 s).

export const MOBI_EVENTS = {
  arrive: 'hello',
  rightAnswer: 'correct',
  wrongAnswer: 'encourage',
  waiting: 'loading',
  typing: 'listen',
  milestone: 'proud',
  sessionDone: 'cheer',
  showAction: 'nudge',
  allClear: 'rest',
  setback: 'oops',
  answerRight: 'correct',
  answerWrong: 'encourage',
  saveConfirmed: 'nod',
  saveFailed: 'oops',
  waitLong: 'loading',
  choiceWitnessed: 'listen',
  dayCounted: 'correct',
  goalMet: 'proud',
  refused: 'oops',
  goodbye: 'wave',
  lateNight: 'sleepy',
};

/** The act for an event. An event the table does not know stands at ease. */
export function mobiMoment(event) {
  return MOBI_EVENTS[event] || 'idle';
}

// The shared late-night window, the same as the app's isLateNightHour (core/domain/next_move.dart):
// 11 PM to 5 AM local time. 5:00 AM is the first minute of "Good morning".
export const LATE_NIGHT_START = 23;
export const LATE_NIGHT_END = 5;
// From 1 AM he is asleep rather than sleepy (the app's MobiMoments.entranceAt).
export const ASLEEP_FROM = 1;

export const isLateNightHour = (hour) => hour >= LATE_NIGHT_START || hour < LATE_NIGHT_END;

const hourOf = (when) => (when instanceof Date ? when.getHours() : typeof when === 'number' ? new Date(when).getHours() : new Date().getHours());

/** True when `when` (a Date, a time in ms, or now) is late at night. */
export const isLate = (when) => isLateNightHour(hourOf(when));

/**
 * How he arrives at `when`. The whole late-night window is sleepy or asleep: sleepy until 1 AM,
 * asleep from 1 AM until it closes. Outside it, `otherwise`.
 */
export function entranceAt(when, otherwise = 'hello') {
  const h = hourOf(when);
  if (!isLateNightHour(h)) return otherwise;
  return h >= ASLEEP_FROM && h < LATE_NIGHT_END ? 'sleep' : 'sleepy';
}

/** The acts the Celebrations setting gates (the app's MobiRation.celebrations). */
export const CELEBRATION_SET = ['cheer', 'celebrate', 'proud'];

/**
 * The act he plays for `act` under a Celebrations level, or null when he plays nothing and keeps
 * his stance. Full: as authored. Quiet: a small nod. Off: nothing. Acts that are not celebrations
 * are never changed.
 */
export function underLevel(act, level = 'full') {
  if (!CELEBRATION_SET.includes(act)) return act;
  if (level === 'quiet') return 'nod';
  if (level === 'off') return null;
  return act;
}

/**
 * The result page's hero reaction: the app's recapReaction (features/result/model/recap_variant.dart).
 * NTA none; late at night sleepy with "Goodnight"; first mock proud; higher cheer; lower and held
 * encourage; standard rest. Under Quiet or Off the big acts become a held rest, so the hero stays
 * calm and the words carry the news.
 */
export function recapReaction({ tone, celebrations = 'full', isNta = false, hour = 12 } = {}) {
  if (isNta) return null;
  if (isLateNightHour(hour)) return { act: 'sleepy', line: 'Goodnight.' };
  const full = celebrations === 'full';
  switch (tone) {
    case 'first_mock': return { act: full ? 'proud' : 'rest' };
    case 'higher': return { act: full ? 'cheer' : 'rest' };
    case 'lower':
    case 'held': return { act: 'encourage' };
    default: return { act: 'rest' };
  }
}

/**
 * The end of a lesson or review run from its real counts (the app's runMood, learn/screens/
 * run_done_screen.dart): `kept` cards stuck out of `total`. A single card is `correct` when it
 * stuck; "all stuck" celebrates only from 5 cards; a third or more not kept is `encourage`.
 */
export function runMood(kept, total) {
  if (!(total > 0)) return 'cheer';
  const again = total - kept;
  if (total === 1) return kept === 1 ? 'correct' : 'encourage';
  if (again === 0 && total >= 5) return 'celebrate';
  if (again * 3 >= total) return 'encourage';
  return 'cheer';
}

/** The act for an opened answer on the full result (the app's AnswerReactor). Held answers get nothing. */
export function answerAct(verdict) {
  if (verdict === 'correct') return { first: 'correct', then: 'read', glance: true };
  if (verdict === 'wrong' || verdict === 'blank' || verdict === 'skipped') return { first: 'encourage', then: 'point', glance: false };
  return null;
}

/**
 * Which Mobi stands beside the week ring and what he does (the app's mobiForWeek, features/rhythm/
 * logic/week_mobi.dart). Order: paused rest; met proud; late at night asleep; returning hello;
 * out of reach encourage; one short with today planned nudge; otherwise nobody (null).
 *   week: { status: 'paused'|'met'|'open', studyDays, goal, daysLeft, todayPlanned }
 * `daysLeft` is days from today to Sunday that are not yet study days (today included while it is
 * not one); null when the week on screen is not this week.
 */
export function weekMobi(week, { hour = 12, returning = false } = {}) {
  if (week.status === 'paused') return { kind: 'rest', act: 'rest', line: 'Paused. Your run is kept.', lineIsState: true };
  if (week.status === 'met') return { kind: 'proud', act: 'proud' };
  if (isLateNightHour(hour)) return { kind: 'sleep', act: 'sleep', wakeLine: 'Sleep well. Tomorrow counts.' };
  if (returning) return { kind: 'hello', act: 'hello', line: 'Welcome back. Nothing was lost.' };
  if (week.daysLeft == null) return null;
  const needed = Math.max(0, Math.min(7, week.goal - week.studyDays));
  if (needed === 0) return { kind: 'proud', act: 'proud' };
  if (week.daysLeft < needed) return { kind: 'encourage', act: 'encourage', line: 'Every study day still counts.' };
  if (needed === 1 && week.todayPlanned) return { kind: 'nudge', act: 'nudge', line: 'One more day, and today is on your plan.' };
  return null;
}

// ---- The tap cycle -------------------------------------------------------------------------------
// How he answers being tapped again and again (the app's MobiTapCycle.standard): hello, a curious
// tilt, a little hop, then ticklish. Never the same act twice in a row; the cycle starts over after
// 8 s without a tap; after 6 acts in one visit a tap only gets the light squash.
export const TAP_CYCLE = { acts: ['hello', 'tilt', 'correct', 'startle'], resetAfterMs: 8000, cap: 6 };

/** One visit's progress through a cycle. `tap(now)` returns the act for a tap, or null at the cap. */
export function createTapRun(cycle = TAP_CYCLE) {
  let next = 0;
  let played = 0;
  let last = null;
  let lastTap = null;
  return {
    get played() { return played; },
    tap(now = Date.now()) {
      if (lastTap != null && now - lastTap >= cycle.resetAfterMs) next = 0;
      lastTap = now;
      if (played >= cycle.cap) return null;
      let act = cycle.acts[next % cycle.acts.length];
      if (act === last) { next += 1; act = cycle.acts[next % cycle.acts.length]; }
      next += 1;
      played += 1;
      last = act;
      return act;
    },
  };
}

// The pointer lean (the app's follow-pointer): the head follows while the pointer moves, within
// these limits, and lets go after 1.2 s. Off under Reduce motion.
export const FOLLOW = { releaseAfterMs: 1200, clampX: 0.85, clampY: 0.8 };
