import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { applySavedRequestMaximumRecovery, planSavedRequestMaximumRecovery } from '../lib/savedRequestMaximumRecoveryV7.mjs';

// Deliberately limited to the two requests independently identified in the
// 2026-10-08 recovery review. This command never settles or resubmits them.
const ownerPid = 35812;
const reservationIds = [
  'fed280b0-17a0-48c7-9af5-350476c7da7d',
  'e16dbb42-ed3a-4027-8462-0ee8ff7299ce'
];
const output = 'artifacts/question-factory/cuet-readiness-2026-10-08/execution/saved-request-maximum-hold-recovery.json';
function assertOwnerEnded() {
  try { process.kill(ownerPid, 0); throw new Error('saved_request_owner_still_live'); }
  catch (error) { if (error.message === 'saved_request_owner_still_live') throw error; if (error.code !== 'ESRCH') throw error; }
}

assertOwnerEnded();
const db = new DatabaseSync('data/pipeline-budget.sqlite');
try {
  db.exec('PRAGMA busy_timeout=10000');
  if (db.prepare('SELECT limit_micro FROM budget WHERE id=1').get()?.limit_micro !== 50_000_000) throw new Error('global_budget_drift');
  const plan = planSavedRequestMaximumRecovery(db, { reservationIds, expectedOwnerPid: ownerPid, isPidAlive: pid => {
    if (pid !== ownerPid) return true;
    try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; if (error.code === 'EPERM') return true; throw error; }
  } });
  assertOwnerEnded();
  const result = applySavedRequestMaximumRecovery(db, plan, { isPidAlive: pid => {
    if (pid !== ownerPid) return true;
    try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; if (error.code === 'EPERM') return true; throw error; }
  } });
  const report = {
    at: new Date().toISOString(),
    owner_pid: ownerPid,
    requests: result.recovered.map(row => ({ reservation_id: row.reservation_id, maximum_micro: row.maximum_micro })),
    total_maximum_micro: result.recovered.reduce((sum, row) => sum + row.maximum_micro, 0),
    proof_only: true,
    settled: false,
    resubmitted: false,
    request_rows_changed: 0,
    preserved_existing_holds: result.preserved_existing_holds,
    global_limit_micro: result.global_limit_micro
  };
  if (report.total_maximum_micro !== 53_271 || report.requests.length !== 2) throw new Error('saved_request_expected_scope_mismatch');
  mkdirSync(dirname(resolve(output)), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(report));
} finally { db.close(); }
