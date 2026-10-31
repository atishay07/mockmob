// The Learn runs migration (supabase/migrations/20261101150000_learn_runs.sql) and its undo, applied to an in-process
// Postgres (PGlite), and the same behaviours run against the memory client's mirrors of both functions
// (src/lib/server/keycardsMemoryDb.js), so the preview and the unit tests keep the database's rules (BUILD-1101 2.1).
// Pins: idempotent apply, SECURITY DEFINER with an empty search_path, service_role only, RLS on with no policy; a start
// claims nothing and replays by request key; Free's one Learn session a day is claimed by the first answered question and
// a second run's answer is 'used' with nothing written; replays never count twice; the re-insert (once per card, never
// after a well-rated card, a move instead of a copy when the card is still ahead); the counters; flow_context 'learn';
// the undo; and account deletion's order. No network, no production.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { fakeDb } from '../../src/lib/server/keycardsMemoryDb.js';
import { DELETION_STEPS } from '../../src/lib/server/accountDeletion.js';

const file = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const MIGRATION = file('supabase/migrations/20261101150000_learn_runs.sql');
const UNDO = file('supabase/undo/20261101150000_learn_runs.undo.sql');
const START_SIG = 'jsonb, text[]';
const RECORD_SIG = 'text, text, text, jsonb, jsonb, jsonb, jsonb, text, jsonb';

// The existing tables the migration leans on, in their production shapes: users, questions (text ids),
// user_question_progress (0028), question_interactions (0010 with its inline check, plus 0007's named one, so the drop by
// definition is exercised on both), learning_allowances and learning_question_exposure (20261002120000).
const BASE = `
  create role anon; create role authenticated; create role service_role;
  create table public.users (id text primary key);
  create table public.questions (id text primary key);
  create table public.user_question_progress (
    user_id text not null references public.users(id) on delete cascade,
    question_id text not null references public.questions(id) on delete cascade,
    subject text, chapter text, seen_count integer not null default 0, attempt_count integer not null default 0,
    correct_count integer not null default 0, skip_count integer not null default 0, last_selected_key text, last_correct boolean,
    best_dwell_ms integer, last_seen_at timestamptz, last_attempted_at timestamptz, updated_at timestamptz not null default now(),
    primary key (user_id, question_id));
  create table public.question_interactions (
    id text primary key default gen_random_uuid()::text,
    question_id text not null references public.questions(id) on delete cascade,
    user_id text not null, interaction_type text not null, created_at timestamptz not null default now(), session_id text,
    flow_context text check (flow_context is null or flow_context in ('mock','review','explore','shadow')),
    dwell_ms integer, metadata jsonb not null default '{}');
  alter table public.question_interactions add constraint chk_qi_flow_context
    check (flow_context is null or flow_context in ('mock','review','explore','shadow'));
  create table public.learning_allowances (
    user_id text not null references public.users(id), kind text not null, period text not null,
    reference text not null, created_at timestamptz not null default now(), primary key (user_id, kind, period));
  create table public.learning_question_exposure (
    user_id text not null references public.users(id), question_id text not null,
    reference text not null, created_at timestamptz not null default now(), primary key (user_id, question_id));
  insert into public.users values ('u1'), ('u2');
  insert into public.questions values ('q1'), ('q2'), ('q3'), ('q4'), ('q5');
`;

async function pgDb() {
  const db = new PGlite();
  await db.exec(BASE);
  await db.exec(MIGRATION);
  return db;
}
const pgRows = async (db, sql, params) => (await db.query(sql, params)).rows;

