import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,readdirSync,renameSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {openIdeaAllocatorV76,DEFAULT_IDEA_ALLOCATION_V76_PATH,IDEA_ALLOCATION_V76_CONTRACT} from '../lib/ideaAllocationV76.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex');
const defaultBefore=existsSync(resolve(DEFAULT_IDEA_ALLOCATION_V76_PATH))?readFileSync(resolve(DEFAULT_IDEA_ALLOCATION_V76_PATH),'utf8'):null;
const ref=id=>({id,version:1,locator:'definition',support_hash:digest(id)});
const ordering=(id='j1',source='source-a')=>({id,subject:'english',chapter:'Para Jumbles',format:'sequence_ordering',source_refs:[ref(source)]});
const matching=(id='j1',words=['a','b','c','d'])=>({id,subject:'english',chapter:'Match the Following',format:'matching',source_refs:words.map(w=>ref('oxford-quality-'+w))});
function fixture(){
  const dir=mkdtempSync(join(tmpdir(),'mm-v76-allocation-'));
  return {dir,path:join(dir,'allocation.json'),legacyPath:join(dir,'legacy.json'),marker:join(dir,'preregistration.json')};
}
function registration(f,name='preregistration.json'){const text='{"fixed":40}\n';return {path:join(f.dir,name),sha256:digest(text),text};}
function allocator(f,extra={}){return openIdeaAllocatorV76({path:f.path,legacyPath:f.legacyPath,...extra});}
function reserve(a,f,{campaignId='c1',jobs=[ordering()],name}={}){const r=registration(f,name);return {...a.reserve({campaignId,jobs,registration:r}),registration:r};}

test('intent is durable before the marker; restart with the same job is idempotent and never releases it',()=>{
  const f=fixture(),a=allocator(f),first=reserve(a,f);
  assert.equal(existsSync(f.marker),false);
  assert.equal(JSON.parse(readFileSync(f.path,'utf8')).intents[first.intent_id].state,'reserved');
  a.close();
  const restarted=allocator(f);
  try{
    assert.equal(reserve(restarted,f).idempotent,true);
    assert.equal(restarted.reconcile().allocations,1);
    assert.equal(readdirSync(f.path+'.intents').filter(n=>n.startsWith('intent-')).length,1);
    assert.throws(()=>reserve(restarted,f,{campaignId:'c2',jobs:[ordering('other')],name:'other.json'}),/ordering_source_overlap/);
    assert.throws(()=>reserve(restarted,f,{jobs:[ordering('j1','changed')],name:'changed.json'}),/same_job_changed/);
    assert.throws(()=>reserve(restarted,f,{jobs:[{...ordering(),family_id:'relabelled-family'}],name:'relabeled.json'}),/same_job_changed/);
  }finally{restarted.close();}
});

test('a crash after intent before the index or registration marker cannot free the reserved source',()=>{
  const f=fixture(),a=allocator(f);reserve(a,f);a.close();
  // Reconstruct the exact crash boundary: only the immutable intent has reached its
  // final name; snapshot and preregistration marker have not. Preserve the old index.
  renameSync(f.path,join(f.dir,'pre-crash-index-history.json'));
  const restarted=allocator(f);
  try{
    assert.equal(existsSync(f.marker),false);
    assert.throws(()=>reserve(restarted,f,{campaignId:'c2',jobs:[ordering('other')],name:'other.json'}),/ordering_source_overlap/);
    assert.equal(restarted.reconcile().outcomes[0].state,'reserved');
    assert.equal(reserve(restarted,f).idempotent,true);
  }finally{restarted.close();}
});

