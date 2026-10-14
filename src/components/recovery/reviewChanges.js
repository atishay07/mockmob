// What changed on Review since the student last looked: new saved sessions and the change in questions to review.
// Stored per browser in localStorage, always inside try/catch (private windows and blocked storage must not break
// the page). The first visit records a baseline and animates nothing; nothing animates when nothing changed.
export const REVIEW_SEEN_KEY = 'mm:review-seen:v1';

function readSeen(storage) {
  try {
    const raw = storage?.getItem(REVIEW_SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || !Array.isArray(parsed.ids) || !Number.isFinite(parsed.toReview)) return null;
    return parsed;
  } catch { return null; }
}

/** Compares the sessions on screen with the last look, then records this look. */
export function reviewChanges(sessions, storage) {
  const ids = sessions.map(s => s.id).filter(Boolean);
  const toReview = sessions.reduce((sum, s) => sum + (s.mistakes || 0), 0);
  const prev = readSeen(storage);
  try { storage?.setItem(REVIEW_SEEN_KEY, JSON.stringify({ ids: ids.slice(0, 200), toReview })); } catch { /* This look is not remembered; the page still works. */ }
  if (!prev) return { fresh: new Set(), fromToReview: toReview, changed: false };
  const seen = new Set(prev.ids);
  const fresh = new Set(ids.filter(id => !seen.has(id)));
  return { fresh, fromToReview: prev.toReview, changed: fresh.size > 0 || prev.toReview !== toReview };
}
