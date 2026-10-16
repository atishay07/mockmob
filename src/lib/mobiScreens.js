// Where Mobi appears on each arena screen of the website, and the one act each real moment earns.
// Pure data and pure functions (no browser, no clock), tested in data/tests/mobi_moments.test.mjs.
//
// The rules (owner, 16 Oct 2026): at most one Mobi on a screen at a time, and only at a real moment:
// a result reveal, a repair explained, a revise run finished or a card retired, a rule kept, a week's
// study-day goal met, an answer checked in Learn, the first visit of the day, and one calm figure in
// an empty or failed state. Where two could show, the largest one wins and the other stays out
// (the icon or nothing takes its place). The acts are the rig's own (mobiActs.js); nothing is redrawn.
// Celebrations Quiet and Off and Reduce motion are applied by MobiReact itself (resolveAct).

import { mobiMoment, runMood } from './mobiMoments.js';

/**
 * The moments map: for each screen, the moments that bring Mobi and the act each plays. `null`
 * means the moment is real but says itself in words only (the screen already has its Mobi, or the
 * figure would crowd a timed or busy surface). Screens left out (Progress, Review, Radar) belong
 * to their own pages' rules.
 */
export const SCREEN_MOMENTS = Object.freeze({
  today: {
    // Today 1017 (TODAY-1017 4.6): Mobi greets on the first ever visit and on a return after 7 or more days, in the move
    // card's art box. firstVisitToday no longer plays on Today (kept for the screens that still use it).
    firstEver: 'hello',
    returning: 'hello',
    firstVisitToday: 'hello',
    weekGoalMet: mobiMoment('goalMet'),
    mobRingComplete: mobiMoment('goalMet'),
    planLoading: 'think',
    timeChosen: 'tilt',
    failed: 'oops',
  },
  practice: { firstVisitToday: 'hello', launching: 'think', refused: 'oops', sheetAllAnswered: 'nod', sheetUnanswered: 'point', sheetMarked: 'tilt' },
  result: {
    firstMock: 'proud', scoreUp: 'cheer', scoreDown: 'encourage', scoreHeld: 'encourage',
    repairExplained: 'correct', answerRight: 'correct', answerWrong: 'encourage',
    ruleKept: 'proud', ruleNotKept: 'encourage',
  },
  revise: {
    answerRight: mobiMoment('answerRight'),
    answerWrong: mobiMoment('answerWrong'),
    cardRetired: mobiMoment('milestone'),
    runFinished: 'runMood',
    nothingDue: 'rest',
    failed: 'oops',
  },
  rules: { ruleChosen: mobiMoment('saveConfirmed'), noRulesYet: 'rest', failed: 'oops' },
  recovery: { noRecordYet: 'read', failed: 'oops' },
  learn: { checkRight: 'correct', checkMissed: 'encourage', lessonDone: 'runMood', reviewDone: 'runMood' },
  explore: { answerRight: 'correct', answerWrong: 'encourage', empty: 'rest', failed: 'oops' },
  saved: { firstSave: mobiMoment('saveConfirmed'), empty: 'point', failed: 'oops' },
  profile: { firstVisitToday: 'hello', saveConfirmed: 'nod', saveFailed: 'oops', waitLong: 'loading' },
});

/** The act for a moment on a screen, or null when the map has none. */
export function screenAct(screen, moment) {
  const act = SCREEN_MOMENTS[screen]?.[moment];
  return typeof act === 'string' && act !== 'runMood' ? act : null;
}

/**
 * A Revise answer the server graded: a card leaving the rotation for good is a milestone (proud);
 * an ordinary right answer a small hop, a miss a lean of encouragement. Nothing before the server
 * has answered.
 */
export function reviseAnswerAct(result) {
  if (!result || typeof result.correct !== 'boolean') return null;
  if (result.correct && result.retired) return SCREEN_MOMENTS.revise.cardRetired;
  return result.correct ? SCREEN_MOMENTS.revise.answerRight : SCREEN_MOMENTS.revise.answerWrong;
}

/** The end of a Revise run, proportional to what was recalled (the app's runMood). Null for an empty run. */
export function reviseEndAct(recalled, total) {
  if (!(total > 0)) return null;
  return runMood(recalled, total);
}

/** The rule check on a mock's Lab: kept is proud, not kept a lean of encouragement; counted and not checked keep the icon. */
export function ruleCheckAct(state) {
  if (state === 'kept') return SCREEN_MOMENTS.result.ruleKept;
  if (state === 'not_kept') return SCREEN_MOMENTS.result.ruleNotKept;
  return null;
}

/**
 * Today's companion for a week whose study-day goal the server has called met: proud once per
 * week on this device (the same key the Progress week card uses, so the two never cheer the same
 * week twice). `cheered` is what this device already remembers.
 */
export function weekGoalAct({ met, cheered } = {}) {
  return met === true && !cheered ? SCREEN_MOMENTS.today.weekGoalMet : null;
}

/** The storage key that remembers a week's cheer (shared with RhythmCard). */
export const weekCheerKey = (weekStart) => `mm:rhythm-cheer:${weekStart}`;

/**
 * Today's companion when every member of your Mob has sat the week's paper (SOCIAL-SPEC 7: once, on Today only, never
 * on /mob). Proud once per Mob week on this device; a Mob of one has no ring to complete.
 */
export function mobRingAct({ size, sat, cheered } = {}) {
  return Number.isInteger(size) && size >= 2 && sat === size && !cheered ? SCREEN_MOMENTS.today.mobRingComplete : null;
}

/** The storage key that remembers a Mob week's cheer. */
export const mobCheerKey = (weekStart) => `mm:mob-cheer:${weekStart}`;

/**
 * One Mobi in view. Given the boxes of the other Mobis on the page and the viewport height, true
 * when none of them is on screen, so a smaller Mobi may play its moment without a second one in view.
 */
export function aloneInView(others, viewportHeight) {
  return !others.some((r) => r && r.width > 0 && r.bottom > 0 && r.top < viewportHeight);
}
