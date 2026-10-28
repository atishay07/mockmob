// Offline, no-spend: re-bind every saved blind resolution of a finished study with two binder versions and list the differences.
//   node scripts/pipeline/tools/replayStudyBinding.mjs <studyDir> <fromVersion v710> <toVersion v711>
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const [studyDir, from, to] = process.argv.slice(2);
const json = p => JSON.parse(readFileSync(p, 'utf8'));
const load = async v => ({ res: await import(`../lib/optionResolution${v.toUpperCase().replace('V', 'V')}.mjs`), ev: await import(`../lib/factoryEvidence${v.toUpperCase()}.mjs`) });
const A = await load(from), B = await load(to);
const pick = (mod, prefix) => Object.entries(mod).find(([k]) => k.startsWith(prefix))[1];
const frozen = json(join(studyDir, 'frozen.json')), overlay = json(join(studyDir, 'scratch-registry-overlay.json')), base = json('data/source_registry.json');
const registry = { ...base, families: { ...base.families, ...overlay.families } }, results = json(join(studyDir, 'run', 'results.json')), prefix = results.prefix;
let changed = 0;
for (const f of frozen.fixtures) {
  const candidate = { ...structuredClone(f.candidate), id: prefix + f.id };
  const adapters = pick(A.ev, 'createFactoryEvidence')({ registry, ledger: { getCache: () => null, setCache: () => {} }, transport: { generate() { throw new Error('offline'); } } });
  const view = pick(A.ev, 'blindView')(candidate, candidate.source_refs), catalog = adapters.__context(view).evidence_catalog;
  for (const [stage, provider] of [['blind_solution', 'openai'], ['independent_evaluation', 'gemini']]) {
    const file = join(studyDir, 'run', 'raw', `${f.id}--${stage}--${provider}.json`);
    if (!existsSync(file)) continue;
    const r = json(file).response, text = r.output?.find?.(o => o.type === 'message')?.content?.[0]?.text || r.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    let out; try { out = JSON.parse(text); } catch { continue; }
    const va = pick(A.res, 'validateOptionResolution')(out, view, { evidenceCatalog: catalog }), vb = pick(B.res, 'validateOptionResolution')(out, view, { evidenceCatalog: catalog });
    if (va.ok !== vb.ok) { changed++; console.log(f.id, f.expected_valid ? 'VALID ' : 'DEFECT', provider, `${from}:${va.reason || 'ok'} -> ${to}:${vb.reason || 'ok'}`); }
  }
}
console.log(JSON.stringify({ study: frozen.id, binding_changes: changed }));
