import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { hashJSON } from '../../../../../../data/question_factory_policy.mjs';
import { contentHash } from '../../../../../../data/content_evidence.js';
import { loadNcertColumnsOverlayV1, applyNcertColumnsV1 } from '../../../../../../scripts/pipeline/lib/ncertColumnsRegistryV1.mjs';

const root = process.cwd();
const base = resolve(root, 'artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v713/fresh-custody');
const study = 'cuet-v713-fresh-final';
const freezeSha = '82de56e6299d312cbbee86a636f7ddff41daf8ca4a626204ca714541935481f4';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const authoredPath = join(base, 'sealed/authored.json');
const authoredBytes = readFileSync(authoredPath);
if (sha(authoredBytes) !== 'f448751cf3a5005d3e2eabd883f3b65ebcdae3946e9b81d0de6eb51135d6685e') throw Error('authored_hash_changed');
const authored = JSON.parse(authoredBytes.toString('utf8'));
if (authored.schema !== 'cuet-v713-authored-v1' || authored.study_id !== study || authored.items.length !== 36) throw Error('authored_artifact_invalid');
const freezePath = resolve(root, 'artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v713/CONTRACT-FREEZE.json');
if (sha(readFileSync(freezePath)) !== freezeSha) throw Error('freeze_hash_mismatch');
const overlay = loadNcertColumnsOverlayV1('data/question-factory-runtime/source-registry-ncert-columns-v2.json');
const registry = applyNcertColumnsV1(read(resolve(root, 'data/source_registry.json')), overlay.overlay);
const factKits = read(join(base, 'kit/source-fact-kits.json'));
const syllabusKit = read(join(base, 'kit/official-syllabus-slices.json'));
if (!['accountancy', 'business_studies', 'economics', 'english'].every(s => factKits.subjects?.[s] && syllabusKit.subjects?.[s])) throw Error('custody_kits_incomplete');
const factIndex = new Map();
for (const [subject, group] of Object.entries(factKits.subjects)) for (const item of group.items || []) {
  factIndex.set(`${subject}|${item.source_id}|${item.locator}`, item);
}
const opaque = new Set(), packetItems = [], mapRows = [];
let syllabusFallbacks = 0, registryQuoteFallbacks = 0;
for (const item of authored.items) {
  const c = item.candidate;
  if (!c || c.id !== item.id || !Array.isArray(c.source_refs) || !c.source_refs.length) throw Error('candidate_source_refs_required');
  let opaqueId;
  do { opaqueId = `b-${randomBytes(8).toString('hex')}`; } while (opaque.has(opaqueId));
  opaque.add(opaqueId);
  const excerpts = [];
  for (const ref of c.source_refs) {
    const source = registry.sources?.[ref.id];
    const text = source?.facts?.[ref.locator]?.text;
    if (!source || source.state !== 'active' || source.version !== ref.version || !source.reuse_permitted ||
        source.supports?.[ref.locator] !== ref.support_hash || typeof text !== 'string' || hashJSON(text) !== ref.support_hash) {
      throw Error('source_registry_support_mismatch');
    }
    const kit = factIndex.get(`${c.subject}|${ref.id}|${ref.locator}`);
    let excerpt = text;
    if (kit) {
      if (kit.source_ref?.id !== ref.id || kit.source_ref?.version !== ref.version || kit.source_ref?.locator !== ref.locator ||
          kit.source_ref?.support_hash !== ref.support_hash || kit.text !== text) throw Error('source_fact_kit_registry_mismatch');
      excerpt = kit.text;
    } else registryQuoteFallbacks++;
    excerpts.push({ source_id: ref.id, locator: ref.locator, support_hash: ref.support_hash, text: excerpt });
  }
  const official = syllabusKit.subjects[c.subject];
  const chapter = String(c.chapter || '').toLocaleLowerCase();
  const relevant = (official.sections || []).filter(section =>
    `${section.id || ''}\n${section.text || ''}`.toLocaleLowerCase().includes(chapter));
  const sections = relevant.length ? relevant : official.sections;
  if (!relevant.length) syllabusFallbacks++;
  const syllabus = { source_ref: official.source_ref, sections };
  packetItems.push({ opaque_id: opaqueId, subject: c.subject, chapter: c.chapter, body: c.body,
    options: c.options, passage_text: c.passage_text || '', source_refs: c.source_refs, excerpts, syllabus });
  mapRows.push({ fixture_id: item.id, opaque_id: opaqueId, content_hash: contentHash(c),
    correct_answer: c.correct_answer, expected_valid: item.expected_valid });
}
const packet = { schema: 'cuet-v713-blind_packet-v1', study_id: study, freeze_sha256: freezeSha,
  created_at: new Date().toISOString(), items: packetItems };
const packetBytes = Buffer.from(JSON.stringify(packet, null, 2) + '\n');
const map = { schema: 'cuet-v713-sealed_blind_map-v1', study_id: study, freeze_sha256: freezeSha,
  created_at: new Date().toISOString(), author_sha256: sha(authoredBytes), packet_sha256: sha(packetBytes), rows: mapRows };
const mapBytes = Buffer.from(JSON.stringify(map, null, 2) + '\n');
const packetPath = join(base, 'blind/packet.json'), mapPath = join(base, 'sealed/map.json');
if (existsSync(packetPath) || existsSync(mapPath)) throw Error('blind_artifact_exists_refuse_overwrite');
mkdirSync(join(base, 'blind'), { recursive: true });
mkdirSync(join(base, 'sealed'), { recursive: true });
writeFileSync(packetPath, packetBytes, { flag: 'wx' });
writeFileSync(mapPath, mapBytes, { flag: 'wx' });
console.log(JSON.stringify({ packet: 'fresh-custody/blind/packet.json', packet_sha256: sha(packetBytes), packet_count: packetItems.length,
  map: 'fresh-custody/sealed/map.json', map_sha256: sha(mapBytes), map_count: mapRows.length,
  authored_sha256: sha(authoredBytes), opaque_id_count: opaque.size, registry_quote_fallbacks: registryQuoteFallbacks,
  syllabus_fallbacks: syllabusFallbacks, freeze_sha256: freezeSha }));
