// Freeze the exact V7.11 validator (+ author layer and transport fix) before any fresh qualification case is exposed to it.
//   node scripts/pipeline/tools/freezeContractV711.mjs <out.json>
// Never overwrites. The fresh-study runner refuses to run if validationContractV711() differs from the frozen value.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validationContractV711, FACTORY_VERIFIER_VERSION_V711 } from '../lib/contractV711.mjs';
import { V711_PROMPT_HASH } from '../lib/factoryEvidenceV711.mjs';
const out = process.argv[2];
if (!out) throw new Error('output_path_required');
if (existsSync(out)) throw new Error('freeze_exists_never_overwrite');
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const files = ['scripts/pipeline/lib/contractV711.mjs', 'scripts/pipeline/lib/optionResolutionV711.mjs', 'scripts/pipeline/lib/factoryEvidenceV711.mjs',
  'scripts/pipeline/lib/verifyV711.mjs', 'scripts/pipeline/lib/originalAuthorPolicyV79.mjs', 'scripts/pipeline/lib/longFetch.mjs', 'scripts/pipeline/lib/cuetPilotV711Deps.mjs',
  'scripts/pipeline/tests/v711Integration.test.mjs', 'scripts/pipeline/tests/v711PassageScope.test.mjs', 'scripts/pipeline/tools/runCuetValidatorStudyV711.mjs',
  'scripts/pipeline/tools/assembleCuetFreshStudy.mjs', 'data/pipeline-prices.json'];
const freeze = { frozen_at: new Date().toISOString(), verifier_version: FACTORY_VERIFIER_VERSION_V711, validation_contract_hash: validationContractV711(),
  prompt_hash: V711_PROMPT_HASH, parent_v710_contract_hash: '61d7a05c21d4b221fa48101de6de5b139cf31cee6c846611b0b34dc20e5206ba', files: Object.fromEntries(files.map(p => [p, sha(p)])),
  topology: 'dual_blind (Luna blind + Gemini blind + Luna explanation/resolution audit)', efforts: 'effortsFor(): Luna blind per item type, Gemini medium, audit high (unchanged)',
  decision_rule: 'zero eligible controlled defects; valid eligible >= 85% pooled and >= 70% per subject; unfinished counts as not eligible; any unfinished defect blocks a pass',
  note: 'Regression evidence (exposed V7.7 cases and the spent, failed V7.9 q1 study) shaped V7.11; it is not qualification. Fresh q2 cases were authored and blind-keyed (sealed) before this freeze and have not been shown to any validator.' };
writeFileSync(out, JSON.stringify(freeze, null, 1) + '\n');
console.log(JSON.stringify({ out, sha256: sha(out), contract: freeze.validation_contract_hash, prompt: freeze.prompt_hash }, null, 1));
