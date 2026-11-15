// The Sunday Mock (15 Nov 2026): one fixed full paper per subject each week, the same paper for everyone sitting that
// subject, open on Sunday from 10:00 AM to 10:00 PM IST, free for every signed-in student, one sitting per subject a week.
// This is the pure model: the clock, the window, who may start, what counts, the answer hold's tag, the counts after the
// close and every sentence the student reads. No I/O and no clock reads except through `now`, so node:test drives it
// (src/lib/sundayMock.test.mjs). The server half is src/lib/server/sunday/ (service.js decides, store.js reads and writes).
//
// How it is built on what exists (no migration):
//   the paper     the subject's normal Full mock (data/test_modes.js full: 50 questions, 60 minutes, +5 and -1), drawn once
//                 from the central bank by the full-mock selector at the week's first start and held in that start's
//                 learning_allowances row (kind 'sunday_mock', period '<sunday>:<subject>'); every later start reads it.
//   the start     the practice engine's server-only Mob-paper path (practiceSessions.js startPractice, server.mobPaper):
//                 no credits and no daily allowance, never the free first full mock. Only the Sunday service passes it,
//                 with the frozen questions and a key derived on the server, so it opens this week's paper and no other.
//   the hold      the attempt is tagged selection_meta.mobPaper = { mobId: SUNDAY_TAG, weekStart: <sunday>, holdUntil: 10 PM },
//                 so every place that already holds a Mob paper's key (the result, Review, Revise, repairs, checks, Ask
//                 Mobi, the lean attempt reads) holds this one until 10:00 PM too (src/lib/mob/paperHold.mjs, kind 'sunday').
//   the counts    attempts carrying that tag for the week and subject, finished inside the window's last legal minute.

export const SUNDAY_TAG = 'sunday-mock';
export const SUNDAY_KIND = 'sunday_mock';
export const SUNDAY_NAME = 'Sunday Mock';
export const OPEN_HOUR = 10; // 10:00 AM IST
export const CLOSE_HOUR = 22; // 10:00 PM IST: the last start, and the moment the answers open
export const PAPER_COUNT = 50; // data/test_modes.js full.fixedCount
export const PAPER_MINUTES = 60; // data/test_modes.js full.fixedDurationSec / 60
export const MARK_RIGHT = 5;
export const MARK_WRONG = 1;
// The finish paths' own grace after a paper's deadline (finishPractice and finishSession refuse a send later than this).
export const FINISH_GRACE_MS = 2 * 60_000;
// The share of sitters who got a question right is shown only once this many sat the paper (owner decision).
export const SHARE_FLOOR = 30;
// A frozen question withdrawn later in the day is replaced from the bank while at least this many of the 50 still serve.
export const MIN_FROZEN = 45;

const IST_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
const MINUTE = 60_000;
const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const isWeekKey = (v) => typeof v === 'string' && WEEK_RE.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(Date.parse(`${v}T00:00:00Z`)).getUTCDay() === 0;

/** The IST calendar day of an instant, 'YYYY-MM-DD'. */
export const istKey = (ms) => new Date(ms + IST_MS).toISOString().slice(0, 10);
/** The IST weekday of an instant, 0 Sunday to 6 Saturday. */
export const istDow = (ms) => new Date(ms + IST_MS).getUTCDay();
export const addDays = (key, n) => new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
/** An IST wall-clock hour on a day key, as an instant. */
const at = (key, hour) => Date.parse(`${key}T${String(hour).padStart(2, '0')}:00:00+05:30`);

/**
 * One Sunday's window: opensAt (10:00 AM), closesAt (10:00 PM: the last start and the moment the answers open) and
 * lastFinishAt (a paper started at the last moment, its 60 minutes and the finish grace: nothing later is ever counted).
 */
export function sundayWindow(week) {
  const opensAt = at(week, OPEN_HOUR);
  const closesAt = at(week, CLOSE_HOUR);
  return { week, opensAt, closesAt, answersAt: closesAt, lastFinishAt: closesAt + PAPER_MINUTES * MINUTE + FINISH_GRACE_MS };
}

