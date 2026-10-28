// Freeze the exact V7.9 validator (+ author layer and transport fix) before any fresh qualification case is exposed to it.
//   node scripts/pipeline/tools/freezeContractV79.mjs <out.json>
// Never overwrites. The fresh-study runner refuses to run if validationContractV79() differs from the frozen value.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validationContractV79, FACTORY_VERIFIER_VERSION_V79 } from '../lib/contractV79.mjs';
import { V79_PROMPT_HASH } from '../lib/factoryEvidenceV79.mjs';
import { validationContractV78 } from '../lib/contractV78.mjs';
const out = process.argv[2];
if (!out) throw new Error('output_path_required');
if (existsSync(out)) throw new Error('freeze_exists_never_overwrite');
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const files = ['scripts/pipeline/lib/contractV79.mjs', 'scripts/pipeline/lib/optionResolutionV79.mjs', 'scripts/pipeline/lib/factoryEvidenceV79.mjs',
  'scripts/pipeline/lib/verifyV79.mjs', 'scripts/pipeline/lib/originalAuthorPolicyV79.mjs', 'scripts/pipeline/lib/longFetch.mjs', 'scripts/pipeline/lib/cuetPilotV79Deps.mjs',
  'scripts/pipeline/tests/v79Integration.test.mjs', 'scripts/pipeline/tests/v79PassageScope.test.mjs', 'scripts/pipeline/tools/runV78RegressionProbe.mjs',
  'scripts/pipeline/tools/assembleV79FreshStudy.mjs', 'data/pipeline-prices.json'];
const freeze = { frozen_at: new Date().toISOString(), verifier_version: FACTORY_VERIFIER_VERSION_V79, validation_contract_hash: validationContractV79(),
  prompt_hash: V79_PROMPT_HASH, parent_v78_contract_hash: validationContractV78(), files: Object.fromEntries(files.map(p => [p, sha(p)])),
  topology: 'dual_blind (Luna blind + Gemini blind + Luna explanation/resolution audit)', efforts: 'effortsFor(): Luna blind per item type, Gemini medium, audit high (unchanged)',
  decision_rule: 'zero eligible controlled defects; valid eligible >= 85% pooled and >= 70% per subject; unfinished counts as not eligible; any unfinished defect blocks a pass',
  note: 'Regression evidence (exposed V7.7 cases) shaped r1-r5; it is not qualification. Fresh cases were authored and blind-keyed before this freeze and have not been shown to any validator.' };
writeFileSync(out, JSON.stringify(freeze, null, 1) + '\n');
console.log(JSON.stringify({ out, sha256: sha(out), contract: freeze.validation_contract_hash, prompt: freeze.prompt_hash }, null, 1));
