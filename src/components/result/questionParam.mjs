// ?q=N on the result page (Today's weak chapters, Last paper and the reel's last key link to /result/{id}?q=N). PURE.
// N is the question's number on the paper, counted from 1. Anything else (missing, not a whole number, 0, past the last
// question) is no question, and the page opens as usual. The link only opens and scrolls to the mistake's row: it never
// starts a repair, which can spend an AI credit and is always the student's own press.

/** The question number named in a query string, or null when it names none on a paper of `total` questions. */
export function questionFromSearch(search, total) {
  const raw = new URLSearchParams(String(search || '')).get('q');
  if (raw == null || !/^[1-9]\d{0,3}$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isInteger(total) && total > 0 && n <= total ? n : null;
}