/** This week's Sunday: today on a Sunday, else the coming one. Monday to Saturday all point at the same Sunday. */
export function sundayOf(now) {
  const key = istKey(now);
  const dow = istDow(now);
  return dow === 0 ? key : addDays(key, 7 - dow);
}

/**
 * Where the clock stands: { week, phase, opensAt, closesAt, lastFinishAt, dow, previous, next }.
 *   phase 'before'  this week's paper has not opened (Monday to Saturday, and Sunday before 10:00 AM)
 *         'open'    Sunday 10:00 AM to 9:59 PM: a first start is allowed
 *         'closed'  Sunday from 10:00 PM: no first start; the answers and the counts are open
 * previous is the Sunday before `week` (always closed); next is the Sunday after it.
 */
export function sundayState(now) {
  const week = sundayOf(now);
  const win = sundayWindow(week);
  const phase = now < win.opensAt ? 'before' : now < win.closesAt ? 'open' : 'closed';
  return { ...win, phase, dow: istDow(now), previous: addDays(week, -7), next: addDays(week, 7) };
}

/**
 * Why a FIRST start is refused at `now`, or null when it may start. A sitting already started (its claim exists) is not
 * asked this: it resumes until its own deadline, which the practice engine keeps (start + 60 minutes + the grace).
 */
export function startRefusal(state) {
  if (!state) return 'NOT_OPEN';
  if (state.phase === 'before') return 'NOT_OPEN';
  if (state.phase === 'closed') return 'CLOSED';
  return null;
}

/** May a paper started at `startedAt` still be sent at `now`? The finish paths' rule, said once for the counts and tests. */
export const sendAllowed = (startedAt, now) => Number.isFinite(startedAt) && Number.isFinite(now) && now <= startedAt + PAPER_MINUTES * MINUTE + FINISH_GRACE_MS;

/** Does a sitting finished at `completedAt` count for `week`? Only one finished between the open and the last legal send. */
export function countsFor(week, completedAt) {
  if (!isWeekKey(week) || !Number.isFinite(completedAt)) return false;
  const win = sundayWindow(week);
  return completedAt >= win.opensAt && completedAt <= win.lastFinishAt;
}

/** The attempt's tag (selection_meta.mobPaper): held by paperHold.mjs until 10:00 PM on the paper's Sunday. */
export function sundayTag(week) {
  return { mobId: SUNDAY_TAG, weekStart: week, holdUntil: new Date(sundayWindow(week).closesAt).toISOString() };
}

/** A tag (selection_meta.mobPaper or the held view's) that names a Sunday Mock. */
export const isSundayTag = (tag) => Boolean(tag && typeof tag === 'object' && tag.mobId === SUNDAY_TAG && isWeekKey(tag.weekStart));

/** The Sunday a tagged attempt or record was sat on, or null. */
export function sundayWeekOf(record) {
  const meta = record?.selectionMeta || record?.selection_meta || null;
  const tag = meta?.mobPaper || record?.mobPaper || record?.mobHold || null;
  return isSundayTag(tag) ? tag.weekStart : null;
}

/** The claim row's period: one per student, Sunday and subject (the table's primary key is the one-sitting lock). */
export const claimPeriod = (week, subject) => `${week}:${subject}`;

/** The claim row's reference: when this student first started and the frozen paper (question ids in paper order). */
export function claimReference({ startedAt, ids }) {
  const list = (ids || []).map(String);
  if (!Number.isFinite(startedAt) || !list.length || list.some((id) => !id || id.includes(',') || id.includes(':'))) throw new Error('SUNDAY_CLAIM_INPUT');
  return `v1:${Math.trunc(startedAt)}:${list.join(',')}`;
}

/** { startedAt, ids } from a claim reference, or null for anything else. */
export function parseClaim(reference) {
  const m = /^v1:(\d{1,16}):(.+)$/.exec(String(reference || ''));
  if (!m) return null;
  const ids = m[2].split(',').filter(Boolean);
  return ids.length ? { startedAt: Number(m[1]), ids } : null;
}

