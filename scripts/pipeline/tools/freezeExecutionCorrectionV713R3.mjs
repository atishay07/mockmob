// Additive execution/custody plumbing only; original academic freeze and R2 stay untouched.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const base = resolve('artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v713');
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const academic = resolve(base, 'CONTRACT-FREEZE.json'), original = JSON.parse(readFileSync(academic, 'utf8'));
for (const [p, digest] of Object.entries(original.files)) if (sha(p) !== digest) throw Error('academic_freeze_changed:' + p);
const files = ['scripts/pipeline/lib/trustedNetworkV713R3.mjs', 'scripts/pipeline/lib/mixedCustodyV713R3.mjs',
  'scripts/pipeline/lib/providerAvailabilityV713R2.mjs', 'scripts/pipeline/lib/cuetPilotRunV713R3.mjs',
  'scripts/pipeline/tools/prepareMixedQualificationV713R3.mjs', 'scripts/pipeline/tools/runQualificationV713R3.mjs',
  'scripts/pipeline/tools/captureMixedQualificationV713R3.mjs', 'scripts/pipeline/tools/collectMixedQualificationV713R3.mjs'];
const manifest = { schema: 'cuet-v713-execution-correction-r3', frozen_at: new Date().toISOString(),
  academic_contract_changed: false, academic_freeze_path: academic, academic_freeze_sha256: sha(academic),
  original_r2_manifest_sha256: sha(resolve(base, 'EXECUTION-CORRECTION-R2.json')),
  correction: 'Trusted Windows CA enforced; no-payload TLS preflight before ledger/reservation; network failure pauses shared dispatch, retains holds/judgments. Prospective explicit 31-fresh/6-regression custody plumbing preserves all 37 labels and outcomes under one USD1 cap. No academic prompt, verifier, price, effort, or threshold changes.',
  files: Object.fromEntries(files.map(p => [p, sha(p)])) };
writeFileSync(resolve(base, 'EXECUTION-CORRECTION-R3.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ frozen: true, files: files.length, academic_changed: false, model_calls: 0 }));
