import {readFileSync,writeFileSync,mkdirSync,existsSync,appendFileSync} from 'node:fs';
import {loadEnvFile} from 'node:process';import {spawn} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import {BudgetLedger} from '../lib/budgetLedger.mjs';import {CampaignController} from '../lib/campaignController.mjs';
import {readBankSnapshot,readAllRows} from '../lib/bankSnapshot.mjs';import {detailedCoverage} from '../lib/topicCoverage.mjs';
import {validationContract} from '../lib/compactBenchmark.mjs';import {hashJSON} from '../../../data/question_factory_policy.mjs';
import {cohortSchedule} from '../lib/cohortScheduling.mjs';
loadEnvFile('.env.local');loadEnvFile('.env.staging');
if(!process.argv.includes('--staging')||process.env.STAGING_SUPABASE_URL!=='https://onwkqxmjqjrhfbjjdydu.supabase.co')throw Error('explicit_separate_staging_required');
const directory='artifacts/question-factory/continuation-500',statePath=directory+'/state.json',target=500,maxCohorts=12,maxInFlight=4;
mkdirSync(directory,{recursive:true});const read=p=>JSON.parse(readFileSync(p)),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const ledger=new BudgetLedger('data/pipeline-budget.sqlite'),controller=new CampaignController(ledger),db=createClient(process.env.STAGING_SUPABASE_URL,process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}),registry=()=>read('data/source_registry.json');
let stopped=false,lastSummary=null;process.once('SIGINT',()=>{stopped=true;});process.once('SIGTERM',()=>{stopped=true;});
const alive=owner=>{try{process.kill(Number(owner.split(':')[0]),0);return true;}catch(e){return e.code==='EPERM';}};
async function command(args,logPath){
 const child=spawn(process.execPath,['--use-system-ca',...args],{cwd:process.cwd(),env:process.env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',b=>appendFileSync(logPath,b));child.stderr.on('data',b=>appendFileSync(logPath,b));
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
 if(code!==0){const error=Error('retained_child_failure:'+args[0]+':'+code);error.nativeExit=code===null||code>255;throw error;}
}
try{
 controller.claim();const worker=ledger.db.prepare('SELECT * FROM factory_worker WHERE id=1').get();if(worker&&alive(worker.owner))throw Error('stop_existing_worker_before_controller');
 const state=existsSync(statePath)?read(statePath):{id:'owner-authorized-500-2026-10-07',created_at:new Date().toISOString(),target_unique_usable:target,maximum_new_cohorts:maxCohorts,maximum_in_flight:maxInFlight,content_cap_usd:50,cohorts:['cost-native-cohort-002','cost-native-cohort-003'],denominator_per_cohort:100,no_regeneration:true,production_deployment_approval:'Owner approved 7 October; app configuration and current evidence still required before live retrieval claims.'};
 state.maximum_in_flight=maxInFlight;state.production_publication_authorized=process.argv.includes('--approved-production');state.unsent_luna_checks_mode=process.argv.includes('--realtime-checks')?'realtime':'native_batch';save(statePath,state);
 do{
  controller.claim();ledger.assertHistoryReconciled();
  for(const name of state.cohorts){if(stopped)break;const dir='artifacts/question-factory/'+name,report=existsSync(dir+'/batch-report.json')?read(dir+'/batch-report.json'):null;if(report?.complete&&report.cost.held_usd===0&&report.newly_published===report.approved_unique)continue;
   if(read(dir+'/benchmark.json').registration.contract_hash!==validationContract())throw Error('current_verification_contract_required');
   if(!existsSync(dir+'/input-preflight.json')&&read(dir+'/campaign.json').author_contract)await command(['scripts/pipeline/tools/checkFocusedInputs.mjs',dir],dir+'/controller.log');
   try{await command(['scripts/pipeline/tools/focusedFactory.mjs','worker','--staging','--once',...(process.argv.includes('--realtime-checks')?['--realtime-checks']:[]),'--campaign-dir',dir],dir+'/controller.log');state.native_worker_failures=0;}
   catch(e){if(!e.nativeExit||(state.native_worker_failures||0)>=3)throw e;state.native_worker_failures=(state.native_worker_failures||0)+1;save(statePath,state);appendFileSync(dir+'/controller.log',JSON.stringify({at:new Date().toISOString(),native_worker_restart:e.message,accepted_ids_retained:true,attempt:state.native_worker_failures})+'\n');}
  }
  const inventory=await readBankSnapshot(db),holds=await readAllRows(db,'recovery_family_holds','family_id','family_id'),coverage=detailedCoverage(inventory,registry(),{heldFamilies:holds.map(h=>h.family_id)});
  save(directory+'/coverage-current.json',coverage);
  const reports=state.cohorts.map(name=>({name,...(existsSync('artifacts/question-factory/'+name+'/batch-report.json')?read('artifacts/question-factory/'+name+'/batch-report.json'):{complete:false,pending:100})}));
  if(state.production_publication_authorized)for(const r of reports){
   const dir='artifacts/question-factory/'+r.name,proofPath=dir+'/production/publication.json';
   if(r.complete&&r.publication_accounting?.ready&&r.newly_published===r.approved_unique&&(!existsSync(proofPath)||read(proofPath).approved_unique!==r.approved_unique))
    await command(['scripts/pipeline/tools/publishProductionCohort.mjs',dir,'--approved-production'],dir+'/production-controller.log');
  }
  const scheduling=cohortSchedule(reports,{usable:coverage.total_usable,target,maximumInFlight:maxInFlight,maximumCohorts:maxCohorts,budget:ledger.snapshot()});
  const {data:control,error}=await db.from('question_factory_control').select('paused,publication_enabled').eq('id',1).single();if(error)throw Error('staging_control_unavailable');
  state.updated_at=new Date().toISOString();state.usable_published_staging=coverage.total_usable;state.budget=ledger.snapshot();state.reports=reports.map(r=>({name:r.name,complete:r.complete,approved:r.approved_unique||0,published:r.newly_published||0,pending:r.pending,cost:r.cost}));
  state.state=scheduling.complete?'staging_target_complete':scheduling.deliveryComplete?'staging_target_complete_usage_held':stopped?'stopped_with_receipts_retained':control.paused?'admin_paused':'running';state.scheduling=scheduling;save(statePath,state);
  const summary={state:state.state,usable:coverage.total_usable,cohorts:state.cohorts.length,in_flight:scheduling.active,receipt_only:scheduling.receipt_only,budget:state.budget.committed_micro/1e6,pending:state.reports.reduce((n,r)=>n+r.pending,0)};
  if(hashJSON(summary)!==lastSummary){console.log(JSON.stringify(summary));lastSummary=hashJSON(summary);}
  if(scheduling.deliveryComplete||stopped)break;
  if(!control.paused&&scheduling.canRegister){
   if(state.cohorts.length>=maxCohorts){state.state='fixed_campaign_ceiling_reached';save(statePath,state);break;}
   const n=Math.max(...state.cohorts.map(s=>Number(s.slice(-3))))+1,name='cost-native-cohort-'+String(n).padStart(3,'0'),dir='artifacts/question-factory/'+name;
   if(!existsSync(dir+'/campaign.json'))await command(['scripts/pipeline/tools/prepareCoverageCampaign.mjs',name,'--staging'],directory+'/preparation.log');
   // Registration is persisted before a single generation request is allowed.
   state.cohorts.push(name);save(statePath,state);
  }
  if(process.argv.includes('--once'))break;await new Promise(r=>setTimeout(r,30000));
 }while(!stopped);
}catch(e){save(directory+'/last-error.json',{at:new Date().toISOString(),reason:e.message,budget:ledger.snapshot(),requests_not_resubmitted:true});throw e;}
finally{controller.release();ledger.close();}
