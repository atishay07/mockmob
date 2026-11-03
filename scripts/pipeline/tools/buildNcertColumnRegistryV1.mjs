// Build the versioned clean-source overlay from verified column extractions (10 Oct 2026). Never edits data/source_registry.json.
//   node scripts/pipeline/tools/buildNcertColumnRegistryV1.mjs            -> writes data/question-factory-runtime/source-registry-ncert-columns-v1.json
// Each repaired source `ncertcol-<book>-v1` keeps the original PDF identity (sha256 re-checked), chapters, permission and pack; each fact is
// ONE verified extraction segment, verbatim (line breaks kept), with page/column/bbox location. Exercise sections are excluded with the
// same NCERT exercise/section-number rules the earlier teaching-context derivation used. The original `ncert-*` sources (and the private
// leac203 extraction) are listed as superseded: their reading order was never verified and about half splice two columns.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { C_SOURCE_OVERLAY_PATH } from '../lib/candidateCRegistration.mjs';

export const NCERT_COLUMNS_CONTRACT = 'ncert-columns-v1';
const OUT = 'data/question-factory-runtime/source-registry-ncert-columns-v1.json';
const DIR = 'data/question-factory-runtime/ncert-columns-v1';
const MIN_ALNUM = 120;
// Chapter-end exercise headings exclude everything after them; mid-chapter practice boxes exclude only the rest of their page
// (lebs102 has a 'Test Your Understanding' box on p.10 that would otherwise drop pp.10-35, all of Fayol and Taylor).
const BOX = /\b(?:Test\s+Your\s+Understanding|TEST\s+YOUR\s+UNDERSTANDING|Do\s+It\s+Yourself|DO\s+IT\s+YOURSELF)\b/;
const EXERCISE = /\b(?:Exercises|EXERCISES|Very\s+Short\s+Answer|Short\s+Answer\s+(?:Type|Questions)|SHORT\s+ANSWER|Long\s+Answer\s+(?:Type|Questions)|LONG\s+ANSWER|Numerical\s+Questions|Questions\s+for\s+Practice|Exercise\s+\d)\b/;
const TEACHING = /(^|\n)\s*\d{1,2}\.\d{1,2}(?:\.\d{1,2})?\s+[A-Z][A-Za-z][A-Za-z ,’'&:-]{3,}/;
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');

const registry = JSON.parse(readFileSync('data/source_registry.json', 'utf8'));
const privateOverlay = JSON.parse(readFileSync(C_SOURCE_OVERLAY_PATH, 'utf8'));
const originals = Object.values(registry.sources).filter(s => s.id.startsWith('ncert-') && s.kind === 'reference' && s.file);
originals.push({ ...privateOverlay.source, file_path_absolute: privateOverlay.source.file });
const byBook = new Map();
for (const s of originals) {
  const book = (s.file.match(/([a-z]{4}\d{3})\.pdf$/) || [])[1];
  if (!book) continue;
  const entry = byBook.get(book) || { book, sources: [], chapters: new Set() };
  entry.sources.push(s); for (const c of s.chapters || []) entry.chapters.add(c); byBook.set(book, entry);
}
// Spacing-damage screen (visual audit, 10 Oct: 24/24 verbatim and in order, 3/24 with spacing damage). Text is never altered; suspect
// segments are EXCLUDED. Corpus vocabulary = word frequencies over every extracted segment of every chapter.
const vocab = new Map();
for (const { book } of byBook.values()) { const path = `${DIR}/${book}.json`; if (!existsSync(path)) continue;
  for (const page of JSON.parse(readFileSync(path, 'utf8')).pages) for (const col of page.columns) for (const seg of col.paragraphs)
    for (const w of seg.text.toLowerCase().match(/[a-z]+/g) || []) vocab.set(w, (vocab.get(w) || 0) + 1); }
const common = w => (vocab.get(w) || 0) >= 3;
function spacingDamage(text) {
  if (/(?:^|[^A-Za-z])(?:[A-Za-z] ){3,}/.test(text)) return 'letter_spaced_run'; // three or more single letters separated by spaces
  // A hyphen (or U+00AD) ending a line is genuine hyphenation that the V7.12 binder joins; screen only in-line splits.
  const words = text.replace(/([A-Za-z])[-\u00AD][ \t]*\n\s*(?=[A-Za-z])/g, '$1').toLowerCase().split(/[^a-z]+/).filter(Boolean);
  for (let i = 0; i + 1 < words.length; i++) { const a = words[i], b = words[i + 1];
    if (a.length > 1 && b.length > 1 && common(a + b) && (vocab.get(a + b) || 0) >= 5 && (!common(a) || !common(b))) return `split_word:${a}|${b}`; }
  return null;
}
const sources = {}, superseded = [], report = [];
for (const { book, sources: olds, chapters } of [...byBook.values()].sort((a, b) => a.book.localeCompare(b.book))) {
  const path = `${DIR}/${book}.json`;
  if (!existsSync(path)) { report.push({ book, state: 'no_extraction', superseded: olds.map(s => s.id) }); superseded.push(...olds.map(s => s.id)); continue; }
  const ext = JSON.parse(readFileSync(path, 'utf8')), first = olds[0];
  const pdfPath = first.file_path_absolute || `data/question-factory-runtime/${first.file}`;
  if (sha(pdfPath) !== ext.pdf_sha256) throw Error(`pdf_identity_changed:${book}`);
  if (first.identity_sha256 && first.identity_sha256 !== ext.pdf_sha256) throw Error(`registered_identity_mismatch:${book}`);
  const facts = {}, supports = {}, locations = {};
  let mode = 'teaching', kept = 0, exercise = 0, unverified = 0, short = 0, damaged = 0; const damageExamples = [];
  for (const page of ext.pages) { if (mode === 'box') mode = 'teaching'; for (const col of page.columns) for (const seg of col.paragraphs) {
    if (EXERCISE.test(seg.text)) mode = 'exercise';
    else if (BOX.test(seg.text) && mode !== 'exercise') mode = 'box';
    else if (TEACHING.test(seg.text)) mode = 'teaching';
    if (!seg.verified) { unverified++; continue; }
    if (seg.alnum_chars < MIN_ALNUM) { short++; continue; }
    if (mode !== 'teaching') { exercise++; continue; }
    const damage = spacingDamage(seg.text);
    if (damage) { damaged++; if (damageExamples.length < 3) damageExamples.push(damage); continue; }
    const locator = `p${page.page}-c${col.column}-g${seg.paragraph}-s${seg.segment}`;
    facts[locator] = { text: seg.text };
    supports[locator] = hashJSON(seg.text);
    locations[locator] = { page: page.page, column: col.column, bbox: seg.bbox, lines: seg.lines, two_column_page: page.gutter !== null };
    kept++;
  } }
  const id = `ncertcol-${book}-v1`;
  sources[id] = { id, kind: 'reference', state: kept ? 'active' : 'withheld_no_verified_teaching_text', version: 1, reuse_permitted: true,
    url: first.url || `https://ncert.nic.in/textbook/pdf/${book}.pdf`, file: first.file, identity_sha256: ext.pdf_sha256,
    extraction_file: path, extraction_sha256: sha(path), extraction_checked: true, extraction_method: ext.method,
    extraction_verification: 'each fact = one segment whose letter/digit stream occurs contiguously, in order, in xpdf pdftotext -raw output for the same page',
    permission: first.permission, chapters: [...chapters], source_pack_id: first.source_pack_id, title: `NCERT ${book} (column-verified extraction v1)`,
    supersedes: olds.map(s => s.id), facts, supports, fact_locations: locations };
  superseded.push(...olds.map(s => s.id));
  report.push({ book, id, chapters: [...chapters], kept, excluded_exercise: exercise, excluded_unverified: unverified, excluded_short: short, excluded_spacing_damage: damaged, spacing_damage_examples: damageExamples });
}
const overlay = { contract: NCERT_COLUMNS_CONTRACT, created_at: new Date().toISOString(), base_registry_sha256: sha('data/source_registry.json'),
  private_overlay: C_SOURCE_OVERLAY_PATH, private_overlay_sha256: sha(C_SOURCE_OVERLAY_PATH), min_alnum_chars: MIN_ALNUM,
  superseded_source_ids: [...new Set(superseded)].sort(), sources, report };
writeFileSync(OUT, JSON.stringify(overlay, null, 1) + '\n');
console.log(JSON.stringify({ out: OUT, sha256: sha(OUT), sources: Object.keys(sources).length, facts: Object.values(sources).reduce((n, s) => n + Object.keys(s.facts).length, 0),
  superseded: overlay.superseded_source_ids.length, missing: report.filter(r => r.state === 'no_extraction').map(r => r.book) }, null, 1));
