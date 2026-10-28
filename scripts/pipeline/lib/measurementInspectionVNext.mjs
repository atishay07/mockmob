import {evaluateEvidenceV7} from '../../../data/cuet_fit_evidence.mjs';
import {publicationEligibility} from '../../../data/evidence_registry.js';

// Measurement may inspect authentic signed eligible records before a topology
// release. This policy is never used by publication or student retrieval.
export function measurementInspectionEligibility(profile,registry,candidateIds,{evaluate=evaluateEvidenceV7,published=publicationEligibility}={}){
  if(profile?.measurement_only!==true||profile.publication_policy!=='never'||!Array.isArray(candidateIds)||new Set(candidateIds).size!==candidateIds.length)throw Error('measurement_inspection_fixed_scope_required');
  const ids=new Set(candidateIds);
  return question=>{
    if(!ids.has(question.id))return published(question);
    const record=question.evidence?.record;
    if(record?.verifier_version!==profile.verifier_version||record.validation_topology!==profile.topology||record.checks?.blind_solution?.evaluation_prompt!==profile.prompt_hash)
      return {eligible:false,reasons:['measurement_inspection_contract_mismatch']};
    return evaluate(question,registry);
  };
}
