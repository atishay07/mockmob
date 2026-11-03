import test from 'node:test';
import assert from 'node:assert/strict';
import {contentHash} from '../../../data/content_evidence.js';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
import {reassessedStagingInventory,currentCCodeHashes,assertCCodeBinding,C_CODE_FILES,C_SOURCE_OVERLAY_PATH,candidateCSourceViews,assertCandidateCPrivateSourceOverlay,priorCampaignPlanningContext,planningReferenceContext,assertCandidateCPrerequisites,assertCandidateCBankDisposed,assertCandidateCFixedCohort,refreshCoverageWithCurrentReassessment} from '../lib/candidateCRegistration.mjs';
import {retrieveFocusedSources} from '../lib/focusedSources.mjs';
import {focusedBriefsV7} from '../lib/focusedBriefsV7.mjs';
import {chapterMappingVerdict} from '../lib/factoryEvidence.mjs';
import {readFileSync} from 'node:fs';
const question=(id,group=null)=>({id,subject:'english',chapter:'Vocabulary',body:'A complete printed stem '+id,options:['A','B','C','D'],correct_answer:'A',explanation:'Complete explanation',passage_group_id:group});
const profile=qs=>({contract:'registered-contract',verifier:'registered-verifier',content_hashes:qs.map(q=>[q.id,contentHash(q)])});
const row=(q,state='eligible')=>({id:q.id,content_hash:contentHash(q),contract:'registered-contract',verifier:'registered-verifier',state});

