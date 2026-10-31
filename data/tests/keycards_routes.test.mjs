// Key cards route handlers (src/lib/server/keycards.js, KEYCARDS-BUILD-SPEC.md 2e) against a fake database that enforces the
// migration's keys (supabase/migrations/20261031140000_key_cards.sql), so races and replays behave as in Postgres.
// Covers: Free and Pro views, the 402 paths, the Free allowances, idempotent replays, last look, reports, options, chapters.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createKeycards } from '../../src/lib/server/keycards.js';
import { syllabusFrom } from '../../src/lib/server/keycardsSyllabus.js';
import { KEYCARD_RULES, schedule } from '../keycards.js';

const DAY = 86_400_000;
const T0 = Date.parse('2026-11-02T18:00:00+05:30');

// ---------------------------------------------------------------- a fake Supabase client with the migration's keys
const KEYS = {
  key_card_states: ['user_id', 'card_id'],
  key_card_reports: ['user_id', 'card_id'],
  student_subject_options: ['user_id', 'subject'],
  learning_allowances: ['user_id', 'kind', 'period'],
  key_card_reviews: ['user_id', 'card_id', 'client_reviewed_at'], // the partial unique index (client time not null)
};
const MAX_ROWS = 1000; // PostgREST's max-rows: a select past it is cut, as on Supabase
function fakeDb(tables = {}) {
  const log = [];
  let ids = 0;
  const like = (v, p) => new RegExp(`^${String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`).test(String(v ?? ''));
  const clash = (table, row) => {
    const key = KEYS[table];
    if (!key) return false;
    if (table === 'key_card_reviews' && row.client_reviewed_at == null) return false;
    return (tables[table] || []).some((r) => key.every((k) => r[k] === row[k]));
  };
  class Q {
    constructor(t) { this.t = t; this.f = []; this.op = 'select'; this.eqs = {}; }
    select(cols) { if (this.op === 'select') this.cols = cols; else this.returning = true; return this; }
    eq(k, v) { this.eqs[k] = v; this.f.push((r) => r[k] === v); return this; }
    in(k, l) { this.f.push((r) => l.includes(r[k])); return this; }
    like(k, p) { this.f.push((r) => like(r[k], p)); return this; }
    gt(k, v) { this.f.push((r) => Number(r[k]) > v); return this; }
    limit(n) { this.max = n; return this; }
    order(k) { this.by = k; return this; }
    range(a, b) { this.from = a; this.to = b; return this; }
    insert(row) { this.op = 'insert'; this.row = row; return this; }
    update(p) { this.op = 'update'; this.patch = p; return this; }
    upsert(rows, o) { this.op = 'upsert'; this.rows = rows; this.o = o || {}; return this; }
    then(res, rej) { return Promise.resolve(this.run()).then(res, rej); }
    run() {
      log.push({ table: this.t, op: this.op, cols: this.cols, eqs: this.eqs, range: this.from === undefined ? null : [this.from, this.to] });
      const all = tables[this.t] || (tables[this.t] = []);
      if (this.op === 'insert') {
        if (clash(this.t, this.row)) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
        all.push({ ...(this.t === 'key_card_reviews' ? { id: ++ids } : {}), ...this.row });
        return { data: null, error: null };
      }
      if (this.op === 'upsert') {
        for (const row of this.rows) {
          const at = all.findIndex((r) => KEYS[this.t].every((k) => r[k] === row[k]));
          if (at < 0) all.push({ ...row }); else if (!this.o.ignoreDuplicates) all[at] = { ...all[at], ...row };
        }
        return { data: null, error: null };
      }
      let rows = all.filter((r) => this.f.every((f) => f(r)));
      if (this.op === 'update') { for (const r of rows) Object.assign(r, this.patch); return { data: rows.map((r) => ({ card_id: r.card_id })), error: null }; }
      // PostgREST: rows in no promised order unless asked, a range when given, and never more than max-rows (1,000).
      if (this.by) rows = [...rows].sort((a, b) => String(a[this.by]).localeCompare(String(b[this.by])));
      else rows = [...rows].reverse();
      if (this.from !== undefined) rows = rows.slice(this.from, this.to + 1);
      rows = rows.slice(0, Math.min(this.max || MAX_ROWS, MAX_ROWS));
      return { data: rows.map((r) => ({ ...r })), error: null };
    }
  }
  return { from: (t) => new Q(t), tables, log };
}

