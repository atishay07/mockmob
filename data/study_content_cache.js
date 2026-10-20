// Published study content, read once and kept (egress item A2, 20 Oct 2026). No 'server-only' and no alias imports:
// the database is passed in, so node:test can load it.
//
// study_units and study_cards are published content: the same rows for every student, changed only by an owner
// action. Reading all of them on every Today, Review, lesson and card answer was ~118 MB a day for four people.
// This keeps the RAW rows in memory (never per-user data) and leaves the release.json proof and the hash filter to
// the caller, which still runs them on every call exactly as before; only where the rows come from changes.
//
//  - units: reused for TTL_MS. After that ONE cheap probe (id, version, content_hash, ~3 KB) runs and the full rows
//    are reloaded only when the set of id@version@hash changed. A quarantine or a new version flips the probe, so
//    it takes effect within about a minute. A hard maximum age forces a full reload anyway.
//  - cards: the same, keyed by the sorted unit-id list plus the units signature, at most MAX_CARD_ENTRIES keys.
//  - subset requests (a run's own units) are answered by filtering the memoised rows in JS: no query.
// Every caller gets its own copy (structuredClone), so one caller mutating a row never changes another's.
export const STUDY_CACHE_TTL_MS = 60 * 1000;
export const STUDY_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const STUDY_CACHE_MAX_CARD_ENTRIES = 8;

const sig = (rows, fields) => rows.map((row) => fields.map((f) => String(row[f])).join('@')).sort().join('|');
const unitsSignature = (rows) => sig(rows, ['id', 'version', 'content_hash']);
const cardsSignature = (rows) => sig(rows, ['id', 'version', 'content_hash', 'unit_id', 'unit_version']);

export function createStudyContentCache({ now = Date.now, ttlMs = STUDY_CACHE_TTL_MS, maxAgeMs = STUDY_CACHE_MAX_AGE_MS, maxCardEntries = STUDY_CACHE_MAX_CARD_ENTRIES } = {}) {
  let units = null; // { rows, signature, checkedAt, loadedAt }
  const cards = new Map(); // key -> { rows, signature, checkedAt, loadedAt }

  async function loadUnits(db) {
    const { data, error } = await db.from('study_units').select('*').eq('publication_state', 'published');
    if (error) throw error;
    const rows = data || [];
    const at = now();
    units = { rows, signature: unitsSignature(rows), checkedAt: at, loadedAt: at };
    return units;
  }

  async function currentUnits(db) {
    const at = now();
    if (units && at - units.checkedAt < ttlMs && at - units.loadedAt < maxAgeMs) return units;
    if (units && at - units.loadedAt < maxAgeMs) {
      const { data, error } = await db.from('study_units').select('id,version,content_hash').eq('publication_state', 'published');
      if (error) throw error;
      if (unitsSignature(data || []) === units.signature) { units.checkedAt = at; return units; }
    }
    return loadUnits(db);
  }

  /** All published unit rows, or only the named ones. Raw rows: the caller verifies them. */
  async function publishedUnitRows(db, unitIds = null) {
    const state = await currentUnits(db);
    const wanted = unitIds ? new Set(unitIds) : null;
    const rows = wanted ? state.rows.filter((row) => wanted.has(row.id)) : state.rows;
    return structuredClone(rows);
  }

  /** Raw card rows for the given unit ids. `unitIds` are the ids of the verified units of this request. */
  async function publishedCardRows(db, unitIds) {
    const ids = [...new Set(unitIds)].sort();
    if (!ids.length) return [];
    const unitState = await currentUnits(db);
    const key = `${unitState.signature}#${ids.join(',')}`;
    const at = now();
    let entry = cards.get(key);
    if (entry && at - entry.loadedAt >= maxAgeMs) { cards.delete(key); entry = null; }
    if (entry && at - entry.checkedAt < ttlMs) return structuredClone(entry.rows);
    if (entry) {
      const { data, error } = await db.from('study_cards').select('id,version,content_hash,unit_id,unit_version').in('unit_id', ids);
      if (error) throw error;
      if (cardsSignature(data || []) === entry.signature) { entry.checkedAt = at; return structuredClone(entry.rows); }
    }
    const { data, error } = await db.from('study_cards').select('*').in('unit_id', ids);
    if (error) throw error;
    const rows = data || [];
    cards.delete(key);
    cards.set(key, { rows, signature: cardsSignature(rows), checkedAt: at, loadedAt: at });
    while (cards.size > maxCardEntries) cards.delete(cards.keys().next().value);
    return structuredClone(rows);
  }

  return { publishedUnitRows, publishedCardRows, clear() { units = null; cards.clear(); }, _size: () => ({ units: units ? units.rows.length : 0, cardKeys: cards.size }) };
}

/**
 * The student's ACTIVE study runs only (the only ones studyRecord uses), newest first. Replaces "newest 100 runs of
 * any state", which also missed an active run older than the newest 100.
 */
export async function readActiveStudyRuns(db, userId) {
  const { data, error } = await db.from('study_runs').select('id,mode,content,projection,updated_at').eq('user_id', userId).eq('projection->>state', 'active').order('updated_at', { ascending: false });
  return { data, error };
}
