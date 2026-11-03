import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bindBenchmarkFixtureFamily} from '../lib/benchmarkFixtureEnvelope.mjs';
import {blindView} from '../lib/evidencePipeline.mjs';
import {contentHash} from '../../../data/content_evidence.js';
import {provenanceReasons} from '../../../data/question_factory_policy.mjs';

const path='artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/fresh-full-v6-source-keyed';
const frozen=JSON.parse(readFileSync(path+'/frozen.json')),plan=JSON.parse(readFileSync(path+'/run/execution-plan.json')),registry=plan.source_registry;
test('every frozen fixture receives only the registered redundant family binding with identical question and blind request content',()=>{
  for(const f of frozen.fixtures){const c=bindBenchmarkFixtureFamily(f.candidate,registry);assert.equal(c.provenance.adaptation_family,c.family_id);assert.equal(contentHash(c),contentHash(f.candidate));assert.deepEqual(blindView(c,c.source_refs),blindView(f.candidate,f.candidate.source_refs));assert.equal(f.candidate.provenance.adaptation_family,null);}
});
test('wrong non-null binding, another source pack, held family or PYQ cannot be silently normalized',()=>{
  const c=frozen.fixtures[0].candidate;
  for(const change of [{adaptation_family:'wrong'},{kind:'authentic_pyq'},{source_pack_id:'wrong'}])assert.throws(()=>bindBenchmarkFixtureFamily({...c,provenance:{...c.provenance,...change}},registry),/specific_fixture/);
  assert.throws(()=>bindBenchmarkFixtureFamily(c,{...registry,families:{...registry.families,[c.family_id]:{...registry.families[c.family_id],state:'held'}}}),/specific_fixture/);
});
test('an intentional syllabus defect remains rejected after the envelope binding',()=>{
  const f=frozen.fixtures.find(f=>f.category==='out_of_syllabus');assert.ok(f);
  const bound=bindBenchmarkFixtureFamily(f.candidate,registry);
  assert.ok(provenanceReasons(bound,registry).includes('current_syllabus_chapter_not_entitled'));
});
