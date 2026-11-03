import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { contentHash } from '../../../data/content_evidence.js';
const sha = value => createHash('sha256').update(value).digest('hex');
const names = ['authored', 'sealed_blind_map', 'blind_packet', 'blind_output', 'blind_freeze', 'reveal', 'explanation_audit', 'novelty_report'];
const fail = message => { throw Error('fresh_custody:' + message); };
const time = value => { const n = Date.parse(value); if (!Number.isFinite(n)) fail('timestamp_missing'); return n; };
const exactRows = (rows, ids, idField = 'fixture_id') => {
  if (!Array.isArray(rows) || rows.length !== ids.size || new Set(rows.map(r => r[idField])).size !== ids.size ||
      rows.some(r => !ids.has(r[idField]))) fail('exact_id_coverage_required');
  return new Map(rows.map(r => [r[idField], r]));
};
export function establishFreshCustodyV713(input, freeze, freezeSha) {
  const manifest = input.custody;
  if (manifest?.schema !== 'cuet-v713-custody-v2' || manifest.freeze_sha256 !== freezeSha || manifest.study_id !== input.id ||
      manifest.custody_basis !== 'local_delegated_review') fail('manifest_invalid');
  const artifacts = {}, digests = {};
  for (const name of names) {
    const ref = manifest.artifacts?.[name];
    if (!ref?.path || !/^[a-f0-9]{64}$/.test(ref.sha256 || '')) fail('named_artifact_missing:' + name);
    const bytes = readFileSync(ref.path); if (sha(bytes) !== ref.sha256) fail('artifact_hash_changed:' + name);
    const data = JSON.parse(bytes.toString('utf8'));
    if (data.schema !== 'cuet-v713-' + name + '-v1' || data.study_id !== input.id || data.freeze_sha256 !== freezeSha) fail('artifact_identity_invalid:' + name);
    artifacts[name] = data; digests[name] = ref.sha256;
  }
  const { authored, sealed_blind_map: map, blind_packet: packet, blind_output: output,
    blind_freeze: sealed, reveal, explanation_audit: audit, novelty_report: novelty } = artifacts;
  const ids = new Set(input.fixtures.map(f => f.id));
  if (!authored.author_id || output.reviewer_id === authored.author_id || !output.reviewer_id ||
      audit.reviewer_id === authored.author_id || !audit.reviewer_id || !novelty.reviewer_id) fail('independent_roles_required');
  if (!(time(authored.started_at) > time(freeze.frozen_at) && time(authored.created_at) >= time(authored.started_at) &&
      time(packet.created_at) >= time(authored.created_at) && time(output.created_at) >= time(packet.created_at) &&
      time(sealed.created_at) >= time(output.created_at) && time(reveal.created_at) > time(sealed.created_at) &&
      time(audit.created_at) >= time(reveal.created_at) && time(novelty.created_at) >= time(authored.created_at))) fail('custody_order_invalid');
  if (map.author_sha256 !== digests.authored || map.packet_sha256 !== digests.blind_packet ||
      output.packet_sha256 !== digests.blind_packet || sealed.packet_sha256 !== digests.blind_packet || sealed.output_sha256 !== digests.blind_output ||
      reveal.author_sha256 !== digests.authored || reveal.blind_freeze_sha256 !== digests.blind_freeze || reveal.map_sha256 !== digests.sealed_blind_map ||
      audit.author_sha256 !== digests.authored || audit.blind_freeze_sha256 !== digests.blind_freeze ||
      novelty.author_sha256 !== digests.authored) fail('custody_cross_hash_invalid');
  const authorRows = exactRows(authored.items, ids, 'id'), mappings = exactRows(map.rows, ids);
  const revealed = exactRows(reveal.rows, ids);
  if (hashJSON(reveal.rows) !== hashJSON(map.rows)) fail('reveal_does_not_open_exact_sealed_map');
  const opaqueIds = new Set(map.rows.map(r => r.opaque_id));
  if (opaqueIds.size !== ids.size || [...opaqueIds].some(id => !/^b-[a-f0-9]{16}$/.test(id))) fail('opaque_blind_ids_required');
  const packets = exactRows(packet.items, opaqueIds, 'opaque_id'), answers = exactRows(output.items, opaqueIds, 'opaque_id');
  const audits = exactRows(audit.items, ids), novel = exactRows(novelty.items, ids);
  if (!Array.isArray(novelty.compared_history) || !novelty.compared_history.length) fail('novelty_history_required');
  for (const ref of novelty.compared_history) if (sha(readFileSync(ref.path)) !== ref.sha256) fail('novelty_history_changed');
  const permittedBlind = new Set(['opaque_id', 'subject', 'chapter', 'body', 'options', 'passage_text', 'source_refs', 'excerpts', 'syllabus']);
  const established = new Map();
  for (const f of input.fixtures) {
    const a = authorRows.get(f.id), p = packets.get(mappings.get(f.id).opaque_id), b = answers.get(p.opaque_id), e = audits.get(f.id), n = novel.get(f.id);
    const disclosed = revealed.get(f.id);
    if (disclosed.content_hash !== contentHash(f.candidate) || disclosed.correct_answer !== f.candidate.correct_answer ||
        disclosed.expected_valid !== f.expected_valid) fail('sealed_answer_disclosure_changed:' + f.id);
    if (a.expected_valid !== f.expected_valid || a.group !== f.group || hashJSON(a.candidate) !== hashJSON(f.candidate) ||
        (a.defect_category || null) !== (f.defect_category || null) || hashJSON(a.defect_evidence || null) !== hashJSON(f.defect_evidence || null)) fail('sealed_author_changed:' + f.id);
    if (Object.keys(p).some(k => !permittedBlind.has(k)) || p.subject !== f.subject || p.chapter !== f.candidate.chapter ||
        p.body !== f.candidate.body || hashJSON(p.options) !== hashJSON(f.candidate.options) ||
        (p.passage_text || '') !== (f.candidate.passage_text || '') || hashJSON(p.source_refs) !== hashJSON(f.candidate.source_refs) ||
        !Array.isArray(p.excerpts) || !p.excerpts.length || !p.syllabus) fail('blind_packet_not_key_free_exact_candidate:' + f.id);
    if (e.content_hash !== contentHash(f.candidate) || n.content_hash !== contentHash(f.candidate) || e.contested || n.unique !== true ||
        !n.reason || !Array.isArray(b.option_judgments) || b.option_judgments.length !== 4 || !b.decisive_basis || !e.decisive_basis) fail('independent_review_incomplete:' + f.id);
    if (f.expected_valid && (b.solved_key !== f.candidate.correct_answer || b.mandatory_gates_passed !== true || b.one_defensible_answer !== true ||
        e.mandatory_gates_passed !== true || e.explanation_supported !== true)) fail('valid_oracle_not_established:' + f.id);
    if (!f.expected_valid && e.defect_confirmed !== true) fail('controlled_defect_not_established:' + f.id);
    established.set(f.id, { complete: true, solved_key: b.solved_key, mandatory_gates_passed: b.mandatory_gates_passed && e.mandatory_gates_passed,
      explanation_supported: e.explanation_supported, defect_confirmed: e.defect_confirmed === true,
      decisive_basis: e.decisive_basis, blind_basis: b.decisive_basis, custody_basis: manifest.custody_basis });
  }
  return { established, packet, artifacts, digests };
}
