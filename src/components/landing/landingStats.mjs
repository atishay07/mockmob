import { practisedCounts } from './liveCount.mjs';

// The landing page's one read of the stored question counts. /api/stats serves the stored
// public_inventory_snapshot row (recounted once a day, never per request), and every number the page shows about
// the bank is taken from this single response: the hero's live line, the stats band and the subject lineup's own
// counts. One request per page load, so no two lines can be built from two different snapshots (the stored row
// is replaced by each daily recount, and a server holds the one it read for up to five minutes).

let request = null;

/** The /api/stats body, or null when it is unavailable. Every caller on the page shares one request. */
export function loadLandingStats(fetchImpl = globalThis.fetch) {
  if (!request) {
    request = Promise.resolve()
      .then(() => fetchImpl('/api/stats'))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => (data && data.state !== 'unavailable' ? data : null))
      .catch(() => null);
  }
  return request;
}

/** { questions, subjects } for the practised subjects, from that same one response; null when it is unavailable. */
export async function loadPractisedCounts(fetchImpl) {
  const data = await loadLandingStats(fetchImpl);
  return practisedCounts(data?.subjectCounts);
}

/** Tests only: forget the shared request so the next call asks again. */
export function forgetLandingStats() {
  request = null;
}
