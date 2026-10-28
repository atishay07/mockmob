// Complete saved error-only bank work after the original native worker drains.
// This never kills a process, replaces a candidate, or clears a receipt/hold.
import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {validationContractV7} from '../lib/contractV7.mjs';
import {readBankWorkerProcesses,currentBankWorkers,assertBankWorkersDrained} from '../lib/bankWorkerRecoveryGuard.mjs';
const root='artifacts/question-factory/cuet-readiness-2026-10-08',profile=JSON.parse(readFileSync(root+'/reassessment/profile.json'));
const ownerIndex=process.argv.indexOf('--owner-pid'),owner=Number(ownerIndex<0?0:process.argv[ownerIndex+1]);
if(!Number.isSafeInteger(owner)||owner<=0||owner===process.pid)throw Error('currently_verified_bank_owner_pid_required');
if(!process.argv.includes('--approved'))throw Error('authorized_reassessment_completion_required');
if(profile.contract!==validationContractV7()||profile.publication!=='never')throw Error('frozen_measurement_contract_changed');
const alive=pid=>{try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw e;}};
let stopping=false;const stop=()=>{stopping=true;};process.on('SIGINT',stop);process.on('SIGTERM',stop);
const progress=state=>{const value={at:new Date().toISOString(),owner_pid:owner,...state,publication_writes:0,production_writes:0};writeFileSync(root+'/reassessment/error-recovery-progress.json',JSON.stringify(value,null,2)+'\n');console.log(JSON.stringify(value));};
async function run(args){const child=spawn(process.execPath,['--use-system-ca',...args],{cwd:process.cwd(),env:process.env,windowsHide:true,stdio:['ignore','inherit','inherit']});return new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});}
try{
  progress({state:'waiting_for_original_worker_to_drain'});
  while((alive(owner)||currentBankWorkers(readBankWorkerProcesses()).length)&&!stopping&&!existsSync(root+'/reassessment/STOP_ERROR_RECOVERY'))await new Promise(r=>setTimeout(r,30000));
  if(stopping||existsSync(root+'/reassessment/STOP_ERROR_RECOVERY')){progress({state:'stopped_before_recovery_dispatch'});}
  else{
    const db=new DatabaseSync('data/pipeline-budget.sqlite',{readOnly:true});let caps;
    try{caps=db.prepare('SELECT owner_pid,cap_micro FROM temporary_owner_budget_caps').all();assertBankWorkersDrained(db);}finally{db.close();}
    for(const cap of caps){if(![6916,37712].includes(cap.owner_pid)||alive(cap.owner_pid))throw Error('recorded_owner_not_drained');const code=await run(['scripts/pipeline/tools/clearEndedMeasurementOwnerCap.mjs',String(cap.owner_pid),String(cap.cap_micro)]);if(code)throw Error('ended_owner_cap_cleanup_failed:'+code);}
    progress({state:'recovering_saved_error_ids',original_owner_drained:true});
    const code=await run(['scripts/pipeline/tools/reassessCuetReadiness.mjs','--measurement-only','--cap-usd','9','--concurrency','4','--recover-errors-only','--original-owner-pid',String(owner)]);
    progress({state:code?'recovery_dependency':'recovery_pass_finished',code});
  }
}finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
