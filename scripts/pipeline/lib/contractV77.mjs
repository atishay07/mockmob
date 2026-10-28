import { readFileSync } from 'node:fs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { validationContractV76 } from './contractV76.mjs';

export const FACTORY_VERIFIER_VERSION_V77 = 'cuet-fit-validator-v7.7-local-draft';
export const PARENT_CONTRACT_V76_HASH = '1efe51bb4ccab33314f7fa91c1c7d1964e7b11e34ae453246ada1e67b08b33ec';
export const V77_ADDITIVE_FILES = Object.freeze(['contractV77.mjs', 'optionResolutionV77.mjs', 'optionResolutionAuditV77.mjs', 'factoryEvidenceV77.mjs', 'verifyV77.mjs']);

export function validationContractV77() {
  const parent = validationContractV76();
  if (parent !== PARENT_CONTRACT_V76_HASH) throw new Error('v77_parent_contract_changed_requires_new_binding');
  const files = V77_ADDITIVE_FILES.map(path => ({ path, sha256: hashJSON(readFileSync(new URL(path, import.meta.url), 'utf8')) }));
  return hashJSON({ verifier_version: FACTORY_VERIFIER_VERSION_V77, parent_contract_hash: parent, files,
    option_resolution: 'full-option-clause-tristate-v1', inherited_gates: 'unchanged-v76', topology: 'dual_blind' });
}
