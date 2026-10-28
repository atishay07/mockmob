// Read-only ledger reconciliation for the completed limited official-key study.
// This tool never constructs BudgetLedger, calls a provider, acquires a lease,
// or changes run/progress/raw judgment records. It archives the original
// report/run/progress once, then writes the canonical report's corrected cost.
import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { scopedAccounting } from '../lib/scopedAccounting.mjs';

const studyId = 'cuet-official-key-limited-readiness-v1-2026-10-08';
const studyPrefix = `${studyId}:`;
const studyDir = 'artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/official-readiness-study-v1';
const files = { report: `${studyDir}/report.json`, run: `${studyDir}/run.json`, progress: `${studyDir}/progress.json`, freeze: `${studyDir}/freeze.json` };
const backupDir = `${studyDir}/original-before-accounting-refresh`;
const proofPath = `${studyDir}/accounting-correction-proof.json`;
const ledgerPath = process.env.CUET_BUDGET_LEDGER || 'data/pipeline-budget.sqlite';
const hash = value => createHash('sha256').update(value).digest('hex');
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
for (const path of Object.values(files)) if (!existsSync(path)) throw new Error(`official_study_artifact_missing:${path}`);

mkdirSync(backupDir, { recursive: true });
const originalBytes = {};
for (const [key, path] of Object.entries(files).filter(([key]) => key !== 'freeze')) {
  const backupPath = `${backupDir}/${key}.json`;
  if (!existsSync(backupPath)) copyFileSync(path, backupPath);
  originalBytes[key] = readFileSync(backupPath);
}
const baseReport = JSON.parse(originalBytes.report.toString('utf8'));
const run = readJson(files.run), progress = readJson(files.progress), freeze = readJson(files.freeze);
if (run.study_id !== studyId || progress.study_id !== studyId) throw new Error('official_study_id_mismatch');
if (run.freeze_hash !== freeze.contract_hash || progress.freeze_hash !== freeze.contract_hash) throw new Error('official_study_freeze_binding_mismatch');
if (baseReport.freeze_hash !== freeze.contract_hash) throw new Error('original_report_freeze_binding_mismatch');

const expected = run.expected_results || [];
const resultRows = Object.values(progress.results || {});
const judged = resultRows.filter(r => r.status === 'judged').length;
const errors = resultRows.filter(r => r.status === 'error').length;
const missing = expected.length - Object.keys(progress.results || {}).length;
if (expected.length !== 138 || judged !== 97 || errors !== 41 || missing !== 0 || Object.keys(progress.results || {}).length !== expected.length)
  throw new Error(`official_study_judgment_counts_changed:${JSON.stringify({ expected: expected.length, judged, errors, missing })}`);

const expectedByCandidate = new Map();
const statusByCandidate = new Map();
for (const result of expected) {
  const candidate = `${studyId}:${result.case_id}:${result.provider}:${result.model}`;
  expectedByCandidate.set(candidate, result);
  const recorded = progress.results?.[result.result_id] || null;
  statusByCandidate.set(candidate, { result_id: result.result_id, status: recorded?.status || 'missing', provider: result.provider, model: result.model });
}
const resultByRequestId = new Map();
for (const [resultId, result] of Object.entries(progress.results || {})) {
  for (const id of result.usage_request_ids || []) resultByRequestId.set(id, { result_id: resultId, status: result.status, provider: result.provider, model: result.model });
}

