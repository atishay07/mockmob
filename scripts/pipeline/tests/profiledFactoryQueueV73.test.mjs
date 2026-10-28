import test from 'node:test';
import assert from 'node:assert/strict';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { assertQueueStagingTarget, assertPinnedQueueJobV73, assertProfiledPassageGroupV73,
  assertProfiledPublicationV73, prepareProfiledQueueRowsV73, reconstructProfiledOriginalBrief, routeQueueValidation, validationPathForQueueJob } from '../lib/profiledFactoryQueueV73.mjs';
import { selectProfiledWaveV73, passagePublicationState, refIsCurrent, oversizedProfiledPassageGroupsV73, requiresProfiledQueueLeaseV73, hasValidationProfilePinV73, filterProfiledQueueInventoryV73 } from '../lib/profiledFactoryQueueV73.mjs';
import { currentRegistry } from '../../../data/evidence_registry.js';

const profile={profile_version:'factory-validation-profile-v1',campaign_id:'v73-commerce-campaign',profile_sha256:'a'.repeat(64),verifier_version:'cuet-fit-validator-v7.3',validation_contract_hash:'b'.repeat(64),topology:'dual_blind'};
const text='A source-backed definition and decisive excerpt for this focused generation brief.';
const ref={id:'source-1',version:3,locator:'definition',support_hash:hashJSON(text)};
function registry(){return {sources:{'source-1':{state:'active',reuse_permitted:true,version:3,supports:{definition:ref.support_hash},facts:{definition:{text}}}},packs:{pack1:{state:'active',version:2,subject:'economics',document_ids:['source-1']}},families:{fam1:{state:'active',source_pack_id:'pack1'}},exam_specs:{economics:{state:'verified',included_topics:['utility'],excluded_topics:[],pattern_version:'v1'}},passage_groups:{}};}
function job(id='new-candidate-1'){return {id,kind:'original_practice',subject:'economics',chapter:'Introduction & Theory of Consumer Behaviour',topic:'utility',format:'conceptual_mcq',difficulty:'medium',family_id:'fam1',source_pack_id:'pack1',source_pack_version:2,source_refs:[ref],avoidance:['prior idea'],requested_answer_position:'B'};}
const campaign=jobs=>({id:profile.campaign_id,cap_usd:50,jobs,denominator:jobs.length,fixed_candidate_ids:jobs.map(x=>x.id)});

test('profile pinning survives queue restart and reconstructs the exact original-practice brief',()=>{
 const rows=prepareProfiledQueueRowsV73(campaign([job()]),profile,{registry:registry()});
 assert.equal(rows.length,1);assert.equal(rows[0].anchor_id,null);assert.equal(rows[0].generation_brief.validation_profile.profile_sha256,profile.profile_sha256);
 const restored=reconstructProfiledOriginalBrief(rows[0],profile);
 assert.deepEqual(restored,{...job(),campaign_cap_usd:50,campaign_denominator:1,campaign_candidate_ids:['new-candidate-1'],anchor_id:null});
 assert.equal(validationPathForQueueJob(rows[0]),'v73');
});

test('unprofiled jobs stay on legacy routing, malformed or stale pins fail closed',()=>{
 assert.equal(validationPathForQueueJob({generation_brief:{topic:'x'}}),'legacy');
 assert.throws(()=>validationPathForQueueJob({generation_brief:{validation_profile:{campaign_id:'x'}}}),/malformed/);
 const row={id:'new',kind:'original_practice',anchor_id:null,generation_brief:{validation_profile:profile}};
 assert.throws(()=>assertPinnedQueueJobV73(row,{assertProfile:()=>({...profile,profile_sha256:'c'.repeat(64)})}),/stale/);
 assert.throws(()=>reconstructProfiledOriginalBrief(row,{...profile,profile_sha256:'c'.repeat(64)}),/stale/);
});

test('profiled inventory filter selects pin presence, including malformed and null pins, without version equality',()=>{
 const calls=[];const query={not:(...args)=>{calls.push(args);return query;}};
 assert.equal(filterProfiledQueueInventoryV73(query),query);
 assert.deepEqual(calls,[['generation_brief->validation_profile','is',null]]);
 assert.equal(hasValidationProfilePinV73({generation_brief:{validation_profile:null}}),true);
 assert.equal(hasValidationProfilePinV73({generation_brief:{validation_profile:{profile_version:'unknown'}}}),true);
 assert.equal(hasValidationProfilePinV73({generation_brief:{topic:'legacy'}}),false);
});

