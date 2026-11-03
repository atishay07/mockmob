import {readFileSync} from 'node:fs';
import {contentHash} from '../../../data/content_evidence.js';
import {FACTORY_SUBJECTS,hashJSON} from '../../../data/question_factory_policy.mjs';
import {FACTORY_VERIFIER_VERSION} from './factoryEvidence.mjs';
export const COMPACT_PROTOCOL='frozen-source-keyed-cuET-v2';
export const validationContract=()=>hashJSON(['factoryCore.mjs','factoryEvidence.mjs','evidencePipeline.mjs','focusedCoverage.mjs','focusedSources.mjs','compactBenchmark.mjs','../../../data/content_evidence.js','../../../data/question_factory_policy.mjs','../../../data/question_factory_criteria.mjs','../../../data/question_presentation.mjs','../../../data/canonical_json.mjs'].map(p=>readFileSync(new URL(p,import.meta.url),'utf8')));
export function freezeCompactBenchmark(fixtures,{registry,ledger}){
 if(fixtures.length<20||fixtures.some(f=>!f.oracle?.basis||!f.oracle.source_refs?.length||!/^[ABCD]$/.test(f.oracle.key)))throw Error('independently_established_source_oracle_required');
 const payload=fixtures.map(f=>({id:f.id,category:f.category,expected_valid:f.expected_valid,question:f.candidate,oracle:f.oracle})),payload_hash=hashJSON(payload),key=`compact-benchmark:${payload_hash}`;
 const old=ledger.getCache(key);if(old){if(old.contract_hash!==validationContract()||old.registry_version!==registry.version)throw Error('frozen_benchmark_context_changed');return old;}
 const exposed=ledger.db.prepare("SELECT value FROM cache WHERE id LIKE 'compact-benchmark:%'").all().flatMap(r=>JSON.parse(r.value).content_hashes||[]);
 const requests=ledger.db.prepare('SELECT request_json FROM provider_batches UNION ALL SELECT request_json FROM provider_requests').all().map(r=>r.request_json);
 if(fixtures.some(f=>exposed.includes(contentHash(f.candidate))||requests.some(s=>s.includes(f.id))))throw Error('benchmark_previously_observed');
 const record={protocol:COMPACT_PROTOCOL,payload_hash,contract_hash:validationContract(),registry_version:registry.version,verifier_version:FACTORY_VERIFIER_VERSION,
  frozen_at:new Date().toISOString(),unseen_at_freeze:true,source_keyed:true,independent_oracle:true,
  oracle_basis:'Expected answers were established before paid validation from exact authoritative excerpts plus explicit arithmetic, independently of the proposed/generated keys. These are newly written assessment items, not unchanged official PYQs.',
  content_hashes:fixtures.map(f=>contentHash(f.candidate)),fixture_ids:fixtures.map(f=>f.id),state:'frozen'};
 ledger.setCache(key,record);return record;
}
export function compactResults(fixtures,registration){
 const positive=fixtures.filter(f=>f.expected_valid),negative=fixtures.filter(f=>!f.expected_valid),complete=fixtures.every(f=>['eligible','quarantined'].includes(f.state));
 const critical_false_accepts=negative.filter(f=>f.state==='eligible').length,valid_survival=positive.filter(f=>f.state==='eligible').length/positive.length;
 const categories=['wrong_key','multiple_correct','missing_assumptions','unsupported_explanation','out_of_syllabus','numerical_fault'];
 const missing_categories=categories.filter(c=>!negative.some(f=>f.category===c));
 const accuracy=rows=>{
  const results=provider=>rows.map(f=>({key:f.result?.question?.evidence?.record?.checks?.[provider==='openai'?'blind_solution':'independent_evaluation']?.solved_key||f.result?.checks?.[provider==='openai'?'blind_solution':'independent_evaluation']?.solved_key,oracle:f.oracle.key})).filter(x=>/^[ABCD]$/.test(x.key||''));
  const luna=results('openai'),gemini=results('gemini');return {sample_size:rows.length,luna_answered:luna.length?luna.filter(x=>x.key===x.oracle).length/luna.length:0,gemini_answered:gemini.length?gemini.filter(x=>x.key===x.oracle).length/gemini.length:0,luna_n:luna.length,gemini_n:gemini.length};
 };
 const by_subject=Object.fromEntries(FACTORY_SUBJECTS.map(s=>[s,accuracy(positive.filter(f=>f.candidate.subject===s))]));
 const routes=Object.fromEntries(['conceptual','numerical','passage'].map(route=>{const rows=positive.filter(f=>f.candidate.route===route),survival=rows.filter(f=>f.state==='eligible').length/rows.length,a=accuracy(rows);
  return [route,{released:rows.length>0&&survival>=(rows.length<3?1:.8)&&a.luna_answered>=.95&&a.gemini_answered>=.95,independent:true,split_disjoint:true,valid_sample_size:rows.length,valid_survival:survival,critical_false_accepts,missing_categories,blind_answer_accuracy:a,source_registry_version:registration.registry_version,verifier_version:registration.verifier_version}];}));
 return {complete,critical_false_accepts,valid_survival,missing_categories,by_subject,routes,
  abstention:{luna:1-positive.filter(f=>f.result?.checks?.blind_solution?.solved_key&&f.result.checks.blind_solution.solved_key!=='abstain'||f.result?.question?.evidence?.record?.checks?.blind_solution?.solved_key).length/positive.length,
   gemini:1-positive.filter(f=>f.result?.checks?.independent_evaluation?.solved_key&&f.result.checks.independent_evaluation.solved_key!=='abstain'||f.result?.question?.evidence?.record?.checks?.independent_evaluation?.solved_key).length/positive.length},
  sample_size:fixtures.length,positive_count:positive.length,negative_count:negative.length,
  released:complete&&critical_false_accepts===0&&valid_survival>=.85&&missing_categories.length===0&&Object.values(routes).every(r=>r.released)&&Object.values(by_subject).every(a=>a.luna_answered>=.95&&a.gemini_answered>=.95),
  limitation:'A compact source-keyed benchmark measures this sample only; zero detected false accepts is not proof of perfect accuracy or broad generalisation.'};
}