const db = new DatabaseSync(ledgerPath, { readOnly: true });
let accounting, requestRows, globalSnapshot, providerBreakdown, stageBreakdown, orphanRequestCount = 0;
try {
  db.exec('BEGIN');
  const ledger = { db };
  accounting = scopedAccounting(ledger, studyPrefix);
  const ids = accounting.requests.map(r => r.reservation_id);
  const rawRows = ids.length ? db.prepare(`SELECT id,model,reserved,actual,state,created_at,receipt_json FROM requests WHERE id IN (${ids.map(()=>'?').join(',')})`).all(...ids) : [];
  const rawById = new Map(rawRows.map(r => [r.id, r]));
  requestRows = accounting.requests.map(row => {
    const raw = rawById.get(row.reservation_id);
    let receipt = null; try { receipt = raw?.receipt_json ? JSON.parse(raw.receipt_json) : null; } catch { /* Usage remains explicitly missing. */ }
    const usage = receipt?.usage || receipt?.usageMetadata || null;
    const expectedResult = expectedByCandidate.get(`${studyId}:${row.candidate_id}`) || null;
    const progressResult = statusByCandidate.get(`${studyId}:${row.candidate_id}`) || resultByRequestId.get(row.reservation_id) || null;
    const input = usage?.input_tokens ?? usage?.promptTokenCount ?? usage?.prompt_tokens ?? null;
    const output = usage?.output_tokens ?? usage?.completion_tokens ?? (Number.isSafeInteger(usage?.candidatesTokenCount) ? usage.candidatesTokenCount + (usage?.thoughtsTokenCount || 0) : null);
    const reasoning = usage?.output_tokens_details?.reasoning_tokens ?? usage?.thoughtsTokenCount ?? null;
    const committed = raw?.state === 'settled' ? (raw.actual || 0) : Math.max(raw?.reserved || 0, raw?.actual || 0);
    return { ...row, model: raw?.model || row.model, reserved_micro: raw?.reserved ?? null, actual_micro: raw?.actual ?? null,
      created_at: raw?.created_at || null, committed_micro: committed, receipt_status: raw?.state || row.state,
      input_tokens: Number.isSafeInteger(input) ? input : null, output_tokens: Number.isSafeInteger(output) ? output : null,
      reasoning_tokens: Number.isSafeInteger(reasoning) ? reasoning : null, usage_receipt_present: Boolean(usage),
      error_http_status: receipt?.http_status ?? receipt?.provider_batch_record?.response?.status_code ?? null,
      error_code: receipt?.error?.code || receipt?.provider_batch_record?.response?.body?.error?.code || null,
      result_status: progressResult?.status || null, result_id: progressResult?.result_id || null,
      case_id: expectedResult?.case_id || null, case_type: expectedResult?.case_type || null,
      provider_model_expected: expectedResult?.model || null };
  });
  const providerKeys = [...new Set(requestRows.map(r => `${r.provider || 'unknown'}:${r.model || 'unknown'}`))].sort();
  providerBreakdown = Object.fromEntries(providerKeys.map(key => {
    const [provider, model] = key.split(':');
    const rows = requestRows.filter(r => (r.provider || 'unknown') === provider && (r.model || 'unknown') === model);
    const sum = fn => rows.reduce((total, row) => total + fn(row), 0);
    return [key, { provider, model, requests: rows.length, settled_requests: rows.filter(r => r.receipt_status === 'settled').length,
      held_requests: rows.filter(r => r.receipt_status !== 'settled').length,
      settled_micro: sum(r => r.settled_micro), held_micro: sum(r => r.held_micro), committed_micro: sum(r => r.committed_micro),
      requests_with_usage_receipts: rows.filter(r => r.usage_receipt_present).length,
      usage_missing_requests: rows.filter(r => !r.usage_receipt_present).length,
      input_tokens: sum(r => r.input_tokens || 0), output_tokens: sum(r => r.output_tokens || 0), reasoning_tokens: sum(r => r.reasoning_tokens || 0),
      input_token_unreported_requests: rows.filter(r => r.input_tokens === null).length,
      output_token_unreported_requests: rows.filter(r => r.output_tokens === null).length,
      reasoning_token_unreported_requests: rows.filter(r => r.reasoning_tokens === null).length,
      failed_judgment_requests: rows.filter(r => r.result_status === 'error').length,
      failed_judgment_committed_micro: sum(r => r.result_status === 'error' ? r.committed_micro : 0),
      judgment_results: { judged: expected.filter(e => e.provider === provider && e.model === model && progress.results?.[e.result_id]?.status === 'judged').length,
        errors: expected.filter(e => e.provider === provider && e.model === model && progress.results?.[e.result_id]?.status === 'error').length,
        missing: expected.filter(e => e.provider === provider && e.model === model && !progress.results?.[e.result_id]).length },
      failed_judgment_ids: [...new Set(rows.filter(r => r.result_status === 'error').map(r => r.result_id).filter(Boolean))] }];
  }));
  const orphanRequests = requestRows.filter(r => !expectedByCandidate.has(`${studyId}:${r.candidate_id}`) && !resultByRequestId.has(r.reservation_id));
  orphanRequestCount = orphanRequests.length;
  const stages = [...new Set(requestRows.map(r => r.stage || 'unknown'))].sort();
  stageBreakdown = Object.fromEntries(stages.map(stage => {
    const rows = requestRows.filter(r => (r.stage || 'unknown') === stage);
    const sum = fn => rows.reduce((total, row) => total + fn(row), 0);
    return [stage, { requests: rows.length, settled_micro: sum(r => r.settled_micro), held_micro: sum(r => r.held_micro), committed_micro: sum(r => r.committed_micro),
      input_tokens: sum(r => r.input_tokens || 0), output_tokens: sum(r => r.output_tokens || 0), reasoning_tokens: sum(r => r.reasoning_tokens || 0),
      reasoning_token_unreported_requests: rows.filter(r => r.reasoning_tokens === null).length,
      error_result_requests: rows.filter(r => r.result_status === 'error').length }];
  }));
  globalSnapshot = db.prepare(`SELECT
    COALESCE(SUM(CASE WHEN state='settled' THEN actual ELSE 0 END),0) AS settled_micro,
    COALESCE(SUM(CASE WHEN state<>'settled' THEN MAX(reserved,COALESCE(actual,0)) ELSE 0 END),0) AS held_micro,
    COUNT(*) AS requests FROM requests`).get();
  db.exec('COMMIT');
} finally { db.close(); }