test('validation routing calls V7.3 only for a current pin and never falls back on a stale pin',async()=>{
 const row=prepareProfiledQueueRowsV73(campaign([job()]),profile,{registry:registry()})[0];let v73=0,legacy=0;
 const valid=await routeQueueValidation(row,{id:row.id},{assertProfile:()=>profile,validateV73:async(candidate,pinned)=>{v73++;assert.equal(pinned.profile_sha256,profile.profile_sha256);return 'v73-result';},validateLegacy:async()=>{legacy++;return 'legacy-result';}});
 assert.equal(valid,'v73-result');assert.equal(v73,1);assert.equal(legacy,0);
 const stale={...row,generation_brief:{...row.generation_brief,validation_profile:{...profile,profile_sha256:'f'.repeat(64)}}};
 await assert.rejects(()=>routeQueueValidation(stale,{id:row.id},{assertProfile:()=>{throw new Error('stale_release');},validateV73:async()=>{v73++;},validateLegacy:async()=>{legacy++;}}),/stale_release/);
 assert.equal(v73,1);assert.equal(legacy,0);
 const unprofiled=await routeQueueValidation({id:'legacy-job'}, {}, {validateLegacy:async()=>{legacy++;return 'legacy-result';},validateV73:async()=>{v73++;}});
 assert.equal(unprofiled,'legacy-result');assert.equal(legacy,1);assert.equal(v73,1);
});

test('enqueue rejects campaign/profile mismatch, existing IDs, duplicates, inactive families and stale source refs',()=>{
 const reg=registry();
 assert.throws(()=>prepareProfiledQueueRowsV73({...campaign([job()]),id:'other-campaign'},profile,{registry:reg}),/campaign_profile_id_mismatch/);
 assert.throws(()=>prepareProfiledQueueRowsV73(campaign([job()]),profile,{registry:reg,existingIds:['new-candidate-1']}),/candidate_id_exists/);
 assert.throws(()=>prepareProfiledQueueRowsV73(campaign([job(),job()]),profile,{registry:reg}),/candidate_id_exists/);
 reg.families.fam1.state='blocked';assert.throws(()=>prepareProfiledQueueRowsV73(campaign([job()]),profile,{registry:reg}),/family_or_pack_not_current/);
 const stale=registry();stale.sources['source-1'].state='inactive';assert.throws(()=>prepareProfiledQueueRowsV73(campaign([job()]),profile,{registry:stale}),/source_refs_not_current/);
 const changedText=registry();changedText.sources['source-1'].facts.definition.text='altered source text';assert.throws(()=>prepareProfiledQueueRowsV73(campaign([job()]),profile,{registry:changedText}),/source_refs_not_current/);
 assert.throws(()=>prepareProfiledQueueRowsV73({...campaign([job()]),denominator:2},profile,{registry:registry()}),/fixed_denominator/);
});

test('fixed 100-candidate campaign persists every ID once and worker selects bounded waves without splitting passage groups',()=>{
 const jobs=Array.from({length:100},(_,i)=>job(`campaign-candidate-${String(i).padStart(3,'0')}`));
 const rows=prepareProfiledQueueRowsV73(campaign(jobs),profile,{registry:registry()});
 assert.equal(rows.length,100);assert.deepEqual(rows[0].generation_brief.campaign_candidate_ids,jobs.map(j=>j.id));
 const groupRows=rows.map((row,index)=>({...row,state:'queued',passage_group_id:index===0||index===1?'pg':null}));
 const wave=selectProfiledWaveV73(groupRows,10);
 assert.equal(wave.length,10);assert.equal(new Set(wave.filter(r=>r.passage_group_id).map(r=>r.passage_group_id)).size,1);
 assert.deepEqual(wave.slice(0,2).map(r=>r.id),jobs.slice(0,2).map(j=>j.id));
});

test('source support hashes match literal text across current registry locators offline',()=>{
 const reg=currentRegistry();let checked=0;
 for(const [sourceId,source] of Object.entries(reg.sources||{}))for(const [locator,supportHash] of Object.entries(source.supports||{})){
  const text=source.facts?.[locator]?.text;assert.equal(typeof text,'string');
  assert.equal(refIsCurrent({id:sourceId,version:source.version,locator,support_hash:supportHash},reg),true,`${sourceId}:${locator}`);checked++;
 }
 assert.equal(checked,979);
});

test('passage publication waits for pending siblings and closes the full group on any quarantine',()=>{
 const rows=['child-1','child-2'].map((id,index)=>({id,state:index?'waiting':'eligible',passage_group_id:'pg',generation_brief:{validation_profile:profile}}));
 assert.equal(passagePublicationState([rows[0]],rows,'pg',['child-1','child-2']).state,'waiting');
 rows[1].state='quarantined';assert.equal(passagePublicationState([rows[0]],rows,'pg',['child-1','child-2']).state,'quarantined');
 rows[1].state='eligible';assert.equal(passagePublicationState([rows[0]],rows,'pg',['child-1','child-2']).state,'ready');
});

