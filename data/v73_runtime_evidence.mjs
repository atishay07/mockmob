import { currentCuetCalibrationReadyVNext } from '../scripts/pipeline/lib/currentCuetCalibrationGateVNext.mjs';
import { runtimeBindingV73 } from './v73_runtime_contract.mjs';

const V73 = 'cuet-fit-validator-v7.3';
const KNOWN_V7 = new Set(['cuet-fit-validator-v7.1', 'cuet-fit-validator-v7.2', V73]);

// Legacy known versions continue through their existing generic release gate.
// Unknown v7 validators fail closed so a new version cannot inherit a prior release.
export function v73RuntimeEvidenceCurrent(record, { manifest, registry } = {}) {
  const version = record?.verifier_version;
  if (typeof version === 'string' && version.startsWith('cuet-fit-validator-v7.') && !KNOWN_V7.has(version)) return false;
  if (version !== V73) return true;

  const binding = runtimeBindingV73();
  const release = manifest?.cuet_fit_releases?.[binding.topology];
  return Boolean(record.validation_contract_hash === binding.validation_contract_hash &&
    release?.validation_contract_hash === record.validation_contract_hash &&
    currentCuetCalibrationReadyVNext({ manifest, registry, binding }));
}
