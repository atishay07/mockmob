// Additive V7.11-capable copy of runV78RegressionProbe.mjs (that file is hash-recorded in the frozen V7.9 freeze and stays unchanged).
// Use --version v711 [--study <dir> | --prefix-tag rN]. Same guard path: persistent ledger, scoped cap, longFetch, raw-response capture.
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
import { longFetch } from '../lib/longFetch.mjs';
import { validateFactoryCandidateV78 } from '../lib/verifyV78.mjs';
import { validateFactoryCandidateV79 } from '../lib/verifyV79.mjs';
import { validationContractV79, FACTORY_VERIFIER_VERSION_V79 } from '../lib/contractV79.mjs';
import { validateFactoryCandidateV711 } from '../lib/verifyV711.mjs';
import { validationContractV711, FACTORY_VERIFIER_VERSION_V711 } from '../lib/contractV711.mjs';
import { TOPOLOGIES } from '../lib/factoryEvidenceV78.mjs';
import { validationContractV78, FACTORY_VERIFIER_VERSION_V78 } from '../lib/contractV78.mjs';
import { scopedAccounting, bodyCandidateId } from '../lib/scopedAccounting.mjs';
import { assertCampaignBudget, maximumRequestMicro } from '../lib/campaignExecutionV7.mjs';
import { saveAtomicArtifact, drainConcurrent } from '../lib/atomicArtifact.mjs';
import { effortsFor } from '../../../data/cuet_fit_evidence.mjs';

const ROOT = 'artifacts/question-factory/cuet-readiness-2026-10-09';
// --version v79 runs the additive compact-resolution verifier under its own prefix/output; default is the frozen V7.8.
const VERSION = process.argv.includes('--version') ? process.argv[process.argv.indexOf('--version') + 1] : 'v78';
if (!['v78', 'v79', 'v711'].includes(VERSION)) throw new Error('version_v78_v79_or_v711');
const CURRENT = VERSION === 'v711' ? { contract: validationContractV711, verifier: FACTORY_VERIFIER_VERSION_V711, validate: validateFactoryCandidateV711 } : { contract: validationContractV79, verifier: FACTORY_VERIFIER_VERSION_V79, validate: validateFactoryCandidateV79 };

// --prefix-tag r2 keeps a revised draft's regression run in its own accounting scope and output directory.
const TAG = process.argv.includes('--prefix-tag') ? process.argv[process.argv.indexOf('--prefix-tag') + 1] : '';
if (TAG && !/^r\d+[a-z]?$/.test(TAG)) throw new Error('prefix_tag_rN');
// --study <dir> runs a frozen V7.9 qualification study (frozen.json + scratch-registry-overlay.json) under its own scope; it refuses
// to run unless the current V7.9 contract equals the contract recorded at freeze.
const STUDY = process.argv.includes('--study') ? process.argv[process.argv.indexOf('--study') + 1] : null;
if (STUDY && VERSION === 'v78') throw new Error('study_requires_v79_or_v711');
const PREFIX = STUDY ? `${VERSION}-${STUDY.split(/[\/]/).filter(Boolean).pop()}-run-` : VERSION === 'v78' ? 'v78-regression-2026-10-09-' : `${VERSION}${TAG ? '-' + TAG : ''}-regression-2026-10-09-`;
const OUT = STUDY ? join(STUDY, 'run') : join(ROOT, VERSION === 'v78' ? 'v78-regression-probe' : `${VERSION}${TAG ? '-' + TAG : ''}-regression-probe`);
const validate = VERSION === 'v78' ? validateFactoryCandidateV78 : CURRENT.validate;
const STOP = 'data/question-factory-runtime/STOP_V78_REGRESSION';
const EXPECTED_CONTRACT = 'e4be26f3e6dcb651edcf736049f872a736abaed1ed4db5b6299d6aaccb613d58';
const STUDIES = ['v77-qualification-2026-10-09-final-fresh-integrated', 'v77-qualification-2026-10-09-final-regression-integrated'];
const json = p => JSON.parse(readFileSync(p, 'utf8'));
const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };
const action = process.argv[2] || 'report';

