// Security round 2 from the 17 Oct 2026 database review (branch fix/security-2-1017d).
//  (a) GET /api/questions/explore returns only public fields (no key, no explanation, no contributor ids or internals),
//  (b) POST /api/questions/upload is no answer oracle for live questions,
//  (c) create_pending_payout is serialised per creator,
//  (d) POST /api/ai/mentor/local never stores client text as an assistant turn,
//  (e) account deletion scrubs runtime_ai_requests (request key and reply content), not only user_id,
//  (f) Database.voteQuestion refuses votes on questions that are not live,
//  (g) default privileges in public grant nothing to PUBLIC, anon or authenticated.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { exploreRowOut, publicExploreOptions } from '../explore_feed.js';
import { computeContentHash } from '../../src/lib/moderation/hash.js';
import {
  UPLOAD_ANSWER_KEYS, candidateContentHashes, uploadAccepted, uploadShapeViolation, UPLOAD_ACCEPTED_STATUS,
} from '../../src/lib/moderation/uploadDedupe.js';
import { executeDeletion, planDeletion } from '../../src/lib/server/accountDeletion.js';
import { VoteError, isVotableQuestion, voteOnLiveQuestion } from '../question_votes.js';
import { historyMessages, localExchangeRow, sanitiseLocalReply } from '../../src/lib/server/mentorLocal.js';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

// ------------------------------------------------------------------ (a) explore public shape

const PRIVATE_QUESTION = {
  id: 'q1', subject: 'accountancy', chapter: 'Partnership', difficulty: 'medium',
  question: 'What is goodwill?', body: 'old body', passage_text: null, passage_id: 'p9', order_index: 2,
  options: [{ key: 'A', text: 'One', is_correct: true, rationale: 'because' }, { key: 'B', text: 'Two' }],
  correct_answer: 'A', explanation: 'Because A.', recommended_difficulty: 'hard',
  author_id: 'user-author', uploaded_by: 'user-uploader', provenance: { kind: 'factory' }, evidence: { record: { state: 'verified' } },
  legacy_screening: { x: 1 }, content_hash: 'abc', family_id: 'fam', template_id: 'tpl', exposure_budget: 9, exposure_used: 3,
  quality_score: 0.9, ai_score: 88, ai_tier: 'A', status: 'live', is_deleted: false, tags: ['t1'], upvotes: 3, downvotes: 1, score: 2,
};
const PRIVATE_ROW = {
  question_id: 'q1', rank_score: 0.75, exploration_lane: 'standard', momentum_score: 1, quality_score: 2, attempts_qualified: 5,
  exposures_total: 50, save_rate: 0.1, like_rate: 0.2, skip_rate: 0.3, report_rate: 0.4, questions: PRIVATE_QUESTION,
};

test('explore row leaves the server without the key, the explanation, contributor ids or internals', () => {
  const out = exploreRowOut(PRIVATE_ROW, 'up');
  const text = JSON.stringify(out);
  for (const banned of ['correct_answer', 'explanation', 'recommended_difficulty', 'author_id', 'uploaded_by', 'provenance', 'evidence',
    'legacy_screening', 'content_hash', 'family_id', 'template_id', 'exposure', 'quality_score', 'ai_score', 'ai_tier', 'report_rate',
    'skip_rate', 'save_rate', 'like_rate', 'momentum_score', 'attempts_qualified', 'is_correct', 'rationale', 'user-author', 'user-uploader', 'Because A.']) {
    assert.ok(!text.includes(banned), `${banned} must not appear in the explore response`);
  }
  assert.deepEqual(out, {
    question_id: 'q1', rank_score: 0.75, exploration_lane: 'standard',
    questions: {
      id: 'q1', subject: 'accountancy', chapter: 'Partnership', difficulty: 'medium', body: 'What is goodwill?',
      options: [{ key: 'A', text: 'One' }, { key: 'B', text: 'Two' }], passage_text: null, passage_group_id: 'p9', order_index: 2,
      tags: ['t1'], upvotes: 3, downvotes: 1, score: 2, userVote: 'up',
    },
  });
});

test('explore options keep only key and text, for array, string and object option shapes', () => {
  assert.deepEqual(publicExploreOptions(['x', 'y']), [{ key: 'A', text: 'x' }, { key: 'B', text: 'y' }]);
  assert.deepEqual(publicExploreOptions({ A: 'x', B: 'y' }), [{ key: 'A', text: 'x' }, { key: 'B', text: 'y' }]);
  assert.deepEqual(publicExploreOptions([{ key: 'A', label: 'x', correct: true }]), [{ key: 'A', text: 'x' }]);
  assert.deepEqual(exploreRowOut({ question_id: 'q2', questions: null }).questions.options, []);
});

