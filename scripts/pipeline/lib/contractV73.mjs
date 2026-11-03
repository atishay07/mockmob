import { readFileSync } from 'node:fs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { CONTRACT_FILES_V7, validationContractV7 } from './contractV7.mjs';
import { CUET_EXEMPLAR_POLICY_VNEXT, CUET_NUMERIC_ROUTE_POLICY_VNEXT, CUET_VNEXT_VALIDATOR_VERSION } from './cuetExemplarPolicyVNext.mjs';

// Prospective v7.3 binding. Parent files stay pinned to the complete measured v7.2 contract.
export const FACTORY_VERIFIER_VERSION_V73 = 'cuet-fit-validator-v7.3';
export const PARENT_CONTRACT_V7_HASH = '6f27a61131688db75be6686159b77894ee083f0c8abcca47d812a9a0eb20692c';
export const V73_ADDITIVE_FILES = ['contractV73.mjs', 'factoryEvidenceV73.mjs', 'verifyV73.mjs', 'cuetExemplarPolicyVNext.mjs', 'releaseEvidenceV73.mjs'];
export const V73_POLICY_IDS = Object.freeze({
  exemplar: CUET_EXEMPLAR_POLICY_VNEXT,
  numericRouteDiagnostic: CUET_NUMERIC_ROUTE_POLICY_VNEXT,
  selectorValidator: CUET_VNEXT_VALIDATOR_VERSION,
  sourceViews: ['cuet-authenticated-exemplar-blind-view-v1', 'cuet-original-optional-comparator-view-v1'],
  originalPracticeRule: 'original-practice-does-not-require-pyq-counterpart-v1',
  authenticPyqRule: 'exact-authenticated-paper-and-final-key-required-v1'
});

export const hashValidationBindingV73 = ({ parentContractHash, parentFiles, additiveFiles, policyIds = V73_POLICY_IDS }) =>
  hashJSON({ verifier_version: FACTORY_VERIFIER_VERSION_V73, parent_contract_hash: parentContractHash, parent_files: parentFiles, additive_files: additiveFiles, policy_ids: policyIds });

export function validationContractV73() {
  const actualParentHash = validationContractV7();
  if (actualParentHash !== PARENT_CONTRACT_V7_HASH) throw new Error('v73_parent_contract_changed_requires_new_binding');
  const parentFiles = CONTRACT_FILES_V7.map(path => ({ path, sha256: hashJSON(readFileSync(new URL(path, import.meta.url), 'utf8')) }));
  const additiveFiles = V73_ADDITIVE_FILES.map(path => ({ path, sha256: hashJSON(readFileSync(new URL(path, import.meta.url), 'utf8')) }));
  return hashValidationBindingV73({ parentContractHash: actualParentHash, parentFiles, additiveFiles, policyIds: V73_POLICY_IDS });
}

export function evaluationCacheKeyV73({ input, provider, model, effort, output, promptHash, policyVersion, sample = 1, contractHash = validationContractV73() }) {
  return hashJSON({ input, provider, model, effort, output, prompt: promptHash, policy: policyVersion, contract_hash: contractHash,
    contract: 'evaluation-v7.3-optional-exemplars', ...(sample > 1 ? { sample } : {}) });
}
