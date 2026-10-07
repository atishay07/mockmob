import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {FactoryStore} from '../lib/factoryStore.mjs';
import {createFactoryTransport,BatchPending} from '../lib/factoryTransport.mjs';
import {factoryCostReport} from '../lib/factoryCosts.mjs';
import {authorCandidate,validateFactoryCandidate,repairFactoryCandidate,factoryPassageGroup,AUTHOR_CONTRACT} from '../lib/factoryCore.mjs';
import {runFactoryCalibration,validateCalibrationManifest} from '../lib/factoryCalibration.mjs';
import {FACTORY_VERIFIER_VERSION} from '../lib/factoryEvidence.mjs';
import {planAnchorBlueprints,BLUEPRINT_CONTRACT,blueprintSkillKey} from '../lib/factoryBlueprints.mjs';
import {readBankSnapshot} from '../lib/bankSnapshot.mjs';
import {factoryCalibrationReady,inventoryFingerprint,FACTORY_SUBJECTS,hashJSON} from '../../../data/question_factory_policy.mjs';

// Preregistered quality campaign. It never publishes and never writes to the site database.
try{loadEnvFile('.env.local');}catch{}
const args=process.argv.slice(2).filter(a=>!a.startsWith('--'));
const action=args[0],campaign=args[1]||'quality-v4';
// Owner-approved measurement run: generation is allowed without a released gate, but nothing can be published
// (publication eligibility independently requires the released manifest).
const useBatch=process.argv.includes('--batch');
const cacheOnly=process.argv.includes('--cache-only');
const measureOnly=process.argv.includes('--measure-only');
if(!/^[a-z0-9.-]+$/.test(campaign))throw new Error('invalid_campaign');
const root=resolve('data/question-factory-runtime'),out=`artifacts/question-factory/${campaign}`;
const jobTable=`factory_campaign_jobs_${campaign.replaceAll(/[.-]/g,'_')}`;
const read=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
mkdirSync(out,{recursive:true});
// Every gate run is kept; earlier failures are never overwritten.
const archive=(name,v)=>{mkdirSync(`${out}/history`,{recursive:true});save(`${out}/history/${new Date().toISOString().replaceAll(/[:.]/g,'-')}-${name}-${FACTORY_VERIFIER_VERSION}.json`,v);};
const ledgerPath=resolve(process.env.CUET_BUDGET_LEDGER||'data/pipeline-budget.sqlite');
const ledger=new BudgetLedger(ledgerPath),store=new FactoryStore(ledger,ledgerPath);
const native=createFactoryTransport({ledger});
const transport={generate:(provider,body,options)=>native.generate(provider,body,{...options,batch:useBatch,cacheOnly})};
const registry=read('data/source_registry.json');
const config={registry,ledger,transport};
const statePath=`${out}/campaign-state.json`;
let campaignState=existsSync(statePath)?read(statePath):null;
if(action==='plan'&&!campaignState){campaignState={campaign,registry_hash:hashJSON(registry),verifier:FACTORY_VERIFIER_VERSION,execution_mode:useBatch?'batch':'realtime',measure_only:measureOnly,before_request_ids:ledger.db.prepare('SELECT id FROM requests').all().map(r=>r.id),started_at:new Date().toISOString()};save(statePath,campaignState);}
if(['plan','generate'].includes(action)&&campaignState&&(campaignState.registry_hash!==hashJSON(registry)||campaignState.verifier!==FACTORY_VERIFIER_VERSION||campaignState.execution_mode!==(useBatch?'batch':'realtime')||campaignState.measure_only!==measureOnly))throw Error('frozen_campaign_context_mismatch');
const campaignSpend=()=>{const before=new Set(campaignState?.before_request_ids||[]);return ledger.db.prepare("SELECT id,actual FROM requests WHERE state='settled'").all().filter(r=>!before.has(r.id)).reduce((s,r)=>s+r.actual/1e6,0);};
const fatal=/budget|unresolved|configuration|pricing|network|provider_http|input_bound|fetch failed|timeout/;
store.claim();const heartbeat=setInterval(()=>store.claim(),30000);
async function parallel(items,fn,width=6){
  let cursor=0,failure=null;
  await Promise.allSettled(Array.from({length:width},async()=>{for(;;){
    if(failure)return;const index=cursor++;if(index>=items.length)return;
    try{await fn(items[index],index);}catch(error){failure ||= error;return;}
  }}));
  if(failure)throw failure;
}
function spend(){const costs=factoryCostReport(ledger),snap=ledger.snapshot();return {gross_usd:+costs.stages.reduce((s,r)=>s+r.settled_usd,0).toFixed(6),held_usd:+costs.stages.reduce((s,r)=>s+r.held_usd,0).toFixed(6),available_usd:(snap.limit_micro-snap.committed_micro)/1e6,costs};}
ledger.db.exec(`CREATE TABLE IF NOT EXISTS ${jobTable}(id TEXT PRIMARY KEY,value TEXT NOT NULL)`);
const jobs=()=>ledger.db.prepare(`SELECT value FROM ${jobTable} ORDER BY rowid`).all().map(r=>JSON.parse(r.value));
const write=job=>ledger.db.prepare(`INSERT INTO ${jobTable} VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value`).run(job.id,JSON.stringify({...job,updated_at:new Date().toISOString()}));
const jobCost=id=>ledger.db.prepare('SELECT actual,receipt_json FROM requests WHERE state=?').all('settled').filter(r=>{try{return JSON.parse(r.receipt_json||'{}').candidate_id===id;}catch{return false;}}).reduce((s,r)=>s+r.actual/1e6,0);

