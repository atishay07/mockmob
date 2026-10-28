import { readFileSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { EXPECTED_RUNTIME_BINDING_V713 } from './v713_runtime_expected.mjs';
const VERSION = 'cuet-fit-validator-v7.13-compact-demand';
const digest = value => createHash('sha256').update(value).digest('hex');
// Raw source hashes survive Next's transformed bundle. No capsule or changed source means fail closed.
export function runtimeBindingV713({ root = process.cwd(), readText = p => readFileSync(p, 'utf8') } = {}) {
  const metadata = JSON.parse(readText(resolve(root, 'data/cuet_v713_runtime_binding.json')));
  if (!EXPECTED_RUNTIME_BINDING_V713 || JSON.stringify(metadata.binding) !== JSON.stringify(EXPECTED_RUNTIME_BINDING_V713)) throw Error('runtime_v713_binding_changed');
  if (metadata.schema !== 'cuet-v713-runtime-contract-v1' || metadata.binding?.verifier_version !== VERSION ||
      metadata.binding?.topology !== 'dual_blind' || !/^[a-f0-9]{64}$/.test(metadata.binding.validation_contract_hash || '') ||
      !metadata.files || Object.keys(metadata.files).length < 15) throw Error('runtime_v713_metadata_invalid');
  for (const required of ['scripts/pipeline/lib/contractV713.mjs', 'scripts/pipeline/lib/verifyV713.mjs',
    'scripts/pipeline/lib/factoryEvidenceV713.mjs', 'scripts/pipeline/lib/difficultyPolicyV713.mjs',
    'data/factory_runtime_evidence.mjs', 'data/v713_runtime_contract.mjs']) {
    if (!metadata.files[required]) throw Error('runtime_v713_required_source_missing');
  }
  for (const [name, expected] of Object.entries(metadata.files)) {
    const path = resolve(root, name), within = relative(root, path);
    if (isAbsolute(within) || within.startsWith('..') || !/^[a-f0-9]{64}$/.test(expected) ||
        digest(readText(path)) !== expected) throw Error('runtime_v713_source_changed');
  }
  return metadata.binding;
}
