// "Your five", the server half (owner LK365, 21 Nov 2026; design tmp/1121-stories/DAILY-SPEC.md; contract
// tmp/1121-stories/daily/CONTRACT.md). The rules are pure in src/lib/dailyFiveMine.mjs; this file makes the reads and the
// feedback writes, every one passed in (dependency-injected like the Daily Five's other services), so node --test drives it
// with fakes (data/tests/daily_mine_1121.test.mjs). No 'server-only' and no alias imports. Production wiring:
// src/lib/server/dailyFiveDeps.js; the route: src/app/api/daily/mine/route.js.
//
//   getMine(request)                    GET /api/daily/mine: signed in only, no-store. Builds today's five from the student's
//                                       record, or answers personal false (the page plays the shared five). Never a 500.
//   tagOf({ token, userId, item })      at POST /api/daily/check, before the row is written: the kind of a question of THIS
//                                       student's own five, read from the question's sealed token (sealMineToken), kept in
//                                       the row's metadata as `mine`. A shared-five token, or a token sealed for another
//                                       student, has none: its answer is exactly as before.
//   feed({ ... })                       at POST /api/daily/check, after a FIRST answer of a personal question stood: a wrong
//                                       pick goes into the student's mistakes through the progress writer practice uses
//                                       (Database._recordAttemptProgress); a right pick of a question they had wrong moves
//                                       its Revise card through answerRevise. Fails soft: logged, never thrown.
//   withReasons(rows, five)             at GET /api/daily/me: the reasons of a finished personal five's own questions
//
// Questions: only what Practice serves (the readablePracticeQuestions gate on live or verified-and-active rows, never a frozen
// one, within the syllabus option the student saved, as practiceSessions.js reads it), never a question held for a Mob paper
// or a running session (heldQuestions.js), never one of today's shared five, and only what the Daily card draws (demoShape: a
// plain stem and four plain options, a reason that fits). Each leaves in the shared five's exact shape. Its token is the
// shared five's token (openDailyToken opens it, so POST /api/daily/check needs no new input) with one more sealed element:
// the student it was built for, its kind and its date (review 21 Nov 2026: a personal answer is known by its own seal, never
// by "not in today's shared five", which changes when the public window moves). The key, the reason and the id stay in it.
//
// The same five all day: a place already answered today comes from its row; the others from a sealed, httpOnly, same-site
// cookie written when the five are built (until 12:00 am IST); without a valid cookie they are rebuilt from the seed of
// (user id, IST date), the answered places counting toward their kinds.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { readablePracticeQuestions } from '../../../data/practice_library.js';
import { sharedEligibilitySnapshot } from '../../../data/evidence_registry.js';
import { INVENTORY_VISIBLE_FILTER } from '../../../data/inventory_count.js';
import { SUBJECT_OPTIONS, isServableQuestion } from '../../../data/cuet_syllabus.js';
import { toInternalSubjectId } from '../../../data/cuet_controls.js';
import { servedRow, storedIndexOf, storedKeyAt } from '../../../data/option_order.js';
import { readUserProgress } from '../../../data/practice_progress.js';
import { weakChapters } from '../../../data/learning_weak.js';
import { SUBJECT_PAGES } from '../subjectPages.mjs';
import { msUntilNextDay, todayDaily } from '../dailyFive.mjs';
import {
  MINE_COOKIE, MINE_KINDS, MINE_LIMITS, assembleFive, mineMix, minePayload, mineSeed, mineTag, missedList, rankIds, readMinePayload,
  readTag, subjectTurn, weakRanking, windowStart,
} from '../dailyFiveMine.mjs';
import { DEMO_FULL_SELECT, DEMO_LIGHT_SELECT, demoPastPaper, demoQuestionOut, demoShape } from './demoSample.js';
import { DAILY_TOKEN_MAX } from './dailyFive.js';
import { loadSyllabusOption } from './syllabusOption.js';

/** GET /api/daily/mine's own limit, per student (a page load reads it once; a reload or two more). */
export const MINE_RATE = Object.freeze({ route: '/api/daily/mine', limit: 60, windowMs: 10 * 60 * 1000 });

