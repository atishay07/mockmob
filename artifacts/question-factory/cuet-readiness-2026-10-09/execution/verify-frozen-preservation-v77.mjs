import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const base = 'artifacts/question-factory/cuet-readiness-2026-10-09';
const read = path => JSON.parse(readFileSync(path));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const checks = [];
const check = (path, expected, binding) => checks.push({ path, binding, expected, actual: sha(path), matches: sha(path) === expected });
for (const name of ['v75-contract-freeze.json', 'v76-contract-freeze.json']) {
  const freeze = read(`${base}/${name}`);
  for (const [path, expected] of Object.entries(freeze.file_sha256)) check(path, expected, name);
}
for (const entry of readdirSync(`${base}/benchmark`, { withFileTypes: true })) {
  const dir = `${base}/benchmark/${entry.name}`, planPath = `${dir}/run/execution-plan.json`;
  if (!entry.isDirectory() || !existsSync(planPath)) continue;
  const plan = read(planPath);
  for (const [path, expected] of Object.entries(plan.input_hashes.code || {})) check(path, expected, entry.name);
  for (const [key, name] of Object.entries({ frozen: 'frozen.json', overlay: 'scratch-registry-overlay.json', custody: 'independent-key-custody.json' })) {
    if (plan.input_hashes[key]) check(`${dir}/${name}`, plan.input_hashes[key], entry.name);
  }
  if (plan.input_hashes.prices) check('data/pipeline-prices.json', plan.input_hashes.prices, entry.name);
}
const transport = read(`${base}/v76-transport-runner-freeze.json`);
check(`${base}/v76-contract-freeze.json`, transport.academic_contract_freeze_sha256, 'transport');
check(transport.runner_path, transport.runner_sha256, 'transport');
check(transport.input_reservation_path, transport.input_reservation_sha256, 'transport');
const mismatches = checks.filter(check => !check.matches);
const out = { at: new Date().toISOString(), read_only: true, checks: checks.length, distinct_paths: new Set(checks.map(check => check.path)).size, mismatches, details: checks };
writeFileSync(process.argv[2] || `${base}/execution/v77-frozen-preservation-check.json`, JSON.stringify(out, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ checks: out.checks, distinct_paths: out.distinct_paths, mismatches }));
if (mismatches.length) process.exitCode = 1;