test('explore route maps every row through exploreRowOut and no longer returns raw rows', () => {
  const src = read('src/app/api/questions/explore/route.js');
  assert.match(src, /merged\.map\(\(row\) => exploreRowOut\(row, voteMap\.get\(row\.question_id\)\)\)/);
  assert.doesNotMatch(src, /questions:\s*merged\s*[,}]/, 'raw merged rows are never returned');
  assert.doesNotMatch(src, /FIX 10/, 'the false strip comment is gone');
  assert.match(src, /checkRateLimit\(request/, 'the anonymous route is rate limited like the feed');
});

// ------------------------------------------------------------------ (b) upload answer oracle

const OPTIONS = (keys) => keys.map((key) => ({ key, text: `option ${key}` }));

// The route's decision, reduced to what the database answers: dedupe hit -> silent accept, else insert.
function uploadOutcome(liveHashes, body, options, answer) {
  const violation = uploadShapeViolation(options, answer);
  if (violation) return { status: 422, rule: violation.rule };
  const hit = candidateContentHashes(body).some((hash) => liveHashes.has(hash));
  return { status: UPLOAD_ACCEPTED_STATUS, body: uploadAccepted([]), stored: !hit };
}

test('a live question body gives the same outcome for every guessed answer key (no oracle)', () => {
  const body = 'A firm earns 10% on capital. Find the interest on Rs 5,000.';
  for (const liveKey of ['A', 'B', 'C', 'D', 'E']) {
    const live = new Set([computeContentHash(body, liveKey)]);
    const outcomes = ['A', 'B', 'C', 'D'].map((guess) => uploadOutcome(live, body, OPTIONS(['A', 'B', 'C', 'D']), guess));
    for (const outcome of outcomes) assert.deepEqual(outcome, outcomes[0], `live key ${liveKey}: every guess looks the same`);
    assert.equal(outcomes[0].stored, false, 'the existing body is deduped whichever key is marked');
    // Shrinking or reshaping the option set cannot exclude the live key from the lookup either.
    assert.deepEqual(uploadOutcome(live, body, OPTIONS(['E', 'F']), 'E'), outcomes[0]);
    assert.deepEqual(uploadOutcome(live, body, OPTIONS(['a', 'b']), 'b'), outcomes[0], 'lower-case keys hash the same');
  }
  // A body that is not in the bank is stored whichever key is marked, with the same reply.
  const fresh = ['A', 'B', 'C', 'D'].map((guess) => uploadOutcome(new Set(), 'A new question', OPTIONS(['A', 'B', 'C', 'D']), guess));
  for (const outcome of fresh) assert.deepEqual(outcome, { status: 202, body: { status: 'pending_moderation', rule_violations: [] }, stored: true });
  const { stored: _a, ...dupReply } = uploadOutcome(new Set([computeContentHash('X', 'B')]), 'X', OPTIONS(['A', 'B']), 'A');
  const { stored: _b, ...newReply } = fresh[0];
  assert.deepEqual(dupReply, newReply, 'the reply for a duplicate equals the reply for a new question');
});

test('candidate hashes cover every allowed key, so the submitted pair is always one of them', () => {
  const hashes = new Set(candidateContentHashes('Body'));
  for (const key of UPLOAD_ANSWER_KEYS) assert.ok(hashes.has(computeContentHash('Body', key)));
  assert.ok(hashes.has(computeContentHash('Body', 'c')));
});

test('option keys outside the fixed set, repeated keys and answers outside the options are refused', () => {
  assert.equal(uploadShapeViolation(null, 'A')?.rule, 'invalid_options_count', 'options are required');
  assert.equal(uploadShapeViolation(OPTIONS(['A']), 'A')?.rule, 'invalid_options_count');
  assert.equal(uploadShapeViolation(OPTIONS(['Paris', 'Rome']), 'Paris')?.rule, 'invalid_option_keys', 'free-text keys would bring back a set-membership oracle');
  assert.equal(uploadShapeViolation(OPTIONS(['A', 'a']), 'A')?.rule, 'invalid_option_keys', 'keys that hash the same are repeats');
  assert.equal(uploadShapeViolation(OPTIONS(['A', 'B']), 'C')?.rule, 'answer_not_in_options');
  assert.equal(uploadShapeViolation(OPTIONS(['A', 'B', 'C', 'D']), 'D'), null);
  assert.equal(uploadShapeViolation(OPTIONS(['1', '2']), '2'), null);
  assert.deepEqual(uploadAccepted([{ severity: 'soft', rule: 's' }, { severity: 'hard', rule: 'h' }]).rule_violations, [{ severity: 'soft', rule: 's' }]);
});

