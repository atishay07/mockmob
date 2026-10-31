// The Key cards migration (supabase/migrations/20261031140000_key_cards.sql) and its undo, applied to an in-process Postgres
// (PGlite). Pins the one-transaction rating of the code review (CODE-REVIEW-2026-10-31.md M1, M2, L1): the replay check on
// client_key, the review row, the state move guarded by the expected reps and the Free allowance claims either all happen
// or none does. No network, no production.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const file = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const MIGRATION = file('supabase/migrations/20261031140000_key_cards.sql');
const UNDO = file('supabase/undo/20261031140000_key_cards.undo.sql');
const SIG = 'text, text, int, int, text, text, timestamptz, timestamptz, boolean, int, jsonb, real, real, text, int, int, text';

async function freshDb() {
  const db = new PGlite();
  // The existing tables the migration leans on, in their production shape (20261002120000_connected_learning.sql).
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.users (id text primary key);
    create table public.learning_allowances (
      user_id text not null references public.users(id), kind text not null, period text not null,
      reference text not null, created_at timestamptz not null default now(), primary key (user_id, kind, period));
    insert into public.users values ('u1'), ('u2');
  `);
  await db.exec(MIGRATION);
  return db;
}

const rows = async (db, sql, params) => (await db.query(sql, params)).rows;
const STATE = { schedule: { due: '2026-11-03T12:00:00.000Z', stability: 3.1, reps: 1 }, reps: 1, lapses: 0, due_at: '2026-11-03T12:00:00.000Z', last_review_at: '2026-11-02T12:00:00.000Z' };

/** One call of key_card_review with sensible defaults (a Free student's first rating of card c1, key k1). */
async function rate(db, over = {}) {
  const a = {
    user: 'u1', card: 'c1', v: 1, rating: 3, mode: 'revise', key: 'k1', clientAt: '2026-11-02T12:00:00Z', at: '2026-11-02T12:00:05Z',
    move: true, expected: null, state: { ...STATE, subject: 'business_studies', chapter_key: 'business_studies.planning', added_from: 'manual', added_at: '2026-11-02T12:00:05Z' },
    scheduled: 1, elapsed: 0, day: '2026-11-02', reviewLimit: 10, newLimit: 5, reference: 'c1@k1', ...over,
  };
  const out = await rows(db, `select public.key_card_review($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) as r`, [
    a.user, a.card, a.v, a.rating, a.mode, a.key, a.clientAt, a.at, a.move, a.expected, a.state === null ? null : JSON.stringify(a.state),
    a.scheduled, a.elapsed, a.day, a.reviewLimit, a.newLimit, a.reference,
  ]);
  return out[0].r.status;
}
const count = async (db, table, where = 'true') => Number((await rows(db, `select count(*)::int as n from public.${table} where ${where}`))[0].n);

test('the migration applies twice; the function is SECURITY DEFINER with search_path set and only the service role may run it', async () => {
  const db = await freshDb();
  await db.exec(MIGRATION);
  const [fn] = await rows(db, `select prosecdef, proconfig from pg_proc where proname = 'key_card_review'`);
  assert.equal(fn.prosecdef, true);
  assert.deepEqual(fn.proconfig, ['search_path=""']);
  for (const [role, can] of [['service_role', true], ['anon', false], ['authenticated', false]]) {
    const [r] = await rows(db, `select has_function_privilege($1, 'public.key_card_review(${SIG})', 'execute') as ok`, [role]);
    assert.equal(r.ok, can, role);
  }
  const cols = (await rows(db, `select column_name from information_schema.columns where table_name = 'key_card_reviews'`)).map((r) => r.column_name);
  assert.ok(cols.includes('client_key') && cols.includes('client_reviewed_at'));
  await db.close();
});

test('a first rating writes the review, the state and both Free claims; the same client_key again is a replay that changes nothing', async () => {
  const db = await freshDb();
  assert.equal(await rate(db), 'ok');
  const [state] = await rows(db, `select reps, last_rating, added_from, subject, chapter_key, schedule->>'stability' as stability from public.key_card_states`);
  assert.deepEqual(state, { reps: 1, last_rating: 3, added_from: 'manual', subject: 'business_studies', chapter_key: 'business_studies.planning', stability: '3.1' });
  const [review] = await rows(db, `select client_key, client_reviewed_at is not null as clamped, scheduled_days from public.key_card_reviews`);
  assert.deepEqual(review, { client_key: 'k1', clamped: true, scheduled_days: 1 });
  assert.deepEqual((await rows(db, `select kind, period from public.learning_allowances order by kind`)).map((r) => `${r.kind} ${r.period}`), ['keycard_new 2026-11-02:1', 'keycard_review 2026-11-02:1']);
  // The outbox sends it again (its clamped time has moved since, the raw key has not).
  assert.equal(await rate(db, { clientAt: '2026-11-02T12:30:00Z', expected: 1 }), 'replay');
  assert.equal(await count(db, 'key_card_reviews'), 1);
  assert.equal(await count(db, 'learning_allowances'), 2);
  assert.equal(Number((await rows(db, `select reps from public.key_card_states`))[0].reps), 1);
  await db.close();
});

test('a conflicting rating (the state moved on) changes nothing: no review row and no Free slot (M1, L1)', async () => {
  const db = await freshDb();
  assert.equal(await rate(db), 'ok');
  // Another device read reps 0 before the first rating landed.
  assert.equal(await rate(db, { key: 'k2', expected: 0 }), 'conflict');
  // And a first rating sent while a row already exists.
  assert.equal(await rate(db, { key: 'k3', expected: null }), 'conflict');
  assert.equal(await count(db, 'key_card_reviews'), 1);
  assert.equal(await count(db, 'learning_allowances', `kind = 'keycard_review'`), 1);
  // With the right reps it moves, and the second rating claims no new-card slot.
  assert.equal(await rate(db, { key: 'k4', expected: 1, state: { ...STATE, reps: 2 } }), 'ok');
  assert.equal(Number((await rows(db, `select reps from public.key_card_states`))[0].reps), 2);
  assert.equal(await count(db, 'learning_allowances', `kind = 'keycard_new'`), 1);
  await db.close();
});

test('Free limits: the eleventh review and the sixth new card are refused with nothing written; Pro claims no review slot', async () => {
  const db = await freshDb();
  for (let i = 1; i <= 5; i += 1) assert.equal(await rate(db, { card: `c${i}`, key: `k${i}` }), 'ok');
  assert.equal(await rate(db, { card: 'c6', key: 'k6' }), 'keycard_new');
  assert.equal(await count(db, 'key_card_states', `card_id = 'c6'`), 0);
  assert.equal(await count(db, 'key_card_reviews', `card_id = 'c6'`), 0);
  for (let i = 1; i <= 5; i += 1) assert.equal(await rate(db, { card: `c${i}`, key: `r${i}`, expected: 1, state: { ...STATE, reps: 2 } }), 'ok');
  assert.equal(await rate(db, { card: 'c1', key: 'r6', expected: 2, state: { ...STATE, reps: 3 } }), 'keycard_reviews');
  assert.equal(await count(db, 'learning_allowances', `kind = 'keycard_review'`), 10);
  assert.equal(await count(db, 'key_card_reviews'), 10);
  // The next day has its own slots.
  assert.equal(await rate(db, { card: 'c1', key: 'r7', expected: 2, state: { ...STATE, reps: 3 }, day: '2026-11-03' }), 'ok');
  // Pro: no review limit, the new-card count only.
  assert.equal(await rate(db, { user: 'u2', card: 'c9', key: 'p1', reviewLimit: null, newLimit: 100000 }), 'ok');
  assert.equal(await count(db, 'learning_allowances', `user_id = 'u2' and kind = 'keycard_review'`), 0);
  await db.close();
});

test('a last look or a late review is logged only; a suspended card is refused; a rating with no client key is never a replay', async () => {
  const db = await freshDb();
  assert.equal(await rate(db), 'ok');
  assert.equal(await rate(db, { key: 'look', mode: 'last_look', move: false, expected: 1, state: null }), 'logged');
  assert.equal(await rate(db, { key: 'look', mode: 'last_look', move: false, expected: 1, state: null }), 'replay');
  assert.equal(Number((await rows(db, `select reps from public.key_card_states`))[0].reps), 1);
  assert.equal(await count(db, 'learning_allowances'), 2, 'a logged review uses no allowance');
  assert.equal(await count(db, 'key_card_reviews', `client_key = 'look' and scheduled_days is null`), 1);
  await db.exec(`update public.key_card_states set suspended = true`);
  assert.equal(await rate(db, { key: 'k9', expected: 1, state: { ...STATE, reps: 2 } }), 'suspended');
  await db.exec(`update public.key_card_states set suspended = false`);
  assert.equal(await rate(db, { key: null, expected: 1, state: { ...STATE, reps: 2 } }), 'ok');
  assert.equal(await rate(db, { key: null, expected: 2, state: { ...STATE, reps: 3 } }), 'ok');
  assert.equal(await count(db, 'key_card_reviews', 'client_key is null'), 2);
  await db.close();
});

test('duplicate replays racing: whichever lands second is a replay (the unique index decides; simulated in order)', async () => {
  const db = await freshDb();
  // Both requests read "no state" before either wrote; the second insert waits on the first's index entry and then
  // finds the key taken, so it is a replay and claims nothing (PGlite runs one connection, so this is the post-wait order).
  const [a, b] = [await rate(db), await rate(db)];
  assert.deepEqual([a, b], ['ok', 'replay']);
  assert.equal(await count(db, 'key_card_reviews'), 1);
  assert.equal(await count(db, 'learning_allowances'), 2);
  await db.close();
});

test('the undo removes the function and the tables, and the migration applies again after it', async () => {
  const db = await freshDb();
  await rate(db);
  await db.exec(UNDO);
  assert.equal((await rows(db, `select count(*)::int as n from pg_proc where proname = 'key_card_review'`))[0].n, 0);
  assert.equal((await rows(db, `select count(*)::int as n from information_schema.tables where table_name like 'key_card%' or table_name = 'student_subject_options'`))[0].n, 0);
  assert.equal(await count(db, 'learning_allowances'), 2, 'the allowances table is not the migration\'s and stays');
  await db.exec(MIGRATION);
  assert.equal(await rate(db), 'ok');
  await db.close();
});

test('the view key_card_suspended returns only cards with 3 or more reports, at the server\'s threshold, for the service role only', async () => {
  const { REPORT_SUSPEND_AT } = await import('../../src/lib/server/keycards.js');
  assert.ok(MIGRATION.includes(`having count(*) >= ${REPORT_SUSPEND_AT};`), 'the view and REPORT_SUSPEND_AT agree');
  const db = await freshDb();
  await db.exec(`insert into public.key_card_reports (user_id, card_id, reason) values
    ('a', 'c1', 'x'), ('b', 'c1', 'x'), ('c', 'c1', 'x'), ('a', 'c2', 'x'), ('b', 'c2', 'x'), ('a', 'c3', 'x')`);
  assert.deepEqual(await rows(db, `select card_id, reports from public.key_card_suspended order by card_id`), [{ card_id: 'c1', reports: 3 }]);
  for (const [role, can] of [['service_role', true], ['anon', false], ['authenticated', false]]) {
    const [r] = await rows(db, `select has_table_privilege($1, 'public.key_card_suspended', 'select') as ok`, [role]);
    assert.equal(r.ok, can, role);
  }
  await db.close();
});
