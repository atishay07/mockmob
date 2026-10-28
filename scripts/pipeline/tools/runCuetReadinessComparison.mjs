// Resume exactly two preregistered measurement campaigns; never register/regenerate or publish.
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,appendFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {CampaignController} from '../lib/campaignController.mjs';
const directory='artifacts/question-factory/cuet-readiness-2026-10-08';
const ledger=new BudgetLedger('data/pipeline-budget.sqlite'),controller=new CampaignController(ledger);
const arms=[{id:'cuet-readiness-baseline-100-2026-10-08',worker:directory+'/baseline-code/scripts/pipeline/tools/cuetFitFactory.mjs'},{id:'cuet-readiness-improved-100-2026-10-08',worker:'scripts/pipeline/tools/cuetFitFactory.mjs'}];
const statePath=directory+'/comparison-progress.json',read=p=>JSON.parse(readFileSync(p,'utf8'));
let stopped=false;const stop=()=>{stopped=true;};process.on('SIGINT',stop);process.on('SIGTERM',stop);
const state=existsSync(statePath)?read(statePath):{registered_arms:arms.map(x=>x.id),started_at:new Date().toISOString(),attempts:[],production_writes:0};
const save=()=>writeFileSync(statePath,JSON.stringify({...state,updated_at:new Date().toISOString(),budget:ledger.snapshot()},null,2)+'\n');
async function run(arm){
 const logPath=directory+'/'+arm.id+'.log';let output='';
 const child=spawn(process.execPath,['--use-system-ca',resolve(arm.worker),'worker','--staging','--once','--realtime-all','--measurement-only','--campaign-dir','artifacts/question-factory/'+arm.id],{cwd:process.cwd(),env:process.env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{const text=chunk.toString();appendFileSync(logPath,text);output=(output+text).slice(-100000);});
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
 return {code,circuit_open:output.includes('"circuit_open"'),stage_error:output.includes('"worker_stage_error"'),logPath};
}
try{
 controller.claim();
 for(const arm of arms){
  const campaignDir='artifacts/question-factory/'+arm.id,profile=read(campaignDir+'/verification-profile.json');
  if(profile.measurement_only!==true||profile.publication_policy!=='never')throw Error('measurement_profile_required');
  for(let attempt=0;attempt<30&&!stopped;attempt++){
   controller.claim();const reportPath=campaignDir+'/batch-report.json',before=existsSync(reportPath)?read(reportPath):null;
   if(before?.complete&&before?.provider_processing_complete){state[arm.id]={state:'completed',report:reportPath};save();break;}
   const result=await run(arm),after=existsSync(reportPath)?read(reportPath):null;
   state.attempts.push({arm:arm.id,attempt:state.attempts.filter(x=>x.arm===arm.id).length+1,at:new Date().toISOString(),...result,approved:after?.approved_unique,rejected:after?.rejected,pending:after?.pending,cost:after?.cost});
   state[arm.id]={state:after?.complete?'completed':result.circuit_open?'circuit_stopped':result.code?'worker_error':'running',report:reportPath};save();
   console.log(JSON.stringify({arm:arm.id,...state.attempts.at(-1),budget:ledger.snapshot()}));
   if(result.code||result.circuit_open||result.stage_error||after?.complete)break;
   const changed=!before||before.pending!==after?.pending||before.cost.requests!==after?.cost.requests;
   if(!changed){state[arm.id].state='no_progress_dependency';save();break;}
  }
 }
 state.state=stopped?'drained_stop':arms.every(a=>state[a.id]?.state==='completed')?'completed':'partial_or_dependency';save();console.log(JSON.stringify({state:state.state,budget:ledger.snapshot()}));
}finally{controller.release();ledger.close();process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
