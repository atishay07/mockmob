// Offline, no-spend replay: re-apply the CURRENT V7.9 deterministic resolution binder to raw provider responses saved by a
// regression probe. Shows which quarantines were representation-only. It cannot replay later model stages that never ran.
//   node scripts/pipeline/tools/replayV79Resolution.mjs <probeDir> <id,id,...>
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateOptionResolutionV79 } from '../lib/optionResolutionV79.mjs';
import { createFactoryEvidenceV79 } from '../lib/factoryEvidenceV79.mjs';
import { blindViewV76 } from '../lib/factoryEvidenceV76.mjs';
import { contentHash } from '../../../data/content_evidence.js';
const [probeDir, ids] = process.argv.slice(2);
const json = p => JSON.parse(readFileSync(p, 'utf8'));
const results = json(join(probeDir, 'results.json')), prefix = results.prefix;
const ROOT = 'artifacts/question-factory/cuet-readiness-2026-10-09/v77-qualification';
const fixtures = ['v77-qualification-2026-10-09-final-fresh-integrated', 'v77-qualification-2026-10-09-final-regression-integrated']
  .flatMap(s => json(join(ROOT, s, 'frozen.json')).fixtures.map(f => ({ ...f, registry: json(join(ROOT, s, 'run', 'execution-plan.json')).source_registry })));
for (const id of ids.split(',')) {
  const f = fixtures.find(x => x.id === id), candidate = { ...structuredClone(f.candidate), id: prefix + id };
  const adapters = createFactoryEvidenceV79({ registry: f.registry, ledger: { getCache: () => null, setCache: () => {} }, transport: { generate() { throw new Error('offline'); } } });
  const view = blindViewV76(candidate, candidate.source_refs), catalog = adapters.__context(view).evidence_catalog;
  for (const [stage, provider] of [['blind_solution', 'openai'], ['independent_evaluation', 'gemini']]) {
    const file = join(probeDir, 'raw', `${id}--${stage}--${provider}.json`);
    if (!existsSync(file)) { console.log(id, provider, 'no_raw_response'); continue; }
    const r = json(file).response, text = r.output?.find?.(o => o.type === 'message')?.content?.[0]?.text || r.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    const out = JSON.parse(text);
    if (view.content_hash !== contentHash(candidate) || out.content_hash !== view.content_hash) { console.log(id, provider, 'hash_mismatch'); continue; }
    console.log(id, provider, 'solved', out.solved_key, 'single', out.single_defensible_answer, '->', JSON.stringify(validateOptionResolutionV79(out, view, { evidenceCatalog: catalog })));
  }
}
