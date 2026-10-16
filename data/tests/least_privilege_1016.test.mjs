// Health audit 16 Oct 2026, finding 5: least privilege for the browser roles.
//  - the caller audit that makes the revoke safe is kept as a test (no browser-side data access, anywhere),
//  - the four migrations (170000 grants and ten functions, 170200 staging drift, 170300 search_path, 170400 payments policy)
//    run for real on an in-process Postgres shaped like production, in apply order, twice, then undone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const ROOT = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), 'utf8');
const MIGRATIONS = [
  'supabase/migrations/20261016170000_browser_roles_least_privilege.sql',
  'supabase/migrations/20261016170200_server_only_functions_drift.sql',
  'supabase/migrations/20261016170300_function_search_path.sql',
  'supabase/migrations/20261016170400_payments_policy_initplan.sql',
];
const UNDOS = [
  'supabase/undo/20261016170400_payments_policy_initplan.undo.sql',
  'supabase/undo/20261016170300_function_search_path.undo.sql',
  'supabase/undo/20261016170200_server_only_functions_drift.undo.sql',
  'supabase/undo/20261016170000_browser_roles_least_privilege.undo.sql',
];

// ------------------------------------------------------------------ the caller audit, kept as a guard

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|jsx|ts|tsx|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

test('no browser-side code reads or writes a table, calls an rpc, or uses storage or realtime with the public key', () => {
  const srcDir = new URL('src/', ROOT).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const files = walk(decodeURIComponent(srcDir));
  const browserFiles = files.filter((f) => /^\s*['"]use client['"]/m.test(readFileSync(f, 'utf8')) || /supabase-browser/.test(readFileSync(f, 'utf8')));
  assert.ok(browserFiles.length > 20, 'the audit sees the client components');
  const offenders = [];
  for (const f of browserFiles) {
    const text = readFileSync(f, 'utf8');
    if (!/supabase/i.test(text) && !/createBrowserClient/.test(text)) continue;
    if (/\b(supabase|sb|client)\s*\.\s*(from|rpc|storage|channel)\s*\(/.test(text) || /\.realtime\b/.test(text)) offenders.push(relative(decodeURIComponent(srcDir), f));
  }
  assert.deepEqual(offenders, [], 'client code must only call supabase.auth.*');
});

test('the browser client module and its two callers use only supabase.auth.*', () => {
  for (const path of ['src/lib/supabase-browser.js', 'src/components/AuthProvider.jsx', 'src/app/auth/callback/AuthCallbackPageClient.jsx']) {
    const text = read(path);
    const calls = [...text.matchAll(/\bsupabase\s*\.\s*([a-zA-Z_]+)\b/g)].map((m) => m[1]);
    assert.ok(calls.length > 0, `${path} uses the client`);
    assert.deepEqual([...new Set(calls)].filter((c) => c !== 'auth'), [], `${path} calls only .auth`);
  }
});

test('the server-side anon-key clients (proxy, session helpers) never touch tables', () => {
  for (const path of ['src/proxy.js', 'src/lib/auth.ts', 'src/lib/server/cookieSession.js', 'src/lib/server/sessionProxy.js']) {
    const text = read(path);
    assert.doesNotMatch(text, /\.(from|rpc)\(\s*['"`]/, `${path} makes no table or rpc call`);
  }
});

test('every server table and rpc call in src goes through the service-role client', () => {
  const lib = read('src/lib/supabase.js');
  assert.match(lib, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(lib, /export const supabase = new Proxy/, 'the legacy `supabase` export forwards to the admin client');
  assert.doesNotMatch(lib, /ANON_KEY/, 'no anon-key data client exists on the server');
});

test('the Capacitor shell uses the public key for auth only (the Flutter app was audited by hand: only Supabase.instance.client.auth)', () => {
  const mobile = read('mobile/src/main.jsx');
  const calls = [...mobile.matchAll(/\bsupabase\s*\.\s*([a-zA-Z_]+)\b/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(calls)].filter((c) => c !== 'auth'), []);
});

// ------------------------------------------------------------------ the migrations, run for real

const NO_POLICY_TABLES = ['users', 'attempts', 'ai_credit_wallets', 'mentor_messages', 'moderation_jobs', 'question_scores', 'webhook_events', 'study_runs'];
const BROWSER_READ = ['chapters', 'units'];
const TEN = [
  'apply_question_vote(text, text, question_vote_type)',
  'apply_question_vote(uuid, uuid, text)',
  'claim_moderation_job(text)',
  'count_distinct_mock_sessions(text, timestamptz)',
  'create_pending_payout(text, text)',
  'enforce_admin_role()',
  'link_user_to_creator()',
  'recover_stale_moderation_jobs(integer)',
  'set_updated_at()',
  'sync_question_scores_metadata()',
];
const ALREADY_CLOSED = [
  'grant_attempt_answer_credits(text, text, jsonb)',
  'grant_contribution_credits(text, text, text)',
  'grant_daily_login_credits(text)',
  'moderate_question_with_credit(text, text)',
  'save_sample_import(text, text, text, text, jsonb, integer, integer)',
  'spend_credits(text, text, text)',
];
const STAGING_ONLY = [
  'mm_ai_consume_credits(text, integer, text, text, text, integer, timestamptz, timestamptz, jsonb)',
  'link_creator_role()',
];
const TRIGGER_FNS = new Set(['enforce_admin_role', 'link_user_to_creator', 'set_updated_at', 'sync_question_scores_metadata', 'link_creator_role']);

const fnName = (sig) => sig.slice(0, sig.indexOf('('));
const fnArgs = (sig) => sig.slice(sig.indexOf('(') + 1, -1);

async function createFunction(pg, sig, { secdef = false, config = null } = {}) {
  const name = fnName(sig);
  const args = fnArgs(sig);
  const params = args ? args.split(',').map((a, i) => `p${i} ${a.trim()}`).join(', ') : '';
  const trigger = TRIGGER_FNS.has(name);
  const body = trigger ? 'begin return new; end' : 'begin return 1; end';
  await pg.exec(`create function public.${name}(${params}) returns ${trigger ? 'trigger' : 'int'} language plpgsql ${secdef ? 'security definer' : ''} ${config ? `set search_path = ${config}` : ''} as $f$ ${body} $f$;`);
}

/** Public schema shaped like staging plus production: default grants on 23-ish tables, three policies, 33 functions. */
async function database({ withStagingFunctions = true } = {}) {
  const pg = new PGlite();
  await pg.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    create type question_vote_type as enum ('up','down');
  `);
  for (const t of NO_POLICY_TABLES) {
    await pg.exec(`create table public.${t} (id text primary key); alter table public.${t} enable row level security; grant all on public.${t} to service_role;`);
    if (t !== 'webhook_events' && t !== 'study_runs') await pg.exec(`grant all on public.${t} to anon, authenticated;`);
  }
  for (const t of BROWSER_READ) {
    await pg.exec(`create table public.${t} (id text primary key); alter table public.${t} enable row level security; grant all on public.${t} to service_role, anon, authenticated;`);
    await pg.exec(`create policy ${t}_read on public.${t} for select to anon, authenticated using (true);`);
  }
  await pg.exec(`
    create table public.payments (id text primary key, user_id text not null, amount int);
    alter table public.payments enable row level security;
    grant all on public.payments to service_role; grant select on public.payments to authenticated;
    create policy "Users can read their own payments" on public.payments for select to authenticated using (user_id = (auth.uid())::text);
    insert into public.payments values ('p1', '00000000-0000-0000-0000-000000000001', 100), ('p2', '00000000-0000-0000-0000-000000000002', 200);
  `);
  for (const sig of [...TEN, ...ALREADY_CLOSED]) await createFunction(pg, sig);
  for (const sig of ALREADY_CLOSED) await pg.exec(`revoke execute on function public.${sig} from public, anon, authenticated; grant execute on function public.${sig} to service_role;`);
  if (withStagingFunctions) {
    await createFunction(pg, STAGING_ONLY[0], { secdef: true, config: 'public' });
    await createFunction(pg, STAGING_ONLY[1]);
  }
  // an already-pinned function that must survive the undo untouched
  await pg.exec(`create function public.account_deletion_run() returns int language sql set search_path = public, pg_temp as $f$ select 1 $f$;`);
  await pg.exec(`revoke execute on function public.account_deletion_run() from public, anon, authenticated; grant execute on function public.account_deletion_run() to service_role;`);
  return pg;
}

const tablePriv = async (pg, role, table, priv) => (await pg.query(`select has_table_privilege('${role}','public.${table}','${priv}') as ok`)).rows[0].ok;
const fnPriv = async (pg, role, sig) => (await pg.query(`select has_function_privilege('${role}','public.${sig}','execute') as ok`)).rows[0].ok;
const config = async (pg, sig) => (await pg.query(`select proconfig from pg_proc where oid = to_regprocedure('public.${sig}')`)).rows[0].proconfig;
const policyQual = async (pg) => (await pg.query(`select qual, roles::text r, cmd from pg_policies where tablename='payments'`)).rows[0];

test('before the migrations: the weaknesses exist as reported', async () => {
  const pg = await database();
  assert.equal(await tablePriv(pg, 'anon', 'users', 'select'), true);
  assert.equal(await fnPriv(pg, 'anon', 'create_pending_payout(text, text)'), true);
  assert.equal(await fnPriv(pg, 'anon', STAGING_ONLY[0]), true);
  assert.equal(await config(pg, 'create_pending_payout(text, text)'), null);
  assert.doesNotMatch((await policyQual(pg)).qual, /SELECT auth\.uid/i);
  await pg.close();
});

test('the four migrations, in order and twice over, close the browser roles and keep every server path', async () => {
  const pg = await database();
  for (let round = 0; round < 2; round++) for (const m of MIGRATIONS) await pg.exec(read(m));

  // 5a: tables
  for (const t of NO_POLICY_TABLES) {
    for (const role of ['anon', 'authenticated']) for (const priv of ['select', 'insert', 'update', 'delete', 'truncate']) {
      assert.equal(await tablePriv(pg, role, t, priv), false, `${role} has no ${priv} on ${t}`);
    }
    assert.equal(await tablePriv(pg, 'service_role', t, 'select'), true);
    assert.equal(await tablePriv(pg, 'service_role', t, 'update'), true);
  }
  for (const t of BROWSER_READ) for (const role of ['anon', 'authenticated']) {
    assert.equal(await tablePriv(pg, role, t, 'select'), true, `${role} still reads ${t}`);
    for (const priv of ['insert', 'update', 'delete', 'truncate']) assert.equal(await tablePriv(pg, role, t, priv), false);
  }
  assert.equal(await tablePriv(pg, 'authenticated', 'payments', 'select'), true);
  assert.equal(await tablePriv(pg, 'anon', 'payments', 'select'), false);

  // 5b: functions, the ten plus the staging drift
  for (const sig of [...TEN, ...STAGING_ONLY, ...ALREADY_CLOSED]) {
    assert.equal(await fnPriv(pg, 'anon', sig), false, `anon cannot run ${sig}`);
    assert.equal(await fnPriv(pg, 'authenticated', sig), false, `authenticated cannot run ${sig}`);
    assert.equal(await fnPriv(pg, 'service_role', sig), true, `service_role still runs ${sig}`);
  }

  // 5c: search_path pinned on all 16 production functions (+ the staging trigger function)
  for (const sig of [...TEN, ...ALREADY_CLOSED, 'link_creator_role()']) {
    assert.deepEqual(await config(pg, sig), ['search_path=public, pg_temp'], `${sig} has a fixed search_path`);
  }
  assert.deepEqual(await config(pg, STAGING_ONLY[0]), ['search_path=public'], 'a function that already had one is left alone');

  // 5d: the payments policy keeps its roles and command and evaluates auth.uid() once
  const pol = await policyQual(pg);
  assert.match(pol.qual, /SELECT auth\.uid\(\)/i);
  assert.equal(pol.cmd, 'SELECT');
  assert.match(pol.r, /authenticated/);
  assert.doesNotMatch(pol.r, /anon/);
  await pg.close();
});

test('after the migrations the server still works (service_role) and the policy still scopes a student to their own payments', async () => {
  const pg = await database();
  for (const m of MIGRATIONS) await pg.exec(read(m));

  await pg.exec(`set role service_role; insert into public.users (id) values ('u1'); update public.users set id = 'u2' where id = 'u1'; reset role;`);
  assert.equal((await pg.query('select count(*)::int n from public.users')).rows[0].n, 1);
  // search_path pinned functions still run and still resolve their tables
  await pg.exec(`create function public.uses_public() returns int language sql set search_path = public, pg_temp as $f$ select count(*)::int from users $f$;`);
  await pg.exec(`set role service_role; select public.claim_moderation_job('w'); select public.create_pending_payout('c','a'); select public.mm_ai_consume_credits('u',1,'a','b','c',1,now(),now(),'{}'::jsonb); reset role;`);

  await assert.rejects(pg.exec(`set role anon; select * from public.users;`), /permission denied/);
  await pg.exec('reset role');
  await assert.rejects(pg.exec(`set role authenticated; select public.create_pending_payout('c','a');`), /permission denied/);
  await pg.exec('reset role');
  await assert.rejects(pg.exec(`set role anon; select public.mm_ai_consume_credits('u',1,'a','b','c',1,now(),now(),'{}'::jsonb);`), /permission denied/);
  await pg.exec('reset role');
  await pg.exec(`set role anon; select * from public.chapters; reset role;`);

  // the own-rows read: student 1 sees p1 only; with no sub they see nothing; anon is refused
  await pg.exec(`set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001', false);`);
  assert.deepEqual((await pg.query('select id from public.payments order by id')).rows.map((r) => r.id), ['p1']);
  await pg.exec(`select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002', false);`);
  assert.deepEqual((await pg.query('select id from public.payments order by id')).rows.map((r) => r.id), ['p2']);
  await pg.exec(`select set_config('request.jwt.claim.sub','', false);`);
  assert.deepEqual((await pg.query('select id from public.payments')).rows, []);
  await pg.exec('reset role');
  await assert.rejects(pg.exec(`set role anon; select * from public.payments;`), /permission denied/);
  await pg.close();
});

test('trigger functions keep firing for service_role writes without any EXECUTE grant to the writer', async () => {
  const pg = await database();
  await pg.exec(`alter table public.attempts add column updated_at timestamptz;`);
  await pg.exec(`create or replace function public.set_updated_at() returns trigger language plpgsql as $f$ begin new.updated_at = now(); return new; end $f$;`);
  await pg.exec(`drop trigger if exists trg on public.attempts; create trigger trg before insert on public.attempts for each row execute function public.set_updated_at();`);
  for (const m of MIGRATIONS) await pg.exec(read(m));
  await pg.exec(`set role service_role; insert into public.attempts (id) values ('a1'); reset role;`);
  assert.notEqual((await pg.query(`select updated_at from public.attempts where id='a1'`)).rows[0].updated_at, null);
  await pg.close();
});

test('the undo files, run in reverse, restore the old state and leave unrelated functions alone', async () => {
  const pg = await database();
  for (const m of MIGRATIONS) await pg.exec(read(m));
  for (const u of UNDOS) await pg.exec(read(u));

  for (const t of ['users', 'attempts', 'chapters', 'units']) {
    assert.equal(await tablePriv(pg, 'anon', t, 'select'), true, `${t} select restored`);
    assert.equal(await tablePriv(pg, 'authenticated', t, 'update'), true, `${t} update restored`);
  }
  for (const sig of [...TEN, ...STAGING_ONLY]) {
    assert.equal(await fnPriv(pg, 'anon', sig), true, `${sig} executable again`);
    assert.equal(await fnPriv(pg, 'authenticated', sig), true);
  }
  for (const sig of [...TEN, ...ALREADY_CLOSED, 'link_creator_role()']) assert.equal(await config(pg, sig), null, `${sig} search_path reset`);
  assert.deepEqual(await config(pg, STAGING_ONLY[0]), ['search_path=public'], 'the function that had its own search_path keeps it');
  assert.deepEqual(await config(pg, 'account_deletion_run()'), ['search_path=public, pg_temp'], 'an unrelated pinned function is untouched');
  // the functions that production already had closed stay closed after the undo
  for (const sig of ALREADY_CLOSED) assert.equal(await fnPriv(pg, 'anon', sig), false, `${sig} was closed before and stays closed`);
  assert.doesNotMatch((await policyQual(pg)).qual, /SELECT auth\.uid/i);
  await pg.close();
});

test('a database without the staging-only functions and without payments migrates cleanly (production shape)', async () => {
  const pg = await database({ withStagingFunctions: false });
  await pg.exec('drop policy "Users can read their own payments" on public.payments');
  for (const m of MIGRATIONS) await pg.exec(read(m));
  for (const sig of TEN) assert.equal(await fnPriv(pg, 'anon', sig), false);
  await pg.close();
});
