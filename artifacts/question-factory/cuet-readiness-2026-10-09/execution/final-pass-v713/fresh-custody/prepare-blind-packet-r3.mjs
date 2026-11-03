// R3 packet construction is deterministic in scope and preserves all prior custody artifacts.
// This script never logs candidate text, answer keys, explanations, or defect labels.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { hashJSON } from '../../../../../../data/question_factory_policy.mjs';
import { contentHash } from '../../../../../../data/content_evidence.js';
import { isValidTopSyllabusPair } from '../../../../../../data/canonical_syllabus.js';
import { loadNcertColumnsOverlayV1, applyNcertColumnsV1 } from '../../../../../../scripts/pipeline/lib/ncertColumnsRegistryV1.mjs';
import { structureVerdict } from '../../../../../../scripts/pipeline/lib/evidencePipeline.mjs';
import { presentationLint } from '../../../../../../data/question_presentation.mjs';
import { provenanceReasons } from '../../../../../../data/question_factory_policy.mjs';

const root = process.cwd();
const base = resolve(root, 'artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v713/fresh-custody');
const study = 'cuet-v713-fresh-final';
const freezeSha = '82de56e6299d312cbbee86a636f7ddff41daf8ca4a626204ca714541935481f4';
const authorSha = 'c1930133120d37aa1a367db90e0403e95036a9d00dfe21261587ab6264d0bff9';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const authoredPath = join(base, 'sealed/authored-r3.json');
const authoredBytes = readFileSync(authoredPath);
if (sha(authoredBytes) !== authorSha) throw Error('authored_r3_hash_changed');
const authored = JSON.parse(authoredBytes.toString('utf8'));
if (authored.schema !== 'cuet-v713-authored-v1' || authored.study_id !== study || authored.items.length !== 36) throw Error('authored_r3_artifact_invalid');
const freezePath = resolve(root, 'artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v713/CONTRACT-FREEZE.json');
if (sha(readFileSync(freezePath)) !== freezeSha) throw Error('freeze_hash_mismatch');

const r2 = read(join(base, 'sealed/authored-r2.json'));
if (r2.items.length !== 36 || authored.items.some((row, i) => row.id !== r2.items[i].id || row.expected_valid !== r2.items[i].expected_valid || row.group !== r2.items[i].group)) {
  throw Error('r3_denominator_or_labels_changed');
}
const replacements = new Set(['f-2c7dfe572963691f', 'f-90b386844e029292', 'f-184a13bcc63cf86c', 'f-245cd38b73b4511b', 'f-d95fe16105eb4952']);
const changedAcademic = [];
for (const row of authored.items) {
  const before = r2.items.find(old => old.id === row.id).candidate;
  const diffs = [...new Set([...Object.keys(before), ...Object.keys(row.candidate)])]
    .filter(key => JSON.stringify(before[key]) !== JSON.stringify(row.candidate[key]));
  if (replacements.has(row.id)) changedAcademic.push(row.id);
  else if (diffs.some(key => key !== 'difficulty')) throw Error('unapproved_r3_academic_change');
}
if (changedAcademic.length !== 5 || [...replacements].some(id => !changedAcademic.includes(id))) throw Error('r3_replacement_scope_mismatch');

const overlay = loadNcertColumnsOverlayV1('data/question-factory-runtime/source-registry-ncert-columns-v2.json');
const registry = applyNcertColumnsV1(read(resolve(root, 'data/source_registry.json')), overlay.overlay);
const factKits = read(join(base, 'kit/source-fact-kits.json'));
const syllabusKit = read(join(base, 'kit/official-syllabus-slices.json'));
if (!['accountancy', 'business_studies', 'economics', 'english'].every(s => factKits.subjects?.[s] && syllabusKit.subjects?.[s])) throw Error('custody_kits_incomplete');
const factIndex = new Map();
for (const [subject, group] of Object.entries(factKits.subjects)) for (const item of group.items || []) factIndex.set(`${subject}|${item.source_id}|${item.locator}`, item);
const families = {};
for (const row of authored.items) {
  const c = row.candidate;
  if (!c || c.id !== row.id || !isValidTopSyllabusPair(c.subject, c.chapter)) throw Error('candidate_identity_or_canonical_syllabus_invalid');
  const pack = registry.packs?.[c.provenance?.source_pack_id];
  if (!pack || pack.state !== 'active' || pack.subject !== c.subject || pack.version !== c.provenance?.source_pack_version) throw Error('active_pack_provenance_mismatch');
  families[c.family_id] = { state: 'active', version: 1, subject: c.subject, kind: 'original_practice', note: 'fresh V713 qualification fixture; never publish' };
}