/** Marks as the result counts them: +5 right, -1 wrong, of 5 a question. */
export function marksOf(a) {
  const right = Math.max(0, Number(a?.correct) || 0);
  const wrong = Math.max(0, Number(a?.wrong) || 0);
  const total = Math.max(0, Number(a?.total) || 0);
  return { scored: right * MARK_RIGHT - wrong * MARK_WRONG, max: total * MARK_RIGHT };
}

/**
 * The counts after the close from the week's sittings: { week, sat, shares }. `rows` are [{ userId, completedAt, details }]
 * (details: the attempt's [{ qid, isCorrect }]). One sitting a student; a sitting that does not count (countsFor) is left
 * out. shares is { qid: whole percent who got it right } once SHARE_FLOOR or more sat, and only for a question at least that
 * many were served; null below the floor. The marks stay on the attempts (a later ranking line would read them there).
 */
export function sundayStats(rows, { week, floor = SHARE_FLOOR } = {}) {
  const seen = new Set();
  const per = new Map();
  let sat = 0;
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || !r.userId || seen.has(r.userId) || !countsFor(week, r.completedAt)) continue;
    seen.add(r.userId);
    sat += 1;
    for (const d of Array.isArray(r.details) ? r.details : []) {
      if (!d || typeof d.qid !== 'string') continue;
      const e = per.get(d.qid) || { right: 0, of: 0 };
      e.of += 1;
      if (d.isCorrect === true) e.right += 1;
      per.set(d.qid, e);
    }
  }
  if (sat < floor) return { week, sat, shares: null };
  const shares = {};
  for (const [qid, e] of per) if (e.of >= floor) shares[qid] = Math.round((100 * e.right) / e.of);
  return { week, sat, shares };
}

// ---------- Words ----------

