// The run's and the feed's own address (R4 client-code#1). PURE, so node --test holds it (runView.test.mjs).
// A run or a feed that starts or resumes in place (an end key, Continue, Keep going, Try again) writes its own address, so a
// reload or Back lands in the same run: ?run=<id> with the chapter, the minutes and the kind, never end=1 or fresh (both are
// for the link that started it, not for the run it became). The href itself is links.run / links.feed (links.js).

/**
 * What links.run takes for a run started or resumed in place: the run by its id, so a reload reads it with getRun. The
 * chapter, minutes and kind stay for the page's own reading; leave-outs, card ids, end and fresh are dropped (the server's
 * run holds them). Null when the server sent no id.
 */
export function runAddressParams(run, params = {}) {
  if (!run?.id) return null;
  return { chapterKey: run.chapter?.key || params.chapterKey || null, minutes: Number(params.minutes) || 10, kind: run.kind || params.kind || 'mix', runId: run.id };
}

/** The same for a feed: [chapterKey, minutes, { runId }] for links.feed, never end=1. */
export function feedAddressParams(run, { chapterKey = null, minutes = 10 } = {}) {
  if (!run?.id) return null;
  return [run.chapter?.key || chapterKey, Number(minutes) || 10, { runId: run.id }];
}

/** Whether the address in the bar already is `href` (path and query, order-insensitive). */
export function sameAddress(current, href) {
  if (!current || !href) return false;
  try {
    const a = new URL(current, 'http://x');
    const b = new URL(href, 'http://x');
    if (a.pathname !== b.pathname) return false;
    const norm = (u) => [...u.searchParams.entries()].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join('&');
    return norm(a) === norm(b);
  } catch { return false; }
}
