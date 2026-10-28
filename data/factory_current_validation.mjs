import { FACTORY_VERIFIER_VERSION } from '../scripts/pipeline/lib/factoryEvidence.mjs';
import { runtimeBindingV74 } from './v74_runtime_contract.mjs';
import { currentCuetCalibrationReadyVNext } from '../scripts/pipeline/lib/currentCuetCalibrationGateVNext.mjs';
import { factoryCalibrationReady } from './question_factory_policy.mjs';

// Admin control readiness is separate from each queued job's immutable profile.
// A legacy release never impersonates the current source/key/CUET-fit contract.
const CONTRACT_FAILURE_REASONS = new Map([
  ['runtime_v73_contract_metadata_invalid', 'runtime_v73_contract_metadata_invalid'],
  ['runtime_v73_parent_contract_changed', 'runtime_v73_parent_contract_changed'],
  ['runtime_v73_additive_contract_changed', 'runtime_v73_additive_contract_changed'],
  ['runtime_v74_contract_metadata_invalid', 'runtime_v74_contract_metadata_invalid'],
  ['runtime_v74_parent_contract_changed', 'runtime_v74_parent_contract_changed'],
  ['runtime_v74_additive_contract_changed', 'runtime_v74_additive_contract_changed'],
]);
const legacyReady = (manifest, registry) => {
  try { return factoryCalibrationReady(manifest, registry, FACTORY_VERIFIER_VERSION); }
  catch { return false; }
};

export function factoryCurrentValidation(manifest, registry, { readBinding = runtimeBindingV74 } = {}) {
  let binding;
  try { binding = readBinding(); }
  catch (error) {
    const reason = CONTRACT_FAILURE_REASONS.get(error?.message) || 'runtime_v74_contract_unavailable';
    return {
      verifier_version: 'cuet-fit-validator-v7.4',
      topology: 'dual_blind',
      validation_contract_hash: null,
      ready: false,
      readiness_reason: reason,
      legacy_ready: legacyReady(manifest, registry),
    };
  }
  const ready = currentCuetCalibrationReadyVNext({ manifest, registry, binding });
  return {
    verifier_version: binding.verifier_version,
    topology: binding.topology,
    validation_contract_hash: binding.validation_contract_hash,
    ready,
    readiness_reason: ready ? null : `${binding.verifier_version === 'cuet-fit-validator-v7.3' ? 'v73' : 'v74'}_current_release_required`,
    legacy_ready: legacyReady(manifest, registry),
  };
}
