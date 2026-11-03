// Owner-scoped drain guard for the reassessment process. Default mode is a read-only
// preflight; --apply is intentionally explicit and requires an exact live command line.
// This only blocks new reservations for PID 6916; it never cancels or deletes requests.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { installTemporaryOwnerBudgetCaps } from '../lib/temporaryOwnerBudgetGuard.mjs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';

const OWNER_PID = 6916;
const CAP_MICRO = 1;
const INSTALLED_CAP_MICRO = 9_000_000;
const ledgerPath = 'data/pipeline-budget.sqlite';
const reassessmentDir = 'artifacts/question-factory/cuet-readiness-2026-10-08/reassessment';
const installationProofPath = 'artifacts/question-factory/cuet-readiness-2026-10-08/temporary-owner-cap-installation.json';
const proofPath = join(reassessmentDir, 'drain-proof-6916.json');
const argv = process.argv.slice(2);
const value = (name) => { const i = argv.indexOf(name); return i < 0 ? null : argv[i + 1] ?? null; };
const apply = argv.includes('--apply');
const expectedCommandLine = value('--verified-commandline');
if (!expectedCommandLine || !expectedCommandLine.includes('reassessCuetReadiness.mjs') ||
    !expectedCommandLine.includes('--measurement-only')) {
  throw new Error('exact_reassessment_commandline_evidence_required');
}
if (!existsSync(join(reassessmentDir, 'profile.json'))) throw new Error('reassessment_profile_required');
const profile = JSON.parse(readFileSync(join(reassessmentDir, 'profile.json'), 'utf8'));
if (profile.cap_usd !== 9 || profile.topology !== 'dual_blind' || profile.publication !== 'never' ||
    !profile.contract || !profile.verifier || !Array.isArray(profile.content_hashes)) {
  throw new Error('expected_reassessment_profile_mismatch');
}
if (!existsSync(installationProofPath)) throw new Error('owner_cap_installation_proof_required');
const installationProof = JSON.parse(readFileSync(installationProofPath, 'utf8'));
const installedOwnerCap = installationProof.caps?.find(row => row.owner_pid === OWNER_PID)?.cap_micro;
if (installedOwnerCap !== INSTALLED_CAP_MICRO || installationProof.lifetime_cap_micro !== 50_000_000) {
  throw new Error('expected_owner_cap_installation_history_mismatch');
}

const ps = "$p=Get-CimInstance -ClassName Win32_Process -Filter 'ProcessId = 6916'; if(-not $p){throw 'pid_not_found'}; $p.CommandLine";
let liveCommandLine;
try {
  liveCommandLine = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8' }).trim();
} catch (error) {
  throw new Error(`live_pid_commandline_unavailable:${error.message}`);
}
if (!liveCommandLine || liveCommandLine !== expectedCommandLine) throw new Error('live_pid_commandline_mismatch');

