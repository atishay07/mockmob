// The Daily Five's server half (15 Nov 2026, lane F-A; account save, lane daily): GET /api/daily?day=<n>
// (src/app/api/daily/route.js) answers with the day's five, built ONLY from the public sample's windows.
//
// The windows. readDailyWindow is the public sample's own window (readDemoPool in ./demoSample.js) step for step, with the
// sample's own exported helpers (the candidate order, the Practice gate, demoShape, demoQuestionOut, the past-paper check,
// the chapter cap), keeping one thing the sample drops before it leaves: each question's id, which stays on this server.
// data/tests/daily_five_account_1115.test.mjs proves the two windows are the same questions in the same order. So the Daily
// Five can never show a question the sample does not already show, in a shape it does not already have: the stem, four
// options, the chapter and any verified past-paper reference, plus the subject's public slug, plus `token`. The key and the
// reason do NOT leave here (review 15 Nov: a page that holds the key can post a perfect five): they are inside the token.
//
// The token. Each question leaves with a seal (AES-256-GCM, a server secret): its date, its place, its id, its key and its
// reason. The page sends a token and the student's pick to POST /api/daily/check (src/lib/server/dailyFiveAccount.js), which
// answers right or wrong with the right option and the reason; for a signed-in student the first check of each question is
// the answer that stands. No id ever reaches the page. The answer is cached by the CDN for the day: the tokens are the same
// for everyone until 12:00 am IST.
//
// No 'server-only' and no alias imports, so node:test loads it (data/tests/daily_five_1115.test.mjs).
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { readablePracticeQuestions } from '../../../data/practice_library.js';
import { sharedEligibilitySnapshot } from '../../../data/evidence_registry.js';
import { INVENTORY_VISIBLE_FILTER } from '../../../data/inventory_count.js';
import { createTtlMemo } from '../../../data/ttl_memo.js';
import { servedRow } from '../../../data/option_order.js';
import { SUBJECT_PAGES } from '../subjectPages.mjs';
import { DEMO_POOL_SIZE, DEMO_SET_SIZE } from '../demoSample.mjs';
import {
  DEMO_BATCH, DEMO_CHAPTER_CAP, DEMO_FULL_SELECT, DEMO_MAX_FULL_ROWS, DEMO_POOL_TTL_MS, demoPastPaper, demoQuestionOut, demoShape, readDemoCandidates,
} from './demoSample.js';
import { DAILY_FIVE_SUBJECTS, dailyFiveFor, todayDaily } from '../dailyFive.mjs';

const DAY = /^[1-9]\d{0,5}$/;

/**
 * The visitor's query, checked before anything is read: { ok, day, date } for today's number (IST, by this server's clock), or
 * { ok: false, error, today } where `today` is { day, date } so a page on a wrong clock can ask again for the right day. Only
 * today is served: tomorrow's five stay unseen until 12:00 am IST, and a past day is not replayed here.
 */
export function parseDailyQuery(searchParams, now = Date.now()) {
  const raw = String(searchParams?.get?.('day') ?? '');
  const today = todayDaily(now);
  if (!DAY.test(raw)) return { ok: false, error: 'bad_day', today };
  if (Number(raw) !== today.day) return { ok: false, error: 'not_today', today };
  return { ok: true, day: today.day, date: today.date };
}

/**
 * A subject's public window with each question's id kept: readDemoPool (./demoSample.js) step for step. Do not change one
 * without the other; the parity test fails if they part.
 */
export async function readDailyWindow(db, subjectId) {
  const order = await readDemoCandidates(db, subjectId);
  const pool = [];
  const over = [];
  const perChapter = new Map();
  let fullRowsRead = 0;
  for (let i = 0; i < order.length && pool.length + over.length < DEMO_POOL_SIZE && fullRowsRead < DEMO_MAX_FULL_ROWS;) {
    const batch = Math.min(DEMO_BATCH, DEMO_MAX_FULL_ROWS - fullRowsRead);
    const ids = order.slice(i, i + batch);
    i += ids.length;
    const { data, error } = await db.from('questions').select(DEMO_FULL_SELECT).in('id', ids).eq('is_deleted', false).or(INVENTORY_VISIBLE_FILTER);
    if (error) throw new Error('DEMO_SAMPLE_UNAVAILABLE');
    fullRowsRead += (data || []).length;
    const readable = new Map((await readablePracticeQuestions(data || [], db)).map((row) => [row.id, row]));
    const registry = sharedEligibilitySnapshot()?.registry;
    const pastPapers = new Map([...readable].map(([id, row]) => [id, demoPastPaper(row, registry)]));
    const evidenceTier = (id) => readable.get(id)?.selection_evidence_tier || 0;
    ids.sort((a, b) => Number(Boolean(pastPapers.get(b))) - Number(Boolean(pastPapers.get(a))) || evidenceTier(b) - evidenceTier(a));
    for (const id of ids) {
      const stored = readable.get(id);
      const row = stored ? servedRow(stored).row : null;
      if (!row || !demoShape(row)) continue;
      const out = { id, ...demoQuestionOut(row, subjectId, pastPapers.get(id)) };
      const n = perChapter.get(out.chapter) || 0;
      if (n >= DEMO_CHAPTER_CAP) { over.push(out); continue; }
      perChapter.set(out.chapter, n + 1);
      pool.push(out);
      if (pool.length >= DEMO_POOL_SIZE) break;
    }
  }
  while (pool.length < DEMO_POOL_SIZE && over.length) pool.push(over.shift());
  return pool;
}