const sum = fn => requestRows.reduce((total, row) => total + fn(row), 0);
const settledMicro = sum(r => r.settled_micro), heldMicro = sum(r => r.held_micro), grossMicro = settledMicro + heldMicro;
const oldReportHash = hash(originalBytes.report), runHash = hash(originalBytes.run), progressHash = hash(originalBytes.progress);
const now = new Date().toISOString();
const accountingRefresh = { schema: 'official-cuet-study-accounting-refresh-v1', study_id: studyId, refreshed_at: now,
  refresh_command: 'node scripts/pipeline/tools/refreshOfficialCuetStudyAccounting.mjs',
  source: 'scripts/pipeline/lib/scopedAccounting.mjs, read-only native SQLite ledger snapshot; exact prefixed candidate attribution; no concurrent lifetime delta',
  original_artifacts: { report_sha256: oldReportHash, run_sha256: runHash, progress_sha256: progressHash,
    preserved_in: backupDir, judgments_file_modified: false, run_file_modified: false, progress_file_modified: false },
  judgment_scope: { expected_denominator: expected.length, judged: judged, errors: errors, missing: missing, denominator_complete: true,
    errors_are_not_academic_rejections: true, retries_added: 0 },
  ledger_scope: { candidate_prefix: studyPrefix, requests: requestRows.length, settled_requests: requestRows.filter(r => r.receipt_status === 'settled').length,
    held_requests: requestRows.filter(r => r.receipt_status !== 'settled').length,
    unresolved_requests: requestRows.filter(r => r.receipt_status === 'unresolved').length,
    settled_micro: settledMicro, held_micro: heldMicro, gross_committed_micro: grossMicro,
    settled_usd: settledMicro / 1e6, held_usd: heldMicro / 1e6, gross_committed_usd: grossMicro / 1e6,
    pending_usage_receipts: requestRows.filter(r => r.receipt_status !== 'settled').length,
    usage_missing_requests: requestRows.filter(r => !r.usage_receipt_present).length,
    orphan_request_count: orphanRequestCount, provider_breakdown: providerBreakdown, stage_breakdown: stageBreakdown,
    invoices: { status: 'not_reconciled', note: 'Native request receipts are cost accounting, not provider invoices or subscription consumption.' } },
  interpretation: { source_support: 'Official final keys ground key-agreement scoring. source_support is a separate validator judgment; thin or absent academic excerpts must not be interpreted as proof that an official-keyed PYQ is academically false.',
    cost: 'Settled values use provider usage receipts and saved rates; non-settled reservations are reported at max(reserved, actual) and remain held.',
    current_global_ledger_totals_are_context_only: globalSnapshot } };

