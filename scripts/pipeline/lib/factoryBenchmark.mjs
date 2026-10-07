import {readFileSync} from 'node:fs';
import {FACTORY_VERIFIER_VERSION} from './factoryEvidence.mjs';
import {hashJSON,inventoryFingerprint} from '../../../data/question_factory_policy.mjs';
import {officialCalibrationUnit,validateCalibrationManifest} from './factoryCalibration.mjs';

const verifierContract=()=>hashJSON(['factoryEvidence.mjs','factoryCore.mjs','evidencePipeline.mjs','factoryCalibration.mjs','../../../data/question_presentation.mjs','../../../data/question_factory_policy.mjs','../../../data/content_evidence.js'].map(f=>readFileSync(new URL(f,import.meta.url),'utf8')));
export const BENCHMARK_PROTOCOL='frozen-unobserved-cuET-v1';
export function fixtureIdentity(f) {
  return {id:f.id,valid:f.valid,category:f.category,provenance:f.provenance,question:{...f.question,explanation:f.valid?'factory-authored-explanation':f.question.explanation}};
}
// Exposure means an item/passage was used in a prior development, evaluation or authoring run.
// Freeze before any new explanation/model request. Registry ingestion alone is not evaluation.
export function freezeBenchmark(manifest,{registry,ledger,previousFixtures=[],previousJobs=[]}) {
  const fixtures=validateCalibrationManifest(manifest,registry);
  const payload_hash=hashJSON(fixtures.map(fixtureIdentity)),id=`benchmark:${payload_hash}`,existing=ledger.getCache(id);
  if(existing){if(existing.registry_version!==registry.version||existing.verifier_contract!==verifierContract()||existing.verifier_version!==FACTORY_VERIFIER_VERSION)throw Error('frozen_benchmark_context_changed');return existing;}
  const units=new Set([...previousFixtures.map(f=>f.question),...previousJobs.map(j=>j.candidate||j)].filter(q=>q?.body).map(officialCalibrationUnit));
  // A frozen holdout cannot be recycled under a new payload after tuning.
  for(const row of ledger.db.prepare("SELECT value FROM cache WHERE id LIKE 'benchmark:%'").all())for(const unit of JSON.parse(row.value).held_out_units||[])units.add(unit);
  const anchors=new Set([...previousFixtures.map(f=>f.provenance?.anchor_id),...previousJobs.map(j=>j.anchor_id||j.provenance?.anchor_id)].filter(Boolean));
  const batchInputs=ledger.db.prepare('SELECT request_json FROM provider_batches').all().map(r=>r.request_json);
  const held=manifest.held_out;
  // All held-out anchors, including controlled negatives, must be unobserved at freeze.
  for(const f of held){
    const a=registry.examples.find(a=>a.id===f.provenance.anchor_id);
    if(units.has(officialCalibrationUnit(a))||anchors.has(a.id)||batchInputs.some(s=>s.includes(a.id)))throw new Error(`benchmark_previously_observed:${f.id}`);
  }
  const record={protocol:BENCHMARK_PROTOCOL,verifier_version:FACTORY_VERIFIER_VERSION,verifier_contract:verifierContract(),id,payload_hash,registry_version:registry.version,frozen_at:new Date().toISOString(),
    unseen_at_freeze:true,held_out_ids:held.map(f=>f.id),held_out_units:[...new Set(held.map(f=>officialCalibrationUnit(registry.examples.find(a=>a.id===f.provenance.anchor_id))))],
    held_out_fingerprints:held.filter(f=>f.valid).map(f=>inventoryFingerprint(f.question)),prior_fixture_count:previousFixtures.length,prior_job_count:previousJobs.length};
  ledger.setCache(id,record);return record;
}
export function benchmarkEvidence(manifest,{registry,ledger}) {
  const r=manifest.holdout_registration,saved=r?.id?ledger.getCache(r.id):null;
  if(!saved||hashJSON(saved)!==hashJSON(r)||saved.protocol!==BENCHMARK_PROTOCOL||saved.verifier_version!==FACTORY_VERIFIER_VERSION||saved.verifier_contract!==verifierContract()||saved.registry_version!==registry.version||
    saved.payload_hash!==hashJSON([...manifest.development,...manifest.held_out].map(fixtureIdentity)))return {protocol:BENCHMARK_PROTOCOL,unseen_at_freeze:false,state:'regression_only'};
  return {...saved,state:'completed'};
}
