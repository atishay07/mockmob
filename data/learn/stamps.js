// Learn v2: when a rated card comes back, in the words of DESIGN-SPEC.md A4. PURE (the clock is passed in).
//   later today      due the same India day        "Back later today"
//   tomorrow         due the next India day        "Back tomorrow"
//   2 to 6 days      the weekday                   "Back Tue"
//   7 days or more   the count                     "Back in 12 days"
// A Missed card that comes back inside the session says "Back later in this session".
// A card due at or before now says "Due now" (R16), never "Back later today".
// The session end groups the Revise pile by the same day: "back on Tue", "back tomorrow", "later today", "back in 12 days".
// Also here (BUILD-1101 1.8, R10.1 and R16): the IST-day rule of a mistake's retry, the row meta's "done today", the "moved"
// line and the level run's chapter to start.

const IST_MS = 19_800_000;
const DAY = 86_400_000;
const WEEKDAYS = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
export const IN_RUN = 'Back later in this session';

const time = (v) => { const t = v instanceof Date ? v.getTime() : typeof v === 'number' ? v : Date.parse(v); return Number.isFinite(t) ? t : null; };
/** Whole India calendar days from `now` to `at` (0 = the same day). */
export function istDaysBetween(now, at) {
  const day = (t) => Math.floor((t + IST_MS) / DAY);
  return day(time(at)) - day(time(now));
}
const weekday = (at) => WEEKDAYS[new Date(time(at) + IST_MS).getUTCDay()];

/** { days, stamp, group } for a card due at `dueAt`. */
export function returnDay(dueAt, now) {
  const due = time(dueAt);
  if (due !== null && due <= time(now)) return { days: 0, stamp: 'Due now', group: 'due now' };
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

/** The India calendar day of a time, 'YYYY-MM-DD' (the same as istDay in data/keycards.js). */
export const istDayOf = (at) => new Date(time(at) + IST_MS).toISOString().slice(0, 10);

/**
 * R10.1: a mistake is retried in Learn only when it was made on an earlier India day ("You missed this yesterday"); today's
 * misses rest a day. False for an unknown time.
 */
export function retryReady(at, now) {
  const t = time(at);
  return t !== null && istDaysBetween(t, now) >= 1;
}

/** A chapter row's run note (R16): "6 of 16 done today" only when the run is from today's India day, else "6 of 16 done". */
export function doneLine(done, of, createdAt, now) {
  const today = time(createdAt) !== null && istDaysBetween(createdAt, now) === 0;
  return `${done} of ${of} done${today ? ' today' : ''}`;
}

/**
 * The Pro end's "moved" line (R16): only between two answer-based states, never from or to 'none' (Not started), and only
 * when the state changed. from, to: { key, label }.
 */
export function movedLine(title, from, to) {
  if (!from?.key || !to?.key || from.key === 'none' || to.key === 'none' || from.key === to.key) return null;
  return `${title} moved from ${from.label} to ${to.label}.`;
}

/**
 * The level run's chapter to start (R16): the lowest share right among the chapters its questions came from; ties go to the
 * first in book order. answers: [{ chapterKey, correct }]; chapters: [{ key, title }] in book order.
 * Returns null | { key, title, right, of }.
 */
export function levelPick(answers = [], chapters = []) {
  const score = new Map();
  for (const a of answers || []) {
    if (!a?.chapterKey) continue;
    const s = score.get(a.chapterKey) || { right: 0, of: 0 };
    s.of += 1;
    if (a.correct) s.right += 1;
    score.set(a.chapterKey, s);
  }
  let best = null;
  for (const ch of chapters || []) {
    const s = score.get(ch.key);
    if (!s) continue;
    if (!best || s.right / s.of < best.right / best.of) best = { key: ch.key, title: ch.title, ...s };
  }
  return best;
}
