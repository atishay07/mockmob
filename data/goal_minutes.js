// The daily study goal in minutes (20 Oct 2026). The app lets a student keep any whole number of minutes from 5 to 999
// (docs/design-decisions/pass-1019pm/SMART-LAYER-1019PM.md 2.x: three digits, longer than a waking day, so the bound is
// input hygiene and not a cap). Until now the server held 10, 20 or 30 only and rounded the rest. ONE rule for the study
// preferences, the learning plan, the guided sequence, tonight's record, the goal route and the website. Pure: no I/O.
//
// Nothing here changes what 10, 20 and 30 do: the allocation table and the practice sizes below reproduce the old
// results exactly for those three lengths (data/tests/goal_minutes.test.mjs holds them side by side).

export const GOAL_MINUTES_MIN = 5;
export const GOAL_MINUTES_MAX = 999;
/** The lengths the website offers as chips; any whole number from 5 to 999 is still accepted. */
export const USUAL_MINUTES = Object.freeze([10, 20, 30]);
/** Quick practice allows 20 questions at most (one minute a question). */
export const QUICK_PRACTICE_MAX = 20;
/** The longest review block one plan step names; longer goals add steps instead of one enormous block. */
export const REVIEW_BLOCK_MAX = 30;

/** True for a whole number from 5 to 999 (a number, never a string, so a stray "45" in a body is refused). */
export const isGoalMinutes = (value) => Number.isInteger(value) && value >= GOAL_MINUTES_MIN && value <= GOAL_MINUTES_MAX;

/** The minutes when valid, else `fallback`. Accepts a number or a numeric query string ("45"). */
export function goalMinutesOr(value, fallback = null) {
  const n = typeof value === 'string' && /^\d{1,3}$/.test(value.trim()) ? Number(value) : value;
  return isGoalMinutes(n) ? n : fallback;
}

/** What a PUT body says about the daily goal: `{ ok: true, minutes }` (minutes: number | null | undefined), or `{ ok: false }`. */
export function parseDailyMinutes(body) {
  if (!body || body.dailyMinutes === undefined) return { ok: true, minutes: undefined };
  if (body.dailyMinutes === null) return { ok: true, minutes: null };
  return isGoalMinutes(body.dailyMinutes) ? { ok: true, minutes: body.dailyMinutes } : { ok: false };
}

/** "45 minutes", "1 hour", "1 hour 30 minutes", "2 hours". */
export function minutesLine(minutes) {
  const m = Number(minutes);
  if (!Number.isInteger(m) || m < 1) return '';
  if (m < 60) return `${m} ${m === 1 ? 'minute' : 'minutes'}`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return `${h} ${h === 1 ? 'hour' : 'hours'}${rest ? ` ${rest} ${rest === 1 ? 'minute' : 'minutes'}` : ''}`;
}

/**
 * Quick practice size for a goal: a question a minute up to the 20 Quick practice allows, then a review of the mistakes
 * for the time that is left (never more than one review block). 10 -> 10, 20 -> 20, 30 -> 20 and 10 of review, as before.
 * A length that is not a whole number from 5 to 999 reads as 10, as before.
 */
export function practiceFor(minutes) {
  const m = goalMinutesOr(Number(minutes), 10);
  const count = Math.min(m, QUICK_PRACTICE_MAX);
  return { count, review: Math.min(Math.max(m - count, 0), REVIEW_BLOCK_MAX) };
}

// How the time is shared between a recall review, a lesson and practice: [recall, learn, practice]. The three lengths
// the plan always had keep their table; every other length shares the same way (half practice, three tenths a lesson,
// the rest recall), each step at least a minute.
const LEGACY = Object.freeze({ 10: [2, 3, 5], 20: [4, 6, 10], 30: [5, 10, 15] });
export function allocateMinutes(minutes) {
  const m = goalMinutesOr(Number(minutes), 20);
  if (LEGACY[m]) return [...LEGACY[m]];
  let practice = Math.max(1, Math.round(m * 0.5));
  const learn = Math.max(1, Math.round(m * 0.3));
  let recall = m - practice - learn;
  if (recall < 1) { recall = 1; practice = Math.max(1, m - learn - recall); }
  return [recall, learn, practice];
}
