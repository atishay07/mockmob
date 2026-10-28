import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {acquireCFileLock,cPollDelay,cProgressSummary,runCContinuation} from '../lib/candidateCSupervisor.mjs';
import {cohortAccounting} from '../lib/cohortAccounting.mjs';

const paths=()=>{const dir=mkdtempSync(join(tmpdir(),'mm-c-supervisor-'));return {dir,statePath:join(dir,'progress.json'),logPath:join(dir,'events.log')};};
const policy={initial_delay_ms:10,maximum_delay_ms:25,maximum_runtime_ms:1_000};

test('restart waits for the persisted live worker before starting one continuation worker',async()=>{
  const p=paths(),now=100,started=now;
  const existingIdentity={pid:811,role:'worker',campaign_dir:p.dir,creation_time:'old-start',command_hash:'worker-hash'};
  writeFileSync(p.statePath,JSON.stringify({campaign_id:'C',started_at:started,polls:0,worker_starts:1,worker_pid:811,worker_identity:existingIdentity,events:[]}));
  let alive=true,launches=0,active=1,maxActive=1,report={complete:false,denominator:100,pending:1,provider_processing_complete:false};
  const state=await runCContinuation({campaignId:'C',campaignDir:p.dir,...p,now:()=>now,policy,maxPolls:5,
    readReport:async()=>report,isAlive:async(pid,identity)=>pid===811&&identity.creation_time==='old-start'&&alive,
    sleep:async()=>{alive=false;active=0;},
    launch:async()=>{launches++;active++;maxActive=Math.max(maxActive,active);return {pid:812,identity:{pid:812,role:'worker',campaign_dir:p.dir,creation_time:'new-start',command_hash:'new-hash'},wait:async()=>{active--;report={complete:true,denominator:100,pending:0,provider_processing_complete:true,publication_accounting:{ready:true,blocked_requests:[],bounded_terminal_failure_holds:['terminal-failure-hold']}};return {code:0};}};}});
  assert.equal(launches,1);assert.equal(maxActive,1);assert.equal(state.status,'complete');assert.equal(state.worker_starts,2);
  assert.equal(JSON.parse(readFileSync(p.statePath,'utf8')).worker_pid,null);
});

test('a recycled worker PID with a different creation identity is never mistaken for the saved C worker',async()=>{
  const p=paths(),oldIdentity={pid:901,role:'worker',campaign_dir:p.dir,creation_time:'old-process',command_hash:'old-command'};
  writeFileSync(p.statePath,JSON.stringify({campaign_id:'C',started_at:100,polls:0,worker_starts:1,worker_pid:901,worker_identity:oldIdentity,events:[]}));
  let launches=0,otherWorkerAlive=true,report={complete:false,denominator:100,pending:1,provider_processing_complete:false};
  const state=await runCContinuation({campaignId:'C',campaignDir:p.dir,...p,now:()=>100,policy,maxPolls:4,
    readReport:async()=>report,
    isAlive:async(pid,identity)=>pid===903&&identity.creation_time==='actual-campaign-worker'&&otherWorkerAlive,
    findWorker:async()=>otherWorkerAlive?[{pid:903,identity:{pid:903,role:'worker',campaign_dir:p.dir,creation_time:'actual-campaign-worker',command_hash:'actual-command'}}]:[],
    sleep:async()=>{otherWorkerAlive=false;},
    launch:async()=>{assert.equal(otherWorkerAlive,false,'must wait until the actual C worker exits');launches++;return {pid:902,identity:{pid:902,role:'worker',campaign_dir:p.dir,creation_time:'new',command_hash:'new'},wait:async()=>{report={complete:true,denominator:100,pending:0,provider_processing_complete:true,publication_accounting:{ready:true,blocked_requests:[],bounded_terminal_failure_holds:[]}};return {code:0};}};}});
  assert.equal(launches,1);assert.equal(state.worker_starts,2);
  assert.ok(state.events.some(event=>event.event==='previous_worker_identity_gone'));
});

