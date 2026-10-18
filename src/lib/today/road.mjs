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

// ---------- The plain readout (TODAY-NIGHT-1017): weeks left, mocks against the target, the next milestone ----------
// These replace the strip and the mock slider on Today. Same arithmetic, said in words a student reads in one pass.

/** 'today', 'tomorrow', 'in 9 days', 'in 15 weeks' (whole weeks, the same floor as the weeks count). */
export function inWords(days) {
  if (!(days > 0)) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 14) return `in ${days} days`;
  return `in ${Math.floor(days / 7)} weeks`;
}

/**
 * The next dated step on the road after `today`: { id, day, title, note, days, when }. Expected dates only (NTA has not
 * published CUET UG 2027). Board weeks ease the plan to 2 study days, and the note says so only when the goal is above 2.
 */
export function nextMilestone({ today, exam, own = false, goal = null }) {
  const dates = cuetDates(Number(exam.slice(0, 4)));
  const eases = goal > BOARD_WEEK_SESSIONS;
  const steps = [
    { id: 'registration', day: dates.registrationStart, title: 'CUET registration is expected to open', note: `Boards follow from ${shortDay(dates.boardsStart)}${eases ? `; your plan eases to ${BOARD_WEEK_SESSIONS} study days a week then` : ''}.` },
    { id: 'boards', day: dates.boardsStart, title: 'Board exams are expected to begin', note: eases ? `Your plan eases to ${BOARD_WEEK_SESSIONS} study days a week until ${shortDay(dates.boardsEnd)}.` : `They run to about ${shortDay(dates.boardsEnd)}.` },
    { id: 'boards-end', day: dates.boardsEnd, title: 'Board exams are expected to end', note: eases ? `Until then your plan is ${BOARD_WEEK_SESSIONS} study days a week. After, it is back to ${goal}.` : 'After that, the road is CUET only.' },
    { id: 'exam', day: exam, title: own ? 'Your exam' : 'CUET UG is expected to begin', note: own ? 'The date you set.' : 'NTA has not published the 2027 dates yet.' },
  ].filter((s) => s.day > today && s.day <= exam);
  const next = steps[0] || null;
  if (!next) return null;
  const days = daysBetween(today, next.day);
  return { ...next, days, when: inWords(days) };
}

/**
 * The mock line under "7 of 14": how many are left and the pace that gets there, as arithmetic, never a prediction.
 * { left, text, strong }.
 */
export function mockPace({ target, taken, days }) {
  const done = Number.isInteger(taken) ? taken : 0;
  const left = Math.max(0, target - done);
  if (left === 0) return { left, text: 'Target reached.', strong: 'Every extra paper is more practice.' };
  if (!(days > 0)) return { left, text: `${left} to go.`, strong: '' };
  if (days < 7) return { left, text: `${left} to go in ${days} ${days === 1 ? 'day' : 'days'}.`, strong: '' };
  const weeks = days / 7;
  const perWeek = left / weeks;
  let pace;
  if (perWeek > 1) pace = `about ${Math.ceil(perWeek)} a week`;
  else {
    // This week counts as one of the weeks (as weekMockShare spreads them), so 14 over 27 weeks and a part is one a
    // fortnight, the choice it came from, and never a pace that falls short of the target.
    const every = Math.max(1, Math.floor((Math.floor(weeks) + 1) / left));
    pace = every === 1 ? 'about one a week' : every === 2 ? 'about one a fortnight' : `about one every ${every} weeks`;
  }
  return { left, text: `${left} to go:`, strong: `${pace} gets you there.` };
}

/**
 * The plain choices for the mock target (no slider): one a week, one a fortnight (the suggestion), one a month, each
 * never below taken + 1 and inside 1 to 60. Equal values fold into the first. [{ id, title, value, suggested }]
 */
export function mockChoices({ weeks, taken = 0 }) {
  const floor = (Number(taken) || 0) + 1;
  const fit = (n) => Math.min(MOCK_TARGET_MAX, Math.max(MOCK_TARGET_MIN, Math.max(n, floor)));
  const all = [
    { id: 'weekly', title: 'One a week', value: fit(Math.max(1, weeks)) },
    { id: 'fortnight', title: 'One a fortnight', value: suggestedMockTarget({ weeks, taken }), suggested: true },
    { id: 'monthly', title: 'One a month', value: fit(Math.ceil(Math.max(1, weeks) / 4)) },
  ];
  const seen = new Set();
  return all.filter((c) => (seen.has(c.value) ? false : (seen.add(c.value), true)));
}

