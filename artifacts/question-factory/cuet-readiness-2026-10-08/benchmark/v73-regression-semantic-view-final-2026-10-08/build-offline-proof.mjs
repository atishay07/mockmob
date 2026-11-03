import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createFactoryEvidenceV73,reservedBenchmarkAnchors} from '../../../../../scripts/pipeline/lib/factoryEvidenceV73.mjs';
import {blindView,structureVerdict} from '../../../../../scripts/pipeline/lib/evidencePipeline.mjs';
import {presentationLint} from '../../../../../data/question_presentation.mjs';
import {provenanceReasons,hashJSON} from '../../../../../data/question_factory_policy.mjs';
import {effortsFor} from '../../../../../data/cuet_fit_evidence.mjs';
const root='artifacts/question-factory/cuet-readiness-2026-10-08/benchmark';
const base=root+'/v73-regression-semantic-view-2026-10-08';
const out=root+'/v73-regression-semantic-view-final-2026-10-08';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const write=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n','utf8');
mkdirSync(out,{recursive:true});
const originalFrozen=read(base+'/frozen.json');
const originalLineage=read(base+'/diagnostic-view-lineage.json');
const overlay=read(base+'/scratch-registry-overlay.json');
const sourceRegistry=read('data/source_registry.json');
const registry={...sourceRegistry,sources:{...sourceRegistry.sources,...overlay.sources},families:{...sourceRegistry.families,...overlay.families},packs:{...sourceRegistry.packs,...overlay.packs}};
const anchors=new Set(reservedBenchmarkAnchors());
let dispatches=0;
const transport={generate:async()=>{dispatches++;throw new Error('OFFLINE_STRICT_SELECTOR_SENTINEL');}};
const ledger={getCache:()=>null,setCache:()=>{throw new Error('offline_cache_write_forbidden');}};
const targets=originalLineage.records.filter(r=>r.expected_valid===false&&r.category==='known_audit_defect');
if(targets.length!==16)throw new Error('expected_exactly_16_audited_cases:'+targets.length);
const results=[];
for(const row of targets){
 const c=row.original_candidate;
 const reserved=anchors.has(c.provenance?.anchor_id);
 const local={structure:structureVerdict(c),presentation:presentationLint(c),provenance:provenanceReasons(c,registry)};
 const before=dispatches;
 const adapters=createFactoryEvidenceV73({registry,ledger,transport,calibrationPurpose:true,efforts:effortsFor(c)});
 let outcome;
 try{await adapters.__evaluation(blindView(c,c.source_refs||[]),'openai');outcome={kind:'unexpected_return'};}
 catch(e){outcome={kind:e?.message==='OFFLINE_STRICT_SELECTOR_SENTINEL'?'offline_transport_sentinel_after_context':'before_transport_error',message:String(e?.message||e)};}
 outcome.transport_dispatches=dispatches-before;
 results.push({id:row.id,historical_source_id:row.historical_source_id,original_provenance:row.original_provenance_exact,anchor_id:c.provenance?.anchor_id||null,reserved_benchmark_anchor:reserved,independent_local_gates:local,production_selector_outcome:outcome,meaning:outcome.kind==='before_transport_error'?'Strict production context stopped before transport; not an academic-stage verdict.':outcome.kind==='offline_transport_sentinel_after_context'?'Strict production context completed; offline sentinel intercepted transport before any network/provider call.':'Unexpected adapter behavior.'});
}
if(dispatches>16)throw new Error('unexpected_transport_count');
const proof={schema:'v73-regression-strict-selector-correction-v1',status:'offline_read_only_proof_no_provider_no_ledger_no_runner',created_utc:'2026-10-08',study_id:'cuet-readiness-v73-regression-semantic-view-final-2026-10-08',source_study_id:originalFrozen.id,source_frozen_sha256:sha(base+'/frozen.json'),source_lineage_sha256:sha(base+'/diagnostic-view-lineage.json'),current_registry_sha256:sha('data/source_registry.json'),private_overlay_sha256:sha(base+'/scratch-registry-overlay.json'),selector_source_sha256:sha('scripts/pipeline/lib/factoryEvidenceV73.mjs'),reserved_benchmark_anchors:reservedBenchmarkAnchors(),capture_method:'For each of the 16 original provenance candidates, call createFactoryEvidenceV73(...).__evaluation(blindView(originalCandidate, source_refs), openai) with the merged read-only registry, empty cache ledger, and transport.generate that increments a local counter then throws OFFLINE_STRICT_SELECTOR_SENTINEL. This never performs network or provider I/O.',transport_dispatches:dispatches,results};
write(out+'/strict-selector-correction-proof.json',proof);
for(const file of ['scratch-registry-overlay.json','independent-key-custody.json'])copyFileSync(base+'/'+file,out+'/'+file);
const final=structuredClone(originalFrozen);final.id='cuet-readiness-v73-regression-semantic-view-final-2026-10-08';final.release_eligibility.preregistration_id=final.id;final.status='proposal_only_not_registered_not_executed';
write(out+'/frozen.json',final);
const manifest={schema:'v73-regression-semantic-view-final-manifest-v1',status:'proposal_only_not_registered_not_executed',frozen_id:final.id,verifier_version:final.verifier_version,payload_hash:final.payload_hash,counts:{denominator:final.fixtures.length,positives:final.valid_roots,negatives:final.controlled_defects,original_critical_defects:12,audited_correctness_defects:16,unscored_contract_disagreements:2,strict_original_provenance_cases:results.length,strict_context_before_transport:results.filter(r=>r.production_selector_outcome.kind==='before_transport_error').length,offline_sentinel_after_context:results.filter(r=>r.production_selector_outcome.kind==='offline_transport_sentinel_after_context').length,transport_dispatches:dispatches},derivation:{base_semantic_proposal:base,base_frozen_sha256:sha(base+'/frozen.json'),base_lineage_sha256:sha(base+'/diagnostic-view-lineage.json'),strict_selector_proof:'strict-selector-correction-proof.json',frozen_changes:['id set to this separate derived study id','release_eligibility.preregistration_id aligned to same id'],preserved:['all 40 candidate contents, options, keys, explanations, source_refs, labels, and oracles byte-equivalent at semantic field level','payload_hash unchanged','first-pass lineage untouched']},scope:'Module-isolation semantic-view regression diagnostic only. Sixteen copies use diagnostic original_practice provenance view and do not represent the literal production provenance path or support an authentic/adapted claim. Strict original-provenance outcomes are separately captured in strict-selector-correction-proof.json. No execution, registration, provider, ledger, publication, or bank action occurred.',blocked_actions:['No runFreshCuetReadinessV73 prepare, preflight, execute, or report.','No provider or ledger calls.','No changes to registered parent/current41 sources/contracts, audit originals, global registry, production state, or release files.']};
write(out+'/proposal-manifest.json',manifest);
writeFileSync(out+'/PROPOSAL.md',`# V7.3 semantic-view regression proposal (derived final)\n\nStatus: proposal only; not registered or executed. Study ID and preregistration binding are aligned. The 40-case payload and hash are unchanged from the first-pass proposal.\n\nThis is a module-isolation diagnostic. The sixteen audited candidate copies use an original_practice semantic view to reach academic stages; that does not represent the literal production provenance path or substantiate an authentic/adapted PYQ claim. The separate strict-selector proof records each original-provenance result, including stops before any offline transport dispatch.\n\nAll 12 historical positive controls and 28 negative labels/oracles/content remain preserved; 12 original critical defects and 16 audited correctness defects are scored. Two same-unit chapter-contract disagreements remain fully preserved but unscored. See proposal-manifest.json, diagnostic lineage in the source proposal folder, and strict-selector-correction-proof.json.\n\nNo prepare, preflight, execute, registration, provider, ledger, publication, or bank action occurred.\n`,'utf8');
const finalVerified=read(out+'/frozen.json');
const candidateEquivalent=finalVerified.fixtures.every((f,i)=>JSON.stringify(f.candidate)===JSON.stringify(originalFrozen.fixtures[i].candidate));
const oracleEquivalent=finalVerified.fixtures.every((f,i)=>JSON.stringify(f.oracle)===JSON.stringify(originalFrozen.fixtures[i].oracle));
const labelsEquivalent=finalVerified.fixtures.every((f,i)=>f.expected_valid===originalFrozen.fixtures[i].expected_valid&&f.category===originalFrozen.fixtures[i].category);
const verification={schema:'v73-regression-final-derived-verification-v1',status:'local_artifact_integrity_checks_passed',base_frozen_sha256:sha(base+'/frozen.json'),final_frozen_sha256:sha(out+'/frozen.json'),base_proposal_hash:originalFrozen.payload_hash,final_proposal_hash:finalVerified.payload_hash,payload_hash_unchanged:originalFrozen.payload_hash===finalVerified.payload_hash,candidate_objects_identical_to_semantic_view:candidateEquivalent,oracles_identical:oracleEquivalent,expected_labels_and_categories_identical:labelsEquivalent,positive_control_count:finalVerified.fixtures.filter(f=>f.expected_valid===true).length,negative_count:finalVerified.fixtures.filter(f=>f.expected_valid===false).length,proof_sha256:sha(out+'/strict-selector-correction-proof.json'),study_id:finalVerified.id,preregistration_id:finalVerified.release_eligibility.preregistration_id,study_binding_aligned:finalVerified.id===finalVerified.release_eligibility.preregistration_id,limitations:'Equality is relative to the first-pass semantic-view proposal. The first-pass proposal intentionally rewrote provenance for 16 audit copies as described in its lineage. This does not establish production provenance eligibility or release readiness.'};
if(!candidateEquivalent||!oracleEquivalent||!labelsEquivalent||!verification.payload_hash_unchanged||!verification.study_binding_aligned)throw new Error('final_derived_integrity_check_failed');
write(out+'/final-verification.json',verification);
console.log(JSON.stringify({final_dir:out,study_id:final.id,payload_hash:final.payload_hash,proof_cases:results.length,dispatches,stopped:proof.results.filter(r=>r.production_selector_outcome.kind==='before_transport_error').length,sentinel:proof.results.filter(r=>r.production_selector_outcome.kind==='offline_transport_sentinel_after_context').length}));



