// Pre-evaluation metadata correction only. Preserve every original case and all academic text/labels.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { contentHash } from '../../../../../../data/content_evidence.js';
import { isValidTopSyllabusPair } from '../../../../../../data/canonical_syllabus.js';
import { loadNcertColumnsOverlayV1, applyNcertColumnsV1 } from '../../../../../../scripts/pipeline/lib/ncertColumnsRegistryV1.mjs';
const base = resolve('artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v713/fresh-custody');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const originalBytes = readFileSync(resolve(base, 'sealed/authored.json'));
if (sha(originalBytes) !== 'f448751cf3a5005d3e2eabd883f3b65ebcdae3946e9b81d0de6eb51135d6685e') throw Error('original_author_changed');
const original = JSON.parse(originalBytes), corrected = structuredClone(original);
const registry = applyNcertColumnsV1(read('data/source_registry.json'), loadNcertColumnsOverlayV1('data/question-factory-runtime/source-registry-ncert-columns-v2.json').overlay);
const aliases = { economics: { 'National Income Accounting': 'National Income & Related Aggregates' }, english: { 'Vocabulary: Choosing the Correct Word': 'Vocabulary' } };
const stripMetadata = item => {
  const copy = structuredClone(item);
  delete copy.candidate.chapter;
  delete copy.candidate.provenance.source_pack_version;
  return JSON.stringify(copy);
};
const changes = [];
for (let i = 0; i < corrected.items.length; i++) {
  const row = corrected.items[i], c = row.candidate, before = original.items[i];
  const pack = registry.packs?.[c.provenance?.source_pack_id];
  if (!pack || pack.state !== 'active' || pack.subject !== c.subject) throw Error('active_subject_pack_required');
  const oldChapter = c.chapter, oldVersion = c.provenance.source_pack_version;
  c.provenance.source_pack_version = pack.version;
  c.chapter = aliases[c.subject]?.[c.chapter] || c.chapter;
  if (!isValidTopSyllabusPair(c.subject, c.chapter)) throw Error('canonical_chapter_required');
  if (stripMetadata(row) !== stripMetadata(before)) throw Error('academic_payload_or_labels_changed');
  changes.push({ fixture_id: row.id, before_content_hash: contentHash(before.candidate), after_content_hash: contentHash(c),
    source_pack_id: c.provenance.source_pack_id, before_pack_version: oldVersion, after_pack_version: pack.version,
    before_chapter: oldChapter, after_chapter: c.chapter, all_other_fields_identical: true });
}
corrected.created_at = new Date().toISOString();
corrected.pre_evaluation_metadata_correction = { basis: 'Exact active registry pack versions and canonical chapter aliases only; no academic changes, exclusions, relabels or evaluation-informed edits.', original_sha256: sha(originalBytes) };
const bytes = Buffer.from(JSON.stringify(corrected, null, 2) + '\n');
writeFileSync(resolve(base, 'sealed/authored-r2.json'), bytes, { flag: 'wx' });
writeFileSync(resolve(base, 'sealed/metadata-correction-r2.json'), JSON.stringify({ schema: 'cuet-v713-pre-evaluation-metadata-correction-v1',
  created_at: corrected.created_at, original_path: resolve(base, 'sealed/authored.json'), original_sha256: sha(originalBytes),
  corrected_path: resolve(base, 'sealed/authored-r2.json'), corrected_sha256: sha(bytes),
  timing: 'Before any independent blind review or provider evaluation; original draft and first unused blind packet/map retained.',
  denominator: 36, labels_and_academic_fields_unchanged: true, changes }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ corrected_sha256: sha(bytes), denominator: corrected.items.length,
  pack_version_changes: changes.filter(r => r.before_pack_version !== r.after_pack_version).length,
  chapter_alias_changes: changes.filter(r => r.before_chapter !== r.after_chapter).length, paid_calls: 0 }));