const refreshed = structuredClone(baseReport);
refreshed.budget = { cap_usd: run.cap_usd,
  study_committed_usd: grossMicro / 1e6, settled_usd: settledMicro / 1e6, held_usd: heldMicro / 1e6,
  gross_committed_usd: grossMicro / 1e6, request_count: requestRows.length,
  settled_requests: accountingRefresh.ledger_scope.settled_requests, held_requests: accountingRefresh.ledger_scope.held_requests,
  unresolved_requests: accountingRefresh.ledger_scope.unresolved_requests,
  pending_usage_receipts: accountingRefresh.ledger_scope.pending_usage_receipts,
  invoice_status: 'not_reconciled', accounting_source: accountingRefresh.source,
  provider_breakdown: providerBreakdown };
refreshed.accounting_refresh = accountingRefresh;
refreshed.counts = { ...refreshed.counts, expected_provider_judgments: expected.length, judged, errors, missing,
  denominators: { retained: expected.length, judged, errors_not_rejections: errors, missing } };
refreshed.source_support_interpretation = accountingRefresh.interpretation.source_support;

const reportBytesNow = readFileSync(files.report), runBytesNow = readFileSync(files.run), progressBytesNow = readFileSync(files.progress);
const expectedReportHash = existsSync(`${backupDir}/report.json`) ? hash(readFileSync(`${backupDir}/report.json`)) : hash(reportBytesNow);
if (hash(runBytesNow) !== runHash || hash(progressBytesNow) !== progressHash) throw new Error('official_study_raw_evidence_changed_during_accounting_refresh');
if (hash(reportBytesNow) !== expectedReportHash && !readJson(files.report).accounting_refresh) throw new Error('official_study_report_changed_during_accounting_refresh');
const proof = { schema: 'official-cuet-study-accounting-correction-proof-v1', study_id: studyId, refreshed_at: now,
  input_hashes: { original_report_sha256: oldReportHash, current_report_before_refresh_sha256: hash(reportBytesNow), run_sha256: runHash, progress_sha256: progressHash,
    freeze_file_sha256: hash(readFileSync(files.freeze)), scoped_reservation_ids_sha256: hash(requestRows.map(r=>r.reservation_id).sort().join('\n')),
    scoped_accounting_rows_sha256: hash(JSON.stringify([...requestRows].sort((a,b)=>a.reservation_id.localeCompare(b.reservation_id)))) },
  output: { canonical_report_path: files.report, canonical_report_sha256: hash(Buffer.from(`${JSON.stringify(refreshed, null, 2)}\n`)),
    backup_directory: backupDir, accounting_refresh_proof_path: proofPath },
  discrepancy: { prior_report_study_committed_usd: baseReport.budget?.study_committed_usd ?? null,
    corrected_gross_committed_usd: grossMicro / 1e6, reason: 'The prior report summarized a stale run.json field; this refresh attributes only native ledger rows to the frozen study ID.' },
  scope: { expected: expected.length, judged, errors, missing, ledger_requests: requestRows.length, retries: 0, provider_calls: 0, lease_acquired: false,
    ledger_settled_usd: settledMicro / 1e6, ledger_held_usd: heldMicro / 1e6, ledger_gross_committed_usd: grossMicro / 1e6 } };

writeFileSync(files.report, `${JSON.stringify(refreshed, null, 2)}\n`);
proof.output.canonical_report_sha256 = hash(readFileSync(files.report));
writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`);
console.log(JSON.stringify({ canonical_report: files.report, proof: proofPath, backup_dir: backupDir,
  expected_denominator: expected.length, judged, errors, missing, requests: requestRows.length,
  settled_usd: settledMicro / 1e6, held_usd: heldMicro / 1e6, gross_committed_usd: grossMicro / 1e6,
  provider_breakdown: Object.fromEntries(Object.entries(providerBreakdown).map(([key,row])=>[key,{requests:row.requests,settled_usd:row.settled_micro/1e6,held_usd:row.held_micro/1e6,committed_usd:row.committed_micro/1e6,input_tokens:row.input_tokens,output_tokens:row.output_tokens,reasoning_tokens:row.reasoning_tokens,failed_judgment_requests:row.failed_judgment_requests}])),
  provider_calls: 0, lease_acquired: false }));
