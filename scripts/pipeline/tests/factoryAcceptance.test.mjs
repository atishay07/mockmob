import test from 'node:test';
import assert from 'node:assert/strict';
import {cohortEconomics,syllabusCoverage,factoryAcceptance} from '../lib/factoryAcceptance.mjs';
import {factoryCalibrationReady} from '../../../data/question_factory_policy.mjs';
const subjects=['english','accountancy','business_studies','economics'];
const jobs=subjects.flatMap(subject=>Array.from({length:25},(_,i)=>({subject,state:'eligible',candidate:{subject,body:`Unique ${i}`,options:['a','b','c','d'],correct_answer:'A'}})));
const input={jobs,cost_usd:.4,held_usd:0,committed_usd:6,ceiling_usd:50,verifier:'v',cohort_verifier:'v',execution_modes:['batch'],preregistered:true};
test('pending, unbalanced, historical and realtime cohorts cannot authorize scaling',()=>{
  assert.equal(cohortEconomics(input).budget_met,true);
  for(const patch of [{committed_usd:undefined},{committed_usd:.1},{published:-1},{target:NaN},{held_usd:.01},{preregistered:false},{cohort_verifier:'old'},{execution_modes:['realtime']},{jobs:jobs.slice(1)},{jobs:jobs.map((j,i)=>i===0?{...j,state:'waiting'}:j)}])assert.equal(cohortEconomics({...input,...patch}).budget_met,false);
});
test('cost denominator excludes duplicates and includes rejected candidates and full spend',()=>{
  const duplicate=structuredClone(jobs);duplicate[0].candidate=duplicate[1].candidate;
  const r=cohortEconomics({...input,jobs:duplicate});assert.equal(r.distinct_automated_eligible,99);assert.equal(r.planned,100);assert.equal(r.cost_per_eligible_usd,.4/99);
  assert.equal(cohortEconomics({...input,cost_usd:1.2}).budget_met,false);
});
test('source documents alone and legacy tags cannot claim syllabus coverage',()=>{
  const scope={subjects:Object.fromEntries(subjects.map(s=>[s,{chapters:['Required']}]))};
  const registry={examples:[{id:'x',subject:'english',chapter:'Required',final_key_matched:true,generation_ready:true,source_pack_id:'p',source_refs:[{id:'s',locator:'l',support_hash:'hash'}]}],packs:{p:{state:'active'}},sources:{s:{kind:'reference',state:'active',chapters:['Legacy'],supports:{l:'hash'}}}};
  assert.equal(syllabusCoverage(registry,scope)[0].chapters[0].ready,false);
  registry.sources.s.chapters=['Required'];assert.equal(syllabusCoverage(registry,scope)[0].chapters[0].ready,true);
  registry.calibration_anchor_ids=['x'];assert.equal(syllabusCoverage(registry,scope)[0].chapters[0].ready,false);
});
test('local test claims and a production ref cannot substitute for authenticated staging',()=>{
  const r=factoryAcceptance({registry:{version:1},manifest:{},verifier:'v',scope:{subjects:{}},staging:{project_ref:'production',production_project_ref:'production',signed_in_admin:true,worker_restart:true,atomic_publication:true,dispute_invalidation:true}});
  assert.equal(r.ready,false);assert.equal(r.gates.authenticated_staging,false);assert.equal(r.guaranteed_error_free,false);assert.equal(factoryCalibrationReady({state:'released'},{version:1},'v'),false);
});

test('dissolution aliases count as one official chapter rather than missing coverage',()=>{
 const scope={subjects:{accountancy:{chapters:['Dissolution of Partnership Firm']}}};
 const registry={examples:[{id:'x',subject:'accountancy',chapter:'Dissolution of Partnership',final_key_matched:true,generation_ready:true,source_pack_id:'p',source_refs:[{id:'s',locator:'l',support_hash:'h'}]}],packs:{p:{state:'active'}},sources:{s:{kind:'reference',state:'active',chapters:['Dissolution of Partnership Firm'],supports:{l:'h'}}}};
 const row=syllabusCoverage(registry,scope).find(s=>s.subject==='accountancy');assert.equal(row.chapters[0].ready,true);assert.deepEqual(row.legacy_chapters_outside_scope,[]);
});


test('a completed historical probe cannot qualify a revised verifier',()=>{
 const r=factoryAcceptance({registry:{version:1},manifest:{},verifier:'new',scope:{subjects:{}},batchProbe:{verifier:'old',complete:true,expected_results_met:true}});
 assert.equal(r.gates.saved_probe,false);
});
