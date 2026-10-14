// Builds the ONE production SQL file for the app backend release, plus a read-only staging check,
// and dry-runs the bundle on a throwaway local Postgres (PGlite). Nothing remote is touched.
//
// Usage:
//   node scripts/dev/production-app-sql.mjs --out=../PRODUCTION-app-backend-2026-10-13.sql \
//     --staging-out=../STAGING-app-backend-check-2026-10-13.sql [--dry-run]
//
// Dry run: replays the migration history production already has (every file in supabase/migrations
// except the app files below and the unapplied auth guard), then applies the bundle twice (it must be
// idempotent), then runs the verification query and the backlog query. A second scenario repeats it
// without the inventory snapshot table, in case production never created it.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { citext } from '@electric-sql/pglite/contrib/citext';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const dir = new URL('../../supabase/migrations/', import.meta.url);
const read = f => readFileSync(new URL(f, dir), 'utf8');

// In order. The inventory snapshot is already used by the live site; it is repeated here because
// it is idempotent and the site falls back to slow inline counting when the table is missing.
export const BUNDLE = [
  '20261012120000_usage_consent_and_events.sql',
  '20261012121000_app_preferences_and_rhythm.sql',
  '20261013090000_study_goal_history.sql',
  '20261013093000_sample_imports.sql',
  '20261013094000_session_finaliser.sql',
  '20261013095000_session_check_log.sql',
  '20261013120000_deletion_processor.sql',
  '20261013130000_inventory_snapshot.sql',
  '20261013170000_app_service_role_grants.sql',
];
const NOT_IN_PRODUCTION = new Set([...BUNDLE.filter(f => f !== '20261013130000_inventory_snapshot.sql'), '20261013150000_auth_unconfirmed_passwords.sql']);

const PREFLIGHT = `-- Preflight: stop before any change if the tables these migrations build on are missing.
do $preflight$
declare missing text[] := '{}'; t text;
begin
  foreach t in array array['users','attempts','recovery_sessions','recovery_review_queue','user_question_progress'] loop
    if to_regclass('public.' || t) is null then missing := missing || t; end if;
  end loop;
  if array_length(missing, 1) > 0 then
    raise exception 'MockMob app backend: missing prerequisite tables %. Nothing was changed.', missing;
  end if;
  if (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'id') <> 'text' then
    raise exception 'MockMob app backend: public.users.id is not text. Nothing was changed.';
  end if;
  if not exists (
    select 1 from pg_index i
     where i.indrelid = 'public.user_question_progress'::regclass and (i.indisunique or i.indisprimary)
       and (select array_agg(a.attname::text order by a.attname) from pg_attribute a
             where a.attrelid = i.indrelid and a.attnum = any(i.indkey)) = array['question_id','user_id']
  ) then
    raise exception 'MockMob app backend: user_question_progress has no unique (user_id, question_id). Nothing was changed.';
  end if;
end $preflight$;`;

const TABLES = ['usage_consent', 'usage_events', 'notification_prefs', 'push_devices', 'study_goals', 'study_goal_history',
  'account_deletion_requests', 'sample_imports', 'session_check_log', 'public_inventory_snapshot'];
const FUNCTIONS = ['public.insert_usage_events(text,jsonb)', 'public.purge_usage_events(integer)',
  'public.save_sample_import(text,text,text,text,jsonb,integer,integer)', 'public.finalise_expired_recovery_session(text,jsonb)',
  'public.quarantine_recovery_session(text,text,integer)', 'public.account_deletion_run(bigint,text,jsonb,boolean)'];
const list = xs => xs.map(x => `'${x}'`).join(', ');

