// One fixed fresh study, no repairs or replacements, no publication. Accepted IDs recover receipt-only.
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import { DatabaseSync } from 'node:sqlite';
import { BudgetLedger } from '../lib/budgetLedger.mjs';
import { FactoryStore } from '../lib/factoryStore.mjs';
import { createFactoryTransportV713 } from '../lib/factoryTransportV713.mjs';
import { createCampaignGuardV713 } from '../lib/campaignGuardV713.mjs';
import { verifyCandidateV713 } from '../lib/verifyV713.mjs';
import { validationContractV713 } from '../lib/contractV713.mjs';
import { V713_PROMPT_HASH, createFactoryEvidenceV713, blindViewV713 } from '../lib/factoryEvidenceV713.mjs';
import { costProfileV713 } from '../lib/costProfileV713.mjs';
import { assertFullBodyPreflightV713, assertSealedPreflightV713 } from '../lib/preflightV713.mjs';
import { longFetch } from '../lib/longFetch.mjs';
import { scopedAccounting } from '../lib/scopedAccounting.mjs';
import { saveAtomicArtifact, drainConcurrent } from '../lib/atomicArtifact.mjs';
const [action = 'report', directoryArg] = process.argv.slice(2), args = process.argv.slice(2);
if (!directoryArg || !['prepare', 'report', 'execute', 'recover', 'seal'].includes(action)) throw Error('action_and_study_directory_required');
const directory = resolve(directoryArg), read = p => JSON.parse(readFileSync(p, 'utf8'));
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const path = n => resolve(directory, n), frozen = read(path('frozen.json'));
if (frozen.denominator !== 36 || frozen.publication !== 'never') throw Error('fixed_fresh36_required');
const campaign = { id: 'cuet-v713-fresh-final-qualification', jobs: frozen.fixtures.map(f => ({ id: f.id, subject: f.subject })) };
const regPath = path('registration.json'), statePath = path('state.json'), ledgerPath = 'data/pipeline-budget.sqlite';
if (action === 'prepare') {
  if (existsSync(regPath) || existsSync(statePath)) throw Error('qualification_registration_exists');
  const prices = read('data/pipeline-prices.json'), freeze = read(frozen.execution_freeze_path);
  if (sha(frozen.execution_freeze_path) !== frozen.execution_freeze_sha256 || frozen.verifier_contract !== validationContractV713()) throw Error('fresh_freeze_changed');
  for (const [p, hash] of Object.entries(freeze.files)) if (sha(p) !== hash) throw Error('execution_dependency_changed:' + p);
  const reg = { id: campaign.id, denominator: 36, created_at: new Date().toISOString(), decision_rule: frozen.decision_rule,
    cap_usd: 1, publication: 'never', repairs: 0, replacements: 0, qualification: true,
    frozen_sha256: sha(path('frozen.json')), registry_sha256: sha(path('registry.json')),
    campaign_sha256: createHash('sha256').update(JSON.stringify(campaign)).digest('hex'),
    contract_hash: validationContractV713(), prompt_hash: V713_PROMPT_HASH, cost_profile: costProfileV713(prices),
    runner_sha256: sha(new URL(import.meta.url)), engine_sha256: sha('scripts/pipeline/lib/verifyV713.mjs') };
  writeFileSync(regPath, JSON.stringify(reg, null, 2) + '\n', { flag: 'wx' });
  writeFileSync(statePath, JSON.stringify({ request_keys: [], cases: {}, runs: [], created_at: new Date().toISOString() }, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ prepared: directory, denominator: 36, cap_usd: 1, paid_calls: 0 })); process.exit(0);
}
if (!existsSync(regPath)) { console.log(JSON.stringify({ prepared: false, paid_calls: 0 })); process.exit(0); }
const reg = read(regPath), state = read(statePath), registry = read(path('registry.json'));
if (action === 'seal') {
  assertFullBodyPreflightV713(read(path('full-body-preflight.json')), reg, campaign);
  writeFileSync(path('execution-preflight-seal.json'), JSON.stringify({ schema: 'cuet-v713-execution-preflight-seal-v1',
    registration_sha256: sha(regPath), preflight_sha256: sha(path('full-body-preflight.json')), created_at: new Date().toISOString() }, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ sealed: true, paid_calls: 0 })); process.exit(0);
}
const cost = () => { const db = new DatabaseSync(ledgerPath, { readOnly: true });
  try { return scopedAccounting({ db }, campaign.id + ':'); } finally { db.close(); } };
