import { FACTORY_PILOT_TARGET,inventoryFingerprint,factoryCalibrationReady } from '../../../data/question_factory_policy.mjs';
import { FACTORY_VERIFIER_VERSION } from './factoryEvidence.mjs';
import { sourceReadiness } from './sourcePacks.mjs';
import { planFactoryJobs } from './factoryQueue.mjs';
import { authorCandidate,validateFactoryCandidate,repairFactoryCandidate,factoryPassageGroup } from './factoryCore.mjs';
import { BatchPending } from './factoryTransport.mjs';
import { factoryCostReport } from './factoryCosts.mjs';

// Commissioning uses the same budget, lease, candidates and evidence contracts.
// The local queue has no publication transport and cannot change the site DB.
export async function localPilotStep({registry,calibration,ledger,store,transport,readInventory,providerGate=null,env=process.env,shouldStop=()=>false}) {
  ledger.db.exec('CREATE TABLE IF NOT EXISTS factory_local_jobs(id TEXT PRIMARY KEY,value TEXT NOT NULL)');
  const readJobs=()=>ledger.db.prepare('SELECT value FROM factory_local_jobs ORDER BY rowid').all().map(row=>JSON.parse(row.value));
  const save=job=>ledger.db.prepare('INSERT OR REPLACE INTO factory_local_jobs VALUES(?,?)').run(job.id,JSON.stringify({...job,updated_at:new Date().toISOString()}));
  let blocker=providerGate;
  for(const batch of ledger.db.prepare("SELECT id FROM provider_batches WHERE state IN ('submitted','unresolved') AND provider_id IS NOT NULL").all()) {
    try{await transport.reconcile(batch.id);}catch(error){blocker=error.message;break;}
  }
  let jobs=readJobs();
  if(!blocker && sourceReadiness(registry).some(source=>!source.ready))blocker='four_subject_source_coverage_required';
  if(!blocker && !factoryCalibrationReady(calibration,registry,FACTORY_VERIFIER_VERSION))blocker='route_calibration_required';
  if(!blocker && !env.CUET_EVIDENCE_SIGNING_KEY)blocker='evidence_signing_configuration_required';
  if(!blocker)try{ledger.assertHistoryReconciled();}catch(error){blocker=error.message;}
  if(!blocker) {
    // Refresh the actual site inventory before authoring; this is a GET-only
    // dependency, independent of the unapplied factory migration.
    try{const rows=await readInventory();store.inventory(rows,inventoryFingerprint);}catch{blocker='current_bank_inventory_required';}
  }
  if(!blocker && !jobs.length) {
    const inventory=new Set(ledger.db.prepare('SELECT fingerprint FROM factory_inventory').all().map(row=>row.fingerprint));
    for(const job of planFactoryJobs(registry,[],[],{phase:'pilot',pilotTarget:FACTORY_PILOT_TARGET,inventory}))save({...job,state:'queued',attempt:0,stage:'authoring'});
    jobs=readJobs();
  }
  if(!blocker)for(const job of jobs.filter(job=>['queued','waiting','validating','repairing'].includes(job.state))) {
    if(shouldStop())break;
    store.claim();let repairing=job.state==='repairing';
    try {
      const siblings=job.passage_group_id?readJobs().filter(j=>j.passage_group_id===job.passage_group_id):[];
      if(siblings.some(j=>j.state==='quarantined')){save({...job,state:'quarantined',result:{reasons:['passage_sibling_quarantined']}});continue;}
      const config={registry,ledger,transport};
      let candidate=store.get(job.id)?.candidate || job.candidate;
      if(!candidate){candidate=await authorCandidate(job,config);store.set(job.id,{candidate});save({...job,candidate,state:'validating',stage:'validation'});}
      if(store.duplicate(inventoryFingerprint(candidate),job.id))throw new Error('duplicate_existing_inventory');
      store.remember(inventoryFingerprint(candidate),job.id);
      if(repairing){candidate=await repairFactoryCandidate(candidate,job.result?.reasons || [],config);store.set(job.id,{candidate});repairing=false;save({...job,candidate,state:'validating',attempt:1});}
      if(store.duplicate(inventoryFingerprint(candidate),job.id))throw new Error('duplicate_existing_inventory');
      store.remember(inventoryFingerprint(candidate),job.id);
      let result=await validateFactoryCandidate(candidate,config);
      if(result.state==='quarantined' && job.attempt===0 && job.kind!=='authentic_pyq' && result.reasons.some(reason=>/failed:|key_contradiction/.test(reason))) {
        const repairJob={...job,candidate,state:'repairing',attempt:1,result};save(repairJob);repairing=true;
        candidate=await repairFactoryCandidate(candidate,result.reasons,config);store.set(job.id,{candidate});repairing=false;
        save({...repairJob,candidate,state:'validating'});
        if(store.duplicate(inventoryFingerprint(candidate),job.id))throw new Error('duplicate_existing_inventory');
        store.remember(inventoryFingerprint(candidate),job.id);result=await validateFactoryCandidate(candidate,config);
      }
      save({...readJobs().find(j=>j.id===job.id),candidate:result.question || candidate,state:result.state==='eligible'?'pilot_eligible':'quarantined',stage:'local_complete',result});
    }catch(error) {
      const saved=readJobs().find(j=>j.id===job.id) || job;
      if(error instanceof BatchPending) {
        const batch=ledger.db.prepare('SELECT reservation_id,provider_id FROM provider_batches WHERE id=?').get(error.batchId);
        save({...saved,state:repairing?'repairing':'waiting',stage:error.stage,batch_key:error.batchId,provider_batch_id:batch?.provider_id,budget_reservation_id:batch?.reservation_id});
      }else if(/budget|pricing|reconciliation|configuration|source|exam_spec|authenticated/.test(error.message)){blocker=error.message;break;}
      else save({...saved,state:'quarantined',result:{reasons:[error.message]}});
    }
  }
  jobs=readJobs();
  for(const id of new Set(jobs.filter(j=>j.passage_group_id).map(j=>j.passage_group_id))) {
    const group=jobs.filter(j=>j.passage_group_id===id);
    if(group.some(j=>j.state==='quarantined')) {
      for(const job of group)if(job.state!=='quarantined')save({...job,state:'quarantined',result:{reasons:['passage_sibling_quarantined']}});
    }else if(group.every(j=>j.state==='pilot_eligible')) {
      try{factoryPassageGroup(group.map(j=>j.candidate),registry);}catch(error){for(const job of group)save({...job,state:'quarantined',result:{reasons:[error.message]}});}
    }
  }
  jobs=readJobs();const eligible=jobs.filter(j=>j.state==='pilot_eligible').length,complete=jobs.length===FACTORY_PILOT_TARGET && jobs.every(j=>['pilot_eligible','quarantined'].includes(j.state));
  const costs=factoryCostReport(ledger),candidateSpend=ledger.db.prepare("SELECT coalesce(sum(actual),0) micro FROM requests WHERE state='settled' AND json_extract(receipt_json,'$.purpose')='candidate'").get().micro/1e6;
  const perEligible=eligible?candidateSpend/eligible:null,budget=ledger.snapshot();
  const forecast=complete && perEligible?budget.committed_micro/1e6+Math.max(0,10000-eligible)*perEligible:null;
  if(forecast>budget.limit_micro/1e6)blocker='forecast_exceeds_lifetime_budget';
  const rejection_reasons={};for(const job of jobs)if(job.state==='quarantined')for(const reason of job.result?.reasons || [])rejection_reasons[reason]=(rejection_reasons[reason] || 0)+1;
  return {at:new Date().toISOString(),mode:'local_commissioning',production_changes:0,counts:{total:0,by_subject:{}},blocker,budget,costs,sources:sourceReadiness(registry),
    cost_per_eligible_usd:perEligible,forecast_usd:forecast,pilot:{target:FACTORY_PILOT_TARGET,total:jobs.length,eligible,complete},
    jobs:Object.fromEntries([...new Set(jobs.map(j=>j.state))].map(state=>[state,jobs.filter(j=>j.state===state).length])),rejection_reasons,
    candidates:jobs,publication_gate:'staging_and_explicit_production_migration_required'};
}