// Read-only. Every row must say ok = true.
export const VERIFY = `select kind, name, present, rls_on, service_role_ok, anon_blocked, authenticated_blocked,
       present and coalesce(rls_on, true) and coalesce(service_role_ok, true)
         and coalesce(anon_blocked, true) and coalesce(authenticated_blocked, true) as ok
from (
  select 'table' as kind, t as name, to_regclass('public.' || t) is not null as present,
    (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.' || t)) as rls_on,
    case when to_regclass('public.' || t) is null then null else
      has_table_privilege('service_role', to_regclass('public.' || t), 'SELECT') and has_table_privilege('service_role', to_regclass('public.' || t), 'INSERT') end as service_role_ok,
    case when to_regclass('public.' || t) is null then null else
      not has_table_privilege('anon', to_regclass('public.' || t), 'SELECT,INSERT,UPDATE,DELETE') end as anon_blocked,
    case when to_regclass('public.' || t) is null then null else
      not has_table_privilege('authenticated', to_regclass('public.' || t), 'SELECT,INSERT,UPDATE,DELETE') end as authenticated_blocked
  from unnest(array[${list(TABLES)}]) as t
  union all
  select 'function', f, to_regprocedure(f) is not null, null,
    case when to_regprocedure(f) is null then null else has_function_privilege('service_role', to_regprocedure(f), 'EXECUTE') end,
    case when to_regprocedure(f) is null then null else not has_function_privilege('anon', to_regprocedure(f), 'EXECUTE') end,
    case when to_regprocedure(f) is null then null else not has_function_privilege('authenticated', to_regprocedure(f), 'EXECUTE') end
  from unnest(array[${list(FUNCTIONS)}]) as f
  union all
  select 'column', 'users.deleted_at',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'deleted_at'),
    null, null, null, null
) checks
order by ok, kind, name;`;

// Read-only. Expired sessions still marked active. Only those that expired on or after the floor in
// src/lib/server/sessionFinaliser.js (2026-10-13 00:00 UTC, or SESSION_FINALISE_FROM) become results.
export const BACKLOG = `select count(*) as expired_active_sessions,
       count(*) filter (where expires_at >= timestamptz '2026-10-13 00:00:00+00') as will_be_finalised,
       count(*) filter (where expires_at >= timestamptz '2026-10-13 00:00:00+00'
         and not exists (select 1 from jsonb_array_elements(events) e where e->>'type' = 'answer')) as of_which_have_no_answers,
       min(expires_at) as oldest_expiry
from public.recovery_sessions
where state = 'active' and expires_at < now() - interval '2 minutes';`;

const sha = s => createHash('sha256').update(s).digest('hex').slice(0, 12);

export function buildProductionSql() {
  const header = [
    '-- MockMob: app backend release, PRODUCTION database (Supabase project isrxrxzjocewrdureyhp).',
    '-- Built by scripts/dev/production-app-sql.mjs on branch release/app-backend, 13 October 2026.',
    '-- Run it ONCE in the Supabase SQL editor, as a whole, BEFORE pushing release/app-backend to main.',
    '-- One transaction: if any statement fails, nothing is changed. Additive and idempotent: running',
    '-- it again is safe. It creates tables and functions only; it does not change or delete existing rows',
    '-- (deletes appear only inside function bodies, which run when the server calls them).',
    '-- The same files were applied to staging (onwkqxmjqjrhfbjjdydu) on 12-13 October 2026, except the last',
    '-- one (explicit service-role grants), which only states what Supabase defaults already grant.',
    '--',
    '-- Contents, in order (sha256 prefix of each source file):',
    ...BUNDLE.map((f, i) => `--   ${i + 1}. supabase/migrations/${f}  [${sha(read(f))}]`),
    '--',
    '-- Not included: 20261013150000_auth_unconfirmed_passwords.sql (optional sign-in hardening, separate).',
    '-- A full run ends with the verification query: every row must show ok = true.',
    '',
  ].join('\n');
  const body = BUNDLE.map((f, i) => `\n-- ===== ${i + 1}. ${f} =====\n${read(f).trimEnd()}\n`).join('');
  return `${header}\nbegin;\n\n${PREFLIGHT}\n${body}\ncommit;\n\n` +
    `-- ===== Backlog (read-only) =====\n-- Expired sessions still open. will_be_finalised counts those the deadline finaliser will turn into\n-- results after the push (it never touches sessions that expired before 2026-10-13 00:00 UTC).\n-- The SQL editor shows only the last result: select this query and run it on its own to see it.\n${BACKLOG}\n\n` +
    `-- ===== Verification (read-only; last, so a full run shows it) =====\n-- Every row must show ok = true.\n${VERIFY}\n`;
}