test('upload route: no 409, no duplicate_of, no error details; candidate lookup, silent 23505 and a per-student limit', () => {
  const src = read('src/app/api/questions/upload/route.js');
  assert.doesNotMatch(src, /status:\s*409/);
  assert.doesNotMatch(src, /duplicate_of|identical question/i);
  assert.doesNotMatch(src, /detail:|err\.stack|job_error|warning:/);
  assert.doesNotMatch(src.slice(src.indexOf('return accepted()')), /Response\.json\(\s*\{\s*question_id/, 'no question id in the reply');
  assert.match(src, /\.in\('content_hash', candidateContentHashes\(/);
  assert.match(src, /questionError\.code === '23505'\) return accepted\(\)/);
  assert.match(src, /if \(existingHash\) return accepted\(\)/);
  assert.match(src, /checkPersistentRateLimit\(request, \{ \.\.\.window, keyParts: \[author_id\]/);
  assert.match(src, /uploadShapeViolation\(options, correct_answer\)/);
  assert.doesNotMatch(src, /console\.log\([^)]*correct_answer/, 'the submitted answer is not logged');
});

// ------------------------------------------------------------------ (c) create_pending_payout serialised per creator

const PAYOUT_MIGRATION = read('supabase/migrations/20261017200000_create_pending_payout_lock.sql');
const PAYOUT_UNDO = read('supabase/undo/20261017200000_create_pending_payout_lock.undo.sql');
const PAYOUT_FIXTURE = `
create role anon; create role authenticated; create role service_role;
create table public.creators (id text primary key);
create table public.payouts (id text primary key default ('pyt_' || replace(gen_random_uuid()::text, '-', '')), creator_id text not null references public.creators(id),
  amount integer not null, payment_count integer not null default 0, status text not null default 'pending', paid_at timestamptz, marked_paid_by text);
create table public.payments (id text primary key, creator_id text, payout_id text, payment_id text, amount_paid int, status text, creator_earning int);
insert into creators values ('c1'), ('c2');
insert into payments values ('p1','c1',null,'pay_1',100,'captured',30), ('p2','c1',null,'pay_2',200,'paid',60), ('p3','c2',null,'pay_3',100,'captured',10),
  ('p4','c1',null,null,100,'captured',99), ('p5','c1',null,'pay_5',100,'failed',99);
`;

test('create_pending_payout takes a per-creator advisory lock before it reads the unpaid sum', () => {
  const body = PAYOUT_MIGRATION.slice(PAYOUT_MIGRATION.indexOf('BEGIN'));
  const lock = body.indexOf("pg_advisory_xact_lock(hashtextextended('create_pending_payout:' || coalesce(p_creator_id, ''), 0))");
  assert.ok(lock > 0, 'transaction-scoped lock keyed on the creator');
  assert.ok(lock < body.indexOf('SELECT COALESCE(SUM(creator_earning)'), 'the lock comes before the sum');
  assert.match(PAYOUT_MIGRATION, /REVOKE ALL ON FUNCTION public\.create_pending_payout\(text, text\) FROM PUBLIC, anon, authenticated;/);
  assert.match(PAYOUT_MIGRATION, /GRANT EXECUTE ON FUNCTION public\.create_pending_payout\(text, text\) TO service_role;/);
  assert.doesNotMatch(PAYOUT_UNDO, /pg_advisory_xact_lock/, 'the undo restores the production body without the lock');
});

test('payout migration: one payout per creator, the repeat finds nothing, the lock is held inside the transaction; undo and re-apply work', async () => {
  const db = new PGlite();
  try {
    await db.exec(PAYOUT_FIXTURE);
    await db.exec(PAYOUT_MIGRATION);
    await db.exec(PAYOUT_MIGRATION); // idempotent
    await db.exec('begin');
    const first = (await db.query("select public.create_pending_payout('c1','admin') id")).rows[0].id;
    const locks = Number((await db.query("select count(*) n from pg_locks where locktype = 'advisory' and pid = pg_backend_pid() and granted")).rows[0].n);
    await db.exec('commit');
    assert.equal(locks, 1, 'the advisory lock is held until commit');
    assert.equal(Number((await db.query("select count(*) n from pg_locks where locktype = 'advisory' and pid = pg_backend_pid()")).rows[0].n), 0, 'and released after');
    const payout = (await db.query('select creator_id, amount, payment_count, status from payouts where id=$1', [first])).rows[0];
    assert.deepEqual(payout, { creator_id: 'c1', amount: 90, payment_count: 2, status: 'paid' });
    assert.equal(Number((await db.query('select count(*) n from payments where payout_id=$1', [first])).rows[0].n), 2);
    await assert.rejects(db.query("select public.create_pending_payout('c1','admin')"), /No unpaid earnings for creator c1/, 'a second run pays nothing twice');
    assert.equal(Number((await db.query("select count(*) n from payouts where creator_id='c1'")).rows[0].n), 1);
    assert.ok((await db.query("select public.create_pending_payout('c2','admin') id")).rows[0].id, 'another creator is unaffected');
    const grants = (await db.query("select r.rolname, has_function_privilege(r.rolname, 'public.create_pending_payout(text,text)', 'execute') ok from pg_roles r where r.rolname in ('anon','authenticated','service_role') order by 1")).rows;
    assert.deepEqual(grants, [{ rolname: 'anon', ok: false }, { rolname: 'authenticated', ok: false }, { rolname: 'service_role', ok: true }]);
    await db.exec(PAYOUT_UNDO);
    assert.doesNotMatch((await db.query("select pg_get_functiondef('public.create_pending_payout(text,text)'::regprocedure) d")).rows[0].d, /advisory/);
    await db.exec(PAYOUT_MIGRATION);
    assert.match((await db.query("select pg_get_functiondef('public.create_pending_payout(text,text)'::regprocedure) d")).rows[0].d, /pg_advisory_xact_lock/);
  } finally { await db.close(); }
});

// ------------------------------------------------------------------ (g) default privileges server-only

const DEFAULTS_MIGRATION = read('supabase/migrations/20261017210000_default_privileges_server_only.sql');
const DEFAULTS_UNDO = read('supabase/undo/20261017210000_default_privileges_server_only.undo.sql');
// The Supabase defaults as read on staging and production on 17 Oct 2026 (pg_default_acl rows postgres/public r, S, f).
const SUPABASE_DEFAULTS = `
create role anon; create role authenticated; create role service_role; create role supabase_admin;
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated, service_role;
create table public.old_table (id bigint generated by default as identity primary key);
create sequence public.old_seq;
`;

async function grantsOnNewObjects(db, suffix) {
  await db.exec(`
    create table public.t_${suffix} (id bigserial primary key);
    create sequence public.s_${suffix};
    create function public.f_${suffix}() returns int language sql as 'select 1';
  `);
  const q = await db.query(`
    select r.rolname,
      has_table_privilege(r.rolname, 'public.t_${suffix}', 'select') t,
      has_sequence_privilege(r.rolname, 'public.s_${suffix}', 'usage') s,
      has_function_privilege(r.rolname, 'public.f_${suffix}()', 'execute') f
    from pg_roles r where r.rolname in ('anon','authenticated','service_role') order by 1`);
  const acl = (await db.query(`select proacl is null builtin,
      coalesce((select bool_or(a.grantee = 0) from aclexplode(proacl) a), false) pub
    from pg_proc where oid = 'public.f_${suffix}()'::regprocedure`)).rows[0];
  return { roles: q.rows.map((r) => [r.rolname, r.t, r.s, r.f]), publicExecute: acl.builtin || acl.pub };
}

test('default privileges: new public tables, sequences and functions reach service_role only; undo restores the old defaults', async () => {
  const db = new PGlite();
  try {
    await db.exec(SUPABASE_DEFAULTS);
    const before = await grantsOnNewObjects(db, 'before');
    assert.deepEqual(before.roles, [['anon', true, true, true], ['authenticated', true, true, true], ['service_role', true, true, true]], 'fixture matches the Supabase defaults');
    assert.equal(before.publicExecute, true, 'PUBLIC executes new functions through the built-in default');

    await db.exec(DEFAULTS_MIGRATION);
    await db.exec(DEFAULTS_MIGRATION); // idempotent
    const after = await grantsOnNewObjects(db, 'after');
    assert.deepEqual(after.roles, [['anon', false, false, false], ['authenticated', false, false, false], ['service_role', true, true, true]]);
    assert.equal(after.publicExecute, false, 'no EXECUTE for PUBLIC on a new function');
    const seq = (await db.query(`select r.rolname, has_sequence_privilege(r.rolname, 'public.old_seq', 'usage') o, has_sequence_privilege(r.rolname, 'public.old_table_id_seq', 'update') i
      from pg_roles r where r.rolname in ('anon','authenticated','service_role') order by 1`)).rows;
    assert.deepEqual(seq, [{ rolname: 'anon', o: false, i: false }, { rolname: 'authenticated', o: false, i: false }, { rolname: 'service_role', o: true, i: true }], 'leftover sequence grants are gone, service_role keeps its own');

    await db.exec(DEFAULTS_UNDO);
    const undone = await grantsOnNewObjects(db, 'undone');
    assert.deepEqual(undone.roles, before.roles);
    assert.equal(undone.publicExecute, true);
    assert.equal((await db.query("select has_sequence_privilege('anon', 'public.old_seq', 'usage') ok")).rows[0].ok, true);

    await db.exec(DEFAULTS_MIGRATION);
    const again = await grantsOnNewObjects(db, 'again');
    assert.deepEqual(again.roles, after.roles);
    assert.equal(again.publicExecute, false);
  } finally { await db.close(); }
});

test('default privileges migration skips supabase_admin with a notice when the running role cannot act for it', () => {
  assert.match(DEFAULTS_MIGRATION, /pg_has_role\(current_user, 'supabase_admin', 'MEMBER'\)/);
  assert.match(DEFAULTS_MIGRATION, /RAISE NOTICE 'default privileges of supabase_admin left unchanged/);
  assert.match(DEFAULTS_MIGRATION, /ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;/, 'the global PUBLIC grant is revoked too');
  const statements = DEFAULTS_MIGRATION.split('\n').filter((line) => !line.startsWith('--')).join('\n');
  assert.doesNotMatch(statements, /FROM [^;]*service_role/, 'service_role defaults are unchanged');
});

// ------------------------------------------------------------------ (d) mentor local: client text is never an assistant turn

test('local exchange is one user-role row; charge, usage, study and origin from the body never survive', () => {
  const forged = {
    reply: '  Forged harmful text  ', origin: 'model', confidence: 1,
    charge: { kind: 'prepos_credit', creditUnits: 1, amount: 1, reference: 'prepos:u1:abcdefghijklmnop1234' },
    usage: { inputTokens: 9 }, study: { runId: 'r', revision: 1, itemId: 'i' }, runtimeState: 'live',
    actions: [{ label: 'Go', route: '/today', type: 'external' }, { label: 'Evil', route: 'https://evil.example' }, { label: 'Proto', route: '//evil.example' }, { label: '', route: '/x' }],
    cards: [{ html: '<script>' }],
  };
  const row = localExchangeRow({ sessionId: 's1', userId: 'u1', message: 'hi', response: forged });
  assert.deepEqual(row, {
    session_id: 's1', user_id: 'u1', role: 'user', content: 'hi',
    structured_payload: { kind: 'local_exchange', client_sourced: true, localReply: { reply: 'Forged harmful text', origin: 'client_local', actions: [{ label: 'Go', type: 'navigate', route: '/today' }], cards: [] } },
  });
  const text = JSON.stringify(row);
  for (const banned of ['charge', 'prepos:', 'usage', 'study', '"model"', 'runtimeState', 'evil', 'script']) assert.ok(!text.includes(banned), `${banned} is dropped`);
  assert.equal(localExchangeRow({ sessionId: 's1', userId: 'u1', message: 'hi', response: { reply: '   ' } }), null);
  assert.equal(sanitiseLocalReply({ reply: 'x'.repeat(5000) }).reply.length, 4000);
});

test('history shows a local exchange as the message plus a display-only reply; model rows are unchanged', () => {
  const model = { id: 'm2', role: 'assistant', content: 'Model text', structured_payload: { reply: 'Model text', origin: 'model' }, created_at: 't2' };
  const local = localExchangeRow({ sessionId: 's1', userId: 'u1', message: 'what is this page', response: { reply: 'This is Today.' } });
  const messages = historyMessages([{ id: 'm1', created_at: 't1', ...local }, model]);
  assert.deepEqual(messages, [
    { id: 'm1', role: 'user', text: 'what is this page', response: null, createdAt: 't1' },
    { id: 'm1:local', role: 'assistant', text: 'This is Today.', response: { reply: 'This is Today.', origin: 'record', actions: [], cards: [] }, clientSourced: true, createdAt: 't1' },
    { id: 'm2', role: 'assistant', text: 'Model text', response: { reply: 'Model text', origin: 'model' }, createdAt: 't2' },
  ]);
});

test('local route stores no assistant row; report lookup and study replay accept model replies only', () => {
  const local = read('src/app/api/ai/mentor/local/route.js');
  assert.doesNotMatch(local, /role:\s*'assistant'/, 'the local route never writes an assistant turn');
  assert.doesNotMatch(local, /structured_payload:\s*response/);
  assert.match(local, /localExchangeRow\(\{ sessionId: effectiveSessionId, userId: session\.user\.id, message, response \}\)/);
  assert.match(local, /sanitiseLocalReply\(body\.response\)/);
  assert.match(read('src/lib/server/aiReplyReport.js'), /\.eq\('role', 'assistant'\)\.eq\('structured_payload->>origin', 'model'\)\.eq\('structured_payload->charge->>reference', key\)/);
  assert.match(read('src/app/api/ai/mentor/chat/route.js'), /\.eq\('role','assistant'\)\.eq\('structured_payload->>origin','model'\)\.eq\('structured_payload->charge->>reference',key\)/);
  assert.match(read('src/app/api/ai/mentor/chat/route.js'), /origin: 'model', mode, usage/, 'model replies are still saved with origin model');
  assert.match(read('src/app/api/ai/mentor/history/route.js'), /messages = historyMessages\(rows\)/);
});

// ------------------------------------------------------------------ (e) account deletion scrubs runtime_ai_requests

const DELETION_BASE = read('supabase/migrations/20261013120000_deletion_processor.sql');
const PREFS = read('supabase/migrations/20261012121000_app_preferences_and_rhythm.sql');
const DELETION_SCRUB = read('supabase/migrations/20261017205000_account_deletion_runtime_ai_scrub.sql');
const DELETION_SCRUB_UNDO = read('supabase/undo/20261017205000_account_deletion_runtime_ai_scrub.undo.sql');

async function deletionDb() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table public.users (id text primary key, name text not null, email text unique, username text unique,
      image text, subjects jsonb not null default '[]'::jsonb, last_active_at timestamptz);
    create table public.runtime_ai_requests (request_key text primary key, provider text not null, model text not null,
      reserved_usd numeric not null, actual_usd numeric, state text not null default 'reserved', receipt jsonb,
      created_at timestamptz not null default now(), user_id text);
  `);
  await db.exec(PREFS);
  await db.exec(DELETION_BASE);
  await db.exec(DELETION_SCRUB);
  await db.exec(DELETION_SCRUB); // idempotent
  await db.exec(`
    insert into users (id, name, email, username) values ('u1','Asha','asha@example.com','asha'), ('u2','Bo','bo@example.com','bo'), ('u1x','Cy','cy@example.com','cy');
    insert into runtime_ai_requests (request_key, provider, model, reserved_usd, actual_usd, state, receipt, user_id) values
      ('prepos:u1:req00000000000000001', 'anthropic', 'claude-haiku-5-5', 0.01, 0.008, 'receipted',
        '{"response":{"text":"Your accountancy marks dropped because..."},"usage":{"inputTokens":900,"outputTokens":120},"stopReason":"end_turn"}', 'u1'),
      ('prepos:u1:req00000000000000002', 'anthropic', 'claude-haiku-5-5', 0.01, 0.009, 'receipted',
        '{"response":{"text":"Legacy row with no user_id"},"usage":{"inputTokens":800}}', null),
      ('repair:abc', 'openai', 'gpt-6-luna', 0.02, null, 'failed', '{"error":"physical_request_failed","errorKind":"timeout","status":504}', 'u1'),
      ('prepos:u2:req00000000000000003', 'anthropic', 'claude-haiku-5-5', 0.01, 0.007, 'receipted', '{"response":{"text":"Bo reply"},"usage":{}}', 'u2'),
      ('prepos:u1x:req0000000000000004', 'anthropic', 'claude-haiku-5-5', 0.01, 0.006, 'receipted', '{"response":{"text":"Cy reply"},"usage":{}}', 'u1x');
    insert into account_deletion_requests (user_id, requested_at, source) values ('u1', now() - interval '2 days', 'android');
  `);
  return db;
}

const deletionAdapter = (db) => ({
  async listPendingRequests() { return (await db.query("select id, user_id, requested_at::text requested_at, source, status from account_deletion_requests where status='pending'")).rows; },
  async getUser(id) { return (await db.query('select id, email from users where id=$1', [id])).rows[0] || null; },
  async run(request, steps, apply) {
    return (await db.query('select public.account_deletion_run($1::bigint, $2, $3::jsonb, $4) as r', [request.id, request.user_id, JSON.stringify(steps), !!apply])).rows[0].r;
  },
});

test('deletion removes the student link from request_key and the reply from receipt, keeps cost columns, touches nobody else', async () => {
  const db = await deletionDb();
  try {
    const adapter = deletionAdapter(db);
    const [request] = await adapter.listPendingRequests();
    const plan = await planDeletion(adapter, request);
    assert.equal(plan.steps.find((s) => s.table === 'runtime_ai_requests').rows, 3, 'user_id rows plus the prepos key with no user_id; not u1x');
    const costBefore = (await db.query('select sum(reserved_usd)::text r, sum(actual_usd)::text a, count(*)::int n from runtime_ai_requests')).rows[0];
    await executeDeletion({ adapter, request });
    const rows = (await db.query('select request_key, user_id, receipt, provider, model, state, reserved_usd::text r, actual_usd::text a from runtime_ai_requests order by reserved_usd, request_key')).rows;
    const mine = rows.filter((r) => r.request_key.startsWith('deleted:'));
    assert.equal(mine.length, 3);
    for (const row of mine) {
      assert.equal(row.user_id, null);
      assert.match(row.request_key, /^deleted:[0-9a-f]{32}$/);
      assert.ok(!JSON.stringify(row).includes('u1'), 'no trace of the student id');
      assert.ok(!('response' in (row.receipt || {})), 'the reply text is gone');
    }
    assert.deepEqual(mine.map((r) => r.receipt).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), [
      { error: 'physical_request_failed', errorKind: 'timeout', status: 504 },
      { usage: { inputTokens: 800 } },
      { usage: { inputTokens: 900, outputTokens: 120 }, stopReason: 'end_turn' },
    ]);
    const md5 = (await db.query("select 'deleted:' || md5('prepos:u1:req00000000000000001') k")).rows[0].k;
    assert.ok(mine.some((r) => r.request_key === md5), 'one-way per-row tombstone keeps the key unique');
    assert.deepEqual((await db.query('select sum(reserved_usd)::text r, sum(actual_usd)::text a, count(*)::int n from runtime_ai_requests')).rows[0], costBefore, 'budget sums unchanged');
    const others = rows.filter((r) => !r.request_key.startsWith('deleted:')).map((r) => [r.request_key, r.user_id, r.receipt.response.text]);
    assert.deepEqual(others.sort(), [['prepos:u1x:req0000000000000004', 'u1x', 'Cy reply'], ['prepos:u2:req00000000000000003', 'u2', 'Bo reply']], 'a longer id that starts with the same letters is not matched');
  } finally { await db.close(); }
});

test('deletion scrub migration: the undo restores the old function (which refuses the new step), and re-apply works', async () => {
  const db = await deletionDb();
  try {
    const adapter = deletionAdapter(db);
    const [request] = await adapter.listPendingRequests();
    await db.exec(DELETION_SCRUB_UNDO);
    await assert.rejects(planDeletion(adapter, request), /bad_set_value for runtime_ai_requests\.request_key/, 'old function: apply the migration before the new code runs a deletion');
    await db.exec(DELETION_SCRUB);
    assert.equal((await planDeletion(adapter, request)).steps.find((s) => s.table === 'runtime_ai_requests').rows, 3);
    const grants = (await db.query("select r.rolname, has_function_privilege(r.rolname, 'public.account_deletion_run(bigint,text,jsonb,boolean)', 'execute') ok from pg_roles r where r.rolname in ('anon','authenticated','service_role') order by 1")).rows;
    assert.deepEqual(grants, [{ rolname: 'anon', ok: false }, { rolname: 'authenticated', ok: false }, { rolname: 'service_role', ok: true }]);
  } finally { await db.close(); }
});

test('the prefix match is not a LIKE pattern, so % or _ in an id cannot widen it', () => {
  assert.match(DELETION_SCRUB, /left\(%1\$s, length\(%2\$L \|\| \$1 \|\| %3\$L\)\) = %2\$L \|\| \$1 \|\| %3\$L/);
  const branch = DELETION_SCRUB.slice(DELETION_SCRUB.indexOf("v_item ? 'prefix'"), DELETION_SCRUB.indexOf("elsif v_item ? 'parent_table'"));
  const code = branch.split(/\r?\n/).filter((line) => !line.trim().startsWith('--')).join(' ');
  assert.doesNotMatch(code, /like/i);
});

// ------------------------------------------------------------------ (f) votes only on live questions

// A small fake of the Supabase query builder over two tables, enough for voteOnLiveQuestion.
function voteDb({ questions = [], votes = [], failOn = null } = {}) {
  const tables = { questions, question_votes: votes };
  const writes = [];
  const from = (name) => {
    const filters = [];
    let op = 'select';
    let payload = null;
    const matches = (row) => filters.every(([c, v]) => row[c] === v);
    const run = () => {
      if (failOn === `${name}.${op}`) return { data: null, error: { message: 'down' } };
      const rows = tables[name];
      if (op === 'select') return { data: rows.filter(matches).map((r) => ({ ...r })), error: null };
      writes.push([name, op, payload, [...filters]]);
      if (op === 'insert') rows.push({ ...payload });
      if (op === 'update') rows.filter(matches).forEach((r) => Object.assign(r, payload));
      if (op === 'delete') tables[name] = rows.filter((r) => !matches(r));
      return { data: null, error: null };
    };
    const q = {
      select: () => q,
      eq: (c, v) => { filters.push([c, v]); return q; },
      insert: (p) => { op = 'insert'; payload = p; return q; },
      update: (p) => { op = 'update'; payload = p; return q; },
      delete: () => { op = 'delete'; return q; },
      maybeSingle: async () => { const r = run(); return { data: Array.isArray(r.data) ? r.data[0] || null : r.data, error: r.error }; },
      then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
    };
    return q;
  };
  return { from, writes, tables };
}

test('votes on pending, rejected, deleted or missing questions are refused before anything is written', async () => {
  const questions = [
    { id: 'pending', status: 'pending', is_deleted: false },
    { id: 'rejected', status: 'rejected', is_deleted: false },
    { id: 'deleted', status: 'live', is_deleted: true },
  ];
  for (const id of ['pending', 'rejected', 'deleted', 'missing']) {
    const db = voteDb({ questions: questions.map((q) => ({ ...q })) });
    await assert.rejects(voteOnLiveQuestion(db, 'u1', id, 'down'), (e) => e instanceof VoteError && e.code === 'question_not_found', id);
    assert.deepEqual(db.writes, [], `${id}: no vote and no score change`);
  }
  assert.equal(isVotableQuestion({ status: 'live', is_deleted: false }), true);
  assert.equal(isVotableQuestion({ status: 'live', is_deleted: null }), true);
  assert.equal(isVotableQuestion({ status: 'pending', verification_state: 'verified', exploration_state: 'active' }), false);
});

test('a vote on a live question is stored and recounted; a failed write is an error, not a 200', async () => {
  const db = voteDb({ questions: [{ id: 'q1', status: 'live', is_deleted: false, score: 0 }], votes: [{ user_id: 'u2', question_id: 'q1', vote_type: 'up' }] });
  assert.deepEqual(await voteOnLiveQuestion(db, 'u1', 'q1', 'down'), { questionId: 'q1', upvotes: 1, downvotes: 1, score: 0, userVote: 'down' });
  assert.deepEqual(await voteOnLiveQuestion(db, 'u1', 'q1', 'up'), { questionId: 'q1', upvotes: 2, downvotes: 0, score: 2, userVote: 'up' });
  assert.deepEqual(await voteOnLiveQuestion(db, 'u1', 'q1', null), { questionId: 'q1', upvotes: 1, downvotes: 0, score: 1, userVote: null });
  assert.equal(db.tables.questions[0].score, 1);
  for (const failOn of ['question_votes.insert', 'questions.update', 'questions.select']) {
    const broken = voteDb({ questions: [{ id: 'q1', status: 'live', is_deleted: false }], failOn });
    await assert.rejects(voteOnLiveQuestion(broken, 'u1', 'q1', 'up'), (e) => e.code === 'vote_unavailable', failOn);
  }
});

test('Database.voteQuestion goes through voteOnLiveQuestion and the route maps a refused vote to 404, rate limited per student', () => {
  const db = read('data/db.js');
  assert.match(db, /async voteQuestion\(userId, questionId, voteType\) \{\s*\/\/[^\n]*\n\s*return voteOnLiveQuestion\(supabaseAdmin\(\), userId, questionId, voteType\);/);
  const route = read('src/app/api/questions/[id]/vote/route.js');
  assert.match(route, /e\?\.code === 'question_not_found'/);
  assert.match(route, /checkPersistentRateLimit\(request, \{ \.\.\.VOTE_LIMIT, keyParts: \[session\.user\.id\]/);
});