// ---------------------------------------------------------------- decks built in the test (two chapters)
const mk = (chapterSlug, i, over = {}) => ({
  id: `kc.business_studies.${chapterSlug}.def-c${i}`, v: 1, subject: 'business_studies', chapterKey: `business_studies.${chapterSlug}`,
  chapter: chapterSlug, unit: chapterSlug, kind: 'definition', front: `What is ${chapterSlug} ${i}?`, back: `Line ${i} of ${chapterSlug}.`,
  quote: `Line ${i} of ${chapterSlug} about planning objectives and premises.`, blanks: [], importance: i <= 6 ? 'must' : 'good', asked: 0, tags: [], order: i * 10,
  source: { kind: 'ncert', book: 'Business Studies Part 1', code: 'lebs104', chapterNo: 4, page: 90 + i }, ...over,
});
const PLANNING = Array.from({ length: 8 }, (_, i) => mk('planning', i + 1));
const STAFFING = Array.from({ length: 3 }, (_, i) => mk('staffing', i + 1));
const CARDS = [...PLANNING, ...STAFFING];
const decks = (cards = CARDS) => ({
  bySubject: new Map([['business_studies', { version: 1, cards }]]),
  byId: new Map(cards.map((c) => [c.id, c])),
  links: new Map([['business_studies', { 'q-linked': [PLANNING[0].id] }]]),
  disabled: [],
});

function setup({ isPro = false, tables = {}, clock = { t: T0 }, subjects = ['business_studies', 'economics', 'not_a_subject'], cards = CARDS } = {}) {
  const db = fakeDb(tables);
  const kc = createKeycards({
    db, decks: decks(cards), syllabus: syllabusFrom(null), now: () => clock.t,
    getUser: async (id) => ({ id, isPremium: typeof isPro === 'function' ? isPro(id) : isPro, subjects }),
    inventory: async () => ({ chapterCounts: { business_studies: { Planning: 120, Staffing: 40 } } }),
    reviewRecord: async () => ({ fake: true }),
    marksLostRows: () => [{ subject: 'business_studies', name: 'Staffing', lost: 18 }, { subject: 'economics', name: 'Money & Banking', lost: 6 }],
    isHeld: async (_u, q) => q === 'q-held',
  });
  return { db, kc, clock };
}

// ---------------------------------------------------------------- tests

test('GET /api/keycards: the student\'s top subjects only, units in order, Free unlocked counts and today', async () => {
  const { kc } = setup();
  const out = await kc.overview('u1');
  assert.equal(out.http, 200);
  assert.deepEqual(out.body.subjects.map((s) => s.subject), ['business_studies', 'economics']);
  assert.equal(out.body.enabled, true);
  assert.equal(out.body.isPro, false);
  const bs = out.body.subjects[0];
  assert.equal(bs.title, 'Business Studies');
  assert.equal('options' in bs, false, 'only Mathematics, Computer Science and Accountancy carry options');
  const planning = bs.units.flatMap((u) => u.chapters).find((c) => c.key === 'business_studies.planning');
  assert.deepEqual({ cards: planning.cards, mustKnow: planning.mustKnow, unlocked: planning.unlocked, added: planning.added, due: planning.due }, { cards: 8, mustKnow: 6, unlocked: 5, added: 0, due: 0 });
  assert.deepEqual(planning.ncert, { book: 'Business Studies Part 1', chapter: 4 });
  assert.deepEqual(planning.state, { state: 'none', label: 'Not started', fading: false });
  assert.deepEqual(out.body.today, { due: 0, newLeft: 5, reviewsLeft: 10, minutes: 0 });
});

test('GET /api/keycards/deck: Free gets locked stubs past the taste, Pro the whole deck; an unknown chapter is 404', async () => {
  const free = await setup().kc.deck('u1', 'business_studies.planning');
  assert.equal(free.body.counts.total, 8);
  assert.equal(free.body.counts.locked, 3);
  assert.deepEqual(free.body.cards.filter((c) => c.locked).map((c) => Object.keys(c).sort()), Array(3).fill(['id', 'kind', 'label', 'locked']));
  assert.equal(free.body.chapter.title, 'Planning');
  const pro = await setup({ isPro: true }).kc.deck('u1', 'business_studies.planning');
  assert.equal(pro.body.counts.locked, 0);
  assert.equal((await setup().kc.deck('u1', 'business_studies.nope')).http, 404);
  assert.equal((await setup().kc.deck('u1', 'business_studies.entrepreneurship-development')).http, 404, 'a retired chapter has no deck');
});

