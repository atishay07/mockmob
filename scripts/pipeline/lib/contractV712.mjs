import { readFileSync } from 'node:fs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { validationContractV711 } from './contractV711.mjs';

// V7.12 (9-10 Oct 2026): additive successor of frozen V7.11.
// 1. Provenance fix: an independent reviewer showed V7.11's compact fallback (all whitespace and letter-hyphen-letter removed) binds
//    "nowhere" to "now here" and "resign" to "re-sign". V7.12 folds whitespace, case and glyph variants only; a hyphen is joined solely
//    where the original source breaks the line right after it. PDF word splits are fixed by re-extracting sources, not by the binder.
// 2. Scope enforcement: case_scope / not_exhibited_by_case count only for deterministically detected illustration questions (never
//    classification), and passage_scope / passage_unsupported only for genuine reading tasks, not mere passage presence.
export const FACTORY_VERIFIER_VERSION_V712 = 'cuet-fit-validator-v7.12-compact-resolution';
export const PARENT_CONTRACT_V711_HASH = 'dff119fc0a2034eb719e024e8feb84460f359423fcea66c5f7f2efa1d6f181e3';
export const V712_ADDITIVE_FILES = Object.freeze(['contractV712.mjs', 'optionResolutionV712.mjs', 'factoryEvidenceV712.mjs', 'verifyV712.mjs', 'questionScopeV712.mjs']);

export function validationContractV712() {
  const parent = validationContractV711();
  if (parent !== PARENT_CONTRACT_V711_HASH) throw Error('v712_parent_contract_changed_requires_new_binding');
  const files = V712_ADDITIVE_FILES.map(path => ({ path, sha256: hashJSON(readFileSync(new URL(path, import.meta.url), 'utf8')) }));
  return hashJSON({ verifier_version: FACTORY_VERIFIER_VERSION_V712, parent_contract_hash: parent, files, option_resolution: 'compact-option-resolution-v712',
    inherited_gates: 'unchanged-v76', topology: 'dual_blind', qualification: 'required_fresh_evidence_no_local_test_release' });
}