// One interface over both backends: start(row, ids), record(args), rows(table), interact(row) -> { error }.
const SQL_ORDER = {
  learn_runs: 'id', learn_run_events: 'run_id, item_id', learning_allowances: 'user_id, kind, period',
  learning_question_exposure: 'user_id, question_id', user_question_progress: 'user_id, question_id', question_interactions: 'created_at, id',
};
function pgBackend(db) {
  return {
    name: 'pglite',
    async start(row, ids = []) {
      return (await pgRows(db, 'select public.learn_start_run($1::jsonb, $2::text[]) as r', [JSON.stringify(row), ids]))[0].r;
    },
    async record(a) {
      const j = (v) => (v == null ? null : JSON.stringify(v));
      const [r] = await pgRows(db, 'select public.learn_record_event($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9::jsonb) as r', [
        a.p_user, a.p_run, a.p_item, j(a.p_event), j(a.p_progress), j(a.p_interaction), j(a.p_reinsert), a.p_limit_line ?? null, j(a.p_quota),
      ]);
      return r.r;
    },
    rows: (table) => pgRows(db, `select * from public.${table} order by ${SQL_ORDER[table]}`),
    async interact(row) {
      try {
        await db.query('insert into public.question_interactions (question_id, user_id, interaction_type, flow_context) values ($1, $2, $3, $4)',
          [row.question_id, row.user_id, row.interaction_type, row.flow_context]);
        return { error: null };
      } catch (error) { return { error }; }
    },
    close: () => db.close(),
  };
}
function memBackend(fake) {
  const call = async (name, args) => {
    const res = await fake.rpc(name, args);
    if (res.error) throw Object.assign(new Error(res.error.message), res.error);
    return res.data;
  };
  return {
    name: 'memory',
    start: (row, ids = []) => call('learn_start_run', { p_row: row, p_question_ids: ids }),
    record: (a) => call('learn_record_event', a),
    rows: async (table) => (fake.tables[table] || []).map((r) => ({ ...r })),
    interact: async (row) => fake.from('question_interactions').insert(row),
    close: async () => {},
  };
}
const BACKENDS = [
  ['pglite', async () => pgBackend(await pgDb())],
  ['memory', async () => memBackend(fakeDb({}))],
];

const DAY = '2026-11-01';
const QUOTA = { kind: 'learn_session', day: DAY, limit: 1 };
const items = () => [
  { id: 'i1', type: 'card', cardId: 'c1', seconds: 18 },
  { id: 'i2', type: 'question', questionId: 'q1', seconds: 50 },
  { id: 'i3', type: 'card', cardId: 'c2', seconds: 18 },
  { id: 'i4', type: 'question', questionId: 'q2', seconds: 65 },
  { id: 'i5', type: 'card', cardId: 'c3', seconds: 18 },
  { id: 'i6', type: 'card', cardId: 'c4', seconds: 18 },
];
const SECONDS = 50 + 65 + 18 * 4;
const runRow = (over = {}) => ({
  id: 'lr_a', user_id: 'u1', request_key: 'key-aaaa-0001', kind: 'mix', subject: 'accountancy', chapter_key: 'accountancy.goodwill',
  asked_minutes: 10, minutes: 10, leave_out: [], items: items(), start_state: { key: 'none' }, ...over,
});
const answer = (over = {}) => {
  const { item = 'i2', question = 'q1', choice = 'B', correct = false, run = 'lr_a', user = 'u1', quota = null, reinsert = null } = over;
  return {
    p_user: user, p_run: run, p_item: item,
    p_event: { kind: 'answer', question_id: question, choice, correct, fixed: false, origin: 'chapter', seconds: 50, body: { correct, key: 'A' } },
    p_progress: { question_id: question, subject: 'accountancy', chapter: 'Goodwill', selected_key: choice, correct },
    p_interaction: { question_id: question, metadata: { selected_key: choice, is_correct: correct, item_id: item, run_kind: 'mix' } },
    p_reinsert: reinsert, p_limit_line: null, p_quota: quota,
  };
};
const rate = (over = {}) => {
  const { item = 'i1', card = 'c1', rating = 3, run = 'lr_a', user = 'u1', limitLine = null } = over;
  return {
    p_user: user, p_run: run, p_item: item,
    p_event: { kind: 'rate', card_id: card, rating, due_at: '2026-11-03T12:00:00.000Z', seconds: 18, body: { saved: true, stamp: 'Back Tue' } },
    p_progress: null, p_interaction: null, p_reinsert: null, p_limit_line: limitLine, p_quota: null,
  };
};
const copy = (card, over = {}) => ({ card_id: card, gap: 3, seconds: 18, unless_rated_well: true, item: { type: 'card', cardId: card, stage: 'again', reason: 'line', seconds: 18 }, ...over });
const runOf = async (b, id = 'lr_a') => (await b.rows('learn_runs')).find((r) => r.id === id);
const ids = (run) => run.items.map((x) => x.id);

// ---------------------------------------------------------------- PGlite only: the file itself

