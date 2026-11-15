// The Daily Five on the account (15 Nov 2026, lane daily): the record a signed-in student's finished five leaves on the
// server, read back as their result, their run of days, a study day for the rhythm, their Mob's strip and everyone's share
// of right answers. Pure and browser-safe (no server import, no alias import): the server half is
// src/lib/server/dailyFiveAccount.js, the device half src/lib/dailyFive.mjs; tests in src/lib/dailyFiveAccount.test.mjs.
//
// Storage: the existing table question_interactions, one row per answer, no migration.
//   id               'daily5:<IST date>:<user id>:<n>'   the primary key: a student has at most one row per question of a day,
//                                                        so a second tab, a reload or a second phone can never add or change one
//   question_id      the question (the five are server-minted tokens, so the id never travels as itself)
//   user_id          the student
//   interaction_type 'daily_five'                         no other writer uses it (the interact route refuses unknown types)
//   flow_context     null                                 the table's check allows only mock, review, explore, shadow, learn or
//                                                        null; null keeps every flow-filtered reader (count_distinct_mock_sessions,
//                                                        the explore and learn counts) blind to these rows
//   session_id       'daily:<IST date>'
//   metadata         { n, day, pick: 'A'..'D', right, score, ms }
// The five rows are written by one INSERT ... ON CONFLICT (id) DO NOTHING: all or none, and the first finished run stands.
import { DAILY_FIVE_SIZE, dateOfDay, dayNumber, isDateKey } from './dailyFive.mjs';

export const DAILY_FIVE_INTERACTION = 'daily_five';
export const DAILY_FIVE_ME_ROUTE = '/api/daily/me';
export const DAILY_FIVE_STATS_ROUTE = '/api/daily/stats';
export const DAILY_FIVE_MOB_ROUTE = '/api/daily/mob';
/** Under this many signed-in students with a saved answer to a question today, nobody sees how everyone did on it. */
export const DAILY_FIVE_CROWD_FLOOR = 30;
/** How far back the account's run of days is read (the device keeps 400 too). */
export const DAILY_FIVE_RUN_DAYS = 400;
/** A stored time is never more than this (a phone left open overnight is not a 14-hour five). */
export const DAILY_FIVE_MAX_MS = 6 * 60 * 60 * 1000;
export const ANSWER_LETTERS = Object.freeze(['A', 'B', 'C', 'D']);
const TOKEN = /^[A-Za-z0-9_.-]{20,600}$/;
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
 * The save request's body, checked before anything is opened or written: { ok, day, date, tokens, picks, ms } or
 * { ok: false, error }. `answers` are the letters A to D only, five of them, in question order; `tokens` are the five the
 * route served (opened and checked on the server); `ms` is the time the page measured (clamped, never trusted for a score).
 */
export function checkSave(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return refuse('bad_body');
  const { day, date } = body;
  if (!Number.isInteger(day) || day < 1 || dateOfDay(day) !== date) return refuse('bad_day');
  const { tokens, answers } = body;
  if (!Array.isArray(tokens) || tokens.length !== DAILY_FIVE_SIZE || tokens.some((t) => typeof t !== 'string' || !TOKEN.test(t))) return refuse('bad_questions');
  if (new Set(tokens).size !== DAILY_FIVE_SIZE) return refuse('bad_questions');
  if (!Array.isArray(answers) || answers.length !== DAILY_FIVE_SIZE || answers.some((a) => !ANSWER_LETTERS.includes(a))) return refuse('bad_answers');
  const raw = Number(body.ms);
  const ms = Number.isFinite(raw) && raw >= 0 ? Math.min(Math.round(raw), DAILY_FIVE_MAX_MS) : null;
  return { ok: true, day, date, tokens: [...tokens], picks: answers.map((a) => ANSWER_LETTERS.indexOf(a)), ms };
}

/**
 * The five opened tokens, checked against today: each must be today's, in its own place (1 to 5), a real question id, a key
 * from A to D, and the five ids distinct. { ok, items: [{ id, correct }] } or { ok: false, error }.
 */
