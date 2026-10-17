// One client read of Review's record (GET /api/me/review) shared by everything that needs a number from it: the Review badge
// on the dock and the sidebar (Revise due today), Concepts ("Where you lose marks", the lesson to read next) and Practice's
// Concepts panel. LEARN-REVIEW-1017 section 5.12 and packet P-LR3.
//
// Why it is shared and cached: the endpoint joins the student's papers, repairs and Revise cards, so it is the heaviest read on
// the site. A page that only wants a count must not re-run it on every navigation. One in-flight request is shared, a good
// answer is kept for FRESH_MS, a failed one for FAILED_MS (so a broken read is not hammered), and anything that changes the
// record (a repair, a check, a Revise answer, a paper) calls `invalidateReview()` or `setReviseDue(total)`:
//   invalidateReview()          forgets the answer, so the next reader asks again, and tells the open readers to ask now
//   setReviseDue(total)         (src/lib/reviseDue.js) "Revise has {total} due today" as the server confirmed it; the badge ticks to it without a read
// A failed read is `{ state: 'unavailable' }`, never an empty record: callers must not draw "nothing yet" from it (L12).
import { useEffect, useMemo, useState } from 'react';
import { apiGet } from './fetcher.js';
import { getReviseDue, setReviseDue, useReviseDue } from './reviseDue.js';

export const FRESH_MS = 5 * 60 * 1000;
export const FAILED_MS = 30 * 1000;

let cache = null; // { at, body, ok }
let inflight = null;
const usable = (now = Date.now()) => Boolean(cache) && now - cache.at < (cache.ok ? FRESH_MS : FAILED_MS);

/** Reads the record. `get` is the transport (the real fetch by default; the library's preview passes its own). */
export function readReview({ force = false, get = apiGet } = {}) {
  if (!force && usable()) return Promise.resolve(cache.body);
  if (inflight) return inflight;
  const request = Promise.resolve().then(() => get('/api/me/review')).then(
    (body) => ({ at: Date.now(), body: body && typeof body === 'object' ? body : { state: 'unavailable' }, ok: Boolean(body) && body.state !== 'unavailable' }),
    () => ({ at: Date.now(), body: { state: 'unavailable' }, ok: false }),
  ).then((next) => { if (inflight === request) { cache = next; inflight = null; if (next.ok && next.body?.reviseDue && (force || getReviseDue() === undefined)) setReviseDue(next.body.reviseDue.total); } return next.body; });
  inflight = request;
  return request;
}

/** Forgets the answer and makes every open reader ask again. Call it after anything that changes the record. */
export function invalidateReview() {
  cache = null;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('mm:review-changed'));
}

/** undefined while the first read is in flight, then the body ({ state: 'ready' | 'empty' | 'unavailable', ... }). `enabled: false` never reads. */
export function useReview({ enabled = true, get } = {}) {
  const due = useReviseDue();
  const [kept, setBody] = useState(() => (enabled && usable() ? cache.body : undefined));
  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    const ask = (force) => readReview({ force, get }).then((next) => { if (live) setBody(next); });
    ask(false);
    const again = () => ask(true);
    window.addEventListener('mm:review-changed', again);
    return () => { live = false; window.removeEventListener('mm:review-changed', again); };
  }, [enabled, get]);
  // Revise's own count (confirmed answers) is newer than the record's: one number on the page, whichever read it.
  return useMemo(() => (kept?.state === 'ready' && kept.reviseDue && Number.isFinite(due) && due !== kept.reviseDue.total ? { ...kept, reviseDue: { ...kept.reviseDue, total: due } } : kept), [kept, due]);
}

/**
 * The Review badge: how many things Revise has due today (LEARN-REVIEW-1017 5.12), null until the record is known, and null
 * when nothing is due, so the badge is absent rather than "0". Open mistakes are a backlog and are never counted here.
 * The read waits for the page to settle (idle time, or 1.5 s) so a badge never competes with the page the student came for.
 */
export function useReviseBadge({ enabled = true, get } = {}) {
  const due = useReviseDue();
  useEffect(() => {
    if (!enabled) return undefined;
    let timer = 0;
    let idle = 0;
    const go = () => { if (getReviseDue() === undefined) readReview({ get }); };
    if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(go, { timeout: 2500 }); else timer = window.setTimeout(go, 1500);
    const again = () => readReview({ force: true, get });
    window.addEventListener('mm:review-changed', again);
    return () => { if (idle) window.cancelIdleCallback?.(idle); window.clearTimeout(timer); window.removeEventListener('mm:review-changed', again); };
  }, [enabled, get]);
  return enabled && Number.isFinite(due) && due > 0 ? due : null;
}

/** Test seam: the module forgets everything. */
export function resetReviewRead() { cache = null; inflight = null; setReviseDue(undefined); }
