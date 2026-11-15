// The Daily Five on the account (15 Nov 2026, lane daily): the record a signed-in student's five leaves on the server, read
// back as their result, their run of days, a study day for the rhythm, their Mob's strip and everyone's share of right
// answers. Pure and browser-safe (no server import, no alias import): the server half is src/lib/server/dailyFiveAccount.js,
// the device half src/lib/dailyFive.mjs; tests in src/lib/dailyFiveAccount.test.mjs.
//
// The check (review 15 Nov): the page never holds the key. Each answer goes to POST /api/daily/check with the question's
// sealed token and the pick; the server answers right or wrong, the right option and the reason. For a signed-in student
// the FIRST check of each question is recorded and stands: a retry, a second tab or a second phone gets that first pick
// back, never a new one. The account's five is built from those recorded first picks alone; nothing else writes a pick.
//
// Storage: the existing table question_interactions, one row per checked answer, no migration.
//   id               'daily5:<IST date>:<user id>:<n>'   the primary key: at most one row per question place per day
//   question_id      the question (from the sealed token, so the id never travels as itself)
//   user_id          the student
//   interaction_type 'daily_five'                         no other writer uses it (the interact route refuses unknown types)
//   flow_context     null                                 the table's check allows only mock, review, explore, shadow, learn or
//                                                        null; null keeps every flow-filtered reader (count_distinct_mock_sessions,
//                                                        the explore and learn counts) blind to these rows
//   session_id       'daily:<IST date>'
//   metadata         { n, day, pick: 'A'..'D', right, correct: 0..3, ms? }   ms only on the fifth (the page's clock, clamped)
// Each row is written by INSERT ... ON CONFLICT (id) DO NOTHING: the first check stands.
import { DAILY_FIVE_SIZE, dateOfDay, dayNumber, isDateKey } from './dailyFive.mjs';

export const DAILY_FIVE_INTERACTION = 'daily_five';
export const DAILY_FIVE_ME_ROUTE = '/api/daily/me';
export const DAILY_FIVE_CHECK_ROUTE = '/api/daily/check';
export const DAILY_FIVE_STATS_ROUTE = '/api/daily/stats';
export const DAILY_FIVE_MOB_ROUTE = '/api/daily/mob';
/** Under this many signed-in students with a saved answer to a question today, nobody sees how everyone did on it. */
export const DAILY_FIVE_CROWD_FLOOR = 30;
/** How far back the account's run of days is read (the device keeps 400 too). */
export const DAILY_FIVE_RUN_DAYS = 400;
/** A stored time is never more than this (a phone left open overnight is not a 14-hour five). */
export const DAILY_FIVE_MAX_MS = 6 * 60 * 60 * 1000;
export const ANSWER_LETTERS = Object.freeze(['A', 'B', 'C', 'D']);
const TOKEN = /^[A-Za-z0-9_.-]{20,2000}$/;
const SESSION = /^daily:(\d{4}-\d{2}-\d{2})$/;

export const dailySessionId = (date) => `daily:${date}`;
/** The IST date of a stored session id, or null. */
export function dateOfSession(sessionId) {
  const m = SESSION.exec(String(sessionId ?? ''));
  return m && isDateKey(m[1]) ? m[1] : null;
}
/** The row's primary key: one per student per question place per day. */
export const dailyRowId = (date, userId, n) => `daily5:${date}:${userId}:${n}`;

const refuse = (error) => ({ ok: false, error });

/**
 * The check request's body, checked before anything is opened: { ok, token, pick, ms } or { ok: false, error }. `pick` is a
 * letter from A to D; `ms` is the time the page measured (sent with the fifth answer; clamped, never trusted for a score).
 */
export function checkRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return refuse('bad_body');
  if (typeof body.token !== 'string' || !TOKEN.test(body.token)) return refuse('bad_question');
  if (!ANSWER_LETTERS.includes(body.pick)) return refuse('bad_answer');
  const raw = Number(body.ms);
  const ms = body.ms !== undefined && Number.isFinite(raw) && raw >= 0 ? Math.min(Math.round(raw), DAILY_FIVE_MAX_MS) : null;
  return { ok: true, token: body.token, pick: ANSWER_LETTERS.indexOf(body.pick), ms };
}

