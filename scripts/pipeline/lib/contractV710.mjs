import { readFileSync } from 'node:fs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { validationContractV79 } from './contractV79.mjs';

// V7.10 (9 Oct 2026): additive successor of V7.9 r5, which failed fresh qualification q1 (0/15 defects accepted; valid 10/19).
// Only the measured validator-caused losses are addressed: PDF intra-word splits in quote anchoring, rival-condition over-firing on
// "which feature does this case show" items, and explanation deductions that follow necessarily from printed words being flagged.
// V7.9 files stay frozen (contract 67cbdd05…, freeze 0f7a9d8a…) and remain the recorded parent.
export const FACTORY_VERIFIER_VERSION_V710 = 'cuet-fit-validator-v7.10-compact-resolution';
export const PARENT_CONTRACT_V79_HASH = '67cbdd05da43334b89b1320559b23cc19be28f7170977910d0ff67f9ff025f4d';
export const V710_ADDITIVE_FILES = Object.freeze(['contractV710.mjs', 'optionResolutionV710.mjs', 'factoryEvidenceV710.mjs', 'verifyV710.mjs']);

export function validationContractV710() {
  const parent = validationContractV79();
  if (parent !== PARENT_CONTRACT_V79_HASH) throw Error('v710_parent_contract_changed_requires_new_binding');
  const files = V710_ADDITIVE_FILES.map(path => ({ path, sha256: hashJSON(readFileSync(new URL(path, import.meta.url), 'utf8')) }));
  return hashJSON({ verifier_version: FACTORY_VERIFIER_VERSION_V710, parent_contract_hash: parent, files, option_resolution: 'compact-option-resolution-v710',
    inherited_gates: 'unchanged-v76', topology: 'dual_blind', qualification: 'required_fresh_evidence_no_local_test_release' });
}