// ---------- Road to CUET in three layers (owner, 18 Oct 3:30 am, D26): due today, due this week, the overall goal ----------
// "The road to CUET can definitely be improved by respecting information like what's due today, what's due for the
// week, and showing the overall goal." Each layer is a count with its denominator, read at a glance, and opens to its
// detail. Same truth rules as the rest of the road: only what the record holds is counted done; a plan is a plan, never
// a debt, and a day missed is never drawn as a miss.

/**
 * How many full mocks this week's share of the target asks for: { planned, nextWeek }.
 * The mocks still to sit (the target less those taken before this week) spread over the weeks left, this one included.
 * One a week or more: that many this week. Fewer: one every k weeks, due this week when the last full mock was k or more
 * weeks ago (or there is none); else `nextWeek` is the Monday it falls due.
 */
export function weekMockShare({ target, taken, thisWeek = 0, weeks, weekStart, lastMockDay = null }) {
  if (!(target > 0) || !Number.isInteger(taken)) return { planned: 0, nextWeek: null };
  const beforeWeek = Math.max(0, taken - (thisWeek || 0));
  const left = Math.max(0, target - beforeWeek);
  if (left === 0) return { planned: 0, nextWeek: null };
  const spread = Math.max(1, (Number(weeks) || 0) + 1);
  const perWeek = left / spread;
  if (perWeek >= 1) return { planned: Math.min(7, Math.round(perWeek)), nextWeek: null };
  const every = Math.max(1, Math.round(1 / perWeek));
  if (thisWeek > 0 || !lastMockDay || !isDayKey(lastMockDay) || !weekStart) return { planned: 1, nextWeek: null };
  const lastWeek = mondayOf(lastMockDay);
  const gap = Math.floor(daysBetween(lastWeek, weekStart) / 7);
  if (gap >= every) return { planned: 1, nextWeek: null };
  return { planned: 0, nextWeek: addDays(lastWeek, every * 7) };
}

/**
 * The three layers. Inputs (each may be null while it loads; unknown is never zero):
 *   today        today's key in the student's zone
 *   rhythm       GET /api/me/rhythm (weekStart, studyDayDates, studyDays, daysGoal, mocksThisWeek, paused)
 *   weekdays     the planned weekdays (0 = Monday) or null
 *   revise       { due, answeredToday } from GET /api/me/revise (due = still to ask today), or null
 *   move         the lead move (its title and minutes name today's session), or null
 *   fig          roadFigures(...)
 *   target       the mock target in use (the student's, else the suggestion)
 *   taken        full and NTA mocks on the record, or null
 *   lastMockDay  the newest full mock's day key, or null
 *   firstDay     no session saved yet: today is the first day of the plan, and no full mock is asked of this week
 * Returns { today, week, goal } or null when the week is not known yet.
 */
