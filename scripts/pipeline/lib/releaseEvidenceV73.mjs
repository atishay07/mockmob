import { FACTORY_VERIFIER_VERSION_V73, V73_PROMPT_HASH } from './factoryEvidenceV73.mjs';
import { validationContractV73 } from './contractV73.mjs';
import { expectedReleaseBinding, assessReleaseEvidenceV7, RELEASE_POLICY_V7 } from './releaseEvidenceV7.mjs';

// Prospective only. The release thresholds and production topology stay fixed;
// the complete academic contract, prompt and effort map identify this version.
export function expectedReleaseBindingV73() {
  return { ...expectedReleaseBinding(), verifier_version: FACTORY_VERIFIER_VERSION_V73,
    prompt_hash: V73_PROMPT_HASH, validation_contract_hash: validationContractV73() };
}
export function assessReleaseEvidenceV73(inputs) {
  return assessReleaseEvidenceV7({ ...inputs, binding: expectedReleaseBindingV73(), policy: RELEASE_POLICY_V7 });
}
