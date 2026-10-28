import { readFileSync } from 'node:fs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { validationContractV714 } from './contractV714.mjs';
export const FACTORY_VERIFIER_VERSION_V715 = 'cuet-fit-validator-v7.15-printed-source-binding';
export const PARENT_CONTRACT_V714_HASH = 'ed0e4ae7fd56c045dd67c74e33686c2fcd1c0d25e640fc2e2f578fba4dfcf545';
export const V715_ADDITIVE_FILES = Object.freeze(['contractV715.mjs', 'factoryEvidenceV715.mjs', 'verifyV715.mjs', 'compactValidationV715.mjs', 'optionResolutionV715.mjs']);
export function validationContractV715() {
  const parent = validationContractV714();
  if (parent !== PARENT_CONTRACT_V714_HASH) throw Error('v715_parent_changed');
  return hashJSON({ verifier_version: FACTORY_VERIFIER_VERSION_V715, parent_contract_hash: parent,
    files: V715_ADDITIVE_FILES.map(path => ({ path, sha256: hashJSON(readFileSync(new URL(path, import.meta.url), 'utf8')) })),
    topology: 'dual_blind', mandatory_gates: 'inherited-v714-with-literal-quote-binding', qualification: 'fresh_evidence_required' });
}
