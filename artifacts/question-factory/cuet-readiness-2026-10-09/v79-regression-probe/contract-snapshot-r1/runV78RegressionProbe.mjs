// V7.8 native REGRESSION probe over the already-spent V7.7 study cases (9 October 2026).
// These cases were exposed before V7.8 was written, so every result here is regression/diagnostic
// evidence only: it can never qualify or release V7.8, and nothing here publishes.
// It measures (a) whether the frozen V7.8 seam binds valid items natively, (b) whether controlled
// defects are caught, and (c) real per-stage token cost. Raw provider responses are saved apart
// from the deterministic wrapper verdicts so a schema failure cannot pass as an academic rejection.
//
//   node scripts/pipeline/tools/runV78RegressionProbe.mjs plan
//   node scripts/pipeline/tools/runV78RegressionProbe.mjs execute --cap 2.0 [--only id,id] [--concurrency 3]
//   node scripts/pipeline/tools/runV78RegressionProbe.mjs report
// Stop after in-flight requests: create data/question-factory-runtime/STOP_V78_REGRESSION.
// Same tool, additive V7.9 run: add --version v79 (prefix v79-regression-2026-10-09-, output v79-regression-probe/).
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { join } from 'node:path';
import { BudgetLedger } from '../lib/budgetLedger.mjs';
import { createFactoryTransport } from '../lib/factoryTransport.mjs';
import { validateFactoryCandidateV78 } from '../lib/verifyV78.mjs';
import { validateFactoryCandidateV79 } from '../lib/verifyV79.mjs';
import { validationContractV79, FACTORY_VERIFIER_VERSION_V79 } from '../lib/contractV79.mjs';
import { TOPOLOGIES } from '../lib/factoryEvidenceV78.mjs';
import { validationContractV78, FACTORY_VERIFIER_VERSION_V78 } from '../lib/contractV78.mjs';
import { scopedAccounting, bodyCandidateId } from '../lib/scopedAccounting.mjs';
import { assertCampaignBudget, maximumRequestMicro } from '../lib/campaignExecutionV7.mjs';
import { saveAtomicArtifact, drainConcurrent } from '../lib/atomicArtifact.mjs';
import { effortsFor } from '../../../data/cuet_fit_evidence.mjs';

const ROOT = 'artifacts/question-factory/cuet-readiness-2026-10-09';
// --version v79 runs the additive compact-resolution verifier under its own prefix/output; default is the frozen V7.8.
const VERSION = process.argv.includes('--version') ? process.argv[process.argv.indexOf('--version') + 1] : 'v78';
if (!['v78', 'v79'].includes(VERSION)) throw new Error('version_v78_or_v79');
const OUT = join(ROOT, VERSION === 'v78' ? 'v78-regression-probe' : 'v79-regression-probe');
const PREFIX = VERSION === 'v78' ? 'v78-regression-2026-10-09-' : 'v79-regression-2026-10-09-';
const validate = VERSION === 'v78' ? validateFactoryCandidateV78 : validateFactoryCandidateV79;
const STOP = 'data/question-factory-runtime/STOP_V78_REGRESSION';
const EXPECTED_CONTRACT = 'e4be26f3e6dcb651edcf736049f872a736abaed1ed4db5b6299d6aaccb613d58';
const STUDIES = ['v77-qualification-2026-10-09-final-fresh-integrated', 'v77-qualification-2026-10-09-final-regression-integrated'];
const json = p => JSON.parse(readFileSync(p, 'utf8'));
const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };
const action = process.argv[2] || 'report';

if (validationContractV78() !== EXPECTED_CONTRACT) throw new Error('v78_frozen_contract_changed');
mkdirSync(join(OUT, 'raw'), { recursive: true });

const cases = [];
for (const study of STUDIES) {
  const dir = join(ROOT, 'v77-qualification', study), frozen = json(join(dir, 'frozen.json'));
  const registry = json(join(dir, 'run', 'execution-plan.json')).source_registry;
  for (const f of frozen.fixtures) cases.push({ study, id: f.id, subject: f.candidate.subject, expected_valid: f.expected_valid,
    category: f.category, oracle_key: f.oracle?.key ?? null, candidate: { ...structuredClone(f.candidate), id: PREFIX + f.id }, registry });
}
const only = arg('--only')?.split(',');
const selected = only ? cases.filter(c => only.includes(c.id)) : cases;
const resultsPath = join(OUT, 'results.json');
const results = existsSync(resultsPath) ? json(resultsPath) : { kind: `${VERSION}_native_regression_probe_not_qualification`, verifier: VERSION === 'v78' ? FACTORY_VERIFIER_VERSION_V78 : FACTORY_VERIFIER_VERSION_V79,
  contract: VERSION === 'v78' ? EXPECTED_CONTRACT : validationContractV79(), prefix: PREFIX, created_at: new Date().toISOString(), cases: {} };

if (action === 'plan') {
  console.log(JSON.stringify({ cases: selected.length, valid: selected.filter(c => c.expected_valid).length, defects: selected.filter(c => !c.expected_valid).length,
    done: Object.keys(results.cases).length }, null, 1));
  process.exit(0);
}

