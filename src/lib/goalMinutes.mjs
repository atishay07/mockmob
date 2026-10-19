// The daily study time a student sets on the website (20 Oct 2026, D126 / H1). Pure: no React, no browser, no fetch, so
// data/tests/goal_minutes_web.test.mjs reads the same words and rules the pages do.
//
// 10, 20 and 30 stay the three quick choices. "More" opens the rest: 1 hour (time for one full mock a day), 2 hours, or
// the student's own amount in 15-minute steps. Nothing is capped by the page; the only ceiling is the longest the account
// can hold (MAX_MINUTES, the server's 999 rounded down to a whole 15), and it is said plainly when it is reached.
//
// The server is being widened from 10, 20 and 30 to 5-999 minutes on another branch (web/1020-goal-minutes). Until that is
// live, these helpers let a page send only what the server accepts, keep the student's real choice on the device, and say
// so without claiming anything false (sendableMinutes, deviceOnlyLine, goalMinutesFromResponse).

export const PRESETS = Object.freeze([10, 20, 30]);
/** The two ready-made longer days in the More panel. */
export const MORE_CHOICES = Object.freeze([
  Object.freeze({ minutes: 60, title: '1 hour', line: 'Time for one full mock a day' }),
  Object.freeze({ minutes: 120, title: '2 hours', line: 'Time for two full mocks a day' }),
]);
export const OWN_STEP = 15;
export const OWN_MIN = 15;
/** The server holds 5 to 999 minutes; the stepper stops at the last whole 15 inside that (16 hours 30 minutes). */
export const MAX_MINUTES = 990;
/** Where "Your own" opens when the student has no longer day yet: an hour and a half. */
export const OWN_START = 90;
/** What a server that still holds only 10, 20 or 30 accepts. */
export const LEGACY_MINUTES = PRESETS;
export const STORE_KEY = 'mm:goal-minutes:v1';

/** True for a whole number of minutes the account can hold (5 to 999). */
export const isMinutes = (n) => Number.isInteger(n) && n >= 5 && n <= 999;
/** True for one of the three quick choices. */
export const isPreset = (n) => PRESETS.includes(n);
/** A kept amount: a whole number from 5 to 999, else null (a stray string, a float or a stale value reads as none). */
export const cleanMinutes = (n) => (isMinutes(n) ? n : null);

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "45 minutes", "1 hour", "1 hour 30 minutes", "2 hours". Reads aloud and in sentences. */
export function minutesLong(n) {
  if (!isMinutes(n)) return '';
  if (n < 60) return plural(n, 'minute');
  const h = Math.floor(n / 60);
  const rest = n % 60;
  return `${plural(h, 'hour')}${rest ? ` ${plural(rest, 'minute')}` : ''}`;
}

/** The short form for a key: "10 min", "45 min", "1 hour", "2 hours", "1 h 30". */
export function minutesChip(n) {
  if (!isMinutes(n)) return '';
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const rest = n % 60;
  return rest ? `${h} h ${rest}` : plural(h, 'hour');
}

/** One 15-minute step from a length, snapped to a multiple of 15, never below OWN_MIN or above MAX_MINUTES. */
export function stepOwn(n, direction) {
  const base = isMinutes(n) ? n : OWN_START;
  const snapped = direction > 0 ? (Math.floor(base / OWN_STEP) + 1) * OWN_STEP : (Math.ceil(base / OWN_STEP) - 1) * OWN_STEP;
  return Math.min(MAX_MINUTES, Math.max(OWN_MIN, snapped));
}

/** A length the stepper can show: a multiple of 15 from OWN_MIN to MAX_MINUTES (nearest, else the start). */
export function ownFrom(n) {
  if (!isMinutes(n)) return OWN_START;
  return Math.min(MAX_MINUTES, Math.max(OWN_MIN, Math.round(n / OWN_STEP) * OWN_STEP));
}

/** The reason a stepper key is off, or '' while it works (the key's label carries it, never a bare grey button). */
export function stepStop(n, direction) {
  if (direction < 0 && n <= OWN_MIN) return '15 minutes is the shortest';
  if (direction > 0 && n >= MAX_MINUTES) return `${minutesLong(MAX_MINUTES)} is the longest a day can hold`;
  return '';
}

/**
 * The one line under the choices. It is fixed by the choice (the website has no history here), never a claim about the
 * student's habits. A longer day is a note, never a limit.
 */
export function goalLine(n) {
  if (!isMinutes(n)) return 'Full mocks are in Practice whenever you want one. Tap More for an hour or longer.';
  if (n <= 30) return 'Full mocks are in Practice whenever you want one. Tap More for an hour or longer.';
  if (n < 60) return 'A short custom day. You can change it any time.';
  if (n === 60) return 'One hour fits a full mock, timed like the exam. You can change this any time.';
  if (n < 120) return 'Enough for a full mock and time to go through what you missed.';
  if (n === 120) return 'Two hours fits two full mocks. A short break between them helps.';
  if (n < 240) return 'Room for two full mocks and a review. A short break between them helps.';
  return 'That is a long day. Short breaks keep it working.';
}

/** The largest length a server that holds only 10, 20 or 30 accepts for a choice (never above it, never below 10). */
export function sendableMinutes(n) {
  if (!isMinutes(n)) return null;
  let best = LEGACY_MINUTES[0];
  for (const m of LEGACY_MINUTES) if (m <= n) best = m;
  return best;
}

/**
 * What the goal route said about the daily minutes. `account` only when the server answered with the same number; a
 * server that does not know the field (it sends none), one whose column is not ready (minutesOnAccount false or null) or
 * one that answers with another number all read `device`: the choice is kept on this device and nothing says otherwise.
 */
export function goalMinutesFromResponse(body, wanted) {
  if (!body || typeof body !== 'object') return 'device';
  if (body.minutesOnAccount === false) return 'device';
  return cleanMinutes(body.dailyMinutes) === wanted ? 'account' : 'device';
}

/** A goal read: the account's number wins; else this device's kept one; else none. */
export function pickMinutes(accountMinutes, deviceMinutes) {
  const a = cleanMinutes(accountMinutes);
  if (a !== null) return { minutes: a, source: 'account' };
  const d = cleanMinutes(deviceMinutes);
  return d !== null ? { minutes: d, source: 'device' } : { minutes: null, source: null };
}

/** The line shown after a save: "saved" only for what the account holds; the device-only case says exactly that. */
export function savedMinutesLine(n, where, planMinutes = null) {
  if (where === 'account') return `Saved. ${minutesLong(n)} a day.`;
  const kept = `${minutesLong(n)} a day is kept on this device.`;
  return planMinutes && planMinutes !== n
    ? `${kept} Your plan uses ${minutesLong(planMinutes)} a day for now.`
    : kept;
}

/** The same, for a screen that is only choosing (nothing is saved until its own key is pressed). */
export function pendingMinutesLine(n) {
  return n ? `${minutesLong(n)} a day. Press Save to keep it.` : '';
}

export const COPY = Object.freeze({
  question: 'How long each day?',
  more: 'More',
  moreSheet: 'A longer day',
  own: 'Your own',
  ownLine: 'Any length, in steps of 15 minutes',
  use: 'Use',
  minus: 'Take off 15 minutes',
  plus: 'Add 15 minutes',
});

/** Reads a device copy (JSON text) into minutes or null. */
export function readStored(text) {
  try {
    const v = JSON.parse(text);
    return cleanMinutes(v?.minutes);
  } catch { return null; }
}
/** The device copy's text for a choice. */
export function storedText(n, now = Date.now()) {
  return JSON.stringify({ minutes: n, at: now });
}
