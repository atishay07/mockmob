import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Next bundles import.meta.url-based modules. Read the traced original sources
// from the deployment root instead; never hash the transformed server bundle.
// The saved metadata is produced by the unbundled, frozen academic contract.
export function runtimeBindingV73({ root = process.cwd(), readText = path => readFileSync(path, 'utf8') } = {}) {
  const metadata = JSON.parse(readText(resolve(root, 'data/cuet_v73_runtime_binding.json')));
  if (metadata.schema !== 'cuet-v73-runtime-contract-v1' || metadata.binding?.verifier_version !== 'cuet-fit-validator-v7.3' ||
      metadata.parent_files?.length !== 15 || metadata.additive_files?.length !== 5 ||
      new Set([...metadata.parent_files, ...metadata.additive_files]).size !== 20) {
    throw new Error('runtime_v73_contract_metadata_invalid');
  }
  const files = paths => paths.map(path => ({ path, text: readText(resolve(root, 'scripts/pipeline/lib', path)) }));
  const parent = files(metadata.parent_files), additive = files(metadata.additive_files);
  const parentHash = hash(parent.map(file => file.text));
  if (parentHash !== metadata.parent_contract_hash) throw new Error('runtime_v73_parent_contract_changed');
  const descriptor = rows => rows.map(({ path, text }) => ({ path, sha256: hash(text) }));
  const contract = hash({ verifier_version: metadata.binding.verifier_version, parent_contract_hash: parentHash,
    parent_files: descriptor(parent), additive_files: descriptor(additive), policy_ids: metadata.policy_ids });
  if (contract !== metadata.binding.validation_contract_hash) throw new Error('runtime_v73_additive_contract_changed');
  return metadata.binding;
}