test('a completed fixed cohort is recorded and never launches another worker',async()=>{
  const p=paths();let launches=0;
  const state=await runCContinuation({campaignId:'C',campaignDir:p.dir,...p,now:()=>100,policy,
    readReport:async()=>({complete:true,denominator:100,pending:0,provider_processing_complete:true,approved_unique:71,rejected:29,publication_accounting:{ready:true,blocked_requests:[],bounded_terminal_failure_holds:['terminal-failure-hold']}}),
    isAlive:async()=>false,sleep:async()=>{},launch:async()=>{launches++;throw Error('completed work must not restart');}});
  assert.equal(state.status,'complete');assert.equal(state.progress.terminal,100);assert.equal(launches,0);
});

test('worker error stops the continuation instead of relaunching saved work',async()=>{
  const p=paths();let launches=0,sleeps=0;
  const state=await runCContinuation({campaignId:'C',campaignDir:p.dir,...p,now:()=>100,policy,
    readReport:async()=>({complete:false,denominator:100,pending:8}),isAlive:async()=>false,
    sleep:async()=>{sleeps++;},launch:async()=>{launches++;return {pid:77,identity:{pid:77,role:'worker',campaign_dir:p.dir,creation_time:'start',command_hash:'hash'},wait:async()=>({code:1,signal:null,error:null})};}});
  assert.equal(state.status,'failed');assert.equal(launches,1);assert.equal(sleeps,0);
  assert.equal(JSON.parse(readFileSync(p.statePath,'utf8')).last_worker_exit.code,1);
});

test('pending worker-stage error stops even when the worker catches it and exits zero',async()=>{
  const p=paths();let launches=0;
  const state=await runCContinuation({campaignId:'C',campaignDir:p.dir,...p,now:()=>100,policy,
    readReport:async()=>({complete:false,denominator:100,pending:8}),isAlive:async()=>false,sleep:async()=>{},
    launch:async()=>{launches++;return {pid:78,identity:{pid:78,role:'worker',campaign_dir:p.dir,creation_time:'start',command_hash:'hash'},wait:async()=>({code:0,error:'campaign_budget_exhausted'})};}});
  assert.equal(state.status,'failed');assert.equal(launches,1);
});

test('native polling uses capped exponential backoff and reports only terminal cohort completion',()=>{
  assert.deepEqual([0,1,2,3].map(n=>cPollDelay(n,policy)),[10,20,25,25]);
  const ready={ready:true,blocked_requests:[],bounded_terminal_failure_holds:['terminal-hold'],settled:false};
  assert.equal(cProgressSummary({denominator:100,complete:true,pending:2,provider_processing_complete:false,publication_accounting:ready}).complete,false);
  assert.equal(cProgressSummary({denominator:100,complete:true,pending:0,provider_processing_complete:true,publication_accounting:ready}).complete,true);
  assert.equal(cProgressSummary({denominator:100,complete:true,pending:0,provider_processing_complete:true,publication_accounting:{...ready,ready:false,blocked_requests:['accepted-native-batch']}}).complete,false);
});

test('100 terminal candidates do not complete C while accepted native request accounting is blocked',async()=>{
  const p=paths();let report={complete:true,denominator:100,pending:0,provider_processing_complete:false,publication_accounting:{blocked_requests:['accepted-batch-1']}};let launches=0;
  const state=await runCContinuation({campaignId:'C',campaignDir:p.dir,...p,now:()=>100,policy,maxPolls:4,
    readReport:async()=>report,isAlive:async()=>false,sleep:async()=>{},
    launch:async()=>{launches++;return {pid:79,identity:{pid:79,role:'worker',campaign_dir:p.dir,creation_time:'start',command_hash:'hash'},wait:async()=>{report={...report,provider_processing_complete:true,publication_accounting:{ready:true,blocked_requests:[],bounded_terminal_failure_holds:[]}};return {code:0};}};}});
  assert.equal(launches,1);assert.equal(state.status,'complete');assert.equal(state.progress.provider_processing_complete,true);
});

