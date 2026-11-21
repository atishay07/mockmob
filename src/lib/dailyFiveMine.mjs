// "Your five" (owner LK365, 21 Nov 2026; design tmp/1121-stories/DAILY-SPEC.md): a signed-in student's Daily Five built from
// their own record, so the five are where yesterday's mistakes get fixed. Guests keep the shared five (src/lib/dailyFive.mjs).
// This file is the pure half: the mix, the hand-on rules, the seed, the cookie's payload, the labels' words and the page's
// reading of GET /api/daily/mine. Browser-safe (it imports only dailyFive.mjs and demoSample.mjs, both already on the page),
// so node --test holds it (data/tests/daily_mine_1121.test.mjs). The reads are src/lib/server/dailyFiveMine.js.
//
// The mix, places 1 to 5:
//   1-2 `missed`   questions the student answered wrong before today, newest first, at most one a chapter
//   3-4 `weak`     questions the student has not seen, from their weakest chapters (data/learning_weak.js), one chapter each
//   5   `subject`  a question they have not seen from one of their chosen subjects, the subject turning with the day number
// A kind that cannot fill its places hands them on: missed to weak to subject. Fewer than five in all: no personal five.
// A place already answered today keeps its question (its stored row), and its kind counts toward that kind's places, so a
// reload rebuilds the other places the same way.
import { DAILY_FIVE_SIZE, dateOfDay, isDateKey, shortDate } from './dailyFive.mjs';
import { demoPastPaperLabel } from './demoSample.mjs';

export const DAILY_MINE_ROUTE = '/api/daily/mine';
export const MINE_KINDS = Object.freeze(['missed', 'weak', 'subject']);
/** The places each kind asks for before any hand-on (2 + 2 + 1 = DAILY_FIVE_SIZE). */
export const MINE_PLAN = Object.freeze({ missed: 2, weak: 2, subject: 1 });
/**
 * Why there is no personal five (the page plays the shared five), except `retry`: the student's own five is under way today
 * (an answered place holds one of its questions) but could not be read just now. The shared five would then be played over
 * those places, so the page offers Try again instead (review 21 Nov 2026).
 */
export const MINE_REASONS = Object.freeze(['off', 'no_subjects', 'thin_bank', 'shared_started', 'unavailable', 'retry']);
/** The httpOnly cookie that keeps today's five the same all day (sealed on the server; the page never reads it). */
export const MINE_COOKIE = 'mm_daily_mine';

/**
 * Every read GET /api/daily/mine may make, bounded (src/lib/server/dailyFiveMine.js):
 *   missedRows      the newest wrong answers read from user_question_progress
 *   attempts        the newest papers read for weak chapters (Database.getAttempts, slim 'plan')
 *   weakChapters    the weakest chapters tried, at most
 *   lightRows       candidate ids read (seven small columns, no text) per chapter or subject window
 *   subjects        the student's subjects tried for the `subject` place, at most
 *   fullBatch       question rows read whole at a time
 *   firstSpare      the first whole read of a pool asks for the questions it needs plus this many (a whole row carries the
 *                   signed evidence record, 35 to 40 KB on an evidence row); a pool that needs more then reads fullBatch
 *   fullRowsPerPool whole rows read for one chapter, subject or the missed list, at most
 *   fullRowsTotal   whole rows read in one request, at most
 */
export const MINE_LIMITS = Object.freeze({
  missedRows: 40, attempts: 10, weakChapters: 6, lightRows: 80, subjects: 3, fullBatch: 16, firstSpare: 2, fullRowsPerPool: 32, fullRowsTotal: 160,
});

/** The kill switch: on unless DAILY_MINE_ENABLED is the string 'false'. */
export const mineEnabled = (env = {}) => String(env?.DAILY_MINE_ENABLED ?? '').trim().toLowerCase() !== 'false';

// ---------------------------------------------------------------------------------------------------------------------
// The seed: the same (student, IST date) always ranks the same candidates the same way, on every server.