/**
 * The Daily Five's windows, as the sample serves them through its sets: whole sets of five only (a window of 27 plays 25),
 * kept `ttlMs` per server (the sample's hour) and read once even when several visitors ask at the same moment. `db` is a
 * function so the client is made only when a read is needed. `get(slug)` answers { slug, questions: [{ id, ...card }] }.
 */
export function createDailyWindows({ db, ttlMs = DEMO_POOL_TTL_MS, now = Date.now } = {}) {
  const memo = createTtlMemo({ ttlMs, max: DAILY_FIVE_SUBJECTS.length + 1, now });
  const pending = new Map();
  const windowOf = (subjectId) => memo.get(subjectId, () => {
    if (!pending.has(subjectId)) pending.set(subjectId, readDailyWindow(db(), subjectId).finally(() => pending.delete(subjectId)));
    return pending.get(subjectId);
  });
  return {
    async get(slug) {
      const page = SUBJECT_PAGES.find((p) => p.slug === slug);
      if (!page) return { slug, questions: [] };
      const pool = await windowOf(page.id);
      const sets = Math.floor((Array.isArray(pool) ? pool.length : 0) / DEMO_SET_SIZE);
      return { slug, questions: sets ? pool.slice(0, sets * DEMO_SET_SIZE) : [] };
    },
    forget: () => memo.forget(),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// The token: a question's date, place, id and key, sealed so the page can carry it and never read it.

const TOKEN_AAD = Buffer.from('mockmob-daily-five-token-v1');
/** The longest token this server seals (a reason of up to 420 characters, sealed and base64url). */
export const DAILY_TOKEN_MAX = 2000;

/** The secret the tokens are sealed with: its own, else the practice session's, else the service key (always set). */
export const dailyFiveSecret = (env = process.env) => env.DAILY_FIVE_SECRET || env.PRACTICE_SESSION_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || '';

/** The sealing key from a secret, or null when there is no usable secret (then no five is served). */
export function dailyTokenKey(secret) {
  if (typeof secret !== 'string' || secret.length < 16) return null;
  return createHash('sha256').update(`mockmob-daily-five-v1:${secret}`).digest();
}

export function sealDailyToken(key, { date, n, id, correct, why = '' }) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(TOKEN_AAD);
  const bytes = Buffer.concat([cipher.update(JSON.stringify([date, n, id, correct, why]), 'utf8'), cipher.final()]);
  return ['d1', iv.toString('base64url'), bytes.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.');
}

/** { date, n, id, correct, why } from a token this server sealed, or null for anything else. */
export function openDailyToken(key, token) {
  if (!key || typeof token !== 'string' || token.length > DAILY_TOKEN_MAX) return null;
  try {
    const [version, iv, ciphertext, tag, extra] = token.split('.');
    if (version !== 'd1' || extra !== undefined || !iv || !ciphertext || !tag) return null;
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    decipher.setAAD(TOKEN_AAD);
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    const text = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
    const [date, n, id, correct, why] = JSON.parse(text);
    return { date, n, id, correct, why: typeof why === 'string' ? why : '' };
  } catch {
    return null;
  }
}

/** One question as it leaves: the stem, the options, the chapter, its token; never its id, its key or its reason. */
const out = ({ subject, q, options, chapter, pastPaper }) => ({ subject, q, options: [...options], chapter, ...(pastPaper ? { pastPaper: { ...pastPaper } } : {}) });

/**
 * The route's service. `windows` is a createDailyWindows service; `key` the sealing key (null: no five can be served).
 *   get({ day, date })   { day, date, questions } for the page, or null when the windows cannot fill a five today
 *   five({ day, date })  the same five with their ids, for the server only (the stats route), or null
 */
export function createDailyFive({ windows, key = null }) {
  async function five({ day }) {
    const all = await Promise.all(DAILY_FIVE_SUBJECTS.map((slug) => windows.get(slug)));
    return dailyFiveFor(day, all);
  }
  return {
    five,
    async get({ day, date }) {
      // Without a sealing key the five could not be answered (the key is only in the tokens): no five rather than a dead one.
      if (!key) return null;
      const picked = await five({ day, date });
      if (!picked) return null;
      return {
        day,
        date,
        questions: picked.map((q, i) => ({ ...out(q), token: sealDailyToken(key, { date, n: i + 1, id: q.id, correct: q.correct, why: q.why }) })),
      };
    },
  };
}
