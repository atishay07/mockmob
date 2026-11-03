import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertExecutionPlanV76, providersForEvidenceRoleV76, haikuRoleForEvidenceV76, acquireQualificationLeaseV76, QUALIFICATION_V76_PREFIX } from '../lib/freshCuetReadinessV76Guards.mjs';
test('v76 qualification binds two independent validators and shared immutable budget scope', () => {
  const id = QUALIFICATION_V76_PREFIX + 'fresh';
  const args = { id, binding: { version: 'v76' }, inputHashes: { code: 'frozen' }, registryHash: 'registry', denominator: 28, validRoots: 16, controlledDefects: 12 };
  const plan = { id, publication: 'never', maximum_content_repairs: 0, regeneration: false, cap_usd: 4, qualification_budget_prefix: QUALIFICATION_V76_PREFIX, topology: 'dual_blind', denominator: 28, valid_roots: 16, controlled_defects: 12, contract_binding: args.binding, input_hashes: args.inputHashes, source_registry_hash: 'registry', providers: ['openai', 'gemini'], haiku_role: haikuRoleForEvidenceV76('fresh') };
  assert.equal(assertExecutionPlanV76(plan, args), true);
  for (const change of [{ cap_usd: 8 }, { qualification_budget_prefix: id }, { providers: ['openai'] }, { providers: ['openai', 'gemini', 'anthropic'] }, { regeneration: true }]) assert.throws(() => assertExecutionPlanV76({ ...plan, ...change }, args));
  assert.deepEqual(providersForEvidenceRoleV76('regression'), ['openai', 'gemini']);
});
test('one qualification owner blocks duplicate fresh/regression runners and preserves drained owner history', () => {
  const directory = mkdtempSync(join(tmpdir(), 'v76-qualification-lease-'));
  const release = acquireQualificationLeaseV76(directory);
  const before = readFileSync(join(directory, 'v76-qualification-owner.json'), 'utf8');
  assert.throws(() => acquireQualificationLeaseV76(directory, { pid: 99, isPidAlive: () => true }), /no_duplicate_runner/);
  assert.equal(readFileSync(join(directory, 'v76-qualification-owner.json'), 'utf8'), before);
  release();
  assert.equal(readdirSync(directory).filter(name => name.includes('drained')).length, 1);
  const next = acquireQualificationLeaseV76(directory); next();
  assert.equal(readdirSync(directory).filter(name => name.includes('drained')).length, 2);
});
