// Preserve the complete failed-preflight parent; score its deliberately false PYQ
// claim at the mandatory local provenance guard, before any academic model call.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {payloadHash} from '../lib/cuetFitBenchmark.mjs';
import {assertBenchmarkProvenanceV73} from '../lib/freshCuetReadinessV73Guards.mjs';
const base=resolve('artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/fresh-official-source-v73'),target=base+'-model';
const read=n=>JSON.parse(readFileSync(join(base,n),'utf8')),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
if(existsSync(target)||existsSync(join(base,'run','execution-plan.json')))throw Error('unregistered_immutable_parent_required');
const original=read('frozen.json'),control=original.fixtures.find(f=>f.category==='false_authentic_pyq_claim');
if(!control||original.denominator!==42||original.valid_roots!==22||original.controlled_defects!==20)throw Error('exact_mechanical_control_required');
let error;try{assertBenchmarkProvenanceV73([control],'fresh');}catch(e){error=e.message;}
if(error!=='fresh_practice_cannot_claim_authentic_pyq')throw Error('false_authentic_claim_guard_not_proven');
const frozen=structuredClone(original);frozen.fixtures=frozen.fixtures.filter(f=>f.id!==control.id);frozen.id+='-model';
frozen.denominator=41;frozen.controlled_defects=19;frozen.payload_hash=payloadHash(frozen.fixtures);frozen.release_eligibility.preregistration_id=frozen.id;
frozen.construction_disclosure={...frozen.construction_disclosure,complete_parent_denominator:42,complete_parent_frozen_sha256:sha(join(base,'frozen.json')),complete_parent_payload_hash:original.payload_hash,
 mechanical_control_separate_before_paid_evaluation:{id:control.id,guard_error:error,reason:'The measurement runner itself forbids false fresh authentic-PYQ provenance before provider dispatch. Keep this failure as local safety evidence, not a model judgment.'},academic_control_denominator:19,mechanical_control_denominator:1,all_original_controls_retained:true,question_content_or_answer_changes:0};
const proof={at:new Date().toISOString(),parent_frozen_sha256:sha(join(base,'frozen.json')),raw_reference_denominator:32,complete_fixture_denominator:42,academic_paid_fixtures:41,local_mechanical_fixtures:1,
 candidate:control,expected_state:'rejected_before_dispatch',observed_guard_error:error,paid_calls:0,publication_writes:0,model_accuracy_claim:false,release:false};
mkdirSync(target,{recursive:true});const save=(n,d)=>writeFileSync(join(target,n),JSON.stringify(d,null,2)+'\n',{flag:'wx'});
save('frozen.json',frozen);save('scratch-registry-overlay.json',read('scratch-registry-overlay.json'));save('independent-key-custody.json',read('independent-key-custody.json'));save('lexical-evidence-supplement.json',read('lexical-evidence-supplement.json'));save('mechanical-control-proof.json',proof);
console.log(JSON.stringify({dir:target,total_preserved:42,paid_fixtures:41,positives:22,academic_defects:19,local_mechanical_rejected:1,payload_hash:frozen.payload_hash,paid_calls:0}));