test('POST /api/keycards/add: Free adds the taste, Pro the Must-know set; a locked card is 402 for Free', async () => {
  const f = setup();
  const added = await f.kc.add('u1', { chapter: 'business_studies.planning' });
  assert.equal(added.body.added, 5);
  assert.ok(f.db.tables.key_card_states.every((s) => s.added_from === 'taste'));
  assert.equal((await f.kc.add('u1', { chapter: 'business_studies.planning' })).body.added, 0, 'adding again adds nothing');
  assert.deepEqual(await f.kc.add('u1', { cardIds: [PLANNING[7].id] }), { http: 402, body: { error: 'PRO_REQUIRED', reason: 'keycards' } });
  assert.equal((await f.kc.add('u1', {})).http, 422);
  const p = setup({ isPro: true });
  const proAdded = await p.kc.add('u1', { chapter: 'business_studies.planning' });
  assert.equal(proAdded.body.added, 6);
  assert.ok(p.db.tables.key_card_states.every((s) => s.added_from === 'chapter'));
  const one = await p.kc.add('u1', { cardIds: [PLANNING[7].id], from: 'mistake' });
  assert.equal(one.body.added, 1);
  assert.equal(p.db.tables.key_card_states.find((s) => s.card_id === PLANNING[7].id).added_from, 'mistake');
  assert.equal(proAdded.body.today.newLeft, 15);
});

test('POST /api/keycards/review: schedules, and a Free student\'s eleventh review today is 402 keycard_reviews', async () => {
  const f = setup();
  await f.kc.add('u1', { chapter: 'business_studies.planning' });
  await f.kc.add('u1', { chapter: 'business_studies.staffing' });
  const ids = [...PLANNING.slice(0, 5), ...STAFFING].map((c) => c.id);
  const first = await f.kc.review('u1', { cardId: ids[0], rating: 3, mode: 'study', clientReviewedAt: new Date(T0 - 10 * 60_000).toISOString() });
  assert.equal(first.http, 200);
  assert.ok(first.body.next.interval_days > 0);
  assert.equal(f.db.tables.key_card_states.find((s) => s.card_id === ids[0]).reps, 1);
  let last;
  // In time order (a review older than the card's last one is only logged: H2).
  for (let i = 1; i < 10; i += 1) last = await f.kc.review('u1', { cardId: ids[i % ids.length], rating: 1, mode: 'revise', clientReviewedAt: new Date(T0 - (10 - i) * 60_000).toISOString() });
  assert.equal(last.body.today.reviewsLeft, 0);
  const over = await f.kc.review('u1', { cardId: ids[2], rating: 3, mode: 'study' });
  assert.deepEqual(over, { http: 402, body: { error: 'PRO_REQUIRED', reason: 'keycard_reviews' } });
  // The next IST day the allowance is back.
  f.clock.t = T0 + DAY;
  assert.equal((await f.kc.review('u1', { cardId: ids[2], rating: 3, mode: 'study' })).http, 200);
  assert.equal((await f.kc.review('u1', { cardId: ids[0], rating: 2, mode: 'study' })).http, 422);
  assert.equal((await f.kc.review('u1', { cardId: 'kc.none', rating: 3, mode: 'study' })).http, 404);
  assert.deepEqual(await f.kc.review('u1', { cardId: PLANNING[7].id, rating: 3, mode: 'study' }), { http: 402, body: { error: 'PRO_REQUIRED', reason: 'keycards' } });
});

test('a replay with the same (cardId, clientReviewedAt) is idempotent: one review row, one schedule move, one allowance', async () => {
  const f = setup();
  await f.kc.add('u1', { chapter: 'business_studies.staffing' });
  const body = { cardId: STAFFING[0].id, rating: 4, mode: 'revise', clientReviewedAt: new Date(T0 - 3600_000).toISOString() };
  const a = await f.kc.review('u1', body);
  const b = await f.kc.review('u1', body);
  assert.equal(a.http, 200);
  assert.equal(b.http, 200);
  assert.equal(b.body.replay, true);
  assert.equal(b.body.next.due_at, a.body.next.due_at);
  assert.equal(f.db.tables.key_card_reviews.length, 1);
  assert.equal(f.db.tables.key_card_states.find((s) => s.card_id === STAFFING[0].id).reps, 1);
  assert.equal(f.db.tables.learning_allowances.filter((r) => r.kind === 'keycard_review').length, 1);
  assert.equal(b.body.today.reviewsLeft, 9);
  // A future client time is clamped to server now; a very old one to 48 hours ago.
  await f.kc.review('u1', { ...body, cardId: STAFFING[1].id, clientReviewedAt: new Date(T0 + DAY).toISOString() });
  await f.kc.review('u1', { ...body, cardId: STAFFING[2].id, clientReviewedAt: new Date(T0 - 9 * DAY).toISOString() });
  const times = f.db.tables.key_card_reviews.map((r) => r.client_reviewed_at);
  assert.equal(times[1], new Date(T0).toISOString());
  assert.equal(times[2], new Date(T0 - 2 * DAY).toISOString());
});

