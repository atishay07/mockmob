import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {FactoryStore} from '../lib/factoryStore.mjs';
import {createFactoryTransport,BatchPending} from '../lib/factoryTransport.mjs';
import {validateFactoryCandidate} from '../lib/factoryCore.mjs';
import {FACTORY_VERIFIER_VERSION} from '../lib/factoryEvidence.mjs';
import {contentHash} from '../../../data/content_evidence.js';
// Seven frozen existing items, zero new authoring, no repair, no publication or database client.
// Re-running reconciles ONLY this probe's saved batch IDs and resumes cached checks.
// Native batches may take up to 24h; pending work is never called a success.
try{loadEnvFile('.env.local');}catch{}
const out='artifacts/question-factory/final-pass';mkdirSync(out,{recursive:true});
const read=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const source=read('artifacts/question-factory/quality-v5/results.json');
const registry=read(`${out}/probe-registry.json`),path=process.env.CUET_BUDGET_LEDGER||'data/pipeline-budget.sqlite';
const ledger=new BudgetLedger(path),store=new FactoryStore(ledger,path),transport=createFactoryTransport({ledger});
const reconcileOnly=process.argv.includes('--reconcile-only');
const reportPath=`${out}/batch-probe.json`;
let report=existsSync(reportPath)?read(reportPath):{verifier:FACTORY_VERIFIER_VERSION,measurement_only:true,unseen_benchmark:false,production_changes:0,start_committed_micro:ledger.snapshot().committed_micro,items:[]};
if(report.verifier!==FACTORY_VERIFIER_VERSION&&!reconcileOnly)throw Error('Frozen probe version mismatch; use --reconcile-only to collect saved receipts without revalidating under a changed verifier');
if(!report.items.length){
 for(const [n,expected] of [[1,'eligible'],[38,'eligible'],[4,'quarantined'],[45,'quarantined'],[57,'quarantined'],[74,'quarantined']]){
  const candidate=structuredClone(source.jobs.find(j=>j.number===n).candidate);delete candidate.evidence;
  report.items.push({n,id:candidate.id,content_hash:contentHash(candidate),expected,candidate,state:'queued'});
 }
 const wrong=structuredClone(source.jobs.find(j=>j.number===38).candidate);delete wrong.evidence;wrong.id='final-pass-wrong-key-38';wrong.correct_answer='B';
 report.items.push({n:'38-wrong-key',id:wrong.id,content_hash:contentHash(wrong),expected:'quarantined',candidate:wrong,state:'queued'});save(reportPath,report);
}
store.claim();const heartbeat=setInterval(()=>store.claim(),30000);
try{
 const keys=new Set(report.items.flatMap(j=>j.pending_keys||[]));
 for(const key of keys){const row=ledger.db.prepare('SELECT state FROM provider_batches WHERE id=?').get(key);if(['submitted','unresolved'].includes(row?.state))await transport.reconcile(key);}
 if(!reconcileOnly)for(const item of report.items){
  if(['eligible','quarantined'].includes(item.state))continue;
  try{const result=await validateFactoryCandidate(item.candidate,{registry,ledger,transport});item.state=result.state;item.reasons=result.reasons||[];item.failure_details=result.failure_details||[];}
  catch(error){if(error instanceof BatchPending){item.state='waiting';item.pending_keys=[...new Set([...(item.pending_keys||[]),error.batchId])];}else throw error;}
  save(reportPath,report);
 }
 report.reconcile_only=reconcileOnly;report.current_verifier=FACTORY_VERIFIER_VERSION;report.current_verifier_revalidation_required=report.verifier!==FACTORY_VERIFIER_VERSION;
 report.at=new Date().toISOString();report.pending=report.items.filter(i=>i.state==='waiting'||i.state==='queued').length;
 report.complete=report.pending===0;report.expected_results_met=report.complete&&report.items.every(i=>i.state===i.expected);
 const batches=ledger.db.prepare('SELECT * FROM provider_batches').all().filter(b=>report.items.some(j=>j.pending_keys?.includes(b.id)));
 report.batches=batches.map(b=>({key:b.id,provider:b.provider,provider_id:b.provider_id,state:b.state,receipt:JSON.parse(ledger.db.prepare('SELECT receipt_json FROM requests WHERE id=?').get(b.reservation_id).receipt_json||'{}')}));
 const now=ledger.snapshot();report.committed_increment_usd=(now.committed_micro-report.start_committed_micro)/1e6;report.lifetime_committed_usd=now.committed_micro/1e6;
 report.new_authoring=0;report.published=0;save(reportPath,report);
 console.log(JSON.stringify({...report,items:report.items.map(({candidate,pending_keys,...i})=>i),batches:report.batches.map(({receipt,...b})=>({...b,execution_mode:receipt.execution_mode,usage:receipt.usage}))},null,2));
}finally{clearInterval(heartbeat);store.release();ledger.close();}
