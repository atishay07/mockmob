// Where the v1 Key cards routes go while Learn v2 is on (NEXT_PUBLIC_LEARN2 = 'on'; LK23, BUILD-1101 R2). A plain module, not a route:
// the two pages call it, and data/tests/learn_integration.test.mjs checks every target. With the flag off the pages never call it.
//   /cards                       -> /learn                      (?subject= kept)
//   /cards/<chapter>             -> /learn/c/<chapter>/cards
//   /cards/<chapter>?mode=study  -> /learn/c/<chapter>          (the chapter page, where Study these starts)
//   /cards/<chapter>?mode=last   -> /learn/c/<chapter>/cards?f=must   (also spelled last-look)
// An unknown chapter key goes to /learn, never to a chapter page that cannot exist.
import { chapterKeyOf, one } from '../learn/params.js';

const enc = encodeURIComponent;
const SUBJECT = /^[a-z0-9_]{1,40}$/i;

/** The Learn v2 home for /cards, keeping a well-formed subject. */
export function cardsHomeTarget(searchParams = {}) {
  const subject = one(searchParams?.subject);
  return SUBJECT.test(subject) ? `/learn?subject=${enc(subject)}` : '/learn';
}

/** The Learn v2 page for /cards/<chapter> and its ?mode=. `chapter` is the (decoded) path segment. */
export function cardsDeckTarget(chapter, searchParams = {}) {
  const key = chapterKeyOf(chapter);
  if (!key) return '/learn';
  const mode = one(searchParams?.mode);
  if (mode === 'study') return `/learn/c/${enc(key)}`;
  if (mode === 'last' || mode === 'last-look') return `/learn/c/${enc(key)}/cards?f=must`;
  return `/learn/c/${enc(key)}/cards`;
}
