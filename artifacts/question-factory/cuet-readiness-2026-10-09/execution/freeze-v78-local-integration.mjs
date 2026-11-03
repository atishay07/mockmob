import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validationContractV78, FACTORY_VERIFIER_VERSION_V78, V78_ADDITIVE_FILES, PARENT_CONTRACT_V77_HASH } from '../../../../scripts/pipeline/lib/contractV78.mjs';
import { V78_PROMPT_HASH } from '../../../../scripts/pipeline/lib/factoryEvidenceV78.mjs';
import { factoryCalibrationReady } from '../../../../data/question_factory_policy.mjs';
import { cuetFitReleased } from '../../../../data/cuet_fit_evidence.mjs';
import { currentCuetCalibrationReadyVNext } from '../../../../scripts/pipeline/lib/currentCuetCalibrationGateVNext.mjs';
import { CUET_FIT_VERSION } from '../../../../data/cuet_fit_rubric.mjs';
const base = 'artifacts/question-factory/cuet-readiness-2026-10-09', execution = `${base}/execution`;
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const outPath = `${base}/v78-local-contract-freeze.json`;
if (existsSync(outPath)) throw Error('v78_freeze_already_exists_do_not_overwrite');
const checks = [];
for (const [freezePath, field] of [[`${base}/v77-local-contract-freeze.json`, 'file_sha256'], [`${base}/v77-local-transport-freeze.json`, 'files']]) {
  for (const [path, expected] of Object.entries(read(freezePath)[field] || {})) checks.push({ path, expected, actual: sha(path) });
}
const core = read(`${base}/v77-local-contract-freeze.json`);
if (core.validation_contract_hash !== PARENT_CONTRACT_V77_HASH || checks.some(c => c.actual !== c.expected)) throw Error('historical_v77_freeze_changed');
const exportPath = `${execution}/v77-final-export-2026-10-09/all-cases.json`;
if (sha(exportPath) !== 'bef35e60b203d58c72048921709b07da7fbddb96210184a65142a165167257f6') throw Error('inspected_native_export_changed');
const historical = read(`${execution}/v78-local-historical-preservation.json`);
if (historical.mismatches.length || historical.checks !== 228) throw Error('historical_preservation_check_failed');
function testLog(path) {
  const log = readFileSync(path, 'utf8');
  const pass = Number(log.match(/ℹ pass (\d+)/u)?.[1]), fail = Number(log.match(/ℹ fail (\d+)/u)?.[1]), count = Number(log.match(/ℹ tests (\d+)/u)?.[1]);
  if (!count || count !== pass || fail !== 0) throw Error(`local_test_log_not_passed:${path}`);
  return { pass, fail, count, path, sha256: sha(path) };
}
const tests = {
  factory: testLog(`${execution}/root-factory-tests-v78-normal-access.log`),
  recovery: testLog(`${execution}/root-recovery-tests-v78.log`),
  payment_question_student_budget: testLog(`${execution}/root-payment-question-tests-v78.log`),
};
const buildPath = `${execution}/root-build-v78-normal-access.log`, build = readFileSync(buildPath, 'utf8');
if (!build.includes('Generating static pages') || !build.includes('Route (app)') || !build.includes('Compiled successfully')) throw Error('application_build_not_finished_successfully');
const manifest = read('data/calibration_manifest.json'), registry = read('data/source_registry.json');
const version = FACTORY_VERIFIER_VERSION_V78, contract = validationContractV78();
const binding = { verifier_version: version, validation_contract_hash: contract, prompt_hash: V78_PROMPT_HASH, cuet_fit_contract: CUET_FIT_VERSION,
  effort_policy: 'effort-policy-v1', efforts: { blind: 'high', explanation: 'high', gemini: 'medium' } };
const record = { verifier_version: version, validation_topology: 'dual_blind', checks: { blind_solution: { evaluation_prompt: V78_PROMPT_HASH } } };
const releaseGates = {
  legacy_factory_calibration_ready: factoryCalibrationReady(manifest, registry, version),
  cuet_fit_released: cuetFitReleased(manifest, registry, record),
  current_cuet_calibration_ready: currentCuetCalibrationReadyVNext({ manifest, registry, binding }),
};
if (Object.values(releaseGates).some(Boolean)) throw Error('unqualified_v78_unexpected_release');
const files = Object.fromEntries(V78_ADDITIVE_FILES.map(name => { const p = `scripts/pipeline/lib/${name}`; return [p, sha(p)]; }));
const testPaths = ['optionResolutionV78.test.mjs', 'optionResolutionV78.exportedRegression.test.mjs', 'v78Integration.test.mjs', 'v78MissingBindingsIndependent.test.mjs'];
const snapshot = {
  frozen_at: new Date().toISOString(), scope: 'Additive local implementation freeze only. No benchmark, runner, paid request, profile, pilot or publication.',
  verifier_version: version, validation_contract_hash: contract, prompt_hash: V78_PROMPT_HASH, parent_contract_hash: PARENT_CONTRACT_V77_HASH,
  qualification_state: 'unqualified', dispatch_eligible: false, publication_eligible: false, native_provider_calls: 0,
  file_sha256: files, test_sha256: Object.fromEntries(testPaths.map(name => { const p = `scripts/pipeline/tests/${name}`; return [p, sha(p)]; })),
  independent_review: { path: `${execution}/v78-local-integration-review.md`, sha256: sha(`${execution}/v78-local-integration-review.md`) },
  tests, application_build: { path: buildPath, sha256: sha(buildPath), static_pages: Number(build.match(/Generating static pages[^\n]*\((\d+)\/\d+\)/u)?.[1]) || null },
  preservation: { historical_checks: historical.checks, historical_distinct_paths: historical.distinct_paths, v77_bound_files_checked: checks.length, mismatches: [], inspected_native_export_sha256: sha(exportPath) },
  release_gates: releaseGates,
  corrections: ['explicit positional premise origins', 'mixed exact source rules and printed case facts', 'whitespace-only quote normalization', 'paraphrased context independent of exact anchored premises', 'hypothetical printed-option arithmetic input with independent premise', 'whole-option and clause semantic audits of both frozen blind matrices', 'exact V78 prompt/version/contract cache binding'],
  limitations: ['Local synthetic semantic audits test contracts, not academic truth or model independence.', 'Origins projected onto saved V77 outputs are regression only; native outputs/labels remain immutable.', 'All inherited mandatory gates and 21 criteria remain; easy items are permitted.', 'No measured V78 quality, fresh qualification, publishable yield, 10000-publishable cost, qualified pilot or live staging proof.', 'The final authorized V77 study cannot pass, and another paid qualification needs new explicit scope.'],
};
writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ path: outPath, sha256: sha(outPath), version, validation_contract_hash: contract, prompt_hash: V78_PROMPT_HASH, tests, release_gates: releaseGates, preservation: snapshot.preservation }, null, 2));
