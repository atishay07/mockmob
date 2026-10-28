import { readFileSync } from 'node:fs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { validationContractV74 } from './contractV74.mjs';

export const FACTORY_VERIFIER_VERSION_V75 = 'cuet-fit-validator-v7.5';
export const PARENT_CONTRACT_V74_HASH = 'e49ee5a979a01e649b294e726264e7d3611a1d32a19f4b624be35c9bd14fd661';
export const V75_ADDITIVE_FILES = Object.freeze(['contractV75.mjs', 'preparationValueV75.mjs', 'originalAuthorPolicyV75.mjs', 'factoryEvidenceV75.mjs', 'verifyV75.mjs', 'releaseEvidenceV75.mjs', 'factoryProfileV75.mjs']);
export const V75_POLICY_LABELS = Object.freeze({
  authoring_policy: 'original-practice-learning-objective-v75',
  preparation_policy: 'preparation-value-v75',
  judge_policy: 'objective-level-discrimination-v75',
  deterministic_gates: 'unchanged-v74-correctness-plus-preparation-value',
  assumption_policy: 'prerequisites-not-deductions-v1',
  original_practice_pyq: 'optional-style-only',
  topology: 'dual_blind',
});

// The full frozen v7.4 parent (which itself pins v7.3 and the legacy v7 files) stays authoritative. v7.5 adds
// preparation-value requirements only: it never relaxes or reorders a mandatory correctness rejection predicate.
export function validationContractV75() {
  const parent = validationContractV74();
  if (parent !== PARENT_CONTRACT_V74_HASH) throw new Error('v75_parent_contract_changed_requires_new_binding');
  const files = V75_ADDITIVE_FILES.map(path => ({ path, sha256: hashJSON(readFileSync(new URL(path, import.meta.url), 'utf8')) }));
  return hashJSON({ verifier_version: FACTORY_VERIFIER_VERSION_V75, parent_contract_hash: parent, files, ...V75_POLICY_LABELS });
}
