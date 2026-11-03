// Generate additive execution-only derivatives; never alter a hash-bound V713 source or study.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const read = path => readFileSync(path, 'utf8');
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const put = (path, text) => writeFileSync(path, text, { flag: 'wx' });
const once = (text, before, after) => {
  if (text.split(before).length !== 2) throw Error('execution_derivative_anchor_not_unique:' + before.slice(0, 100));
  return text.replace(before, after);
};
const base = 'artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v713';
const delta = `${base}/EXECUTION-CORRECTION-R2.json`;
const helperImport = "import { capacityRefusedV713R2, archiveRefusedAttemptsV713R2, restoreCapacityRefusalsV713R2 } from '../lib/providerAvailabilityV713R2.mjs';\n";
const deltaCheck = `
const executionDeltaPath = resolve('${delta}');
function assertExecutionDelta() {
  const delta = read(executionDeltaPath);
  if (delta.schema !== 'cuet-v713-execution-correction-r2' || delta.academic_contract_changed !== false) throw Error('execution_delta_identity_invalid');
  for (const [file, hash] of Object.entries(delta.files)) if (sha(file) !== hash) throw Error('execution_delta_file_changed:' + file);
  return sha(executionDeltaPath);
}
`;
let engine = read('scripts/pipeline/lib/cuetPilotRunV713.mjs');
engine = "// Additive R2: capacity refusal pauses; every academic/repair/wave predicate remains inherited.\nimport { capacityRefusedV713R2 } from './providerAvailabilityV713R2.mjs';\n" + engine;
engine = once(engine, 'export async function runPilotV713(', 'export async function runPilotV713R2(');
engine = once(engine, 'if(/input_bound/.test(message))return true;', 'if(/input_bound/.test(message) || capacityRefusedV713R2(error))return true;');
put('scripts/pipeline/lib/cuetPilotRunV713R2.mjs', engine);

let pilot = read('scripts/pipeline/tools/runFinalGeneratorV713.mjs');
pilot = helperImport + pilot;
pilot = once(pilot, "import { runPilotV713 } from '../lib/cuetPilotRunV713.mjs';", "import { runPilotV713R2 } from '../lib/cuetPilotRunV713R2.mjs';");
pilot = once(pilot, "const directory = resolve(base, 'measurement-continuation-40');", "const originalDirectory = resolve(base, 'measurement-continuation-40');\nconst directory = resolve(base, 'measurement-continuation-40-r2');");
pilot = once(pilot, "if (action === 'prepare') {", deltaCheck + "\nif (action === 'prepare') {");
const start = pilot.indexOf("if (action === 'prepare') {"), end = pilot.indexOf("\nif (!existsSync(regFile))", start);
if (start < 0 || end < 0) throw Error('pilot_prepare_block_missing');
pilot = pilot.slice(0, start) + `if (action === 'prepare') {
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
` + pilot.slice(end);
pilot = once(pilot, "const reg = read(regFile), campaign = read(resolve(directory, 'campaign.json')), state = read(stateFile);", "const reg = read(regFile), campaign = read(resolve(directory, 'campaign.json')), state = read(stateFile);\nif (action !== 'recover' && (assertExecutionDelta() !== reg.execution_delta_sha256 || reg.execution_delta_path !== executionDeltaPath)) throw Error('registered_execution_delta_changed');");
pilot = once(pilot, 'const native = createFactoryTransportV713(', 'const unarchivedNative = createFactoryTransportV713(');
pilot = once(pilot, '  const guard = createCampaignGuardV713(', "  const native = archiveRefusedAttemptsV713R2(unarchivedNative, { ledger, directory: resolve(directory, 'refused-attempts') });\n  const guard = createCampaignGuardV713(");
pilot = once(pilot, 'await runPilotV713(', 'await runPilotV713R2(');
put('scripts/pipeline/tools/runFinalGeneratorV713R2.mjs', pilot);

let qualification = helperImport + read('scripts/pipeline/tools/runQualificationV713.mjs');
qualification = once(qualification, "if (action === 'prepare') {", deltaCheck + "\nif (action !== 'recover') assertExecutionDelta();\nif (action === 'prepare') {");
qualification = once(qualification, 'cap_usd: 1, publication:', 'execution_delta_path: executionDeltaPath, execution_delta_sha256: assertExecutionDelta(), cap_usd: 1, publication:');
qualification = once(qualification, "if (!recovering) {\n  if (!args.includes('--approved'))", "if (!recovering) {\n  if (reg.execution_delta_path !== executionDeltaPath || reg.execution_delta_sha256 !== assertExecutionDelta()) throw Error('registered_execution_delta_changed');\n  if (!args.includes('--approved'))");
qualification = once(qualification, 'const native = createFactoryTransportV713(', 'const unarchivedNative = createFactoryTransportV713(');
qualification = once(qualification, '  const guard = createCampaignGuardV713(', "  const native = archiveRefusedAttemptsV713R2(unarchivedNative, { ledger, directory: path('refused-attempts') });\n  const guard = createCampaignGuardV713(");
qualification = once(qualification, 'else if (/budget|input_bound|study_draining_stop|factory_worker|pricing/.test(error.message)) {', 'else if (capacityRefusedV713R2(error) || /budget|input_bound|study_draining_stop|factory_worker|pricing/.test(error.message)) {');
qualification = once(qualification, "state.cases[f.id] = { state: 'paused', reasons: [error.message] }; paused = true;", "state.cases[f.id] = { ...state.cases[f.id], state: 'paused', reasons: [error.message] }; paused = true;");
qualification = once(qualification, '{ concurrency: 4, shouldStop: requested }', '{ concurrency: 4, shouldStop: () => requested() || paused }');
put('scripts/pipeline/tools/runQualificationV713R2.mjs', qualification);

let capture = read('scripts/pipeline/tools/captureQualificationV713PreflightR2.mjs');
capture = once(capture, "resolve('scripts/pipeline/tools/runQualificationV713.mjs')", "resolve('scripts/pipeline/tools/runQualificationV713R2.mjs')");
put('scripts/pipeline/tools/captureQualificationV713PreflightR3.mjs', capture);
const files = ['scripts/pipeline/lib/providerAvailabilityV713R2.mjs', 'scripts/pipeline/lib/cuetPilotRunV713R2.mjs',
  'scripts/pipeline/tools/runFinalGeneratorV713R2.mjs', 'scripts/pipeline/tools/runQualificationV713R2.mjs',
  'scripts/pipeline/tools/captureQualificationV713PreflightR3.mjs', 'scripts/pipeline/tools/prepareExecutionCorrectionV713R2.mjs'];
put(delta, JSON.stringify({ schema: 'cuet-v713-execution-correction-r2', created_at: new Date().toISOString(),
  academic_contract_changed: false, academic_freeze_path: resolve(base, 'CONTRACT-FREEZE.json'),
  academic_freeze_sha256: sha(resolve(base, 'CONTRACT-FREEZE.json')),
  basis: 'Observed provider-capacity refusals were incorrectly terminal quarantines. Pause without changing any question, academic gate, prompt, effort, price, cap or provider request identity. Archive full zero-cost refusal attempt before native logical-key retry. Unknown and accepted requests are never reposted.',
  prior_studies_and_outcomes_preserved: true, publication: 'never', files: Object.fromEntries(files.map(file => [file, sha(file)])) }, null, 2) + '\n');
console.log(JSON.stringify({ execution_delta: delta, files: files.length, paid_calls: 0, academic_contract_changed: false }));
