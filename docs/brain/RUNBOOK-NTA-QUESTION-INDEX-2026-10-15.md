# Runbook: nta_question_index (usage fix A6)

15 Oct 2026. Source: `docs/brain/USAGE-LIMITS-DIAGNOSIS-2026-10-15.md` row A6. Allowed under the owner's
standing database grant (14 Oct). Production is `isrxrxzjocewrdureyhp`; staging is `onwkqxmjqjrhfbjjdydu`.

## What it does

NTA papers read one subject's pool through `nta_question_index`: signed slim rows (score, judges, content
hash, family, objective tag) plus the questions without their `evidence` column, instead of every column of
the subject. About 0.27-0.36 MB a start instead of 5.3-6.6 MB (`docs/brain/NTA-ENGINE-RUN.md`). The runtime
re-checks each row's HMAC signature (`CUET_EVIDENCE_SIGNING_KEY`) and that the question's content hash is
unchanged, so the index cannot admit a question the full read would refuse. The score bar (`NTA_MIN_SCORE`)
is applied at runtime; moving it needs no rebuild. The engine itself (`data/nta_engine.js`) is unchanged.

## Files

- Migration (create): `supabase/migrations/20261013190000_nta_question_index.sql`
- Undo (drop): `supabase/undo/20261013190000_nta_question_index.undo.sql` (outside `migrations/` on purpose)
- Index builder: `scripts/nta-index-build.mjs` (dry run by default; `--write` upserts; production also needs `--allow-production`)

## Safe order

1. Apply the migration. It adds an empty table: no behaviour change, because `loadNtaPoolFromIndex` returns null
   for a missing OR empty subject and the full read runs as before.
2. Build the index for each subject (reads the questions with their evidence, select only; writes only
   `nta_question_index`). From this moment NTA starts read the slim path.
3. Rebuild after any change to a question's content or evidence (a stale row is refused at runtime by the
   content-hash check and the question simply falls out of the pool until rebuilt) and after the signing key
   rotates. The build removes a subject's rows that no longer verify.

## Apply and verify (production)

Use the Supabase MCP `apply_migration` with name `nta_question_index` and the SQL of the migration file, or
`supabase db push` if the CLI is linked to production. Then verify with `execute_sql`:

```sql
select c.relrowsecurity as rls,
       (select count(*) from pg_indexes where tablename = 'nta_question_index') as indexes,
       (select string_agg(grantee || ':' || privilege_type, ',' order by grantee, privilege_type)
          from information_schema.role_table_grants
         where table_schema = 'public' and table_name = 'nta_question_index'
           and grantee in ('anon', 'authenticated', 'public')) as non_service_grants,
       (select count(*) from public.nta_question_index) as rows
from pg_class c where c.oid = 'public.nta_question_index'::regclass;
```

Expected: `rls = true`, `indexes = 2`, `non_service_grants = null`, `rows = 0`.

Build the rows from a machine that has the production service-role key and `CUET_EVIDENCE_SIGNING_KEY` in its
environment (never paste either into chat or a file). Dry run first, then write:

```
node --use-system-ca scripts/nta-index-build.mjs --env .env.local --out tmp/nta-index-prod-dry-run.json
node --use-system-ca scripts/nta-index-build.mjs --env .env.local --write --allow-production
```

The dry run prints, per subject, `loaded`, `indexed`, the full and slim byte counts and the reasons rows were
rejected. Expect `indexed` to match the number of questions whose evidence passes the NTA score checks, and
the slim bytes to be under about 0.4 MB. The write reads every NTA subject's full pool once (about 20-40 MB of
egress, one time).

Verify the write:

```sql
select subject, count(*) as rows, min(score) as min_score, max(verified_at) as built_at
from public.nta_question_index group by subject order by subject;
```

then start one NTA paper per subject from a test account and check the server log line `[nta-engine]`: its
`timings.poolSource` should read `index` (not `full`), and `pool.loaded` should equal the subject's index rows plus agent-scored
rows.

## Undo

Run `supabase/undo/20261013190000_nta_question_index.undo.sql` (`drop table if exists public.nta_question_index;`).
NTA mode returns to the full read at once (Postgres 42P01 or PostgREST PGRST205 means "no index"). Nothing else
depends on the table. To keep the table but turn the slim read off, `truncate public.nta_question_index;`.