export function roadLayers({ today, rhythm = null, weekdays = null, revise = null, move = null, fig, target, taken = null, lastMockDay = null, firstDay = false }) {
  if (!rhythm?.weekStart || !isDayKey(today) || !fig) return null;
  const idx = Math.max(0, Math.min(6, daysBetween(rhythm.weekStart, today)));
  const counted = new Set(rhythm.studyDayDates || []);
  const goal = Number(rhythm.daysGoal) > 0 ? Number(rhythm.daysGoal) : null;
  const plan = Array.isArray(weekdays) && weekdays.length ? new Set(weekdays) : null;

  // Due today: the planned session (or one already saved), and Revise when anything came back today.
  const items = [];
  const sessionDone = counted.has(today);
  const sessionPlanned = firstDay || Boolean(rhythm.returning) || (plan ? plan.has(idx) : goal ? (rhythm.studyDays || 0) < goal : true);
  if (sessionPlanned || sessionDone) {
    // The lead names today's session, unless the lead is Revise (it has its own line below, so the session stays a plain
    // practice session, never the same thing twice on one list) or Change plan (the first week's day 7: not a session).
    const named = move && !['done', 'revise', 'plan'].includes(move.id) && move.title ? move : null;
    const minutes = named?.key?.minutes || null;
    items.push({
      id: 'session',
      title: sessionDone ? 'Study session' : named ? named.title : 'A study session',
      detail: sessionDone ? 'Saved today' : minutes ? `about ${minutes} min` : 'any length counts',
      done: sessionDone,
      href: sessionDone ? null : named?.key?.href || '/dashboard',
    });
  }
  const asked = Number.isInteger(revise?.answeredToday) ? revise.answeredToday : 0;
  const leftRevise = Number.isInteger(revise?.due) ? revise.due : null;
  if (leftRevise != null && asked + leftRevise > 0) {
    items.push({ id: 'revise', title: 'Revise', detail: `${asked} of ${asked + leftRevise} questions`, done: leftRevise === 0, href: leftRevise > 0 ? '/review/revise' : null, minutes: leftRevise > 0 ? Math.max(5, Math.ceil(leftRevise / 5) * 5) : null });
  }
  const open = items.filter((i) => !i.done);
  const todayLayer = {
    done: items.length - open.length,
    total: items.length,
    items,
    rest: !items.length,
    left: !items.length
      ? (plan ? 'A rest day in your plan. Anything you practise still counts.' : 'Nothing is due today. Anything you practise counts.')
      : !open.length ? 'Everything due today is done.'
        : `Left: ${open.map((i) => (i.id === 'revise' ? `${leftRevise} Revise ${leftRevise === 1 ? 'question' : 'questions'}` : `${i.title.charAt(0).toLowerCase()}${i.title.slice(1)}${i.detail.startsWith('about') ? `, ${i.detail}` : ''}`)).join(', and ')}.`,
  };

  // Due this week: the study days of the goal, and the full mocks this week's share of the target asks for.
  const studyDone = Math.min(rhythm.studyDays || 0, goal || 0);
  const share = firstDay ? { planned: 0, nextWeek: null } : weekMockShare({ target, taken, thisWeek: rhythm.mocksThisWeek || 0, weeks: fig.weeks, weekStart: rhythm.weekStart, lastMockDay });
  const mocksDone = Math.min(rhythm.mocksThisWeek || 0, share.planned);
  const end = addDays(rhythm.weekStart, 6);
  const daysLeft = 7 - idx;
  const weekItems = [];
  if (goal) weekItems.push({ id: 'days', title: 'Study days', done: studyDone, total: goal });
  if (share.planned > 0) weekItems.push({ id: 'mocks', title: share.planned === 1 ? 'Full mock' : 'Full mocks', done: mocksDone, total: share.planned });
  const weekDone = weekItems.reduce((n, i) => n + i.done, 0);
  const weekTotal = weekItems.reduce((n, i) => n + i.total, 0);
  const weekLayer = {
    done: weekDone,
    total: weekTotal,
    items: weekItems,
    paused: Boolean(rhythm.paused),
    daysLeft,
    end,
    nextMock: share.nextWeek,
    extraMocks: Math.max(0, (rhythm.mocksThisWeek || 0) - share.planned),
    line: weekTotal && weekDone >= weekTotal ? 'This week’s plan is done. Anything more is extra.'
      : daysLeft === 1 ? 'Today is the last day of this week.' : `${daysLeft} days left this week, to ${weekdayDay(end)}.`,
  };

  // The overall goal: the countdown, full mocks against the target, the study days left, the next dated step.
  const pace = Number.isInteger(taken) && target > 0 ? mockPace({ target, taken, days: fig.days }) : null;
  const goalLayer = {
    phase: fig.phase,
    count: fig.phase === 'days' ? fig.days : fig.weeks,
    unit: fig.phase === 'days' ? (fig.days === 1 ? 'day' : 'days') : (fig.weeks === 1 ? 'week' : 'weeks'),
    exam: fig.exam,
    own: fig.own,
    taken,
    target,
    pace,
    studyDays: fig.studyDays,
    goal,
    next: fig.phase === 'window' ? null : nextMilestone({ today, exam: fig.exam, own: fig.own, goal }),
  };
  return { today: todayLayer, week: weekLayer, goal: goalLayer };
}
