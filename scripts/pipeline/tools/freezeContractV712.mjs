// Freeze the exact V7.12 validator (+ author layer and transport fix) before any fresh qualification case is exposed to it.
//   node scripts/pipeline/tools/freezeContractV712.mjs <out.json>
// Never overwrites. The fresh-study runner refuses to run if validationContractV712() differs from the frozen value.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validationContractV712, FACTORY_VERIFIER_VERSION_V712 } from '../lib/contractV712.mjs';
import { V712_PROMPT_HASH } from '../lib/factoryEvidenceV712.mjs';
const out = process.argv[2];
if (!out) throw new Error('output_path_required');
if (existsSync(out)) throw new Error('freeze_exists_never_overwrite');
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const files = ['scripts/pipeline/lib/contractV712.mjs', 'scripts/pipeline/lib/optionResolutionV712.mjs', 'scripts/pipeline/lib/factoryEvidenceV712.mjs',
  'scripts/pipeline/lib/verifyV712.mjs', 'scripts/pipeline/lib/questionScopeV712.mjs', 'scripts/pipeline/lib/originalAuthorPolicyV79.mjs', 'scripts/pipeline/lib/longFetch.mjs',
  'scripts/pipeline/lib/cuetPilotV712Deps.mjs', 'scripts/pipeline/lib/cuetPilotV712Plan.mjs', 'scripts/pipeline/lib/ncertColumnsRegistryV1.mjs',
  'scripts/pipeline/tools/runCuetValidatorStudyV712.mjs', 'scripts/pipeline/tools/assembleCuetFreshStudyV712.mjs', 'scripts/pipeline/tools/prepareCuetPilotV712.mjs', 'scripts/pipeline/tools/runCuetPilotV712.mjs',
  'scripts/pipeline/tools/extractNcertColumnsV1.py', 'scripts/pipeline/tools/buildNcertColumnRegistryV1.mjs', 'data/question-factory-runtime/source-registry-ncert-columns-v1.json',
  'scripts/pipeline/tests/v712Integration.test.mjs', 'scripts/pipeline/tests/v712PassageScope.test.mjs', 'scripts/pipeline/tests/v712Scope.test.mjs', 'scripts/pipeline/tests/cuetPilotV712.test.mjs',
  'data/pipeline-prices.json'];
const freeze = { frozen_at: new Date().toISOString(), verifier_version: FACTORY_VERIFIER_VERSION_V712, validation_contract_hash: validationContractV712(),
  prompt_hash: V712_PROMPT_HASH, parent_v711_contract_hash: 'dff119fc0a2034eb719e024e8feb84460f359423fcea66c5f7f2efa1d6f181e3', files: Object.fromEntries(files.map(p => [p, sha(p)])),
  topology: 'dual_blind (Luna blind + Gemini blind + Luna explanation/resolution audit)', efforts: 'effortsFor(): Luna blind per item type, Gemini medium, audit high (unchanged)',
  decision_rule: 'zero eligible controlled defects; valid eligible >= 85% pooled and >= 70% per subject; unfinished counts as not eligible; any unfinished defect blocks a pass',
  note: 'V7.12 = frozen V7.11 + conservative quote anchoring (reviewer counterexamples now, never merging words) + deterministic question-scope enforcement + column-verified NCERT source custody (ncert-columns-v1, original NCERT and private leac203 extractions superseded for both studies and pilot authoring). Regression evidence (exposed V7.7 cases; spent V7.9 q1 and V7.10 q2) shaped it and is not qualification. Fresh q3 cases are authored only after this freeze.' };
writeFileSync(out, JSON.stringify(freeze, null, 1) + '\n');
console.log(JSON.stringify({ out, sha256: sha(out), contract: freeze.validation_contract_hash, prompt: freeze.prompt_hash }, null, 1));
