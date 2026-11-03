// Apply the column-verified NCERT overlay (source-registry-ncert-columns-v1.json) to a registry copy. Used by BOTH qualification-study
// assembly and pilot authoring, so neither can draw on the superseded reading-order-naive extractions. The base registry file is untouched.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { hashJSON } from '../../../data/question_factory_policy.mjs';

export const NCERT_COLUMNS_OVERLAY_PATH = 'data/question-factory-runtime/source-registry-ncert-columns-v1.json';
export const SUPERSEDED_STATE = 'superseded_reading_order_unverified';

export function loadNcertColumnsOverlayV1(path = NCERT_COLUMNS_OVERLAY_PATH, read = readFileSync) {
  const raw = read(path), overlay = JSON.parse(raw);
  if (overlay.contract !== 'ncert-columns-v1' || !overlay.sources || !Array.isArray(overlay.superseded_source_ids)) throw Error('ncert_columns_overlay_invalid');
  for (const s of Object.values(overlay.sources)) for (const [locator, fact] of Object.entries(s.facts || {}))
    if (s.supports?.[locator] !== hashJSON(fact.text)) throw Error(`ncert_columns_support_hash_mismatch:${s.id}:${locator}`);
  return { overlay, sha256: createHash('sha256').update(raw).digest('hex') };
}

export function applyNcertColumnsV1(registry, overlay) {
  const out = { ...registry, sources: { ...registry.sources }, packs: structuredClone(registry.packs || {}) };
  for (const id of overlay.superseded_source_ids) if (out.sources[id]) out.sources[id] = { ...out.sources[id], state: SUPERSEDED_STATE, superseded_by_contract: overlay.contract };
  for (const [id, source] of Object.entries(overlay.sources)) {
    if (out.sources[id]) throw Error(`ncert_columns_id_collision:${id}`);
    out.sources[id] = structuredClone(source);
    const pack = out.packs[source.source_pack_id];
    if (pack && Array.isArray(pack.document_ids) && !pack.document_ids.includes(id)) pack.document_ids.push(id);
  }
  return out;
}

// Every source reference of a candidate must resolve to an active, non-superseded source with matching support.
export function damagedSourceRefs(candidate, registry) {
  return (candidate.source_refs || []).filter(r => {
    const s = registry.sources?.[r.id];
    return !s || s.state !== 'active' || s.supports?.[r.locator] !== r.support_hash;
  }).map(r => `${r.id}|${r.locator}`);
}
