// The Daily Five (15 Nov 2026, lane F-A; rivals.md section D item 1): every day the same five CUET questions for everyone,
// playable at /daily with no account, a share line for WhatsApp, and a run of days kept on the device.
// Pure and browser-safe (no server import, no alias import), so node --test holds it (src/lib/dailyFive.test.mjs) and the page
// bundles only these lines. The server half is src/lib/server/dailyFive.js; the route is src/app/api/daily/route.js.
//
// The pool. The five are drawn ONLY from the public sample's windows (src/lib/server/demoSample.js: a fixed window of
// DEMO_POOL_SIZE = 30 questions a subject, already served to any visitor by GET /api/sample). No question outside those
// windows can reach the Daily Five. DAILY_FIVE_SUBJECTS is the one constant to widen later (the owner's pending decision):
// today English and the General Test, which every CUET student sits. 2 subjects x 30 = 60 questions = 12 days of five.
// Each run of 12 days (a cycle) plays every one of the 60 once before any repeats; each cycle is a new deterministic shuffle,
// so day 13 is not day 1 again. The day's five are a function of the day number and the windows alone: the same for every
// visitor, on every server.
//
// The day. India Standard Time decides it (UTC+5:30, no daylight saving): a new five at 12:00 am IST. Day 1 is
// DAILY_FIVE_EPOCH.
import { DEMO_SETS, DEMO_SET_SIZE, demoPastPaperLabel, demoSubject } from './demoSample.mjs';

/** The subjects whose public sample windows feed the Daily Five. Widen here (and only here) when the owner decides. */
export const DAILY_FIVE_SUBJECTS = Object.freeze(['english', 'general-test']);
export const DAILY_FIVE_SIZE = DEMO_SET_SIZE;
/** The most questions the Daily Five can ever show: the windows of its subjects (60 today). */
export const DAILY_FIVE_MAX = DAILY_FIVE_SUBJECTS.length * DEMO_SETS * DEMO_SET_SIZE;
/** Days in one full cycle when every window is full (12 today). */
export const DAILY_FIVE_CYCLE_DAYS = DAILY_FIVE_MAX / DAILY_FIVE_SIZE;
/** Day 1, as an IST date. */
export const DAILY_FIVE_EPOCH = '2026-11-15';
export const DAILY_FIVE_PATH = '/daily';
export const DAILY_FIVE_URL = `https://www.mockmob.in${DAILY_FIVE_PATH}`;
export const DAILY_FIVE_ROUTE = '/api/daily';
export const DAILY_FIVE_SALT = 'mockmob-daily-five-v1';
/** This device's record (played days, the last result, a run in progress). Nothing leaves the browser. */
export const DAILY_FIVE_STORE = 'mm:daily-five:v1';
export const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const KEEP_DAYS = 400;

