import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewOptionResolutionStructuralProposalV2 as review,proposalV2HashJSON as hash} from './optionResolutionStructuralProposalV2.mjs';
// Synthetic audit-format assertions ONLY, built from an already inspected native control.
// This never represents an independent model judgment or new qualification evidence.
const base='artifacts/question-factory/cuet-readiness-2026-10-09';
const exported=JSON.parse(readFileSync(base+'/execution/v77-final-export-2026-10-09/all-cases.json'));
const item=exported.all_cases.find(x=>x.fixture.id==='v77f-662880a2c5fb');
const overlay=JSON.parse(readFileSync(base+'/v77-qualification/v77-qualification-2026-10-09-final-fresh-integrated/scratch-registry-overlay.json'));
function input(){
 const r=structuredClone(item.independent_native_solutions.openai),c=item.fixture.candidate;
 return {proposalOptIn:true,route:'local_regression_proposal',view:{candidate_id:r.candidate_id,content_hash:r.content_hash,body:c.body,options:c.options},result:r,evidenceCatalog:r.evidence_ids.map((id,i)=>({id,...r.supporting_spans[i],identity_sha256:overlay.sources[r.supporting_spans[i].source_id].identity_sha256})),semanticAudit:null};
}
function syntheticAudit(x){
 const preview=review({...x,semanticAudit:null});
 const bindings=preview.structural.premise_bindings;
 const matrix=x.result.option_resolution_matrix;
 x.semanticAudit={independent_semantic_audit:true,auditor_id:'synthetic-root-regression-only',case_id:x.view.candidate_id,content_hash:x.view.content_hash,option_resolution_matrix_sha256:hash(matrix),evidence_catalog_sha256:hash(x.evidenceCatalog),whole_option_reviewed:true,printed_option_claims_verified:true,selected_key:x.result.solved_key,
 clause_reviews:matrix.flatMap(row=>row.clauses.map(c=>({option:row.option,clause:c.clause,exact_option_text:row.exact_option_text,status:c.status,basis:c.basis,contradiction_basis:c.contradiction_basis,evidence_ids:c.evidence_ids,premises:c.premises,premise_bindings:bindings.find(b=>b.option===row.option&&b.clause===c.clause)?.bindings,whole_claim_checked:true,printed_option_claims_verified:true,rationale:'Synthetic format check; does not establish academic truth.',direct_conflict_verified:c.status==='contradiction',source_silence_used:c.status==='unresolved',...(c.status==='unresolved'?{unresolved_reason:'A simulated nondecisive premise is not established.'}:{})}))),
 whole_options:matrix.map(row=>({option:row.option,status:row.clauses.some(c=>c.status==='contradiction')?'contradiction':row.clauses.some(c=>c.status==='unresolved')?'unresolved':'support',rationale:'Synthetic format check only.',whole_option_checked:true}))};
 return x;
}
test('independent root baseline has bound paraphrased context but grants no publication or dispatch',()=>{
 const result=review(syntheticAudit(input()));
 assert.equal(result.passed,true,JSON.stringify(result));
 assert.equal(result.publication_eligible,false);assert.equal(result.dispatch_eligible,false);
});
test('null top-level and malformed matrix option text fail without exceptions',()=>{
 for(const x of [null,{},input()]){
  if(x?.result)x.result.option_resolution_matrix[0].exact_option_text=null;
  let result;assert.doesNotThrow(()=>{result=review(x);});assert.equal(result.passed,false);
 }
});
test('extra malformed source entries and duplicate catalog identities fail closed',()=>{
 for(const extra of [null,{...input().evidenceCatalog[0]}]){
  const x=input();x.evidenceCatalog.push(extra);assert.equal(review(syntheticAudit(x)).passed,false);
 }
});
test('a printed assertion cannot become an excerpt premise merely by accompanying a real quote',()=>{
 const x=input(),clause=x.result.option_resolution_matrix[0].clauses[0];
 clause.premises.push(clause.clause);
 const result=review(syntheticAudit(x));assert.equal(result.structural.passed,false);assert.equal(result.passed,false);
});
test('one omitted material clause is not laundered by whole-option approval',()=>{
 const x=syntheticAudit(input());x.semanticAudit.clause_reviews.pop();
 assert.equal(review(x).passed,false);
});
test('a rival claimed supported or unresolved cannot be relabeled contradicted by blanket audit flags',()=>{
 for(const status of ['support','unresolved']){
  const x=input(),clause=x.result.option_resolution_matrix[0].clauses[0];clause.status=status;clause.contradiction_basis='none';
  syntheticAudit(x);x.semanticAudit.whole_options[0].status='contradiction';
  const result=review(x);assert.equal(result.passed,false);assert.equal(result.semantic.passed,false);
 }
});
test('false use of source silence as decisive contradiction fails audit even with a valid quote',()=>{
 const x=syntheticAudit(input());x.semanticAudit.clause_reviews[0].source_silence_used=true;
 assert.equal(review(x).semantic.passed,false);
});
test('changed source spans or audit clause identity cannot pass cached hashes',()=>{
 const x=syntheticAudit(input());x.result.supporting_spans[0].locator='forged-location';
 assert.equal(review(x).passed,false);
 const y=syntheticAudit(input());y.semanticAudit.clause_reviews[0].clause='Different claim';
 assert.equal(review(y).passed,false);
});
test('malformed arrays, null clauses and nonstring premises fail without throwing',()=>{
 for(const mutate of [x=>x.result.option_resolution_matrix[0].clauses=[null],x=>x.result.option_resolution_matrix[0].clauses[0].evidence_ids=null,x=>x.result.option_resolution_matrix[0].clauses[0].premises=[{}],x=>x.result.option_resolution_matrix=[null],x=>x.view.options=[null],x=>x.evidenceCatalog={wrong:true}]){
  const x=input();mutate(x);let result;
  assert.doesNotThrow(()=>{result=review(x);});assert.equal(result.passed,false);
 }
});
