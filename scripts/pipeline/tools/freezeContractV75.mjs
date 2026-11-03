// Records the v7.5 contract identity before any fresh benchmark is registered. Local only: no provider, ledger or network access.
// Refuses to overwrite an existing freeze whose hashes differ; an identical re-run only reports.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { FACTORY_VERIFIER_VERSION_V75, PARENT_CONTRACT_V74_HASH, V75_ADDITIVE_FILES, validationContractV75 } from '../lib/contractV75.mjs';
import { V75_PROMPT_HASH } from '../lib/factoryEvidenceV75.mjs';
import { ORIGINAL_AUTHOR_POLICY_V75, ORIGINAL_AUTHOR_INSTRUCTIONS_V75 } from '../lib/originalAuthorPolicyV75.mjs';
import { ORIGINAL_AUTHOR_POLICY_V74, ORIGINAL_AUTHOR_INSTRUCTIONS_V74 } from '../lib/originalAuthorPolicyV74.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const lib = resolve(here, '../lib');
const target = resolve(here, '../../../artifacts/question-factory/cuet-readiness-2026-10-09/v75-contract-freeze.json');
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');

export function buildFreezeV75() {
  const files = Object.fromEntries([...V75_ADDITIVE_FILES.map(name => [`scripts/pipeline/lib/${name}`, sha(resolve(lib, name))]),
    ['scripts/pipeline/tools/runFreshCuetReadinessV75.mjs', sha(resolve(here, 'runFreshCuetReadinessV75.mjs'))]]);
  return {
    verifier_version: FACTORY_VERIFIER_VERSION_V75,
    validation_contract_hash: validationContractV75(),
    parent_contract_hash: PARENT_CONTRACT_V74_HASH,
    prompt_hash: V75_PROMPT_HASH,
    author_policy_hash: hashJSON({ policy: ORIGINAL_AUTHOR_POLICY_V75, instructions: ORIGINAL_AUTHOR_INSTRUCTIONS_V75, parent: { policy: ORIGINAL_AUTHOR_POLICY_V74, instructions: ORIGINAL_AUTHOR_INSTRUCTIONS_V74 } }),
    file_sha256: files,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const next = buildFreezeV75();
  if (existsSync(target)) {
    const { frozen_at, ...previous } = JSON.parse(readFileSync(target, 'utf8'));
    if (hashJSON(previous) !== hashJSON(next)) throw new Error('v75_contract_freeze_exists_with_different_hashes');
    console.log(JSON.stringify({ unchanged: true, frozen_at, ...next }));
  } else {
    mkdirSync(dirname(target), { recursive: true });
    const record = { ...next, frozen_at: new Date().toISOString() };
    writeFileSync(target, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
    console.log(JSON.stringify(record));
  }
}