const pad = (n) => String(n).padStart(2, '0');
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** UTC midnight of an IST date key, or NaN when it is not a real date. */
function utcOf(key) {
  const m = DATE.exec(String(key ?? ''));
  if (!m) return NaN;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(t);
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? t : NaN;
}
const keyOf = (t) => { const d = new Date(t); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const EPOCH_UTC = utcOf(DAILY_FIVE_EPOCH);

/** True for a real 'YYYY-MM-DD' date. */
export const isDateKey = (key) => Number.isFinite(utcOf(key));

/** The IST calendar date of an instant, as 'YYYY-MM-DD'. */
export function istDateKey(ms = Date.now()) {
  return keyOf(Math.floor((Number(ms) + IST_OFFSET_MS) / DAY_MS) * DAY_MS);
}

/** A date key moved by whole days. */
export function addDays(key, days) {
  const t = utcOf(key);
  return Number.isFinite(t) ? keyOf(t + Math.trunc(Number(days) || 0) * DAY_MS) : null;
}

/** The Daily Five's number for an IST date (Day 1 is DAILY_FIVE_EPOCH), or null for a date that is not one. */
export function dayNumber(key) {
  const t = utcOf(key);
  return Number.isFinite(t) ? Math.round((t - EPOCH_UTC) / DAY_MS) + 1 : null;
}

/** The IST date of a day number, or null. */
export function dateOfDay(day) {
  return Number.isInteger(day) ? keyOf(EPOCH_UTC + (day - 1) * DAY_MS) : null;
}

/** Today's Daily Five by IST: { date, day }. Never before day 1. */
export function todayDaily(now = Date.now()) {
  const date = istDateKey(now);
  const day = dayNumber(date);
  return day >= 1 ? { date, day } : { date: DAILY_FIVE_EPOCH, day: 1 };
}

/** Milliseconds from `now` to the next 12:00 am IST, when a new five opens. */
export function msUntilNextDay(now = Date.now()) {
  const ist = Number(now) + IST_OFFSET_MS;
  return (Math.floor(ist / DAY_MS) + 1) * DAY_MS - ist;
}

/** "7 hours and 12 minutes", "1 hour", "42 minutes", "less than a minute": a wait in words, never rounded up. */
export function untilWords(ms) {
  const total = Math.max(0, Number(ms) || 0);
  if (total < 60 * 1000) return 'less than a minute';
  const minutes = Math.floor(total / (60 * 1000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const parts = [];
  if (h) parts.push(`${h} ${h === 1 ? 'hour' : 'hours'}`);
  if (m) parts.push(`${m} ${m === 1 ? 'minute' : 'minutes'}`);
  return parts.join(' and ');
}

/** "Sunday, 15 November". */
export function dayLabel(key) {
  const t = utcOf(key);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "15 Nov". */
export function shortDate(key) {
  const t = utcOf(key);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
}

/** "1:42", or "1:02:05" past an hour. A clock that only counts up. */
export function formatClock(ms) {
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** The clock in words for a screen reader: "1 minute 42 seconds". */
export function clockWords(ms) {
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [];
  if (h) parts.push(`${h} ${h === 1 ? 'hour' : 'hours'}`);
  if (m) parts.push(`${m} ${m === 1 ? 'minute' : 'minutes'}`);
  if (sec || !parts.length) parts.push(`${sec} ${sec === 1 ? 'second' : 'seconds'}`);
  return parts.join(' ');
}

// ---------------------------------------------------------------------------------------------------------------------
// The day's five. A small seeded shuffle (FNV-1a into mulberry32): the same on every server and in every test.

function hash32(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, seedText) {
  const out = [...list];
  const random = seeded(hash32(seedText));
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The windows the Daily Five may use, in DAILY_FIVE_SUBJECTS order: [{ slug, questions }]. Anything else is dropped. */
function usableWindows(windows) {
  const bySlug = new Map((Array.isArray(windows) ? windows : []).filter((w) => w && Array.isArray(w.questions)).map((w) => [w.slug, w.questions]));
  return DAILY_FIVE_SUBJECTS.filter((slug) => bySlug.has(slug)).map((slug) => ({ slug, questions: bySlug.get(slug) }));
}

/** Days in a cycle for these windows: every question once, in fives (12 with two full windows of 30). */
export function cycleDays(windows) {
  const total = usableWindows(windows).reduce((n, w) => n + w.questions.length, 0);
  return Math.floor(total / DAILY_FIVE_SIZE);
}

/**
 * One cycle's order: each window shuffled by the cycle's seed, then the subjects taken in turn (English, General Test,
 * English, ...), so a day mixes them (three and two). Every question of every window appears exactly once.
 */
export function cycleOrder(windows, cycle) {
  const lists = usableWindows(windows).map(({ slug, questions }) => shuffled(questions.map((q) => ({ ...q, subject: slug })), `${DAILY_FIVE_SALT}:${cycle}:${slug}`));
  const longest = Math.max(0, ...lists.map((l) => l.length));
  const out = [];
  for (let i = 0; i < longest; i += 1) for (const list of lists) if (i < list.length) out.push(list[i]);
  return out;
}

/**
 * The five for a day number from the public windows: [{ subject: slug, q, options, correct, why, chapter, pastPaper? }],
 * or null when the windows cannot fill one five. Day d is place (d - 1) mod N of cycle floor((d - 1) / N), N = cycleDays.
 */
export function dailyFiveFor(day, windows) {
  const days = cycleDays(windows);
  if (!days || !Number.isInteger(day) || day < 1) return null;
  const cycle = Math.floor((day - 1) / days);
  const at = (day - 1) % days;
  return cycleOrder(windows, cycle).slice(at * DAILY_FIVE_SIZE, (at + 1) * DAILY_FIVE_SIZE);
}

// ---------------------------------------------------------------------------------------------------------------------
// The browser's side: the route's answer accepted whole, or not at all.

const text = (v, max) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null);

/**
 * GET /api/daily's answer as the page plays it, or null: a real day with its own date and exactly five questions, each from a
 * Daily Five subject with a stem, four options, the right one's place, the reason and the chapter (a verified past-paper
 * reference is optional). Anything else is refused whole, so the page never plays half a day.
 */
export function acceptDailyFive(body) {
  if (!body || typeof body !== 'object') return null;
  const { day, date } = body;
  if (!Number.isInteger(day) || day < 1 || dateOfDay(day) !== date) return null;
  const list = Array.isArray(body.questions) ? body.questions : [];
  if (list.length !== DAILY_FIVE_SIZE) return null;
  const questions = [];
  for (const item of list) {
    const subject = DAILY_FIVE_SUBJECTS.includes(item?.subject) ? demoSubject(item.subject) : null;
    const q = text(item?.q, 600);
    const why = text(item?.why, 900);
    const options = Array.isArray(item?.options) && item.options.length === 4 ? item.options.map((o) => text(o, 300)) : [];
    const correct = item?.correct;
    if (!subject || !q || !why || options.length !== 4 || options.some((o) => !o) || !Number.isInteger(correct) || correct < 0 || correct > 3) return null;
    const pastPaper = demoPastPaperLabel(item?.pastPaper);
    questions.push({ slug: subject.slug, subject: subject.name, q, options, correct, why, chapter: text(item?.chapter, 160) || subject.name, ...(pastPaper ? { pastPaper } : {}) });
  }
  return { day, date, questions };
}

/** The route's address for a day. The day is in the address, so the CDN keeps one answer per day. */
export function dailyFiveUrl(day) {
  return `${DAILY_FIVE_ROUTE}?day=${Number(day)}`;
}

// ---------------------------------------------------------------------------------------------------------------------
// The share line: the date, the score, the time and a row of squares. No subject, chapter or question: no spoilers.

/** ■ for a right answer, □ for a miss, in question order. */
export function shareSquares(marks) {
  return (Array.isArray(marks) ? marks : []).map((right) => (right ? '■' : '□')).join('');
}

/** "MockMob Daily Five · 15 Nov · 4/5 · 1:42", the squares, the link. */
export function shareText({ date, score, ms, marks }) {
  return `MockMob Daily Five · ${shortDate(date)} · ${score}/${DAILY_FIVE_SIZE} · ${formatClock(ms)}\n${shareSquares(marks)}\n${DAILY_FIVE_URL}`;
}

// ---------------------------------------------------------------------------------------------------------------------
// The run of days, from the dates played (IST). Today counts once played; a run that ended yesterday is still alive today.

/** { count, playedToday, alive }: days played in a row up to today (or up to yesterday while today is not played yet). */
export function streakOf(dates, today) {
  if (!isDateKey(today)) return { count: 0, playedToday: false, alive: false };
  const played = new Set((Array.isArray(dates) ? dates : []).filter((d) => isDateKey(d) && d <= today));
  const playedToday = played.has(today);
  let cursor = playedToday ? today : addDays(today, -1);
  let count = 0;
  while (played.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return { count, playedToday, alive: count > 0 };
}

/**
 * The run in words for the result: { head, more } ("Day 3 in a row"; the first day's head with what tomorrow brings), or null
 * with no run.
 */
export function streakLine({ count, playedToday }) {
  if (!count) return null;
  if (count === 1) return playedToday ? { head: 'Day 1', more: 'Play tomorrow to make it 2 in a row.' } : { head: 'You played yesterday', more: 'Play today to make it 2 in a row.' };
  return playedToday ? { head: `Day ${count} in a row`, more: null } : { head: `${count} days in a row`, more: `Play today to make it ${count + 1}.` };
}

// ---------------------------------------------------------------------------------------------------------------------
// The device's record (localStorage, DAILY_FIVE_STORE), as plain data in and out. Every reader tolerates any stored text.
//   played: ['YYYY-MM-DD', ...]  the days finished, newest kept
//   last:   { date, day, score, ms, marks: [bool x5], missed: [{ n, chapter, q, picked, answer, why }] }  the latest result
//   run:    { date, day, startedAt, picks: [0..3 | null x5] }  a day begun and not finished: a reload resumes it, never restarts it

const EMPTY = Object.freeze({ played: [], last: null, run: null });

function cleanLast(last) {
  if (!last || typeof last !== 'object' || !isDateKey(last.date)) return null;
  const marks = Array.isArray(last.marks) && last.marks.length === DAILY_FIVE_SIZE ? last.marks.map(Boolean) : null;
  const score = Number(last.score);
  if (!marks || !Number.isInteger(score) || score !== marks.filter(Boolean).length) return null;
  const missed = (Array.isArray(last.missed) ? last.missed : [])
    .filter((m) => m && Number.isInteger(m.n) && m.n >= 1 && m.n <= DAILY_FIVE_SIZE && typeof m.q === 'string')
    .map(({ n, chapter, q, picked, answer, why }) => ({ n, chapter: String(chapter ?? ''), q, picked: String(picked ?? ''), answer: String(answer ?? ''), why: String(why ?? '') }));
  return { date: last.date, day: dayNumber(last.date), score, ms: Math.max(0, Number(last.ms) || 0), marks, missed };
}

function cleanRun(run) {
  if (!run || typeof run !== 'object' || !isDateKey(run.date) || !Number.isFinite(Number(run.startedAt))) return null;
  const picks = Array.from({ length: DAILY_FIVE_SIZE }, (_, i) => {
    const p = Array.isArray(run.picks) ? run.picks[i] : null;
    return Number.isInteger(p) && p >= 0 && p <= 3 ? p : null;
  });
  return { date: run.date, day: dayNumber(run.date), startedAt: Number(run.startedAt), picks };
}

/** The stored text as a record; anything unreadable is an empty record. */
export function readRecord(raw) {
  let data = null;
  try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { data = null; }
  if (!data || typeof data !== 'object') return { ...EMPTY, played: [] };
  const played = [...new Set((Array.isArray(data.played) ? data.played : []).filter(isDateKey))].sort().slice(-KEEP_DAYS);
  return { played, last: cleanLast(data.last), run: cleanRun(data.run) };
}

/** Today's finished result on this device, or null. */
export function resultOn(record, date) {
  return record?.last && record.last.date === date && record.played.includes(date) ? record.last : null;
}

/** The record with today's run begun at `startedAt`, unless it is already begun (or finished): a reload never restarts the clock. */
export function beginRun(record, { date, startedAt }) {
  if (resultOn(record, date)) return record;
  if (record.run && record.run.date === date) return record;
  return { ...record, run: { date, day: dayNumber(date), startedAt: Number(startedAt), picks: Array(DAILY_FIVE_SIZE).fill(null) } };
}

/** The record with one answer kept. An answer already given is never changed (no second try for a better score). */
export function keepAnswer(record, { date, index, pick }) {
  const run = record.run;
  if (!run || run.date !== date || !Number.isInteger(index) || index < 0 || index >= DAILY_FIVE_SIZE) return record;
  if (run.picks[index] !== null || !Number.isInteger(pick) || pick < 0 || pick > 3) return record;
  const picks = [...run.picks];
  picks[index] = pick;
  return { ...record, run: { ...run, picks } };
}

/** The record with today finished: the day joins `played`, the result is kept, the run is closed. A day finishes once. */
export function finishDay(record, result) {
  const last = cleanLast(result);
  if (!last || resultOn(record, last.date)) return record;
  const played = [...new Set([...record.played, last.date])].sort().slice(-KEEP_DAYS);
  return { played, last, run: record.run && record.run.date === last.date ? null : record.run };
}

/**
 * The result of a run from its five picks and the day's questions: { score, marks, missed }, or null while a pick is missing.
 * Each miss keeps its question, the student's answer, the right one and the reason (as the sample's readout shows them).
 */
export function scoreRun(picks, questions) {
  if (!Array.isArray(picks) || !Array.isArray(questions) || questions.length !== DAILY_FIVE_SIZE) return null;
  if (picks.length !== DAILY_FIVE_SIZE || picks.some((p) => !Number.isInteger(p))) return null;
  const marks = questions.map((q, i) => picks[i] === q.correct);
  const missed = questions.flatMap((q, i) => (marks[i] ? [] : [{ n: i + 1, chapter: q.chapter, q: q.q, picked: q.options[picks[i]], answer: q.options[q.correct], why: q.why }]));
  return { score: marks.filter(Boolean).length, marks, missed };
}

/** The first question still to answer in a run (0 to 5; 5 means all five are answered). */
export function nextIndex(picks) {
  const at = (Array.isArray(picks) ? picks : []).findIndex((p) => !Number.isInteger(p));
  return at < 0 ? DAILY_FIVE_SIZE : at;
}