test('complete unrenamed intent checkpoints are consumed; an incomplete checkpoint blocks rather than resets',()=>{
  const f=fixture(),a=allocator(f),r=reserve(a,f);a.close();
  const intent=join(f.path+'.intents','intent-'+r.intent_id+'.json');
  renameSync(intent,intent+'.123.fixture.tmp');
  renameSync(f.path,join(f.dir,'index-history.json'));
  const restarted=allocator(f);
  try{
    assert.throws(()=>reserve(restarted,f,{campaignId:'c2',jobs:[ordering('other')],name:'other.json'}),/ordering_source_overlap/);
    assert.equal(restarted.reconcile().allocations,1);
    writeFileSync(intent+'.456.partial.tmp','{"contract":');
    assert.throws(()=>restarted.reconcile(),/uncertain_intent_checkpoint/);
  }finally{restarted.close();}
});

test('exact registration commits once; missing or changed markers never release committed or uncertain allocations',()=>{
  const f=fixture(),a=allocator(f),r=reserve(a,f);
  try{
    writeFileSync(r.registration.path,'{"different":true}');
    assert.equal(a.reconcile().outcomes[0].state,'uncertain');
    assert.throws(()=>reserve(a,f,{campaignId:'c2',jobs:[ordering('j2')],name:'c2.json'}),/ordering_source_overlap/);
    writeFileSync(r.registration.path,r.registration.text);
    assert.equal(a.reconcile().outcomes[0].state,'committed');
    const receipt=readFileSync(join(f.path+'.intents','commit-'+r.intent_id+'.json'),'utf8');
    assert.equal(a.reconcile().outcomes[0].state,'committed');
    assert.equal(readFileSync(join(f.path+'.intents','commit-'+r.intent_id+'.json'),'utf8'),receipt);
    renameSync(r.registration.path,join(f.dir,'marker-history.json'));
    assert.equal(a.reconcile().outcomes[0].state,'committed');
    assert.throws(()=>reserve(a,f,{campaignId:'c2',jobs:[ordering('j2')],name:'c2.json'}),/ordering_source_overlap/);
  }finally{a.close();}
});

test('registration must follow intent and a job cannot be moved to another registration',()=>{
  const f=fixture(),a=allocator(f),r=registration(f);
  try{
    writeFileSync(f.marker,r.text);
    assert.throws(()=>a.reserve({campaignId:'c1',jobs:[ordering()],registration:r}),/intent_must_precede_registration_marker/);
    renameSync(f.marker,join(f.dir,'earlier-registration-history.json'));
    reserve(a,f);
    assert.throws(()=>reserve(a,f,{name:'new-marker.json'}),/job_already_reserved_under_another_intent/);
  }finally{a.close();}
});

test('an absent registration marker belongs to one permanent intent, even when another campaign uses disjoint refs',()=>{
  const f=fixture(),a=allocator(f);reserve(a,f);
  try{
    assert.throws(()=>reserve(a,f,{campaignId:'c2',jobs:[ordering('other','disjoint-source')]}),/registration_marker_already_reserved/);
    assert.equal(a.reconcile().allocations,1);
  }finally{a.close();}
});

test('partial matching lexical overlap is blocked across campaigns beyond exact bundle equality',()=>{
  const f=fixture(),a=allocator(f);reserve(a,f,{jobs:[matching()]});
  try{
    assert.throws(()=>reserve(a,f,{campaignId:'c2',jobs:[matching('other',['b','c','d','e'])],name:'c2.json'}),/matching_lexical_overlap/);
    const revised=matching('revised',['b','f','g','h']);revised.source_refs[0]={...revised.source_refs[0],version:2,support_hash:digest('revised definition')};
    assert.throws(()=>reserve(a,f,{campaignId:'c2',jobs:[revised],name:'revised.json'}),/matching_lexical_overlap/);
    assert.throws(()=>reserve(a,f,{jobs:[matching('other',['b','c','d','e'])],name:'same-campaign.json'}),/matching_lexical_overlap/);
    assert.equal(reserve(a,f,{campaignId:'c2',jobs:[matching('disjoint',['e','f','g','h'])],name:'disjoint.json'}).idempotent,false);
  }finally{a.close();}
});