function summary() {
  const a = cost(), valid = frozen.fixtures.filter(f => f.expected_valid), defects = frozen.fixtures.filter(f => !f.expected_valid);
  const terminal = f => ['eligible', 'quarantined'].includes(state.cases[f.id]?.state);
  const eligible = f => state.cases[f.id]?.state === 'eligible';
  const bySubject = Object.fromEntries(['accountancy', 'business_studies', 'economics', 'english'].map(subject => {
    const rows = valid.filter(f => f.subject === subject); return [subject, { ok: rows.filter(eligible).length, n: rows.length }]; }));
  const falseAccepts = defects.filter(eligible).map(f => f.id), validOk = valid.filter(eligible).length;
  const complete = frozen.fixtures.every(terminal) && a.receipt_complete;
  return { id: campaign.id, denominator: 36, terminal: frozen.fixtures.filter(terminal).length, valid_eligible: validOk,
    valid_total: valid.length, valid_by_subject: bySubject, controlled_false_accepts: falseAccepts,
    unfinished: frozen.fixtures.filter(f => !terminal(f)).map(f => f.id),
    decision: complete ? (!falseAccepts.length && validOk / valid.length >= .85 && Object.values(bySubject).every(s => s.ok / s.n >= .70) ? 'passed' : 'failed') : 'incomplete',
    settled_usd: a.settled_micro / 1e6, held_usd: a.held_micro / 1e6, receipt_complete: a.receipt_complete,
    publication: 'never', release_record: false };
}
if (action === 'report') { console.log(JSON.stringify(summary(), null, 2)); process.exit(0); }
const recovering = action === 'recover';
if (!recovering) {
  if (!args.includes('--approved')) throw Error('explicit_paid_execution_required');
  assertFullBodyPreflightV713(read(path('full-body-preflight.json')), reg, campaign);
  assertSealedPreflightV713(directory, sha(regPath), path('full-body-preflight.json'));
  if (reg.contract_hash !== validationContractV713() || reg.prompt_hash !== V713_PROMPT_HASH ||
      reg.frozen_sha256 !== sha(path('frozen.json')) || reg.registry_sha256 !== sha(path('registry.json')) ||
      reg.runner_sha256 !== sha(new URL(import.meta.url))) throw Error('registered_qualification_changed');
  const freeze = read(frozen.execution_freeze_path);
  if (sha(frozen.execution_freeze_path) !== frozen.execution_freeze_sha256) throw Error('execution_freeze_changed');
  for (const [p, hash] of Object.entries(freeze.files)) if (sha(p) !== hash) throw Error('execution_dependency_changed:' + p);
}
const prices = read('data/pipeline-prices.json');
if (!recovering && (JSON.stringify(costProfileV713(prices)) !== JSON.stringify(reg.cost_profile) || Date.parse(prices.expires_at) <= Date.now() + 600000)) throw Error('registered_pricing_changed_or_expiring');
try { loadEnvFile('.env.local'); } catch {}
if (process.env.MOCK_AI === 'true' || !process.env.CUET_EVIDENCE_SIGNING_KEY) throw Error('real_signed_evidence_required');
let ledger, store, stopping = false;
const lock = path('worker.lock'), keys = new Set(state.request_keys);
writeFileSync(lock, JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }), { flag: 'wx' });
const stop = () => { stopping = true; }, requested = () => stopping || existsSync(path('STOP_AFTER_REQUEST'));
process.on('SIGINT', stop); process.on('SIGTERM', stop);
const save = () => { state.updated_at = new Date().toISOString(); saveAtomicArtifact(statePath, state); };
const log = v => console.log(JSON.stringify({ at: new Date().toISOString(), ...v }));
try {
  ledger = new BudgetLedger(ledgerPath); store = new FactoryStore(ledger, ledgerPath, { candidateIds: campaign.jobs.map(j => j.id) });
  ledger.assertHistoryReconciled(); store.claim();
  const native = createFactoryTransportV713({ ledger, prices: () => prices, fetchImpl: longFetch, queueGemini: true,
    realtimeStages: ['blind_solution', 'explanation_support'], flexStages: ['blind_solution', 'explanation_support'] });
  const guard = createCampaignGuardV713({ ledger, native, campaignId: campaign.id, candidateIds: campaign.jobs.map(j => j.id),
    capUsd: reg.cap_usd, prices: () => prices, keys, stopRequested: requested,
    onKey: key => { state.request_keys.push(key); save(); } });
  const recover = async () => {
    let pending = 0;
    for (const key of keys) {
      const row = ledger.db.prepare('SELECT state,provider_id FROM provider_batches WHERE id=?').get(key);
      if (row?.provider_id && ['submitted', 'unresolved'].includes(row.state)) {
        await native.reconcile(key);
        const next = ledger.db.prepare('SELECT state FROM provider_batches WHERE id=?').get(key);
        if (['submitted', 'unresolved'].includes(next?.state)) pending++;
      }
    }
    return pending;
  };
  if (recovering) await recover();
  else {
    const run = { started_at: new Date().toISOString(), pid: process.pid }; state.runs.push(run); save();
    try {
      while (!requested()) {
        await recover();
        const todo = frozen.fixtures.filter(f => !['eligible', 'quarantined', 'error', 'held'].includes(state.cases[f.id]?.state)).slice(0, 10);
        if (!todo.length) break;
        let pending = false, paused = false;
        await drainConcurrent(todo, async f => {
          if (requested()) return;
          state.cases[f.id] = { ...state.cases[f.id], state: 'validating' }; save();
          try {
            const adapters = createFactoryEvidenceV713({ registry, ledger, transport: guard });
            const view = blindViewV713(f.candidate, f.candidate.source_refs);
            const judgments = state.cases[f.id].independent_judgments || {};
            // Qualification measures BOTH providers on every case, including early academic rejects.
            // Each request still receives its own key-free view and never the other provider's answer.
            for (const provider of ['openai', 'gemini']) {
              judgments[provider] = await adapters.__evaluation(view, provider);
              state.cases[f.id].independent_judgments = judgments; save();
            }
            const result = await verifyCandidateV713(f.candidate, { registry, ledger, adapters, seen: new Set() });
            state.cases[f.id] = { ...result, independent_judgments: judgments }; log({ id: f.id, state: result.state, reasons: result.reasons || [] });
          } catch (error) {
            if (error.message === 'provider_batch_pending') { state.cases[f.id] = { ...state.cases[f.id], state: 'pending', batch_id: error.batchId }; pending = true; }
            else if (/budget|input_bound|study_draining_stop|factory_worker|pricing/.test(error.message)) {
              state.cases[f.id] = { state: 'paused', reasons: [error.message] }; paused = true;
            } else state.cases[f.id] = { state: /uncertain|unresolved/.test(error.message) ? 'held' : 'error', reasons: [error.message] };
          } finally { save(); }
        }, { concurrency: 4, shouldStop: requested });
        if (!requested()) await native.flush({ candidateIds: campaign.jobs.map(j => `${campaign.id}:${j.id}`), maxRequests: 10 });
        if (paused) break;
        if (pending) await new Promise(done => setTimeout(done, 20000));
      }
      while (await recover()) { log({ state: 'receipt_only_draining' }); await new Promise(done => setTimeout(done, 20000)); }
    } finally { run.finished_at = new Date().toISOString(); save(); }
  }
} finally {
  try { store?.release(); } finally { try { ledger?.close(); } finally {
    process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); unlinkSync(lock);
  } }
}
const result = summary(); saveAtomicArtifact(path('summary.json'), result); console.log(JSON.stringify(result, null, 2));