export function buildStagingCheck() {
  return ['-- MockMob: app backend release, STAGING check (Supabase project onwkqxmjqjrhfbjjdydu). Read-only.',
    '-- Run in the staging SQL editor. Every row must show ok = true. It is the same verification query',
    '-- that ends PRODUCTION-app-backend-2026-10-13.sql, so staging and production can be compared row for row.',
    '-- If the explicit grants file (20261013170000_app_service_role_grants.sql) was never run on staging,',
    '-- service_role_ok still shows true there through Supabase default privileges.',
    '', VERIFY, ''].join('\n');
}

async function freshDb() {
  const db = new PGlite({ extensions: { pgcrypto, uuid_ossp, pg_trgm, citext } });
  await db.exec(`
    do $$ begin
      if not exists (select from pg_roles where rolname='anon') then create role anon; end if;
      if not exists (select from pg_roles where rolname='authenticated') then create role authenticated; end if;
      if not exists (select from pg_roles where rolname='service_role') then create role service_role; end if;
    end $$;
    create schema if not exists auth;
    create table if not exists auth.users (id uuid primary key, email text);
    create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create or replace function auth.role() returns text language sql stable as $$ select 'service_role'::text $$;
    create schema if not exists extensions;
  `);
  return db;
}

async function scenario(label, history, bundle) {
  const db = await freshDb();
  const replay = { ok: 0, failed: 0 };
  for (const f of history) {
    try { await db.exec(read(f)); replay.ok++; } catch { replay.failed++; await db.exec('rollback').catch(() => {}); }
  }
  const out = { label, replay, runs: [] };
  for (const run of [1, 2]) {
    try { await db.exec(bundle); out.runs.push('ok'); }
    catch (error) { out.runs.push(`FAIL ${String(error.message).split('\n')[0]}`); await db.exec('rollback').catch(() => {}); }
  }
  out.verify = (await db.query(VERIFY)).rows;
  out.backlog = await db.query(BACKLOG).then(r => r.rows[0], e => `not run: ${String(e.message).split('\n')[0]}`);
  await db.close();
  return out;
}

// Main.
{
  const sql = buildProductionSql();
  if (args.out) { writeFileSync(args.out, sql); console.log(`Wrote ${args.out}`); }
  if (args['staging-out']) { writeFileSync(args['staging-out'], buildStagingCheck()); console.log(`Wrote ${args['staging-out']}`); }
  if ('dry-run' in args) {
    const all = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
    const history = all.filter(f => !NOT_IN_PRODUCTION.has(f));
    const results = [
      await scenario('production history (with inventory snapshot)', history, sql),
      await scenario('production history (without inventory snapshot)', history.filter(f => f !== '20261013130000_inventory_snapshot.sql'), sql),
    ];
    // Negative control: without the recovery tables the preflight must stop the bundle and change nothing.
    const control = await scenario('negative control (only 0001_init.sql)', ['0001_init.sql'], sql);
    const controlOk = control.runs.every(x => /missing prerequisite tables/.test(x)) && control.verify.every(row => !row.present);
    console.log(`negative control: bundle ${control.runs[0]}; nothing created: ${controlOk}`);
    let failed = !controlOk;
    for (const r of results) {
      const bad = r.verify.filter(row => !row.ok);
      if (r.runs.some(x => x !== 'ok') || bad.length) failed = true;
      console.log(`\n${r.label}: history replayed ${r.replay.ok} ok, ${r.replay.failed} not replayable locally`);
      console.log(`  bundle run 1: ${r.runs[0]}; run 2 (idempotency): ${r.runs[1]}`);
      console.log(`  verification: ${r.verify.length - bad.length}/${r.verify.length} rows ok${bad.length ? `; not ok: ${bad.map(b => b.name).join(', ')}` : ''}`);
      console.log(`  backlog query ran: ${JSON.stringify(r.backlog)}`);
    }
    process.exitCode = failed ? 1 : 0;
  }
}