// Difficulty-only changes on untouched cases must agree with the prior frozen, key-blind review.
const oldMap = read(join(base, 'sealed/map-r2.json'));
const blindOutput = read(join(base, 'blind/output-r2.json'));
const oldOpaqueToFixture = new Map(oldMap.rows.map(row => [row.opaque_id, row.fixture_id]));
const frozenDifficulty = new Map(blindOutput.items.map(item => [oldOpaqueToFixture.get(item.opaque_id), item.difficulty_assessment?.level]));
for (const row of authored.items.filter(item => !replacements.has(item.id))) {
  const old = r2.items.find(item => item.id === row.id).candidate;
  const diffs = [...new Set([...Object.keys(old), ...Object.keys(row.candidate)])]
    .filter(key => JSON.stringify(old[key]) !== JSON.stringify(row.candidate[key]));
  if (diffs.some(key => key !== 'difficulty') || !frozenDifficulty.get(row.id) ||
      String(row.candidate.difficulty).toLowerCase() !== String(frozenDifficulty.get(row.id)).toLowerCase()) throw Error('untouched_r3_difficulty_not_frozen_review_aligned');
}

const opaque = new Set(), packetItems = [], mapRows = [];
let syllabusFallbacks = 0, registryQuoteFallbacks = 0, validCount = 0, positiveFailures = 0;
for (const item of authored.items) {
  const c = item.candidate;
  if (!c || c.id !== item.id || !Array.isArray(c.source_refs) || !c.source_refs.length) throw Error('candidate_source_refs_required');
  if (item.expected_valid) validCount++;
  const local = [...structureVerdict(c).reasons, ...presentationLint(c), ...provenanceReasons(c, { ...registry, families: { ...registry.families, ...families } })];
  if (item.expected_valid && local.length) positiveFailures++;
  if (item.expected_valid && local.length) throw Error('r3_positive_local_preflight_failed');
  let opaqueId;
  do { opaqueId = `b-${randomBytes(8).toString('hex')}`; } while (opaque.has(opaqueId));
  opaque.add(opaqueId);
  const excerpts = [];
  for (const ref of c.source_refs) {
    const source = registry.sources?.[ref.id], text = source?.facts?.[ref.locator]?.text;
    if (!source || source.state !== 'active' || source.version !== ref.version || !source.reuse_permitted ||
        source.supports?.[ref.locator] !== ref.support_hash || typeof text !== 'string' || hashJSON(text) !== ref.support_hash) throw Error('source_registry_support_mismatch');
    const kit = factIndex.get(`${c.subject}|${ref.id}|${ref.locator}`);
    let excerpt = text;
    if (kit) {
      if (kit.source_ref?.id !== ref.id || kit.source_ref?.version !== ref.version || kit.source_ref?.locator !== ref.locator ||
          kit.source_ref?.support_hash !== ref.support_hash || kit.text !== text) throw Error('source_fact_kit_registry_mismatch');
      excerpt = kit.text;
    } else registryQuoteFallbacks++;
    excerpts.push({ source_id: ref.id, locator: ref.locator, support_hash: ref.support_hash, text: excerpt });
  }
  const official = syllabusKit.subjects[c.subject], chapter = String(c.chapter || '').toLocaleLowerCase();
  const relevant = (official.sections || []).filter(section => `${section.id || ''}\n${section.text || ''}`.toLocaleLowerCase().includes(chapter));
  const sections = relevant.length ? relevant : official.sections;
  if (!relevant.length) syllabusFallbacks++;
  const syllabus = { source_ref: official.source_ref, sections };
  packetItems.push({ opaque_id: opaqueId, subject: c.subject, chapter: c.chapter, body: c.body,
    options: c.options, passage_text: c.passage_text || '', source_refs: c.source_refs, excerpts, syllabus });
  mapRows.push({ fixture_id: item.id, opaque_id: opaqueId, content_hash: contentHash(c), correct_answer: c.correct_answer, expected_valid: item.expected_valid });
}
if (validCount !== 20 || positiveFailures !== 0) throw Error('r3_positive_denominator_gate_failed');
const packet = { schema: 'cuet-v713-blind_packet-v1', study_id: study, freeze_sha256: freezeSha, created_at: new Date().toISOString(), items: packetItems };
const packetBytes = Buffer.from(JSON.stringify(packet, null, 2) + '\n');
const map = { schema: 'cuet-v713-sealed_blind_map-v1', study_id: study, freeze_sha256: freezeSha,
  created_at: new Date().toISOString(), author_sha256: sha(authoredBytes), packet_sha256: sha(packetBytes), rows: mapRows };
const mapBytes = Buffer.from(JSON.stringify(map, null, 2) + '\n');
const packetPath = join(base, 'blind/packet-r3.json'), mapPath = join(base, 'sealed/map-r3.json');
if (existsSync(packetPath) || existsSync(mapPath)) throw Error('r3_artifact_exists_refuse_overwrite');
mkdirSync(join(base, 'blind'), { recursive: true });
writeFileSync(packetPath, packetBytes, { flag: 'wx' });
writeFileSync(mapPath, mapBytes, { flag: 'wx' });
console.log(JSON.stringify({ packet: 'fresh-custody/blind/packet-r3.json', packet_sha256: sha(packetBytes), packet_count: packetItems.length,
  map: 'fresh-custody/sealed/map-r3.json', map_sha256: sha(mapBytes), map_count: mapRows.length, author_sha256: sha(authoredBytes),
  opaque_id_count: opaque.size, registry_quote_fallbacks: registryQuoteFallbacks, syllabus_fallbacks: syllabusFallbacks,
  valid_count: validCount, positive_local_failures: positiveFailures, freeze_sha256: freezeSha }));
