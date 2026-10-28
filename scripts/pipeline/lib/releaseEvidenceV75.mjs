import { V75_PROMPT_HASH } from './factoryEvidenceV75.mjs';
import { FACTORY_VERIFIER_VERSION_V75, validationContractV75 } from './contractV75.mjs';
import { expectedReleaseBinding, assessReleaseEvidenceV7, RELEASE_POLICY_V7 } from './releaseEvidenceV7.mjs';

export function expectedReleaseBindingV75() {
  return { ...expectedReleaseBinding(), verifier_version: FACTORY_VERIFIER_VERSION_V75,
    prompt_hash: V75_PROMPT_HASH, validation_contract_hash: validationContractV75() };
}
export function assessReleaseEvidenceV75(inputs) {
  return assessReleaseEvidenceV7({ ...inputs, binding: expectedReleaseBindingV75(), policy: RELEASE_POLICY_V7 });
}
