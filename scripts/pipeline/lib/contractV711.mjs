import { readFileSync } from 'node:fs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { validationContractV710 } from './contractV710.mjs';

// V7.11 (9 Oct 2026): additive successor of V7.10, which failed fresh qualification q2 (0/16 defects accepted; valid 14/20 = 70%).
// Only measured mechanical losses are addressed: case-insensitive anchoring (a false_part began "the" where the option began "The"),
// and a larger Luna blind output cap after a 15,000-token reasoning runaway truncated a valid item. Gates and instructions are unchanged.
// Two q2 losses were defective source custody (interleaved two-column NCERT extractions); that is fixed in source selection, not here.
export const FACTORY_VERIFIER_VERSION_V711 = 'cuet-fit-validator-v7.11-compact-resolution';
export const PARENT_CONTRACT_V710_HASH = '61d7a05c21d4b221fa48101de6de5b139cf31cee6c846611b0b34dc20e5206ba';
export const V711_ADDITIVE_FILES = Object.freeze(['contractV711.mjs', 'optionResolutionV711.mjs', 'factoryEvidenceV711.mjs', 'verifyV711.mjs']);

export function validationContractV711() {
  const parent = validationContractV710();
  if (parent !== PARENT_CONTRACT_V710_HASH) throw Error('v711_parent_contract_changed_requires_new_binding');
  const files = V711_ADDITIVE_FILES.map(path => ({ path, sha256: hashJSON(readFileSync(new URL(path, import.meta.url), 'utf8')) }));
  return hashJSON({ verifier_version: FACTORY_VERIFIER_VERSION_V711, parent_contract_hash: parent, files, option_resolution: 'compact-option-resolution-v711',
    inherited_gates: 'unchanged-v76', topology: 'dual_blind', qualification: 'required_fresh_evidence_no_local_test_release' });
}
