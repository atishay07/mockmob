import { readFileSync } from 'node:fs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { validationContractV712 } from './contractV712.mjs';
export const FACTORY_VERIFIER_VERSION_V713 = 'cuet-fit-validator-v7.13-compact-demand';
export const PARENT_CONTRACT_V712_HASH = '1107c72a94dd5a8f408fb41e75d57f37f885d693aa268dd0ca149bf2d2d2f899';
export const V713_ADDITIVE_FILES = Object.freeze(['contractV713.mjs', 'factoryEvidenceV713.mjs', 'verifyV713.mjs',
  'compactValidationV713.mjs', 'difficultyPolicyV713.mjs', 'originalAuthorPolicyV713.mjs', 'costProfileV713.mjs',
  'campaignGuardV713.mjs', 'cuetPilotDepsV713.mjs', 'cuetPilotRunV713.mjs', 'factoryTransportV713.mjs', 'preflightV713.mjs',
  'releaseEvidenceV713.mjs', 'factoryProfileV713.mjs', 'cuetFitPublicationV713.mjs', 'freshCustodyV713.mjs']);
export function validationContractV713() {
  const parent = validationContractV712();
  if (parent !== PARENT_CONTRACT_V712_HASH) throw Error('v713_parent_changed');
  return hashJSON({ verifier_version: FACTORY_VERIFIER_VERSION_V713, parent_contract_hash: parent,
    files: V713_ADDITIVE_FILES.map(path => ({ path, sha256: hashJSON(readFileSync(new URL(path, import.meta.url), 'utf8')) })),
    topology: 'dual_blind', mandatory_gates: 'inherited-v712-unchanged', qualification: 'fresh_evidence_required' });
}
