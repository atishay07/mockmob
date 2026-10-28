import { V74_PROMPT_HASH } from './factoryEvidenceV74.mjs';
import { FACTORY_VERIFIER_VERSION_V74, validationContractV74 } from './contractV74.mjs';
import { expectedReleaseBinding, assessReleaseEvidenceV7, RELEASE_POLICY_V7 } from './releaseEvidenceV7.mjs';

export function expectedReleaseBindingV74() {
  return { ...expectedReleaseBinding(), verifier_version: FACTORY_VERIFIER_VERSION_V74,
    prompt_hash: V74_PROMPT_HASH, validation_contract_hash: validationContractV74() };
}
export function assessReleaseEvidenceV74(inputs) {
  return assessReleaseEvidenceV7({ ...inputs, binding: expectedReleaseBindingV74(), policy: RELEASE_POLICY_V7 });
}
