// Key cards on the server (KEYCARDS-BUILD-SPEC.md 2a, 2b, 2e). No 'server-only' and no '@/' imports, so node:test drives
// it with a fake client (data/tests/keycards_routes.test.mjs); the routes wire the real clients through keycardsHttp.js.
//
// Content: the decks are files bundled with the site (data/keycards/decks/<subject>.json), loaded once per process and
// checked against data/keycards/manifest.json (sha256 of the file bytes). A mismatch disables that subject and is logged.
// No Supabase egress for content: the database holds only each student's schedule, reviews, reports and options.
// Free allowances are rows of learning_allowances (kinds keycard_review, keycard_new, keycard_line; period = the IST day
// and a slot number, so the table's primary key is the lock and a race cannot take an eleventh review).
// No paid model call anywhere here.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  ALLOWANCE, KEYCARD_RULES, MODES, RATINGS, canAdd, cardMinutes, chapterAddSet, clampClientTime, deckView, dueQueue, istDay,
  lineNeeded, memoryShare, newSchedule, schedule, tasteIds,
} from '../../../data/keycards.js';
import { chapterStates, stateFor, tallyChapters } from '../../../data/chapter_state.js';
import { getCanonicalSubject, isTopSubject } from '../../../data/canonical_syllabus.js';
import { chipFor } from './keycardsSyllabus.js';

export const keyCardsEnabled = (env = process.env) => env.KEY_CARDS_ENABLED === 'true';
export const OFF = Object.freeze({ http: 404, body: { error: 'KEY_CARDS_OFF' } });
const PRO = (reason) => ({ http: 402, body: { error: 'PRO_REQUIRED', reason } });
const bad = (error, http = 422) => ({ http, body: { error } });
const ok = (body) => ({ http: 200, body });
const fail = (code, cause) => Object.assign(new Error(code), { code, cause });
const STATE_COLUMNS = 'card_id,subject,chapter_key,schedule,reps,lapses,due_at,last_review_at,last_rating,added_from,added_at,suspended';
const PROGRESS_COLUMNS = 'question_id,subject,chapter,attempt_count,last_correct,last_attempted_at';
const REPORT_TTL_MS = 5 * 60 * 1000;
export const REPORT_SUSPEND_AT = 3;

// ---------------------------------------------------------------- decks

const sha = (text) => createHash('sha256').update(text).digest('hex');

/**
 * Read the bundled decks. Returns { bySubject: Map(subject -> { version, cards }), byId: Map, links: Map(subject -> {}),
 * disabled: [{ subject, why }] }. `fixture` (local and tests only) serves data/keycards/decks/_fixture.json for its subject
 * when the manifest has no deck for it.
 */
export function loadDecks({ dir = path.join(process.cwd(), 'data/keycards'), log = console.warn, fixture = false } = {}) {
  const bySubject = new Map();
  const byId = new Map();
  const links = new Map();
  const disabled = [];
  const read = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : null);
  let manifest = {};
  try { manifest = JSON.parse(read(path.join(dir, 'manifest.json')) || '{}'); } catch { manifest = {}; log('[keycards] manifest unreadable: no decks served'); }
  const add = (subject, deck) => {
    const cards = (deck.cards || []).filter((c) => c?.id && c.subject === subject);
    bySubject.set(subject, { version: deck.version, cards });
    for (const c of cards) byId.set(c.id, c);
    try { links.set(subject, JSON.parse(read(path.join(dir, 'links', `${subject}.json`)) || '{}')); } catch { links.set(subject, {}); }
  };
  for (const [subject, entry] of Object.entries(manifest)) {
    const text = read(path.join(dir, 'decks', `${subject}.json`));
    if (text === null) { disabled.push({ subject, why: 'missing' }); log(`[keycards] ${subject}: deck file missing, subject off`); continue; }
    if (sha(text) !== entry?.sha256) { disabled.push({ subject, why: 'sha256' }); log(`[keycards] ${subject}: deck sha256 does not match the manifest, subject off`); continue; }
    try { add(subject, JSON.parse(text)); } catch { disabled.push({ subject, why: 'json' }); log(`[keycards] ${subject}: deck unreadable, subject off`); }
  }
  if (fixture) {
    const text = read(path.join(dir, 'decks', '_fixture.json'));
    if (text) {
      const deck = JSON.parse(text);
      if (!bySubject.has(deck.subject)) {
        add(deck.subject, deck);
        try { links.set(deck.subject, JSON.parse(read(path.join(dir, 'links', '_fixture.json')) || '{}')); } catch { /* none */ }
      }
    }
  }
  return { bySubject, byId, links, disabled };
}

