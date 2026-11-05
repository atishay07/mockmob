// The live question bank for the home page, fetched once per page view and shared: the hero's bank line (QuestionBankLine),
// Mobi's third tap line (HeroMobi) and the plan card's counts (PlanCounts, R3-D7) read the same /api/stats answer. Only the
// real stored inventory counts (state 'available', a positive bankSize); anything else is null and the copy drops the number.
let pending = null;

/** { bankSize, subjects } from /api/stats (subjects: the public subjects that hold a question today), or null. */
export function loadPublicStats() {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return Promise.resolve(null);
  pending ||= fetch('/api/stats')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!(data && data.state === 'available' && Number.isFinite(data.bankSize) && data.bankSize > 0)) return null;
      const subjects = Number.isInteger(data.publicSubjectCount) && data.publicSubjectCount > 0 ? data.publicSubjectCount : null;
      return { bankSize: data.bankSize, subjects };
    })
    .catch(() => { pending = null; return null; });
  return pending;
}

export function loadBankSize() {
  return loadPublicStats().then((stats) => stats?.bankSize ?? null);
}
