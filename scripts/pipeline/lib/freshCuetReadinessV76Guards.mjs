import { scopedAccounting } from './scopedAccounting.mjs';
import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
export const QUALIFICATION_V76_PREFIX = 'v76-qualification-2026-10-09-';
export const QUALIFICATION_V76_CAP_USD = 4;
export function providersForEvidenceRoleV76(classification) {
  if (!['fresh', 'regression'].includes(classification)) throw new Error('registered_evidence_classification_required');
  return ['openai', 'gemini'];
}
export function haikuRoleForEvidenceV76(classification) {
  providersForEvidenceRoleV76(classification);
  return 'Not evaluated in this bounded qualification; Luna and Gemini retain every publication-validation stage. Haiku remains available for separately registered measurements.';
}
export function assertExecutionPlanV76(plan, { id, binding, inputHashes, registryHash, denominator, validRoots, controlledDefects, classification = 'fresh' }) {
  if (typeof id !== 'string' || !id.startsWith(QUALIFICATION_V76_PREFIX) || plan?.id !== id || plan.publication !== 'never' || plan.maximum_content_repairs !== 0 || plan.regeneration !== false ||
      plan.cap_usd !== QUALIFICATION_V76_CAP_USD || plan.qualification_budget_prefix !== QUALIFICATION_V76_PREFIX || plan.topology !== 'dual_blind' ||
      plan.denominator !== denominator || plan.valid_roots !== validRoots || plan.controlled_defects !== controlledDefects ||
      JSON.stringify(plan.contract_binding) !== JSON.stringify(binding) || JSON.stringify(plan.input_hashes) !== JSON.stringify(inputHashes) || plan.source_registry_hash !== registryHash ||
      JSON.stringify(plan.providers) !== JSON.stringify(providersForEvidenceRoleV76(classification)) || plan.haiku_role !== haikuRoleForEvidenceV76(classification)) throw new Error('registered_inputs_or_runner_changed');
  return true;
}
// Fresh and regression runs share one persistent cap. A separate study cannot reset it.
export function qualificationAccountingV76(ledger) {
  return scopedAccounting(ledger, QUALIFICATION_V76_PREFIX);
}
// A single owner serializes the shared phase cap. Dead-owner receipts remain in history;
// an uncertain/live owner blocks a duplicate, and accepted provider work is never restarted here.
export function acquireQualificationLeaseV76(directory, { pid = process.pid, isPidAlive = value => {
  try { process.kill(value, 0); return true; } catch (e) { if (e.code === 'ESRCH') return false; return true; }
} } = {}) {
  mkdirSync(directory, { recursive: true });
  const file = join(directory, 'v76-qualification-owner.json');
  const owner = { pid, nonce: randomUUID(), started_at: new Date().toISOString() };
  try { writeFileSync(file, JSON.stringify(owner), { flag: 'wx' }); }
  catch (e) {
    if (e.code !== 'EEXIST') throw e;
    const old = JSON.parse(readFileSync(file, 'utf8'));
    if (!Number.isInteger(old.pid) || isPidAlive(old.pid)) throw new Error('qualification_owner_live_or_uncertain_no_duplicate_runner');
    renameSync(file, join(directory, `v76-qualification-owner-ended-${old.nonce || randomUUID()}.json`));
    writeFileSync(file, JSON.stringify(owner), { flag: 'wx' });
  }
  return () => {
    const current = JSON.parse(readFileSync(file, 'utf8'));
    if (current.nonce !== owner.nonce || current.pid !== pid) throw new Error('qualification_owner_changed_preserve_lease');
    renameSync(file, join(directory, `v76-qualification-owner-drained-${owner.nonce}.json`));
  };
}
