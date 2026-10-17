// One client read of the study catalog (GET /api/study/catalog) for the places that only need the lessons: the lesson link under a
// mistake, Review's chapter rows, the repair entry and Practice's Concepts panel (LEARN-REVIEW-1017 5.11). Many rows on one page
// ask for the same subject, so one request is shared and a good answer is kept for FRESH_MS. A failed read is null (no lesson
// offered), never a claim that there is no lesson. `get` is the transport (the real fetch by default).
import { apiGet } from './fetcher.js';

export const FRESH_MS = 5 * 60 * 1000;
const cache = new Map(); // subject|'all' -> { at, value } | { inflight }

export function readCatalog({ subject = null, force = false, get = apiGet } = {}) {
  const key = subject || 'all';
  const hit = cache.get(key);
  if (!force && hit?.value !== undefined && Date.now() - hit.at < FRESH_MS) return Promise.resolve(hit.value);
  if (hit?.inflight) return hit.inflight;
  const inflight = Promise.resolve().then(() => get(`/api/study/catalog${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`)).then(
    (data) => (data && Array.isArray(data.units) ? data : null),
    () => null,
  ).then((value) => { cache.set(key, value === null ? { at: Date.now() - FRESH_MS + 15000, value } : { at: Date.now(), value }); return value; });
  cache.set(key, { ...(hit || {}), inflight });
  return inflight;
}

/** Test seam. */
export function resetCatalogRead() { cache.clear(); }
