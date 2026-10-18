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

/**
 * This week's study days, the one count This week and Road to CUET both print (D27, release 9): { done, total, text } from the
 * rhythm's own figures ("4 of 4 study days"), or null while the goal is unknown. The full mocks the plan asks of the week are a
 * separate count, never folded into this one.
 */
export function weekDays(rhythm) {
  const total = Number(rhythm?.daysGoal);
  if (!rhythm || !(total > 0) || !Number.isInteger(rhythm.studyDays)) return null;
  const done = rhythm.studyDays;
  return { done, total, text: `${done} of ${total} study ${total === 1 ? 'day' : 'days'}` };
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
  // Returning (TODAY-1018 section 5, as the app): no shaming, no streak loss; the week starts again with one session.
  if (done === 0 && rhythm.returning) return { text: 'A new week starts with one session.', strong: `Today can be day one of ${goal}.` };
  if (todayMark && todayMark.state !== 'counted') {
    if (todayMark.state === 'rest') return { text: countedNames.length ? `${dayList(countedNames)} counted. Tonight is a rest day;` : 'Tonight is a rest day;', strong: 'a session still counts.' };
    if (done + 1 === goal) return { text: `${dayList(countedNames)} counted.`, strong: `Tonight makes ${goal}.` };
    return { text: countedNames.length ? `${dayList(countedNames)} counted.` : 'No study day yet this week.', strong: 'Tonight counts.' };
  }
  const left = Math.max(0, goal - done);
  // The readout under the days already says "Today already counts" (D27), so this line gives only the count still to meet.
  return { text: '', strong: `${left} more to meet ${goal}.` };
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

// ---------- The day readout, pass 1018 (TODAY-1018 section 6.3): a tapped day says what was done or planned ----------

const LONG_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MODE_WORDS = { quick: 'practice', smart: 'smart practice', full: 'full mock', nta: 'NTA mock' };

/** '2026-10-15' (index 3 of its week) -> 'Thursday 15 Oct'. */
export function longDay(key, index) {
  return `${LONG_NAMES[index] ?? ''} ${Number(key.slice(8, 10))} ${MONTHS[Number(key.slice(5, 7)) - 1]}`.trim();
}

/** 6:20 PM in the rhythm's own zone (IST by default). */
export function clockIn(at, timeZone = 'Asia/Kolkata') {
  const t = typeof at === 'number' ? at : Date.parse(at || '');
  if (!Number.isFinite(t)) return '';
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(t));
  } catch { return ''; }
}

/**
 * What one day of this week holds: { title, lines: [{ text, at }], note }.
 *   mark      the day's mark from weekMarks ({ key, state, today })
 *   index     0 (Monday) to 6
 *   papers    GET /api/attempts/summary items (each with completedAt, mode, subject, total, marks, maxMarks)
 *   repairs   GET /api/me/repair-record rows ({ repairedAt })
 *   dayKey    (at) -> the day key in the rhythm's zone
 *   clockOf   (at) -> '6:20 PM'
 *   move      the lead move on the card now (for today), or null
 *   failed    the move did not load (today then says so, and claims nothing)
 *   goal      study days a week
 *   today     today's key (a past planned day says nothing was saved; a future one says it is planned)
 */
export function dayReadout({ mark, index, papers = null, repairs = null, dayKey, clockOf = (at) => String(at), subjectName = (id) => id, move = null, failed = false, goal = null, today = '' }) {
  if (!mark) return null;
  const lines = [];
  for (const p of Array.isArray(papers) ? papers : []) {
    if (!p?.completedAt || dayKey(p.completedAt) !== mark.key) continue;
    const mode = MODE_WORDS[p.mode] || 'practice';
    const name = `${p.subject ? `${subjectName(p.subject)} ` : ''}${mode}`;
    const n = Number(p.total) || (Number(p.correct) || 0) + (Number(p.wrong) || 0) + (Number(p.unattempted) || 0);
    const score = Number.isFinite(Number(p.marks)) && Number(p.maxMarks) > 0 ? `, ${p.marks} of ${p.maxMarks}` : '';
    lines.push({ text: `${name.charAt(0).toUpperCase()}${name.slice(1)}, ${n} ${n === 1 ? 'question' : 'questions'}${score}`, at: clockOf(p.completedAt), t: Date.parse(p.completedAt) || Number(p.completedAt) });
  }
  const fixed = (Array.isArray(repairs) ? repairs : []).filter((r) => r?.repairedAt && dayKey(r.repairedAt) === mark.key);
  if (fixed.length) {
    const lastAt = fixed.map((r) => Date.parse(r.repairedAt)).sort((a, b) => b - a)[0];
    lines.push({ text: `Repair, ${fixed.length} ${fixed.length === 1 ? 'mistake' : 'mistakes'}`, at: clockOf(lastAt), t: lastAt });
  }
  lines.sort((a, b) => a.t - b.t);
  const out = lines.map(({ text, at }) => ({ text, at }));
  const long = longDay(mark.key, index);
  const past = Boolean(today) && mark.key < today;
  if (mark.today) {
    const title = `Today, ${long}${!out.length && mark.state === 'planned' ? ', planned' : ''}`;
    if (failed) return { title, lines: out, note: 'Your move shows here once it loads.' };
    const m = move && move.id !== 'done' && move.title ? `Up next: ${move.title.charAt(0).toLowerCase()}${move.title.slice(1)}${move.key?.minutes ? `, about ${move.key.minutes} minutes` : ''}.` : '';
    if (!out.length && mark.state === 'counted') return { title, lines: out, note: m ? `Today already counts. ${m}` : 'Today already counts toward your week.' };
    return { title, lines: out, note: out.length ? (m ? `Still to come: ${m.slice(9)}` : '') : m || 'Any session today counts toward your week.' };
  }
  if (out.length) return { title: long, lines: out, note: '' };
  if (mark.state === 'counted') return { title: long, lines: out, note: 'Counted as a study day. The session is not listed here.' };
  if (mark.state === 'before') return { title: long, lines: out, note: 'Before your first session.' };
  if (mark.state === 'rest') return { title: long, lines: out, note: 'A rest day in your plan. Anything you practise still counts.' };
  if (mark.state === 'planned') {
    return past
      ? { title: `${long}, planned`, lines: out, note: goal > 0 ? `No session saved that day. The week still counts any ${goal} ${goal === 1 ? 'day' : 'days'}.` : 'No session saved that day.' }
      : { title: `${long}, planned`, lines: out, note: 'Planned. Any day you practise counts.' };
  }
  return { title: long, lines: out, note: past ? 'No session saved that day.' : 'Nothing planned yet. Any day you practise counts.' };
}
