// Execution freeze for the V716 profile: every local module reachable from the session, review, policy,
// publication and runner entry points is hashed, so a registered study cannot silently run different code.
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FACTORY_VERIFIER_VERSION_V716, validationContractV716 } from './contractV716.mjs';
import { scorecardPromptHashV716 } from './scorecardReviewV716.mjs';
import { GENERATION_PROMPT_V716 } from './generationPromptV716.mjs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
export const EXECUTION_FREEZE_SCHEMA_V716 = 'cuet-v716-execution-freeze-v1';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export const V716_FREEZE_ENTRIES = Object.freeze(['scripts/pipeline/lib/campaignSessionV716.mjs', 'scripts/pipeline/lib/publicationBridgeV716.mjs',
 'scripts/pipeline/lib/publicationStoreV716Local.mjs', 'scripts/pipeline/lib/executionFreezeV716.mjs', 'scripts/pipeline/tools/runQualificationV716.mjs',
 'scripts/pipeline/tools/runPilotV716.mjs', 'scripts/pipeline/tools/recoverReceiptsV716.mjs']);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const posix = path => relative(ROOT, path).split(sep).join('/');
// Static relative imports only; the V716 modules do not use dynamic imports.
function localImports(file) {
 const text = readFileSync(file, 'utf8'), out = [];
 for (const match of text.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*['"](\.[^'"]+)['"]/g)) out.push(resolve(dirname(file), match[1]));
 for (const match of text.matchAll(/(?:^|\n)\s*import\s*['"](\.[^'"]+)['"]/g)) out.push(resolve(dirname(file), match[1]));
 return out;
}
export function dependencyClosureV716(entries = V716_FREEZE_ENTRIES) {
 const seen = new Set(), stack = entries.map(entry => resolve(ROOT, entry));
 while (stack.length) {
  const file = stack.pop();
  if (seen.has(file)) continue;
  if (!existsSync(file)) throw Error('v716_freeze_dependency_missing:' + posix(file));
  seen.add(file);
  if (/\.(mjs|js)$/.test(file)) stack.push(...localImports(file));
 }
 return [...seen].map(posix).sort();
}
export function buildExecutionFreezeV716({ entries = V716_FREEZE_ENTRIES, extraFiles = [], decisionRule, createdAt = new Date().toISOString() } = {}) {
 const files = Object.fromEntries([...new Set([...dependencyClosureV716(entries), ...extraFiles])].sort().map(path => [path, sha(readFileSync(resolve(ROOT, path)))]));
 return { schema: EXECUTION_FREEZE_SCHEMA_V716, profile: FACTORY_VERIFIER_VERSION_V716, created_at: createdAt, contract_hash: validationContractV716(),
  scorecard_prompt_hash: scorecardPromptHashV716(), generation_prompt_hash: hashJSON(GENERATION_PROMPT_V716), decision_rule: decisionRule || null,
  file_count: Object.keys(files).length, files };
}
// Verifies the freeze artifact itself and every frozen file against the current checkout.
export function assertExecutionFreezeV716(path, expectedSha, { readFile = p => readFileSync(p) } = {}) {
 if (!path || !/^[a-f0-9]{64}$/.test(expectedSha || '')) throw Error('v716_execution_freeze_binding_required');
 const bytes = readFile(path);
 if (sha(bytes) !== expectedSha) throw Error('v716_execution_freeze_changed');
 const freeze = JSON.parse(Buffer.from(bytes).toString('utf8'));
 if (freeze.schema !== EXECUTION_FREEZE_SCHEMA_V716 || freeze.profile !== FACTORY_VERIFIER_VERSION_V716 || freeze.contract_hash !== validationContractV716() ||
  freeze.scorecard_prompt_hash !== scorecardPromptHashV716() || freeze.generation_prompt_hash !== hashJSON(GENERATION_PROMPT_V716)) throw Error('v716_execution_freeze_profile_changed');
 const required = dependencyClosureV716();
 if (required.some(file => !Object.hasOwn(freeze.files || {}, file))) throw Error('v716_execution_freeze_incomplete');
 for (const [file, hash] of Object.entries(freeze.files)) if (sha(readFile(resolve(ROOT, file))) !== hash) throw Error('v716_execution_dependency_changed:' + file);
 return freeze;
}
export const fileSha256V716 = (path, readFile = p => readFileSync(p)) => sha(readFile(path));
