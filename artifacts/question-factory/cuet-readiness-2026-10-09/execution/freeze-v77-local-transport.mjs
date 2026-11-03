import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { verifyV77Freeze, verifyV77TransportFreeze, V77_TRANSPORT_DEPENDENCIES,
  V77_TRANSPORT_FREEZE_PATH } from '../../../../scripts/pipeline/lib/freshCuetReadinessV77Guards.mjs';

const root = resolve('.');
const sha = file => createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex');
const core = verifyV77Freeze(root);
const seen = new Set(), queue = ['scripts/pipeline/tools/runFreshCuetReadinessV77.mjs'];
while (queue.length) {
  const file = resolve(root, queue.pop());
  if (seen.has(file)) continue;
  if (!existsSync(file)) throw new Error(`missing_dependency:${relative(root, file)}`);
  seen.add(file);
  for (const match of readFileSync(file, 'utf8').matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
    const dependency = resolve(dirname(file), match[1]);
    if (/\.(?:mjs|js|json)$/.test(dependency)) queue.push(dependency);
  }
}
const imports = [...seen].map(file => relative(root, file).replaceAll('\\', '/')).sort();
const missing = imports.filter(file => !V77_TRANSPORT_DEPENDENCIES.includes(file));
if (missing.length) throw new Error(`unbound_transitive_dependencies:${JSON.stringify(missing)}`);
if (!process.argv.includes('--freeze')) {
  console.log(JSON.stringify({ inspection_only: true, core_freeze_sha256: core.raw_sha256,
    transitive_imports: imports.length, bound_files: V77_TRANSPORT_DEPENDENCIES.length, missing }));
  process.exit(0);
}
const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };
function verifiedLog(name) {
  const path = arg(name);
  if (!path) throw new Error(`verified_test_log_required:${name}`);
  const content = readFileSync(path, 'utf8');
  const pass = Number(content.match(/(?:#|ℹ) pass (\d+)/)?.[1]), fail = Number(content.match(/(?:#|ℹ) fail (\d+)/)?.[1]);
  if (!Number.isSafeInteger(pass) || pass < 1 || fail !== 0) throw new Error(`passing_test_log_required:${path}`);
  return { path: relative(root, resolve(path)).replaceAll('\\', '/'), pass, fail, sha256: sha(path) };
}
const tests = { factory: verifiedLog('--factory-log'), focused: verifiedLog('--focused-log') };
const database = new DatabaseSync('data/pipeline-budget.sqlite', { readOnly: true });
const native = database.prepare("SELECT COUNT(*) AS n FROM provider_requests WHERE json_extract(request_json,'$.config.candidate_id') LIKE 'v77-qualification-2026-10-09-%'").get().n;
database.close();
if (native !== 0) throw new Error('transport_must_be_frozen_before_any_v77_native_request');
const files = Object.fromEntries([...V77_TRANSPORT_DEPENDENCIES].sort().map(file => [file, sha(file)]));
const freeze = { schema: 'v77-local-runner-transport-freeze-v1', frozen_at: new Date().toISOString(),
  qualified: false, core_freeze_sha256: core.raw_sha256, validation_contract_hash: core.validation_contract_hash,
  files, transitive_import_count: imports.length, tests, native_v77_requests: native,
  real_studies_registered: false, authorization_created: false,
  note: 'Prospective local transport freeze. This artifact provides no authorization for another paid study or any publication.' };
writeFileSync(V77_TRANSPORT_FREEZE_PATH, JSON.stringify(freeze, null, 2) + '\n', { flag: 'wx' });
const checked = verifyV77TransportFreeze(root, V77_TRANSPORT_DEPENDENCIES);
console.log(JSON.stringify({ frozen: true, transport_freeze_sha256: checked.raw_sha256,
  bound_files: Object.keys(files).length, transitive_imports: imports.length, tests, qualified: false, native_requests: native }));
