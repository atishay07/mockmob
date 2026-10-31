// ?decks=real in the development preview: the Key cards requests go to the dev server's real-deck source
// (/preview/arena/realdeck, src/lib/server/keycardsPreview.js), which answers them with the real handlers over the bundled
// decks and an in-memory student. This file only forwards requests: no deck or link file is ever imported into the browser.
//   &student=commerce (default) | science | new    &plan=free | pro    &kcs=<name> a fresh student per name
//   &kcline=<subject> the subject "The line you needed" links its real cards from (default: the student's first with links)
//   &kcfirst=<card id> that card leads its chapter's deck (worst-case looks in Read, Study and Last look)
//   &kclag=<ms> the Key cards home read (GET /api/keycards) answers that many milliseconds late (0 to 5000), so a slow
//   connection can be reproduced, for example the "Your part" picker's save-then-reread. Development preview only.
const isKeycardsPath = (p) => p.startsWith('/api/keycards') || p === '/api/me/chapters' || p === '/api/me/subject-options';

const KCLAG_MAX = 5000;
/**
 * The delay (ms) &kclag= puts on the Key cards home read, 0 for any other request. It exists only in the development
 * preview: this file is reached from /preview/arena alone (404 in production), and it is 0 in a production build besides.
 */
export function kcLagMs(url, method, fixture, env = process.env) {
  if (env.NODE_ENV === 'production') return 0;
  if (url.pathname !== '/api/keycards' || String(method).toUpperCase() !== 'GET') return 0;
  const ms = Math.round(Number(fixture.get('kclag')));
  return Number.isFinite(ms) && ms > 0 ? Math.min(ms, KCLAG_MAX) : 0;
}
export const later = (ms, make) => new Promise((resolve) => { setTimeout(resolve, ms); }).then(make);

export const realDecksOn = (fixture) => fixture.get('decks') === 'real';

function sourceHref(to, fixture, query) {
  const q = new URLSearchParams(query);
  q.set('_to', to);
  q.set('_plan', fixture.get('plan') === 'pro' ? 'pro' : 'free');
  q.set('_student', fixture.get('student') || 'commerce');
  q.set('_s', fixture.get('kcs') || 'default');
  if (fixture.get('kcline')) q.set('_line', fixture.get('kcline'));
  if (fixture.get('kcfirst')) q.set('_first', fixture.get('kcfirst'));
  return `/preview/arena/realdeck?${q}`;
}

/** The forwarded request's promise, or null when real decks are off or the path is not a Key cards route. */
export function realDeckFetch(url, method, init, fixture, real) {
  if (!realDecksOn(fixture) || !isKeycardsPath(url.pathname)) return null;
  const lag = kcLagMs(url, method, fixture);
  if (lag) return later(lag, () => realDeckFetch(url, method, init, new URLSearchParams([...fixture].filter(([k]) => k !== 'kclag')), real));
  return real(sourceHref(url.pathname, fixture, url.searchParams), {
    method, cache: 'no-store', headers: { 'Content-Type': 'application/json' }, ...(method === 'GET' ? {} : { body: init?.body }),
  });
}

/** Revise's Key card items ({ kind: 'keycard', cardId, card }) from the real queue, or [] when the source fails. */
export async function realDeckReviseItems(fixture, real, limit = 20) {
  try {
    const res = await real(sourceHref('revise', fixture, { limit: String(limit) }), { cache: 'no-store' });
    if (!res.ok) return [];
    return (await res.json())?.items || [];
  } catch {
    return [];
  }
}