function fnv(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
const hex8 = (n) => (n >>> 0).toString(16).padStart(8, '0');

export const mineSeed = (userId, date) => `mockmob-daily-mine-v1:${userId}:${date}`;
/** A stable rank key for one id under a seed (two rounds of FNV-1a, 16 hex characters). */
export const rankKey = (seed, id) => `${hex8(fnv(`${seed}:${id}`))}${hex8(fnv(`${id}:${seed}`))}`;
/** The ids in the seed's order. */
export const rankIds = (ids, seed) => [...new Set(ids)].map((id) => [rankKey(seed, id), id]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([, id]) => id);
/** Where a seeded window of a subject's ids starts (question ids are uuids: lowercase hex, so this spreads evenly). */
export const windowStart = (seed, salt) => hex8(fnv(`${seed}:${salt}`));

/** The student's subjects, the day's first: subject (day - 1) mod n, then the rest in turn. */
export function subjectTurn(subjects, day) {
  const list = [...new Set((Array.isArray(subjects) ? subjects : []).filter((s) => typeof s === 'string' && s))];
  if (!list.length || !Number.isInteger(day)) return list;
  const at = (((day - 1) % list.length) + list.length) % list.length;
  return [...list.slice(at), ...list.slice(0, at)];
}

/**
 * The weakest chapters from data/learning_weak.js weakChapters (one entry per wrong answer in the newest papers): each
 * (subject, chapter) once, the most missed first, ties by the newest. `subjectOf` maps a stored subject to the bank's id
 * (or null to drop it).
 */
export function weakRanking(entries, { max = MINE_LIMITS.weakChapters, subjectOf = (s) => s } = {}) {
  const seen = new Map();
  (Array.isArray(entries) ? entries : []).forEach((e, i) => {
    const subject = e?.subject ? subjectOf(e.subject) : null;
    const chapter = typeof e?.chapter === 'string' ? e.chapter.trim() : '';
    if (!subject || !chapter) return;
    const key = `${subject}\u0001${chapter}`;
    const had = seen.get(key);
    if (had) had.misses += 1; else seen.set(key, { subject, chapter, misses: 1, first: i });
  });
  return [...seen.values()].sort((a, b) => b.misses - a.misses || a.first - b.first).slice(0, max).map(({ subject, chapter, misses }) => ({ subject, chapter, misses }));
}

/** The IST date of an instant ('YYYY-MM-DD'), or null. */
export function istDateOf(at) {
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t + 330 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * The missed list from user_question_progress rows (last_correct false, newest first): the questions answered wrong
 * BEFORE today, each once, as [{ id, since }]. `keep` ids (today's answered places) stay in even when answered today.
 */
export function missedList(rows, today, keep = new Set()) {
  const first = [];
  const rest = [];
  const seen = new Set();
  const chapters = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    const id = row?.question_id;
    if (typeof id !== 'string' || !id || seen.has(id)) continue;
    const since = istDateOf(row.last_attempted_at);
    if (!keep.has(id) && (!since || since >= today)) continue;
    seen.add(id);
    // One question of each chapter first (newest first), then the others: the five take at most one a chapter.
    const chapter = `${row.subject ?? ''}\u0001${row.chapter ?? ''}`;
    (chapters.has(chapter) ? rest : first).push({ id, since: since && since < today ? since : null });
    chapters.add(chapter);
  }
  return [...first, ...rest];
}

// ---------------------------------------------------------------------------------------------------------------------
// The assembly.

const chapterKeyOf = (q) => `${q?.subjectId ?? q?.subject ?? ''}\u0001${q?.chapterKey ?? q?.chapter ?? ''}`;

/**
 * The five from resolved pools (every question already servable and drawable; ids unique per pool):
 *   pinned   [{ n, kind, q }]   today's answered places, kept where they are
 *   missed   [q]                in order (newest wrong first)
 *   weak     [[q]]              one list per chapter, weakest chapter first
 *   subject  [q]                in order
 * Each q is { id, chapterKey?, subjectId?, ... }. Answers [{ n, kind, q }] x5 in place order, or null when five cannot be
 * filled. The new picks fill the open places in order: missed first, then weak, then subject.
 */
export function assembleFive({ pinned = [], missed = [], weak = [], subject = [] } = {}) {
  const places = new Array(DAILY_FIVE_SIZE).fill(null);
  const used = new Set();
  const chaptersOf = { missed: new Set(), weak: new Set() };
  const counts = { missed: 0, weak: 0, subject: 0 };
  for (const p of Array.isArray(pinned) ? pinned : []) {
    if (!p?.q?.id || !Number.isInteger(p.n) || p.n < 1 || p.n > DAILY_FIVE_SIZE || places[p.n - 1] || used.has(p.q.id)) return null;
    const kind = MINE_KINDS.includes(p.kind) ? p.kind : 'subject';
    places[p.n - 1] = { n: p.n, kind, q: p.q };
    used.add(p.q.id);
    counts[kind] += 1;
    if (chaptersOf[kind]) chaptersOf[kind].add(chapterKeyOf(p.q));
  }
  const open = DAILY_FIVE_SIZE - places.filter(Boolean).length;
  const picks = [];
  const take = (kind, q) => { used.add(q.id); picks.push({ kind, q }); if (chaptersOf[kind]) chaptersOf[kind].add(chapterKeyOf(q)); };

  let want = Math.min(open, Math.max(0, MINE_PLAN.missed - counts.missed));
  for (const q of missed) {
    if (picks.length >= want) break;
    if (!q?.id || used.has(q.id) || chaptersOf.missed.has(chapterKeyOf(q))) continue;
    take('missed', q);
  }
  const missedShort = want - picks.length;

  want = Math.min(open - picks.length, Math.max(0, MINE_PLAN.weak - counts.weak) + missedShort);
  let got = 0;
  for (const list of Array.isArray(weak) ? weak : []) {
    if (got >= want) break;
    const q = (Array.isArray(list) ? list : []).find((c) => c?.id && !used.has(c.id) && !chaptersOf.weak.has(chapterKeyOf(c)));
    if (!q) continue;
    take('weak', q);
    got += 1;
  }

  want = open - picks.length;
  for (const q of subject) {
    if (want <= 0) break;
    if (!q?.id || used.has(q.id)) continue;
    take('subject', q);
    want -= 1;
  }
  if (picks.length < open) return null;
  let at = 0;
  for (let i = 0; i < DAILY_FIVE_SIZE; i += 1) if (!places[i]) places[i] = { n: i + 1, ...picks[at++] };
  return places;
}

/** { missed, weak, subject } counted from a five. */
export function mineMix(places) {
  const mix = { missed: 0, weak: 0, subject: 0 };
  for (const p of Array.isArray(places) ? places : []) if (MINE_KINDS.includes(p?.kind)) mix[p.kind] += 1;
  return mix;
}

// ---------------------------------------------------------------------------------------------------------------------
// The cookie's payload (sealed on the server): today's five for one student, so a reload gets the same five.

const ID = /^[A-Za-z0-9_.:-]{1,120}$/;

/** The compact payload: { v, d, u, q: [[id, kind, since], x5] }. */
export function minePayload({ date, userId, places }) {
  return { v: 1, d: date, u: userId, q: places.map((p) => [p.q.id, p.kind, p.since || '']) };
}

/** The places a payload holds for this date and student: [{ n, id, kind, since }] x5, or null. */
export function readMinePayload(payload, { date, userId }) {
  if (!payload || payload.v !== 1 || payload.d !== date || payload.u !== userId || !Array.isArray(payload.q) || payload.q.length !== DAILY_FIVE_SIZE) return null;
  const out = [];
  const ids = new Set();
  for (const [i, item] of payload.q.entries()) {
    if (!Array.isArray(item)) return null;
    const [id, kind, since] = item;
    if (typeof id !== 'string' || !ID.test(id) || ids.has(id) || !MINE_KINDS.includes(kind)) return null;
    ids.add(id);
    out.push({ n: i + 1, id, kind, since: kind === 'missed' && isDateKey(since) ? since : null });
  }
  return out;
}

/**
 * The tag a personal answer's row keeps in its metadata (`mine`): { k, since?, r? }, or null. `r` is a random mark of the
 * check that wrote the row, so "this check's row stood" is told apart from a second check of the same place even in the same
 * millisecond (src/lib/server/dailyFiveAccount.js recordCheck).
 */
export function mineTag(kind, since = null, mark = null) {
  if (!MINE_KINDS.includes(kind)) return null;
  const r = typeof mark === 'string' && /^[A-Za-z0-9_-]{6,24}$/.test(mark) ? { r: mark } : {};
  return kind === 'missed' && isDateKey(since) ? { k: kind, since, ...r } : { k: kind, ...r };
}
/** The kind and date a stored row's tag holds: { kind, since }, or null. */
export function readTag(tag) {
  if (!tag || typeof tag !== 'object' || !MINE_KINDS.includes(tag.k)) return null;
  return { kind: tag.k, since: tag.k === 'missed' && isDateKey(tag.since) ? tag.since : null };
}

// ---------------------------------------------------------------------------------------------------------------------
// The words (sentence case, no dash between clauses, no exclamation mark; every figure from the five itself).

export const MINE_COPY = Object.freeze({
  head: 'Your five for today',
  guest: 'Sign up and your five come from your own subjects and mistakes.',
  doneHead: 'What today’s five did',
});

/** The label above a question's stem: why it is in the student's five. */
export function mineLabel(why) {
  const chapter = typeof why?.chapter === 'string' ? why.chapter.trim() : '';
  const subject = typeof why?.subject === 'string' ? why.subject.trim() : '';
  switch (why?.kind) {
    case 'missed': return why.since && isDateKey(why.since) ? `You missed this on ${shortDate(why.since)}` : 'You missed this before';
    case 'weak': return chapter ? `Your weak chapter: ${chapter}` : 'From your weak chapters';
    case 'subject': return subject ? `New from ${subject}` : 'New for you';
    default: return '';
  }
}

/** "2 you missed, 2 from your weak chapters, 1 new": only the parts above zero. */
export function mixLine(mix) {
  const n = (k) => (Number.isInteger(mix?.[k]) && mix[k] > 0 ? mix[k] : 0);
  return [
    n('missed') ? `${n('missed')} you missed` : null,
    n('weak') ? `${n('weak')} from your weak chapters` : null,
    n('subject') ? `${n('subject')} new` : null,
  ].filter(Boolean).join(', ');
}

/** The day's honest counts from the checks' `fed` values: { fixed, sent }. */
export function fedCounts(checks) {
  const out = { fixed: 0, sent: 0 };
  for (const c of Array.isArray(checks) ? checks : []) {
    const fed = c && typeof c === 'object' ? c.fed : c;
    if (fed === 'fixed') out.fixed += 1;
    if (fed === 'mistakes') out.sent += 1;
  }
  return out;
}

/** ["1 mistake fixed", "2 sent back to your mistakes"]: only the parts above zero. */
export function fedLines({ fixed = 0, sent = 0 } = {}) {
  return [
    fixed > 0 ? `${fixed} ${fixed === 1 ? 'mistake' : 'mistakes'} fixed` : null,
    sent > 0 ? `${sent} sent back to your mistakes` : null,
  ].filter(Boolean);
}

// ---------------------------------------------------------------------------------------------------------------------
// The page's reading of GET /api/daily/mine.

const text = (v, max) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null);
const SLUG = /^[a-z][a-z-]{1,39}$/;
const TOKEN = /^[A-Za-z0-9_.-]{20,2000}$/;

/**
 * The route's answer as the page plays it: { personal: false, reason } (play the shared five), or
 * { personal: true, day, date, questions: [{ slug, subject, q, options, chapter, pastPaper?, token, why }] x5, mix }
 * (`subject` is the display name, as acceptDailyFive gives it), or null for anything else (play the shared five too).
 */
export function acceptMine(body) {
  if (!body || typeof body !== 'object' || body.ok !== true) return null;
  if (body.personal === false) return { personal: false, reason: MINE_REASONS.includes(body.reason) ? body.reason : 'unavailable' };
  if (body.personal !== true) return null;
  const { day, date } = body;
  if (!Number.isInteger(day) || day < 1 || dateOfDay(day) !== date) return null;
  const list = Array.isArray(body.questions) ? body.questions : [];
  if (list.length !== DAILY_FIVE_SIZE) return null;
  const questions = [];
  for (const item of list) {
    const slug = typeof item?.subject === 'string' && SLUG.test(item.subject) ? item.subject : null;
    const q = text(item?.q, 600);
    const options = Array.isArray(item?.options) && item.options.length === 4 ? item.options.map((o) => text(o, 300)) : [];
    const token = typeof item?.token === 'string' && TOKEN.test(item.token) ? item.token : null;
    const why = item?.why;
    const kind = MINE_KINDS.includes(why?.kind) ? why.kind : null;
    const name = text(why?.subject, 80);
    if (!slug || !q || !token || !kind || !name || options.length !== 4 || options.some((o) => !o)) return null;
    const chapter = text(item?.chapter, 160) || name;
    const pastPaper = demoPastPaperLabel(item?.pastPaper);
    questions.push({
      slug, subject: name, q, options, chapter, ...(pastPaper ? { pastPaper } : {}), token,
      why: { kind, subject: name, chapter: text(why?.chapter, 160) || chapter, ...(kind === 'missed' && isDateKey(why?.since) ? { since: why.since } : {}) },
    });
  }
  return { personal: true, day, date, questions, mix: mineMix(questions.map((q) => ({ kind: q.why.kind }))) };
}
