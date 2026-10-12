// Dry run: apply every migration in supabase/migrations, in order, to a throwaway local Postgres
// (PGlite) with minimal Supabase stand-ins, and report which ones apply. Nothing remote is touched.
// Usage: node scripts/dev/dry-run-migrations.mjs [--from=20261012120000] [--bundle=path.sql]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { citext } from '@electric-sql/pglite/contrib/citext';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const dir = new URL('../../supabase/migrations/', import.meta.url);
const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

const db = new PGlite({ extensions: { pgcrypto, uuid_ossp, pg_trgm, citext } });
// Supabase provides these roles, schemas and helpers; the stand-ins let migrations that reference them apply.
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

const results = [];
for (const f of files) {
  const sql = readFileSync(new URL(f, dir), 'utf8');
  try {
    await db.exec(sql);
    results.push({ file: f, ok: true });
  } catch (error) {
    results.push({ file: f, ok: false, error: String(error.message).split('\n')[0] });
    await db.exec('rollback').catch(() => {}); // a failed file can leave its transaction open
  }
}
await db.close();

for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.file}${r.ok ? '' : `  ${r.error}`}`);
if (args.bundle) {
  const from = args.from || '00000000000000';
  const chosen = files.filter(f => f >= from);
  const failed = results.filter(r => !r.ok && r.file >= from);
  if (failed.length) { console.error(`Not bundling: ${failed.length} selected migration(s) failed.`); process.exit(1); }
  const header = `-- MockMob app migrations for the STAGING project only (onwkqxmjqjrhfbjjdydu).\n-- Generated from supabase/migrations, ${chosen.length} files from ${from}, each verified to apply in order\n-- on a local Postgres (PGlite) after all earlier migrations. Additive only. Do not run on production.\n`;
  writeFileSync(args.bundle, header + chosen.map(f => `\n-- ===== ${f} =====\n` + readFileSync(new URL(f, dir), 'utf8')).join('\n'));
  console.log(`Bundled ${chosen.length} migrations into ${args.bundle}`);
}
