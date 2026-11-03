import { readFileSync,writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createEmptyCard } from 'ts-fsrs';
import { canonicalStudyJSON } from '../../data/study_content.js';
import { createStudyRun,studyTransition,SCHEDULER_VERSION,istDay } from '../../data/study_engine.js';
import { scheduleReview } from '../../data/study_scheduler.mjs';
const imports=JSON.parse(readFileSync('artifacts/study-suite/content-import-dry-run.json','utf8'));
const q=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
const unit=imports.units[0],cards=imports.cards.slice(0,5).map(c=>({...c.content,contentHash:c.content_hash}));
const projection=createStudyRun({id:'study-rollback-verification',mode:'recall',unitIds:[unit.id],cardIds:cards.map(c=>c.id)});
const row={id:projection.id,request_key:'study_rollback_verify_20261004',request:{mode:'recall',unitId:unit.id},mode:'recall',content:{units:[{id:unit.id,version:unit.version,contentHash:unit.content_hash}],items:cards},projection};
const states=cards.map(c=>({card_id:c.id,content_version:c.version,schedule:JSON.parse(JSON.stringify(createEmptyCard())),scheduler_version:SCHEDULER_VERSION}));
const event={type:'reveal',itemId:cards[0].id,expectedRevision:0,requestKey:'rollback_reveal_12345'};
const next=studyTransition(projection,cards[0],event).projection;
const rated=studyTransition(next,cards[0],{...event,type:'rate',rating:3,expectedRevision:1}).projection;
const schedule={...scheduleReview(states[0].schedule,3),cardId:cards[0].id,contentVersion:cards[0].version,expectedRevision:0};
writeFileSync('artifacts/study-suite/current-project-runtime-smoke.sql',`-- Controlled runtime verification: every study write is rolled back. No model or credit calls.\nbegin;\nset local role service_role;\ndo $$ declare owner_id text; saved jsonb; repeated jsonb; checked jsonb; begin\nselect id into owner_id from public.users order by id limit 1; if owner_id is null then raise exception 'Verification owner unavailable'; end if;\nsaved=public.start_study_run(jsonb_set(${q(row)},'{user_id}',to_jsonb(owner_id)),${q(states)},'${istDay(Date.now())}');\nrepeated=public.start_study_run(jsonb_set(${q(row)},'{user_id}',to_jsonb(owner_id)),${q(states)},'${istDay(Date.now())}');\nif saved<>repeated then raise exception 'Start retry differs'; end if;\nchecked=public.advance_study_run(owner_id,'${projection.id}','rollback_reveal_12345',${q(event)},0,${q(next)},' {"saved":1}'::jsonb,null);\nrepeated=public.advance_study_run(owner_id,'${projection.id}','rollback_reveal_12345',${q(event)},0,${q(next)},'{"saved":2}'::jsonb,null);\nif checked<>repeated then raise exception 'Recorded retry differs'; end if;\nperform public.advance_study_run(owner_id,'${projection.id}','rollback_rating_12345','{"rating":3}'::jsonb,1,${q(rated)},'{"saved":3}'::jsonb,${q(schedule)});\nif not exists(select 1 from public.study_card_states where user_id=owner_id and card_id='${cards[0].id}' and revision=1) then raise exception 'Scheduling was not committed with grading'; end if;\nbegin perform public.advance_study_run(owner_id,'${projection.id}','rollback_stale_12345','{}'::jsonb,0,${q(next)},'{}'::jsonb,null);raise exception 'Stale event accepted'; exception when others then if sqlerrm not like '%revision conflict%' then raise; end if; end;\nend $$;\nrollback;\nselect 'Service-role start, retry, scheduling and stale-revision checks passed; all verification writes rolled back' as status,(select count(*) from public.study_runs where id='${projection.id}') as verification_runs_remaining;\n`);
if(process.argv.includes('--verify')){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url || !key)throw new Error('DATABASE_ENV_MISSING');
  const headers={apikey:key,Authorization:`Bearer ${key}`};
  const responses=await Promise.all(['study_units','study_cards'].map(async table=>{
    const response=await fetch(`${url}/rest/v1/${table}?select=*`,{headers});if(!response.ok)throw new Error(`${table}: ${response.status}`);return response.json();
  }));
  const checks=responses.map((rows,i)=>{
    const expected=imports[i===0?'units':'cards'];
    return expected.every(row=>rows.some(actual=>actual.id===row.id && actual.version===row.version && actual.content_hash===row.content_hash && createHash('sha256').update(canonicalStudyJSON(actual.content)).digest('hex')===row.content_hash));
  });
  if(checks.some(ok=>!ok))throw new Error('LIVE_CONTENT_HASH_MISMATCH');
  const anonymousKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const anonymous=await fetch(`${url}/rest/v1/study_runs?select=id`,{headers:{apikey:anonymousKey,Authorization:`Bearer ${anonymousKey}`}});
  if(![401,403].includes(anonymous.status))throw new Error('ANONYMOUS_STUDY_STORAGE_NOT_DENIED');
  const report={at:new Date().toISOString(),project:'isrxrxzjocewrdureyhp',validatedUnits:imports.units.length,validatedCards:imports.cards.length,allCanonicalContentHashesMatch:true,anonymousStudyStorageStatus:anonymous.status,scope:'Current-project REST content and anonymous-access verification; does not claim authenticated student HTTP testing'};
  writeFileSync('artifacts/study-suite/current-project-content-receipt.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
