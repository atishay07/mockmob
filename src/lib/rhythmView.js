// What the Rhythm card shows, worked out from /api/me/rhythm and nothing else. PURE: no I/O, no
// clock (the caller passes today's day key). Every sentence here says only what the record says:
// a day is "counted" only if the server listed it, a week is "met" only if the server said so.

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 86400000;
const KEY = /^\d{4}-\d{2}-\d{2}$/;

export const addDays = (key, n) => new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const dayOfMonth = (key) => Number(key.slice(8, 10));
const monthName = (key) => MONTHS[Number(key.slice(5, 7)) - 1];
/** '2026-10-06' becomes '6 Oct'. */
export const shortDate = (key) => `${dayOfMonth(key)} ${monthName(key)}`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** The day key for "now" in a time zone, the way the server counts days. Falls back to the device's UTC day. */
export function dayKeyNow(timeZone, now = Date.now()) {
  try {
    const key = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
    if (KEY.test(key)) return key;
  } catch { /* An unknown zone falls through. */ }
  return new Date(now).toISOString().slice(0, 10);
}

/** The seven days of this week, Monday first, each with the one sentence that is true of it. */
export function buildWeek(rhythm, today) {
  const start = rhythm?.weekStart;
  if (!KEY.test(start || '')) return [];
  const counted = new Set(rhythm.studyDayDates || []);
  return DAY_NAMES.map((name, i) => {
    const key = addDays(start, i);
    const label = `${name} ${dayOfMonth(key)}`;
    let state = 'ahead';
    if (counted.has(key)) state = 'counted';
    else if (key === today) state = 'open';
    else if (key < today) state = 'missed';
    const chip = state === 'counted' ? `${label}, counted`
      : state === 'open' ? `Today, ${label}, not counted yet`
        : state === 'missed' ? `${label}, no study day counted`
          : `${label}, still ahead`;
    return { key, name, label, state, chip, isToday: key === today };
  });
}

/** Up to twelve weeks, oldest first, ending with this week. */
export function buildRibbon(rhythm) {
  if (!rhythm) return [];
  const closed = [...(rhythm.history || [])].reverse().map((w) => ({
    key: w.weekStart, days: w.studyDays, goal: w.goal, met: !!w.met, paused: !!w.paused, current: false,
  }));
  const now = { key: rhythm.weekStart, days: rhythm.studyDays, goal: rhythm.daysGoal, met: !!rhythm.metThisWeek, paused: false, current: true };
  return [...closed, now].slice(-12).map((w) => {
    const of = `${w.days} of ${w.goal} study days`;
    const words = w.current
      ? (w.met ? `This week: ${of}, goal met` : `This week: ${of} so far`)
      : w.met ? `Week of ${shortDate(w.key)}: ${of}, goal met`
        : w.paused ? `Week of ${shortDate(w.key)}: paused`
          : `Week of ${shortDate(w.key)}: ${of}, goal not met`;
    return { ...w, fill: w.goal > 0 ? Math.min(1, w.days / w.goal) : 0, words };
  });
}

/** The plain sentence under the ring. */
export function weekStatus(rhythm) {
  if (!rhythm) return '';
  const left = Math.max(0, rhythm.daysGoal - rhythm.studyDays);
  if (rhythm.metThisWeek) return `Week met. ${plural(rhythm.studyDays, 'study day', 'study days')} counted.`;
  if (rhythm.paused) return 'Your weekly goal is paused for now.';
  if (rhythm.studyDays === 0) {
    return rhythm.returning
      ? 'Welcome back. One counted study day starts your week.'
      : 'No study day counted yet this week.';
  }
  return `${plural(left, 'more study day', 'more study days')} to meet your weekly goal.`;
}
