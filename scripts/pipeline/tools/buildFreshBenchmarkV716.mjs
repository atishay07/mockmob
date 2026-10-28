// Builds a fresh V716 qualification benchmark from a sealed authored file. Offline and create-only.
// Usage: node scripts/pipeline/tools/buildFreshBenchmarkV716.mjs <study-directory>
// Reads <study>/sealed/authored.json; writes registry.json, cases.json (no labels, opaque ids, shuffled),
// sealed/custody-draft.json (labels + author keys) and blind/packet.json (no keys, explanations or labels).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { isValidTopSyllabusPair } from '../../../data/canonical_syllabus.js';
import { loadNcertColumnsOverlayV1, applyNcertColumnsV1 } from '../lib/ncertColumnsRegistryV1.mjs';
import { localScorecardChecksV716 } from '../lib/verifyV716.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(ROOT);
const directory = resolve(process.argv[2] || '');
const read = p => JSON.parse(readFileSync(p, 'utf8')), path = name => resolve(directory, name);
const authored = read(path('sealed/authored.json'));
if (authored.schema !== 'cuet-v716-authored-v1' || !Array.isArray(authored.items)) throw Error('authored_file_invalid');
for (const out of ['registry.json', 'cases.json', 'sealed/custody-draft.json', 'blind/packet.json']) if (existsSync(path(out))) throw Error('create_only_refuse:' + out);
const overlay = loadNcertColumnsOverlayV1('data/question-factory-runtime/source-registry-ncert-columns-v2.json');
const registry = applyNcertColumnsV1(read('data/source_registry.json'), overlay.overlay);
const PACK = subject => `cuet2024-${subject}-bookA`;
const hex = n => randomBytes(n).toString('hex');
const used = new Set(), rows = [], packet = [], custody = [];
for (const item of authored.items) {
 const c = item.candidate, subject = item.subject;
 if (!['english', 'accountancy', 'business_studies', 'economics'].includes(subject) || typeof item.expected_valid !== 'boolean') throw Error('item_subject_or_label_invalid:' + item.slot);
 if (!isValidTopSyllabusPair(subject, c.chapter)) throw Error('chapter_not_canonical:' + item.slot + ':' + c.chapter);
 const pack = registry.packs[PACK(subject)];
 if (pack?.state !== 'active') throw Error('pack_missing:' + subject);
 let id; do { id = 'q716-' + hex(8); } while (used.has(id)); used.add(id);
 const family = 'fam716-' + hex(8);
 const refs = c.sources.map(([sourceId, locator]) => {
  const source = registry.sources[sourceId], text = source?.facts?.[locator]?.text;
  if (!source || source.state !== 'active' || !source.reuse_permitted || typeof text !== 'string' || hashJSON(text) !== source.supports?.[locator]) throw Error('source_unregistered:' + item.slot + ':' + sourceId + ':' + locator);
  return { id: sourceId, version: source.version, locator, support_hash: source.supports[locator] };
 });
 const candidate = { id, subject, chapter: c.chapter, concept_id: `${subject}:${c.concept}`, body: c.body,
  options: c.options.map((text, i) => ({ key: 'ABCD'[i], text })), correct_answer: c.key, explanation: c.explanation,
  route: c.passage_text ? 'passage' : 'conceptual', difficulty: c.difficulty, question_type: c.question_type, passage_text: c.passage_text || null,
  family_id: family, source_refs: refs, learning_objective: { syllabus_unit: c.syllabus_unit, objective: c.objective, target_term: c.target_term || '' },
  provenance: { kind: 'original_practice', anchor_id: refs[0].id, adaptation_family: family, adaptation_type: 'source-grounded-original-practice',
   syllabus_version: registry.exam_specs[subject].syllabus_version, pattern_version: registry.exam_specs[subject].pattern_version, source_pack_id: PACK(subject), source_pack_version: pack.version } };
 registry.families[family] = { state: 'active', version: 1, subject, kind: 'original_practice', note: 'V716 fresh qualification fixture; never publish' };
 const checks = localScorecardChecksV716(candidate, registry, new Set());
 const failed = Object.entries(checks).filter(([key, value]) => key !== 'numeric_required' && value !== true).map(([key]) => key);
 if (failed.length) throw Error('local_checks_failed:' + item.slot + ':' + failed.join(','));
 rows.push({ id, subject, measurement_role: 'fresh', candidate });
 custody.push({ id, slot: item.slot, subject, expected_valid: item.expected_valid, defect_class: item.expected_valid ? null : item.defect_class,
  defect_note: item.expected_valid ? null : item.defect_note, author_key: c.key, author_answer_set: item.answer_set || [c.key], difficulty_target: c.difficulty, format: c.question_type });
 packet.push({ opaque_id: id, subject, chapter: c.chapter, question: c.body, passage: c.passage_text || null, options: candidate.options,
  excerpts: refs.map(ref => ({ source_id: ref.id, locator: ref.locator, text: registry.sources[ref.id].facts[ref.locator].text })) });
}
// Shuffle so file order reveals nothing about labels or authoring order.
const order = rows.map((row, i) => [hex(8), i]).sort().map(([, i]) => i);
const now = new Date().toISOString();
mkdirSync(path('blind'), { recursive: true });
writeFileSync(path('registry.json'), JSON.stringify(registry) + '\n', { flag: 'wx' });
writeFileSync(path('cases.json'), JSON.stringify({ schema: 'cuet-v716-cases-v1', study_id: authored.study_id, created_at: now, cases: order.map(i => rows[i]) }, null, 2) + '\n', { flag: 'wx' });
writeFileSync(path('sealed/custody-draft.json'), JSON.stringify({ schema: 'cuet-v716-custody-draft-v1', study_id: authored.study_id, created_at: now, answers: custody }, null, 2) + '\n', { flag: 'wx' });
writeFileSync(path('blind/packet.json'), JSON.stringify({ schema: 'cuet-v716-blind-packet-v1', study_id: authored.study_id, created_at: now,
 instructions: 'Solve each item independently from the printed question, passage and excerpts only.', items: order.map(i => packet[i]) }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ cases: rows.length, valid: custody.filter(c => c.expected_valid).length, defects: custody.filter(c => !c.expected_valid).length,
 by_subject: Object.fromEntries(['accountancy', 'business_studies', 'economics', 'english'].map(s => [s, rows.filter(r => r.subject === s).length])), registry_version: registry.version }, null, 2));
