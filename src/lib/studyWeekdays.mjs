// Which weekdays a student plans to study. ONE rule for the route, the store and the website editor
// (and written down for the app in docs/design-decisions/study-weekdays-api-1016.md). Pure: no I/O.
//
// Wire format: an array of integers 0 to 6, Monday = 0 (the app's own numbering), unique, sorted.
// Stored format: one smallint bit mask, bit 0 = Monday, so 4 days Mon, Tue, Thu, Sat = 1+2+8+32 = 43.
// The weekdays belong to the goal: they are only believed while their count equals days_per_week.
// A goal changed without weekdays (the pause buttons, an older app) keeps them while the count still
// matches, and drops them when it does not, so a plan can never disagree with the goal.

export const WEEKDAY_COUNT = 7;
export const WEEKDAY_NAMES = Object.freeze(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
export const WEEKDAY_SHORT = Object.freeze(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
export const FULL_MASK = 127;

const isDay = (n) => Number.isInteger(n) && n >= 0 && n < WEEKDAY_COUNT;

/**
 * The weekdays in a request: `{ ok: true, weekdays: [0, 1, 3, 5] }` (sorted), or `{ ok: false }` for
 * anything that is not 1 to 7 distinct integers between 0 and 6 (strings, 7, -1, 1.5, repeats, junk).
 */
export function parseWeekdays(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > WEEKDAY_COUNT) return { ok: false };
  let mask = 0;
  for (const day of value) {
    if (!isDay(day)) return { ok: false };
    const bit = 1 << day;
    if (mask & bit) return { ok: false };
    mask |= bit;
  }
  return { ok: true, weekdays: weekdaysFromMask(mask) };
}

/** The sorted weekdays in a mask, or [] for a mask that is not 1 to 127. */
export function weekdaysFromMask(mask) {
  if (!Number.isInteger(mask) || mask < 1 || mask > FULL_MASK) return [];
  const out = [];
  for (let day = 0; day < WEEKDAY_COUNT; day += 1) if (mask & (1 << day)) out.push(day);
  return out;
}

/** The mask of a weekday list already checked by parseWeekdays; null for an invalid list. */
export function maskFromWeekdays(weekdays) {
  const parsed = parseWeekdays(weekdays);
  if (!parsed.ok) return null;
  return parsed.weekdays.reduce((mask, day) => mask | (1 << day), 0);
}

/** What a row says to the client: the weekdays while they agree with the goal, else null. */
export function weekdaysOut(mask, daysPerWeek) {
  const days = weekdaysFromMask(mask == null ? NaN : Number(mask));
  return days.length > 0 && days.length === Number(daysPerWeek) ? days : null;
}

/**
 * The PUT body's goal and weekdays, decided together.
 *   body.weekdays absent          -> the goal alone changes ({ weekdays: undefined } = keep what is stored)
 *   body.weekdays: null           -> the student clears the plan ({ weekdays: null })
 *   body.weekdays: [0, 2, 4]      -> the plan is saved; daysPerWeek may be left out (it is the count),
 *                                    and when sent it must equal the count
 * Returns `{ ok: true, daysPerWeek, weekdays }` or `{ ok: false, message }` (a 422 line).
 */
export function resolveGoalWeekdays(body) {
  const sent = body?.daysPerWeek;
  const hasDays = sent !== undefined && sent !== null;
  if (hasDays && (!Number.isInteger(sent) || sent < 1 || sent > WEEKDAY_COUNT)) return { ok: false, message: 'Choose between 1 and 7 days a week.' };
  if (body?.weekdays === undefined) {
    if (!hasDays) return { ok: false, message: 'Choose between 1 and 7 days a week.' };
    return { ok: true, daysPerWeek: sent, weekdays: undefined };
  }
  if (body.weekdays === null) {
    if (!hasDays) return { ok: false, message: 'Choose between 1 and 7 days a week.' };
    return { ok: true, daysPerWeek: sent, weekdays: null };
  }
  const parsed = parseWeekdays(body.weekdays);
  if (!parsed.ok) return { ok: false, message: 'Study days must be 1 to 7 different days, numbered 0 (Monday) to 6 (Sunday).' };
  if (hasDays && sent !== parsed.weekdays.length) return { ok: false, message: `You chose ${parsed.weekdays.length} ${parsed.weekdays.length === 1 ? 'day' : 'days'}, so the goal has to be ${parsed.weekdays.length} a week.` };
  return { ok: true, daysPerWeek: parsed.weekdays.length, weekdays: parsed.weekdays };
}

/**
 * The mask to write for a goal save, or `undefined` to leave the column alone.
 * `weekdays` is what resolveGoalWeekdays returned; `previousMask` is the stored mask (or null/undefined).
 */
export function maskToStore({ weekdays, daysPerWeek, previousMask }) {
  if (Array.isArray(weekdays)) return maskFromWeekdays(weekdays);
  if (weekdays === null) return null;
  // The goal alone changed: the stored plan stays only while it still has that many days.
  const kept = weekdaysFromMask(previousMask == null ? NaN : Number(previousMask));
  if (previousMask == null) return undefined;
  return kept.length === daysPerWeek ? undefined : null;
}

/** "Mon, Tue, Thu and Sat" (or "every day"). */
export function weekdaysLine(weekdays) {
  const list = Array.isArray(weekdays) ? weekdays.filter(isDay) : [];
  if (list.length === 0) return '';
  if (list.length === WEEKDAY_COUNT) return 'every day';
  const names = list.map((day) => WEEKDAY_SHORT[day]);
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