/** "10:00 AM" in IST. */
export function timeLabel(ms) {
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms + IST_MS);
  const h = d.getUTCHours();
  return `${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "Sunday 22 Nov" for a week key. */
export function dateLabel(week) {
  if (!isWeekKey(week)) return '';
  const d = new Date(Date.parse(`${week}T00:00:00Z`));
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

const count = (n, one, many) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;

export const SUNDAY_COPY = Object.freeze({
  name: SUNDAY_NAME,
  what: 'One full paper in each of your subjects, the same paper for everyone, every Sunday from 10:00 AM to 10:00 PM. 50 questions, 60 minutes, marked +5 and −1, free.',
  format: '50 questions · 60 minutes · +5 / −1 · free',
  once: 'One sitting a subject each Sunday. A paper started by 10:00 PM keeps its full 60 minutes.',
  held: 'Your marks show as soon as you send it. The answers and explanations open at 10:00 PM, when the paper closes for everyone.',
  sitIt: 'Sit it',
  resume: 'Resume',
  chooseSubject: 'Choose a subject',
  seeResult: 'See your result',
  notYet: 'Not yet',
  satPrivate: 'Sat it',
  noSubjects: 'Add your subjects to sit the Sunday Mock in them.',
  addSubjects: 'Add your subjects',
  loadFailed: 'The Sunday Mock did not load.',
  tryAgain: 'Try again',
});

/** "Opens tomorrow at 10:00 AM" / "Opens today at 10:00 AM" / "Opens Sunday 22 Nov at 10:00 AM". */
export function opensLine(state) {
  if (!state) return '';
  const when = timeLabel(state.opensAt);
  if (state.dow === 6) return `Opens tomorrow at ${when}`;
  if (state.dow === 0 && state.phase === 'before') return `Opens today at ${when}`;
  return `Opens ${dateLabel(state.week)} at ${when}`;
}

/** "Open until 10:00 PM" while open. */
export const openUntilLine = (state) => `Open until ${timeLabel(state?.closesAt)}`;

/** "Sunday 29 Nov, 10:00 AM to 10:00 PM" for a week. */
export function windowLine(week) {
  const win = sundayWindow(week);
  return `${dateLabel(week)}, ${timeLabel(win.opensAt)} to ${timeLabel(win.closesAt)}`;
}

/** "182/250" */
export const marksLine = (marks) => (marks && Number.isFinite(marks.scored) && Number.isFinite(marks.max) ? `${marks.scored}/${marks.max}` : '');

/** "1,240 students sat this paper." Never a rank, a percentile or a place. */
export const satLine = (n) => (Number.isInteger(n) && n > 0 ? `${count(n, 'student', 'students')} sat this paper.` : '');

/** The line under a question after the close, once enough sat: "64% got it right". */
export const shareLine = (pct) => (Number.isInteger(pct) ? `${pct}% got it right` : '');

/** The runner's draft key for a Sunday paper on this device (the server derives its own key; this only names the draft). */
export const sundayDraftKey = (week, subject) => `sunday-${week}-${subject}`;

/** The runner link for a subject's Sunday paper this week. `subject` is the subject's public id. */
export function sundayPaperHref(week, subject) {
  return `/test?${new URLSearchParams({ subject, mode: 'full', count: String(PAPER_COUNT), sunday: '1', generationKey: sundayDraftKey(week, subject) })}`;
}

export const resultHref = (id) => `/result/${encodeURIComponent(id)}`;

/**
 * The start route's refusals, as the runner shows them: { title, message } in plain words. `code` is the route's error code;
 * `ctx` { opensAt, closesAt, subjectName }.
 */
export function startRefusalCopy(code, ctx = {}) {
  const name = ctx.subjectName || 'this subject';
  switch (code) {
    case 'NOT_OPEN': return { title: 'The Sunday Mock is not open yet', message: `It opens on ${dateLabel(ctx.week)} at ${timeLabel(ctx.opensAt)} and stays open until ${timeLabel(ctx.closesAt)}.` };
    case 'CLOSED': return { title: 'This Sunday’s paper has closed', message: `The last start was at ${timeLabel(ctx.closesAt)}. The next one opens on ${dateLabel(ctx.next)} at ${timeLabel(ctx.opensAt)}.` };
    case 'NOT_YOUR_SUBJECT': return { title: `${name} is not one of your subjects`, message: 'The Sunday Mock is for the subjects you study. Add it to your subjects first.' };
    case 'PAPER_UNAVAILABLE': return { title: 'This paper could not be put together', message: `There are not enough checked ${name} questions for a full paper this week. Try another of your subjects.` };
    case 'PAPER_EXPIRED': return { title: 'Your time on this paper is over', message: 'You started it earlier and its 60 minutes have passed. One sitting a subject each Sunday.' };
    case 'SUBJECT_NOT_SUPPORTED': return { title: 'This subject has no Sunday Mock', message: 'Choose one of your subjects on the Sunday Mock page.' };
    default: return { title: 'The paper did not open', message: 'Something went wrong on our side. Try again in a moment.' };
  }
}

/** The answer hold's words for a Sunday paper (src/lib/mob/paperHold.mjs holdCopy, kind 'sunday'). */
export function sundayHoldCopy(untilMs) {
  const when = timeLabel(untilMs);
  return {
    title: `The answers open at ${when}`,
    line: `The Sunday Mock is open for everyone until ${when}, so its answers and explanations stay closed until then and nobody can pass them on. Then you can see every answer and fix your mistakes.`,
    short: `The answers open at ${when}.`,
  };
}

/**
 * One subject's state this week, from the student's own facts: 'sat' | 'started' | 'unsent' | 'open' | 'soon' | 'closed'.
 *   sat      a sent paper (attempt) for this Sunday and subject
 *   started  a start on record whose 60 minutes and grace are not over: it resumes
 *   unsent   a start on record whose time is over and that was never sent (the one sitting is used)
 *   open     no start yet, and a first start is allowed now
 *   soon     not open yet; closed: no start and the window is over
 */
export function subjectState({ state, attempt = null, claim = null, now }) {
  if (attempt) return 'sat';
  if (claim && Number.isFinite(claim.startedAt)) return sendAllowed(claim.startedAt, now) ? 'started' : 'unsent';
  if (!state) return 'soon';
  return state.phase === 'open' ? 'open' : state.phase === 'before' ? 'soon' : 'closed';
}
