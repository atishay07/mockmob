import {appendFileSync,existsSync,readFileSync} from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {C_TRANSPORT_PROFILE_VNEXT,C_TRANSPORT_PROFILE_VNEXT_HASH} from '../../../artifacts/question-factory/cuet-readiness-2026-10-08/c-draft/scripts/pipeline/lib/candidateTransportProfileC.mjs';
import {assertCCodeBinding,assertCandidateCFixedCohort} from '../lib/candidateCRegistration.mjs';
import {acquireCFileLock,C_POLL_POLICY,releaseCFileLock,runCContinuation} from '../lib/candidateCSupervisor.mjs';

const campaignDirArg=process.argv.indexOf('--campaign-dir');
const campaignDir=resolve(campaignDirArg>=0?process.argv[campaignDirArg+1]:'artifacts/question-factory/cuet-readiness-cost-source-c-100-2026-10-08');
const root=resolve('artifacts/question-factory');
if(!campaignDir.startsWith(root+'\\')&&!campaignDir.startsWith(root+'/'))throw Error('local_factory_artifact_directory_required');
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const campaign=read(join(campaignDir,'campaign.json')),profile=read(join(campaignDir,'verification-profile.json'));
if(campaign.id!== 'cuet-readiness-cost-source-c-100-2026-10-08'||campaign.denominator!==100||campaign.per_subject!==25||
  campaign.jobs?.length!==100||new Set(campaign.jobs.map(job=>job.id)).size!==100||profile.measurement_only!==true||
  profile.publication_policy!=='never'||profile.cap_usd!==5||profile.topology!=='dual_blind'||
  profile.transport_profile?.name!==C_TRANSPORT_PROFILE_VNEXT.policy_name||profile.transport_profile?.hash!==C_TRANSPORT_PROFILE_VNEXT_HASH||
  JSON.stringify(C_TRANSPORT_PROFILE_VNEXT.providers.openai)!==JSON.stringify({model:'gpt-6-luna',mode:'realtime',flex:'preferred_with_standard_fallback'})||
  JSON.stringify(C_TRANSPORT_PROFILE_VNEXT.providers.gemini)!==JSON.stringify({model:'gemini-3.8-flash',mode:'native_batch'})){
  throw Error('candidate_c_frozen_measurement_profile_required');
}
assertCandidateCFixedCohort(campaign.jobs);
assertCCodeBinding(profile.code_hashes);
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
if(profile.campaign_sha256!==sha(join(campaignDir,'campaign.json'))||profile.registry_sha256!==sha(join(campaignDir,'registry.json'))||
  profile.worker_sha256!==sha('artifacts/question-factory/cuet-readiness-2026-10-08/c-draft/scripts/pipeline/tools/cuetFitFactoryC.mjs')){
  throw Error('candidate_c_frozen_artifact_binding_changed');
}