test('a last look is logged and never moves the schedule or uses an allowance', async () => {
  const f = setup();
  await f.kc.add('u1', { chapter: 'business_studies.staffing' });
  const before = { ...f.db.tables.key_card_states[0] };
  const out = await f.kc.review('u1', { cardId: before.card_id, rating: 3, mode: 'last_look' });
  assert.equal(out.http, 200);
  assert.deepEqual(f.db.tables.key_card_states[0], before);
  assert.equal(f.db.tables.key_card_reviews[0].mode, 'last_look');
  assert.equal((f.db.tables.learning_allowances || []).length, 0);
});

test('GET /api/keycards/due: due first, then new within the Free allowance, each with its state', async () => {
  const f = setup();
  await f.kc.add('u1', { chapter: 'business_studies.planning' });
  await f.kc.add('u1', { chapter: 'business_studies.staffing' });
  await f.kc.review('u1', { cardId: STAFFING[0].id, rating: 1, mode: 'study' });
  f.clock.t = T0 + 2 * DAY;
  const out = await f.kc.due('u1', { limit: 20 });
  assert.equal(out.body.cards[0].id, STAFFING[0].id, 'the reviewed card is due first');
  assert.equal(out.body.cards[0].state.reps, 1);
  assert.equal(out.body.cards.filter((c) => c.state.reps === 0).length, 5, 'Free: 5 new a day');
  assert.equal(out.body.today.due, 1);
  assert.equal(out.body.today.minutes, 2);
  assert.equal((await f.kc.due('u1', { limit: 2 })).body.cards.length, 2);
  // Revise's source is the same queue, and the count for Tonight reads no allowance.
  const src = await f.kc.reviseSource('u1');
  assert.equal(src.items.length, 6);
  assert.ok(src.items.every((i) => i.kind === 'keycard' && i.card?.id === i.cardId));
  assert.equal(await f.kc.dueCount('u1'), 1);
});

test('GET /api/keycards/line: linked first, matched next; Free gets 3 questions a day, the same one again is free', async () => {
  const progress = ['q-linked', 'q-match', 'q-3', 'q-4', 'q-held'].map((id) => ({ user_id: 'u1', question_id: id, subject: 'business_studies', chapter: 'Planning', attempt_count: 1, last_correct: false, last_attempted_at: new Date(T0 - DAY).toISOString() }));
  const questions = ['q-linked', 'q-match', 'q-3', 'q-4', 'q-held', 'q-unanswered'].map((id) => ({ id, subject: 'business_studies', chapter: 'Planning', question: `Line 3 of planning about planning objectives and premises (${id}).`, explanation: '', is_deleted: false }));
  const f = setup({ tables: { user_question_progress: progress, questions } });
  const linked = await f.kc.line('u1', 'q-linked');
  assert.equal(linked.body.source, 'linked');
  assert.equal(linked.body.cards[0].id, PLANNING[0].id);
  assert.equal(linked.body.left, 2);
  assert.equal((await f.kc.line('u1', 'q-linked')).body.left, 2, 'the same question again uses nothing');
  const matched = await f.kc.line('u1', 'q-match');
  assert.equal(matched.body.source, 'matched');
  assert.ok(matched.body.cards.length >= 1 && matched.body.cards.length <= 2);
  assert.equal((await f.kc.line('u1', 'q-3')).body.left, 0);
  assert.deepEqual(await f.kc.line('u1', 'q-4'), { http: 402, body: { error: 'PRO_REQUIRED', reason: 'keycard_line' } });
  assert.deepEqual((await f.kc.line('u1', 'q-unanswered')).body, { cards: [], source: 'none' }, 'never for a question not answered');
  assert.deepEqual((await f.kc.line('u1', 'q-held')).body, { cards: [], source: 'none' }, 'never while its Mob paper is open');
  const pro = setup({ isPro: true, tables: { user_question_progress: progress.map((p) => ({ ...p })), questions } });
  for (const id of ['q-linked', 'q-match', 'q-3', 'q-4']) assert.equal((await pro.kc.line('u1', id)).http, 200);
});

