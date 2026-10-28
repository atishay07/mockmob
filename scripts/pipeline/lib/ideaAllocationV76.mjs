// Local lifecycle infrastructure only. No provider, database or academic-verifier dependency.
// Immutable intent files are authoritative: reservations are consumed before a preregistration
// marker can exist, and absence of that marker never frees an idea. Use only after qualification.
import {existsSync,readFileSync,readdirSync,mkdirSync,renameSync,openSync,writeFileSync,fsyncSync,closeSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {saveAtomicArtifact} from './atomicArtifact.mjs';
import {loadIdeaAllocations,DEFAULT_IDEA_ALLOCATION_PATH,isOrderingItem} from './ideaAllocation.mjs';

export const IDEA_ALLOCATION_V76_CONTRACT='durable-idea-allocation-v76-v1';
export const DEFAULT_IDEA_ALLOCATION_V76_PATH='data/question-factory-runtime/idea-allocations-v76.json';
export const MATCHING_REUSE_POLICIES=Object.freeze(['deny_overlap','allow_within_campaign','allow']);
const digest=text=>createHash('sha256').update(text).digest('hex');
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const hash=value=>digest(JSON.stringify(canonical(value)));
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const fail=message=>{throw Error('idea_allocation_v76:'+message);};
const refKey=r=>[r.id,r.version,r.locator,r.support_hash].join(':');
const matching=q=>q.subject==='english'&&(/^(matching|match_type|match_following|match_the_following)$/.test(
  String(q.format||q.question_type||'').toLowerCase().replace(/\s+/g,'_'))||String(q.chapter||'').toLowerCase()==='match the following');
const markerKey=path=>process.platform==='win32'?resolve(path).toLowerCase():resolve(path);
const ownerState=pid=>{try{process.kill(pid,0);return 'live';}catch(e){return e.code==='ESRCH'?'dead':'uncertain';}};
const validOwner=o=>o&&Number.isSafeInteger(o.pid)&&o.pid>0&&typeof o.nonce==='string'&&o.nonce.length>=16;
// Flush the complete temporary file before the atomic rename. A failed checkpoint is retained
// and consumed during reconciliation. No power-loss guarantee beyond the host filesystem.
function durableSave(path,value){
  saveAtomicArtifact(path,value,{write(p,text,options){const fd=openSync(p,options.flag);try{writeFileSync(fd,text);fsyncSync(fd);}finally{closeSync(fd);}}});
}

function claimOf(job,campaignId){
  if(!job?.id||!campaignId)fail('candidate_and_campaign_required');
  const refs=[...(job.source_refs||[])];
  if(refs.some(r=>!r.id||r.version===undefined||!r.locator||!r.support_hash))fail('exact_source_reference_required');
  const ordering=isOrderingItem(job),lexical=matching(job);
  if((ordering||lexical)&&!refs.length)fail('tracked_idea_source_references_required');
  const keys=[...new Set(refs.map(refKey))].sort();
  return {campaign_id:campaignId,job_id:job.id,family_id:job.family_id||null,subject:job.subject||null,chapter:job.chapter||null,
    format:job.format||job.question_type||null,refs,ordering,matching:lexical,
    // Dictionary versions/support hashes stay in exact refs, but changing either
    // cannot turn the same named lexical target into a fresh matching task.
    ordering_keys:ordering?keys:[],matching_keys:lexical?[...new Set(refs.filter(r=>r.id.startsWith('oxford-quality-')).map(r=>r.id))].sort():[],
    bundle_key:(ordering?'ordering:':lexical?'matching:':'reference:')+keys.join('|')};
}
function sameJob(a,b){return a.campaign_id===b.campaign_id&&a.job_id===b.job_id;}
function conflict(a,b,policy){
  if(sameJob(a,b))return hash(a)===hash(b)?null:'same_job_changed';
  if(a.ordering&&b.ordering&&a.ordering_keys.some(k=>b.ordering_keys.includes(k)))return 'ordering_source_overlap';
  if(a.matching&&b.matching){
    if(a.bundle_key===b.bundle_key)return 'matching_bundle_repeated';
    if(policy==='deny_overlap'||policy==='allow_within_campaign'&&a.campaign_id!==b.campaign_id)
      if(a.matching_keys.some(k=>b.matching_keys.includes(k)))return 'matching_lexical_overlap';
  }
  return null;
}
function sourceContext({inventory=[],attempts=[],legacyPath}){
  // Historical V75 rows remain in their original file; every one is imported read-only.
  const legacy=loadIdeaAllocations(legacyPath);
  const old=Object.values(legacy.allocations).map(r=>claimOf({id:r.job_id||hash(r),subject:r.subject,chapter:r.chapter,
    format:'sequence_ordering',source_refs:r.refs||[]},r.campaign_id||'historical-v75'));
  // An attempt envelope may retain its registered format/chapter when its partial
  // candidate does not. Preserve that metadata instead of silently losing its keys.
  const row=(q,i,prefix)=>({...q,...(q.candidate||{}),id:q.candidate?.id||q.id||prefix+'-'+i});
  return [...old,...inventory.map((q,i)=>claimOf(row(q,i,'inventory'),q.campaign_id||'historical-inventory')),
    ...attempts.map((q,i)=>claimOf(row(q,i,'attempt'),q.campaign_id||'historical-attempt'))];
}

function acquireLock(path,{owner,inspectOwner}){
  const lock=path+'.lock',recovery=lock+'.recovery',parent=dirname(lock);
  mkdirSync(parent,{recursive:true});
  const ownerPath=join(lock,'owner.json');
  if(existsSync(recovery))fail('lock_recovery_owner_uncertain');
  try{mkdirSync(lock);}
  catch(error){
    if(error.code!=='EEXIST')throw error;
    let previous;try{previous=read(ownerPath);}catch{fail('lock_owner_uncertain');}
    if(!validOwner(previous))fail('lock_owner_uncertain');
    const status=inspectOwner(previous.pid);
    if(status!=='dead')fail('lock_owner_'+(status==='live'?'live':'uncertain'));
    // Only one process may retire a known-dead lock. A crashed recovery guard is
    // deliberately refused, rather than guessing that an unknown owner is dead.
    try{mkdirSync(recovery);}catch(e){if(e.code==='EEXIST')fail('lock_recovery_owner_uncertain');throw e;}
    durableSave(join(recovery,'owner.json'),owner);
    try{
      const current=read(ownerPath);
      if(hash(current)!==hash(previous)||inspectOwner(current.pid)!=='dead')fail('lock_owner_changed');
      renameSync(lock,lock+'.retired-'+previous.nonce+'-'+randomUUID());
      try{mkdirSync(lock);}catch(e){if(e.code==='EEXIST')fail('lock_contended');throw e;}
    }finally{
      // Preserve the recovery owner's history too; never erase an uncertain lock.
      renameSync(recovery,recovery+'.retired-'+owner.nonce+'-'+randomUUID());
    }
  }
  durableSave(ownerPath,owner);
  if(existsSync(recovery)){
    // A racing recovery may win the gate after our initial check. Retire only
    // this newly created nonce; never overwrite or remove another owner's lock.
    if(read(ownerPath).nonce===owner.nonce)renameSync(lock,lock+'.retired-'+owner.nonce+'-'+randomUUID());
    fail('lock_recovery_contended');
  }
  const assert=()=>{let current;try{current=read(ownerPath);}catch{fail('lock_lost');}
    if(current.pid!==owner.pid||current.nonce!==owner.nonce)fail('lock_lost');};
  return {assert,release(){assert();renameSync(lock,lock+'.retired-'+owner.nonce+'-'+randomUUID());}};
}

function validateIntent(value){
  if(value?.contract!==IDEA_ALLOCATION_V76_CONTRACT||value.kind!=='reservation_intent'||!Array.isArray(value.claims)||
    !value.claims.length||!value.registration?.path||!/^[a-f0-9]{64}$/.test(value.registration.sha256)||
    !MATCHING_REUSE_POLICIES.includes(value.matching_reuse_policy))fail('intent_invalid');
  const core={campaign_id:value.campaign_id,registration:value.registration,claims:value.claims,matching_reuse_policy:value.matching_reuse_policy};
  if(hash(core)!==value.intent_id)fail('intent_identity_mismatch');
  return value;
}
function readPersistent(path){
  const snapshot=existsSync(path)?read(path):{contract:IDEA_ALLOCATION_V76_CONTRACT,allocations:{},intents:{}};
  if(snapshot.contract!==IDEA_ALLOCATION_V76_CONTRACT||!snapshot.allocations||!snapshot.intents)fail('snapshot_contract_mismatch');
  const intents=new Map(),commits=new Map(),dir=path+'.intents';
  if(existsSync(dir))for(const name of readdirSync(dir)){
    if(!/^(intent|commit)-[a-f0-9]{64}\.json(?:\..+\.tmp)?$/.test(name))fail('unrecognized_intent_artifact:'+name);
    let value;try{value=read(join(dir,name));}catch{fail('uncertain_intent_checkpoint:'+name);}
    if(name.startsWith('intent-')){
      validateIntent(value);
      if(!name.startsWith('intent-'+value.intent_id+'.json'))fail('intent_filename_mismatch');
      const existing=intents.get(value.intent_id);
      if(existing&&hash(existing)!==hash(value))fail('intent_checkpoint_disagreement');
      intents.set(value.intent_id,value);
    }else{
      if(value.contract!==IDEA_ALLOCATION_V76_CONTRACT||value.kind!=='registration_commit'||
        !name.startsWith('commit-'+value.intent_id+'.json'))fail('commit_invalid');
      const existing=commits.get(value.intent_id);
      if(existing&&hash(existing)!==hash(value))fail('commit_checkpoint_disagreement');
      commits.set(value.intent_id,value);
    }
  }
  // A snapshot can only add uncertainty, never erase an earlier reservation.
  for(const [id,value] of Object.entries(snapshot.intents)){
    validateIntent(value.intent);
    if(value.intent.intent_id!==id)fail('snapshot_intent_identity_mismatch');
    if(intents.has(id)&&hash(intents.get(id))!==hash(value.intent))fail('snapshot_intent_disagreement');
    intents.set(id,value.intent);
  }
  for(const [id,commit] of commits)if(!intents.has(id))fail('commit_without_intent');
  return {snapshot,intents,commits};
}

// Calling this function is a registration mutation: it creates an owner lock. It must not
// be called against the default path until the exact V76 qualification permits preparation.
export function openIdeaAllocatorV76({path=DEFAULT_IDEA_ALLOCATION_V76_PATH,legacyPath=DEFAULT_IDEA_ALLOCATION_PATH,
  inventory=[],attempts=[],matchingReusePolicy='deny_overlap',owner={pid:process.pid,nonce:randomUUID()},inspectOwner=ownerState}={}){
  if(!MATCHING_REUSE_POLICIES.includes(matchingReusePolicy))fail('explicit_matching_reuse_policy_required');
  if(!validOwner(owner))fail('valid_owner_nonce_required');
  path=resolve(path);const lock=acquireLock(path,{owner,inspectOwner});let closed=false;
  const assert=()=>{if(closed)fail('allocator_closed');lock.assert();};
  const context=()=>sourceContext({inventory,attempts,legacyPath});
  function view(){
    assert();const persisted=readPersistent(path),claims=[...Object.values(persisted.snapshot.allocations).map(r=>r.claim)];
    for(const intent of persisted.intents.values())claims.push(...intent.claims);
    if(claims.some(c=>!c||!Array.isArray(c.ordering_keys)||!Array.isArray(c.matching_keys)))fail('snapshot_claim_invalid');
    return {...persisted,claims};
  }
  function reconcile(){
    const {snapshot,intents,commits}=view();const next=structuredClone(snapshot),outcomes=[];
    for(const [id,intent] of intents){
      let state='reserved',reason='registration_marker_absent';
      const marker=intent.registration.path;
      if(existsSync(marker)){
        if(digest(readFileSync(marker))===intent.registration.sha256){
          state='committed';reason='exact_registration_marker';
          if(!commits.has(id)){
            const commit={contract:IDEA_ALLOCATION_V76_CONTRACT,kind:'registration_commit',intent_id:id,
              registration:intent.registration,committed_at:new Date().toISOString()};
            durableSave(join(path+'.intents','commit-'+id+'.json'),commit);commits.set(id,commit);
          }
        }else{state='uncertain';reason='registration_marker_hash_mismatch';}
      }
      // Committed claims stay committed even if a marker is later lost or altered.
      if(commits.has(id)||snapshot.intents[id]?.state==='committed'){
        const commit=commits.get(id);
        if(commit&&hash(commit.registration)!==hash(intent.registration))fail('commit_registration_mismatch');
        state='committed';
      }
      next.intents[id]={intent,state,reason};
      for(const claim of intent.claims){const key=hash({campaign_id:claim.campaign_id,job_id:claim.job_id});
        const existing=next.allocations[key];
        if(existing&&hash(existing.claim)!==hash(claim))fail('persisted_job_changed');
        next.allocations[key]={...existing,claim,intent_id:id,state};}
      outcomes.push({intent_id:id,state,reason});
    }
    if(intents.size||Object.keys(next.allocations).length)durableSave(path,next);
    return {outcomes,allocations:Object.keys(next.allocations).length};
  }
  return Object.freeze({
    reserve({campaignId,jobs,registration}){
      assert();if(!Array.isArray(jobs)||!jobs.length||new Set(jobs.map(j=>j.id)).size!==jobs.length)fail('unique_jobs_required');
      if(!registration?.path||!/^[a-f0-9]{64}$/.test(registration.sha256))fail('expected_registration_marker_required');
      const claims=jobs.map(j=>claimOf(j,campaignId)),core={campaign_id:campaignId,
        registration:{path:resolve(registration.path),sha256:registration.sha256},claims,matching_reuse_policy:matchingReusePolicy};
      const intentId=hash(core),current=view();
      if(current.intents.has(intentId)){reconcile();return {intent_id:intentId,idempotent:true};}
      if([...current.intents.values()].some(intent=>markerKey(intent.registration.path)===markerKey(core.registration.path)))
        fail('registration_marker_already_reserved');
      if(existsSync(core.registration.path))fail('intent_must_precede_registration_marker');
      const previous=[...context(),...current.claims];
      for(let i=0;i<claims.length;i++)for(const other of [...previous,...claims.slice(0,i)]){
        const reason=conflict(claims[i],other,matchingReusePolicy);if(reason)fail(reason+':'+other.campaign_id+':'+other.job_id);
        // A job reserved in any earlier intent cannot be moved to a different marker.
        if(sameJob(claims[i],other)&&current.claims.some(c=>sameJob(c,other)))fail('job_already_reserved_under_another_intent');
      }
      const intent={contract:IDEA_ALLOCATION_V76_CONTRACT,kind:'reservation_intent',intent_id:intentId,...core,
        reserved_at:new Date().toISOString(),owner:{...owner}};
      mkdirSync(path+'.intents',{recursive:true});
      // This immutable intent comes first. A crash before index/marker leaves consumed claims.
      durableSave(join(path+'.intents','intent-'+intentId+'.json'),intent);
      reconcile();return {intent_id:intentId,idempotent:false};
    },
    reconcile,
    inspect(){const current=view();return {intents:[...current.intents.values()],claims:current.claims,legacy_and_context:context()};},
    close(){if(!closed){lock.release();closed=true;}}
  });
}