if (action === 'execute') {
  const cap = Number(arg('--cap'));
  if (!(cap > 0 && cap <= 3)) throw new Error('explicit_cap_usd_up_to_3_required');
  if (existsSync(STOP)) throw new Error('stop_file_present');
  loadEnvFile('.env.local');
  const ledger = new BudgetLedger('data/pipeline-budget.sqlite'); ledger.assertHistoryReconciled();
  const prices = json('data/pipeline-prices.json');
  if (!(Date.parse(prices.expires_at) > Date.now() + 3600e3)) throw new Error('price_snapshot_expired_or_expiring');
  for (const model of ['gpt-6-luna', 'gemini-3.8-flash']) prices.models[model].max_input_tokens = 60_000;
  const native = createFactoryTransport({ ledger, prices: () => prices,
    realtimeStages: ['blind_solution', 'independent_evaluation', 'explanation_support'], flexStages: ['blind_solution', 'independent_evaluation', 'explanation_support'] });
  let stopping = false; process.on('SIGINT', () => { stopping = true; });
  let seq = 0;
  const transport = { ...native, async generate(provider, body, options = {}) {
    const cid = bodyCandidateId(provider, body);
    if (!cid?.startsWith(PREFIX)) throw new Error('out_of_scope_candidate');
    const scoped = scopedAccounting(ledger, PREFIX).committed_micro;
    assertCampaignBudget(scoped, maximumRequestMicro(provider, body, prices), cap);
    const n = ++seq, started = Date.now();
    try {
      const response = await native.generate(provider, body, options);
      writeFileSync(join(OUT, 'raw', `${cid.slice(PREFIX.length)}--${options.stage}--${provider}.json`),
        JSON.stringify({ stage: options.stage, provider, ms: Date.now() - started, request_bytes: Buffer.byteLength(JSON.stringify(body)), response }, null, 1));
      return response;
    } catch (error) {
      writeFileSync(join(OUT, 'raw', `${cid.slice(PREFIX.length)}--${options.stage}--${provider}--error-${n}.json`), JSON.stringify({ stage: options.stage, provider, error: error.message }, null, 1));
      throw error;
    }
  } };
  const todo = selected.filter(c => !results.cases[c.id] || results.cases[c.id].state === 'error');
  await drainConcurrent(todo, async c => {
    let verdict;
    try {
      verdict = await validate(c.candidate, { registry: c.registry, ledger, transport, topology: TOPOLOGIES.dual_blind,
        calibrationPurpose: true, efforts: effortsFor(c.candidate), seen: new Set() });
    } catch (error) { verdict = { state: 'error', reasons: [error.message] }; }
    const checks = verdict.question?.evidence?.record?.checks || verdict.checks || {};
    const stages = Object.fromEntries(Object.entries(checks).map(([k, v]) => [k, { passed: v.passed, provider: v.provider, solved_key: v.solved_key ?? null,
      reasons: v.reasons || [], option_resolution: v.option_resolution ? { passed: v.option_resolution.passed, reasons: v.option_resolution.reasons || [] } : null,
      option_resolution_audit: v.option_resolution_audit ? { passed: v.option_resolution_audit.passed, reasons: v.option_resolution_audit.reasons || [] } : null }]));
    const cost = scopedAccounting(ledger, PREFIX, c.id);
    results.cases[c.id] = { study: c.study, subject: c.subject, expected_valid: c.expected_valid, category: c.category, oracle_key: c.oracle_key,
      state: verdict.state, reasons: verdict.reasons || [], failed_stage: verdict.failed_stage || null, failure_details: verdict.failure_details || [],
      cuet_fit: verdict.question?.evidence?.record?.cuet_fit || null, stages,
      cost_usd: { settled: cost.settled_micro / 1e6, held: cost.held_micro / 1e6, requests: cost.requests.length }, at: new Date().toISOString() };
    saveAtomicArtifact(resultsPath, results);
    console.log(c.id, c.expected_valid ? 'VALID ' : 'DEFECT', '->', verdict.state, (verdict.reasons || []).join(';').slice(0, 160));
  }, { concurrency: Number(arg('--concurrency') || 3), shouldStop: () => stopping || existsSync(STOP) });
  const total = scopedAccounting(ledger, PREFIX);
  results.accounting = { settled_usd: total.settled_micro / 1e6, held_usd: total.held_micro / 1e6, requests: total.requests.length, receipt_complete: total.receipt_complete, at: new Date().toISOString() };
  saveAtomicArtifact(resultsPath, results);
}

const rows = Object.entries(results.cases);
const valid = rows.filter(([, r]) => r.expected_valid), defects = rows.filter(([, r]) => !r.expected_valid);
const summary = { kind: results.kind, terminal: rows.filter(([, r]) => r.state !== 'error').length, of: cases.length,
  valid_eligible: `${valid.filter(([, r]) => r.state === 'eligible').length}/${valid.length}`,
  defects_accepted: `${defects.filter(([, r]) => r.state === 'eligible').length}/${defects.length}`,
  errors: rows.filter(([, r]) => r.state === 'error').map(([id, r]) => `${id}:${r.reasons.join(';').slice(0, 120)}`),
  valid_failures: valid.filter(([, r]) => r.state !== 'eligible').map(([id, r]) => `${id}:${r.reasons.join(';').slice(0, 200)}`),
  accepted_defects: defects.filter(([, r]) => r.state === 'eligible').map(([id, r]) => `${id}:${r.category}`), accounting: results.accounting || null };
console.log(JSON.stringify(summary, null, 1));
