// What the badge shelf, the detail sheet and the "Badge earned" row on the result say (BADGES-REFINE-1018,
// the owner's answer of 18 Oct: keep every badge, refine the UI and function around them). PURE: no I/O, no
// clock (callers pass `now`), no storage of its own (callers pass an object with getItem and setItem).
// The 16 ids, names and conditions stay in studyBadges.js, the source of truth; this module only reads
// the board that studyBadges.js builds (badgePaths / badgePathsFromApi) and words it.
//
// Truth rules, kept here so a test can hold them:
//   a badge is earned only when the board says so (a real earnedAt, or the one undated proof of run_weeks_3);
//   a count is shown only where the board has one, always with its denominator, and unknown is never zero;
//   nothing here ranks the student against anyone, and no word here is a lock or a flame.
import { BADGE_PATHS, paperKind, subjectName } from './studyBadges.js';

export const DEFAULT_ZONE = 'Asia/Kolkata';

// ---------------------------------------------------------------------------------------------
// Times

/** Milliseconds from a number, a numeric string or an ISO string; null when it is none of them. */
export function toMs(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : /^\d+$/.test(String(v)) ? Number(v) : Date.parse(v);
  return Number.isFinite(n) ? n : null;
}

/** "Sat 17 Oct, 9:12 PM": the day and the 12-hour time in the student's own time zone. */
export function whenLine(ms, zone = DEFAULT_ZONE) {
  const t = toMs(ms);
  if (t == null) return '';
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-US', { timeZone: zone || DEFAULT_ZONE, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(new Date(t));
  } catch {
    parts = new Intl.DateTimeFormat('en-US', { timeZone: DEFAULT_ZONE, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(new Date(t));
  }
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${get('weekday')} ${get('day')} ${get('month')}, ${get('hour')}:${get('minute')} ${get('dayPeriod').toUpperCase()}`;
}

/** "3 Sep": a short day and month, for a shelf label. */
export function shortDay(ms, zone = DEFAULT_ZONE) {
  const t = toMs(ms);
  if (t == null) return '';
  let parts;
  try { parts = new Intl.DateTimeFormat('en-US', { timeZone: zone || DEFAULT_ZONE, day: 'numeric', month: 'short' }).formatToParts(new Date(t)); } catch { parts = new Intl.DateTimeFormat('en-US', { timeZone: DEFAULT_ZONE, day: 'numeric', month: 'short' }).formatToParts(new Date(t)); }
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${get('day')} ${get('month')}`;
}

// ---------------------------------------------------------------------------------------------
// Counts: the words of "how many more"

// What each countable badge counts, singular and plural, for "3 more repairs" and "3 of 5 full mocks".
const NOUNS = {
  sessions_10: ['scored set', 'scored sets'],
  full_mocks_5: ['full mock', 'full mocks'],
  repairs_5: ['repair', 'repairs'],
  repairs_10: ['repair', 'repairs'],
  repairs_25: ['repair', 'repairs'],
  four_subjects: ['subject', 'subjects'],
  weeks_met_4: ['week at your goal', 'weeks at your goal'],
  run_weeks_3: ['week in a row', 'weeks in a row'],
};

/**
 * The count toward a badge not earned, only where the board holds an exact one (an entry {current, target}
 * from countEntries()). Null otherwise: nothing is guessed and nothing is shown as 0 of something unknown.
 *   so     "3 of 5 full mocks"
 *   short  "3 of 5"
 *   more   "2 more full mocks"
 */
export function countLeft(stepId, entries) {
  const e = entries?.[stepId];
  const noun = NOUNS[stepId];
  if (!e || !noun || !Number.isFinite(e.current) || !Number.isFinite(e.target) || e.target <= 0 || e.current < 0 || e.current >= e.target) return null;
  const left = e.target - e.current;
  return {
    current: e.current, target: e.target, left, fraction: e.current / e.target,
    so: `${e.current} of ${e.target} ${noun[1]}`,
    short: `${e.current} of ${e.target}`,
    more: `${left} more ${left === 1 ? noun[0] : noun[1]}`,
  };
}

// ---------------------------------------------------------------------------------------------
// The shelf

const flat = (paths) => (paths || []).flatMap((path) => path.steps.map((step) => ({ step, path })));

/** The sections' head: "Badges, 6 of 16". */
export function headLine(paths) {
  const all = flat(paths);
  const earned = all.filter((x) => x.step.status === 'earned').length;
  return `Badges, ${earned} of ${all.length}`;
}

/** Earned badges, newest first. A badge proven but undated has no place in time, so it goes last. */
export function earnedShelf(paths) {
  return flat(paths)
    .map((x, i) => ({ ...x, i }))
    .filter((x) => x.step.status === 'earned')
    .sort((a, b) => {
      const ta = a.step.earnedAt, tb = b.step.earnedAt;
      if (ta != null && tb != null && ta !== tb) return tb - ta;
      if (ta != null && tb == null) return -1;
      if (ta == null && tb != null) return 1;
      return a.i - b.i;
    })
    .map(({ step, path }) => ({ step, path }));
}

/**
 * The one badge to show as the ghost: the one closest to done where an exact count exists (a badge with
 * nothing counted yet is not "close"), else the first not earned in shelf order. A badge the server could not
 * read is never picked. Null when every readable badge is earned.
 */
export function pickNext(paths, entries) {
  const candidates = flat(paths).map((x, i) => ({ ...x, i })).filter((x) => x.step.status === 'next');
  if (!candidates.length) return null;
  const counted = candidates
    .map((x) => ({ ...x, count: countLeft(x.step.id, entries) }))
    .filter((x) => x.count && x.count.current > 0)
    .sort((a, b) => b.count.fraction - a.count.fraction || a.count.left - b.count.left || a.i - b.i);
  const pick = counted[0] || candidates[0];
  return { step: pick.step, path: pick.path };
}

/** The ghost's one line: "Repairs: 7 of 10. 3 more repairs." or, with no exact count, the path and the condition. */
export function ghostLine(step, path, entries) {
  const c = countLeft(step.id, entries);
  return c ? `${path.title}: ${c.short}. ${c.more}.` : `${path.title}. ${step.condition}`;
}

/** The path's action key. "Weeks at your goal" has none of its own in studyBadges.js: practice earns its study days. */
export function actionFor(pathId) {
  const p = BADGE_PATHS.find((x) => x.id === pathId);
  return p?.link || { label: 'Choose practice', href: '/dashboard' };
}

// ---------------------------------------------------------------------------------------------
// The detail sheet

/**
 * The next badge on the same path, after this one. "Your best work" is not a sequence, so there it is the
 * other badge still to earn ("also"). Null when there is none left (or the only one left cannot be read).
 */
export function nextOnPath(paths, stepId) {
  const path = (paths || []).find((p) => p.steps.some((s) => s.id === stepId));
  if (!path) return null;
  const at = path.steps.findIndex((s) => s.id === stepId);
  if (path.id === 'best') {
    const other = path.steps.find((s) => s.id !== stepId && s.status === 'next');
    return other ? { kind: 'also', step: other } : null;
  }
  const next = path.steps.slice(at + 1).find((s) => s.status === 'next' || s.status === 'later');
  return next ? { kind: 'next', step: next } : null;
}

/**
 * "From Accountancy full mock, Sat 17 Oct, 9:12 PM", then the marks. A badge dated by its own paper already says
 * that time on the "Earned" line above it, so the paper's time is added only when it differs. Null without a record:
 * no source is made up.
 */
export function paperLine(record, zone, earnedAt = null) {
  if (!record || !record.attemptId) return null;
  const same = earnedAt != null && toMs(record.at) === toMs(earnedAt);
  const when = same ? '' : whenLine(record.at, zone);
  const marks = Number.isFinite(record.max) && record.max > 0 ? `${record.marks} of ${record.max} marks` : '';
  return {
    attemptId: record.attemptId,
    from: `From ${subjectName(record.subject)} ${paperKind(record.mode)}${when ? `, ${when}` : ''}`,
    marks: marks ? `${marks}${record.before == null ? '' : `, ${record.before} before`}` : '',
  };
}

/**
 * Everything the detail sheet says about one badge, from the board. `entries` are the counts
 * (countEntries()), `records` the paper behind each earned badge, `zone` the student's time zone.
 */
export function detailOf(paths, stepId, { entries = {}, records = {}, zone } = {}) {
  const found = flat(paths).find((x) => x.step.id === stepId);
  if (!found) return null;
  const { step, path } = found;
  const earned = step.status === 'earned';
  const unknown = step.status === 'unknown';
  const count = earned || unknown ? null : countLeft(step.id, entries);
  const next = nextOnPath(paths, step.id);
  const nextCount = next ? countLeft(next.step.id, entries) : null;
  return {
    id: step.id,
    name: step.name,
    condition: step.condition,
    pathId: path.id,
    pathTitle: path.title,
    status: step.status,
    earned,
    unknown,
    earnedLine: earned ? (step.earnedAt != null && !step.undated ? `Earned ${whenLine(step.earnedAt, zone)}` : 'Earned. The date is not recorded yet.') : '',
    paper: earned ? paperLine(records[step.id], zone, step.earnedAt) : null,
    // Not earned: it says so, with the count so far where one exists (never a count that is not exact).
    notYet: !earned && !unknown,
    soFar: earned || unknown || !count ? '' : count.so,
    unknownLine: unknown ? 'This one could not be checked just now.' : '',
    next: next ? { kind: next.kind, id: next.step.id, name: next.step.name, condition: next.step.condition, more: nextCount ? nextCount.more : '', short: nextCount ? nextCount.short : '' } : null,
    action: actionFor(path.id),
    pathDone: !next && !!path.steps.length && path.steps.every((s) => s.status === 'earned'),
  };
}

// ---------------------------------------------------------------------------------------------
// The earned moment on the result

/** A badge earned by a scored set counts for that result when its date is this close to the set's own. */
export const MATCH_MS = 2 * 60 * 1000;
/** After this long a result no longer announces a badge: the moment has passed. */
export const RECENT_MS = 3 * 24 * 60 * 60 * 1000;

export const SEEN_PREFIX = 'mm:badge-seen:';
const seenKey = (id) => `${SEEN_PREFIX}${id}`;

/**
 * The badges this scored set earned: records that name this paper, or (for the papers, weeks and best-work
 * paths, which a set can land) a date within two minutes of the set's own. Repairs are dated by the repair,
 * not by the set, so only a record can tie one to a paper. Earned only with a real date; recent only.
 * @param {Array} paths from badgePathsFromApi()
 * @param {object} records the paper behind each attempt-derived badge (badgePathsFromApi().records)
 * @param {{id:string, completedAt:number|string}} attempt
 */
export function earnedByAttempt(paths, records, attempt, now) {
  const done = toMs(attempt?.completedAt);
  if (!attempt?.id) return [];
  return flat(paths)
    .filter(({ step, path }) => {
      if (step.status !== 'earned' || step.earnedAt == null || step.undated) return false;
      if (Number.isFinite(now) && now - step.earnedAt > RECENT_MS) return false;
      if (records?.[step.id]?.attemptId === attempt.id) return true;
      return path.id !== 'repairs' && done != null && Math.abs(step.earnedAt - done) <= MATCH_MS;
    })
    .map(({ step }) => step);
}

/** True when this badge, with this date, has been shown on a result before on this device. */
export function isSeen(storage, step) {
  try { return storage?.getItem(seenKey(step.id)) === String(step.earnedAt); } catch { return false; }
}

/** Remembers that these badges were shown, with their dates. A blocked storage just means it may show again. */
export function markSeen(storage, steps) {
  for (const s of steps) {
    try { storage?.setItem(seenKey(s.id), String(s.earnedAt)); } catch { /* shown again next time, never an error */ }
  }
}

/** The ones not shown before. */
export function unseen(storage, steps) {
  return steps.filter((s) => !isSeen(storage, s));
}

/** The row's words: "Badge earned" and its name, or "2 badges earned" and both names. */
export function momentWords(steps) {
  if (!steps.length) return null;
  const names = steps.map((s) => s.name);
  return {
    title: steps.length === 1 ? 'Badge earned' : `${steps.length} badges earned`,
    detail: names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`,
    count: steps.length,
  };
}

