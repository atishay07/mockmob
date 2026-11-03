// Execution-only correction. No academic prompt, rubric, effort, price or request identity changes.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
export const EXECUTION_CORRECTION_V713_R2 = 'v713-provider-capacity-pause-and-receipt-archive-r2';
export const capacityRefusedV713R2 = error => error?.flexUnavailable === true && error?.rejectedBeforeInference === true;
export function zeroCostFlexRefusalV713R2(ledger, row) {
  if (!row || row.state !== 'flex_unavailable') return null;
  const request = ledger.db.prepare('SELECT * FROM requests WHERE id=?').get(row.reservation_id);
  if (!request || request.state !== 'settled' || request.actual !== 0) return null;
  let receipt;
  try { receipt = JSON.parse(request.receipt_json); } catch { return null; }
  if (receipt?.provider !== 'openai' || receipt.http_status !== 429 || receipt.type !== 'resource_unavailable' ||
      receipt.idempotency_key !== row.id) return null;
  return { provider_request: row, reservation: request };
}
// The legacy transport clears a retryable zero-cost row before retrying its logical key.
// Retain its entire raw request and settled receipt before allowing that operation.
export function archiveRefusedAttemptsV713R2(native, { ledger, directory }) {
  return { ...native, async generate(provider, body, options) {
    const row = ledger.db.prepare('SELECT * FROM provider_requests WHERE id=?').get(options.key);
    if (row?.state === 'flex_unavailable') {
      const history = zeroCostFlexRefusalV713R2(ledger, row);
      if (!history) throw Error('refused_attempt_receipt_not_established');
      if (![row.id, row.reservation_id].every(id => /^[a-zA-Z0-9_-]+$/.test(id))) throw Error('refused_attempt_identity_invalid');
      mkdirSync(directory, { recursive: true });
      const file = resolve(directory, `${row.id}-${row.reservation_id}.json`);
      const bytes = JSON.stringify(history, null, 2) + '\n';
      if (existsSync(file)) {
        if (readFileSync(file, 'utf8') !== bytes) throw Error('refused_attempt_archive_changed');
      } else writeFileSync(file, bytes, { flag: 'wx' });
    }
    return native.generate(provider, body, options);
  } };
}
// Recover ONLY positively receipt-proven, zero-cost capacity refusals. Unknown and accepted requests stay untouched.
export function restoreCapacityRefusalsV713R2(state, { ledger, campaignId }) {
  const changes = [];
  for (const job of Object.values(state.jobs)) {
    if (job.state !== 'quarantined' || !job.result?.reasons?.some(reason => /^provider_http_429:/.test(reason))) continue;
    const rows = ledger.db.prepare("SELECT * FROM provider_requests WHERE json_extract(request_json,'$.config.candidate_id')=?").all(`${campaignId}:${job.id}`);
    const batches = ledger.db.prepare("SELECT state FROM provider_batches WHERE json_extract(request_json,'$.config.candidate_id')=?").all(`${campaignId}:${job.id}`);
    if (rows.some(row => ['dispatching', 'unresolved'].includes(row.state)) || batches.some(row => row.state !== 'complete')) continue;
    const refused = rows.filter(row => row.state === 'flex_unavailable');
    if (!refused.length || refused.some(row => !zeroCostFlexRefusalV713R2(ledger, row))) continue;
    const stage = job.result.failed_stage;
    const next = stage === 'repair_started' ? 'repair_started' : stage === 'revalidating' ? 'revalidating' :
      stage === 'validating' ? 'generated' : stage === 'authoring' && !job.candidate ? 'queued' : null;
    if (!next) throw Error('capacity_refusal_resume_stage_unknown:' + job.id);
    const original = structuredClone(job.result);
    job.transport_outcome_history = [...(job.transport_outcome_history || []), { state: job.state, result: original,
      recovery_basis: EXECUTION_CORRECTION_V713_R2, request_keys: refused.map(row => row.id) }];
    job.state = next; delete job.result;
    changes.push({ candidate_id: job.id, before_state: 'quarantined', after_state: next,
      original_outcome: original, zero_cost_refused_keys: refused.map(row => row.id), accepted_or_unknown_resubmitted: false });
  }
  return changes;
}