try{
  if(!cacheOnly&&['plan','generate','calibrate','audit-regression'].includes(action)&&useBatch)for(const b of ledger.db.prepare("SELECT id FROM provider_batches WHERE state IN ('submitted','unresolved') AND provider_id IS NOT NULL").all())await native.reconcile(b.id);
  if(action==='calibrate'){
    const fixturePath=resolve(process.argv.find(a=>a.startsWith('--fixtures='))?.slice(11)||resolve(root,'commissioning-calibration-v4.json')),fixtures=read(fixturePath);
    // Reject invalid benchmark fixtures before any paid explanation preparation or solve.
    try{validateCalibrationManifest(fixtures,registry);}catch(error){
      const failed={version:'cuet-llm-v3',verifier_version:FACTORY_VERIFIER_VERSION,source_registry_version:registry.version,at:new Date().toISOString(),state:'paused',reason:'benchmark_fixture_preflight_failed',failure:error.message,benchmark:{state:'regression_only',unseen_at_freeze:false},routes:{},observations:[],cost_usd:0};
      archive('calibration-preflight',failed);save('data/calibration_manifest.json',failed);save(`${out}/calibration-preflight.json`,failed);throw error;
    }
    // Explanations are factory content, not part of the official item: re-author them under the current contract once.
    if(fixtures.explanation_contract!==AUTHOR_CONTRACT){
      for(const f of [...fixtures.development,...fixtures.held_out].filter(f=>f.valid))f.question.explanation='Explanation preparation pending.';
      fixtures.explanation_contract=AUTHOR_CONTRACT;save(fixturePath,fixtures);
    }
    const calTransport={generate:(p,b,o)=>transport.generate(p,b,{...o,purpose:'calibration'})};
    await parallel([...fixtures.development,...fixtures.held_out.filter(f=>f.valid)].filter(f=>f.question.explanation==='Explanation preparation pending.'),async f=>{
      const authored=await authorCandidate({id:f.id,subject:f.question.subject,chapter:f.question.chapter,anchor_id:f.provenance.anchor_id,kind:'authentic_pyq'},{...config,transport:calTransport});
      f.question.explanation=authored.explanation;save(fixturePath,fixtures);console.log(JSON.stringify({prepared:f.id}));
    },4);
    const before=spend().gross_usd;
    const progressPath=`${out}/calibration-progress.json`,progress={fixture_path:fixturePath,verifier:FACTORY_VERIFIER_VERSION,observations:[]};
    const result=await runFactoryCalibration(fixtures,{...config,concurrency:4,evaluateDevelopment:false,cacheOnly,onObservation:row=>{progress.observations=progress.observations.filter(o=>o.id!==row.id);progress.observations.push(row);save(progressPath,progress);console.log(JSON.stringify(row));}});
    result.cost_usd=+(spend().gross_usd-before).toFixed(6);
    archive('calibration',result);save('data/calibration_manifest.json',result);save(`${out}/calibration-result.json`,result);
    console.log(JSON.stringify({state:result.state,by_subject:result.by_subject,routes:Object.fromEntries(Object.entries(result.routes||{}).map(([k,v])=>[k,{valid_survival:v.valid_survival,false_accepts:v.critical_false_accepts,released:v.released}])),failed_valid:(result.observations||[]).filter(o=>o.expected_valid&&o.state!=='eligible').map(o=>({id:o.id,reasons:o.reasons})),cost:result.cost_usd}));
  }else if(action==='audit-regression'){
    const baseline=read('artifacts/question-factory/quality-uplift/baseline100.json'),audit=read('artifacts/question-factory/quality-uplift/AUDIT-48.json'),observations=[];
    const calTransport={generate:(p,b,o)=>transport.generate(p,b,{...o,purpose:'calibration'})};
    const before=spend().gross_usd;
    await parallel(audit.items.filter(q=>q.verdict!=='approve'),async finding=>{
      const original=baseline.jobs.find(j=>j.id===finding.id).candidate;
      const anchor=registry.examples.find(a=>a.id===original.provenance.anchor_id);
      const candidate={...original,id:`${campaign}-regression-${original.id}`,provenance:{...original.provenance,source_pack_version:anchor.source_pack_version}};
      let result;try{result=await validateFactoryCandidate(candidate,{...config,transport:calTransport});}
      catch(error){if(error instanceof BatchPending||error.message==='calibration_cache_miss')result={state:'waiting',reasons:[error.message],pending_batch:error.batchId||null};else{if(fatal.test(error.message))throw error;result={state:'quarantined',reasons:[error.message]};}}
      observations.push({original_id:original.id,content_hash:finding.content_hash,audit_verdict:finding.verdict,audit_reasons:finding.reasons,state:result.state,reasons:result.reasons||[],failure_details:result.failure_details||[]});
      console.log(JSON.stringify({regression_complete:observations.length,state:result.state,id:original.id}));
    },4);
    const falseAccepts=observations.filter(o=>o.state==='eligible').length,calibration=read('data/calibration_manifest.json');
    const completed=observations.filter(o=>['eligible','quarantined'].includes(o.state)).length;
    calibration.quality_regression={verifier_version:FACTORY_VERIFIER_VERSION,source_registry_version:registry.version,sample_size:completed,pending:observations.length-completed,false_accepts:falseAccepts,observations};
    if(falseAccepts||completed!==18){calibration.state='paused';calibration.reason=falseAccepts?'audited_quality_defect_false_accept':'audited_quality_checks_pending';for(const r of Object.values(calibration.routes||{}))r.released=false;}
    save('data/calibration_manifest.json',calibration);
    const regression={at:new Date().toISOString(),verifier:FACTORY_VERIFIER_VERSION,complete:completed,pending:observations.length-completed,expected:18,false_accepts:falseAccepts,cost_usd:+(spend().gross_usd-before).toFixed(6),observations};
    archive('regression',regression);save(`${out}/quality-regression-results.json`,regression);
    console.log(JSON.stringify({quality_regression:falseAccepts?'failed':completed===18?'passed':'pending',false_accepts:falseAccepts,complete:completed,pending:observations.length-completed}));
  }else if(action==='plan'){
    if(jobs().length)throw new Error('campaign_already_planned');
    const calibration=read('data/calibration_manifest.json');
    if(!measureOnly && !factoryCalibrationReady(calibration,registry,FACTORY_VERIFIER_VERSION))throw new Error('academic_calibration_not_released');
    const before=spend();
    const db=createClient(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
    const bank=await readBankSnapshot(db);store.inventory(bank,inventoryFingerprint);
    const inventory=new Set(ledger.db.prepare('SELECT fingerprint FROM factory_inventory').all().map(r=>r.fingerprint));
    const reserved=new Set(registry.calibration_anchor_ids||[]);
    const perSubject=Number(args[2]||25),planned=[],blueprintLog=[];
    for(const subject of FACTORY_SUBJECTS){
      const anchors=registry.examples.filter(a=>a.subject===subject&&a.generation_ready!==false&&!reserved.has(a.id)&&a.final_key_matched&&!a.dropped&&/^[ABCD]$/.test(a.correct_answer)&&registry.packs?.[a.source_pack_id]?.state==='active');
      const rows=[];
      // Authenticated originals not yet in the bank or an earlier campaign; passage groups only as complete units.
      const seenGroups=new Set();
      for(const a of anchors.filter(a=>a.original_ready!==false)){
        if(a.passage_group_id){
          if(seenGroups.has(a.passage_group_id))continue;seenGroups.add(a.passage_group_id);
          const group=registry.passage_groups?.[a.passage_group_id],members=group?.anchor_ids.map(id=>anchors.find(x=>x.id===id));
          if(!members||members.some(m=>!m||m.original_ready===false||inventory.has(inventoryFingerprint(m))))continue;
          if(rows.length+members.length>Math.floor(perSubject/3))continue;
          const gid=`factory_pg_${randomUUID()}`;for(const m of members)rows.push({id:randomUUID(),subject,chapter:m.chapter,anchor_id:m.id,kind:'authentic_pyq',passage_group_id:gid});
        }else if(!inventory.has(inventoryFingerprint(a))&&rows.length<Math.floor(perSubject/3))rows.push({id:randomUUID(),subject,chapter:a.chapter,anchor_id:a.id,kind:'authentic_pyq',passage_group_id:null});
      }
      const need=perSubject-rows.length;
      if(subject==='english'){
        const lexemes=read('artifacts/question-factory/quality-uplift/lexeme-job-sources.json');
        const formats=[{anchor:'cuet2024-english-bookA-q48',type:'synonym',brief:'Ask for the SYNONYM of the quoted target word, CUET style: Choose the correct SYNONYM for "word" from the options given below.'},
          {anchor:'cuet2024-english-bookA-q49',type:'antonym',brief:'Ask for the ANTONYM of the quoted target word, CUET style: Choose the correct ANTONYM for "word" from the options given below.'},
          {anchor:'cuet2024-english-bookA-q46',type:'synonym',brief:'Embed the quoted target word in one natural sentence that fixes the supplied sense, then ask for the option closest in meaning to the quoted word as used in the sentence.'}];
        if(lexemes.length<need)throw new Error('distinct_lexical_targets_required');
        for(let i=0;i<need;i++){const f=formats[i%formats.length],t=lexemes[i];
          rows.push({id:randomUUID(),subject,chapter:'Vocabulary',anchor_id:f.anchor,kind:'pyq_adapted',passage_group_id:null,additional_source_refs:[t.ref],
            blueprint:{target:`Vocabulary: "${t.word}" in its supplied dictionary sense`,format:'direct_mcq',question_type:f.type,chapter:'Vocabulary',difficulty:'medium',answer_basis:t.brief,
              distractor_plan:['A word of the same part of speech with a clearly different meaning','A word related by topic but not in meaning','For antonyms: a near-synonym of the target; for synonyms: a word with the opposite sense'],required_assumptions:[],numeric_plan:''},
            variant_brief:`${f.brief} The target word is "${t.word}". ${t.brief} Use four single words (or two-word phrases) of the same part of speech as the target; exactly one may match the asked relation in the supplied sense, and no distractor may be a recognised synonym (or, for antonyms, antonym) of the target in any common sense. Do not reuse the anchor's target word.`});}
      }else{
        // Spread adaptations evenly; each anchor plans one spare blueprint.
        const share=new Map(anchors.map(a=>[a.id,0]));for(let i=0;i<need;i++){const a=anchors[i%anchors.length];share.set(a.id,share.get(a.id)+1);}
        const pools=new Map(),subjectSkills=new Set(),subjectAvoid=[];
        const freshBlueprints=list=>list.filter(b=>{const key=blueprintSkillKey(subject,b);if(subjectSkills.has(key))return false;subjectSkills.add(key);subjectAvoid.push(`${b.assessment_skill || b.target}: ${b.reasoning_task || b.question_type}`);return true;});
        await parallel(anchors.filter(a=>share.get(a.id)>0),async a=>{
          const result=await planAnchorBlueprints(a,share.get(a.id)+1,{...config,avoid:subjectAvoid});
          result.accepted=freshBlueprints(result.accepted);pools.set(a.id,result.accepted);blueprintLog.push({anchor_id:a.id,requested:share.get(a.id)+1,accepted:result.accepted.length,rejected:result.rejected});
          console.log(JSON.stringify({blueprints:a.id,accepted:result.accepted.length,rejected:result.rejected.length}));
        },1);
        // Top up short pools with further distinct blueprints (avoiding planned targets) rather than padding.
        const total=()=>[...pools.values()].reduce((n,p)=>n+p.length,0);
        for(let topUp=0;topUp<2&&total()<need;topUp++){
          const short=need-total(),order=[...anchors].sort((x,y)=>(pools.get(x.id)?.length||0)-(pools.get(y.id)?.length||0));
          await parallel(order.slice(0,Math.min(order.length,short+2)),async a=>{
            const pool=pools.get(a.id)||[],result=await planAnchorBlueprints(a,2,{...config,avoid:subjectAvoid});
            const fresh=freshBlueprints(result.accepted).filter(b=>!pool.some(p=>p.blueprint_id===b.blueprint_id||p.target===b.target));
            pools.set(a.id,[...pool,...fresh]);blueprintLog.push({anchor_id:a.id,top_up:topUp+1,accepted:fresh.length,rejected:result.rejected});
          },1);
        }
        // Fill from each anchor's pool in rotation so one anchor cannot dominate.
        let added=0;for(let round=0;added<need&&round<10;round++)for(const a of anchors){
          if(added>=need)break;const pool=pools.get(a.id)||[];const b=pool[round];if(!b)continue;
          rows.push({id:randomUUID(),subject,chapter:a.chapter,anchor_id:a.id,kind:'pyq_adapted',passage_group_id:null,blueprint:b,
            variant_brief:`Blueprint: ${b.target} Format: ${b.format}.`});added++;
        }
        if(added<need)throw new Error(`insufficient_blueprints:${subject}:${added}/${need}`);
      }
      planned.push(...rows.map((r,i)=>({...r,state:'queued',attempt:0,number:planned.length+i+1})));
    }
    for(const job of planned)write(job);
    save(`${out}/preregistered.json`,{at:new Date().toISOString(),campaign,registry_hash:hashJSON(registry),execution_mode:useBatch?'batch':'realtime',measure_only:measureOnly,calibration_state:calibration.state,verifier:FACTORY_VERIFIER_VERSION,author_contract:AUTHOR_CONTRACT,blueprint_contract:BLUEPRINT_CONTRACT,denominator:planned.length,
      by_subject:Object.fromEntries(FACTORY_SUBJECTS.map(s=>[s,{total:planned.filter(j=>j.subject===s).length,originals:planned.filter(j=>j.subject===s&&j.kind==='authentic_pyq').length}])),
      planning_cost_usd:+campaignSpend().toFixed(6),blueprints:blueprintLog,jobs:planned,bank_rows:bank.length});
    console.log(JSON.stringify({planned:planned.length,originals:planned.filter(j=>j.kind==='authentic_pyq').length,planning_cost:+(spend().gross_usd-before.gross_usd).toFixed(6)}));
  }else if(action==='generate'){
    const calibration=read('data/calibration_manifest.json');
    if(!measureOnly && !factoryCalibrationReady(calibration,registry,FACTORY_VERIFIER_VERSION))throw new Error('academic_calibration_not_released');
    let rows=jobs();if(!rows.length)throw new Error('campaign_not_planned');
    await parallel(rows.filter(j=>!['eligible','quarantined'].includes(j.state)),async job=>{
      try{
        let saved=jobs().find(j=>j.id===job.id),candidate=saved.candidate;
        if(!candidate){candidate=await authorCandidate(job,config);write({...saved,candidate,state:'validating'});saved=jobs().find(j=>j.id===job.id);}
        if(saved.state==='repairing'){
          candidate=await repairFactoryCandidate(candidate,[...(saved.result?.reasons||[]),...(saved.result?.failure_details||[])],config);
          write({...saved,candidate,state:'validating',attempt:1});saved=jobs().find(j=>j.id===job.id);
        }
        let result;
        if(store.duplicate(inventoryFingerprint(candidate),job.id))result={state:'quarantined',reasons:['duplicate_existing_inventory']};
        else{store.remember(inventoryFingerprint(candidate),job.id);result=await validateFactoryCandidate(candidate,config);}
        if(result.state==='quarantined'&&saved.attempt===0&&result.reasons.some(r=>/failed:|key_contradiction/.test(r))){
          write({...saved,candidate,state:'repairing',attempt:1,result,first_result:result});
          const first=candidate;
          candidate=await repairFactoryCandidate(candidate,[...result.reasons,...(result.failure_details||[])],config);
          write({...jobs().find(j=>j.id===job.id),candidate,first_candidate:first,state:'validating',attempt:1});
          result=store.duplicate(inventoryFingerprint(candidate),job.id)?{state:'quarantined',reasons:['duplicate_existing_inventory']}:await validateFactoryCandidate(candidate,config);
          store.remember(inventoryFingerprint(candidate),job.id);
        }
        write({...jobs().find(j=>j.id===job.id),candidate:result.question||candidate,state:result.state,result});
      }catch(error){
        if(error instanceof BatchPending){write({...jobs().find(j=>j.id===job.id),pending_batch:{id:error.batchId,stage:error.stage}});return;}
        if(fatal.test(error.message))throw error;
        write({...jobs().find(j=>j.id===job.id),state:'quarantined',result:{reasons:[error.message]}});
      }
      const all=jobs();console.log(JSON.stringify({complete:all.filter(j=>['eligible','quarantined'].includes(j.state)).length,total:all.length,eligible:all.filter(j=>j.state==='eligible').length}));
    },Number(process.env.CAMPAIGN_WIDTH||6));
    rows=jobs();
    for(const id of new Set(rows.map(j=>j.passage_group_id).filter(Boolean))){const group=rows.filter(j=>j.passage_group_id===id);let reason;
      if(group.some(j=>!['eligible','quarantined'].includes(j.state)))continue;
      if(group.some(j=>j.state!=='eligible'))reason='passage_sibling_quarantined';else try{factoryPassageGroup(group.map(j=>j.candidate),registry);}catch(error){reason=error.message;}
      if(reason)for(const j of group)write({...j,validation_result:j.validation_result||j.result,state:'quarantined',result:{...j.result,reasons:[...new Set([...(j.result?.reasons||[]),reason])]}});
    }
    rows=jobs();
    const withCost=rows.map(j=>({...j,cost_usd:+jobCost(j.id).toFixed(6)}));
    const report={at:new Date().toISOString(),campaign,measure_only:measureOnly,calibration_state:calibration.state,publishable:false,verifier:FACTORY_VERIFIER_VERSION,pending:rows.filter(j=>!['eligible','quarantined'].includes(j.state)).length,generated:rows.filter(j=>j.candidate).length,eligible:rows.filter(j=>j.state==='eligible').length,quarantined:rows.filter(j=>j.state==='quarantined').length,budget:spend(),jobs:withCost,production_changes:0};
    save(`${out}/results.json`,report);console.log(JSON.stringify({...report,jobs:undefined,budget:{gross:report.budget.gross_usd,available:report.budget.available_usd}}));
  }else throw new Error('Use calibrate, audit-regression, plan or generate');
}finally{clearInterval(heartbeat);store.release();ledger.close();}