let processDecks = null;
/** The decks of this process (read once). */
export function decksOnce() {
  if (!processDecks) processDecks = loadDecks({ fixture: process.env.KEY_CARDS_FIXTURE === 'true' && process.env.VERCEL_ENV !== 'production' });
  return processDecks;
}

// ---------------------------------------------------------------- the service

const bookOrder = (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0);
const missingTable = (error) => /key_card|student_subject_options|schema cache|does not exist|PGRST20[25]|42P01/i.test(`${error?.code || ''} ${error?.message || ''}`);
const conflict = (error) => /23505|duplicate key|unique/i.test(`${error?.code || ''} ${error?.message || ''}`);

/**
 * deps:
 *   db              Supabase-like client (from/select/eq/in/like/lte/insert/update/upsert)
 *   decks           loadDecks() result
 *   syllabus        the keycardsSyllabus.js adapter
 *   getUser(id)     -> { isPremium, subjects } or null
 *   now()           ms
 *   inventory()     -> { chapterCounts } (the cached public inventory), optional
 *   reviewRecord(userId) -> the Review record (src/lib/server/review.js loadReviewRecord), optional
 *   marksLostRows(record) -> chapterRows(record) (data/review_chapters.mjs), optional
 *   isHeld(userId, questionId) -> true while the question's Mob paper is still open, optional
 */