const db = new DatabaseSync(ledgerPath);
try {
  const hasTable = (name) => db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
  if (!hasTable('requests') || !hasTable('provider_batches') || !hasTable('provider_requests') || !hasTable('conservative_holds')) {
    throw new Error('ledger_request_schema_incomplete');
  }
  const budgetLimit = db.prepare('SELECT limit_micro FROM budget WHERE id=1').get()?.limit_micro;
  if (budgetLimit !== installationProof.lifetime_cap_micro) throw new Error('global_lifetime_cap_drift');
  const existingCaps = hasTable('temporary_owner_budget_caps')
    ? db.prepare('SELECT owner_pid,cap_micro FROM temporary_owner_budget_caps ORDER BY owner_pid').all() : [];
  const currentOwnerCap = existingCaps.find(row => row.owner_pid === OWNER_PID)?.cap_micro;
  if (currentOwnerCap !== INSTALLED_CAP_MICRO) throw new Error('expected_existing_9m_owner_cap_required');
  const ownerRows = db.prepare('SELECT id,model,reserved,actual,state,owner_pid FROM requests WHERE owner_pid=? ORDER BY id').all(OWNER_PID);
  const settledMicro = ownerRows.filter(r => r.state === 'settled').reduce((sum, r) => sum + Number(r.actual || 0), 0);
  const committedMicro = ownerRows.reduce((sum, r) => sum + (r.state === 'settled' ? Number(r.actual || 0) : Math.max(Number(r.reserved || 0), Number(r.actual || 0))), 0);
  if (!Number.isSafeInteger(committedMicro) || settledMicro <= CAP_MICRO || committedMicro <= CAP_MICRO) {
    throw new Error('one_micro_cap_must_be_below_verified_settled_spend');
  }
  const unbounded = db.prepare(`SELECT r.id FROM requests r LEFT JOIN conservative_holds h ON h.reservation_id=r.id
    WHERE r.owner_pid=? AND r.state='unresolved' AND (h.reservation_id IS NULL OR h.maximum_micro<>r.reserved OR r.actual>r.reserved)`).all(OWNER_PID);
  if (unbounded.length) throw new Error(`owner_unsettled_unbounded:${unbounded.map(r => r.id).join(',')}`);
  const accepted = db.prepare(`SELECT DISTINCT r.id,r.model,r.reserved,r.actual,r.state,
      EXISTS(SELECT 1 FROM provider_requests p WHERE p.reservation_id=r.id AND p.state='dispatching') AS request_dispatching,
      EXISTS(SELECT 1 FROM provider_batches b WHERE b.reservation_id=r.id AND b.state='dispatching') AS batch_dispatching
    FROM requests r LEFT JOIN provider_requests p ON p.reservation_id=r.id LEFT JOIN provider_batches b ON b.reservation_id=r.id
    WHERE r.owner_pid=? AND r.state<>'settled' ORDER BY r.id`).all(OWNER_PID);
  const inFlight = accepted.filter(r => r.state === 'reserved' || r.request_dispatching || r.batch_dispatching);
  const beforeIds = ownerRows.map(r => r.id);
  const proof = {
    created_at: new Date().toISOString(), owner_pid: OWNER_PID, exact_commandline_verified: true,
    profile_hash: hashJSON(profile), contract: profile.contract, topology: profile.topology,
    installation_proof_hash: hashJSON(installationProof),
    global_budget_unchanged: true, cap_micro: CAP_MICRO, settled_before_micro: settledMicro,
    replaced_cap_micro: currentOwnerCap,
    committed_before_micro: committedMicro, accepted_ids_left_to_settle: inFlight.map(r => r.id),
    nonsettled_owner_ids: accepted.map(r => r.id), unbounded_unresolved_ids: [],
    owner_request_ids_before: beforeIds, requests_deleted: 0,
  };
  if (apply) {
    if (existsSync(proofPath)) throw new Error('drain_proof_exists_use_newly_reviewed_tool_version');
    installTemporaryOwnerBudgetCaps(db, [{ owner_pid: OWNER_PID, cap_micro: CAP_MICRO }]);
    const capsAfter = db.prepare('SELECT owner_pid,cap_micro FROM temporary_owner_budget_caps ORDER BY owner_pid').all();
    const otherBefore = existingCaps.filter(row => row.owner_pid !== OWNER_PID);
    const otherAfter = capsAfter.filter(row => row.owner_pid !== OWNER_PID);
    if (JSON.stringify(otherBefore) !== JSON.stringify(otherAfter)) throw new Error('unrelated_owner_cap_changed');
    const afterIds = db.prepare('SELECT id FROM requests WHERE owner_pid=? ORDER BY id').all(OWNER_PID).map(r => r.id);
    const deleted = beforeIds.filter(id => !afterIds.includes(id));
    if (deleted.length) throw new Error('request_history_deletion_detected');
    proof.owner_request_ids_after = afterIds;
    proof.requests_added_during_cap_install = afterIds.filter(id => !beforeIds.includes(id));
    proof.requests_deleted = deleted.length;
    if (proof.requests_deleted !== 0) throw new Error('request_history_deletion_detected');
    mkdirSync(dirname(proofPath), { recursive: true });
    writeFileSync(proofPath, JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
  }
  console.log(JSON.stringify({ mode: apply ? 'applied' : 'preflight_only', ...proof, proof_path: apply ? proofPath : null }));
} finally { db.close(); }
