// The Road to May on the website's Today (TODAY-1017 section 4.4). PURE: no I/O, no clock; the caller passes
// today's day key ('YYYY-MM-DD' in the student's time zone). The same arithmetic as the app
// (flutter_app/lib/features/today/logic/road_board.dart and onboarding/data/calendar.dart), so both platforms
// draw the same road:
//
//   * the exam day is the student's own date while it is valid, else the expected window's first day (1 May);
//   * study days left = the weekly goal for every whole week to that day, board weeks at 2;
//   * a first mock target, when the student has none: one full mock a fortnight, at least 5, never below taken + 1.
//
// Every date is "expected" until NTA publishes CUET UG 2027. Nothing here predicts marks or chances.

export const DAY_MS = 86400000;
export const MOCK_TARGET_MIN = 1;
export const MOCK_TARGET_MAX = 60;
export const BOARD_WEEK_SESSIONS = 2;
/** Under this many days to the exam the strip shows days, not weeks (1016 8.5). */
export const DAYS_MODE_UNDER = 22;

const KEY = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const isDayKey = (key) => typeof key === 'string' && KEY.test(key) && new Date(`${key}T00:00:00Z`).toISOString().slice(0, 10) === key;
const ms = (key) => Date.parse(`${key}T00:00:00Z`);
export const addDays = (key, n) => new Date(ms(key) + n * DAY_MS).toISOString().slice(0, 10);
export const daysBetween = (from, to) => Math.round((ms(to) - ms(from)) / DAY_MS);
/** Monday of the week holding `key`. */
export const mondayOf = (key) => addDays(key, -((new Date(ms(key)).getUTCDay() + 6) % 7));
/** '2027-05-08' -> '8 May'. */
export const shortDay = (key) => `${Number(key.slice(8, 10))} ${MONTHS[Number(key.slice(5, 7)) - 1]}`;
/** '2027-05-08' -> 'Sat 8 May'. */
export const weekdayDay = (key) => `${WEEKDAYS[new Date(ms(key)).getUTCDay()]} ${shortDay(key)}`;
export const monthLong = (key) => MONTHS_LONG[Number(key.slice(5, 7)) - 1];

/** The CUET year a student on `today` is preparing for: this May until it opens, then next year's. */
export const cuetYear = (today) => {
  const y = Number(today.slice(0, 4));
  return today < `${y}-05-01` ? y : y + 1;
};

/** The expected dates for a CUET year (CuetDates in the app; expected until NTA publishes). */
export function cuetDates(year) {
  return {
    year,
    windowStart: `${year}-05-01`,
    windowEnd: `${year}-05-31`,
    registrationStart: `${year}-02-01`,
    boardsStart: `${year}-02-15`,
    boardsEnd: `${year}-04-05`,
    /** The latest day a student can set: the end of June, in case NTA moves the window. */
    latest: `${year}-06-30`,
  };
}

/** A week (its Monday) is a boards week when it starts on or after boards start and before boards end. */
const inBoards = (weekStartKey, dates) => weekStartKey >= dates.boardsStart && weekStartKey < dates.boardsEnd;
const weekSessions = (daysPerWeek, boards) => (boards && daysPerWeek > BOARD_WEEK_SESSIONS ? BOARD_WEEK_SESSIONS : daysPerWeek);

/**
 * Study sessions from `from` up to `until` at `daysPerWeek`: whole weeks only, each week counted from `from`,
 * board weeks at 2 (the app's sessionsUntil, unchanged).
 */
export function sessionsUntil(from, until, daysPerWeek) {
  const weeks = Math.floor(daysBetween(from, until) / 7);
  if (weeks <= 0 || !(daysPerWeek > 0)) return 0;
  const dates = cuetDates(Number(until.slice(0, 4)));
  let total = 0;
  for (let w = 0; w < weeks; w += 1) total += weekSessions(daysPerWeek, inBoards(addDays(from, w * 7), dates));
  return total;
}

/** A first target to offer: one full mock a fortnight to the exam, at least five, never below taken + 1. */
export function suggestedMockTarget({ weeks, taken = 0 }) {
  const pace = Math.ceil(Math.max(0, weeks) / 2);
  const base = Math.max(5, pace);
  return Math.min(MOCK_TARGET_MAX, Math.max(MOCK_TARGET_MIN, Math.max(base, (Number(taken) || 0) + 1)));
}

/** The student's own date when it is after today and no later than the end of June; else null. */
export function validOwnDate(examDate, today) {
  if (!isDayKey(examDate) || !isDayKey(today)) return null;
  const dates = cuetDates(cuetYear(today));
  return examDate > today && examDate <= dates.latest ? examDate : null;
}

/**
 * What the road says now. `plan` is { examDate, mockTarget } from the account (or nulls), `goal` the weekly study days,
 * `taken` the full and NTA mocks on the record (null while unknown).
 */
