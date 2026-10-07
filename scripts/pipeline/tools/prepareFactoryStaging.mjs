import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {uuid_ossp} from '@electric-sql/pglite/contrib/uuid_ossp';
import {pg_trgm} from '@electric-sql/pglite/contrib/pg_trgm';
const directory='artifacts/question-factory/execution-2026-10-07/staging';mkdirSync(directory,{recursive:true});
// The repository's documented TEXT-ID compatibility path is 0001-0004, then
// 0010 onward. 0005-0009 belong to the alternate UUID schema and cannot be replayed.
const files=readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')&&!/^000[5-9]_/.test(f)).sort();
// Empty wallet tables reproduce the production-shaped contract used by the
// existing payment/runtime-AI database suites; no balances or receipts are copied.
const wallet=`CREATE TABLE public.ai_credit_wallets(user_id text primary key references public.users(id) on delete cascade, included_monthly_credits int, included_credits_used int check(included_credits_used>=0), bonus_credits int check(bonus_credits>=0), period_start timestamptz, reset_at timestamptz, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
CREATE TABLE public.ai_credit_ledger(id uuid primary key default gen_random_uuid(), user_id text, amount int, reason text check (reason = any(array['monthly_grant','pack_purchase','admin_adjustment','ai_spend','expiry'])), feature text, reference text, metadata jsonb, expires_at timestamptz, created_at timestamptz default now(), wallet_source text check (wallet_source = any(array['included','bonus','mixed','grant','adjustment','none'])), balance_after int, idempotency_key text);
ALTER TABLE public.ai_credit_wallets ENABLE ROW LEVEL SECURITY;ALTER TABLE public.ai_credit_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_credit_wallets,public.ai_credit_ledger FROM anon,authenticated;GRANT ALL ON public.ai_credit_wallets,public.ai_credit_ledger TO service_role;\n`;
const migration=file=>(file==='0038_ai_credit_purchase_grant_rpc.sql'?wallet:'')+readFileSync('supabase/migrations/'+file,'utf8').replace(/question_id\s+UUID\s+NOT NULL REFERENCES public.questions\(id\)/g,'question_id TEXT NOT NULL REFERENCES public.questions(id)');
const sql=files.map(f=>`-- BEGIN ${f}\n${migration(f)}\n-- END ${f}\n`).join('\n');
const safety=`-- EMPTY SEPARATE STAGING ONLY: onwkqxmjqjrhfbjjdydu. NEVER apply to production.\nDO $$ BEGIN IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users') THEN RAISE EXCEPTION 'empty staging project required'; END IF; END $$;\nCREATE EXTENSION IF NOT EXISTS "uuid-ossp";\nCREATE EXTENSION IF NOT EXISTS pg_trgm;\nCREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;\n`;
writeFileSync(directory+'/bootstrap.sql',safety+sql);
writeFileSync('.env.staging.example','STAGING_SUPABASE_URL=https://onwkqxmjqjrhfbjjdydu.supabase.co\nSTAGING_SUPABASE_ANON_KEY=\nSTAGING_SUPABASE_SERVICE_ROLE_KEY=\n');
const db=new PGlite({extensions:{uuid_ossp,pg_trgm}}),results=[];
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create function auth.uid() returns uuid language sql as $$ select null::uuid $$;`);
 await db.exec(safety);
 for(const file of files){try{await db.exec(migration(file).replace(/create extension if not exists pgcrypto;/ig,''));results.push({file,passed:true});}catch(e){results.push({file,passed:false,error:e.message});throw e;}}
 const counts=(await db.query('select count(*)::int as n from public.questions')).rows[0].n;if(counts!==0)throw Error('bootstrap_must_not_seed_questions');
 console.log(JSON.stringify({passed:true,migrations:results.length,questions:counts,production_writes:0}));
}catch(e){console.error(JSON.stringify({passed:false,error:e.message,failed_migration:results.at(-1)?.file}));process.exitCode=1;}
finally{writeFileSync(directory+'/dry-run.json',JSON.stringify({at:new Date().toISOString(),target:'onwkqxmjqjrhfbjjdydu',bootstrap_sha256:createHash('sha256').update(safety+sql).digest('hex'),results,production_writes:0},null,2));await db.close();}