/** An opened token, checked: today's, a place from 1 to 5, a question id, a key from A to D. { ok, item } or refused. */
export function checkOpened(opened, date) {
  if (!opened) return refuse('bad_question');
  if (opened.date !== date) return refuse('not_today');
  const { n, id, correct, why } = opened;
  if (!Number.isInteger(n) || n < 1 || n > DAILY_FIVE_SIZE || typeof id !== 'string' || !id || id.length > 120) return refuse('bad_question');
  if (!Number.isInteger(correct) || correct < 0 || correct > 3) return refuse('bad_question');
  return { ok: true, item: { n, id, correct, why: typeof why === 'string' ? why : '' } };
}

/** The row of a checked answer, scored against the server's own key (from the sealed token), never the page's. */
export function checkRow({ userId, date, day, n, id, pick, correct, ms = null, at }) {
  const timed = ms !== null && n === DAILY_FIVE_SIZE;
  return {
    id: dailyRowId(date, userId, n),
    question_id: id,
    user_id: userId,
    interaction_type: DAILY_FIVE_INTERACTION,
    session_id: dailySessionId(date),
    flow_context: null,
    created_at: at,
    metadata: { n, day, pick: ANSWER_LETTERS[pick], right: pick === correct, correct, ...(timed ? { ms } : {}) },
  };
}

/** The answer a check gives back, from the row that stands: { n, pick, right, correct }, or null. */
export function checkAnswer(row) {
  const m = row?.metadata;
  const pick = ANSWER_LETTERS.indexOf(m?.pick);
  if (!m || pick < 0 || typeof m.right !== 'boolean' || !Number.isInteger(m.correct)) return null;
  return { n: Number(m.n), pick, right: m.right, correct: m.correct };
}

/** The page's reading of a check's answer for question place `n`: { pick, right, correct, why, recorded }, or null. */
export function acceptCheck(body, n) {
  if (!body || typeof body !== 'object' || body.n !== n) return null;
  const { pick, right, correct } = body;
  if (!Number.isInteger(pick) || pick < 0 || pick > 3 || !Number.isInteger(correct) || correct < 0 || correct > 3) return null;
  if (typeof right !== 'boolean' || right !== (pick === correct)) return null;
  const why = typeof body.why === 'string' ? body.why.trim().slice(0, 900) : '';
  return { pick, right, correct, why, recorded: body.recorded === true };
}

/**
 * A day's stored record from its rows: { date, day, score, ms, marks, picks }, or null unless there is exactly one row for
 * each of the five places, each with a letter and a right or wrong. The score is counted from the rows, never read; the
 * time is the fifth answer's (the page's clock, clamped), else the span between the first and the last check.
 */
export function recordFromRows(rows, date) {
  if (!isDateKey(date)) return null;
  const at = new Array(DAILY_FIVE_SIZE).fill(null);
  const times = new Array(DAILY_FIVE_SIZE).fill(NaN);
  for (const row of Array.isArray(rows) ? rows : []) {
    const m = row?.metadata;
    const n = Number(m?.n);
    if (!Number.isInteger(n) || n < 1 || n > DAILY_FIVE_SIZE || at[n - 1]) return null;
    if (!ANSWER_LETTERS.includes(m.pick) || typeof m.right !== 'boolean') return null;
    at[n - 1] = m;
    times[n - 1] = Date.parse(row?.created_at);
  }
  if (at.some((m) => !m)) return null;
  const marks = at.map((m) => m.right);
  const told = Number(at[DAILY_FIVE_SIZE - 1].ms ?? at[0].ms);
  const span = Math.max(...times) - Math.min(...times);
  const ms = Number.isFinite(told) && told >= 0 ? told : Number.isFinite(span) ? span : 0;
  return {
    date,
    day: dayNumber(date),
    score: marks.filter(Boolean).length,
    ms: Math.min(Math.max(0, ms), DAILY_FIVE_MAX_MS),
    marks,
    picks: at.map((m) => ANSWER_LETTERS.indexOf(m.pick)),
  };
}

