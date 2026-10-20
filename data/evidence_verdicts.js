// The delayed-check freshness read of GET /api/recovery (egress problem 1, 20 Oct 2026). No 'server-only' and no alias imports: the
// database is passed in, so node:test can load it.
//
// The record needs, for every question a student has met, ONE fact: the content hash of the question's current signed evidence, but
// only when that evidence still passes the publication gate and the question's family is not held. It used to read every one of those
// rows whole (a managed row is 35 KB with its signed record: 3.5 MB for a history of 100 questions, on every call of every cold
// instance). The fact is small and is a pure function of
//   (1) the row               every UPDATE bumps questions.updated_at (trigger trg_questions_updated_at, BEFORE UPDATE FOR EACH ROW)
//                             and an INSERT carries now(), so an equal updated_at means an equal row;
//   (2) the deploy            registry and calibration (sharedEligibilitySnapshot: the same frozen object while the files do not
//                             change), MOCK_AI and the signing key (a different process environment is a different deploy);
//   (3) the clock             evidence.record.expires_at, the only place evaluateEvidence reads the time: an eligible verdict turns
//                             ineligible at expiry and an ineligible one never turns eligible by waiting;
//   (4) the family holds      recovery_family_holds, a small table: looked up on EVERY call for the families of the eligible
//                             questions, never cached.
// So each question keeps one small entry (id, stamp, eligible, content hash, expiry, family; about 250 bytes, at most
// VERDICT_CACHE_MAX of them, none older than VERDICT_CACHE_TTL_MS) and a call costs one stamp query per 200 ids (about 70 bytes a row)
// plus the holds lookup; only a question that has no entry, or whose stamp moved, is read whole. The cache holds content, never anything
// about a student (it is keyed by question id), and the history walk never touches the shared full-row cache of
// data/question_row_cache.js, so a long history cannot evict the rows that practice and Mob starts share.
import { excludeHeldFamilies } from './evidence_holds.js';
import { publicationEligibility, sharedEligibilitySnapshot } from './evidence_registry.js';

export const VERDICT_CACHE_MAX = 5000;
export const VERDICT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const STAMP_CHUNK = 200;

export function createVerdictCache({ now = Date.now, max = VERDICT_CACHE_MAX, ttlMs = VERDICT_CACHE_TTL_MS } = {}) {
  const map = new Map(); // id -> entry; the least recently used first
  return {
    /** The entry when it was made from this stamp and this deploy and is not too old; otherwise null (and it is dropped). */
    get(id, stamp, deploy) {
      const entry = map.get(id);
      if (!entry) return null;
      if (now() - entry.at >= ttlMs || entry.stamp !== stamp || entry.snapshot !== deploy.snapshot || entry.mock !== deploy.mock || entry.key !== deploy.key) { map.delete(id); return null; }
      map.delete(id); map.set(id, entry);
      return entry;
    },
    set(id, entry) {
      map.delete(id);
      map.set(id, { ...entry, at: now() });
      while (map.size > max) map.delete(map.keys().next().value);
    },
    clear() { map.clear(); },
    get size() { return map.size; },
  };
}

const perClient = new WeakMap();
/** The verdict cache of one database client (created on first use); a non-object client gets a throwaway one. */
export function verdictCacheFor(db) {
  if (db === null || (typeof db !== 'object' && typeof db !== 'function')) return createVerdictCache();
  let cache = perClient.get(db);
  if (!cache) { cache = createVerdictCache(); perClient.set(db, cache); }
  return cache;
}

const deployNow = () => ({ snapshot: sharedEligibilitySnapshot(), mock: process.env.MOCK_AI === 'true', key: process.env.CUET_EVIDENCE_SIGNING_KEY ?? null });

/** What the cache keeps of one full row (its verdict is computed from the row, now, exactly as the old read computed it). */
function entryOf(row, stamp, deploy) {
  const record = row.evidence?.record;
  const eligible = publicationEligibility(row, deploy.snapshot).eligible && typeof record?.content_hash === 'string';
  const expiresAt = Date.parse(record?.expires_at);
  return {
    stamp, snapshot: deploy.snapshot, mock: deploy.mock, key: deploy.key, eligible,
    hash: eligible ? record.content_hash : null,
    expiresAt: eligible && Number.isFinite(expiresAt) ? expiresAt : null,
    family: row.family_id || record?.family_id || null,
  };
}

/**
 * The content hash of every question whose current evidence passes the publication gate and whose family is not held, for the
 * delayed-check freshness test (src/app/api/recovery/route.js). Returns { hashes: Map(id -> hash), unavailable }, the same answer the
 * whole-row read gave; any read error (a stamp, a row, the holds) is `unavailable`, which pauses the improvement claims.
 */
export async function evidenceVerdicts(db, questionIds, { cache = verdictCacheFor(db), now = Date.now, chunk = 300 } = {}) {
  const hashes = new Map();
  const unique = [...new Set(questionIds)];
  for (let i = 0; i < unique.length; i += chunk) {
    const part = unique.slice(i, i + chunk);
    const eligible = []; // [{ id, family, hash }]
    for (let j = 0; j < part.length; j += STAMP_CHUNK) {
      const ids = part.slice(j, j + STAMP_CHUNK);
      const stamp = await db.from('questions').select('id,updated_at').in('id', ids);
      if (stamp.error) return { hashes, unavailable: true };
      const deploy = deployNow();
      const misses = [];
      const stamps = new Map();
      for (const row of stamp.data || []) {
        stamps.set(row.id, row.updated_at ?? null);
        const hit = row.updated_at && deploy.snapshot ? cache.get(row.id, row.updated_at, deploy) : null;
        if (!hit) misses.push(row.id);
        else if (hit.eligible && hit.expiresAt !== null && now() < hit.expiresAt) eligible.push({ id: row.id, family: hit.family, hash: hit.hash });
      }
      if (!misses.length) continue;
      const read = await db.from('questions').select('*').in('id', misses);
      if (read.error) return { hashes, unavailable: true };
      for (const row of read.data || []) {
        const entry = entryOf(row, stamps.get(row.id) ?? null, deploy);
        if (entry.stamp && deploy.snapshot) cache.set(row.id, entry);
        if (entry.eligible) eligible.push({ id: row.id, family: entry.family, hash: entry.hash });
      }
    }
    let unheld;
    try { unheld = await excludeHeldFamilies(eligible.map((e) => ({ id: e.id, family_id: e.family })), db); } catch { return { hashes, unavailable: true }; }
    const keep = new Set(unheld.map((q) => q.id));
    for (const e of eligible) if (keep.has(e.id)) hashes.set(e.id, e.hash);
  }
  return { hashes, unavailable: false };
}