test('C coverage refuses pending reassessment and excludes stale content and whole rejected passage units',()=>{
  const qs=[question('standalone'),question('changed'),question('passage-1','group'),question('passage-2','group')],p=profile(qs);
  assert.throws(()=>reassessedStagingInventory(qs,[row(qs[0])],p),/reassessment_incomplete:3/);
  const observations=qs.map(q=>row(q));observations[3].state='quarantined';
  const staged=structuredClone(qs);staged[1].body+=' edit';
  const out=reassessedStagingInventory(staged,observations,p);assert.deepEqual(out.inventory.map(q=>q.id),['standalone']);assert.equal(out.excluded,3);
  observations[1].contract='stale-contract';assert.throws(()=>reassessedStagingInventory(staged,observations,p),/reassessment_incomplete:1/);
});
test('C preparer gate requires 100 terminal rows in each comparison arm and 662 terminal bank dispositions',()=>{
  const arms=['baseline','improved'].map(name=>({name,report:{complete:true,denominator:100,pending:0},
    campaign:{id:'campaign-'+name,jobs:Array.from({length:100},(_,i)=>({id:name+'-'+i,subject:['english','accountancy','business_studies','economics'][i%4]}))},
    items:Array.from({length:100},(_,i)=>({id:name+'-'+i,state:i%2?'eligible':'quarantined'}))}));
  arms.forEach(arm=>arm.report.id=arm.campaign.id);
  const reassessment={denominator:662,verifier:'v',contract:'c',content_hashes:Array.from({length:662},(_,i)=>['bank-'+i,'hash-'+i])};
  const results=reassessment.content_hashes.map(([id,content_hash])=>({id,content_hash,verifier:'v',contract:'c',state:'eligible',source_refs:[{id:'source',version:1,locator:id}]}));
  reassessment.source_refs_hash=hashJSON(results.map(row=>row.source_refs));
  const history=[{id:'bank-0',state:'provider_error'},...results];
  assert.deepEqual(assertCandidateCPrerequisites(arms,reassessment,history),{comparison_candidates:200,bank_candidates:662,terminal:true});
  assert.deepEqual(assertCandidateCBankDisposed(reassessment,history),{bank_candidates:662,latest_unique_ids:662,terminal:true});
  const incompleteArm=structuredClone(arms);incompleteArm[1].items[99].state='waiting_validation';
  assert.throws(()=>assertCandidateCPrerequisites(incompleteArm,reassessment,results),/comparison_arm_incomplete:improved/);
  const incompleteBank=structuredClone(results);incompleteBank[661].state='waiting_validation';
  assert.throws(()=>assertCandidateCPrerequisites(arms,reassessment,incompleteBank),/reassessment_incomplete:1/);
  assert.throws(()=>assertCandidateCPrerequisites(arms,reassessment,[...results,{id:'unexpected',state:'provider_error'}]),/reassessment_unexpected_id/);
  assert.throws(()=>assertCandidateCBankDisposed(reassessment,results.slice(1)),/reassessment_latest_ids_incomplete/);
  const changedSources=structuredClone(results);changedSources[0].source_refs[0].locator='changed';
  assert.throws(()=>assertCandidateCBankDisposed(reassessment,changedSources),/reassessment_source_refs_mismatch/);
  const duplicateProfile=structuredClone(reassessment);duplicateProfile.content_hashes[661]=duplicateProfile.content_hashes[0];
  assert.throws(()=>assertCandidateCBankDisposed(duplicateProfile,results),/bank_662_disposition_required/);
});
test('C fixed cohort has exactly 25 candidates for each of the four authorized subjects',()=>{
  const jobs=['english','accountancy','business_studies','economics'].flatMap(subject=>Array.from({length:25},(_,i)=>({id:subject+'-'+i,subject})));
  assert.equal(assertCandidateCFixedCohort(jobs),true);
  assert.throws(()=>assertCandidateCFixedCohort(jobs.slice(1)),/fixed_100_with_25/);
  assert.throws(()=>assertCandidateCFixedCohort([...jobs.slice(0,24),{id:'other',subject:'history'},...jobs.slice(25)]),/fixed_100_with_25/);
});
test('current reassessment tags alone rebuild topic counters; conflicting, missing, and stale matches stay unclassified',()=>{
  const profile={verifier:'current-v7.2',contract:'current-contract',content_hashes:[['valid','h-valid'],['conflict','h-conflict'],['missing','h-missing'],['stale','h-stale']]};
  const makeRow=(id,hash,tags,state='eligible')=>({id,verifier:profile.verifier,contract:profile.contract,content_hash:hash,state,
    result:{question:{evidence:{record:{checks:{schema:{candidate_id:id,content_hash:hash},
      blind_solution:tags?.[0]===undefined?{}:{syllabus_topic:tags[0]},
      independent_evaluation:tags?.[1]===undefined?{}:{syllabus_topic:tags[1]}}}}}}});
  const observations=profile.content_hashes.map(([id])=>({id,tags:['legacy tag A','legacy tag B'],format:'mcq',difficulty:'medium',official_topic_assigned:true}));
  const coverage={total_usable:4,cells:[{subject:'accountancy',chapter:'Vocabulary',usable:4,formats:{mcq:4},difficulties:{medium:4},
    topics:[{id:'a',text:'Alpha Topic',usable:4,formats:{mcq:4},difficulties:{medium:4}},{id:'b',text:'Beta Topic',usable:0,formats:{},difficulties:{}}],
    topic_unclassified:0,validated_topic_observations:observations}]};
  const before=structuredClone(coverage),results=[
    makeRow('valid','h-valid',['Alpha Topic','alpha topic']),
    makeRow('conflict','h-conflict',['Alpha Topic','Beta Topic']),
    makeRow('missing','h-missing',['Alpha Topic',undefined]),
    makeRow('stale','wrong-hash',['Alpha Topic','Alpha Topic'])
  ];
  const out=refreshCoverageWithCurrentReassessment(coverage,results,profile),cell=out.cells[0];
  assert.deepEqual(coverage,before,'helper is pure');
  assert.equal(cell.topics[0].usable,1);assert.deepEqual(cell.topics[0].formats,{mcq:1});assert.deepEqual(cell.topics[0].difficulties,{medium:1});
  assert.equal(cell.topics[1].usable,0);assert.equal(cell.topic_unclassified,3);
  assert.deepEqual(cell.validated_topic_observations.map(o=>o.official_topic_assigned),[true,false,false,false]);
  assert.deepEqual(cell.validated_topic_observations[0].tags,['legacy tag A','legacy tag B']);
  assert.equal(cell.validated_topic_observations[3].current_reassessment_match,false);
  assert.equal(cell.usable,4);assert.deepEqual(cell.formats,{mcq:4});assert.deepEqual(cell.difficulties,{medium:4});
});
test('novelty context retains rejected and pending attempts without treating them as usable coverage',()=>{
  const jobs=[{id:'a',topic:'test "elated"',state:'queued'},{id:'b',topic:'unwritten previous attempt',state:'waiting_authoring'}];
  const items=[{id:'a',state:'quarantined',candidate:{body:'Meaning of "elated"?',source_refs:[{id:'dictionary',version:1,locator:'sense',support_hash:'h'}]}}];
  const context=priorCampaignPlanningContext([{campaign:{jobs},items}]);
  assert.equal(context.length,2);assert.equal(context[0].body,'Meaning of "elated"?');assert.equal(context[0].attempt_state,'quarantined');
  assert.equal(context[1].attempt_state,'waiting_authoring');assert.ok(context.every(q=>q.planning_only));
  assert.throws(()=>priorCampaignPlanningContext([{campaign:{jobs:[...jobs,jobs[0]]},items}]),/planning_id_invalid/);
});
test('historical parent references rank derived teaching excerpts without changing saved source evidence',()=>{
  const ref={id:'book',version:1,locator:'parent',support_hash:'old-hash'},context=[{id:'old',source_refs:[ref]}];
  const registry={sources:{book:{version:1,supports:{derived:'new-hash'},normative_context:{derived:{parent_locator:'parent',parent_support_hash:'old-hash'}}}}};
  const result=planningReferenceContext(context,registry);
  assert.deepEqual(context[0].source_refs,[ref]);assert.equal(result[0].source_refs.length,2);assert.equal(result[0].source_refs[1].locator,'derived');
  assert.equal(planningReferenceContext([{source_refs:[{...ref,support_hash:'changed'}]}],registry)[0].source_refs.length,1);
});
test('C pins transport, source selection, budget and repair dependencies before dispatch',()=>{
  const read=path=>Buffer.from('fixture file:'+path),hashes=currentCCodeHashes(read);assertCCodeBinding(hashes,read);
  for(const path of C_CODE_FILES)assert.throws(()=>assertCCodeBinding(hashes,p=>read(p)+(p===path?'changed':'')),/registered_dependency_changed/);
  assert.throws(()=>assertCCodeBinding({...hashes,extra:'x'},read),/complete_code_binding/);
});
test('C retrieval exposes only verified teaching facts while its validation registry preserves historical source facts',()=>{
  const source=JSON.parse(readFileSync('data/source_registry.json')).sources['ncert-leac101'];
  const result=candidateCSourceViews({sources:{[source.id]:source}}),selected=result.selection_registry.sources[source.id];
  assert.ok(Object.keys(selected.facts).length);assert.ok(Object.keys(selected.facts).every(k=>k.startsWith('teaching-context-')));
  assert.ok(Object.values(selected.facts).every(f=>!f.text.includes('loan is to be given @ 12%')));
  for(const [k,v]of Object.entries(source.facts))assert.deepEqual(result.registry.sources[source.id].facts[k],v);
});
test('private NCERT source overlay pins document/page identities and separates the chapter alias from selection',()=>{
  const full=JSON.parse(readFileSync('data/source_registry.json','utf8'));
  const legacy=full.sources['ncert-leac201'];
  const overlay=JSON.parse(readFileSync(C_SOURCE_OVERLAY_PATH,'utf8'));
  const binding=assertCandidateCPrivateSourceOverlay(overlay,full);
  assert.equal(binding.source_id,'ncert-leac203');assert.equal(binding.edition,'Reprint 2026-27');assert.equal(binding.pdf_page_count,27);
  assert.equal(Object.keys(binding.page_text_sha256).length,12);assert.equal(Object.keys(overlay.source.facts).length,19);
  assert.ok(Object.values(overlay.fact_page_map).every(page=>!([5,6,7,8,9,14,15,16,17,18,19,20,25,26,27].includes(page))));
  const views=candidateCSourceViews(full,overlay),selection=views.selection_registry;
  assert.deepEqual(legacy.chapters,['Share Capital','Financial Statements of Company'],'input registry is not mutated');
  assert.deepEqual(views.registry.sources['ncert-leac201'].chapters,['Share Capital','Financial Statements of Company'],'validation mapping is retained');
  assert.deepEqual(selection.sources['ncert-leac201'].chapters,['Share Capital'],'legacy alias is excluded from C generation');
  assert.deepEqual(selection.sources['ncert-leac203'].chapters,['Financial Statements of Company']);
  assert.ok(selection.packs['original-accountancy-reference-v1'].document_ids.includes('ncert-leac203'));
  const financial=retrieveFocusedSources(selection,{subject:'accountancy',chapter:'Financial Statements of Company',topic:'current assets classification'},null);
  assert.ok(financial.refs.length>0);assert.ok(financial.refs.every(ref=>ref.id==='ncert-leac203'));
  const share=retrieveFocusedSources(selection,{subject:'accountancy',chapter:'Share Capital',topic:'share issue'},null);
  assert.ok(share.refs.length>0);assert.ok(share.refs.every(ref=>ref.id==='ncert-leac201'));
  const mapped=chapterMappingVerdict({subject:'accountancy',assigned:'Financial Statements of Company',luna:'Financial Statements of Company',gemini:'Financial Statements of Company',cited:['ncert-leac201'],sources:views.registry.sources});
  assert.equal(mapped.ok,true);assert.ok(mapped.covered.includes('Financial Statements of Company'),'legacy alias stays visible to validators');
  const base='artifacts/question-factory/cuet-readiness-2026-10-08/',reassessment=JSON.parse(readFileSync(base+'reassessment/profile.json','utf8'));
  const results=readFileSync(base+'reassessment/results.jsonl','utf8').trim().split(/\r?\n/).map(JSON.parse);
  const coverage=refreshCoverageWithCurrentReassessment(JSON.parse(readFileSync(base+'execution/reassessed-staging-coverage.json','utf8')),results,reassessment);
  const planned=focusedBriefsV7(coverage,selection,{campaignId:'c-source-review-fixture',perSubject:25,branch:'financial_analysis'});
  assert.equal(planned.length,100);assert.equal(planned.filter(job=>job.subject==='accountancy').length,25);
  const financialJobs=planned.filter(job=>job.subject==='accountancy'&&job.chapter==='Financial Statements of Company');
  assert.ok(financialJobs.length>0,'actual coverage planner must allocate a Unit V financial statements job');
  const financialRefs=financialJobs.map(job=>retrieveFocusedSources(selection,job,null).refs);
  assert.ok(financialRefs.every(refs=>refs.length>0&&refs.every(ref=>ref.id==='ncert-leac203')));
  const changed=structuredClone(overlay);changed.source.identity_sha256='0'.repeat(64);
  assert.throws(()=>assertCandidateCPrivateSourceOverlay(changed,full),/context_document_or_extraction_changed/);
});
