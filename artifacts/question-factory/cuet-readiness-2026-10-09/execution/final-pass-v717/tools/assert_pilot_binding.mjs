import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Plan creation uses the same authoritative qualification gate as pilot execution.
const [qualification, freezePath] = process.argv.slice(2);
const root = process.cwd();
const moduleAt = p => import(pathToFileURL(resolve(root, p)).href);
const { assertQualifiedPilotV717 } = await moduleAt('scripts/pipeline/lib/qualifiedPilotV717.mjs');
const { assertExecutionFreezeV717 } = await moduleAt('scripts/pipeline/lib/executionFreezeV717.mjs');
const { hashJSON } = await moduleAt('data/question_factory_policy.mjs');
const bind = name => {
  const path = resolve(qualification, name);
  return { path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') };
};
const binding = { summary: bind('summary.json'), registration: bind('registration.json') };
const { registration } = assertQualifiedPilotV717(binding);
if (resolve(freezePath) !== resolve(registration.execution_freeze.path)) throw Error('pilot_plan_freeze_path_mismatch');
assertExecutionFreezeV717(freezePath, registration.execution_freeze.sha256);
const registry = JSON.parse(readFileSync(resolve(qualification, 'registry.json'), 'utf8'));
if (hashJSON(registry) !== registration.registry_sha256) throw Error('pilot_plan_registry_changed');
process.stdout.write(JSON.stringify(binding));
