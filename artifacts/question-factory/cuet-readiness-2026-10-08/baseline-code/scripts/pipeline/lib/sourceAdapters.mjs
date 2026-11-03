import {createHash} from 'node:crypto';

const digest=text=>createHash('sha256').update(text).digest('hex');
const failure=(view,reason)=>({candidate_id:view.candidate_id,content_hash:view.content_hash,passed:false,reason});

// Registration/extraction must establish identity, permission and final-key
// matching first. A URL, a model-written citation or a manually assigned year
// cannot satisfy this contract.
export function createEvidenceAdapters({registry,judge,solvers={}}){
 function material(view){
  return view.references.map(ref=>{
   const source=registry.sources?.[ref.id],fact=source?.facts?.[ref.locator];
   if(source?.state!=='active' || source.version!==ref.version || !source.reuse_permitted ||
      !source.identity_sha256 || source.extraction_checked!==true || typeof fact?.text!=='string' ||
      digest(fact.text)!==ref.support_hash || source.supports?.[ref.locator]!==ref.support_hash)
     throw new Error('authenticated_reference_excerpt_required');
   return {id:ref.id,version:ref.version,locator:ref.locator,text:fact.text};
  });
 }
 async function semantic(stage,view){
  let references;try{references=material(view);}catch(error){return failure(view,error.message);}
  let examExamples=[];
  if(stage==='exam_fit'){
   const spec=registry.exam_specs?.[view.subject];
   if(spec?.state!=='verified' || !spec.syllabus_version || !spec.exam_rule_version)return failure(view,'verified_exam_spec_required');
   examExamples=(registry.examples || []).filter(e=>e.subject===view.subject && e.chapter===view.chapter && e.source_kind==='authentic_pyq' && e.final_key_matched===true && registry.sources?.[e.source_id]?.identity_sha256 && registry.sources[e.source_id].state==='active');
   if(!examExamples.length)return failure(view,'authenticated_exam_examples_required');
  }
  const result=await judge({stage,...view,references,examExamples});
  if(!result || result.candidate_id!==view.candidate_id || result.content_hash!==view.content_hash || result.mock===true)return failure(view,'verdict_mismatch');
  // Quote existence is checked locally. Semantic support remains a distinct
  // verdict tested in the held-out false-citation and ambiguity suite.
  if(['source_support','blind_solution','explanation_support','passage_answerability'].includes(stage)){
   if(!Array.isArray(result.supporting_spans) || !result.supporting_spans.length)return failure(view,'supporting_spans_missing');
   if(result.supporting_spans.some(span=>typeof span.quote!=='string' || !span.quote.trim() ||
     !(span.source_id==='passage'?view.passage:references.find(r=>r.id===span.source_id && r.locator===span.locator)?.text)?.includes(span.quote)))return failure(view,'false_supporting_span');
  }
  if(stage==='alternatives' && (result.single_defensible_answer!==true || result.missing_assumptions!==false))return failure(view,'ambiguous_answer_or_assumptions');
  return result;
 }
 const adapters=Object.fromEntries(['source_support','blind_solution','alternatives','explanation_support','exam_fit','passage_integrity','passage_answerability'].map(stage=>[stage,view=>semantic(stage,view)]));
 for(const stage of ['independent_solver','boundary_cases'])adapters[stage]=async view=>{
  const family=registry.families?.[view.family_id];
  const solver=family?.state==='active'?solvers[view.family_id]:null;
  if(typeof solver?.[stage]!=='function')return failure(view,'independent_solver_module_required');
  return solver[stage](structuredClone(view));
 };
 return adapters;
}