/** The keys and reasons of a finished five, for its review on another phone: [{ correct, why } | null] x5. */
export function reviewFrom(rows, five) {
  const whyOf = new Map((Array.isArray(five) ? five : []).map((q) => [q.id, q.why]));
  const out = new Array(DAILY_FIVE_SIZE).fill(null);
  for (const row of Array.isArray(rows) ? rows : []) {
    const n = Number(row?.metadata?.n);
    const correct = row?.metadata?.correct;
    if (Number.isInteger(n) && n >= 1 && n <= DAILY_FIVE_SIZE && Number.isInteger(correct)) out[n - 1] = { correct, why: String(whyOf.get(row.question_id) ?? '') };
  }
  return out;
}

/** The days played, oldest first, each once: only days with all five places answered (a five, not a first question). */
export function playedDates(rows) {
  const places = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const d = dateOfSession(row?.session_id);
    const n = Number(row?.metadata?.n);
    if (!d || !Number.isInteger(n) || n < 1 || n > DAILY_FIVE_SIZE) continue;
    if (!places.has(d)) places.set(d, new Set());
    places.get(d).add(n);
  }
  return [...places].filter(([, ns]) => ns.size === DAILY_FIVE_SIZE).map(([d]) => d).sort();
}

// ---------------------------------------------------------------------------------------------------------------------
// How everyone did. Aggregate only, never a rank or a percentile of the student.

/** The share who got a question right, as a whole percent, or null under the floor. */
export function crowdShare(total, right, floor = DAILY_FIVE_CROWD_FLOOR) {
  const t = Number(total);
  const r = Number(right);
  if (!Number.isInteger(t) || !Number.isInteger(r) || t < floor || r < 0 || r > t) return null;
  return Math.round((r * 100) / t);
}

/** "64% got this right", or null. */
export function crowdLine(pct) {
  return Number.isInteger(pct) && pct >= 0 && pct <= 100 ? `${pct}% got this right` : null;
}

/**
 * A short fingerprint of a question as the page shows it (its stem and four options), so the page can tell that a line of
 * numbers is about the very question on its screen. FNV-1a, 32 bits, as hex: not a secret, only a match.
 */
