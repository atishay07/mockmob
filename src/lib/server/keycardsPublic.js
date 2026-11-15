import 'server-only';
// The public Key card decks, wired to the app's own Key cards service (keycardsHttp.js keycardsService: the same decks, the same
// syllabus, the same published() with its suspension rules). keycardsPublicLoad.js holds the logic and says what it reads.
import { SUBJECT_PAGES } from '@/lib/subjectPages.mjs';
import { decksOnce, keyCardsEnabled } from '@/lib/server/keycards';
import { keycardsService } from '@/lib/server/keycardsHttp';
import { loadKeycardsSyllabus } from '@/lib/server/keycardsSyllabus';
import { createPublicDecks } from '@/lib/server/keycardsPublicLoad';

export const publicKeyCards = createPublicDecks({
  enabled: () => keyCardsEnabled(),
  decks: () => decksOnce(),
  service: () => keycardsService(),
  syllabus: () => loadKeycardsSyllabus(),
  pages: SUBJECT_PAGES,
});