test('pglite: the migration applies twice; both functions are SECURITY DEFINER with an empty search_path, service_role only; RLS on, no policy', async () => {
  const db = await pgDb();
  await db.exec(MIGRATION);
  for (const [name, sig] of [['learn_start_run', START_SIG], ['learn_record_event', RECORD_SIG]]) {
    const fns = await pgRows(db, 'select prosecdef, proconfig from pg_proc where proname = $1', [name]);
    assert.equal(fns.length, 1, `${name}: one signature only`);
    assert.equal(fns[0].prosecdef, true, name);
    assert.deepEqual(fns[0].proconfig, ['search_path=""'], name);
    for (const [role, can] of [['service_role', true], ['anon', false], ['authenticated', false]]) {
      const [r] = await pgRows(db, `select has_function_privilege($1, 'public.${name}(${sig})', 'execute') as ok`, [role]);
      assert.equal(r.ok, can, `${name} ${role}`);
    }
  }
  for (const table of ['learn_runs', 'learn_run_events']) {
    const [c] = await pgRows(db, `select relrowsecurity from pg_class where oid = $1::regclass`, [`public.${table}`]);
    assert.equal(c.relrowsecurity, true, `${table} RLS`);
    assert.equal((await pgRows(db, 'select count(*)::int as n from pg_policies where tablename = $1', [table]))[0].n, 0, `${table} has no policy`);
    for (const [role, can] of [['service_role', true], ['anon', false], ['authenticated', false]]) {
      const [r] = await pgRows(db, `select has_table_privilege($1, $2, 'select') as ok`, [role, `public.${table}`]);
      assert.equal(r.ok, can, `${table} ${role}`);
    }
  }
  // One flow_context check is left (both old names were dropped by definition), validated, with 'learn'.
  const checks = await pgRows(db, `select conname, convalidated, pg_get_constraintdef(oid) as def from pg_constraint
    where conrelid = 'public.question_interactions'::regclass and contype = 'c'`);
  assert.deepEqual(checks.map((c) => c.conname), ['question_interactions_flow_context_check']);
  assert.equal(checks[0].convalidated, true);
  assert.match(checks[0].def, /'learn'/);
  assert.match(MIGRATION, /SAVED ONLY, never applied by an agent/);
  await db.close();
});

test('pglite: the undo leaves no learn_* object, keeps the rows written elsewhere, refuses a new \'learn\' interaction; the migration applies again', async () => {
  const db = await pgDb();
  const b = pgBackend(db);
  await b.start(runRow(), ['q1']);
  await b.record(answer());
  await db.exec(UNDO);
  const left = await pgRows(db, `select relname from pg_class where relname like 'learn\\_%'
    union all select proname from pg_proc where proname like 'learn\\_%'`);
  assert.deepEqual(left, []);
  assert.equal((await b.rows('question_interactions')).filter((r) => r.flow_context === 'learn').length, 1, 'history stays');
  assert.equal((await b.rows('user_question_progress')).length, 1);
  assert.equal((await b.rows('learning_question_exposure')).length, 1);
  assert.ok((await b.interact({ question_id: 'q2', user_id: 'u1', interaction_type: 'attempted', flow_context: 'learn' })).error, 'learn refused after the undo');
  assert.equal((await b.interact({ question_id: 'q2', user_id: 'u1', interaction_type: 'attempted', flow_context: 'explore' })).error, null);
  await db.exec(MIGRATION);
  assert.equal((await b.start(runRow({ id: 'lr_z', request_key: 'key-zzzz-0001' }))).status, 'ok');
  await db.close();
});

test('account deletion lists learn_run_events before learn_runs, and every table this migration creates', () => {
  const tables = DELETION_STEPS.map((s) => s.table);
  const created = [...MIGRATION.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]);
  assert.deepEqual(created, ['learn_runs', 'learn_run_events']);
  for (const t of created) {
    const step = DELETION_STEPS.find((s) => s.table === t);
    assert.ok(step, `${t} is in DELETION_STEPS`);
    assert.equal(step.action, 'delete', t);
  }
  assert.ok(tables.indexOf('learn_run_events') < tables.indexOf('learn_runs'), 'children first');
});

// ---------------------------------------------------------------- both backends: the same rules

