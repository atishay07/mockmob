import { readFileSync } from 'node:fs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { validationContractV713 } from './contractV713.mjs';
export const FACTORY_VERIFIER_VERSION_V714 = 'cuet-fit-validator-v7.14-schema-semantics';
export const PARENT_CONTRACT_V713_HASH = 'f7d31a74138f497581e545b1199f57ac43a450edb56d38c5ab368aeb0500b72d';
export const V714_ADDITIVE_FILES = Object.freeze(['contractV714.mjs', 'factoryEvidenceV714.mjs', 'verifyV714.mjs', 'compactValidationV714.mjs', 'validatorDiagnosticsV714.mjs']);
export function validationContractV714() {
  const parent = validationContractV713();
  if (parent !== PARENT_CONTRACT_V713_HASH) throw Error('v714_parent_changed');
  return hashJSON({ verifier_version: FACTORY_VERIFIER_VERSION_V714, parent_contract_hash: parent,
    files: V714_ADDITIVE_FILES.map(path => ({ path, sha256: hashJSON(readFileSync(new URL(path, import.meta.url), 'utf8')) })),
    topology: 'dual_blind', mandatory_gates: 'inherited-v713-unchanged', qualification: 'fresh_evidence_required' });
}