test('matching reuse is explicit and configurable; identical bundles still cannot be relabelled',()=>{
  const f=fixture(),a=allocator(f,{matchingReusePolicy:'allow_within_campaign'});
  try{
    reserve(a,f,{jobs:[matching('j1'),matching('j2',['b','c','d','e'])]});
    assert.throws(()=>reserve(a,f,{campaignId:'c2',jobs:[matching('other',['b','c','d','f'])],name:'c2.json'}),/matching_lexical_overlap/);
    assert.throws(()=>reserve(a,f,{jobs:[matching('j3')],name:'c3.json'}),/matching_bundle_repeated/);
  }finally{a.close();}
  const b=allocator(f,{matchingReusePolicy:'allow'});
  try{assert.equal(reserve(b,f,{campaignId:'c4',jobs:[matching('other',['b','c','d','f'])],name:'c4.json'}).idempotent,false);}
  finally{b.close();}
  assert.throws(()=>allocator(f,{matchingReusePolicy:'unknown'}),/explicit_matching_reuse_policy_required/);
});

test('prior inventory and unsuccessful attempts consume keys read-only; historical V75 rows are never reset',()=>{
  const f=fixture(),legacy={contract:'ordering-source-allocation-v1',allocations:{historical:{campaign_id:'v75-old',job_id:'old-job',subject:'english',chapter:'Para Jumbles',refs:[ref('old-source')],allocated_at:'historical'}}};
  const bytes=JSON.stringify(legacy,null,2)+'\n';writeFileSync(f.legacyPath,bytes);
  const inventory=[matching('old-match')],attempts=[{...ordering('failed-job','attempt-source'),state:'quarantined'}];
  const before=JSON.stringify({inventory,attempts}),a=allocator(f,{inventory,attempts});
  try{
    assert.throws(()=>reserve(a,f,{jobs:[ordering('new','old-source')]}),/ordering_source_overlap/);
    assert.throws(()=>reserve(a,f,{jobs:[ordering('new','attempt-source')]}),/ordering_source_overlap/);
    assert.throws(()=>reserve(a,f,{jobs:[matching('new',['a','f','g','h'])]}),/matching_lexical_overlap/);
    reserve(a,f,{jobs:[ordering('fresh','fresh-source')]});
    assert.equal(readFileSync(f.legacyPath,'utf8'),bytes);
    assert.equal(JSON.stringify({inventory,attempts}),before);
    assert.ok(a.inspect().legacy_and_context.some(c=>c.campaign_id==='v75-old'));
  }finally{a.close();}
});

test('matching history without a format and partial candidates with only envelope format still consume lexical refs',()=>{
  const f=fixture(),bank={...matching('old-bank'),format:undefined,question_type:undefined};
  const attempt={id:'outer-id',subject:'english',chapter:'Vocabulary',format:'matching',state:'quarantined',
    candidate:{id:'partial-candidate',subject:'english',chapter:'Vocabulary',source_refs:matching('x',['e','f','g','h']).source_refs}};
  const before=JSON.stringify({bank,attempt}),a=allocator(f,{inventory:[bank],attempts:[attempt]});
  try{
    assert.throws(()=>reserve(a,f,{jobs:[matching('new-bank-overlap',['a','i','j','k'])]}),/matching_lexical_overlap/);
    assert.throws(()=>reserve(a,f,{jobs:[matching('new-attempt-overlap',['e','i','j','k'])]}),/matching_lexical_overlap/);
    assert.equal(JSON.stringify({bank,attempt}),before);
    assert.equal(existsSync(f.path),false,'blocked proposals never create an allocation index');
  }finally{a.close();}
});

test('live and uncertain owners are refused; nonce ownership is checked before every mutation',()=>{
  const f=fixture(),a=allocator(f);
  assert.throws(()=>allocator(f),/lock_owner_live/);
  assert.throws(()=>allocator(f,{inspectOwner:()=> 'uncertain'}),/lock_owner_uncertain/);
  const ownerPath=join(f.path+'.lock','owner.json'),old=JSON.parse(readFileSync(ownerPath,'utf8'));
  writeFileSync(ownerPath,JSON.stringify({...old,nonce:randomUUID()}));
  assert.throws(()=>reserve(a,f),/lock_lost/);
  assert.throws(()=>a.close(),/lock_lost/);
  // Restore only this isolated test fixture so its original owner may retire the lock.
  writeFileSync(ownerPath,JSON.stringify(old));a.close();
});

