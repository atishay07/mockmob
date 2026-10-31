// Key cards route handlers (src/lib/server/keycards.js, KEYCARDS-BUILD-SPEC.md 2e) against a fake database that enforces the
// migration's keys (supabase/migrations/20261031140000_key_cards.sql), so races and replays behave as in Postgres.
// Covers: Free and Pro views, the 402 paths, the Free allowances, idempotent replays, last look, reports, options, chapters.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createKeycards } from '../../src/lib/server/keycards.js';
import { fakeDb } from '../../src/lib/server/keycardsMemoryDb.js';
import { syllabusFrom } from '../../src/lib/server/keycardsSyllabus.js';
import { KEYCARD_RULES, schedule } from '../keycards.js';
import * as cuetSyllabus from '../cuet_syllabus.js';

const DAY = 86_400_000;
const T0 = Date.parse('2026-11-02T18:00:00+05:30');

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
  bySubject: new Map([...new Set(cards.map((c) => c.subject))].map((subject) => [subject, { version: 1, cards: cards.filter((c) => c.subject === subject) }])),
  byId: new Map(cards.map((c) => [c.id, c])),
  links: new Map([['business_studies', { 'q-linked': [PLANNING[0].id] }]]),
  disabled: [],
});

function setup({ isPro = false, tables = {}, clock = { t: T0 }, subjects = ['business_studies', 'economics', 'not_a_subject'], cards = CARDS, syllabus = syllabusFrom(null) } = {}) {
  const db = fakeDb(tables);
  const kc = createKeycards({
    db, decks: decks(cards), syllabus, now: () => clock.t,
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
  const ids = PLANNING.slice(0, 5).map((c) => c.id); // five new cards: Free's new-card limit (L2) is not what stops it
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

test('M2: the replay key is the raw client time, so a future clock or a time over 48 h old replays once, not twice', async () => {
  for (const sent of [T0 + DAY, T0 - 5 * DAY]) {
    const f = setup();
    await f.kc.add('u1', { chapter: 'business_studies.staffing' });
    const body = { cardId: STAFFING[0].id, rating: 3, mode: 'revise', clientReviewedAt: new Date(sent).toISOString() };
    assert.equal((await f.kc.review('u1', body)).http, 200);
    // The clamp moves with server time: before, the second send had another clamped time and counted again.
    f.clock.t = T0 + 3600_000;
    const again = await f.kc.review('u1', body);
    assert.equal(again.body.replay, true);
    assert.equal(f.db.tables.key_card_states.find((s) => s.card_id === STAFFING[0].id).reps, 1);
    assert.equal(f.db.tables.learning_allowances.filter((r) => r.kind === 'keycard_review').length, 1);
    assert.equal(f.db.tables.key_card_reviews.length, 1);
    assert.equal(f.db.tables.key_card_reviews[0].client_key, body.clientReviewedAt, 'the raw value is the key');
    assert.equal(f.db.tables.key_card_reviews[0].client_reviewed_at, new Date(Math.min(T0, Math.max(T0 - 2 * DAY, sent))).toISOString(), 'the clamped time is kept for scheduling');
  }
});

test('M1, L1: duplicate replays racing write once; a conflicting rating writes and claims nothing, and its retry is applied', async () => {
  const f = setup();
  await f.kc.add('u1', { chapter: 'business_studies.staffing' });
  const body = { cardId: STAFFING[0].id, rating: 3, mode: 'revise', clientReviewedAt: new Date(T0 - 600_000).toISOString() };
  // The outbox sends the same review twice at once: both read the state before either writes.
  const [a, b] = await Promise.all([f.kc.review('u1', body), f.kc.review('u1', body)]);
  assert.deepEqual([a.http, b.http], [200, 200]);
  assert.deepEqual([Boolean(a.body.replay), Boolean(b.body.replay)].sort(), [false, true]);
  assert.equal(f.db.tables.key_card_reviews.length, 1);
  assert.equal(f.db.tables.learning_allowances.filter((r) => r.kind === 'keycard_review').length, 1);
  // Two devices rate another card at once: one lands, the other finds the state moved and changes nothing.
  const one = { cardId: STAFFING[1].id, rating: 3, mode: 'revise', clientReviewedAt: new Date(T0 - 500_000).toISOString() };
  const two = { ...one, rating: 4, clientReviewedAt: new Date(T0 - 400_000).toISOString() };
  const [x, y] = await Promise.all([f.kc.review('u1', one), f.kc.review('u1', two)]);
  assert.deepEqual([x.http, y.http], [200, 409]);
  assert.equal(y.body.error, 'REVIEW_CONFLICT');
  assert.equal(f.db.tables.key_card_reviews.filter((r) => r.card_id === STAFFING[1].id).length, 1, 'no review row for the conflict');
  assert.equal(f.db.tables.learning_allowances.filter((r) => r.kind === 'keycard_review').length, 2, 'and no Free slot (L1)');
  // Its retry is applied against the moved state, not acknowledged as a replay (the lost-update path of M1).
  const retry = await f.kc.review('u1', two);
  assert.equal(retry.http, 200);
  assert.equal(retry.body.replay, undefined);
  assert.equal(f.db.tables.key_card_states.find((s) => s.card_id === STAFFING[1].id).reps, 2);
});

test('H3: a Pro student who lapses to Free gets only the taste cards in the queue and every count, and can play all of it', async () => {
  const plan = { pro: true };
  const f = setup({ isPro: () => plan.pro });
  await f.kc.add('u1', { chapter: 'business_studies.planning' }); // Pro: the 6 Must-know cards
  for (const c of PLANNING.slice(0, 6)) assert.equal((await f.kc.review('u1', { cardId: c.id, rating: 1, mode: 'study' })).http, 200);
  plan.pro = false;
  f.clock.t = T0 + 2 * DAY;
  const due = await f.kc.due('u1', { limit: 20 });
  const taste = PLANNING.slice(0, 5).map((c) => c.id);
  assert.deepEqual(due.body.cards.map((c) => c.id).sort(), [...taste].sort(), 'the sixth Must-know card (Pro only) is not offered');
  assert.equal(due.body.today.due, 5);
  assert.equal(await f.kc.dueCount('u1'), 5);
  const planning = (await f.kc.overview('u1')).body.subjects[0].units.flatMap((u) => u.chapters).find((c) => c.key === 'business_studies.planning');
  assert.equal(planning.due, 5);
  assert.equal((await f.kc.reviseSource('u1')).items.length, 5);
  // Everything offered can be played: before, the player hit 402 keycards with 0 used.
  for (const c of due.body.cards) assert.equal((await f.kc.review('u1', { cardId: c.id, rating: 3, mode: 'revise' })).http, 200, c.id);
  assert.equal((await f.kc.review('u1', { cardId: PLANNING[5].id, rating: 3, mode: 'revise' })).body.reason, 'keycards');
  plan.pro = true;
  assert.equal(await f.kc.dueCount('u1'), 1, 'Pro again: the sixth card is back');
});

test('L4: switching the Accountancy part from AFS to CAS takes the AFS cards out of the queue and the counts', async () => {
  const acc = (slug, i) => mk(slug, i, { id: `kc.accountancy.${slug}.def-c${i}`, subject: 'accountancy', chapterKey: `accountancy.${slug}`, importance: 'must' });
  const cards = [...[1, 2].map((i) => acc('accounting-ratios', i)), ...[1, 2].map((i) => acc('computerized-accounting-system', i)), ...[1, 2].map((i) => acc('share-capital', i))];
  const f = setup({ isPro: true, cards, subjects: ['accountancy'], syllabus: syllabusFrom(cuetSyllabus) });
  await f.kc.add('u1', { cardIds: cards.map((c) => c.id) });
  for (const c of cards) await f.kc.review('u1', { cardId: c.id, rating: 1, mode: 'study' });
  f.clock.t = T0 + 2 * DAY;
  assert.equal(await f.kc.dueCount('u1'), 6, 'no part saved: every section');
  await f.kc.putOption('u1', { subject: 'accountancy', option: 'CAS' });
  const cas = (await f.kc.due('u1')).body.cards.map((c) => c.chapterKey);
  assert.deepEqual([...new Set(cas)].sort(), ['accountancy.computerized-accounting-system', 'accountancy.share-capital']);
  assert.equal(await f.kc.dueCount('u1'), 4);
  await f.kc.putOption('u1', { subject: 'accountancy', option: 'AFS' });
  assert.deepEqual([...new Set((await f.kc.due('u1')).body.cards.map((c) => c.chapterKey))].sort(), ['accountancy.accounting-ratios', 'accountancy.share-capital']);
});

test('L7: new cards come chapter by chapter in syllabus order, then in book order within the chapter', async () => {
  const f = setup({ isPro: true });
  await f.kc.add('u1', { chapter: 'business_studies.staffing' });
  await f.kc.add('u1', { chapter: 'business_studies.planning' });
  const ids = (await f.kc.due('u1', { limit: 20 })).body.cards.map((c) => c.id);
  // Card order restarts at 10 in each chapter: sorting by it alone gave planning 1, staffing 1, planning 2, ...
  assert.deepEqual(ids, [...PLANNING.slice(0, 6), ...STAFFING].map((c) => c.id));
});

test('M5: chapter state reads every answer past 1,000 rows, and a failed read is "unknown", never "Not started"', async () => {
  const progress = Array.from({ length: 1200 }, (_, i) => ({ user_id: 'u1', question_id: `p${String(i).padStart(4, '0')}`, subject: 'business_studies', chapter: 'Staffing', attempt_count: 1, last_correct: i % 2 === 0, last_attempted_at: new Date(T0 - DAY).toISOString() }));
  const f = setup({ isPro: true, tables: { user_question_progress: progress } });
  const staffing = (out) => out.body.units.flatMap((u) => u.chapters).find((c) => c.key === 'business_studies.staffing');
  const all = staffing(await f.kc.chapters('u1', 'business_studies'));
  assert.equal(all.n, 1200);
  assert.equal(all.right, 600);
  // The second page fails: the first 1,000 rows must not pass for the whole history.
  f.db.failures.user_question_progress = (qy) => qy.from === 1000;
  const partial = await f.kc.chapters('u1', 'business_studies');
  assert.equal(partial.http, 200);
  for (const c of partial.body.units.flatMap((u) => u.chapters)) assert.deepEqual([c.state, c.label, c.n, c.reason], ['unknown', 'Could not load', null, null], c.key);
  f.db.failures.user_question_progress = () => true;
  const home = (await f.kc.overview('u1')).body.subjects[0].units.flatMap((u) => u.chapters);
  assert.ok(home.every((c) => c.state.state === 'unknown' && c.state.label === 'Could not load'), 'the home rows too');
});

test("L2: Free's 5 new cards a day hold on direct reviews too: the sixth is 402 keycard_new and writes nothing", async () => {
  const f = setup();
  await f.kc.add('u1', { chapter: 'business_studies.planning' });
  await f.kc.add('u1', { chapter: 'business_studies.staffing' });
  const fresh = [...PLANNING.slice(0, 5), ...STAFFING].map((c) => c.id);
  for (const id of fresh.slice(0, 5)) assert.equal((await f.kc.review('u1', { cardId: id, rating: 3, mode: 'study' })).http, 200);
  const sixth = await f.kc.review('u1', { cardId: fresh[5], rating: 3, mode: 'study' });
  assert.deepEqual(sixth, { http: 402, body: { error: 'PRO_REQUIRED', reason: 'keycard_new' } });
  assert.equal(f.db.tables.key_card_reviews.filter((r) => r.card_id === fresh[5]).length, 0);
  assert.equal(f.db.tables.learning_allowances.filter((r) => r.kind === 'keycard_review').length, 5, 'and no review slot');
  assert.equal(f.db.tables.key_card_states.find((s) => s.card_id === fresh[5]).reps, 0);
  // A card already reviewed is not new: it still plays.
  f.clock.t = T0 + DAY;
  assert.equal((await f.kc.review('u1', { cardId: fresh[0], rating: 3, mode: 'study' })).http, 200);
  assert.equal((await f.kc.review('u1', { cardId: fresh[5], rating: 3, mode: 'study' })).http, 200, 'the next day has new slots');
  // Pro is never stopped by it.
  const p = setup({ isPro: true });
  await p.kc.add('u1', { chapter: 'business_studies.planning' });
  await p.kc.add('u1', { chapter: 'business_studies.staffing' });
  for (const c of [...PLANNING.slice(0, 6), ...STAFFING]) assert.equal((await p.kc.review('u1', { cardId: c.id, rating: 3, mode: 'study' })).http, 200);
});

test("L3: an offline review from yesterday that syncs after midnight uses yesterday's allowance, not today's", async () => {
  const f = setup({ clock: { t: Date.parse('2026-11-03T00:30:00+05:30') } });
  await f.kc.add('u1', { chapter: 'business_studies.staffing' });
  const out = await f.kc.review('u1', { cardId: STAFFING[0].id, rating: 3, mode: 'revise', clientReviewedAt: '2026-11-02T23:10:00+05:30' });
  assert.equal(out.http, 200);
  assert.deepEqual(f.db.tables.learning_allowances.map((r) => r.period).sort(), ['2026-11-02:1', '2026-11-02:1']);
  assert.equal(out.body.today.reviewsLeft, 10, 'today (3 Nov) is untouched');
  assert.equal(out.body.today.newLeft, 5);
});

test('L5: the lexical match needs 3 shared content words, so a one-word English quote never matches on one word', async () => {
  const word = (slug, quote) => ({ id: `kc.english.vocabulary.word-${slug}`, v: 1, subject: 'english', chapterKey: 'english.vocabulary', kind: 'word', importance: 'must', quote, front: slug, back: quote, order: 10 });
  const cards = new Map([word('abundant', 'Abundant'), word('scarce', 'Scarce, rare'), word('long', 'Present in great quantity; more than enough')].map((c) => [c.id, c]));
  const { lineNeeded: ln } = await import('../keycards.js');
  const text = 'Choose the word most similar in meaning to ABUNDANT. The options: plentiful, rare, scarce, empty.';
  assert.deepEqual(ln('q1', {}, cards, { chapterKey: 'english.vocabulary', text }), { cards: [], source: 'none' }, 'before: Abundant and "Scarce, rare" matched at a share of 1');
  const longer = ln('q2', {}, cards, { chapterKey: 'english.vocabulary', text: 'Which word means present in great quantity, more than enough?' });
  assert.equal(longer.source, 'matched');
  assert.deepEqual(longer.cards.map((c) => c.id), ['kc.english.vocabulary.word-long']);
});

test('L8: suspension reads only the cards with 3 or more reports, so one past the first 1,000 report rows is still suspended', async () => {
  const id = PLANNING[0].id;
  // The three reports of the suspended card come first; then 1,200 single reports of other cards.
  const reports = [...['a', 'b', 'c'].map((u) => ({ user_id: u, card_id: id, reason: 'Wrong page', created_at: new Date(T0).toISOString() })),
    ...Array.from({ length: 1200 }, (_, i) => ({ user_id: `r${i}`, card_id: `kc.other.card-${i}`, reason: 'x', created_at: new Date(T0).toISOString() }))];
  const f = setup({ isPro: true, tables: { key_card_reports: reports } });
  const deck = await f.kc.deck('u9', 'business_studies.planning');
  assert.equal(deck.body.cards.some((c) => c.id === id), false);
  assert.ok(f.db.log.some((l) => l.table === 'key_card_suspended'));
  assert.equal(f.db.log.some((l) => l.table === 'key_card_reports' && l.op === 'select'), false, 'no report rows are read');
});

test('the Free rules match the spec constants', () => {
  assert.deepEqual(KEYCARD_RULES.free, { tastePerChapter: 5, reviewsPerDay: 10, newPerDay: 5, lineNeededPerDay: 3 });
  assert.equal(KEYCARD_RULES.overduePauseNew, 40);
  assert.equal(KEYCARD_RULES.examHorizon, '2027-05-15');
});
