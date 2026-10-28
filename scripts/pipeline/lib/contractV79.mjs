import { readFileSync } from 'node:fs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { validationContractV78 } from './contractV78.mjs';

// V7.9 composes the frozen V7.6 gates (as V7.8 did) but replaces V7.8's clause matrix with the compact resolution.
// V7.8 stays frozen and is recorded as the parent so its lineage and regression evidence remain traceable.
export const FACTORY_VERIFIER_VERSION_V79 = 'cuet-fit-validator-v7.9-compact-resolution-r5';
export const PARENT_CONTRACT_V78_HASH = 'e4be26f3e6dcb651edcf736049f872a736abaed1ed4db5b6299d6aaccb613d58';
export const V79_ADDITIVE_FILES = Object.freeze(['contractV79.mjs', 'optionResolutionV79.mjs', 'factoryEvidenceV79.mjs', 'verifyV79.mjs']);

export function validationContractV79() {
  const parent = validationContractV78();
  if (parent !== PARENT_CONTRACT_V78_HASH) throw Error('v79_parent_contract_changed_requires_new_binding');
  const files = V79_ADDITIVE_FILES.map(path => ({ path, sha256: hashJSON(readFileSync(new URL(path, import.meta.url), 'utf8')) }));
  return hashJSON({ verifier_version: FACTORY_VERIFIER_VERSION_V79, parent_contract_hash: parent, files, option_resolution: 'compact-option-resolution-v79',
    inherited_gates: 'unchanged-v76', topology: 'dual_blind', qualification: 'required_fresh_evidence_no_local_test_release' });
}