export function roadFigures({ today, plan = {}, goal = null, taken = null }) {
  const dates = cuetDates(cuetYear(today));
  const own = validOwnDate(plan?.examDate, today);
  const exam = own || dates.windowStart;
  const days = Math.max(0, daysBetween(today, exam));
  const weeks = Math.floor(days / 7);
  const target = Number.isInteger(plan?.mockTarget) ? plan.mockTarget : null;
  return {
    dates,
    exam,
    own: Boolean(own),
    days,
    weeks,
    studyDays: goal > 0 && days > 0 ? sessionsUntil(today, exam, goal) : null,
    goal: goal > 0 ? goal : null,
    taken: Number.isInteger(taken) ? taken : null,
    target,
    suggested: suggestedMockTarget({ weeks, taken: Number.isInteger(taken) ? taken : 0 }),
    phase: days <= 0 ? 'window' : days < DAYS_MODE_UNDER ? 'days' : 'weeks',
  };
}

/**
 * The strip's columns: one per week from this week's Monday to the exam's week, inclusive (or one per day under
 * DAYS_MODE_UNDER days). Each column: { key, planned, counted, current, boards, registration, month } where
 * `planned` is the pips to draw (the goal; 2 in boards weeks), `counted` only for this week (the server's count),
 * `month` the month's short name on the first column starting in that month. With `end` later than the exam, the
 * strip runs on to `end` (the latest day a student can set) and the weeks after the exam are `after` (no pips), so the
 * flag can be dragged later along a scale that does not change under the finger.
 */
export function stripColumns({ today, exam, end = exam, goal = null, counted = 0, daysMode = false }) {
  const dates = cuetDates(Number(exam.slice(0, 4)));
  if (daysMode) {
    const n = Math.max(1, daysBetween(today, exam) + 1);
    return Array.from({ length: n }, (_, i) => {
      const key = addDays(today, i);
      return { key, planned: 1, counted: i === 0 ? Math.min(1, counted) : 0, current: i === 0, boards: false, registration: false, exam: key === exam, month: i === 0 || key.slice(8, 10) === '01' ? MONTHS[Number(key.slice(5, 7)) - 1] : null };
    });
  }
  const first = mondayOf(today);
  const examWeek = mondayOf(exam);
  const last = mondayOf(end > exam ? end : exam);
  const n = Math.max(1, Math.floor(daysBetween(first, last) / 7) + 1);
  const regWeek = mondayOf(dates.registrationStart);
  let lastMonth = null;
  return Array.from({ length: n }, (_, i) => {
    const key = addDays(first, i * 7);
    const boards = inBoards(key, dates);
    const after = key > examWeek;
    // The month is named under the first week that starts in it (the first column always names its own month).
    const month = key.slice(0, 7);
    const label = month !== lastMonth ? MONTHS[Number(key.slice(5, 7)) - 1] : null;
    lastMonth = month;
    return {
      key,
      planned: goal > 0 && !after ? weekSessions(goal, boards) : 0,
      counted: i === 0 ? Math.max(0, Number(counted) || 0) : 0,
      current: i === 0,
      boards,
      registration: key === regWeek,
      exam: key === examWeek,
      after,
      month: label,
    };
  });
}

/** Where the boards band sits on the strip: the first and last column index, or null when no column is a boards week. */
export function boardsSpan(columns) {
  const first = columns.findIndex((c) => c.boards);
  if (first < 0) return null;
  let last = first;
  while (last + 1 < columns.length && columns[last + 1].boards) last += 1;
  return { first, last };
}

/** The exam day a drag lands on: whole days, snapped to 1 May within two days, kept from tomorrow to the end of June. */
export function snapExamDay(candidate, today) {
  const dates = cuetDates(cuetYear(today));
  let day = candidate;
  if (Math.abs(daysBetween(day, dates.windowStart)) <= 2) day = dates.windowStart;
  const tomorrow = addDays(today, 1);
  if (day < tomorrow) day = tomorrow;
  if (day > dates.latest) day = dates.latest;
  return day;
}

/**
 * The PUT body for the account's road, checked: `{ ok: true, patch }` where patch holds only the fields sent
 * ({ exam_date?: 'YYYY-MM-DD' | null, mock_target?: 1-60 | null }), or `{ ok: false, message }` for a 422.
 * `today` bounds the date (after today, no later than the end of June after the window).
 */
export function parseRoadInput(body, today) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, message: 'Send an exam date or a mock target.' };
  const patch = {};
  if ('examDate' in body) {
    if (body.examDate === null) patch.exam_date = null;
    else if (!validOwnDate(body.examDate, today)) return { ok: false, message: `Choose a day after today and no later than ${shortDay(cuetDates(cuetYear(today)).latest)}.` };
    else patch.exam_date = body.examDate;
  }
  if ('mockTarget' in body) {
    const t = body.mockTarget;
    if (t === null) patch.mock_target = null;
    else if (!Number.isInteger(t) || t < MOCK_TARGET_MIN || t > MOCK_TARGET_MAX) return { ok: false, message: `Choose between ${MOCK_TARGET_MIN} and ${MOCK_TARGET_MAX} full mocks.` };
    else patch.mock_target = t;
  }
  if (!Object.keys(patch).length) return { ok: false, message: 'Send an exam date or a mock target.' };
  return { ok: true, patch };
}

/** What a stored row says to the client. */
export const roadOut = (row) => ({
  examDate: isDayKey(row?.exam_date) ? row.exam_date : null,
  mockTarget: Number.isInteger(row?.mock_target) ? row.mock_target : null,
});