test('POST /api/keycards/report: three distinct students suspend a card for everyone', async () => {
  const tables = {};
  const f = setup({ tables, isPro: true });
  const id = PLANNING[0].id;
  assert.equal((await f.kc.report('u1', { cardId: id, reason: '' })).http, 422);
  assert.equal((await f.kc.report('u1', { cardId: id, reason: 'x'.repeat(301) })).http, 422);
  assert.equal((await f.kc.report('u1', { cardId: 'kc.none', reason: 'typo' })).http, 404);
  await f.kc.report('u1', { cardId: id, reason: 'The page number is wrong' });
  await f.kc.report('u1', { cardId: id, reason: 'Again from the same student' });
  await f.kc.report('u2', { cardId: id, reason: 'Typo' });
  assert.ok((await f.kc.deck('u9', 'business_studies.planning')).body.cards.some((c) => c.id === id), 'two students are not enough');
  await f.kc.report('u3', { cardId: id, reason: 'Not in my book' });
  const deck = await f.kc.deck('u9', 'business_studies.planning');
  assert.equal(deck.body.cards.some((c) => c.id === id), false);
  assert.equal((await f.kc.review('u9', { cardId: id, rating: 3, mode: 'study' })).http, 404);
});

test('PUT /api/me/subject-options and GET /api/me/chapters: options validated; Pro detail only for Pro', async () => {
  const f = setup();
  assert.equal((await f.kc.putOption('u1', { subject: 'accountancy', option: 'B1' })).http, 422);
  assert.equal((await f.kc.putOption('u1', { subject: 'business_studies', option: 'AFS' })).http, 422);
  assert.deepEqual((await f.kc.putOption('u1', { subject: 'accountancy', option: 'CAS' })).body, { subject: 'accountancy', option: 'CAS' });
  assert.deepEqual((await f.kc.putOption('u1', { subject: 'accountancy', option: 'AFS' })).body, { subject: 'accountancy', option: 'AFS' });
  assert.equal(f.db.tables.student_subject_options.length, 1);
  const progress = Array.from({ length: 12 }, (_, i) => ({ user_id: 'u1', question_id: `p${i}`, subject: 'business_studies', chapter: 'Staffing', attempt_count: 1, last_correct: i < 2, last_attempted_at: new Date(T0 - DAY).toISOString() }));
  const free = setup({ tables: { user_question_progress: progress } });
  const out = await free.kc.chapters('u1', 'business_studies');
  const staffing = out.body.units.flatMap((u) => u.chapters).find((c) => c.key === 'business_studies.staffing');
  assert.deepEqual(staffing, { key: 'business_studies.staffing', title: 'Staffing', state: 'weak', label: 'Needs work', fading: false, marksLost: 18, available: { questions: 40, cards: 3 } });
  const pro = setup({ isPro: true, tables: { user_question_progress: progress.map((p) => ({ ...p })) } });
  const proStaffing = (await pro.kc.chapters('u1', 'business_studies')).body.units.flatMap((u) => u.chapters).find((c) => c.key === 'business_studies.staffing');
  assert.equal(proStaffing.n, 12);
  assert.equal(proStaffing.reason, '2 of 12 right on the latest try at each question');
  assert.equal((await free.kc.chapters('u1', 'klingon')).http, 404);
});

// ---------------------------------------------------------------- code review fixes (31 Oct 2026)

/** A Pro student's `n` reviewed states, all due yesterday, over a deck of `n` cards in chapters of 40. */
function bigStudent(n) {
  const cards = Array.from({ length: n }, (_, i) => mk(`big-${String(Math.floor(i / 40)).padStart(2, '0')}`, (i % 40) + 1));
  const first = schedule(null, 3, T0 - 3 * DAY);
  const states = cards.map((c) => ({
    user_id: 'u1', card_id: c.id, subject: c.subject, chapter_key: c.chapterKey, schedule: first.schedule, reps: 1, lapses: 0,
    due_at: new Date(T0 - DAY).toISOString(), last_review_at: new Date(T0 - 3 * DAY).toISOString(), last_rating: 3,
    added_from: 'chapter', added_at: new Date(T0 - 4 * DAY).toISOString(), suspended: false,
  }));
  return { cards, states };
}