export function createKeycards(deps) {
  const { db, decks, syllabus, getUser, now = () => Date.now(), inventory = null, reviewRecord = null, marksLostRows = null, isHeld = null } = deps;
  let reports = { at: -Infinity, set: new Set() };

  async function q(promise, code = 'KEY_CARDS_UNAVAILABLE') {
    const res = await promise;
    if (res?.error) throw fail(missingTable(res.error) ? 'KEY_CARDS_UNAVAILABLE' : code, res.error);
    return res;
  }

  /** Cards suspended for everyone: 3 or more distinct reports (key_card_reports), until the orchestrator reviews them. */
  async function suspendedForAll() {
    if (now() - reports.at < REPORT_TTL_MS) return reports.set;
    const { data } = await q(db.from('key_card_reports').select('card_id').limit(20000));
    const n = new Map();
    for (const r of data || []) n.set(r.card_id, (n.get(r.card_id) || 0) + 1);
    reports = { at: now(), set: new Set([...n].filter(([, c]) => c >= REPORT_SUSPEND_AT).map(([id]) => id)) };
    return reports.set;
  }

  /** The published cards a student may see now: in a served deck and not suspended for everyone. */
  async function published() {
    const off = await suspendedForAll();
    const byId = new Map([...decks.byId].filter(([id]) => !off.has(id)));
    return { byId, cardsOf: (subject) => (decks.bySubject.get(subject)?.cards || []).filter((c) => byId.has(c.id)) };
  }

  async function who(userId) {
    const user = await getUser(userId);
    if (!user) throw fail('USER_UNAVAILABLE');
    return { isPro: user.isPremium === true, subjects: Array.isArray(user.subjects) ? user.subjects : [] };
  }

  const loadStates = async (userId) => (await q(db.from('key_card_states').select(STATE_COLUMNS).eq('user_id', userId).limit(5000))).data || [];
  const loadOptions = async (userId) => {
    const res = await db.from('student_subject_options').select('subject,option').eq('user_id', userId);
    if (res.error) return new Map(); // no options table yet: behaviour is the no-option default
    return new Map((res.data || []).map((r) => [r.subject, r.option]));
  };

  // ---- allowances (learning_allowances; one row per use, period `${istDay}:${slot}`)
  async function used(userId, day) {
    const res = await db.from('learning_allowances').select('kind,period,reference').eq('user_id', userId)
      .in('kind', Object.values(ALLOWANCE)).like('period', `${day}:%`);
    if (res.error) throw fail('KEY_CARDS_UNAVAILABLE', res.error);
    const out = { [ALLOWANCE.review]: [], [ALLOWANCE.fresh]: [], [ALLOWANCE.line]: [] };
    for (const r of res.data || []) out[r.kind]?.push(r);
    return out;
  }
  /** Take the next free slot of `kind` today, up to `limit`. Returns true when a slot was taken. */
  async function claim(userId, kind, day, taken, limit, reference) {
    for (let slot = taken + 1; slot <= limit; slot += 1) {
      const res = await db.from('learning_allowances').insert({ user_id: userId, kind, period: `${day}:${slot}`, reference: String(reference).slice(0, 200), created_at: new Date(now()).toISOString() });
      if (!res.error) return true;
      if (!conflict(res.error)) throw fail('KEY_CARDS_UNAVAILABLE', res.error);
    }
    return false;
  }

  function today({ isPro, states, byId, use }) {
    const usedNew = use[ALLOWANCE.fresh].length;
    const reviewsLeft = isPro ? null : Math.max(0, KEYCARD_RULES.free.reviewsPerDay - use[ALLOWANCE.review].length);
    const newLeft = Math.max(0, (isPro ? KEYCARD_RULES.pro.newPerDayDefault : KEYCARD_RULES.free.newPerDay) - usedNew);
    const queue = dueQueue(states, byId, { now: now(), isPro, newAllowanceLeft: reviewsLeft === null ? newLeft : Math.min(newLeft, reviewsLeft), limit: Infinity });
    const playable = reviewsLeft === null ? queue.items.length : Math.min(queue.items.length, reviewsLeft);
    return { due: queue.due, newLeft: reviewsLeft === null ? newLeft : Math.min(newLeft, reviewsLeft), reviewsLeft, minutes: cardMinutes(playable), paused: queue.paused };
  }
  const todayPublic = (t) => ({ due: t.due, newLeft: t.newLeft, reviewsLeft: t.reviewsLeft, minutes: t.minutes });

  const chapterMeta = (key, cards) => {
    const c = syllabus.chapterByKey(key);
    const fromCard = cards.find((x) => x.source?.kind === 'ncert')?.source;
    const ncert = c?.ncert?.book ? { book: c.ncert.book, chapter: c.ncert.chapter } : fromCard ? { book: fromCard.book, chapter: fromCard.chapterNo } : null;
    return { key, title: c?.title || c?.name || cards[0]?.chapter || key, unit: c?.unit || cards[0]?.unit || null, ncert, chip: chipFor(c) };
  };

  async function progressRows(userId, subject = null) {
    let query = db.from('user_question_progress').select(PROGRESS_COLUMNS).eq('user_id', userId);
    if (subject) query = query.eq('subject', subject);
    const res = await query.gt('attempt_count', 0).limit(5000);
    return res.error ? [] : res.data || [];
  }

  // ---------------------------------------------------------------- GET /api/keycards
  async function overview(userId) {
    const [me, states, options, pub, progress] = await Promise.all([who(userId), loadStates(userId), loadOptions(userId), published(), progressRows(userId)]);
    const use = await used(userId, istDay(now()));
    const t = today({ isPro: me.isPro, states, byId: pub.byId, use });
    const stateOf = new Map(states.map((s) => [s.card_id, s]));
    const tally = tallyChapters(progress, syllabus.resolveChapter);
    const subjects = [];
    for (const subject of me.subjects.filter(isTopSubject)) {
      const option = options.get(subject) || null;
      const opts = syllabus.subjectOptions(subject);
      const cards = pub.cardsOf(subject);
      const byChapter = new Map();
      for (const c of cards) byChapter.set(c.chapterKey, [...(byChapter.get(c.chapterKey) || []), c]);
      const units = syllabus.unitsFor(subject, { option }).map((u) => ({
        unit: u.unit,
        chapters: u.chapters.map((c) => {
          const list = (byChapter.get(c.key) || []).sort(bookOrder);
          const mine = list.map((x) => stateOf.get(x.id)).filter(Boolean);
          const due = mine.filter((s) => !s.suspended && Number(s.reps) > 0 && Date.parse(s.due_at) <= now()).length;
          const tl = tally.get(c.key) || { n: 0, right: 0, lastAt: null };
          const memory = mine.length ? memoryShare(mine, list, now()) : null;
          const reviewed = mine.map((s) => Date.parse(s.last_review_at)).filter(Number.isFinite);
          const last = [tl.lastAt, ...reviewed].filter((x) => x !== null && Number.isFinite(x));
          const st = stateFor({ n: tl.n, right: tl.right, memory, lastActivityAt: last.length ? Math.max(...last) : null, now: now() });
          const meta = chapterMeta(c.key, list);
          return {
            key: c.key, title: c.title || c.name, ncert: meta.ncert, chip: chipFor(c),
            cards: list.length, mustKnow: list.filter((x) => x.importance === 'must').length,
            unlocked: me.isPro ? list.length : tasteIds(list).size,
            added: mine.length, due, state: st,
          };
        }),
      }));
      subjects.push({ subject, title: getCanonicalSubject(subject)?.subject_name || subject, option, ...(opts ? { options: opts } : {}), units });
    }
    return ok({ enabled: true, isPro: me.isPro, subjects, today: todayPublic(t) });
  }

  // ---------------------------------------------------------------- GET /api/keycards/deck?chapter=
  async function deck(userId, chapterKey) {
    if (typeof chapterKey !== 'string' || !chapterKey) return bad('CHAPTER_REQUIRED');
    const ch = syllabus.chapterByKey(chapterKey);
    if (!ch || ch.retired) return bad('CHAPTER_NOT_FOUND', 404);
    const [me, states, pub] = await Promise.all([who(userId), loadStates(userId), published()]);
    const subject = chapterKey.split('.')[0];
    const list = pub.cardsOf(subject).filter((c) => c.chapterKey === chapterKey).sort(bookOrder);
    const view = deckView(list, { isPro: me.isPro });
    const ids = new Set(list.map((c) => c.id));
    const meta = chapterMeta(chapterKey, list);
    return ok({
      chapter: { key: chapterKey, title: meta.title, unit: meta.unit, ncert: meta.ncert, chip: meta.chip },
      cards: view,
      counts: { total: list.length, mustKnow: list.filter((c) => c.importance === 'must').length, locked: view.filter((c) => c.locked).length },
      added: states.filter((s) => ids.has(s.card_id)).map((s) => s.card_id),
    });
  }

  // ---------------------------------------------------------------- POST /api/keycards/add
  async function add(userId, body) {
    const [me, states, pub] = await Promise.all([who(userId), loadStates(userId), published()]);
    let picked;
    let from;
    if (typeof body?.chapter === 'string' && body.chapter) {
      const ch = syllabus.chapterByKey(body.chapter);
      if (!ch || ch.retired) return bad('CHAPTER_NOT_FOUND', 404);
      picked = chapterAddSet(pub.cardsOf(body.chapter.split('.')[0]), body.chapter, { isPro: me.isPro });
      from = me.isPro ? 'chapter' : 'taste';
    } else if (Array.isArray(body?.cardIds) && body.cardIds.length && body.cardIds.length <= 100 && body.cardIds.every((id) => typeof id === 'string')) {
      const cards = [...new Set(body.cardIds)].map((id) => pub.byId.get(id)).filter(Boolean);
      picked = cards.filter((c) => canAdd(c, pub.cardsOf(c.subject), { isPro: me.isPro }));
      if (cards.length && !picked.length) return PRO('keycards');
      from = body.from === 'mistake' ? 'mistake' : 'manual';
    } else {
      return bad('CHAPTER_OR_CARDS_REQUIRED');
    }
    const have = new Set(states.map((s) => s.card_id));
    const at = new Date(now()).toISOString();
    const rows = picked.filter((c) => !have.has(c.id)).map((c) => ({
      user_id: userId, card_id: c.id, subject: c.subject, chapter_key: c.chapterKey, schedule: newSchedule(now()), reps: 0, lapses: 0,
      due_at: at, last_review_at: null, last_rating: null, added_from: from, added_at: at, suspended: false,
    }));
    if (rows.length) await q(db.from('key_card_states').upsert(rows, { onConflict: 'user_id,card_id', ignoreDuplicates: true }));
    const after = await loadStates(userId);
    const use = await used(userId, istDay(now()));
    return ok({ added: rows.length, today: todayPublic(today({ isPro: me.isPro, states: after, byId: pub.byId, use })) });
  }

  // ---------------------------------------------------------------- GET /api/keycards/due
  async function dueCards(userId, { limit = 20 } = {}) {
    const n = Math.max(1, Math.min(50, Number.parseInt(limit, 10) || 20));
    const [me, states, pub] = await Promise.all([who(userId), loadStates(userId), published()]);
    const use = await used(userId, istDay(now()));
    const t = today({ isPro: me.isPro, states, byId: pub.byId, use });
    const room = t.reviewsLeft === null ? n : Math.min(n, t.reviewsLeft);
    const queue = dueQueue(states, pub.byId, { now: now(), isPro: me.isPro, newAllowanceLeft: t.newLeft, limit: room });
    return ok({
      cards: queue.items.map(({ card, state }) => ({ ...card, state: { reps: Number(state.reps) || 0, lapses: Number(state.lapses) || 0, due: state.due_at } })),
      today: todayPublic(t),
    });
  }

  // ---------------------------------------------------------------- POST /api/keycards/review
  async function review(userId, body) {
    const { cardId, rating, mode } = body || {};
    if (typeof cardId !== 'string' || !RATINGS.includes(rating) || !MODES.includes(mode)) return bad('INVALID_REVIEW');
    const pub = await published();
    const card = pub.byId.get(cardId);
    if (!card) return bad('CARD_NOT_FOUND', 404);
    const me = await who(userId);
    if (!me.isPro && !canAdd(card, pub.cardsOf(card.subject), { isPro: false })) return PRO('keycards');
    const serverNow = now();
    const clientAt = clampClientTime(body.clientReviewedAt, serverNow);
    const day = istDay(serverNow);
    const states = await loadStates(userId);
    const state = states.find((s) => s.card_id === cardId) || null;
    const nextOf = (s) => (s && Number(s.reps) > 0 ? { due_at: s.due_at, interval_days: Math.max(0, Math.round(((Date.parse(s.due_at) - serverNow) / 86_400_000) * 100) / 100) } : null);
    const replay = async () => {
      const fresh = (await loadStates(userId)).find((s) => s.card_id === cardId) || null;
      const use = await used(userId, day);
      return ok({ ok: true, replay: true, next: nextOf(fresh), today: todayPublic(today({ isPro: me.isPro, states: await loadStates(userId), byId: pub.byId, use })) });
    };
    // A replay of the same (card, client time) changes nothing: the outbox may send a review twice.
    if (clientAt) {
      const seen = await q(db.from('key_card_reviews').select('id').eq('user_id', userId).eq('card_id', cardId).eq('client_reviewed_at', clientAt).limit(1));
      if (seen.data?.length) return replay();
    }
    const reviewRow = { user_id: userId, card_id: cardId, card_v: Number(card.v) || 1, rating, mode, reviewed_at: new Date(serverNow).toISOString(), client_reviewed_at: clientAt };
    // A last look is logged and never moves the schedule, and it uses no allowance.
    if (mode === 'last_look') {
      const ins = await db.from('key_card_reviews').insert({ ...reviewRow, scheduled_days: null, elapsed_days: null });
      if (ins.error && conflict(ins.error)) return replay();
      if (ins.error) throw fail('KEY_CARDS_UNAVAILABLE', ins.error);
      const use = await used(userId, day);
      return ok({ ok: true, next: nextOf(state), today: todayPublic(today({ isPro: me.isPro, states, byId: pub.byId, use })) });
    }
    if (state?.suspended) return bad('CARD_SUSPENDED', 409);
    const use = await used(userId, day);
    const isNew = !state || !(Number(state.reps) > 0);
    if (!me.isPro && !(await claim(userId, ALLOWANCE.review, day, use[ALLOWANCE.review].length, KEYCARD_RULES.free.reviewsPerDay, `${cardId}@${clientAt || reviewRow.reviewed_at}`))) {
      return PRO('keycard_reviews');
    }
    if (isNew) await claim(userId, ALLOWANCE.fresh, day, use[ALLOWANCE.fresh].length, 1000, cardId);
    const at = clientAt ? Date.parse(clientAt) : serverNow;
    const next = schedule(state, rating, at);
    const ins = await db.from('key_card_reviews').insert({ ...reviewRow, scheduled_days: next.scheduled_days, elapsed_days: next.elapsed_days });
    if (ins.error && conflict(ins.error)) return replay();
    if (ins.error) throw fail('KEY_CARDS_UNAVAILABLE', ins.error);
    const patch = { schedule: next.schedule, reps: next.reps, lapses: next.lapses, due_at: next.due_at, last_review_at: new Date(at).toISOString(), last_rating: rating };
    if (state) {
      const moved = await q(db.from('key_card_states').update(patch).eq('user_id', userId).eq('card_id', cardId).eq('reps', Number(state.reps) || 0).select('card_id'));
      if (!moved.data?.length) return bad('REVIEW_CONFLICT', 409);
    } else {
      const added = await db.from('key_card_states').insert({
        user_id: userId, card_id: cardId, subject: card.subject, chapter_key: card.chapterKey, ...patch,
        added_from: mode === 'revise' ? 'mistake' : 'manual', added_at: new Date(serverNow).toISOString(), suspended: false,
      });
      if (added.error) { if (conflict(added.error)) return bad('REVIEW_CONFLICT', 409); throw fail('KEY_CARDS_UNAVAILABLE', added.error); }
    }
    const after = await loadStates(userId);
    const useAfter = await used(userId, day);
    return ok({ ok: true, next: { due_at: next.due_at, interval_days: next.interval_days }, today: todayPublic(today({ isPro: me.isPro, states: after, byId: pub.byId, use: useAfter })) });
  }

  // ---------------------------------------------------------------- GET /api/keycards/line?questionId=
  async function line(userId, questionId) {
    if (typeof questionId !== 'string' || !questionId || questionId.length > 200) return bad('QUESTION_REQUIRED');
    const none = (extra = {}) => ok({ cards: [], source: 'none', ...extra });
    const answered = await db.from('user_question_progress').select('question_id,attempt_count').eq('user_id', userId).eq('question_id', questionId).limit(1);
    if (answered.error || !(Number(answered.data?.[0]?.attempt_count) > 0)) return none();
    if (isHeld && (await isHeld(userId, questionId))) return none();
    const qres = await db.from('questions').select('id,subject,chapter,question,body,explanation,is_deleted').eq('id', questionId).limit(1);
    const row = qres.data?.[0];
    if (qres.error || !row || row.is_deleted) return none();
    const pub = await published();
    const resolved = row.chapter ? syllabus.resolveChapter(row.subject, row.chapter) : null;
    const explanation = typeof row.explanation === 'string' ? row.explanation : row.explanation?.text || '';
    const fallback = resolved && !resolved.retired ? { chapterKey: resolved.key, text: `${row.question || row.body || ''} ${explanation}` } : null;
    const found = lineNeeded(questionId, decks.links.get(row.subject) || {}, pub.byId, fallback);
    if (found.source === 'none') return none();
    const me = await who(userId);
    if (me.isPro) return ok({ cards: found.cards, source: found.source });
    const day = istDay(now());
    const use = await used(userId, day);
    const mine = use[ALLOWANCE.line];
    const limit = KEYCARD_RULES.free.lineNeededPerDay;
    // The same question again today uses nothing more.
    if (!mine.some((r) => r.reference === questionId)) {
      if (!(await claim(userId, ALLOWANCE.line, day, mine.length, limit, questionId))) return PRO('keycard_line');
      return ok({ cards: found.cards, source: found.source, left: Math.max(0, limit - mine.length - 1) });
    }
    return ok({ cards: found.cards, source: found.source, left: Math.max(0, limit - mine.length) });
  }

  // ---------------------------------------------------------------- POST /api/keycards/report
  async function report(userId, body) {
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    if (typeof body?.cardId !== 'string' || !decks.byId.has(body.cardId)) return bad('CARD_NOT_FOUND', 404);
    if (!reason || reason.length > 300) return bad('REASON_REQUIRED');
    await q(db.from('key_card_reports').upsert([{ user_id: userId, card_id: body.cardId, reason, created_at: new Date(now()).toISOString() }], { onConflict: 'user_id,card_id' }));
    reports = { at: -Infinity, set: reports.set }; // read again on the next request
    return ok({ ok: true });
  }

  // ---------------------------------------------------------------- GET /api/me/chapters?subject=
  async function chapters(userId, subject) {
    if (!isTopSubject(subject)) return bad('SUBJECT_NOT_FOUND', 404);
    const [me, states, options, pub, progress] = await Promise.all([who(userId), loadStates(userId), loadOptions(userId), published(), progressRows(userId, subject)]);
    const option = options.get(subject) || null;
    const units = syllabus.unitsFor(subject, { option });
    const cardsByChapter = new Map();
    for (const c of pub.cardsOf(subject)) cardsByChapter.set(c.chapterKey, [...(cardsByChapter.get(c.chapterKey) || []), c]);
    const marksLost = new Map();
    if (reviewRecord && marksLostRows) {
      try {
        const record = await reviewRecord(userId);
        for (const row of marksLostRows(record) || []) {
          if (row.subject !== subject) continue;
          const r = syllabus.resolveChapter(subject, row.name);
          if (r && !r.retired) marksLost.set(r.key, (marksLost.get(r.key) || 0) + (Number(row.lost) || 0));
        }
      } catch { /* marks lost unknown: 0, as for a chapter never asked */ }
    }
    const available = new Map();
    let counts = {};
    if (inventory) { try { counts = (await inventory())?.chapterCounts?.[subject] || {}; } catch { counts = {}; } }
    const questionsByKey = new Map();
    for (const [name, n] of Object.entries(counts)) {
      const r = syllabus.resolveChapter(subject, name);
      if (r && !r.retired) questionsByKey.set(r.key, (questionsByKey.get(r.key) || 0) + (Number(n) || 0));
    }
    for (const u of units) for (const c of u.chapters) available.set(c.key, { questions: questionsByKey.get(c.key) || 0, cards: (cardsByChapter.get(c.key) || []).length });
    const out = chapterStates({ units, progress, resolveChapter: syllabus.resolveChapter, cardStates: states, cardsByChapter, marksLost, available, isPro: me.isPro, now: now() });
    return ok({ subject, option, units: out });
  }

  // ---------------------------------------------------------------- PUT /api/me/subject-options
  async function putOption(userId, body) {
    const subject = body?.subject;
    const choices = syllabus.subjectOptions(subject)?.choices || [];
    if (!choices.some((c) => c.id === body?.option)) return bad('OPTION_NOT_FOUND');
    await q(db.from('student_subject_options').upsert([{ user_id: userId, subject, option: body.option, updated_at: new Date(now()).toISOString() }], { onConflict: 'user_id,subject' }));
    return ok({ subject, option: body.option });
  }

  // ---------------------------------------------------------------- Revise and Today
  /** Revise's third source: today's playable Key cards (the queue of 2c, within the Free allowance). */
  async function reviseSource(userId, { limit = 20 } = {}) {
    const res = await dueCards(userId, { limit });
    const t = res.body.today;
    return { due: t.due, items: res.body.cards.map((card) => ({ kind: 'keycard', cardId: card.id, card })), minutes: cardMinutes(res.body.cards.length) };
  }
  /** How many Key cards are due now (reviewed before, due, live, not suspended). No allowance read. */
  async function dueCount(userId) {
    const [states, pub] = await Promise.all([loadStates(userId), published()]);
    return dueQueue(states, pub.byId, { now: now(), limit: 0 }).due;
  }

  return { overview, deck, add, due: dueCards, review, line, report, chapters, putOption, reviseSource, dueCount };
}