test('publication recovery keeps already-published siblings in the full idempotent group retry',()=>{
 const rows=['child-1','child-2'].map((id,index)=>({id,state:index?'eligible':'published',passage_group_id:'pg',generation_brief:{validation_profile:profile}}));
 const state=passagePublicationState([rows[1]],rows,'pg',['child-1','child-2']);
 assert.equal(state.state,'ready');assert.deepEqual(state.rows.map(row=>row.id),['child-1','child-2']);
});

test('oversized passage groups fail enqueue and are explicitly found in malformed persisted inventories',()=>{
 const reg=registry();reg.packs.pack1.document_ids=['source-1'];
 const ids=Array.from({length:11},(_,i)=>`oversized-child-${i}`);
 reg.passage_groups.pg={state:'active',kind:'original_practice',source_pack_id:'pack1',candidate_ids:ids,passage_text:'Shared source-backed passage.'};
 const jobs=ids.map(id=>({...job(id),passage_group_id:'pg',passage_text:'Shared source-backed passage.'}));
 assert.throws(()=>prepareProfiledQueueRowsV73(campaign(jobs),profile,{registry:reg}),/wave_size_exceeded/);
 const persisted=ids.map(id=>({id,passage_group_id:'pg',state:'queued'}));
 assert.equal(oversizedProfiledPassageGroupsV73(persisted,reg).get('pg').length,11);
 assert.throws(()=>selectProfiledWaveV73(persisted,10),/wave_size_exceeded/);
});

test('any profiled job mutation or publication requires the remote worker lease, even without authoring work',()=>{
 assert.equal(requiresProfiledQueueLeaseV73({}),false);
 assert.equal(requiresProfiledQueueLeaseV73({eligibleCount:1}),true);
 assert.equal(requiresProfiledQueueLeaseV73({invalidCount:1}),true);
 assert.equal(requiresProfiledQueueLeaseV73({authoringCount:1}),true);
});

test('passage members require one complete campaign group and publication requires matching signed V7.3 evidence',()=>{
 const reg=registry();reg.passage_groups.pg={state:'active',kind:'original_practice',source_pack_id:'pack1',candidate_ids:['child-1','child-2']};
 assert.throws(()=>prepareProfiledQueueRowsV73(campaign([{...job('child-1'),passage_group_id:'pg'}]),profile,{registry:reg}),/passage_group_campaign_mismatch/);
 const evidence={state:'eligible',verifier_version:profile.verifier_version,validation_contract_hash:profile.validation_contract_hash,validation_topology:profile.topology,provenance:{kind:'original_practice'}};
 const candidate=id=>({id,family_id:'fam1',provenance:{kind:'original_practice',anchor_id:null,adaptation_family:'fam1'},evidence:{record:evidence,signature:'signed'}});
 const rows=['child-1','child-2'].map(id=>({id,kind:'original_practice',anchor_id:null,passage_group_id:'pg',generation_brief:{validation_profile:profile},candidate:candidate(id)}));
 assert.equal(assertProfiledPassageGroupV73(rows,profile,{assertProfile:()=>profile}),profile.profile_sha256);
 rows[1].generation_brief.validation_profile={...profile,profile_sha256:'d'.repeat(64)};
 assert.throws(()=>assertProfiledPassageGroupV73(rows,profile,{assertProfile:()=>profile}),/stale|group_profile/);
 const bad=candidate('x');bad.evidence.record.validation_contract_hash='wrong';
 assert.throws(()=>assertProfiledPublicationV73(bad,profile,{assertProfile:()=>profile}),/publication_evidence_mismatch/);
 assert.throws(()=>assertProfiledPublicationV73(candidate('x'),profile),/profile_context_required/);
});

test('staging guard requires an explicit approved staging endpoint and credentials',()=>{
 assert.throws(()=>assertQueueStagingTarget({url:'https://onwkqxmjqjrhfbjjdydu.supabase.co',key:'service'}),/explicit_staging/);
 assert.throws(()=>assertQueueStagingTarget({staging:true,url:'https://prod.example',key:'service',productionUrl:'https://prod.example'}),/unapproved_factory_target/);
 assert.throws(()=>assertQueueStagingTarget({staging:true,url:'https://onwkqxmjqjrhfbjjdydu.supabase.co',productionUrl:'https://prod.example'}),/staging_credentials/);
 assert.equal(assertQueueStagingTarget({staging:true,url:'https://onwkqxmjqjrhfbjjdydu.supabase.co',key:'service',productionUrl:'https://prod.example'}),true);
});