export function checkItems(opened, date) {
  if (!Array.isArray(opened) || opened.length !== DAILY_FIVE_SIZE) return refuse('bad_questions');
  const items = [];
  for (let i = 0; i < DAILY_FIVE_SIZE; i += 1) {
    const t = opened[i];
    if (!t || t.date !== date || t.n !== i + 1) return refuse('bad_questions');
    if (typeof t.id !== 'string' || !t.id || t.id.length > 120) return refuse('bad_questions');
    if (!Number.isInteger(t.correct) || t.correct < 0 || t.correct > 3) return refuse('bad_questions');
    items.push({ id: t.id, correct: t.correct });
  }
  if (new Set(items.map((x) => x.id)).size !== DAILY_FIVE_SIZE) return refuse('bad_questions');
  return { ok: true, items };
}

/** The five rows of a finished five, scored against the server's own key (`items[i].correct`), never the page's marks. */
export function saveRows({ userId, date, day, items, picks, ms = null, at }) {
  const marks = items.map((item, i) => picks[i] === item.correct);
  const score = marks.filter(Boolean).length;
  return items.map((item, i) => ({
    id: dailyRowId(date, userId, i + 1),
    question_id: item.id,
    user_id: userId,
    interaction_type: DAILY_FIVE_INTERACTION,
    session_id: dailySessionId(date),
    flow_context: null,
    created_at: at,
    metadata: { n: i + 1, day, pick: ANSWER_LETTERS[picks[i]], right: marks[i], score, ...(ms === null ? {} : { ms }) },
  }));
}

/**
 * A day's stored record from its rows: { date, day, score, ms, marks, picks }, or null unless there is exactly one row for
 * each of the five places, each with a letter and a right or wrong. The score is counted from the rows, never read.
 */
export function recordFromRows(rows, date) {
  if (!isDateKey(date)) return null;
  const at = new Array(DAILY_FIVE_SIZE).fill(null);
  for (const row of Array.isArray(rows) ? rows : []) {
    const m = row?.metadata;
    const n = Number(m?.n);
    if (!Number.isInteger(n) || n < 1 || n > DAILY_FIVE_SIZE || at[n - 1]) return null;
    if (!ANSWER_LETTERS.includes(m.pick) || typeof m.right !== 'boolean') return null;
    at[n - 1] = m;
  }
  if (at.some((m) => !m)) return null;
  const marks = at.map((m) => m.right);
  const raw = Number(at[0].ms);
  return {
    date,
    day: dayNumber(date),
    score: marks.filter(Boolean).length,
    ms: Number.isFinite(raw) && raw >= 0 ? Math.min(raw, DAILY_FIVE_MAX_MS) : 0,
    marks,
    picks: at.map((m) => ANSWER_LETTERS.indexOf(m.pick)),
  };
}

/** The days played, from stored session ids, oldest first, each once. */
export function playedDates(rows) {
  const dates = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    const d = dateOfSession(row?.session_id);
    if (d) dates.add(d);
  }
  return [...dates].sort();
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

/**
 * GET or POST /api/daily/me's answer: { day, date, record | null, played: [dates] }, or null when it is not one. `record`
 * is today's finished five on the account; `played` every day on the account (today included once saved).
 */
export function acceptAccount(body) {
  if (!body || typeof body !== 'object') return null;
  const { day, date } = body;
  if (!Number.isInteger(day) || day < 1 || dateOfDay(day) !== date) return null;
  if (body.record !== null && body.record !== undefined && !cleanAccountRecord(body.record, date)) return null;
  const played = [...new Set((Array.isArray(body.played) ? body.played : []).filter(isDateKey))].sort();
  return { day, date, record: body.record ? cleanAccountRecord(body.record, date) : null, played };
}

/** The account's days with today's, when today is played on this device and only waits for the save. */
export function runDays(accountDays, today, playedToday) {
  const days = new Set(Array.isArray(accountDays) ? accountDays.filter(isDateKey) : []);
  if (playedToday && isDateKey(today)) days.add(today);
  return [...days].sort();
}

/**
 * The line under the run of days, true for each case:
 *   guest      kept on this device
 *   saved      kept on the account
 *   saving     on its way to the account
 *   failed     not on the account yet (the page offers Try again)
 *   device     this five can only be kept on this device (the day closed, or the page was older than the save)
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
