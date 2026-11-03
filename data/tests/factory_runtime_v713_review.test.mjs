import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { runtimeBindingV713 } from '../v713_runtime_contract.mjs';
import { factoryRuntimeEvidenceCurrent } from '../factory_runtime_evidence.mjs';
import { v73RuntimeEvidenceCurrent } from '../v73_runtime_evidence.mjs';
import { currentRegistry } from '../evidence_registry.js';

test('V713 runtime binding fails closed when capsule is absent or declares another version', () => {
  const root = resolve('artifacts/question-factory', `v713-runtime-review-${randomUUID()}`);
  mkdirSync(root, { recursive: true });
  try {
    assert.throws(() => runtimeBindingV713({ root }), /ENOENT/);
    const metadataPath = resolve(root, 'data/cuet_v713_runtime_binding.json');
    const readText = path => {
      assert.equal(path, metadataPath);
      return JSON.stringify({ schema: 'cuet-v713-runtime-contract-v1',
        binding: { verifier_version: 'cuet-fit-validator-v7.12', topology: 'dual_blind', validation_contract_hash: 'a'.repeat(64) },
        files: Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`file-${i}`, 'b'.repeat(64)])) });
    };
    assert.throws(() => runtimeBindingV713({ root, readText }), /runtime_v713_binding_changed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('unknown V7 versions fail closed and V713 evidence requires its exact runtime capsule', () => {
  const record = { verifier_version: 'cuet-fit-validator-v7.15-unknown', validation_contract_hash: 'a'.repeat(64) };
  assert.equal(v73RuntimeEvidenceCurrent(record, { manifest: {}, registry: {} }), false);
  assert.throws(() => factoryRuntimeEvidenceCurrent({ ...record,
    verifier_version: 'cuet-fit-validator-v7.13-compact-demand' }, { manifest: {}, registry: {} }), /ENOENT/);
});

test('staging registry override is available only under the explicit staging flag and is path-contained', () => {
  const root = resolve('artifacts/question-factory');
  const dir = resolve(root, `v713-registry-review-${randomUUID()}`);
  const snapshot = join(dir, 'registry.json');
  const previousStaging = process.env.MOCKMOB_STAGING_APP;
  const previousSnapshot = process.env.CUET_STAGING_REGISTRY_FILE;
  mkdirSync(dir, { recursive: true });
  writeFileSync(snapshot, JSON.stringify({ version: 'synthetic-v713-staging-only' }));
  try {
    process.env.MOCKMOB_STAGING_APP = '1';
    process.env.CUET_STAGING_REGISTRY_FILE = snapshot;
    assert.deepEqual(currentRegistry(), { version: 'synthetic-v713-staging-only' });
    process.env.MOCKMOB_STAGING_APP = '0';
    assert.deepEqual(currentRegistry(), JSON.parse(readFileSync(resolve('data/source_registry.json'), 'utf8')));
    process.env.MOCKMOB_STAGING_APP = '1';
    process.env.CUET_STAGING_REGISTRY_FILE = resolve(root, '..', 'outside.json');
    assert.throws(() => currentRegistry(), /staging_registry_snapshot_path_invalid/);
  } finally {
    if (previousStaging === undefined) delete process.env.MOCKMOB_STAGING_APP;
    else process.env.MOCKMOB_STAGING_APP = previousStaging;
    if (previousSnapshot === undefined) delete process.env.CUET_STAGING_REGISTRY_FILE;
    else process.env.CUET_STAGING_REGISTRY_FILE = previousSnapshot;
    rmSync(dir, { recursive: true, force: true });
  }
});
