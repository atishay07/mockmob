import { readFileSync } from 'node:fs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { validationContractV74 } from './contractV74.mjs';

export const FACTORY_VERIFIER_VERSION_V76 = 'cuet-fit-validator-v7.6';
export const PARENT_CONTRACT_V74_HASH = 'e49ee5a979a01e649b294e726264e7d3611a1d32a19f4b624be35c9bd14fd661';
export const V76_ADDITIVE_FILES = Object.freeze(['contractV76.mjs', 'preparationValueV76.mjs', 'originalAuthorPolicyV76.mjs', 'factoryEvidenceV76.mjs', 'verifyV76.mjs', 'releaseEvidenceV76.mjs', 'factoryProfileV76.mjs']);
export const V76_POLICY_LABELS = Object.freeze({ authoring_policy: 'original-practice-source-complete-objective-v76',
  preparation_policy: 'contextual-preparation-value-v76', judge_policy: 'whole-option-evidence-adjudication-v76',
  explanation_policy: 'contextual-claims-source-support-v76', deterministic_gates: 'unchanged-v74-correctness-plus-genuine-objective-checks',
  assumption_policy: 'prerequisites-not-deductions-v1', original_practice_pyq: 'optional-style-only', topology: 'dual_blind' });

// v7.6 composes the pinned v7.4 gates directly. v7.5 remains frozen regression evidence;
// its broad keyword preparation rules are deliberately not inherited.
export function validationContractV76() {
  const parent = validationContractV74();
  if (parent !== PARENT_CONTRACT_V74_HASH) throw new Error('v76_parent_contract_changed_requires_new_binding');
  const files = V76_ADDITIVE_FILES.map(path => ({ path, sha256: hashJSON(readFileSync(new URL(path, import.meta.url), 'utf8')) }));
  return hashJSON({ verifier_version: FACTORY_VERIFIER_VERSION_V76, parent_contract_hash: parent, files, ...V76_POLICY_LABELS });
}
