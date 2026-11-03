import {appendFileSync,existsSync,mkdirSync,readFileSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import {join,relative,resolve,sep} from 'node:path';

export const C_POLL_POLICY=Object.freeze({initial_delay_ms:30_000,maximum_delay_ms:15*60_000,maximum_runtime_ms:24*60*60_000});
const terminalStatus=new Set(['eligible','quarantined','published']);

export function cPollDelay(pollCount,policy=C_POLL_POLICY){
  const exponent=Math.min(20,Math.max(0,Number(pollCount)||0));
  return Math.min(policy.maximum_delay_ms,policy.initial_delay_ms*(2**exponent));
}

export function cProgressSummary(report){
  if(!report||typeof report!=='object')return {complete:false,denominator:100,pending:100,terminal:0};
  const accounting=report.publication_accounting,blocked=accounting?.blocked_requests;
  const pendingProviderRequests=Array.isArray(blocked)?blocked.length:null;
  const accountingReady=accounting?.ready===true&&Array.isArray(blocked)&&blocked.length===0;
  const rows=Array.isArray(report.jobs)?report.jobs:Array.isArray(report.candidates)?report.candidates:null;
  if(rows){
    const terminal=rows.filter(row=>terminalStatus.has(row.state)).length;
    return {complete:rows.length===100&&terminal===100&&report.provider_processing_complete===true&&accountingReady,denominator:rows.length,pending:rows.length-terminal,terminal,
      provider_processing_complete:report.provider_processing_complete===true,pending_provider_requests:pendingProviderRequests};
  }
  const denominator=Number(report.denominator)||100,pending=Number(report.pending);
  const terminal=Number.isFinite(pending)?denominator-pending:report.complete===true?denominator:0;
  return {complete:report.complete===true&&denominator===100&&(Number.isFinite(pending)?pending===0:true)&&
      terminal===100&&report.provider_processing_complete===true&&accountingReady,denominator,
    pending:Number.isFinite(pending)?pending:report.complete===true?0:denominator,terminal,
    provider_processing_complete:report.provider_processing_complete===true,pending_provider_requests:pendingProviderRequests};
}

function persist(path,state){
  const temp=path+'.tmp-'+process.pid;
  writeFileSync(temp,JSON.stringify(state,null,2)+'\n');
  renameSync(temp,path);
}

export function readCProgress(path){
  if(!existsSync(path))return null;
  return JSON.parse(readFileSync(path,'utf8'));
}

function assertSafeLockTarget(lockDir,workspaceRoot){
  const target=resolve(lockDir),root=resolve(workspaceRoot),inside=relative(root,target);
  if(target!==resolve(lockDir)||inside==='.'||inside.startsWith('..'+sep)||inside==='..'||resolve(join(root,inside))!==target){
    throw Error('candidate_c_supervisor_lock_path_outside_workspace');
  }
  return target;
}

/** Exclusive directory lease with identity-bound stale recovery. Missing or malformed owner data fails closed. */
export async function acquireCFileLock({lockDir,workspaceRoot,identity,validateIdentity,isIdentityAlive}){
  const target=assertSafeLockTarget(lockDir,workspaceRoot),ownerPath=join(target,'owner.json'),reclaimDir=target+'.reclaim';
  const writeOwner=()=>writeFileSync(ownerPath,JSON.stringify({identity})+'\n',{flag:'wx'});
  try{mkdirSync(target);writeOwner();return {lockDir:target,ownerPath,reclaimDir,identity};}
  catch(error){if(error.code!=='EEXIST')throw error;}

  let observed;try{observed=JSON.parse(readFileSync(ownerPath,'utf8')).identity;}catch{throw Error('candidate_c_supervisor_lock_owner_unavailable');}
  if(!observed||!validateIdentity(observed))throw Error('candidate_c_supervisor_lock_owner_identity_invalid');
  if(await isIdentityAlive(observed))throw Error('candidate_c_supervisor_already_running');
  return reclaimAndAcquireCFileLock({lockDir:target,workspaceRoot,identity,validateIdentity,isIdentityAlive});
}

export async function reclaimAndAcquireCFileLock({lockDir,workspaceRoot,identity,validateIdentity,isIdentityAlive}){
  const target=assertSafeLockTarget(lockDir,workspaceRoot),ownerPath=join(target,'owner.json'),reclaimDir=target+'.reclaim';
  try{mkdirSync(reclaimDir);}catch(error){if(error.code==='EEXIST')throw Error('candidate_c_supervisor_lock_recovery_in_progress');throw error;}
  try{
    let observed;try{observed=JSON.parse(readFileSync(ownerPath,'utf8')).identity;}catch{throw Error('candidate_c_supervisor_lock_owner_unavailable');}
    if(!observed||!validateIdentity(observed))throw Error('candidate_c_supervisor_lock_owner_identity_invalid');
    if(await isIdentityAlive(observed))throw Error('candidate_c_supervisor_already_running');
    const checked=assertSafeLockTarget(target,workspaceRoot);
    if(checked!==target)throw Error('candidate_c_supervisor_lock_path_outside_workspace');
    rmSync(target,{recursive:true,force:false});
    mkdirSync(target);
    writeFileSync(ownerPath,JSON.stringify({identity})+'\n',{flag:'wx'});
    return {lockDir:target,ownerPath,reclaimDir,identity};
  }finally{rmSync(reclaimDir,{recursive:true,force:false});}
}

export async function releaseCFileLock(lock,{workspaceRoot,isIdentityAlive}){
  if(!lock)return false;
  const target=assertSafeLockTarget(lock.lockDir,workspaceRoot);
  let saved;try{saved=JSON.parse(readFileSync(lock.ownerPath,'utf8')).identity;}catch{return false;}
  if(JSON.stringify(saved)!==JSON.stringify(lock.identity)||!(await isIdentityAlive(saved)))return false;
  rmSync(target,{recursive:true,force:false});
  return true;
}

/**
 * Drive one saved C campaign at a time. `launch` must run the fixed worker
 * against its existing campaign directory; it must never prepare/register it.
 * A saved live PID is observed until it exits, so a restarted supervisor does
 * not create a second worker beside the one already handling persisted IDs.
 */
export async function runCContinuation({campaignId,campaignDir,statePath,logPath,readReport,isAlive,launch,sleep,now=Date.now,
  policy=C_POLL_POLICY,stopRequested=()=>false,maxPolls=128,findWorker=null}){
  let state=readCProgress(statePath)||{campaign_id:campaignId,started_at:now(),polls:0,worker_starts:0,worker_pid:null,events:[]};
  if(state.campaign_id!==campaignId)throw Error('candidate_c_supervisor_state_campaign_mismatch');
  if(state.status==='failed')return state;
  const log=event=>{const row={at:new Date(now()).toISOString(),...event};state.events.push(row);if(state.events.length>200)state.events=state.events.slice(-200);appendFileSync(logPath,JSON.stringify(row)+'\n');persist(statePath,state);};
  const startedAt=Number(state.started_at)||now();
  for(;;){
    const progress=cProgressSummary(await readReport());
    state.progress=progress;
    if(state.worker_pid){
      if(!state.worker_identity&&findWorker){
        const matches=await findWorker();
        if(matches?.length>1){state.status='failed';log({event:'multiple_matching_workers',count:matches.length,progress});return state;}
        if(matches?.length===1){state.worker_pid=matches[0].pid;state.worker_identity=matches[0].identity;log({event:'recovered_worker_identity',pid:state.worker_pid,progress});}
        else{log({event:'unidentified_saved_pid_not_a_campaign_worker',pid:state.worker_pid,progress});state.worker_pid=null;}
      }
      if(state.worker_pid&&!state.worker_identity){state.status='failed';log({event:'worker_identity_missing',pid:state.worker_pid,progress});return state;}
      if(!state.worker_pid)continue;
      if(await isAlive(state.worker_pid,state.worker_identity)){
        state.status=stopRequested()?'draining_existing_worker':'waiting_for_existing_worker';
        log({event:stopRequested()?'draining_existing_worker':'existing_worker_alive',pid:state.worker_pid,progress});
        await sleep(cPollDelay(state.polls,policy));continue;
      }
      log({event:'previous_worker_identity_gone',pid:state.worker_pid,progress});state.worker_pid=null;state.worker_identity=null;
    }
    if(!state.worker_pid&&findWorker){
      const matches=await findWorker();
      if(matches?.length>1){state.status='failed';log({event:'multiple_matching_workers',count:matches.length,progress});return state;}
      if(matches?.length===1){state.worker_pid=matches[0].pid;state.worker_identity=matches[0].identity;state.status='waiting_for_existing_worker';
        log({event:'recovered_unrecorded_worker',pid:state.worker_pid,progress});continue;}
    }
    if(progress.complete){state.status='complete';log({event:'campaign_complete',progress});return state;}
    if(stopRequested()){state.status='stopped';log({event:'stop_requested_after_worker_drain',progress});return state;}
    if(state.status==='poll_limit')return state;
    if(now()-startedAt>=policy.maximum_runtime_ms||state.polls>=maxPolls){state.status='poll_limit';log({event:'bounded_poll_limit',progress});return state;}

    const child=await launch({campaignDir,progress});
    if(!child||!Number.isInteger(child.pid)||!child.identity||typeof child.wait!=='function')throw Error('candidate_c_supervisor_worker_handle_required');
    state.worker_pid=child.pid;state.worker_identity=child.identity;state.worker_starts++;state.status='worker_running';
    log({event:'worker_started',pid:child.pid,progress});
    const result=await child.wait();
    state.worker_pid=null;state.worker_identity=null;state.last_worker_exit={code:result?.code??null,signal:result?.signal??null};
    if(result?.error||result?.code!==0){state.status='failed';log({event:'worker_error_stop',code:result?.code??null,signal:result?.signal??null,error:result?.error||null});return state;}
    state.polls++;
    log({event:'worker_exited',code:0,progress:cProgressSummary(await readReport())});
    await sleep(cPollDelay(state.polls-1,policy));
  }
}
