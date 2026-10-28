import {canonicalQuestion,contentHash} from '../../../data/content_evidence.js';
import {blindView} from './evidencePipeline.mjs';
import {provenanceReasons} from '../../../data/question_factory_policy.mjs';
export const FIXTURE_ENVELOPE_CONTRACT='original-fixture-family-envelope-v1';

// A fixture builder omitted the redundant family binding. This adapter is
// permitted only for benchmark envelopes, with a registered active family and
// pack. It never rewrites a student's question or an existing evidence record.
export function bindBenchmarkFixtureFamily(candidate,registry){
  const p=candidate?.provenance,family=registry.families?.[candidate?.family_id];
  if(p?.kind!=='original_practice'||p.adaptation_family!==null||family?.state!=='active'||family.source_pack_id!==p.source_pack_id)throw Error('specific_fixture_envelope_defect_required');
  const reasons=provenanceReasons(candidate,registry);
  if(!reasons.includes('adaptation_family_mismatch'))throw Error('fixture_family_defect_missing');
  const bound={...candidate,provenance:{...p,adaptation_family:candidate.family_id}};
  if(JSON.stringify(canonicalQuestion(bound))!==JSON.stringify(canonicalQuestion(candidate))||contentHash(bound)!==contentHash(candidate)||JSON.stringify(blindView(bound,bound.source_refs))!==JSON.stringify(blindView(candidate,candidate.source_refs)))throw Error('fixture_semantics_or_blind_contract_changed');
  // Deliberate out-of-syllabus controls may have additional failures. They
  // remain failures; only the redundant family binding can be corrected.
  if(JSON.stringify(provenanceReasons(bound,registry))!==JSON.stringify(reasons.filter(r=>r!=='adaptation_family_mismatch')))throw Error('fixture_other_provenance_changed');
  return bound;
}
