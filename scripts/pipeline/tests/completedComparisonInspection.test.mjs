import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectCompletedComparisonArm,validateCompletedComparisonArm} from '../lib/completedComparisonInspection.mjs';
import {inspectAgainstInventory} from '../lib/batchInspection.mjs';
import {hashJSON} from '../../../data/question_factory_policy.mjs';

function fixture(overrides={}){
  const name='baseline',id='cuet-readiness-baseline-100-2026-10-08';
  const profile={arm:name,contract:'cuet-fit-v7',topology:'dual_blind',measurement_only:true,publication_policy:'never',release:null,
    verifier_version:'cuet-fit-validator-v7.1',prompt_hash:'a'.repeat(64),contract_hash:'b'.repeat(64),registry_version:58};
  const campaign={id,arm:name,denominator:100,measurement_only:true,publication_policy:'never',topology:'dual_blind',verifier:profile.verifier_version,registry_version:58,
    jobs:Array.from({length:100},(_,i)=>({id:`candidate-${i}`}))};
  const items=campaign.jobs.map((job,i)=>({id:job.id,state:i<70?'eligible':'quarantined'}));
  const report={id,complete:true,denominator:100,pending:0,measurement_only:true,publication_policy:'never',provider_processing_complete:false,
    profile:{contract:'cuet-fit-v7',topology:'dual_blind',verifier_version:profile.verifier_version,prompt_hash:profile.prompt_hash},cost:{held_usd:0.42}};
  return {name,campaign,profile,items,report,...overrides};
}

test('completed academic dispositions remain inspectable with an unresolved provider hold',()=>{
  const result=validateCompletedComparisonArm(fixture());
  assert.equal(result.terminal_items,100);
  assert.equal(result.eligible_before_inspection,70);
  assert.equal(result.quarantined_before_inspection,30);
});

test('a nonterminal candidate or pending report refuses inspection',()=>{
  const nonterminal=fixture();nonterminal.items[4].state='queued';
  assert.throws(()=>validateCompletedComparisonArm(nonterminal),/items_not_fully_terminal/);
  const pending=fixture();pending.report.pending=1;
  assert.throws(()=>validateCompletedComparisonArm(pending),/not_fully_terminal/);
});

test('publication policy changes and duplicate or missing IDs refuse the measurement scope',()=>{
  const publication=fixture();publication.profile.publication_policy='allow';
  assert.throws(()=>validateCompletedComparisonArm(publication),/measurement_profile_invalid/);
  const release=fixture();release.profile.release={state:'released'};
  assert.throws(()=>validateCompletedComparisonArm(release),/measurement_profile_invalid/);
  const duplicate=fixture();duplicate.items[1].id=duplicate.items[0].id;
  assert.throws(()=>validateCompletedComparisonArm(duplicate),/items_ids_invalid/);
  const missing=fixture();missing.items.pop();
  assert.throws(()=>validateCompletedComparisonArm(missing),/items_not_fully_terminal/);
});

test('stale content and forged signatures remain proposed evidence failures',()=>{
  const arm=fixture(),profile=arm.profile,registry={version:58,sources:{},families:{}};
  arm.items=arm.items.map((row,index)=>({...row,state:index===0?'eligible':'quarantined'}));
  arm.items=arm.items.map((row,index)=>index===0?{...row,candidate:{id:row.id,subject:'english',chapter:'Factual Passage',question_type:'synonym',
    difficulty:'easy',body:'fresh content',options:['one','two','three','four'],correct_answer:'A',source_refs:[],
    evidence:{signature:'signed',record:{verifier_version:profile.verifier_version,validation_topology:profile.topology,
      checks:{blind_solution:{evaluation_prompt:profile.prompt_hash}}}}}}:row);
  const evaluator=q=>q.body==='fresh content'&&q.evidence.signature==='signed'?{eligible:true,reasons:[]}:{eligible:false,reasons:[q.evidence.signature==='signed'?'content_changed':'untrusted_evidence']};
  const inspect=()=>inspectCompletedComparisonArm({...arm,registry,inventory:[],inspectAgainstInventory,evaluateEvidence:evaluator});
  assert.equal(inspect().proposed.withheld,0);
  arm.items[0].candidate.body='changed after signing';
  const stale=inspect();assert.equal(stale.proposed.withheld,1);assert.equal(stale.proposed.decisions[0].reason,'inspection_evidence_invalid');
  arm.items[0].candidate.body='fresh content';arm.items[0].candidate.evidence.signature='forged';
  const forged=inspect();assert.equal(forged.proposed.withheld,1);assert.equal(forged.proposed.decisions[0].reason,'inspection_evidence_invalid');
});

test('a valid reference excerpt is not reported as independent answer or explanation support',()=>{
  const arm=fixture(),profile=arm.profile,text='The excerpt is present and its identity is intact.',supportHash=hashJSON(text);
  arm.items=arm.items.map((row,index)=>({...row,state:index===0?'eligible':'quarantined'}));
  const row=arm.items[0],candidate={id:row.id,subject:'english',chapter:'Factual Passage',question_type:'synonym',difficulty:'easy',
    body:'fresh content',options:['one','two','three','four'],correct_answer:'A',
    source_refs:[{id:'reference',version:1,locator:'page-1',support_hash:supportHash}],
    evidence:{signature:'untrusted',record:{verifier_version:profile.verifier_version,validation_topology:profile.topology,
      checks:{blind_solution:{evaluation_prompt:profile.prompt_hash}}}}};
  row.candidate=candidate;
  const registry={version:58,sources:{reference:{state:'active',version:1,reuse_permitted:true,identity_sha256:'source-hash',extraction_checked:true,
    kind:'reference',facts:{'page-1':{text}},supports:{'page-1':supportHash}}},families:{}};
  const result=inspectCompletedComparisonArm({...arm,registry,inventory:[],inspectAgainstInventory,
    evaluateEvidence:()=>({eligible:false,reasons:['untrusted_evidence']})});
  assert.equal(result.excerpt_integrity.valid_reference_rows,1);
  assert.equal(result.excerpt_integrity.invalid_reference_rows,0);
  assert.equal(result.source_support.passed,0);
  assert.equal(result.explanation_support.passed,0);
  assert.equal(result.source_support.evidence[0].source_support,null);
  assert.equal(result.explanation_support.evidence[0].explanation_support,null);
});