for (const [name, make] of BACKENDS) {
  test(`${name}: a start inserts the run and its exposure rows, claims nothing, replays by request key and refuses a reused key`, async () => {
    const b = await make();
    assert.deepEqual(await b.start(runRow(), ['q1', 'q2', 'q1']), { status: 'ok', id: 'lr_a' });
    const run = await runOf(b);
    assert.equal(run.item_count, 6);
    assert.equal(run.done_count, 0);
    assert.equal(run.seconds_left, SECONDS, 'the sum of the items\' seconds');
    assert.equal(run.session_claimed, false);
    assert.equal(run.chapter_key, 'accountancy.goodwill');
    assert.deepEqual(run.leave_out, []);
    assert.equal((await b.rows('learning_allowances')).length, 0, 'a start claims nothing');
    assert.deepEqual((await b.rows('learning_question_exposure')).map((r) => `${r.question_id}@${r.reference}`).sort(), ['q1@lr_a', 'q2@lr_a']);
    // A retried start (same key, a fresh id from the retry): the same run.
    assert.deepEqual(await b.start(runRow({ id: 'lr_b' }), ['q3']), { status: 'replay', id: 'lr_a' });
    // The same key for another chapter or kind is a client bug.
    assert.deepEqual(await b.start(runRow({ id: 'lr_c', chapter_key: 'accountancy.partnership' })), { status: 'key_conflict', id: 'lr_a' });
    assert.deepEqual(await b.start(runRow({ id: 'lr_c', kind: 'feed' })), { status: 'key_conflict', id: 'lr_a' });
    assert.equal((await b.rows('learn_runs')).length, 1);
    assert.equal((await b.rows('learning_question_exposure')).length, 2, 'a replay writes no exposure');
    // Another student may use the same key; a question already exposed stays with its first reference.
    assert.equal((await b.start(runRow({ id: 'lr_u2', user_id: 'u2' }), ['q1'])).status, 'ok');
    assert.equal((await b.start(runRow({ id: 'lr_d', request_key: 'key-dddd-0001', seconds_left: 99, chapter_key: null, kind: 'cards' }), ['q1'])).status, 'ok');
    assert.equal((await runOf(b, 'lr_d')).seconds_left, 99);
    assert.equal((await b.rows('learning_question_exposure')).find((r) => r.user_id === 'u1' && r.question_id === 'q1').reference, 'lr_a');
    // Bad input and the table's checks raise.
    await assert.rejects(b.start(runRow({ id: 'lr_e', request_key: '' })));
    await assert.rejects(b.start(runRow({ id: 'lr_e', request_key: 'key-eeee-0001', kind: 'paper' })));
    await assert.rejects(b.start(runRow({ id: 'lr_e', request_key: 'short' })));
    await assert.rejects(b.start(runRow({ id: 'lr_e', request_key: 'key-eeee-0002', minutes: 300 })));
    assert.equal((await b.rows('learn_runs')).length, 3);
    await b.close();
  });

  test(`${name}: an answer writes the event, the progress, the 'learn' interaction and the counters; a replay counts nothing twice`, async () => {
    const b = await make();
    await b.start(runRow());
    const first = await b.record(answer());
    assert.equal(first.status, 'ok');
    assert.deepEqual(first.body, { correct: false, key: 'A' });
    assert.equal(first.reinsert, null);
    assert.equal(first.claimed, false);
    assert.equal(Number(first.revise_pile), 0);
    const again = await b.record(answer({ choice: 'C', correct: true }));
    assert.deepEqual(again, { status: 'replay', body: { correct: false, key: 'A' } });
    const [p] = await b.rows('user_question_progress');
    assert.equal(p.attempt_count, 1);
    assert.equal(p.seen_count, 1);
    assert.equal(p.correct_count, 0);
    assert.equal(p.last_selected_key, 'B');
    assert.equal(p.last_correct, false);
    assert.equal(p.chapter, 'Goodwill');
    const qi = await b.rows('question_interactions');
    assert.equal(qi.length, 1);
    assert.equal(qi[0].flow_context, 'learn');
    assert.equal(qi[0].session_id, 'lr_a');
    assert.equal(qi[0].interaction_type, 'attempted');
    assert.deepEqual(qi[0].metadata, { selected_key: 'B', is_correct: false, item_id: 'i2', run_kind: 'mix' });
    const [e] = await b.rows('learn_run_events');
    assert.equal(e.kind, 'answer');
    assert.equal(e.question_id, 'q1');
    assert.equal(e.correct, false);
    assert.equal(e.choice, 'B');
    let run = await runOf(b);
    assert.equal(run.done_count, 1);
    assert.equal(run.seconds_left, SECONDS - 50);
    // A second question answered right: the progress row of q2 is new; q1 again in another run adds up.
    await b.record(answer({ item: 'i4', question: 'q2', correct: true, choice: 'A' }));
    await b.start(runRow({ id: 'lr_b', request_key: 'key-bbbb-0001' }));
    await b.record(answer({ run: 'lr_b', correct: true, choice: 'A' }));
    const q1 = (await b.rows('user_question_progress')).find((r) => r.question_id === 'q1');
    assert.deepEqual([q1.attempt_count, q1.seen_count, q1.correct_count, q1.last_correct, q1.last_selected_key], [2, 2, 1, true, 'A']);
    // Cards: no progress, no interaction; the limit line is kept once set; revise_pile counts cards rated well, once each.
    const r1 = await b.record(rate());
    assert.equal(Number(r1.revise_pile), 1);
    await b.record(rate({ item: 'i3', card: 'c2', rating: 1, limitLine: 'Free has 10 card ratings a day.' }));
    const r3 = await b.record(rate({ item: 'i5', card: 'c3', rating: 4 }));
    assert.equal(Number(r3.revise_pile), 2);
    run = await runOf(b);
    assert.equal(run.done_count, 5);
    assert.equal(run.limit_line, 'Free has 10 card ratings a day.');
    assert.equal(run.seconds_left, SECONDS - 50 - 50 - 18 * 3);
    assert.equal((await b.rows('question_interactions')).length, 3);
    // Not found: another student's run, an unknown run; no item: an id not in the run. Nothing is written.
    assert.deepEqual(await b.record(answer({ user: 'u2', item: 'i6' })), { status: 'not_found' });
    assert.deepEqual(await b.record(answer({ run: 'lr_nope' })), { status: 'not_found' });
    assert.deepEqual(await b.record(answer({ item: 'i99' })), { status: 'no_item' });
    assert.equal((await b.rows('learn_run_events')).length, 6);
    await b.close();
  });

  test(`${name}: Free's Learn session is claimed by the first answer; a second run's answer is 'used' and writes nothing; the same run claims once`, async () => {
    const b = await make();
    await b.start(runRow());
    await b.start(runRow({ id: 'lr_b', request_key: 'key-bbbb-0001', kind: 'feed' }));
    // Looking at cards first claims nothing.
    await b.record(rate());
    assert.equal((await b.rows('learning_allowances')).length, 0);
    const first = await b.record(answer({ quota: QUOTA }));
    assert.equal(first.status, 'ok');
    assert.equal(first.claimed, true);
    assert.deepEqual((await b.rows('learning_allowances')).map((r) => [r.user_id, r.kind, r.period, r.reference]), [['u1', 'learn_session', `${DAY}:1`, 'lr_a']]);
    assert.equal((await runOf(b)).session_claimed, true);
    // The same run's next answer goes on and claims nothing more; its replay neither.
    const second = await b.record(answer({ item: 'i4', question: 'q2', quota: QUOTA }));
    assert.equal(second.status, 'ok');
    assert.equal(second.claimed, false);
    assert.equal((await b.record(answer({ quota: QUOTA }))).status, 'replay');
    assert.equal((await b.rows('learning_allowances')).length, 1);
    // Another run the same day: 'used', with the run holding the slot, and nothing written.
    const before = {
      events: (await b.rows('learn_run_events')).length, qi: (await b.rows('question_interactions')).length,
      q1: (await b.rows('user_question_progress')).find((r) => r.question_id === 'q1').attempt_count,
    };
    assert.deepEqual(await b.record(answer({ run: 'lr_b', quota: QUOTA })), { status: 'used', reference: 'lr_a' });
    assert.equal((await b.rows('learn_run_events')).length, before.events);
    assert.equal((await b.rows('question_interactions')).length, before.qi);
    assert.equal((await b.rows('user_question_progress')).find((r) => r.question_id === 'q1').attempt_count, before.q1);
    const runB = await runOf(b, 'lr_b');
    assert.deepEqual([runB.done_count, runB.session_claimed], [0, false]);
    // A card in that run needs no quota; the next IST day has its own slot, taken by the run that answers first.
    assert.equal((await b.record(rate({ run: 'lr_b' }))).status, 'ok');
    const nextDay = await b.record(answer({ run: 'lr_b', quota: { ...QUOTA, day: '2026-11-02' } }));
    assert.deepEqual([nextDay.status, nextDay.claimed], ['ok', true]);
    // Pro sends no quota: no row.
    await b.start(runRow({ id: 'lr_p', user_id: 'u2' }));
    assert.equal((await b.record(answer({ run: 'lr_p', user: 'u2' }))).claimed, false);
    assert.equal((await b.rows('learning_allowances')).filter((r) => r.user_id === 'u2').length, 0);
    assert.equal((await b.rows('learning_allowances')).length, 2);
    await b.close();
  });

  test(`${name}: a re-insert copies the card once per card, never after it was rated well, and appends at the end`, async () => {
    const b = await make();
    await b.start(runRow());
    const wrong = await b.record(answer({ reinsert: copy('c9') }));
    assert.deepEqual(wrong.reinsert, { item_id: 'lr_a-r1', at: 4 });
    assert.deepEqual(wrong.body, { correct: false, key: 'A', reinsert: { item_id: 'lr_a-r1', at: 4 } });
    let run = await runOf(b);
    assert.deepEqual(ids(run), ['i1', 'i2', 'i3', 'i4', 'lr_a-r1', 'i5', 'i6']);
    assert.deepEqual(run.items[4], { type: 'card', cardId: 'c9', stage: 'again', reason: 'line', seconds: 18, id: 'lr_a-r1' });
    assert.deepEqual([run.item_count, run.extra, run.reinserted], [7, 1, ['c9']]);
    assert.equal(run.seconds_left, SECONDS - 50 + 18);
    // The same card again: no second copy.
    const twice = await b.record(answer({ item: 'i4', question: 'q2', reinsert: copy('c9') }));
    assert.equal(twice.reinsert, null);
    // A card rated Got it in this run is not copied back.
    await b.record(rate());
    await b.start(runRow({ id: 'lr_b', request_key: 'key-bbbb-0001', items: [...items(), { id: 'i7', type: 'question', questionId: 'q3', seconds: 50 }] }));
    await b.record(rate({ run: 'lr_b' }));
    assert.equal((await b.record(answer({ run: 'lr_b', reinsert: copy('c1') }))).reinsert, null);
    // ... unless the rule is not asked for; a card rated Missed is copied back.
    await b.record(rate({ run: 'lr_b', item: 'i3', card: 'c2', rating: 1 }));
    assert.deepEqual((await b.record(answer({ run: 'lr_b', item: 'i4', question: 'q2', reinsert: copy('c2') }))).reinsert, { item_id: 'lr_b-r1', at: 6 });
    // At the end of the run the copy is appended.
    const last = await b.record(answer({ run: 'lr_b', item: 'i7', question: 'q3', reinsert: copy('c5') }));
    run = await runOf(b, 'lr_b');
    assert.deepEqual(last.reinsert, { item_id: 'lr_b-r2', at: 8 });
    assert.deepEqual(ids(run), ['i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'lr_b-r1', 'i7', 'lr_b-r2']);
    assert.deepEqual(run.reinserted, ['c2', 'c5']);
    await b.close();
  });

  test(`${name}: a card still ahead is moved, never copied; a close one stays; a replay never re-inserts`, async () => {
    const b = await make();
    await b.start(runRow());
    // c4 (i6, index 5) is ahead of the wrong answer at index 1: moved to index 4.
    const moved = await b.record(answer({ reinsert: copy('c4', { move_item: 'i6' }) }));
    assert.deepEqual(moved.reinsert, { item_id: 'i6', at: 4, moved: true });
    let run = await runOf(b);
    assert.deepEqual(ids(run), ['i1', 'i2', 'i3', 'i4', 'i6', 'i5']);
    assert.deepEqual([run.item_count, run.extra, run.reinserted], [6, 0, ['c4']]);
    // c3 (i5, now index 5) is within 3 of the answer at index 3: it stays.
    const stays = await b.record(answer({ item: 'i4', question: 'q2', reinsert: copy('c3', { move_item: 'i5' }) }));
    assert.deepEqual(stays.reinsert, { item_id: 'i5', at: 5, moved: true });
    run = await runOf(b);
    assert.deepEqual(ids(run), ['i1', 'i2', 'i3', 'i4', 'i6', 'i5']);
    assert.equal((await b.record(answer({ item: 'i4', question: 'q2', reinsert: copy('c7') }))).status, 'replay');
    assert.deepEqual((await runOf(b)).reinserted, ['c4', 'c3']);
    // A move_item that is no longer ahead falls back to the copy.
    await b.start(runRow({ id: 'lr_b', request_key: 'key-bbbb-0001' }));
    const back = await b.record(answer({ run: 'lr_b', item: 'i4', question: 'q2', reinsert: copy('c1', { move_item: 'i1' }) }));
    assert.deepEqual(back.reinsert, { item_id: 'lr_b-r1', at: 6 });
    await b.close();
  });

  test(`${name}: flow_context accepts 'learn' and the four old values, and refuses anything else`, async () => {
    const b = await make();
    for (const flow of ['learn', 'explore', 'mock', 'review', 'shadow', null]) {
      assert.equal((await b.interact({ question_id: 'q1', user_id: 'u1', interaction_type: 'attempted', flow_context: flow })).error, null, String(flow));
    }
    assert.ok((await b.interact({ question_id: 'q1', user_id: 'u1', interaction_type: 'attempted', flow_context: 'bogus' })).error);
    await b.close();
  });
}

// ---------------------------------------------------------------- parity: one script, both backends, the same answers and rows

test('parity: the memory mirrors answer every call and leave every row as the PGlite functions do', async () => {
  const script = [
    ['start', runRow(), ['q1', 'q2']],
    ['start', runRow({ id: 'lr_b', request_key: 'key-bbbb-0001', kind: 'feed' }), ['q2', 'q3']],
    ['start', runRow({ id: 'lr_x' }), ['q4']],
    ['start', runRow({ id: 'lr_x', chapter_key: 'accountancy.other' })],
    ['record', rate()],
    ['record', answer({ quota: QUOTA, reinsert: copy('c9') })],
    ['record', answer({ quota: QUOTA, reinsert: copy('c9') })],
    ['record', answer({ run: 'lr_b', quota: QUOTA })],
    ['record', rate({ item: 'i3', card: 'c2', rating: 1, limitLine: 'A limit line.' })],
    ['record', answer({ item: 'i4', question: 'q2', correct: true, choice: 'A', quota: QUOTA, reinsert: copy('c2') })],
    ['record', answer({ run: 'lr_b', item: 'i4', question: 'q2', reinsert: copy('c4', { move_item: 'i6' }) })],
    ['record', answer({ run: 'lr_b', item: 'i4', question: 'q2', quota: { ...QUOTA, day: '2026-11-02' } })],
    ['record', rate({ run: 'lr_b', item: 'i6', card: 'c4', rating: 4 })],
    ['record', answer({ user: 'u2' })],
    ['record', answer({ item: 'nope' })],
  ];
  const outs = {};
  const finals = {};
  const pick = (row, cols) => Object.fromEntries(cols.map((c) => [c, row[c] === undefined ? null : row[c]]));
  for (const [name, make] of BACKENDS) {
    const b = await make();
    outs[name] = [];
    for (const [op, arg, extra] of script) {
      try { outs[name].push(op === 'start' ? await b.start(arg, extra) : await b.record(arg)); } catch { outs[name].push('raised'); }
    }
    finals[name] = {
      runs: (await b.rows('learn_runs')).map((r) => pick(r, ['id', 'kind', 'chapter_key', 'items', 'item_count', 'done_count', 'seconds_left', 'reinserted', 'extra', 'limit_line', 'session_claimed']))
        .sort((x, y) => x.id.localeCompare(y.id)),
      events: (await b.rows('learn_run_events')).map((r) => pick(r, ['run_id', 'item_id', 'kind', 'question_id', 'card_id', 'choice', 'correct', 'rating', 'body']))
        .sort((x, y) => `${x.run_id}/${x.item_id}`.localeCompare(`${y.run_id}/${y.item_id}`)),
      allowances: (await b.rows('learning_allowances')).map((r) => pick(r, ['user_id', 'kind', 'period', 'reference'])),
      exposure: (await b.rows('learning_question_exposure')).map((r) => pick(r, ['user_id', 'question_id', 'reference']))
        .sort((x, y) => `${x.user_id}/${x.question_id}`.localeCompare(`${y.user_id}/${y.question_id}`)),
      progress: (await b.rows('user_question_progress')).map((r) => pick(r, ['user_id', 'question_id', 'seen_count', 'attempt_count', 'correct_count', 'last_selected_key', 'last_correct']))
        .sort((x, y) => `${x.user_id}/${x.question_id}`.localeCompare(`${y.user_id}/${y.question_id}`)),
      interactions: (await b.rows('question_interactions')).map((r) => pick(r, ['question_id', 'session_id', 'flow_context', 'metadata'])),
    };
    await b.close();
  }
  assert.ok(outs.pglite.includes('raised') === false, 'the script raises nowhere');
  assert.deepEqual(outs.memory, outs.pglite);
  assert.deepEqual(finals.memory, finals.pglite);
});

test('memory client: the query operators the Learn store uses (lte, lt, gte, gt, is, not, maybeSingle, single, delete, order desc, count)', async () => {
  const db = fakeDb({
    learn_runs: [
      { id: 'a', user_id: 'u1', created_at: '2026-11-01T10:00:00.000Z', ended_at: null, done_count: 2 },
      { id: 'b', user_id: 'u1', created_at: '2026-11-01T12:00:00.000Z', ended_at: '2026-11-01T12:30:00.000Z', done_count: 10 },
      { id: 'c', user_id: 'u1', created_at: '2026-10-30T09:00:00.000Z', ended_at: null, done_count: 0 },
      { id: 'd', user_id: 'u2', created_at: '2026-11-01T11:00:00.000Z', ended_at: null, done_count: 1 },
    ],
  });
  const idsOf = (res) => res.data.map((r) => r.id);
  const open = await db.from('learn_runs').select('id').eq('user_id', 'u1').is('ended_at', null).gte('created_at', '2026-10-31T10:00:00.000Z').order('created_at', { ascending: false });
  assert.deepEqual(idsOf(open), ['a']);
  assert.deepEqual(idsOf(await db.from('learn_runs').select('id').eq('user_id', 'u1').order('created_at', { ascending: false }).limit(2)), ['b', 'a']);
  assert.deepEqual(idsOf(await db.from('learn_runs').select('id').not('ended_at', 'is', null)), ['b']);
  assert.deepEqual(idsOf(await db.from('learn_runs').select('id').lt('created_at', '2026-11-01T00:00:00.000Z')), ['c']);
  assert.deepEqual(idsOf(await db.from('learn_runs').select('id').lte('done_count', 1).order('id')), ['c', 'd']);
  assert.deepEqual(idsOf(await db.from('learn_runs').select('id').gt('done_count', 1).order('id')), ['a', 'b']);
  assert.deepEqual(idsOf(await db.from('learn_runs').select('id').gt('created_at', '2026-11-01T11:00:00.000Z')), ['b']);
  assert.deepEqual(idsOf(await db.from('learn_runs').select('id').not('id', 'in', '(a,b)').order('id')), ['c', 'd']);
  assert.equal((await db.from('learn_runs').select('id').eq('id', 'a').maybeSingle()).data.id, 'a');
  assert.equal((await db.from('learn_runs').select('id').eq('id', 'zz').maybeSingle()).data, null);
  assert.equal((await db.from('learn_runs').select('id').eq('user_id', 'u1').maybeSingle()).error.code, 'PGRST116');
  assert.equal((await db.from('learn_runs').select('id').eq('id', 'zz').single()).error.code, 'PGRST116');
  assert.equal((await db.from('learn_runs').select('id', { count: 'exact', head: true }).eq('user_id', 'u1')).count, 3);
  // An update that names its rows back, and the idempotent end: the second one touches nothing.
  const ended = await db.from('learn_runs').update({ ended_at: '2026-11-01T13:00:00.000Z' }).eq('id', 'a').eq('user_id', 'u1').is('ended_at', null).select('id');
  assert.deepEqual(idsOf(ended), ['a']);
  assert.deepEqual(idsOf(await db.from('learn_runs').update({ ended_at: 'x' }).eq('id', 'a').is('ended_at', null).select('id')), []);
  await db.from('learn_runs').delete().eq('user_id', 'u2');
  assert.deepEqual(db.tables.learn_runs.map((r) => r.id), ['a', 'b', 'c']);
  // A select without order still promises none (rows reversed, as before).
  assert.deepEqual(idsOf(await db.from('learn_runs').select('id')), ['c', 'b', 'a']);
  // A plain insert keeps the keys and the checks.
  const valid = { id: 'e', user_id: 'u1', request_key: 'key-eeee-0001', kind: 'mix', subject: 'accountancy', asked_minutes: 10, minutes: 10, items: [] };
  assert.equal((await db.from('learn_runs').insert(valid)).error, null);
  assert.equal((await db.from('learn_runs').insert({ ...valid, id: 'f' })).error.code, '23505', 'unique (user_id, request_key)');
  assert.equal((await db.from('learn_runs').insert({ ...valid, id: 'a', request_key: 'key-ffff-0001' })).error.code, '23505', 'the primary key');
  assert.equal((await db.from('learn_runs').insert({ ...valid, id: 'g', request_key: 'short' })).error.code, '23514');
  assert.equal((await db.from('question_interactions').insert({ question_id: 'q1', user_id: 'u1', interaction_type: 'attempted', flow_context: 'nope' })).error.code, '23514');
});
