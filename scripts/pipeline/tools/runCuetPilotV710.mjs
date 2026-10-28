// Runner for the preregistered V7.10 measurement pilot (artifacts/question-factory/cuet-pilot-v710-40-2026-10-09).
//   report                      read-only progress and spend (no ledger construction, no network)
//   execute --approved          PAID. Waves of ten, resumable, checkpointed after every candidate; drains on a stop request, never kills in-flight work
//   export                      read-only: all-candidates.json/.csv, approved.json, rejected.json, receipts.json, batch-report.json, batch-inspection.json
// This tool can never publish and has no publication code path. Run it only with the coordinator's explicit authorization.
// Stop: create data/question-factory-runtime/STOP_V710_PILOT (or STOP_AFTER_REQUEST in the pilot directory); in-flight work drains.
import {appendFileSync,existsSync,mkdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {loadEnvFile} from 'node:process';
import {fileURLToPath} from 'node:url';
import {resolve,relative,isAbsolute} from 'node:path';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {FactoryStore} from '../lib/factoryStore.mjs';
import {createFactoryTransport} from '../lib/factoryTransport.mjs';
import {longFetch} from '../lib/longFetch.mjs';
import {scopedAccounting} from '../lib/scopedAccounting.mjs';
import {reportLedgerV73} from '../lib/freshCuetReadinessV73Guards.mjs';
import {checkFactoryConnectivity} from '../lib/factoryNetworkLaunchPreflight.mjs';
import {saveAtomicArtifact} from '../lib/atomicArtifact.mjs';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
import * as Plan from '../lib/cuetPilotV710Plan.mjs';
import {createPilotGuard,loadPilotState,runPilot,stateSaver,isTerminal} from '../lib/cuetPilotV75Run.mjs';
import {buildPilotDepsV710} from '../lib/cuetPilotV710Deps.mjs';
import {buildPilotExport} from '../lib/cuetPilotV710Export.mjs';

const args=process.argv.slice(2),action=args[0]||'report',flag=name=>args.includes(name),value=name=>{const i=args.indexOf(name);return i>=0&&args[i+1]&&!args[i+1].startsWith('--')?args[i+1]:null;};
if(!['report','execute','export'].includes(action))throw Error('unknown_pilot_action:'+action);
if(action==='execute'&&!flag('--approved'))throw Error('authorized_paid_execution_flag_required');
if(flag('--publish')||flag('--register')||flag('--regenerate')||flag('--replace'))throw Error('pilot_runner_has_no_publication_registration_or_replacement_path');
const directory=resolve(value('--campaign-dir')||Plan.PILOT_DIRECTORY),root=resolve('artifacts/question-factory'),inside=relative(root,directory);
if(!inside||inside.startsWith('..')||isAbsolute(inside))throw Error('local_factory_artifact_directory_required');
// Network trust: re-launch once with the system CA store (as the registered factory launcher does). The child inherits stdio; nothing is killed.
if(action==='execute'&&!process.execArgv.includes('--use-system-ca')&&!/--use-system-ca/.test(process.env.NODE_OPTIONS||'')){
  const code=await new Promise((done,fail)=>{const child=spawn(process.execPath,['--use-system-ca',fileURLToPath(import.meta.url),...args],{stdio:'inherit',env:process.env,windowsHide:true});child.once('error',fail);child.once('close',c=>done(c??1));});
  process.exit(code);
}
const read=p=>JSON.parse(readFileSync(p,'utf8')),sha=p=>Plan.sha256File(p),statePath=directory+'/state.json',ledgerPath=process.env.CUET_BUDGET_LEDGER||'data/pipeline-budget.sqlite';
if(!existsSync(directory+'/PREREGISTRATION.json'))throw Error('preregistration_required:run_prepareCuetPilotV710_--register_first');
const prereg=read(directory+'/PREREGISTRATION.json'),campaign=read(directory+'/campaign.json');
Plan.assertV710PilotRegistration(prereg,campaign);
// Registered inputs may not change after registration.
const bound=prereg.inputs;
for(const [name,file] of [['campaign_sha256','campaign.json'],['registry_sha256','registry.json'],['registry_overlay_sha256','registry-overlay.json'],['coverage_sha256','inventory-coverage-before.json']])
  if(sha(`${directory}/${file}`)!==bound[name])throw Error('registered_input_changed:'+file);
const registry=read(directory+'/registry.json'),prefix=campaign.id+':';
const state=loadPilotState(statePath,campaign);
const save=stateSaver(statePath),log=event=>{const line=JSON.stringify({at:new Date().toISOString(),...event});console.log(line);try{appendFileSync(directory+'/run.log',line+'\n');}catch{}};

function progress(accounting){
  const jobs=campaign.jobs.map(j=>state.jobs[j.id]),count=fn=>jobs.reduce((n,j)=>{const k=fn(j);n[k]=(n[k]||0)+1;return n;},{});
  const committed=accounting?accounting.committed_micro/1e6:null;
  return {pilot_id:campaign.id,denominator:jobs.length,states:count(j=>j.state),by_subject:Object.fromEntries(Plan.PILOT_SUBJECTS.map(s=>[s,count2(jobs.filter(j=>j.subject===s))])),
    waves:state.waves.map(w=>w&&({wave:w.index,terminal:w.terminal,approved:w.approved,yield:w.yield,weak:w.weak})),weak_waves:state.weak_waves,circuit_open:state.circuit_open,stop_reason:state.stop_reason,
    untouched:jobs.filter(j=>j.state==='queued').length,request_keys:state.request_keys.length,runs:state.runs.length,cap_usd:prereg.cap_usd,
    committed_usd:committed,settled_usd:accounting?accounting.settled_micro/1e6:null,held_usd:accounting?accounting.held_micro/1e6:null,receipt_complete:accounting?.receipt_complete??null,
    conservative_maximum_usd:prereg.cost.pilot_maximum_usd,tooling_changes:state.tooling_changes,publication:'never',updated_at:state.updated_at};
}
const count2=jobs=>jobs.reduce((n,j)=>{n[j.state]=(n[j.state]||0)+1;return n;},{});
const readOnlyAccounting=()=>{if(!existsSync(ledgerPath))return null;const ledger=reportLedgerV73(new DatabaseSync(ledgerPath,{readOnly:true}));try{return scopedAccounting(ledger,prefix);}finally{ledger.close();}};

if(action==='report'){console.log(JSON.stringify(progress(readOnlyAccounting()),null,1));process.exit(0);}

if(action==='export'){
  try{loadEnvFile('.env.local');}catch{}
  if(!process.env.CUET_EVIDENCE_SIGNING_KEY)throw Error('CUET_EVIDENCE_SIGNING_KEY_required_to_verify_stored_evidence');
  if(!existsSync(statePath))throw Error('pilot_not_started_nothing_to_export');
  const inventory=Plan.loadOfflineInventory({reassessmentDirectory:value('--inventory-file')||Plan.STOCK_REASSESSMENT_DIRECTORY});
  const out=buildPilotExport({campaign,prereg,state,registry,accounting:readOnlyAccounting(),inventoryRows:inventory.inventory});
  const writeText=(name,text)=>{const path=`${directory}/${name}`,tmp=`${path}.${process.pid}.tmp`;writeFileSync(tmp,text);renameSync(tmp,path);};
  saveAtomicArtifact(directory+'/all-candidates.json',out.rows);writeText('all-candidates.csv',out.csv);saveAtomicArtifact(directory+'/approved.json',out.approved);saveAtomicArtifact(directory+'/rejected.json',out.rejected);
  saveAtomicArtifact(directory+'/receipts.json',out.receipts);saveAtomicArtifact(directory+'/batch-report.json',out.report);saveAtomicArtifact(directory+'/batch-inspection.json',out.inspection);
  console.log(JSON.stringify({exported:directory,complete:out.report.complete,terminal:out.report.terminal,machine_eligible:out.report.machine_eligible,approved_after_inspection:out.report.approved_after_inspection,
    quarantined:out.report.quarantined,withheld_by_inspection:out.report.withheld_by_inspection,gross_usd:out.report.cost.gross_usd,newly_published:0,paid_calls:0}));
  process.exit(0);
}

// ------------------------------------------------------------------ execute (paid)
// The V7.10 validation contract (recorded at registration), the code it rests on, the prices and the registered tooling must all still match.
Plan.assertV710ContractBound(prereg.contract_binding);
const drifted=(expected,current)=>Object.keys({...expected,...current}).filter(path=>expected[path]!==current[path]);
const dependencyDrift=drifted(prereg.dependency_hashes,Plan.fileHashes(Object.keys(prereg.dependency_hashes)));
if(dependencyDrift.length)throw Error('registered_dependency_changed:'+dependencyDrift.join(','));
const toolingDrift=drifted(prereg.tooling_hashes,Plan.fileHashes(Object.keys(prereg.tooling_hashes)));
if(toolingDrift.length){
  if(!flag('--allow-tooling-change'))throw Error('registered_pilot_tooling_changed_use_--allow-tooling-change_to_record_and_proceed:'+toolingDrift.join(','));
  state.tooling_changes.push({at:new Date().toISOString(),files:toolingDrift});
}
const prices=read('data/pipeline-prices.json');
if(hashJSON(Plan.pricingBinding(prices))!==hashJSON(prereg.inputs.pricing_binding))throw Error('registered_pricing_or_input_bounds_changed');
if(!(Date.parse(prices.expires_at)>Date.now()+600e3))throw Error('verified_pricing_expired_or_expiring');
try{loadEnvFile('.env.local');}catch{}
const env=process.env;
if(!env.CUET_EVIDENCE_SIGNING_KEY)throw Error('CUET_EVIDENCE_SIGNING_KEY_required');
if(!(env.CUET_FACTORY_OPENAI_KEY||env.OPENAI_API_KEY)||!(env.CUET_FACTORY_GEMINI_KEY||env.GEMINI_API_KEY))throw Error('provider_credentials_required');
if(env.MOCK_AI==='true')throw Error('mock_mode_cannot_dispatch');
const preflight=await checkFactoryConnectivity();
if(!preflight.ready){console.log(JSON.stringify(preflight));process.exit(1);}
log({network_preflight:'passed',paid_calls_in_preflight:0});

const ledger=new BudgetLedger(ledgerPath),store=new FactoryStore(ledger,ledgerPath,{candidateIds:campaign.jobs.map(j=>j.id)});
let stopping=false;const stop=()=>{stopping=true;};process.on('SIGINT',stop);process.on('SIGTERM',stop);
const stopRequested=()=>stopping||existsSync(directory+'/STOP_AFTER_REQUEST')||existsSync(Plan.STOP_FILE_V710);
let result;
try{
  ledger.assertHistoryReconciled();store.claim();
  mkdirSync(directory,{recursive:true});
  const keys=new Set(state.request_keys);
  // longFetch is required: Node's fetch aborts any response whose headers take over 300 s, which kills Flex calls.
  const native=createFactoryTransport({ledger,prices:()=>read('data/pipeline-prices.json'),fetchImpl:longFetch,
    realtimeStages:['authoring','blind_solution','independent_evaluation','explanation_support','repair'],flexStages:['authoring','blind_solution','explanation_support','repair']});
  const guard=createPilotGuard({ledger,native,pilotId:campaign.id,candidateIds:campaign.jobs.map(j=>j.id),capUsd:prereg.cap_usd,prices:()=>read('data/pipeline-prices.json'),keys,
    onKey:key=>{state.request_keys.push(key);save(state);},stopRequested});
  const deps=buildPilotDepsV710({registry,ledger,transport:guard});
  log({execute:'start',denominator:40,cap_usd:prereg.cap_usd,untouched:campaign.jobs.filter(j=>!isTerminal(state.jobs[j.id])).length,budget:ledger.snapshot()});
  result=await runPilot({campaign,state,saveState:save,deps,log,stopRequested,ledger,concurrency:Math.min(4,Number(value('--concurrency'))||4)});
  log({execute:'finished',...result,committed_usd_from_keys:guard.cost.committedMicro()/1e6,budget:ledger.snapshot()});
}finally{store.release();ledger.close();process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
process.exitCode=['complete','circuit_open','signal'].includes(result?.status)?0:2;
