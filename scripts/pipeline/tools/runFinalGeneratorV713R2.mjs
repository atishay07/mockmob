import { capacityRefusedV713R2, archiveRefusedAttemptsV713R2, restoreCapacityRefusalsV713R2 } from '../lib/providerAvailabilityV713R2.mjs';
// Versioned diagnostic continuation of the SAME forty allocated ideas. Never publishes or claims fresh qualification.
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import { DatabaseSync } from 'node:sqlite';
import { BudgetLedger } from '../lib/budgetLedger.mjs';
import { FactoryStore } from '../lib/factoryStore.mjs';
import { createFactoryTransportV713 } from '../lib/factoryTransportV713.mjs';
import { longFetch } from '../lib/longFetch.mjs';
import { createCampaignGuardV713 } from '../lib/campaignGuardV713.mjs';
import { buildPilotDepsV713 } from '../lib/cuetPilotDepsV713.mjs';
import { runPilotV713R2 } from '../lib/cuetPilotRunV713R2.mjs';
import { expectedFreshState, stateSaver, isTerminal } from '../lib/cuetPilotV75Run.mjs';
import { validationContractV713 } from '../lib/contractV713.mjs';
import { V713_PROMPT_HASH } from '../lib/factoryEvidenceV713.mjs';
import { costProfileV713 } from '../lib/costProfileV713.mjs';
import { assertFullBodyPreflightV713, assertSealedPreflightV713 } from '../lib/preflightV713.mjs';
import { scopedAccounting } from '../lib/scopedAccounting.mjs';
const args = process.argv.slice(2), action = args[0] || 'report';
const base = resolve('artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v713');
const parent = resolve('artifacts/question-factory/cuet-pilot-v712-40-2026-10-09');
const originalDirectory = resolve(base, 'measurement-continuation-40');
const directory = resolve(base, 'measurement-continuation-40-r2');
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const put = (name, value) => writeFileSync(resolve(directory, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const regFile = resolve(directory, 'registration.json'), stateFile = resolve(directory, 'state.json');
if (!['prepare', 'report', 'execute', 'export', 'recover', 'seal'].includes(action)) throw Error('v713_action_invalid');


const executionDeltaPath = resolve('artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v713/EXECUTION-CORRECTION-R2.json');
function assertExecutionDelta() {
  const delta = read(executionDeltaPath);
  if (delta.schema !== 'cuet-v713-execution-correction-r2' || delta.academic_contract_changed !== false) throw Error('execution_delta_identity_invalid');
  for (const [file, hash] of Object.entries(delta.files)) if (sha(file) !== hash) throw Error('execution_delta_file_changed:' + file);
  return sha(executionDeltaPath);
}

if (action === 'prepare') {
  if (!args.includes('--local-verification-approved')) throw Error('independent_local_verification_required');
  if (existsSync(regFile)) throw Error('r2_registration_exists_never_overwrite');
  if (existsSync(resolve(originalDirectory, 'worker.lock'))) throw Error('original_worker_must_drain_first');
  const executionDeltaSha = assertExecutionDelta();
  const originalReg = read(resolve(originalDirectory, 'registration.json'));
  const originalState = read(resolve(originalDirectory, 'state.json'));
  const originalCampaign = read(resolve(originalDirectory, 'campaign.json'));
  const freeze = read(originalReg.execution_freeze_path);
  if (sha(originalReg.execution_freeze_path) !== originalReg.execution_freeze_sha256 || originalReg.contract_hash !== validationContractV713()) throw Error('original_academic_freeze_changed');
  for (const [file, hash] of Object.entries(freeze.files)) if (sha(file) !== hash) throw Error('execution_dependency_changed:' + file);
  if (originalState.circuit_open || originalState.weak_waves >= 2) throw Error('academic_wave_stop_cannot_be_reset');
  const db = new DatabaseSync('data/pipeline-budget.sqlite', { readOnly: true });
  let restored;
  try {
    if (db.prepare("SELECT count(*) n FROM provider_requests WHERE state='dispatching'").get().n ||
        db.prepare("SELECT count(*) n FROM provider_batches WHERE state='dispatching'").get().n) throw Error('dispatching_request_must_resolve_first');
    restored = restoreCapacityRefusalsV713R2(originalState, { ledger: { db }, campaignId: originalCampaign.id });
  } finally { db.close(); }
  originalState.execution_correction = { schema: 'v713-execution-r2-state-lineage', original_state_sha256: sha(resolve(originalDirectory, 'state.json')),
    original_registration_sha256: sha(resolve(originalDirectory, 'registration.json')), recovered_zero_cost_capacity_refusals: restored };
  originalState.stop_reason = null;
  mkdirSync(directory, { recursive: true });
  for (const name of ['campaign.json', 'registry.json']) writeFileSync(resolve(directory, name), readFileSync(resolve(originalDirectory, name)), { flag: 'wx' });
  put('original-state-checkpoint.json', read(resolve(originalDirectory, 'state.json')));
  put('state.json', originalState);
  const nextReg = { ...originalReg, version: 'v713-fixed-denominator-execution-correction-r2',
    created_at: new Date().toISOString(), original_directory: originalDirectory,
    original_registration_sha256: sha(resolve(originalDirectory, 'registration.json')),
    runner_sha256: sha(new URL(import.meta.url)), engine_sha256: sha('scripts/pipeline/lib/cuetPilotRunV713R2.mjs'),
    execution_delta_path: executionDeltaPath, execution_delta_sha256: executionDeltaSha };
  put('registration.json', nextReg);
  const originalPreflight = read(resolve(originalDirectory, 'full-body-preflight.json'));
  const derivedPreflight = { ...originalPreflight, runner_sha256: nextReg.runner_sha256, engine_sha256: nextReg.engine_sha256,
    execution_only_derivation: { original_path: resolve(originalDirectory, 'full-body-preflight.json'), original_sha256: sha(resolve(originalDirectory, 'full-body-preflight.json')),
      requests_unchanged: true, prompts_efforts_prices_caps_keys_unchanged: true } };
  assertFullBodyPreflightV713(derivedPreflight, nextReg, originalCampaign);
  put('full-body-preflight.json', derivedPreflight);
  console.log(JSON.stringify({ prepared: directory, denominator: 40, recovered_zero_cost_refusals: restored.length, paid_calls: 0 }));
  process.exit(0);
}

if (!existsSync(regFile)) { console.log(JSON.stringify({ prepared: false, paid_calls: 0 })); process.exit(0); }
const reg = read(regFile), campaign = read(resolve(directory, 'campaign.json')), state = read(stateFile);
if (action !== 'recover' && (assertExecutionDelta() !== reg.execution_delta_sha256 || reg.execution_delta_path !== executionDeltaPath)) throw Error('registered_execution_delta_changed');
if (action === 'seal') {
  const preflightFile = resolve(directory, 'full-body-preflight.json');
  assertFullBodyPreflightV713(read(preflightFile), reg, campaign);
  put('execution-preflight-seal.json', { schema: 'cuet-v713-execution-preflight-seal-v1', created_at: new Date().toISOString(),
    registration_sha256: sha(regFile), preflight_sha256: sha(preflightFile) });
  console.log(JSON.stringify({ sealed: true, paid_calls: 0 })); process.exit(0);
}
const ledgerPath = process.env.CUET_BUDGET_LEDGER || 'data/pipeline-budget.sqlite';
const accounting = () => { const db = new DatabaseSync(ledgerPath, { readOnly: true });
  try { return scopedAccounting({ db }, `${campaign.id}:`); } finally { db.close(); } };
const summary = () => { const a = accounting(); return { campaign: campaign.id, denominator: 40,
  states: Object.values(state.jobs).reduce((counts, j) => ({ ...counts, [j.state]: (counts[j.state] || 0) + 1 }), {}),
  continuation_settled_usd: a.settled_micro / 1e6, continuation_held_usd: a.held_micro / 1e6,
  total_parent_and_continuation_usd: reg.parent_committed_usd + a.committed_micro / 1e6,
  receipt_complete: a.receipt_complete, publication: 'never', fresh_qualification: false }; };
if (action === 'report') { console.log(JSON.stringify(summary(), null, 2)); process.exit(0); }
if (action === 'export') {
  const a = accounting(), registry = read(resolve(directory, 'registry.json'));
  const db = new DatabaseSync(ledgerPath, { readOnly: true });
  let parentCosts; try { parentCosts = scopedAccounting({ db }, 'cuet-pilot-v712-40-2026-10-09:'); } finally { db.close(); }
  const rows = campaign.jobs.map(j => {
    const item = state.jobs[j.id], c = item.candidate;
    const receipts = [...parentCosts.requests, ...a.requests].filter(r => r.candidate_id === j.id);
    return { id: j.id, subject: j.subject, ...item,
      decisive_excerpts: (c?.source_refs || j.source_refs || []).map(r => ({ ...r, text: registry.sources?.[r.id]?.facts?.[r.locator]?.text || null })),
      actual_cost_usd: receipts.reduce((sum, r) => sum + r.settled_micro, 0) / 1e6,
      held_cost_usd: receipts.reduce((sum, r) => sum + r.held_micro, 0) / 1e6, receipts };
  });
  const file = resolve(directory, `export-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify({ summary: summary(), candidates: rows, receipts: a.requests }, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ exported: file, paid_calls: 0, publication: 'never' })); process.exit(0);
}
if (action !== 'recover' && !args.includes('--approved')) throw Error('paid_execution_authorization_required');
const preflightFile = resolve(directory, 'full-body-preflight.json');
if (action !== 'recover') {
if (!existsSync(preflightFile)) throw Error('independent_all_stage_preflight_required');
const preflight = read(preflightFile);
assertFullBodyPreflightV713(preflight, reg, campaign);
assertSealedPreflightV713(directory, sha(regFile), preflightFile);
const freeze = read(reg.execution_freeze_path);
if (sha(reg.execution_freeze_path) !== reg.execution_freeze_sha256) throw Error('execution_freeze_changed');
for (const [p, digest] of Object.entries(freeze.files)) if (sha(p) !== digest) throw Error('execution_dependency_changed:' + p);
if (reg.contract_hash !== validationContractV713() || reg.prompt_hash !== V713_PROMPT_HASH ||
    reg.campaign_sha256 !== sha(resolve(directory, 'campaign.json')) || reg.registry_sha256 !== sha(resolve(directory, 'registry.json')) ||
    reg.runner_sha256 !== sha(new URL(import.meta.url))) throw Error('registered_v713_input_changed');
}
const prices = read('data/pipeline-prices.json');
if (action !== 'recover' && (JSON.stringify(costProfileV713(prices)) !== JSON.stringify(reg.cost_profile) || Date.parse(prices.expires_at) <= Date.now() + 600000)) throw Error('registered_pricing_changed_or_expiring');
try { loadEnvFile('.env.local'); } catch {}
if (process.env.MOCK_AI === 'true' || !process.env.CUET_EVIDENCE_SIGNING_KEY) throw Error('real_signed_evidence_required');
const lock = resolve(directory, 'worker.lock');
writeFileSync(lock, JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }), { flag: 'wx' });
const save = stateSaver(stateFile), keys = new Set(state.request_keys);
let ledger, store;
let stopping = false;
const stop = () => { stopping = true; }, requested = () => stopping || existsSync(resolve(directory, 'STOP_AFTER_REQUEST'));
process.on('SIGINT', stop); process.on('SIGTERM', stop);
const log = event => console.log(JSON.stringify({ at: new Date().toISOString(), ...event }));
try {
  ledger = new BudgetLedger(ledgerPath);
  store = new FactoryStore(ledger, ledgerPath, { candidateIds: campaign.jobs.map(j => j.id) });
  ledger.assertHistoryReconciled(); store.claim();
  const unarchivedNative = createFactoryTransportV713({ ledger, prices: () => prices, fetchImpl: longFetch,
    queueGemini: true,
    realtimeStages: ['authoring', 'blind_solution', 'explanation_support', 'repair'], flexStages: ['authoring', 'blind_solution', 'explanation_support', 'repair'] });
  const native = archiveRefusedAttemptsV713R2(unarchivedNative, { ledger, directory: resolve(directory, 'refused-attempts') });
  const guard = createCampaignGuardV713({ ledger, native, campaignId: campaign.id, candidateIds: campaign.jobs.map(j => j.id),
    capUsd: reg.cap_usd - reg.parent_committed_usd, prices: () => prices, keys,
    onKey: key => { state.request_keys.push(key); save(state); }, stopRequested: requested });
  const deps = buildPilotDepsV713({ registry: read(resolve(directory, 'registry.json')), ledger, transport: guard });
  const reconcileAccepted = async () => {
    let pending = 0;
    for (const key of keys) {
      const row = ledger.db.prepare('SELECT state,provider_id FROM provider_batches WHERE id=?').get(key);
      if (row && ['submitted', 'unresolved'].includes(row.state) && row.provider_id) {
        await native.reconcile(key);
        const current = ledger.db.prepare('SELECT state FROM provider_batches WHERE id=?').get(key);
        if (['submitted', 'unresolved'].includes(current?.state)) pending++;
      }
    }
    return pending;
  };
  if (action === 'recover') {
    await reconcileAccepted(); // Receipt-only: no authoring, validation, reservation or batch POST.
  } else {
  do {
    await reconcileAccepted();
    if (requested()) break;
    const result = await runPilotV713R2({ campaign, state, saveState: save, deps, ledger, log, stopRequested: requested, concurrency: 4 });
    log({ run_status: result.status, ...result });
    if (result.status !== 'pending') break;
    if (!requested()) await native.flush({ candidateIds: campaign.jobs.map(j => `${campaign.id}:${j.id}`), maxRequests: 10 });
    await new Promise(done => setTimeout(done, 20000));
  } while (!requested());
  // A stop prevents new work, but accepted requests still need receipts. Preserve uncertain holds.
  if (requested()) while (await reconcileAccepted()) {
    log({ run_status: 'receipt_only_draining' });
    await new Promise(done => setTimeout(done, 20000));
  }
  }
} finally {
  try { store?.release(); } finally {
    try { ledger?.close(); } finally {
      process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); unlinkSync(lock);
    }
  }
}
console.log(JSON.stringify(summary(), null, 2));
