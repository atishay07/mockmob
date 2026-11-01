// The live question bank size for the home page, fetched once per page view and shared: the hero's bank line
// (QuestionBankLine) and Mobi's third tap line (HeroMobi) read the same /api/stats answer. Only the real stored
// inventory counts (state 'available', a positive bankSize); anything else is null and the copy drops the number.
let pending = null;

export function loadBankSize() {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return Promise.resolve(null);
  pending ||= fetch('/api/stats')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => (data && data.state === 'available' && Number.isFinite(data.bankSize) && data.bankSize > 0 ? data.bankSize : null))
    .catch(() => { pending = null; return null; });
  return pending;
}
