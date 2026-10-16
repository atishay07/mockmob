// This week on Today (TODAY-1017 section 4.3): seven marks, "3 of 4 study days" and one caption that ties the week
// to tonight. PURE: no I/O, no clock (the caller passes today's day key). A day is counted only when the server
// listed it; a missed day is never drawn as a miss (no shame, T005): a past planned day keeps its plain outline,
// and days before the first saved session are a short dash.
import { addDays, weekdayDay } from './road.mjs';

const NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** 'Mon, Tue and Thu'. */
export function dayList(names) {
  if (!names.length) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The first saved session's day in the rhythm's own time zone, or null. */
export function firstDayKey(rhythm, toDay) {
  const at = rhythm?.milestones?.find?.((m) => m.id === 'first_scored_session')?.achievedAt;
  return at ? toDay(at) : null;
}

/**
 * The seven marks: { key, name, state: 'counted' | 'planned' | 'open' | 'rest' | 'before', today }.
 * `weekdays` is the student's chosen days (0 = Monday) or null when none are held: then an uncounted day is 'open'.
 */
export function weekMarks({ rhythm, today, weekdays = null, firstDay = null }) {
  const start = rhythm?.weekStart;
  if (!start) return [];
  const counted = new Set(rhythm.studyDayDates || []);
  const plan = Array.isArray(weekdays) && weekdays.length ? new Set(weekdays) : null;
  return NAMES.map((name, i) => {
    const key = addDays(start, i);
    let state;
    if (counted.has(key)) state = 'counted';
    else if (key < today && (!firstDay || key < firstDay)) state = 'before';
    else if (plan) state = plan.has(i) ? 'planned' : 'rest';
    else state = 'open';
    return { key, name, state, today: key === today };
  });
}

/** One sentence for the marks, for a screen reader: "Monday counted, Tuesday counted, ...". */
export function marksWords(marks) {
  const say = { counted: 'counted', planned: 'planned', open: 'not counted yet', rest: 'a rest day', before: 'before your first session' };
  return marks.map((m) => `${m.today ? 'today, ' : ''}${m.name} ${say[m.state]}`).join('; ');
}

/**
 * The caption: { text, strong } where `strong` is the key clause drawn in ink. First match wins (4.3's table).
 * `everSessions` is the student's saved sessions (0 = day one), `pausedUntil` the goal's pause date.
 */
export function weekCaption({ rhythm, marks, today, everSessions = null, pausedUntil = null }) {
  const goal = rhythm.daysGoal;
  const done = rhythm.studyDays;
  const countedNames = marks.filter((m) => m.state === 'counted').map((m) => m.name);
  const todayMark = marks.find((m) => m.today);
  if (rhythm.paused && pausedUntil) return { text: `Paused until ${weekdayDay(pausedUntil)}.`, strong: '' };
  if (rhythm.paused) return { text: 'Your weekly goal is paused.', strong: '' };
  if (everSessions === 0 && done === 0) return { text: 'Your week starts tonight.', strong: 'Tonight counts.' };
  if (rhythm.metThisWeek) return { text: `Goal met: ${done} of ${goal} study days.`, strong: 'Anything more this week is extra.', met: true };
  const isMonday = marks[0]?.today;
  if (done === 0 && isMonday && rhythm.lastClosedWeek) {
    const w = rhythm.lastClosedWeek;
    return { text: `Last week: ${w.studyDays} of ${w.goal}.`, strong: 'Tonight starts this week.', lastWeek: true };
  }
  if (done === 0 && rhythm.returning) return { text: 'A new week.', strong: 'Tonight counts.' };
  if (todayMark && todayMark.state !== 'counted') {
    if (todayMark.state === 'rest') return { text: countedNames.length ? `${dayList(countedNames)} counted. Tonight is a rest day;` : 'Tonight is a rest day;', strong: 'a session still counts.' };
    if (done + 1 === goal) return { text: `${dayList(countedNames)} counted.`, strong: `Tonight makes ${goal}.` };
    return { text: countedNames.length ? `${dayList(countedNames)} counted.` : 'No study day yet this week.', strong: 'Tonight counts.' };
  }
  const left = Math.max(0, goal - done);
  return { text: `Tonight is counted.`, strong: `${left} more to meet ${goal}.` };
}

/**
 * The weekly receipt (FEATURE-ADOPTION 5): what the student's repairs this week add up to, counted only from saved
 * repairs (GET /api/me/repair-record rows: { attemptId, repairedAt }). It claims no cause and no marks gained: a
 * repair is counted, never credited with a result. Null when there is nothing honest to show (no repair this week,
 * or the record did not load), so the line is simply absent.
 * `dayKey(iso)` turns a repair time into the rhythm's own day key; `weekStart` is this week's Monday key.
 */
export function weekReceipt({ repairs, weekStart, dayKey }) {
  if (!Array.isArray(repairs) || !weekStart || typeof dayKey !== 'function') return null;
  const mine = repairs.filter((r) => r?.repairedAt && dayKey(r.repairedAt) >= weekStart);
  if (!mine.length) return null;
  const papers = new Set(mine.map((r) => r.attemptId).filter(Boolean)).size;
  const n = mine.length;
  return {
    count: n,
    papers,
    text: `Repaired this week: ${n} ${n === 1 ? 'mistake' : 'mistakes'}${papers > 1 ? ` from ${papers} papers` : ''}.`,
    // Every paper is marked +5 and −1, so a wrong answer is 6 marks away from a right one. Arithmetic, not a gain.
    strong: n === 1 ? 'It was a 6-mark swing.' : `Each was a 6-mark swing, ${n * 6} in all.`,
  };
}

export const todayKeyIn = (timeZone, now = Date.now()) => {
  try {
    const key = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return key;
  } catch { /* an unknown zone falls through */ }
  return new Date(now + 19800000).toISOString().slice(0, 10);
};