const worker='artifacts/question-factory/cuet-readiness-2026-10-08/c-draft/scripts/pipeline/tools/cuetFitFactoryC.mjs';
const driver=resolve('scripts/pipeline/tools/continueCuetFitCampaignC.mjs'),workerPath=resolve(worker);
const lockDir=join(campaignDir,'.continue-c-lock'),statePath=join(campaignDir,'continuation-progress.json'),logPath=join(campaignDir,'continuation.log');
const cimScript="$ErrorActionPreference='Stop'; $id=[int]$env:MM_CIM_PID; $p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$id); if($p){$p | Select-Object ProcessId,CreationDate,CommandLine | ConvertTo-Json -Compress}";
const normalizePath=value=>String(value).replaceAll('/','\\').toLowerCase();
const driverRelative=normalizePath('scripts/pipeline/tools/continueCuetFitCampaignC.mjs');
function queryCim(pid){
  if(!Number.isSafeInteger(pid)||pid<=0)return null;
  const result=spawnSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',cimScript],{encoding:'utf8',windowsHide:true,maxBuffer:32*1024,
    env:{...process.env,MM_CIM_PID:String(pid)}});
  if(result.error||result.status!==0)throw Error('candidate_cim_process_query_failed');
  if(!result.stdout.trim())return null;
  const parsed=JSON.parse(result.stdout);return Array.isArray(parsed)?parsed[0]||null:parsed;
}
function matchesExpectedProcess(info,role){
  if(!info?.CommandLine||!info?.CreationDate)return false;
  const command=normalizePath(info.CommandLine),campaign=normalizePath(campaignDir);
  if(role==='worker')return command.includes(campaign)&&command.includes(normalizePath(workerPath))&&command.includes('worker')&&command.includes('--campaign-dir');
  if(role==='supervisor')return (command.includes(normalizePath(driver))||command.includes(driverRelative))&&(command.includes(campaign)||
    (!command.includes('--campaign-dir')&&campaignDir===resolve('artifacts/question-factory/cuet-readiness-cost-source-c-100-2026-10-08')));
  return false;
}
function processIdentity(pid,role){
  const info=queryCim(pid);if(!matchesExpectedProcess(info,role))return null;
  return {pid:Number(info.ProcessId),role,campaign_dir:campaignDir,creation_time:String(info.CreationDate),command_hash:createHash('sha256').update(normalizePath(info.CommandLine)).digest('hex')};
}
function validStoredIdentity(identity){
  return identity&&Number.isSafeInteger(identity.pid)&&identity.pid>0&&['worker','supervisor'].includes(identity.role)&&
    identity.campaign_dir===campaignDir&&typeof identity.creation_time==='string'&&typeof identity.command_hash==='string';
}
async function isIdentityAlive(identity){
  if(!validStoredIdentity(identity))return false;
  const current=processIdentity(identity.pid,identity.role);
  return Boolean(current&&current.creation_time===identity.creation_time&&current.command_hash===identity.command_hash);
}
const ownerIdentity=processIdentity(process.pid,'supervisor');
if(!ownerIdentity)throw Error('candidate_c_supervisor_identity_unverified');
const lock=await acquireCFileLock({lockDir,workspaceRoot:process.cwd(),identity:ownerIdentity,validateIdentity:validStoredIdentity,isIdentityAlive});
let stop=false;const requestStop=()=>{stop=true;};
process.once('SIGINT',requestStop);process.once('SIGTERM',requestStop);
const state=await runCContinuation({campaignId:campaign.id,campaignDir,statePath,logPath,policy:C_POLL_POLICY,maxPolls:128,
  readReport:async()=>existsSync(join(campaignDir,'batch-report.json'))?read(join(campaignDir,'batch-report.json')):null,
  isAlive:async(pid,identity)=>isIdentityAlive(identity),
  findWorker:async()=>{
    const result=spawnSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',
      "$ErrorActionPreference='Stop'; Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -and $_.CommandLine.ToLowerInvariant().Replace('/','\\').Contains($env:MM_C_WORKER) -and $_.CommandLine.ToLowerInvariant().Replace('/','\\').Contains($env:MM_C_CAMPAIGN) -and $_.CommandLine.ToLowerInvariant().Contains('--campaign-dir') } | Select-Object ProcessId,CreationDate,CommandLine | ConvertTo-Json -Compress"],
      {encoding:'utf8',windowsHide:true,maxBuffer:128*1024,env:{...process.env,MM_C_WORKER:normalizePath(workerPath),MM_C_CAMPAIGN:normalizePath(campaignDir)}});
    if(result.error||result.status!==0)throw Error('candidate_c_worker_scan_failed');
    if(!result.stdout.trim())return[];
    const rows=JSON.parse(result.stdout),list=Array.isArray(rows)?rows:[rows];
    return list.map(row=>processIdentity(Number(row.ProcessId),'worker')).filter(Boolean).map(identity=>({pid:identity.pid,identity}));
  },
  sleep:ms=>new Promise(resolveSleep=>setTimeout(resolveSleep,ms)),
  now:Date.now,
  stopRequested:()=>stop,
  launch:async()=>{
    const args=['--use-system-ca',resolve(worker),'worker','--staging','--once','--wave-size','10','--measurement-only','--campaign-dir',campaignDir];
    const child=spawn(process.execPath,args,{cwd:process.cwd(),env:process.env,windowsHide:true,stdio:['ignore','pipe','pipe']});
    let stageError=null,stdoutBuffer='',stderrBuffer='';
    const append=(stream,line)=>{
      appendFileSync(logPath,JSON.stringify({at:new Date().toISOString(),stream,line})+'\n');
      if(stream==='stdout')try{const event=JSON.parse(line);if(event.worker_stage_error)stageError=event.worker_stage_error;}catch{}
    };
    child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
    child.stdout.on('data',chunk=>{stdoutBuffer+=chunk;const lines=stdoutBuffer.split(/\r?\n/);stdoutBuffer=lines.pop();for(const line of lines)if(line)append('stdout',line);});
    child.stderr.on('data',chunk=>{stderrBuffer+=chunk;const lines=stderrBuffer.split(/\r?\n/);stderrBuffer=lines.pop();for(const line of lines)if(line)append('stderr',line);});
    const childResult=new Promise(resolveWait=>{
      child.once('error',error=>resolveWait({code:null,signal:null,error:error.message}));
      child.once('close',(code,signal)=>{
        if(stdoutBuffer)append('stdout',stdoutBuffer);if(stderrBuffer)append('stderr',stderrBuffer);
        resolveWait({code,signal,error:stageError});
      });
    });
    await new Promise((resolveSpawn,rejectSpawn)=>{child.once('spawn',resolveSpawn);child.once('error',rejectSpawn);});
    const identity=processIdentity(child.pid,'worker');
    if(!identity){const result=await childResult;return {pid:child.pid,identity:{pid:child.pid,role:'worker',campaign_dir:campaignDir,creation_time:'unverified',command_hash:'unverified'},wait:async()=>({...result,error:'candidate_c_worker_identity_unverified'})};}
    return {pid:child.pid,identity,wait:()=>childResult};
  }
});
process.removeListener('SIGINT',requestStop);process.removeListener('SIGTERM',requestStop);
await releaseCFileLock(lock,{workspaceRoot:process.cwd(),isIdentityAlive});
console.log(JSON.stringify({campaign_id:campaign.id,status:state.status,polls:state.polls,worker_starts:state.worker_starts,progress:state.progress}));
if(state.status==='failed'||state.status==='poll_limit')process.exitCode=1;
