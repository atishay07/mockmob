// The public Key card decks on the server: the read behind /key-cards and /key-cards/<subject>/<chapter>. No 'server-only' and
// no '@/' imports, so node --test drives it with a fake database (data/tests/keycards_public.test.mjs); keycardsPublic.js wires
// the real service.
//
// Cost (owner rule: no database read on every visit): the pages are static (generateStaticParams at build) and regenerate at
// most hourly (revalidate). Building the model reads the database once: the app's own published() (src/lib/server/keycards.js),
// whose suspended-card set is one read of the key_card_suspended view, plus that view's few reporters only when a card has
// three reports or more, and is kept for five minutes in the process. Every page built in that window shares it, and the model
// built from it is kept until published() hands back a new set. The card words themselves are the bundled deck files.
//
// Safe failure: a page must never be rebuilt empty over a good one. With no deck file readable (a function bundle without the
// data files) or the read failing twice, this throws; Next keeps serving the last page it built and tries again later.
import { buildPublicDecks, NO_DECKS } from '../keycardsPublic.mjs';

const pause = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/**
 * deps:
 *   enabled     the Key cards switch (keyCardsEnabled()); off: no public deck at all
 *   decks       loadDecks() result (decksOnce())
 *   service     () => the Key cards service (createKeycards), whose published() applies the suspension rules
 *   syllabus    () => the syllabus adapter (loadKeycardsSyllabus())
 *   pages       the public subject pages (SUBJECT_PAGES)
 *   retries     extra tries of published() after a failure (default 1), `wait` ms apart
 */
export function createPublicDecks({ enabled, decks, service, syllabus, pages, retries = 1, wait = 400 }) {
  let memo = { pub: null, value: null };
  return async function publicDecks() {
    if (!enabled()) return NO_DECKS;
    const served = decks();
    if (!served?.bySubject?.size) throw Object.assign(new Error('KEY_CARDS_DECKS_UNREADABLE'), { code: 'KEY_CARDS_DECKS_UNREADABLE' });
    const svc = await service();
    let pub = null;
    for (let attempt = 0; ; attempt += 1) {
      try {
        pub = await svc.published();
        break;
      } catch (error) {
        if (attempt >= retries) throw error;
        await pause(wait);
      }
    }
    if (memo.pub === pub && memo.value) return memo.value;
    const syl = await syllabus();
    const value = buildPublicDecks({
      pages,
      served: [...served.bySubject.keys()],
      // No saved option for a visitor: every chapter of the syllabus (both parts of Accountancy, both sections of Mathematics).
      unitsFor: (subject) => syl.unitsFor(subject, {}),
      cardsOf: (subject) => pub.cardsOf(subject),
    });
    memo = { pub, value };
    return value;
  };
}