export function questionRef(question) {
  const text = `${String(question?.q ?? '').trim()}\u0001${(Array.isArray(question?.options) ? question.options : []).map((o) => String(o ?? '').trim()).join('\u0002')}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** GET /api/daily/stats's answer as the page uses it: [{ ref, pct | null }] x5 for today's date, or null. */
export function acceptCrowd(body, date) {
  if (!body || typeof body !== 'object' || body.date !== date || !Array.isArray(body.questions) || body.questions.length !== DAILY_FIVE_SIZE) return null;
  const out = [];
  for (const item of body.questions) {
    if (!item || typeof item.ref !== 'string' || !/^[0-9a-f]{8}$/.test(item.ref)) return null;
    out.push({ ref: item.ref, pct: Number.isInteger(item.pct) && item.pct >= 0 && item.pct <= 100 ? item.pct : null });
  }
  return out;
}

/** The line under question i, only when the numbers are about the question the page holds. */
export function crowdLineFor(crowd, questions, i) {
  const item = Array.isArray(crowd) ? crowd[i] : null;
  const q = Array.isArray(questions) ? questions[i] : null;
  if (!item || !q || item.ref !== questionRef(q)) return null;
  return crowdLine(item.pct);
}

// ---------------------------------------------------------------------------------------------------------------------
// The page's reads of the account.

function cleanAccountRecord(record, date) {
  if (!record || typeof record !== 'object' || record.date !== date) return null;
  const marks = Array.isArray(record.marks) && record.marks.length === DAILY_FIVE_SIZE && record.marks.every((m) => typeof m === 'boolean') ? record.marks : null;
  const picks = Array.isArray(record.picks) && record.picks.length === DAILY_FIVE_SIZE && record.picks.every((p) => Number.isInteger(p) && p >= 0 && p <= 3) ? record.picks : null;
  const score = Number(record.score);
  if (!marks || !picks || score !== marks.filter(Boolean).length) return null;
  return { date, day: dayNumber(date), score, ms: Math.max(0, Number(record.ms) || 0), marks: [...marks], picks: [...picks] };
}

function cleanReview(review) {
  if (!Array.isArray(review) || review.length !== DAILY_FIVE_SIZE) return null;
  return review.map((r) => (r && Number.isInteger(r.correct) && r.correct >= 0 && r.correct <= 3 ? { correct: r.correct, why: typeof r.why === 'string' ? r.why.slice(0, 900) : '' } : null));
}

/**
 * GET /api/daily/me's answer: { day, date, record | null, review | null, played: [dates] }, or null when it is not one.
 * `record` is today's five on the account (all five checked); `review` its keys and reasons, sent only with a record (the
 * student has answered all five); `played` every day on the account with a whole five.
 */
export function acceptAccount(body) {
  if (!body || typeof body !== 'object') return null;
  const { day, date } = body;
  if (!Number.isInteger(day) || day < 1 || dateOfDay(day) !== date) return null;
  if (body.record !== null && body.record !== undefined && !cleanAccountRecord(body.record, date)) return null;
  const played = [...new Set((Array.isArray(body.played) ? body.played : []).filter(isDateKey))].sort();
  const record = body.record ? cleanAccountRecord(body.record, date) : null;
  return { day, date, record, review: record ? cleanReview(body.review) : null, played };
}

/** The account's days with today's, when today is finished on this device and only waits for the account's read. */
export function runDays(accountDays, today, playedToday) {
  const days = new Set(Array.isArray(accountDays) ? accountDays.filter(isDateKey) : []);
  if (playedToday && isDateKey(today)) days.add(today);
  return [...days].sort();
}

/**
 * The line under the run of days, true for each case:
 *   guest      kept on this device
 *   saved      kept on the account
 *   saving     the account is being read after the fifth answer
 *   failed     the account could not be read (the page offers Try again)
 *   device     the account does not hold all five (some were answered signed out): it stays on this device
 */
export function runNote(state) {
  switch (state) {
    case 'saved': return 'Your run is kept on your account.';
    case 'saving': return 'Saving today’s five to your account.';
    case 'failed': return 'Today’s five isn’t on your account yet.';
    case 'device': return 'Today’s five is kept on this device only.';
    default: return 'Your run is kept on this device.';
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// The Mob's strip: which members played today's five, in the den's member order, never sorted by score.

/**
 * members: the Mob's members as stored, in the den's order (joined_at, then user id): { user_id, display_name, colour,
 * show_score }. rows: today's Daily Five rows of those members ({ user_id, metadata }). Each member out is
 * { name, colour, you, state: 'marks' | 'played' | 'not_yet', marks? }. A member who keeps their score to themselves
 * (show_score false) shows as played, without the squares. No user id leaves. The den's rule F2 (src/lib/mob/games.mjs):
 * nothing counts or names a member who has not played, so another member without today's five is left out; only the
 * student's own row may say 'not_yet'.
 */
export function memberStrip(members, rows, { userId, date }) {
  const byUser = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!byUser.has(row?.user_id)) byUser.set(row?.user_id, []);
    byUser.get(row?.user_id).push(row);
  }
  return (Array.isArray(members) ? members : []).flatMap((m) => {
    const you = m.user_id === userId;
    const base = { name: String(m.display_name || '').trim() || 'A member', colour: Number.isInteger(m.colour) ? m.colour : 0, you };
    const record = byUser.has(m.user_id) ? recordFromRows(byUser.get(m.user_id), date) : null;
    if (!record) return you ? [{ ...base, state: 'not_yet' }] : [];
    if (!you && m.show_score === false) return [{ ...base, state: 'played' }];
    return [{ ...base, state: 'marks', marks: record.marks }];
  });
}

/** GET /api/daily/mob's answer as the strip draws it, or null. */
export function acceptStrip(body) {
  if (!body || typeof body !== 'object' || !isDateKey(body.date) || !Array.isArray(body.members) || body.members.length > 12) return null;
  const members = [];
  for (const m of body.members) {
    if (!m || typeof m.name !== 'string' || !m.name.trim() || m.name.length > 60) return null;
    if (!['marks', 'played', 'not_yet'].includes(m.state)) return null;
    if (m.state === 'not_yet' && m.you !== true) return null; // F2: only your own row can be 'not yet'
    const marks = m.state === 'marks' && Array.isArray(m.marks) && m.marks.length === DAILY_FIVE_SIZE && m.marks.every((x) => typeof x === 'boolean') ? [...m.marks] : null;
    if (m.state === 'marks' && !marks) return null;
    members.push({ name: m.name.trim(), colour: Number.isInteger(m.colour) ? m.colour : 0, you: m.you === true, state: m.state, ...(marks ? { marks } : {}) });
  }
  return { date: body.date, members };
}
