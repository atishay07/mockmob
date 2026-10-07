import { createClient } from '@supabase/supabase-js';
import { loadEnvFile } from 'node:process';
import { readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync } from 'node:fs';
import { resolve,join,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { BudgetLedger } from './lib/budgetLedger.mjs';
import { FactoryStore } from './lib/factoryStore.mjs';
import { createFactoryTransport,BatchPending,responseJSON } from './lib/factoryTransport.mjs';
import { sourceReadiness,registerSourcePack } from './lib/sourcePacks.mjs';
import { authorCandidate,validateFactoryCandidate,repairFactoryCandidate,publishFactoryQuestion,publishFactoryGroup } from './lib/factoryCore.mjs';
import { lunaBody,FACTORY_VERIFIER_VERSION } from './lib/factoryEvidence.mjs';
import { currentRegistry } from '../../data/evidence_registry.js';
import { FACTORY_SUBJECTS,FACTORY_PILOT_TARGET,inventoryFingerprint,hashJSON,factoryCalibrationReady } from '../../data/question_factory_policy.mjs';
import { mechanicalScreen,reviewBundles } from './lib/subscriptionScreening.mjs';
import { runFactoryCalibration } from './lib/factoryCalibration.mjs';
import { readBankSnapshot,readAllRows } from './lib/bankSnapshot.mjs';
import { planFactoryJobs,ACTIVE_JOB_STATES } from './lib/factoryQueue.mjs';
import { providerPreflight,providerBlocker } from './tools/providerPreflight.mjs';
import { factoryCostReport } from './lib/factoryCosts.mjs';
import { localPilotStep } from './lib/localFactoryPilot.mjs';

const read=path=>JSON.parse(readFileSync(path,'utf8'));
const save=(path,value)=>{mkdirSync(dirname(resolve(path)),{recursive:true});writeFileSync(path,JSON.stringify(value,null,2));};
const runtime=resolve('data/question-factory-runtime');
const dbClient=()=>createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
export async function bankRows(db) {
  return readBankSnapshot(db);
}
async function enqueueJobs(db,registry,phase,perSubject=50,pilotTarget=FACTORY_PILOT_TARGET) {
  const existing=await readAllRows(db,'question_factory_jobs'),publications=await allPublications(db),bank=await bankRows(db);
  const jobs=planFactoryJobs(registry,existing,publications,{phase,perSubject,pilotTarget,inventory:new Set(bank.map(inventoryFingerprint))});
  if(jobs.length){const {error}=await db.from('question_factory_jobs').insert(jobs);if(error)throw new Error(`factory_enqueue_failed:${error.code}`);}
  return jobs.length;
}
async function updateJob(db,id,patch) {
  const {error}=await db.from('question_factory_jobs').update({...patch,updated_at:new Date().toISOString()}).eq('id',id);
  if(error)throw new Error(`factory_job_write_failed:${error.code}`);
}
function publicationCounts(rows) {
  return {total:rows.length,by_subject:Object.fromEntries(FACTORY_SUBJECTS.map(s=>[s,rows.filter(q=>q.subject===s).length])),
    pyq:rows.filter(q=>['authentic_pyq','pyq_adapted'].includes(q.kind)).length};
}
async function allPublications(db) {
  const rows=[];
  for(let offset=0;;offset+=1000) {
    const {data,error}=await db.from('question_factory_publications').select('question_id,subject,chapter,kind').order('question_id').range(offset,offset+999);
    if(error)throw new Error('factory_publication_inventory_required');rows.push(...data);if(data.length<1000)break;
  }
  return rows;
}
export async function runWorker({once=false}={}) {
  const path=resolve(process.env.CUET_BUDGET_LEDGER || 'data/pipeline-budget.sqlite'),ledger=new BudgetLedger(path),store=new FactoryStore(ledger,path),db=dbClient();
  const transport=createFactoryTransport({ledger});store.claim();
  let stopped=false;const stop=()=>{stopped=true;};process.once('SIGINT',stop);process.once('SIGTERM',stop);
  let heartbeatInFlight=null;
  const heartbeat=setInterval(()=>{
    try{store.claim();}catch{stopped=true;return;}
    if(!heartbeatInFlight)heartbeatInFlight=db.rpc('claim_question_factory',{p_worker:store.identity}).then(({data,error})=>{if(error || !data)stopped=true;}).catch(()=>{stopped=true;}).finally(()=>{heartbeatInFlight=null;});
  },30000);
  try {
    const providers=await providerPreflight();
    const {data:claimed,error:claimError}=await db.rpc('claim_question_factory',{p_worker:store.identity});
    if(claimError || !claimed)throw new Error('factory_migration_or_bound_worker_required');
    store.inventory(await bankRows(db),inventoryFingerprint);
    do {
      const {data:lease,error:leaseError}=await db.rpc('claim_question_factory',{p_worker:store.identity});
      if(leaseError || !lease)throw new Error('factory_lease_lost');
      const registry=currentRegistry();
      const {data:control,error:controlError}=await db.from('question_factory_control').select('*').eq('id',1).single();
      if(controlError)throw new Error('factory_control_unavailable');
      const publications=await allPublications(db);
      let counts=publicationCounts(publications);
      const workStates=control.phase==='pilot'?['queued','waiting','validating','repairing','eligible']:['queued','waiting','validating','repairing','eligible','pilot_eligible'];
      const jobsResponse=await db.from('question_factory_jobs').select('*').in('state',workStates).order('created_at').limit(200);
      if(jobsResponse.error)throw new Error('factory_job_inventory_required');
      const jobs=jobsResponse.data;
      let blocker=control.paused?'owner_paused':null;
      if(!blocker)blocker=providerBlocker(providers);
      if(!blocker && (!process.env.CUET_EVIDENCE_SIGNING_KEY || !process.env.CUET_CONTENT_AUTHOR_ID))blocker='publication_configuration_required';
      if(!blocker) {try{ledger.assertHistoryReconciled();}catch(e){blocker=e.message;}}
      if(!blocker && sourceReadiness(registry).some(r=>!r.ready))blocker='four_subject_source_coverage_required';
      if(!blocker && !factoryCalibrationReady(read('data/calibration_manifest.json'),registry,FACTORY_VERIFIER_VERSION))blocker='route_calibration_required';
      const pilotTarget=control.pilot_target || FACTORY_PILOT_TARGET;
      const limit=control.phase==='pilot'?pilotTarget:control.phase==='1000'?1000:10000;
      if(counts.total>=limit)blocker='checkpoint_reached';
      let committed=ledger.snapshot().committed_micro/1e6;
      const {count:accepted,error:acceptedError}=await db.from('question_factory_jobs').select('id',{count:'exact',head:true}).in('state',['published','pilot_eligible']);
      if(acceptedError)throw new Error('factory_yield_count_required');
      let candidateSpend=ledger.db.prepare("SELECT coalesce(sum(actual),0) AS micro FROM requests WHERE state='settled' AND json_extract(receipt_json,'$.purpose')='candidate'").get().micro/1e6;
      let costPerPublished=accepted?candidateSpend/accepted:null;
      let forecast=costPerPublished?committed+Math.max(0,10000-accepted)*costPerPublished:null;
      if(control.phase==='pilot' && jobs.some(j=>['queued','waiting','validating','repairing'].includes(j.state)))forecast=null;
      if(forecast && forecast>50)blocker='forecast_exceeds_lifetime_budget';
      for(const batch of ledger.db.prepare("SELECT id FROM provider_batches WHERE state IN ('submitted','unresolved') AND provider_id IS NOT NULL").all()) {
        try{await transport.reconcile(batch.id);}catch(e){blocker=e.message;break;}
      }
      if(!blocker)for(const job of jobs) {
        if(stopped)break;
        let repairing=job.state==='repairing';
        try {
          await updateJob(db,job.id,{lease_owner:store.identity,lease_until:new Date(Date.now()+300000).toISOString()});
          const gates=await db.from('question_factory_control').select('paused').eq('id',1).single();
          if(gates.error || gates.data.paused)break;
          if(job.passage_group_id) {
            const siblings=await db.from('question_factory_jobs').select('state').eq('passage_group_id',job.passage_group_id);
            if(siblings.error)throw new Error('factory_group_inventory_required');
            if(siblings.data.some(s=>s.state==='quarantined')){await updateJob(db,job.id,{state:'quarantined',result:{reasons:['passage_sibling_quarantined']}});continue;}
          }
          const config={registry,ledger,transport};
          let candidate=store.get(job.id)?.candidate || job.candidate;
          if(!candidate) {candidate=await authorCandidate(job,config);store.set(job.id,{candidate});await updateJob(db,job.id,{candidate,stage:'validation',state:'validating'});}
          const fp=inventoryFingerprint(candidate);
          if(store.duplicate(fp,job.id)) {await updateJob(db,job.id,{state:'quarantined',result:{reasons:['duplicate_existing_inventory']}});continue;}
          store.remember(fp,job.id);
          if(repairing) {candidate=await repairFactoryCandidate(candidate,job.result?.reasons || [],config);store.set(job.id,{candidate});await updateJob(db,job.id,{candidate,state:'validating',attempt:1});repairing=false;}
          if(store.duplicate(inventoryFingerprint(candidate),job.id))throw new Error('duplicate_existing_inventory');
          store.remember(inventoryFingerprint(candidate),job.id);
          let result=await validateFactoryCandidate(candidate,config);
          if(result.state==='quarantined' && job.attempt===0 && job.kind!=='authentic_pyq' && result.reasons.some(r=>/failed:|key_contradiction/.test(r))) {
            await updateJob(db,job.id,{state:'repairing',result,attempt:1});
            repairing=true;
            candidate=await repairFactoryCandidate(candidate,result.reasons,config);store.set(job.id,{candidate});
            repairing=false;
            await updateJob(db,job.id,{candidate,state:'validating',attempt:1});
            if(store.duplicate(inventoryFingerprint(candidate),job.id))throw new Error('duplicate_existing_inventory');
            store.remember(inventoryFingerprint(candidate),job.id);
            result=await validateFactoryCandidate(candidate,config);
          }
          if(result.state==='eligible') {
            if(job.passage_group_id)await updateJob(db,job.id,{candidate:result.question,state:control.phase==='pilot'?'pilot_eligible':'eligible',stage:'complete_group_gate',result});
            else if(control.phase==='pilot' || !control.publication_enabled)await updateJob(db,job.id,{candidate:result.question,state:'pilot_eligible',stage:'publication_gate',result});
            else {await publishFactoryQuestion(result.question,job.id,db);await updateJob(db,job.id,{state:'published',stage:'complete',result});}
          } else await updateJob(db,job.id,{state:'quarantined',result});
        } catch(e) {
          if(e instanceof BatchPending) {
            const batch=ledger.db.prepare('SELECT reservation_id,provider_id FROM provider_batches WHERE id=?').get(e.batchId);
            await updateJob(db,job.id,{state:repairing?'repairing':'waiting',stage:e.stage || 'provider_pending',batch_key:e.batchId,provider_batch_id:batch?.provider_id || null,budget_reservation_id:batch?.reservation_id || null});
          } else if(/budget|pricing|reconciliation|configuration|source|exam_spec|content_author|publication_evidence|passage_group|checkpoint|subject_target/.test(e.message)) {blocker=e.message;break;}
          else await updateJob(db,job.id,{state:'quarantined',result:{reasons:[e.message]}});
        }
      }
      let allJobs=await readAllRows(db,'question_factory_jobs');
      if(!blocker && control.publication_enabled && control.phase!=='pilot') {
        const groupIds=[...new Set(allJobs.filter(j=>j.passage_group_id && j.state==='eligible').map(j=>j.passage_group_id))];
        for(const id of groupIds) {
          const members=allJobs.filter(j=>j.passage_group_id===id);
          if(members.some(j=>j.state!=='eligible'))continue;
          try{await publishFactoryGroup(members.map(j=>j.candidate),db,registry);}
          catch(error){if(/checkpoint|subject_target|budget|configuration|publication_evidence/.test(error.message)){blocker=error.message;break;}
            for(const member of members)await updateJob(db,member.id,{state:'quarantined',result:{reasons:[error.message]}});}
        }
        allJobs=await readAllRows(db,'question_factory_jobs');counts=publicationCounts(await allPublications(db));
        if(!blocker && counts.total<limit && allJobs.filter(j=>ACTIVE_JOB_STATES.includes(j.state)).length<40) {
          await enqueueJobs(db,registry,control.phase);allJobs=await readAllRows(db,'question_factory_jobs');
        }
      }
      const rejected={};for(const j of allJobs)for(const reason of j.state==='quarantined'?j.result?.reasons || []:[])rejected[reason]=(rejected[reason] || 0)+1;
      const pilotEligible=allJobs.filter(j=>j.state==='pilot_eligible').length;
      const pilotTotal=allJobs.length;
      committed=ledger.snapshot().committed_micro/1e6;
      candidateSpend=ledger.db.prepare("SELECT coalesce(sum(actual),0) AS micro FROM requests WHERE state='settled' AND json_extract(receipt_json,'$.purpose')='candidate'").get().micro/1e6;
      const acceptedNow=allJobs.filter(j=>['published','pilot_eligible'].includes(j.state)).length;
      costPerPublished=acceptedNow?candidateSpend/acceptedNow:null;
      forecast=costPerPublished?committed+Math.max(0,10000-acceptedNow)*costPerPublished:null;
      if(control.phase==='pilot' && (allJobs.length!==pilotTarget || allJobs.some(j=>['queued','waiting','validating','repairing','eligible'].includes(j.state))))forecast=null;
      if(forecast>50)blocker='forecast_exceeds_lifetime_budget';
      const snapshot={at:new Date().toISOString(),worker_id:store.identity,budget:ledger.snapshot(),historical_reconciled:Boolean(ledger.db.prepare("SELECT 1 FROM ledger_metadata WHERE id='history'").get()),
        sources:sourceReadiness(registry),providers,costs:factoryCostReport(ledger),counts,blocker,forecast_usd:forecast,cost_per_published_usd:costPerPublished,
        achievable_published:costPerPublished?Math.min(10000,acceptedNow+Math.max(0,Math.floor((50-committed)/costPerPublished))):null,
        shortfall_usd:forecast?Math.max(0,forecast-50):null,pilot:{target:pilotTarget,total:pilotTotal,eligible:pilotEligible,
        complete:allJobs.length===pilotTarget && !allJobs.some(j=>['queued','waiting','validating','repairing','eligible'].includes(j.state)),cost_per_eligible_usd:costPerPublished},
        jobs:Object.fromEntries([...new Set(allJobs.map(j=>j.state))].map(state=>[state,allJobs.filter(j=>j.state===state).length])),rejection_reasons:rejected};
      save(join(runtime,'worker-status.json'),snapshot);
      const {error:writeError}=await db.from('question_factory_control').update({snapshot,updated_at:new Date().toISOString()}).eq('id',1).eq('worker_id',store.identity);
      if(writeError)throw new Error('factory_snapshot_write_required');
      console.log(JSON.stringify({published:counts.total,pilot_eligible:pilotEligible,blocker,budget:ledger.snapshot()}));
      if(once || stopped)break;
      await new Promise(r=>setTimeout(r,30000));
    } while(!stopped);
  } finally {clearInterval(heartbeat);await heartbeatInFlight;process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);store.release();ledger.close();}
}
async function main() {
  try{loadEnvFile('.env.local');}catch{ /* supplied environment */ }
  const [command,arg,output]=process.argv.slice(2);
  if(command==='worker')return (await import('./tools/focusedFactory.mjs')).runFocusedWorker({once:process.argv.includes('--once')});
  if(command==='local-pilot') {
    const calibrationIndex=process.argv.indexOf('--calibration');
    const calibrationPath=calibrationIndex>=0?process.argv[calibrationIndex+1]:null;
    if(calibrationIndex>=0 && (!calibrationPath || calibrationPath.startsWith('--')))throw new Error('calibration_fixture_path_required');
    const path=resolve(process.env.CUET_BUDGET_LEDGER || 'data/pipeline-budget.sqlite'),ledger=new BudgetLedger(path),store=new FactoryStore(ledger,path),transport=createFactoryTransport({ledger});
    let heartbeat,stopped=false;const stop=()=>{stopped=true;};process.once('SIGINT',stop);process.once('SIGTERM',stop);
    try {
      store.claim();heartbeat=setInterval(()=>{try{store.claim();}catch{stopped=true;}},30000);
      const gate=providerBlocker(await providerPreflight());
      do {
        const registry=currentRegistry();let calibration=read('data/calibration_manifest.json');
        let report=await localPilotStep({registry,calibration,ledger,store,transport,providerGate:gate,shouldStop:()=>stopped,readInventory:()=>bankRows(dbClient())});
        let calibrationPending=false;
        if(calibrationPath && !gate && !stopped && !factoryCalibrationReady(calibration,registry,FACTORY_VERIFIER_VERSION)) {
          calibration=await runFactoryCalibration(read(calibrationPath),{registry,ledger,transport});
          save('data/calibration_manifest.json',calibration);
          calibrationPending=Boolean(calibration.pending?.length);
          if(factoryCalibrationReady(calibration,registry,FACTORY_VERIFIER_VERSION))report=await localPilotStep({registry,calibration,ledger,store,transport,shouldStop:()=>stopped,readInventory:()=>bankRows(dbClient())});
          report.calibration={state:calibration.state,pending:calibration.pending?.length||0,verifier_version:calibration.verifier_version};
          if(calibrationPending)report.blocker='calibration_batches_pending';
          report.budget=ledger.snapshot();report.costs=factoryCostReport(ledger);
        }
        const {candidates,...snapshot}=report;
        save(join(runtime,'local-pilot.json'),report);save(join(runtime,'worker-status.json'),snapshot);
        save('artifacts/question-factory/local-pilot-status.json',snapshot);
        console.log(JSON.stringify({...snapshot,job_count:candidates.length},null,2));
        if(process.argv.includes('--once') || stopped || report.blocker && !calibrationPending || report.pilot.complete)break;
        await new Promise(r=>setTimeout(r,30000));
      }while(!stopped);
    } finally {clearInterval(heartbeat);process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);store.release();ledger.close();}
    return;
  }
  if(command==='register-source') {const path=resolve(arg),registry=registerSourcePack(read(path),dirname(path),currentRegistry());save('data/source_registry.json',registry);console.log(JSON.stringify(sourceReadiness(registry)));return;}
  if(command==='screen') {
    const rows=arg==='--database'?await bankRows(dbClient()):read(arg), receipts=mechanicalScreen(rows),bundles=reviewBundles(rows,receipts,{sources:currentRegistry().sources});
    const directory=resolve(output || join(runtime,'legacy'));
    save(join(directory,'bank-snapshot.json'),rows);save(join(directory,'local-receipts.json'),receipts);
    for(const bundle of bundles)save(join(directory,`${bundle.id}.bundle.json`),bundle);
    const report={at:new Date().toISOString(),rows:rows.length,clean_mechanical:receipts.filter(r=>r.verdict==='no_issue_found').length,suspect:receipts.filter(r=>r.verdict==='suspect').length,bundles:bundles.length,api_spend_usd:0,production_changes:0};
    save(join(directory,'screen-report.json'),report);console.log(JSON.stringify(report));return;
  }
  if(command==='catalog') {
    const documents=FACTORY_SUBJECTS.map(subject=>{const path=`data/CUET 2026/${subject}.pdf`;return {subject,path,identity_sha256:createHash('sha256').update(readFileSync(path)).digest('hex'),kind:'syllabus',state:'pending_extraction',source_url:'https://cuet.nta.nic.in/cuetug-2026-syllabus/',year:2026,reuse_permitted:false,reason:'Extraction, permission and 2027 applicability require evidence.'};});
    const foundation=join(runtime,'source-foundation','acquisition.json');
    if(existsSync(foundation))documents.push(...read(foundation));
    save('data/question_factory_sources.json',{created_at:new Date().toISOString(),documents,missing:['authenticated_complete_papers','paper_to_final_key_mapping','reuse_permissions','development_and_held_out_sets']});return;
  }
  const path=resolve(process.env.CUET_BUDGET_LEDGER || 'data/pipeline-budget.sqlite'),ledger=new BudgetLedger(path),transport=createFactoryTransport({ledger});
  let foundationLease;
  let foundationHeartbeat;
  try {
    if(['prepare-pattern','research','calibrate'].includes(command)) {
      const providerGate=providerBlocker(await providerPreflight());if(providerGate)throw new Error(providerGate);
      foundationLease=new FactoryStore(ledger,path);foundationLease.claim();
      // Source preparation/calibration are local commissioning, not publication.
      // They use the same permanent ledger and local process lease before the
      // site migration exists. DB binding remains mandatory in runWorker.
      foundationHeartbeat=setInterval(()=>foundationLease.claim(),30000);
      for(const row of ledger.db.prepare("SELECT id FROM provider_batches WHERE state IN ('submitted','unresolved') AND provider_id IS NOT NULL").all())await transport.reconcile(row.id);
    }
    if(command==='doctor') {
      const report={sources:sourceReadiness(currentRegistry()),budget:ledger.snapshot(),historical_reconciled:Boolean(ledger.db.prepare("SELECT 1 FROM ledger_metadata WHERE id='history'").get()),
        signing_key_configured:Boolean(process.env.CUET_EVIDENCE_SIGNING_KEY),author_configured:Boolean(process.env.CUET_CONTENT_AUTHOR_ID),costs:factoryCostReport(ledger),calibration:read('data/calibration_manifest.json').state,api_calls:0};
      save(join(runtime,'doctor.json'),report);console.log(JSON.stringify(report,null,2));
    } else if(command==='reconcile-history') {ledger.reconcileHistory(read(arg));console.log(JSON.stringify(ledger.snapshot()));}
    else if(command==='reconcile-batches') {for(const row of ledger.db.prepare("SELECT id FROM provider_batches WHERE state IN ('submitted','unresolved') AND provider_id IS NOT NULL").all())await transport.reconcile(row.id);}
    else if(command==='attach-batch') {const report=read(arg);await transport.attachAcceptedBatch(report.factory_key,report.provider_batch_id);}
    else if(command==='reconcile-usage') {
      const report=read(arg),row=ledger.db.prepare('SELECT * FROM requests WHERE id=?').get(report.reservation_id);
      if(row?.state!=='unresolved' || !Number.isFinite(report.actual_usd) || report.actual_usd<0 || !report.provider_reference || typeof report.basis!=='string' || report.basis.length<20)throw new Error('confirmed_provider_usage_report_required');
      ledger.settle(row.id,Math.ceil(report.actual_usd*1e6),{...report,purpose:'candidate'});
      console.log(JSON.stringify(ledger.snapshot()));
    }
    else if(command==='prepare-pattern') {
      const input=read(arg),key=hashJSON({input,stage:'pattern',version:FACTORY_VERIFIER_VERSION});
      const spec=responseJSON(await transport.generate('openai',lunaBody('Prepare a CUET source-backed pattern specification from the authenticated syllabus and paper excerpts supplied. Return JSON included_topics, excluded_topics, pattern_rules, syllabus_version, pattern_version, exam_rule_version and uncertainties. Do not infer missing 2027 rules, invent paper examples or assert source permission. This is a draft, not a release.',input,'high',3000),{key,purpose:'source'}));save(output,{state:'draft',...spec});
    } else if(command==='research') {
      const body=lunaBody('Locate official NTA/CUET source documents for the request. Search snippets are not authentication. Return JSON documents [{url,title,year,kind}] and missing_evidence. Do not claim permission, extraction or final-key matching.',{query:arg},'high',2500);
      body.tools=[{type:'web_search',filters:{allowed_domains:['cuet.nta.nic.in','nta.ac.in']}}];body.max_tool_calls=3;
      const result=await transport.generate('openai',body,{batch:false,toolCalls:3,purpose:'source'});save(output,{state:'research_only',result});
    } else if(command==='calibrate') {
      const report=await runFactoryCalibration(read(arg),{registry:currentRegistry(),ledger,transport});
      save('data/calibration_manifest.json',report);console.log(JSON.stringify({state:report.state,pending:report.pending?.length || 0}));
    } else if(command==='enqueue') {
      const registry=currentRegistry(),db=dbClient();
      if(sourceReadiness(registry).some(s=>!s.ready))throw new Error('four_subject_authenticated_sources_required');
      const {data:control,error:controlError}=await db.from('question_factory_control').select('phase,pilot_target').eq('id',1).single();
      if(controlError)throw new Error('factory_migration_required');
      const queued=await enqueueJobs(db,registry,control.phase,Number(arg || 50),control.pilot_target);console.log(JSON.stringify({queued,phase:control.phase}));
    } else if(command==='export-review-bundles') {
      const directory=resolve(arg || join(runtime,'legacy'));console.log(JSON.stringify({directory,bundles:readdirSync(directory).filter(f=>f.endsWith('.bundle.json'))}));
    } else throw new Error('Commands: catalog, screen rows.json|--database [directory], doctor, register-source pack.json, reconcile-history report.json, prepare-pattern input.json output.json, research query output.json, calibrate fixtures.json, enqueue, worker [--once], local-pilot [--once], reconcile-batches');
  } finally {clearInterval(foundationHeartbeat);foundationLease?.release();ledger.close();}
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{if(e instanceof BatchPending)console.log(JSON.stringify({state:'waiting',batch_id:e.batchId}));else{console.error(e.message);process.exitCode=1;}});
