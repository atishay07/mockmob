// One deterministic construction correction before any fit-validation result.
// The failed source/key audit and original input are immutable evidence.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {payloadHash} from '../lib/cuetFitBenchmark.mjs';
import {expectedReleaseBinding} from '../lib/releaseEvidenceV7.mjs';
const parent='artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/fresh-full-v5-repaired';
const directory='artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/fresh-full-v6-source-keyed';
const read=p=>JSON.parse(readFileSync(p,'utf8')),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
if(existsSync(directory)||existsSync(parent+'/run/results.json'))throw Error('prevalidation_unrun_parent_required');
const frozen=read(parent+'/frozen.json'),check=read(parent+'/run/key-audit-comparison.json');
if(check.records!==64||check.problems.length!==1||check.problems[0].id!=='fresh-v5r-economics-money-banking-3'||check.problems[0].independent.solved_key!=='abstain')throw Error('specific_independent_construction_defect_required');
if(JSON.stringify(frozen.contract_binding)!==JSON.stringify(expectedReleaseBinding()))throw Error('academic_contract_changed');
const root=frozen.fixtures.find(f=>f.id===check.problems[0].id),control=frozen.fixtures.find(f=>f.derived_from===root.id&&f.category==='overlapping_options');
const correction='(A)-(IV), (B)-(III), (C)-(I), (D)-(II)';
root.candidate.options.find(o=>o.key==='C').text=correction;
control.candidate.options.find(o=>o.key==='C').text=correction;
control.candidate.options.find(o=>o.key==='D').text=correction;
frozen.id='fresh-full-v6-source-keyed-2026-10-08';frozen.created_at=new Date().toISOString();
frozen.payload_hash=payloadHash(frozen.fixtures);
frozen.release_eligibility={...frozen.release_eligibility,preregistration_id:frozen.id};
frozen.construction_history={...frozen.construction_history,source_audited_parent:parent,parent_payload_hash:read(parent+'/frozen.json').payload_hash,parent_frozen_sha256:sha(parent+'/frozen.json'),independent_key_audit_sha256:check.independent_first_pass_sha256,correction:{ids:[root.id,control.id],before_validation_fit_results:true,reason:'List-I C maps to List-II I; List-I D maps to List-II II. The independent audit found no correct option in the printed draft.',fields:['candidate.options.C','controlled duplicate option D']},disclosure:'The source/key construction review saw the candidates, including four independent fallback key observations by Luna; it never saw CUET-fit validator results. No validator prompt or oracle category was changed from observed fit outcomes. Source families and paired controls are correlated; this is not source-family-independent or perfect-accuracy evidence.'};
const packet=read(parent+'/blind-review-packet.json');packet.benchmark_id=frozen.id;const item=packet.items.find(i=>i.id===root.id);item.options=structuredClone(root.candidate.options);
const support=read(parent+'/blind-source-excerpts.json');support.benchmark_id=frozen.id;
mkdirSync(directory,{recursive:true});const save=(name,value)=>writeFileSync(directory+'/'+name,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
save('frozen.json',frozen);save('blind-review-packet.json',packet);save('blind-source-excerpts.json',support);save('scratch-registry-overlay.json',read(parent+'/scratch-registry-overlay.json'));
save('construction-proof.json',{at:new Date().toISOString(),denominator:96,valid_roots:64,controlled_defects:32,changed_candidates:[root.id,control.id],parent_audit_problem_retained:true,paid_calls:0,parent_unchanged_sha256:sha(parent+'/frozen.json'),payload_hash:frozen.payload_hash});
console.log(JSON.stringify({directory,payload_hash:frozen.payload_hash,paid_calls:0,validation_not_started:true}));