if (validationContractV78() !== EXPECTED_CONTRACT) throw new Error('v78_frozen_contract_changed');
mkdirSync(join(OUT, 'raw'), { recursive: true });

const cases = [];
if (STUDY) {
  const frozen = json(join(STUDY, 'frozen.json')), overlay = json(join(STUDY, 'scratch-registry-overlay.json')), base = json('data/source_registry.json');
  if (!frozen.verifier_contract || frozen.verifier_contract !== CURRENT.contract()) throw new Error('contract_changed_since_study_freeze');
  const registry = { ...base, families: { ...base.families, ...overlay.families } };
  for (const f of frozen.fixtures) cases.push({ study: frozen.id, id: f.id, subject: f.subject, expected_valid: f.expected_valid, category: f.category,
    oracle_key: f.expected_valid ? f.candidate.correct_answer : null, candidate: { ...structuredClone(f.candidate), id: PREFIX + f.id }, registry });
}
for (const study of STUDY ? [] : STUDIES) {
  const dir = join(ROOT, 'v77-qualification', study), frozen = json(join(dir, 'frozen.json'));
  const registry = json(join(dir, 'run', 'execution-plan.json')).source_registry;
  for (const f of frozen.fixtures) cases.push({ study, id: f.id, subject: f.candidate.subject, expected_valid: f.expected_valid,
    category: f.category, oracle_key: f.oracle?.key ?? null, candidate: { ...structuredClone(f.candidate), id: PREFIX + f.id }, registry });
}
const only = arg('--only')?.split(',');
const selected = only ? cases.filter(c => only.includes(c.id)) : cases;
const resultsPath = join(OUT, 'results.json');
const results = existsSync(resultsPath) ? json(resultsPath) : { kind: STUDY ? `${VERSION}_fresh_qualification_study` : `${VERSION}_native_regression_probe_not_qualification`, verifier: VERSION === 'v78' ? FACTORY_VERIFIER_VERSION_V78 : CURRENT.verifier,
  contract: VERSION === 'v78' ? EXPECTED_CONTRACT : CURRENT.contract(), prefix: PREFIX, created_at: new Date().toISOString(), cases: {} };

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
  const native = createFactoryTransport({ ledger, prices: () => prices, fetchImpl: longFetch,
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
if (STUDY) {
  // Preregistered decision rule (frozen.json decision_rule). Unfinished/error cases are never counted as eligible or rejected.
  const subjects = [...new Set(cases.map(c => c.subject))];
  const validCases = cases.filter(c => c.expected_valid), defectCases = cases.filter(c => !c.expected_valid);
  const state = id => results.cases[id]?.state || 'unfinished';
  const pooled = validCases.filter(c => state(c.id) === 'eligible').length / validCases.length;
  const perSubject = Object.fromEntries(subjects.map(s => { const v = validCases.filter(c => c.subject === s); return [s, v.filter(c => state(c.id) === 'eligible').length / v.length]; }));
  const acceptedDefects = defectCases.filter(c => state(c.id) === 'eligible').map(c => c.id);
  const unfinishedDefects = defectCases.filter(c => !['eligible', 'quarantined'].includes(state(c.id))).map(c => c.id);
  const pass = acceptedDefects.length === 0 && unfinishedDefects.length === 0 && pooled >= 0.85 && Object.values(perSubject).every(x => x >= 0.7);
  const decision = { pass, pooled_valid_survival: pooled, per_subject_valid_survival: perSubject, accepted_defects: acceptedDefects, unfinished_defects: unfinishedDefects,
    unfinished_valid: validCases.filter(c => !['eligible', 'quarantined'].includes(state(c.id))).map(c => c.id), assessed_at: new Date().toISOString() };
  saveAtomicArtifact(join(OUT, 'decision.json'), decision);
  console.log(JSON.stringify({ decision }, null, 1));
}
