// The Mob paper's answer hold (C-dec 2 item 1, 20 Oct): a Mob paper (the weekly paper, or one of the Mob's extra papers)
// keeps its answers, explanations and per-question right or wrong on the server until the paper closes for everyone, so a
// member who has sat it cannot pass the key to a friend who has not. Until then a sitter gets their marks and their counts
// (right, wrong, not answered) and a plain line saying when the answers open. After the close everything opens as for any
// other paper: nothing is stored differently, the hold is only a question of the clock.
//
// The rule, one sentence: before the close, nothing the server sends lets anyone read a key of the paper. That covers the
// result (keys, explanations, which questions were right), the side-by-side (key letters and right or wrong), the shared
// trap (it names a wrong option and whether you got it right), and everything built from the paper's questions elsewhere
// (Review, Revise, traps, Ask Mobi's context, repairs and checks). The teaser (where the Mob's picks split) and the counts
// stay: they never say which option is right.
//
// When it closes:
//   weekly paper  the instant the next week's paper opens: Monday 12:00 AM IST (shown as "Sunday 11:59 PM"), the same
//                 instant after which a sitting no longer counts (model.mjs finishedInWindow).
//   extra paper   the extra paper's own closes_at (made + 7 days). The start stamps it into selection_meta.mobPaper.holdUntil;
//                 an extra paper started before this change has no stamp and holds to the end of the following week, the
//                 latest any extra paper made in that week can close.
//   Mob full mock the game's closes_at (opened + 24 hours; Full mock together, D167), stamped the same way, with the
//                 game's id in mobPaper.gameId.
// No I/O and no clock reads except through `now`: data/tests/mob_paper_hold.test.mjs drives it.
import { nextOpensAt } from './model.mjs';

const DAY_MS = 86_400_000;
const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;
const IST_MS = 330 * 60 * 1000;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const addDays = (key, d) => new Date(Date.parse(`${key}T00:00:00Z`) + d * DAY_MS).toISOString().slice(0, 10);

/** The Mob tag of an attempt, a raw attempts row or a session row: selectionMeta.mobPaper / selection_meta.mobPaper. */
export function mobTagOf(record) {
  if (!isObject(record)) return null;
  const meta = isObject(record.selectionMeta) ? record.selectionMeta : isObject(record.selection_meta) ? record.selection_meta : null;
  const tag = meta?.mobPaper ?? record.mobPaper ?? null;
  if (!isObject(tag) || typeof tag.mobId !== 'string' || !tag.mobId || typeof tag.weekStart !== 'string' || !WEEK_RE.test(tag.weekStart)) return null;
  return tag;
}

/** When a tagged paper's answers open (ms), or null when the tag names no Mob paper. */
export function holdUntilFor(tag) {
  if (!isObject(tag) || typeof tag.weekStart !== 'string' || !WEEK_RE.test(tag.weekStart)) return null;
  const stamped = typeof tag.holdUntil === 'string' ? Date.parse(tag.holdUntil) : NaN;
  if (Number.isFinite(stamped)) return stamped;
  if (tag.extraId || tag.gameId) return Date.parse(nextOpensAt(addDays(tag.weekStart, 7)));
  return Date.parse(nextOpensAt(tag.weekStart));
}

/** The stamp the start writes into selection_meta.mobPaper: when this paper's answers open, as an ISO instant. */
export function holdStamp({ weekStart, extraClosesAt = null }) {
  if (extraClosesAt) {
    const at = Date.parse(extraClosesAt);
    return Number.isFinite(at) ? new Date(at).toISOString() : null;
  }
  return typeof weekStart === 'string' && WEEK_RE.test(weekStart) ? nextOpensAt(weekStart) : null;
}