const COOKIE_AAD = Buffer.from('mockmob-daily-mine-cookie-v1');
const COOKIE_MAX = 1200;
const clean = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

// ---------------------------------------------------------------------------------------------------------------------
// The cookie: sealed with the tokens' key under its own label, so a token never opens as a cookie or a cookie as a token.

export function sealMineCookie(key, payload) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(COOKIE_AAD);
  const bytes = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return ['m1', iv.toString('base64url'), bytes.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.');
}

export function openMineCookie(key, value) {
  if (!key || typeof value !== 'string' || value.length > COOKIE_MAX) return null;
  try {
    const [version, iv, ciphertext, tag, extra] = value.split('.');
    if (version !== 'm1' || extra !== undefined || !iv || !ciphertext || !tag) return null;
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    decipher.setAAD(COOKIE_AAD);
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8'));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// The token of a personal question: EXACTLY the shared five's token (src/lib/server/dailyFive.js sealDailyToken: 'd1', the same
// key and label, the payload [date, n, id, correct, why]) with a sixth element ['m1', user id, kind, since, option hash]. openDailyToken
// reads the first five and ignores the sixth, so the check opens it as it opens any Daily Five token; only this file reads the
// sixth. The label below must stay the one dailyFive.js seals with (data/tests/daily_mine_1121.test.mjs proves the two open
// each other's tokens).
const TOKEN_AAD = Buffer.from('mockmob-daily-five-token-v1');

export function sealMineToken(key, { date, n, id, correct, why = '', userId, kind, since = null, optionHash = null }) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(TOKEN_AAD);
  const mark = ['m1', userId, kind, kind === 'missed' && since ? since : ''];
  if (optionHash) mark.push(optionHash);
  const payload = [date, n, id, correct, why, mark];
  const bytes = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const token = ['d1', iv.toString('base64url'), bytes.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.');
  // The check refuses a longer token (checkRequest), so a question whose token would not fit is never sent.
  if (token.length > DAILY_TOKEN_MAX) throw new Error('MINE_TOKEN_TOO_LONG');
  return token;
}

/** The personal mark of a Daily Five token this server sealed: { userId, kind, since }, or null (a shared token, or junk). */
export function openMineMark(key, token) {
  if (!key || typeof token !== 'string' || token.length > DAILY_TOKEN_MAX) return null;
  try {
    const [version, iv, ciphertext, tag, extra] = token.split('.');
    if (version !== 'd1' || extra !== undefined || !iv || !ciphertext || !tag) return null;
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    decipher.setAAD(TOKEN_AAD);
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    const mark = JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8'))?.[5];
    if (!Array.isArray(mark) || mark[0] !== 'm1' || typeof mark[1] !== 'string' || !mark[1] || !MINE_KINDS.includes(mark[2])) return null;
    return { userId: mark[1], kind: mark[2], since: typeof mark[3] === 'string' && mark[3] ? mark[3] : null, ...(mark[4] ? { optionHash: mark[4] } : {}) };
  } catch {
    return null;
  }
}

/** The raw value of the mine cookie in a request, or null. */
export function cookieValue(request) {
  const header = request?.headers?.get?.('cookie') || '';
  for (const part of header.split(';')) {
    const at = part.indexOf('=');
    if (at > 0 && part.slice(0, at).trim() === MINE_COOKIE) return part.slice(at + 1).trim() || null;
  }
  return null;
}

/**
 * The Set-Cookie line: httpOnly, same-site, until the IST day ends, and sent only to GET /api/daily/mine (the one reader: the
 * check reads a question's kind from its token, so no other Daily Five request carries these bytes).
 */
export function mineCookieLine(value, { now = Date.now(), secure = true } = {}) {
  const seconds = Math.max(1, Math.floor(msUntilNextDay(now) / 1000));
  return `${MINE_COOKIE}=${value}; Path=/api/daily/mine; Max-Age=${seconds}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

// ---------------------------------------------------------------------------------------------------------------------

/** The student's chosen subjects as the bank's ids, each a subject page MockMob serves: [{ id, slug, name }]. */
export function subjectsOf(list) {
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const id = toInternalSubjectId(String(raw ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'));
    const page = SUBJECT_PAGES.find((p) => p.id === id);
    if (page && !out.some((s) => s.id === page.id)) out.push({ id: page.id, slug: page.slug, name: page.name });
  }
  return out;
}
const pageOf = (subjectId) => SUBJECT_PAGES.find((p) => p.id === subjectId) || null;
const bankSubject = (raw) => subjectsOf([raw])[0]?.id || null;
const optionHashOf = (stored, order, options) => createHash('sha256')
  .update(JSON.stringify([options, order, order.map((index) => storedKeyAt(stored.options, index))])).digest('base64url').slice(0, 22);
/** An answered place's question can still be drawn: a stem and four options within what acceptMine takes on the page. */
const keptShape = (q) => Boolean(q?.q) && q.q.length <= 600 && Array.isArray(q.options) && q.options.length === 4
  && q.options.every((o) => o && o.length <= 300) && Number.isInteger(q.correct);

/**
 * The service. deps: {
 *   db() -> supabase client                     the service-role client, made only when a read is needed
 *   auth(request) -> session | null             session.user = { id, subjects }
 *   rateLimit(request, opts) -> { allowed }      checkPersistentRateLimit
 *   store                                        createDailyStore (today's rows: store.rows(userId, date))
 *   key                                          the token key (dailyTokenKey), or null (then personal false)
 *   five({ day, date }) -> [{ id, ... }] | null  today's shared five with ids (createDailyFive.five); null: no shared five today
 *   held(userId) -> Set(ids)                     readHeldQuestionIds (throws when unknown)
 *   attempts(userId) -> [attempt]                the newest papers, slim 'plan' (Database.getAttempts)
 *   recordProgress({ userId, subject, details, questionsSnapshot })   Database._recordAttemptProgress (practice's writer)
 *   answerRevise(userId, { questionId, choice }) -> { http, body }   src/lib/server/revise.js answerRevise
 *   syllabusOption(userId, subjectId) -> option | null   the option the student saved (default loadSyllabusOption, never throws)
 *   readable(rows, db)                           the Practice gate (default readablePracticeQuestions)
 *   enabled() -> boolean                         the kill switch (DAILY_MINE_ENABLED)
 *   now() -> ms, warn(line)
 * }
 */
export function createDailyMine(deps) {
  const now = () => (deps.now ? deps.now() : Date.now());
  const warn = deps.warn || ((line) => console.warn(line));
  const enabled = () => { try { return deps.enabled ? deps.enabled() !== false : true; } catch { return false; } };
  const readable = deps.readable || readablePracticeQuestions;
  const reply = (status, body, headers = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
  const off = (reason) => ({ ok: true, personal: false, reason });

  /**
   * One request's reads that do not depend on the pool: the student's saved syllabus option per subject (only the subjects
   * that have options: Mathematics, Computer Science, Accountancy), read once each, as practiceSessions.js reads it.
   */
  function requestState(client, userId) {
    const options = new Map();
    const optionOf = (subjectId) => {
      if (!SUBJECT_OPTIONS[subjectId]) return Promise.resolve(null);
      if (!options.has(subjectId)) {
        const read = deps.syllabusOption ? deps.syllabusOption(userId, subjectId) : loadSyllabusOption(client, userId, subjectId);
        options.set(subjectId, Promise.resolve(read).catch(() => null));
      }
      return options.get(subjectId);
    };
    return { optionOf };
  }

  // ---- the question reads ------------------------------------------------------------------------------------------

  /**
   * Whole rows by id, shaped for the card, in the order asked: Map(id -> q) where q is
   * { id, subjectId, chapterKey, subject (slug), q, options, correct, why, chapter, pastPaper? }.
   *   gate true    what Practice serves now (the visible filter, the Practice gate, never frozen, the student's syllabus
   *                option) and what the card draws (demoShape)
   *   gate false   a place already answered today: it keeps its question even if it would not be served now, or a correction
   *                lengthened its reason past the card's fit; it only needs a stem and four options to be drawn
   */
  async function shapedRows(client, ids, budget, { gate = true, exclude = new Set(), state = null } = {}) {
    const out = new Map();
    const list = ids.filter((id) => !exclude.has(id));
    for (let i = 0; i < list.length && budget.left > 0; i += MINE_LIMITS.fullBatch) {
      const part = list.slice(i, i + Math.min(MINE_LIMITS.fullBatch, budget.left));
      let query = client.from('questions').select(DEMO_FULL_SELECT).in('id', part).eq('is_deleted', false);
      if (gate) query = query.or(INVENTORY_VISIBLE_FILTER);
      const { data, error } = await query;
      if (error) throw Object.assign(new Error('MINE_QUESTIONS_UNAVAILABLE'), { cause: error });
      budget.left -= (data || []).length;
      let rows = data || [];
      if (gate) {
        // What Practice serves (live, or verified and active), never a frozen row (a pulled question), within the section the
        // student sits, through the same readablePracticeQuestions gate as every student surface.
        const options = new Map();
        for (const subject of new Set(rows.map((r) => r.subject))) options.set(subject, state ? await state.optionOf(subject) : null);
        rows = await readable(rows.filter((r) => r.exploration_state !== 'frozen' && isServableQuestion(r, { option: options.get(r.subject) })), client);
      }
      const registry = rows.length && gate ? sharedEligibilitySnapshot()?.registry : null;
      for (const stored of rows) {
        const { row, order } = servedRow(stored);
        const page = pageOf(stored.subject);
        if (!row || !page) continue;
        const shaped = demoQuestionOut(row, page.id, gate ? demoPastPaper(stored, registry) : null);
        if (gate ? !demoShape(row) : !keptShape(shaped)) continue;
        const optionHash = optionHashOf(stored, order, shaped.options);
        out.set(stored.id, { id: stored.id, subjectId: page.id, chapterKey: clean(stored.chapter), subject: page.slug, ...shaped, optionHash });
      }
    }
    return out;
  }

  /**
   * The first `need` usable questions among `ids` (already in order), reading at most fullRowsPerPool whole rows. A whole row
   * carries the signed evidence record (35 to 40 KB on an evidence row), so the first read asks for only a few more than
   * needed and later reads a full batch: the picks are the same (the first usable ones in order), the bytes far fewer.
   */
  async function firstUsable(client, ids, need, budget, exclude, state) {
    const pool = { left: Math.min(budget.left, MINE_LIMITS.fullRowsPerPool) };
    const out = [];
    const list = ids.filter((id) => !exclude.has(id));
    for (let i = 0; i < list.length && out.length < need && pool.left > 0;) {
      const size = i === 0 ? Math.min(MINE_LIMITS.fullBatch, need + MINE_LIMITS.firstSpare) : MINE_LIMITS.fullBatch;
      const part = list.slice(i, i + size);
      i += part.length;
      const before = pool.left;
      const shaped = await shapedRows(client, part, pool, { exclude, state });
      budget.left -= before - pool.left;
      for (const id of part) if (shaped.has(id) && out.length < need) out.push(shaped.get(id));
    }
    return out;
  }

  /** Candidate ids of a subject (and chapter), a seeded window of MINE_LIMITS.lightRows, no text read. */
  async function candidateIds(client, subjectId, chapter, seed, state) {
    const base = () => {
      let q = client.from('questions').select(DEMO_LIGHT_SELECT).eq('subject', subjectId).eq('is_deleted', false).or(INVENTORY_VISIBLE_FILTER);
      if (chapter) q = q.eq('chapter', chapter);
      return q;
    };
    const start = windowStart(seed, `${subjectId}:${chapter || ''}`);
    const first = await base().gte('id', start).order('id', { ascending: true }).limit(MINE_LIMITS.lightRows);
    if (first.error) throw Object.assign(new Error('MINE_CANDIDATES_UNAVAILABLE'), { cause: first.error });
    let rows = first.data || [];
    if (rows.length < MINE_LIMITS.lightRows) {
      const wrap = await base().lt('id', start).order('id', { ascending: true }).limit(MINE_LIMITS.lightRows - rows.length);
      if (wrap.error) throw Object.assign(new Error('MINE_CANDIDATES_UNAVAILABLE'), { cause: wrap.error });
      rows = rows.concat(wrap.data || []);
    }
    const option = await state.optionOf(subjectId);
    return rows.filter((r) => !r.passage_id && !r.passage_group_id && isServableQuestion({ ...r, subject: subjectId }, { option })).map((r) => r.id);
  }

  /**
   * The ids the student has never met in practice or a paper (no progress row), in the seed's order. A progress read that did
   * not complete would make a seen question look new (readUserProgress counts a failed chunk as unseen): it throws instead.
   */
  async function unseen(client, userId, ids, seed) {
    if (!ids.length) return [];
    const progress = await readUserProgress(client, userId, ids, { warn });
    if (progress.incomplete) throw new Error('MINE_SEEN_UNREAD');
    return rankIds(ids.filter((id) => !progress.has(id)), seed);
  }

  // ---- the five ----------------------------------------------------------------------------------------------------

  /**
   * The five places for one student today: { places: [{ n, kind, q, since }], built } or { reason }. `rows` are today's
   * Daily Five rows on the account (store.rows), read by the caller.
   */
  async function fiveFor(request, session, today, rows) {
    const userId = session.user.id;
    const subjects = subjectsOf(session.user.subjects);
    const answered = (rows || []).map((r) => ({ n: Number(r?.metadata?.n), id: r?.question_id, tag: readTag(r?.metadata?.mine) }))
      .filter((p) => Number.isInteger(p.n) && p.n >= 1 && p.n <= 5 && typeof p.id === 'string');
    // Every answer to a question of the student's own five carries its tag (sealed in the question's token, written by the
    // check). An answer without one is the shared five's (for example in the Android app): the account keeps playing that.
    if (answered.some((p) => !p.tag)) return { reason: answered.some((p) => p.tag) ? 'retry' : 'shared_started' };
    if (!subjects.length && !answered.length) return { reason: 'no_subjects' };
    const client = deps.db();
    const state = requestState(client, userId);
    const budget = { left: MINE_LIMITS.fullRowsTotal };
    const seed = mineSeed(userId, today.date);

    // The answered places keep their questions (shaped, not gated: the student has already seen them).
    const pinnedRows = answered.length ? await shapedRows(client, answered.map((p) => p.id), budget, { gate: false }) : new Map();
    if (answered.some((p) => !pinnedRows.has(p.id))) throw new Error('MINE_ANSWERED_UNREAD');
    // A finished five is its five rows: nothing else is read (a reload after the fifth answer, on any device).
    if (answered.length === 5 && new Set(answered.map((p) => p.n)).size === 5) {
      return { places: answered.map((p) => ({ n: p.n, kind: p.tag.kind, since: p.tag.since, q: pinnedRows.get(p.id) })).sort((a, b) => a.n - b.n), built: false };
    }
    // Today's shared five: never one of its questions (its numbers count every answer to them). A failed read throws.
    const [sharedFive, held] = await Promise.all([deps.five(today), deps.held(userId)]);
    const shared = new Set((Array.isArray(sharedFive) ? sharedFive : []).map((q) => q.id));
    const exclude = new Set([...(held || []), ...shared]);

    // 1. The cookie: today's five as first built, when every open place can still be served.
    const fromCookie = readMinePayload(openMineCookie(deps.key, cookieValue(request)), { date: today.date, userId });
    if (fromCookie) {
      const open = fromCookie.filter((p) => !answered.some((a) => a.n === p.n));
      const served = await shapedRows(client, open.map((p) => p.id), budget, { exclude, state });
      if (open.every((p) => served.has(p.id))) {
        const places = fromCookie.map((p) => {
          const pin = answered.find((a) => a.n === p.n);
          if (pin) return { n: p.n, kind: pin.tag.kind, since: pin.tag.since, q: pinnedRows.get(pin.id) };
          return { n: p.n, kind: p.kind, since: p.since, q: served.get(p.id) };
        });
        if (new Set(places.map((p) => p.q.id)).size === places.length) return { places, built: false };
      }
    }
    if (!subjects.length) return { reason: 'retry' };

    // 2. Rebuild from the seed. The answered places count toward their kinds (their tags); their ids are only kept out of the
    // picks. They are NOT put back into the missed list (review 21 Nov 2026): an answer today moves a progress row to the top
    // with today's date, and kept in, it took its chapter's first slot and reordered the open places between two loads.
    const keep = new Set(answered.map((p) => p.id));
    const progress = await client.from('user_question_progress').select('question_id,subject,chapter,last_correct,last_selected_key,last_attempted_at')
      .eq('user_id', userId).eq('last_correct', false).not('last_selected_key', 'is', null)
      .order('last_attempted_at', { ascending: false }).limit(MINE_LIMITS.missedRows);
    if (progress.error) throw Object.assign(new Error('MINE_PROGRESS_UNAVAILABLE'), { cause: progress.error });
    const missedIds = missedList(progress.data, today.date);
    const sinceOf = new Map(missedIds.map((m) => [m.id, m.since]));

    // The weakest chapters of the newest papers (a failed read only skips the weak places).
    let attempts = [];
    try { attempts = (await deps.attempts(userId)) || []; } catch (error) { warn(`[daily-mine] papers unread (${error?.message || error}); weak chapters skipped`); }
    const chapters = weakRanking(weakChapters(attempts.slice(0, MINE_LIMITS.attempts)), { subjectOf: bankSubject });
    const chapterKey = (subjectId, chapter) => `${subjectId}\u0001${clean(chapter)}`;

    const pinned = answered.map((p) => ({ n: p.n, kind: p.tag.kind, since: p.tag.since, q: pinnedRows.get(p.id) }));
    const room = (kind) => pinned.filter((p) => p.kind === kind).length;
    const chaptersOfKind = (kind) => new Set(pinned.filter((p) => p.kind === kind).map((p) => chapterKey(p.q.subjectId, p.q.chapterKey)));
    const usedIds = new Set([...keep, ...exclude]);

    // Missed: up to the open missed places plus spares (one a chapter is the assembly's rule; the list puts one question of
    // each chapter first).
    const missedNeed = Math.max(0, 2 - room('missed'));
    const missed = missedNeed ? await firstUsable(client, missedIds.map((m) => m.id), missedNeed + 2, budget, usedIds, state) : [];
    missed.forEach((q) => { q.since = sinceOf.get(q.id) || null; });
    const pinnedMissed = chaptersOfKind('missed');
    const missedTaken = Math.min(missedNeed, new Set(missed.map((q) => chapterKey(q.subjectId, q.chapterKey)).filter((k) => !pinnedMissed.has(k))).size);
    for (const q of missed) usedIds.add(q.id);

    // Weak: one question a chapter, chapter by chapter until full, skipping a chapter an answered weak place already holds.
    const pinnedWeak = chaptersOfKind('weak');
    const weakWant = Math.max(0, 2 - room('weak')) + (missedNeed - missedTaken);
    const weak = [];
    for (const ch of chapters) {
      if (weak.filter((l) => l.length).length >= weakWant || budget.left <= 0) break;
      if (pinnedWeak.has(chapterKey(ch.subject, ch.chapter))) continue;
      const ids = await unseen(client, userId, await candidateIds(client, ch.subject, ch.chapter, seed, state), seed);
      const found = await firstUsable(client, ids, 1, budget, usedIds, state);
      for (const q of found) usedIds.add(q.id);
      weak.push(found);
    }

    // Subject: the day's subject first, then the others in turn, until the open places are full (one spare).
    const taken = missedTaken + Math.min(weakWant, weak.filter((l) => l.length).length);
    const subjectWant = Math.max(0, 5 - answered.length - taken);
    const subject = [];
    for (const s of subjectTurn(subjects.map((x) => x.id), today.day).slice(0, MINE_LIMITS.subjects)) {
      if (subject.length >= subjectWant + 1 || budget.left <= 0) break;
      const ids = await unseen(client, userId, await candidateIds(client, s, null, seed, state), seed);
      const found = await firstUsable(client, ids, subjectWant + 1 - subject.length, budget, usedIds, state);
      for (const q of found) usedIds.add(q.id);
      subject.push(...found);
    }

    const places = assembleFive({ pinned, missed, weak, subject });
    if (!places) return { reason: 'thin_bank' };
    return {
      places: places.map((p) => ({ ...p, since: p.kind === 'missed' ? (pinned.find((x) => x.n === p.n)?.since ?? p.q.since ?? null) : null })),
      built: true,
    };
  }

  /** One question as it leaves: GET /api/daily's shape plus `why`. Its token is bound to this student (sealMineToken). */
  function questionOut(place, date, userId) {
    const { q } = place;
    const page = pageOf(q.subjectId);
    const since = place.kind === 'missed' && place.since ? place.since : null;
    return {
      subject: q.subject, q: q.q, options: [...q.options], chapter: q.chapter, ...(q.pastPaper ? { pastPaper: { ...q.pastPaper } } : {}),
      token: sealMineToken(deps.key, { date, n: place.n, id: q.id, correct: q.correct, why: q.why, userId, kind: place.kind, since, optionHash: q.optionHash }),
      why: { kind: place.kind, subject: page?.name || q.subject, chapter: q.chapter, ...(since ? { since } : {}) },
    };
  }

  return {
    canStart: enabled,

    async getMine(request) {
      const session = await Promise.resolve(deps.auth(request)).catch(() => null);
      const userId = session?.user?.id || null;
      if (!userId) return reply(401, { error: 'unauthorized' });
      const limit = await Promise.resolve(deps.rateLimit(request, { ...MINE_RATE, keyParts: [userId], identityOnly: true, fallback: 'memory' })).catch(() => ({ allowed: false }));
      if (!limit?.allowed) return reply(429, { error: 'rate_limited' }, limit?.retryAfterSeconds ? { 'Retry-After': String(Math.ceil(limit.retryAfterSeconds)) } : {});
      const today = todayDaily(now());
      let started = null;
      try {
        const rows = await deps.store.rows(userId, today.date);
        started = rows.some((r) => readTag(r?.metadata?.mine));
        if (!enabled()) return reply(200, off(started ? 'retry' : 'off'));
        if (!deps.key) return reply(200, off(started ? 'retry' : 'unavailable'));
        const got = await fiveFor(request, session, today, rows);
        if (!got.places) return reply(200, off(started ? 'retry' : got.reason));
        const body = { ok: true, personal: true, date: today.date, day: today.day, questions: got.places.map((p) => questionOut(p, today.date, userId)), mix: mineMix(got.places) };
        if (!got.built) return reply(200, body);
        const cookie = sealMineCookie(deps.key, minePayload({ date: today.date, userId, places: got.places }));
        let secure = true;
        try { secure = new URL(request.url).protocol === 'https:'; } catch { secure = true; }
        return reply(200, body, { 'Set-Cookie': mineCookieLine(cookie, { now: now(), secure }) });
      } catch (error) {
        warn(`[daily-mine] five not built (${error?.message || error})`);
        // Use the shared five only once the account read confirms there is no personal answer to replace.
        return reply(200, off(started === false ? 'unavailable' : 'retry'));
      }
    },

    /**
     * The `mine` tag for a checked question of THIS student's own five (the mark sealed in its token), or null: a shared-five
     * token or a token sealed for another student. Existing tokens still identify their five when new sets are off.
     */
    async tagOf({ token, userId, item } = {}) {
      try {
        if (!deps.key || !userId || !item) return null;
        const mark = openMineMark(deps.key, token);
        if (!mark || mark.userId !== userId) return null;
        return { ...mineTag(mark.kind, mark.since, randomBytes(9).toString('base64url')), optionHash: mark.optionHash };
      } catch {
        return null;
      }
    },

    /** Recheck a personal token before grading it. A Mob can select the question while the page is open. */
    async heldAtCheck({ token, userId, item }) {
      const owner = openMineMark(deps.key, token)?.userId;
      if (!owner) return false;
      const readers = userId && userId !== owner ? [owner, userId] : [owner];
      const holds = await Promise.all(readers.map((reader) => deps.held(reader)));
      return holds.some((ids) => ids.has(item.id));
    },

    /**
     * After a check stood. Answers undefined for a question that is not the student's own (no tag: the check's answer is then
     * exactly as before), else 'mistakes' | 'fixed' | null. Only a FIRST answer (`fresh`) feeds anything.
     */
    async feed({ userId, item, stood, tag = null, fresh = false }) {
      const personal = readTag(tag);
      if (!userId || !item || !stood || !personal) return undefined;
      if (!enabled()) return null;
      if (!fresh || !stood.sameQuestion) return null;
      try {
        const client = deps.db();
        const fixing = stood.right && personal.kind === 'missed';
        const [{ data: row, error }, before] = await Promise.all([
          client.from('questions').select(DEMO_FULL_SELECT).eq('id', item.id).maybeSingle(),
          fixing ? client.from('user_question_progress').select('last_correct').eq('user_id', userId).eq('question_id', item.id).maybeSingle() : null,
        ]);
        if (error || !row) throw new Error('MINE_FEED_QUESTION_UNREAD');
        if (before?.error) throw new Error('MINE_FEED_PROGRESS_UNREAD');
        const served = servedRow(row);
        // The pick was judged against the key the five was served with (in the token). A correction since (another key or
        // another option order) would map the pick to another option or judge it by another key: nothing is fed then.
        if (served.row?.correct_index !== item.correct) throw new Error('MINE_FEED_KEY_CHANGED: key changed since the five was served');
        const shaped = demoQuestionOut(served.row, row.subject);
        if (tag.optionHash && optionHashOf(row, served.order, shaped.options) !== tag.optionHash) {
          throw new Error('MINE_FEED_OPTIONS_CHANGED: options changed since the five was served');
        }
        const pickedStored = storedIndexOf(served.order, stood.pick);
        if (pickedStored < 0) throw new Error('MINE_FEED_PICK');
        const wasWrong = before?.data?.last_correct === false;
        // The writer practice uses (data/db.js _recordAttemptProgress), called as repairCheckStore.js calls it.
        await deps.recordProgress({
          userId,
          subject: row.subject,
          details: [{ qid: row.id, givenIndex: pickedStored, isCorrect: stood.right === true }],
          questionsSnapshot: [{ id: row.id, internalSubject: row.subject, subject: row.subject, chapter: row.chapter, options: row.options }],
        });
        if (!stood.right) return 'mistakes';
        if (!wasWrong) return null;
        // A right answer to a question the student had wrong: its Revise card moves when it is due today (answerRevise's own
        // rule; a card that is not due answers 409 and stays as it is).
        try {
          const moved = await deps.answerRevise(userId, { questionId: row.id, choice: stood.pick });
          if (moved?.http !== 200 && moved?.http !== 409) throw new Error(`status ${moved?.http}`);
        } catch (error) {
          warn(`[daily-mine] revise answer failed (${error?.message || error})`);
          return null;
        }
        return 'fixed';
      } catch (error) {
        warn(`[daily-mine] feedback skipped (${error?.message || error})`);
        return null;
      }
    },

    /** The shared five with the reasons of the answered rows' own questions added (at most five ids read). */
    async withReasons(rows, five) {
      const have = new Set((Array.isArray(five) ? five : []).map((q) => q.id));
      const ids = [...new Set((Array.isArray(rows) ? rows : []).map((r) => r?.question_id).filter((id) => typeof id === 'string' && !have.has(id)))].slice(0, 5);
      if (!ids.length) return five;
      try {
        const { data, error } = await deps.db().from('questions').select(DEMO_FULL_SELECT).in('id', ids);
        if (error) return five;
        const extra = (data || []).map((row) => ({ id: row.id, why: clean(servedRow(row).row?.explanation) }));
        return [...(Array.isArray(five) ? five : []), ...extra];
      } catch {
        return five;
      }
    },
  };
}