test('terminal bounded failure holds count as complete, but an accepted native batch still blocks C',()=>{
  const jobs=Array.from({length:100},(_,i)=>({id:'candidate-'+i,state:i===0?'quarantined':'eligible'}));
  const terminalFailure={id:'hold',state:'unresolved',reserved:100,actual:null,hold_maximum_micro:100,candidate_id:'candidate-0',provider_key:'saved-key',provider_id:'batches/saved',
    receipt:{provider:'gemini',provider_batch_id:'batches/saved',provider_batch_done:true,provider_batch_status:'JOB_STATE_FAILED',provider_batch_record:{metadata:{key:'saved-key'},error:{code:14}}}};
  const terminalAccounting=cohortAccounting([terminalFailure],{jobs,budget:{limit_micro:5_000_000,committed_micro:100,unbounded_unresolved:0}});
  assert.equal(terminalAccounting.ready,true);assert.equal(terminalAccounting.settled,false);assert.deepEqual(terminalAccounting.bounded_terminal_failure_holds,['hold']);
  assert.equal(cProgressSummary({jobs,provider_processing_complete:terminalAccounting.ready,publication_accounting:terminalAccounting}).complete,true);
  const acceptedPending={...terminalFailure,receipt:{...terminalFailure.receipt,provider_batch_done:false,provider_batch_status:'JOB_STATE_RUNNING'}};
  const pendingAccounting=cohortAccounting([acceptedPending],{jobs,budget:{limit_micro:5_000_000,committed_micro:100,unbounded_unresolved:0}});
  assert.equal(pendingAccounting.ready,false);assert.deepEqual(pendingAccounting.blocked_requests,['hold']);
  assert.equal(cProgressSummary({jobs,provider_processing_complete:pendingAccounting.ready,publication_accounting:pendingAccounting}).complete,false);
});

test('ownerless lock fails closed without deleting a lock that another supervisor may still be initializing',async()=>{
  const p=paths(),lockDir=join(p.dir,'lock');mkdirSync(lockDir);
  await assert.rejects(acquireCFileLock({lockDir,workspaceRoot:p.dir,identity:{pid:2},validateIdentity:()=>true,isIdentityAlive:async()=>false}),/lock_owner_unavailable/);
  assert.equal(existsSync(lockDir),true);
});

test('stop request drains a verified saved worker before returning a stopped state',async()=>{
  const p=paths(),identity={pid:803,role:'worker',campaign_dir:p.dir,creation_time:'start',command_hash:'hash'};let alive=true,launches=0;
  writeFileSync(p.statePath,JSON.stringify({campaign_id:'C',started_at:100,polls:0,worker_starts:1,worker_pid:803,worker_identity:identity,events:[]}));
  const state=await runCContinuation({campaignId:'C',campaignDir:p.dir,...p,now:()=>100,policy,maxPolls:4,
    readReport:async()=>({complete:false,denominator:100,pending:1,provider_processing_complete:false}),
    isAlive:async()=>alive,stopRequested:()=>true,sleep:async()=>{alive=false;},launch:async()=>{launches++;}});
  assert.equal(state.status,'stopped');assert.equal(state.worker_pid,null);assert.equal(launches,0);
  assert.ok(state.events.some(event=>event.event==='draining_existing_worker'));
});

test('concurrent stale-lock recovery allows one owner and preserves its lease',async()=>{
  const p=paths(),lockDir=join(p.dir,'lock'),reclaim=lockDir+'.reclaim';mkdirSync(lockDir);writeFileSync(join(lockDir,'owner.json'),JSON.stringify({identity:{pid:10,role:'supervisor',campaign_dir:p.dir,creation_time:'old',command_hash:'old'}}));
  const validateIdentity=value=>value?.role==='supervisor'&&value.campaign_dir===p.dir;
  const isIdentityAlive=async value=>value.pid===20;
  const args=identity=>({lockDir,workspaceRoot:p.dir,identity,validateIdentity,isIdentityAlive});
  const outcomes=await Promise.allSettled([acquireCFileLock(args({pid:20,role:'supervisor',campaign_dir:p.dir,creation_time:'new',command_hash:'new'})),
    acquireCFileLock(args({pid:21,role:'supervisor',campaign_dir:p.dir,creation_time:'newer',command_hash:'newer'}))]);
  assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(outcomes.filter(x=>x.status==='rejected').length,1);
  const owner=JSON.parse(readFileSync(join(lockDir,'owner.json'),'utf8')).identity;
  assert.ok([20,21].includes(owner.pid));assert.equal(existsSync(reclaim),false);
});
