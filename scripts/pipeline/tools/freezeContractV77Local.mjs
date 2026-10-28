import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validationContractV77, FACTORY_VERIFIER_VERSION_V77, V77_ADDITIVE_FILES, PARENT_CONTRACT_V76_HASH } from '../lib/contractV77.mjs';
import { V77_PROMPT_HASH, V77_EXPLANATION_AUDIT_INSTRUCTIONS } from '../lib/factoryEvidenceV77.mjs';

const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const base = 'artifacts/question-factory/cuet-readiness-2026-10-09';
const paths = V77_ADDITIVE_FILES.map(name => `scripts/pipeline/lib/${name}`);
const freeze = {
  frozen_at: new Date().toISOString(),
  scope: 'Prospective local contract freeze only. No new cases, registration, native evaluation, release, pilot or publication is created.',
  qualification_state: 'unqualified',
  verifier_version: FACTORY_VERIFIER_VERSION_V77,
  validation_contract_hash: validationContractV77(),
  parent_contract_hash: PARENT_CONTRACT_V76_HASH,
  parent_freeze_sha256: sha(`${base}/v76-contract-freeze.json`),
  prompt_hash: V77_PROMPT_HASH,
  explanation_audit_instructions_sha256: createHash('sha256').update(V77_EXPLANATION_AUDIT_INSTRUCTIONS).digest('hex'),
  file_sha256: Object.fromEntries(paths.map(path => [path, sha(path)])),
  local_tests: { factory: { pass: 696, fail: 0, log: 'execution/root-factory-tests-v77-final.log' }, focused: { pass: 14, fail: 0 }, independent_cached_restart: { pass: 1, fail: 0 } },
  independent_review: { path: `${base}/execution/v77-independent-semantic-audit-review.md`, sha256: sha(`${base}/execution/v77-independent-semantic-audit-review.md`) },
  inspected_evidence_rule: 'All inspected V75/V76 cases, fixtures and local mock controls are regression evidence only. Any future native qualification requires genuinely fresh independently established cases constructed after this freeze.',
  semantic_limit: 'The existing explanation-support call now audits both independent frozen option matrices. Structured source binding and local tests do not prove model entailment judgments or generator qualification.',
  native_calls: 0,
  release_profile_created: false,
  publication_enabled: false,
};
const path = `${base}/v77-local-contract-freeze.json`;
writeFileSync(path, JSON.stringify(freeze, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ path, contract_hash: freeze.validation_contract_hash, qualification_state: freeze.qualification_state }));
