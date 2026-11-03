// Freeze the exact V7.10 validator (+ author layer and transport fix) before any fresh qualification case is exposed to it.
//   node scripts/pipeline/tools/freezeContractV710.mjs <out.json>
// Never overwrites. The fresh-study runner refuses to run if validationContractV710() differs from the frozen value.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validationContractV710, FACTORY_VERIFIER_VERSION_V710 } from '../lib/contractV710.mjs';
import { V710_PROMPT_HASH } from '../lib/factoryEvidenceV710.mjs';
const out = process.argv[2];
if (!out) throw new Error('output_path_required');
if (existsSync(out)) throw new Error('freeze_exists_never_overwrite');
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const files = ['scripts/pipeline/lib/contractV710.mjs', 'scripts/pipeline/lib/optionResolutionV710.mjs', 'scripts/pipeline/lib/factoryEvidenceV710.mjs',
  'scripts/pipeline/lib/verifyV710.mjs', 'scripts/pipeline/lib/originalAuthorPolicyV79.mjs', 'scripts/pipeline/lib/longFetch.mjs', 'scripts/pipeline/lib/cuetPilotV710Deps.mjs',
  'scripts/pipeline/tests/v710Integration.test.mjs', 'scripts/pipeline/tests/v710PassageScope.test.mjs', 'scripts/pipeline/tools/runCuetValidatorStudy.mjs',
  'scripts/pipeline/tools/assembleCuetFreshStudy.mjs', 'data/pipeline-prices.json'];
const freeze = { frozen_at: new Date().toISOString(), verifier_version: FACTORY_VERIFIER_VERSION_V710, validation_contract_hash: validationContractV710(),
  prompt_hash: V710_PROMPT_HASH, parent_v79_contract_hash: '67cbdd05da43334b89b1320559b23cc19be28f7170977910d0ff67f9ff025f4d', files: Object.fromEntries(files.map(p => [p, sha(p)])),
  topology: 'dual_blind (Luna blind + Gemini blind + Luna explanation/resolution audit)', efforts: 'effortsFor(): Luna blind per item type, Gemini medium, audit high (unchanged)',
  decision_rule: 'zero eligible controlled defects; valid eligible >= 85% pooled and >= 70% per subject; unfinished counts as not eligible; any unfinished defect blocks a pass',
  note: 'Regression evidence (exposed V7.7 cases and the spent, failed V7.9 q1 study) shaped V7.10; it is not qualification. Fresh q2 cases were authored and blind-keyed (sealed) before this freeze and have not been shown to any validator.' };
writeFileSync(out, JSON.stringify(freeze, null, 1) + '\n');
console.log(JSON.stringify({ out, sha256: sha(out), contract: freeze.validation_contract_hash, prompt: freeze.prompt_hash }, null, 1));
