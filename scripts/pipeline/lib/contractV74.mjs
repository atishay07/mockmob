import { readFileSync } from 'node:fs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { validationContractV73 } from './contractV73.mjs';

export const FACTORY_VERIFIER_VERSION_V74 = 'cuet-fit-validator-v7.4';
export const PARENT_CONTRACT_V73_HASH = 'c04befc1bc40555c424bb84f3508e7cf181498fc742eb08ec04a90aaad533311';
export const V74_ADDITIVE_FILES = Object.freeze(['contractV74.mjs', 'factoryEvidenceV74.mjs', 'verifyV74.mjs', 'releaseEvidenceV74.mjs', 'originalAuthorPolicyV74.mjs']);

// The full frozen v7.3 parent stays authoritative. v7.4 changes model instructions
// and author construction, never the parent's mandatory rejection predicates.
export function validationContractV74() {
  const parent = validationContractV73();
  if (parent !== PARENT_CONTRACT_V73_HASH) throw new Error('v74_parent_contract_changed_requires_new_binding');
  const files = V74_ADDITIVE_FILES.map(path => ({ path, sha256: hashJSON(readFileSync(new URL(path, import.meta.url), 'utf8')) }));
  return hashJSON({ verifier_version: FACTORY_VERIFIER_VERSION_V74, parent_contract_hash: parent, files,
    assumption_policy: 'prerequisites-not-deductions-v1', authoring_policy: 'original-practice-source-explanations-v74',
    deterministic_gates: 'unchanged-v73', original_practice_pyq: 'optional-style-only', topology: 'dual_blind' });
}
