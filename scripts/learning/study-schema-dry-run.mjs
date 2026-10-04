import { PGlite } from '@electric-sql/pglite';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
const files=['20261001105920_score_recovery_foundations.sql','20261002120000_connected_learning.sql','20261004154217_connected_study_suite.sql','20261004172214_study_review_backlog.sql'];
const db=new PGlite();
try {
  const bootstrap=`create role anon;create role authenticated;create role service_role bypassrls;
    create table users(id text primary key,credit_balance int,is_premium boolean,premium_until timestamptz);
    create table questions(id text primary key,subject text,chapter text,body text,options jsonb,correct_answer text,correct_index int,explanation text,status text,verification_state text);
    create table attempts(id text primary key,user_id text,subject text,score int,correct int,wrong int,unattempted int,total int,details jsonb,questions_snapshot jsonb,selection_meta jsonb);
    create table user_question_progress(user_id text,question_id text,subject text,chapter text,seen_count int default 0,attempt_count int default 0,correct_count int default 0,skip_count int default 0,last_selected_key text,last_correct boolean,last_seen_at timestamptz,last_attempted_at timestamptz,updated_at timestamptz,primary key(user_id,question_id));
    create table question_interactions(user_id text,question_id text);create table question_bookmarks(user_id text,question_id text);
    create table credit_transactions(user_id text,amount int,type text,reference text,action text,credit_delta int);
    create table passage_groups(id text primary key,passage_text text);
    create function public.spend_credits(text,text,text) returns boolean language sql as 'select false';
    insert into users values('dry-run',40,true,now()+interval '1 month');insert into questions(id,body,correct_answer) values('existing-question','Existing bank item','A');`;
  await db.exec(bootstrap);
  for(const file of files)await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
  const imports=JSON.parse(readFileSync('artifacts/study-suite/content-import-dry-run.json','utf8'));
  for(const unit of imports.units)await db.query('insert into study_units select * from jsonb_populate_record(null::study_units,$1)',[unit]);
  for(const card of imports.cards)await db.query('insert into study_cards select * from jsonb_populate_record(null::study_cards,$1)',[card]);
  const tables=(await db.query("select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'study_%' and c.relkind='r' order by c.relname")).rows;
  const grants=(await db.query("select table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and table_name like 'study_%' order by table_name,grantee,privilege_type")).rows;
  if(tables.length!==6 || tables.some(t=>!t.relrowsecurity) || grants.some(g=>['anon','authenticated','PUBLIC'].includes(g.grantee)))throw new Error('SERVICE_ONLY_SCHEMA_FAILED');
  const owner=(await db.query("select credit_balance,is_premium from users where id='dry-run'")).rows[0];
  if(owner.credit_balance!==40 || !owner.is_premium || (await db.query('select count(*)::int n from questions')).rows[0].n!==1)throw new Error('EXISTING_DATA_CHANGED');
  mkdirSync('artifacts/study-suite',{recursive:true});
  const report={at:new Date().toISOString(),state:'passed',scope:'isolated PGlite schema and content-import dry run; not authenticated production evidence',migrations:files,studyTables:tables,grants,importedUnits:imports.units.length,importedCards:imports.cards.length,existingQuestionCount:1,existingCredits:40,existingEntitlement:true,productionWrites:0};
  writeFileSync('artifacts/study-suite/schema-dry-run.json',JSON.stringify(report,null,2)+'\n');
  const invariant=`select (select count(*) from public.questions) as question_count,(select md5(coalesce(string_agg(id||':'||coalesce(body,'')||':'||coalesce(correct_answer,'')||':'||coalesce(correct_index::text,'')||':'||coalesce(options::text,''),'|' order by id),'')) from public.questions) as question_hash,(select count(*) from public.attempts) as attempt_count,(select md5(coalesce(string_agg(id||':'||credit_balance||':'||coalesce(is_premium::text,'')||':'||coalesce(premium_until::text,''),'|' order by id),'')) from public.users) as entitlement_hash,(select count(*) from public.credit_transactions) as credit_receipt_count`;
  const apply=`-- Owner-authorized current-project rollout, 4 October 2026. Additive schema only.\nbegin isolation level repeatable read;\ncreate temp table study_rollout_before on commit drop as ${invariant};\nalter table study_rollout_before enable row level security;\n${files.map(file=>`\n-- ${file}\n`+readFileSync(`supabase/migrations/${file}`,'utf8')).join('\n')}\ndo $$ declare after_row record; before_row record; begin select * into before_row from study_rollout_before; select * into after_row from (${invariant}) s; if to_jsonb(after_row)<>to_jsonb(before_row) then raise exception 'Existing questions, attempts, credits or entitlements changed'; end if; end $$;\ncommit;\nselect 'Study schema applied; existing questions, attempts, credits and entitlements preserved' as status;\n`;
  writeFileSync('artifacts/study-suite/current-project-migration.sql',apply);
  const bundleDb=new PGlite();
  try {
    await bundleDb.exec(bootstrap);await bundleDb.exec(apply);
    const contentSQL=readFileSync('artifacts/study-suite/current-project-content.sql','utf8');
    await bundleDb.exec(contentSQL);await bundleDb.exec(contentSQL);
    if((await bundleDb.query('select count(*)::int n from study_cards')).rows[0].n!==imports.cards.length)throw new Error('CONTENT_IMPORT_RETRY_FAILED');
    await bundleDb.exec('grant select,update on users to service_role');
    await bundleDb.exec(readFileSync('artifacts/study-suite/current-project-runtime-smoke.sql','utf8'));
    if((await bundleDb.query('select count(*)::int n from study_runs')).rows[0].n!==0)throw new Error('RUNTIME_SMOKE_NOT_ROLLED_BACK');
  }
  finally {await bundleDb.close();}
  report.completeTransactionBundle='passed';
  report.completeContentImportAndRetry='passed';
  report.serviceRoleRuntimeRollback='passed';
  writeFileSync('artifacts/study-suite/schema-dry-run.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({state:report.state,migrations:files,units:imports.units.length,cards:imports.cards.length,productionWrites:0}));
}finally{await db.close();}