test('a dead owner is archived with its nonce, while missing metadata or uncertain recovery stays blocked',()=>{
  const f=fixture(),a=allocator(f),r=reserve(a,f),ownerPath=join(f.path+'.lock','owner.json');
  const old=readFileSync(ownerPath,'utf8');
  const restarted=allocator(f,{inspectOwner:()=> 'dead'});
  try{
    assert.equal(reserve(restarted,f).idempotent,true);
    const retired=readdirSync(f.dir).filter(n=>n.startsWith('allocation.json.lock.retired-'));
    assert.equal(retired.length,1);
    assert.equal(readFileSync(join(f.dir,retired[0],'owner.json'),'utf8'),old);
    assert.equal(restarted.reconcile().outcomes[0].state,'reserved');
    assert.equal(JSON.parse(readFileSync(f.path,'utf8')).intents[r.intent_id].intent.contract,IDEA_ALLOCATION_V76_CONTRACT);
    assert.throws(()=>a.close(),/lock_lost/);
  }finally{restarted.close();}
  const uncertain=fixture();
  // The lifecycle intentionally refuses a crash in lock creation before owner metadata.
  mkdirSync(uncertain.path+'.lock');
  assert.throws(()=>allocator(uncertain,{inspectOwner:()=> 'dead'}),/lock_owner_uncertain/);
  const uncertainRecovery=fixture();mkdirSync(uncertainRecovery.path+'.lock.recovery');
  assert.throws(()=>allocator(uncertainRecovery),/lock_recovery_owner_uncertain/);
});

test('a separate live process excludes another campaign; after exit its reserved intent still excludes competitors',async()=>{
  const f=fixture(),moduleUrl=new URL('../lib/ideaAllocationV76.mjs',import.meta.url).href;
  const script=`import {openIdeaAllocatorV76} from ${JSON.stringify(moduleUrl)};
    const a=openIdeaAllocatorV76(${JSON.stringify({path:f.path,legacyPath:f.legacyPath})});
    a.reserve(${JSON.stringify({campaignId:'child-campaign',jobs:[ordering('child')],registration:registration(f)})});
    process.stdout.write('reserved\\n');setInterval(()=>{},1000);`;
  const child=spawn(process.execPath,['--input-type=module','-e',script],{stdio:['ignore','pipe','pipe'],windowsHide:true});
  let stderr='';child.stderr.on('data',chunk=>{stderr+=chunk;});
  let timer;
  const ready=new Promise((resolveReady,reject)=>{
    timer=setTimeout(()=>reject(Error('child reservation timed out: '+stderr)),10000);
    child.stdout.once('data',chunk=>{clearTimeout(timer);String(chunk).includes('reserved')?resolveReady():reject(Error('unexpected child output'));});
    child.once('exit',code=>{clearTimeout(timer);reject(Error('child exited before reservation: '+code+' '+stderr));});
  });
  try{
    await ready;
    assert.throws(()=>allocator(f),/lock_owner_live/);
    const exited=once(child,'exit');child.kill();await exited;
    const next=allocator(f);
    try{
      assert.equal(next.reconcile().outcomes[0].state,'reserved');
      assert.throws(()=>reserve(next,f,{campaignId:'parent-campaign',jobs:[ordering('parent')],name:'parent.json'}),/ordering_source_overlap/);
    }finally{next.close();}
  }finally{clearTimeout(timer);if(child.exitCode===null&&!child.killed){const exited=once(child,'exit');child.kill();await exited;}}
});

test('isolated tests do not create the default V76 allocation file',()=>{
  const after=existsSync(resolve(DEFAULT_IDEA_ALLOCATION_V76_PATH))?readFileSync(resolve(DEFAULT_IDEA_ALLOCATION_V76_PATH),'utf8'):null;
  assert.equal(after,defaultBefore);
});