/** "Sunday 25 Oct, 11:59 PM" in IST. A weekly close (Monday 12:00 AM) reads as the Sunday minute before it. */
export function opensLabel(untilMs) {
  if (!Number.isFinite(untilMs)) return '';
  const local = new Date(untilMs + IST_MS);
  // Midnight on the dot is shown as the minute before it: the paper is open all of Sunday.
  const shown = local.getUTCHours() === 0 && local.getUTCMinutes() === 0 && local.getUTCSeconds() === 0 ? new Date(local.getTime() - 60_000) : local;
  const h = shown.getUTCHours();
  const m = shown.getUTCMinutes();
  const clock = `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  return `${DAYS[shown.getUTCDay()]} ${shown.getUTCDate()} ${MONTHS[shown.getUTCMonth()]}, ${clock}`;
}

/** "in 5 days", "in 3 hours", "in 20 minutes": how long until the answers open, never a false precision. */
export function opensIn(untilMs, now) {
  const left = untilMs - now;
  const HOUR = 3_600_000;
  if (!(left > 0)) return 'in a moment';
  if (left >= 2 * 24 * HOUR) return `in ${Math.floor(left / (24 * HOUR))} days`;
  if (left >= 24 * HOUR) return 'in a day';
  if (left >= 2 * HOUR) return `in ${Math.floor(left / HOUR)} hours`;
  if (left >= HOUR) return 'in an hour';
  const minutes = Math.max(1, Math.ceil(left / 60_000));
  return minutes === 1 ? 'in a minute' : `in ${minutes} minutes`;
}

/** The copy of a held result, in one place for the server, the website and (mirrored) the app. */
export function holdCopy(untilMs, kind = 'weekly') {
  const when = opensLabel(untilMs);
  const paper = kind === 'mock' ? 'this Mob full mock' : kind === 'extra' ? 'this extra paper' : 'this week\'s paper';
  return {
    title: `The answers open on ${when.split(',')[0]}`,
    line: `${paper[0].toUpperCase()}${paper.slice(1)} stays open for your Mob until ${when}, so its answers and explanations stay closed until then and nobody can pass them on. Then you can see every answer, fix your mistakes and compare with your Mob.`,
    short: `The answers open on ${when}.`,
  };
}

/**
 * The hold on one attempt (or raw row), or null when it is not a Mob paper or its paper has closed.
 * { until: ISO, kind: 'weekly' | 'extra' | 'mock', mobId, weekStart, extraId?, gameId?, title, line, short }
 */
export function attemptHold(record, now = Date.now()) {
  const tag = mobTagOf(record);
  if (!tag) return null;
  const until = holdUntilFor(tag);
  if (!Number.isFinite(until) || now >= until) return null;
  const kind = tag.gameId ? 'mock' : tag.extraId ? 'extra' : 'weekly';
  return { until: new Date(until).toISOString(), kind, mobId: tag.mobId, weekStart: tag.weekStart, ...(tag.extraId ? { extraId: tag.extraId } : {}), ...(tag.gameId ? { gameId: tag.gameId } : {}), ...holdCopy(until, kind) };
}

/** True while a tagged paper (a Mob tag, or a hold) is held at `now`. */
export const isHeld = (record, now = Date.now()) => attemptHold(record, now) !== null;

/** The attempts whose paper is open (every attempt but a held Mob paper). Order kept. */
export const openAttemptsOnly = (attempts, now = Date.now()) => (Array.isArray(attempts) ? attempts.filter((a) => !isHeld(a, now)) : attempts);

const SAFE_META = ['mode', 'sessionId', 'scoringVersion', 'durationMinutes', 'learningPurpose'];

/**
 * A held attempt as every client gets it: who, what subject, the marks and the counts, when; no question, no key, no
 * explanation and no per-question right or wrong. `details` and `questionsSnapshot` are empty arrays (never missing), so
 * an older app shows its marks-only result (its "no rows" state) instead of failing; a newer client reads `mobHold`.
 */
export function heldAttemptView(attempt, hold) {
  const a = isObject(attempt) ? attempt : {};
  const meta = isObject(a.selectionMeta) ? a.selectionMeta : {};
  const safeMeta = {};
  for (const key of SAFE_META) if (meta[key] !== undefined && meta[key] !== null) safeMeta[key] = meta[key];
  const tag = mobTagOf(a);
  if (tag) safeMeta.mobPaper = { mobId: tag.mobId, weekStart: tag.weekStart, ...(tag.extraId ? { extraId: tag.extraId } : {}), ...(tag.gameId ? { gameId: tag.gameId } : {}) };
  safeMeta.mobHold = hold;
  const out = {
    id: a.id, userId: a.userId, subject: a.subject,
    score: a.score, correct: a.correct, wrong: a.wrong, unattempted: a.unattempted, total: a.total,
    details: [], questionsSnapshot: [], selectionMeta: safeMeta,
    completedAt: a.completedAt, mobHold: hold,
  };
  for (const key of ['mode', 'formatId', 'paper']) if (a[key] !== undefined) out[key] = a[key];
  return out;
}

/** An attempt as a client may see it at `now`: the held view while its Mob paper is open, else unchanged. */
export function attemptForClient(attempt, now = Date.now()) {
  const hold = attemptHold(attempt, now);
  return hold ? heldAttemptView(attempt, hold) : attempt;
}

/**
 * The side-by-side while its paper is open: picks, split, time and changes stay (they never say which option is right);
 * every key letter, every right or wrong and the trap are taken out, and `held` says when they open.
 */
export function heldCompare(compare, hold) {
  if (!isObject(compare) || !hold) return compare;
  const row = (r) => (isObject(r) ? { ...r, right: null } : r);
  return {
    ...compare,
    held: hold,
    questions: (Array.isArray(compare.questions) ? compare.questions : []).map((q) => ({
      ...q, key: null, trap: null, you: row(q.you), others: Array.isArray(q.others) ? q.others.map(row) : q.others,
    })),
  };
}