test('H1: 1,200 states are all counted, and a review of a card past the first 1,000 rows is applied, not lost', async () => {
  const { cards, states } = bigStudent(1200);
  const f = setup({ isPro: true, cards, tables: { key_card_states: states } });
  assert.equal(await f.kc.dueCount('u1'), 1200);
  assert.equal((await f.kc.due('u1', { limit: 50 })).body.today.due, 1200);
  // The first row inserted is the one an unordered 1,000-row read leaves out.
  const body = { cardId: cards[0].id, rating: 3, mode: 'revise', clientReviewedAt: new Date(T0 - 60_000).toISOString() };
  const out = await f.kc.review('u1', body);
  assert.equal(out.http, 200);
  assert.equal(out.body.replay, undefined);
  assert.equal(f.db.tables.key_card_states.filter((s) => s.card_id === cards[0].id).length, 1, 'no second state row');
  assert.equal(f.db.tables.key_card_states.find((s) => s.card_id === cards[0].id).reps, 2);
  assert.equal(out.body.today.due, 1199);
  const again = await f.kc.review('u1', body);
  assert.equal(again.body.replay, true);
  assert.equal(f.db.tables.key_card_states.find((s) => s.card_id === cards[0].id).reps, 2);
  assert.equal(f.db.tables.key_card_reviews.length, 1);
});

test('M4: a rating reads one state row with its schedule; today and the counts read slim columns, paged', async () => {
  const { cards, states } = bigStudent(1200);
  const f = setup({ isPro: true, cards, tables: { key_card_states: states } });
  f.db.log.length = 0;
  await f.kc.review('u1', { cardId: cards[5].id, rating: 4, mode: 'study' });
  await f.kc.dueCount('u1');
  await f.kc.due('u1');
  const reads = f.db.log.filter((l) => l.table === 'key_card_states' && l.op === 'select');
  const withSchedule = reads.filter((l) => /schedule/.test(l.cols));
  assert.ok(withSchedule.length >= 1);
  assert.ok(withSchedule.every((l) => l.eqs.card_id === cards[5].id), 'only the rated card is read with its schedule');
  const lists = reads.filter((l) => l.eqs.card_id === undefined);
  assert.ok(lists.length >= 6, 'three list reads of two pages each');
  assert.ok(lists.every((l) => l.range && l.range[1] - l.range[0] === 999), 'every list read is a page of 1,000');
});

test('H2: a review older than the card\'s last one is logged, answered ok and moves nothing; no allowance is used', async () => {
  const f = setup();
  await f.kc.add('u1', { chapter: 'business_studies.staffing' });
  const id = STAFFING[0].id;
  const first = await f.kc.review('u1', { cardId: id, rating: 3, mode: 'revise', clientReviewedAt: new Date(T0 - 3600_000).toISOString() });
  assert.equal(first.http, 200);
  const after = { ...f.db.tables.key_card_states.find((s) => s.card_id === id) };
  // An earlier UTC day: ts-fsrs threw "Invalid delta_t" here after both allowances were claimed (503 forever).
  const older = { cardId: id, rating: 1, mode: 'revise', clientReviewedAt: new Date(T0 - 30 * 3600_000).toISOString() };
  const late = await f.kc.review('u1', older);
  assert.equal(late.http, 200);
  assert.equal(late.body.late, true);
  assert.equal(late.body.next.due_at, after.due_at);
  // The same UTC day, earlier: last_review_at and due_at moved backwards here.
  const sameDay = await f.kc.review('u1', { ...older, clientReviewedAt: new Date(T0 - 2 * 3600_000).toISOString() });
  assert.equal(sameDay.body.late, true);
  assert.deepEqual(f.db.tables.key_card_states.find((s) => s.card_id === id), after, 'the schedule is as it was');
  assert.equal(f.db.tables.learning_allowances.filter((r) => r.kind === 'keycard_review').length, 1, 'only the applied review used a Free slot');
  assert.equal(f.db.tables.key_card_reviews.length, 3, 'both late reviews are logged');
  assert.equal((await f.kc.review('u1', older)).body.replay, true, 'and a late one sent again is a replay');
  assert.equal(f.db.tables.key_card_reviews.length, 3);
  assert.equal(late.body.today.reviewsLeft, 9);
});

test('the Free rules match the spec constants', () => {
  assert.deepEqual(KEYCARD_RULES.free, { tastePerChapter: 5, reviewsPerDay: 10, newPerDay: 5, lineNeededPerDay: 3 });
  assert.equal(KEYCARD_RULES.overduePauseNew, 40);
  assert.equal(KEYCARD_RULES.examHorizon, '2027-05-15');
});
