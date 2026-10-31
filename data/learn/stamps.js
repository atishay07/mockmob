// Learn v2: when a rated card comes back, in the words of DESIGN-SPEC.md A4. PURE (the clock is passed in).
//   later today      due the same India day        "Back later today"
//   tomorrow         due the next India day        "Back tomorrow"
//   2 to 6 days      the weekday                   "Back Tue"
//   7 days or more   the count                     "Back in 12 days"
// A Missed card that comes back inside the run says "Back later in this run".
// The session end groups the Revise pile by the same day: "back on Tue", "back tomorrow", "later today", "back in 12 days".

const IST_MS = 19_800_000;
const DAY = 86_400_000;
const WEEKDAYS = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
export const IN_RUN = 'Back later in this run';

const time = (v) => { const t = v instanceof Date ? v.getTime() : typeof v === 'number' ? v : Date.parse(v); return Number.isFinite(t) ? t : null; };
/** Whole India calendar days from `now` to `at` (0 = the same day). */
export function istDaysBetween(now, at) {
  const day = (t) => Math.floor((t + IST_MS) / DAY);
  return day(time(at)) - day(time(now));
}
const weekday = (at) => WEEKDAYS[new Date(time(at) + IST_MS).getUTCDay()];

/** { days, stamp, group } for a card due at `dueAt`. */
export function returnDay(dueAt, now) {
  const days = Math.max(0, istDaysBetween(now, dueAt));
  if (days === 0) return { days, stamp: 'Back later today', group: 'later today' };
  if (days === 1) return { days, stamp: 'Back tomorrow', group: 'back tomorrow' };
  if (days < 7) return { days, stamp: `Back ${weekday(dueAt)}`, group: `back on ${weekday(dueAt)}` };
  return { days, stamp: `Back in ${days} days`, group: `back in ${days} days` };
}

/** The Revise pile of a run, grouped by return day in date order: [{ label, count }]. */
export function revisePileGroups(dues, now) {
  const groups = new Map();
  for (const due of dues || []) {
    const r = returnDay(due, now);
    const g = groups.get(r.group) || { label: r.group, count: 0, days: r.days };
    g.count += 1;
    groups.set(r.group, g);
  }
  return [...groups.values()].sort((a, b) => a.days - b.days).map(({ label, count }) => ({ label, count }));
}

/** "6 back on Tue, 3 back on Fri, 2 later today" in date order. */
export const revisePileLine = (groups) => (groups || []).map((g) => `${g.count} ${g.label}`).join(', ');

/** "16 Oct" (India date) for a time. */
export function shortDate(at) {
  const d = new Date(time(at) + IST_MS);
  return `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}`;
}
