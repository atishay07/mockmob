// Key cards on the home page (R3-D10, owner LK112, 5 Nov 2026): the five real cards the section plays, read on the server.
// The cards are the ones the app serves: src/lib/server/keycards.js loadDecks (the bundled decks, sha256-checked against the
// manifest, Must-know tiers applied), so the page never invents a card's words and never shows a deck the app has switched off.
// Every pick is a Free taste card (data/keycards.js tasteIds: the first Must-know cards of its chapter), so "Sign up free to
// keep going" is literal: a free account opens these very cards (keyCards.test.mjs pins it).
// Server only (it reads files): page.js calls keyCardsDemo() once at build and hands plain props to KeyCardsDemo.jsx; nothing
// here reaches the browser bundle. A deck that is missing or changed simply drops its cards; no card at all, no section.
import { loadDecks } from '../../lib/server/keycards.js';
import { KEYCARD_RULES, KIND_LABELS, schedule, tasteIds } from '../../../data/keycards.js';
import { backLine, returnWords, WORDS } from '../../../data/learn/words.js';
import { subjectArt, subjectArtSrc, subjectArtSrcSet } from '../../../data/subject_art.mjs';

/**
 * The five, in the order they play: three Accountancy (commerce first, L-023; Part B's Analysis of Financial Statements among
 * them, R3-D11) and two English, short enough to read on a 360 px phone. Ids only: the words come from the decks.
 */
export const KEY_CARD_PICKS = Object.freeze([
  'kc.accountancy.debentures.def-debenture',
  'kc.english.vocabulary.word-concise',
  'kc.accountancy.cash-flow-statement.def-cash-as3',
  'kc.english.correct-word-usage.usage-principal-principle',
  'kc.accountancy.admission-of-partner.formula-sacrifice-formula',
]);

const SUBJECT_NAMES = Object.freeze({ accountancy: 'Accountancy', english: 'English' });
const subjectName = (id) => SUBJECT_NAMES[id] || String(id || '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

// The front without the kind word it repeats ("Formula: the sacrifice by a partner." under "Formula"), first letter raised:
// the app's cardFace rule (src/components/keycards/kinds.js) for the kinds these picks use.
const KIND_PREFIX = Object.freeze({ formula: /^formula\s*:\s*/i, rule: /^rule\s*:\s*/i });
const faceOf = (card) => {
  const front = String(card.front || '').replace(KIND_PREFIX[card.kind] || /^$/, '').trim();
  return front.charAt(0).toUpperCase() + front.slice(1);
};

// The book line the app prints under an NCERT back (kinds.js sourceLine): "Accountancy Part 2, Ch 2, p. 75".
const BOOK_BY_CODE = Object.freeze({ leac1: 'Accountancy Part 1', leac2: 'Accountancy Part 2', lebs1: 'Business Studies Part 1', lebs2: 'Business Studies Part 2' });
export function sourceOf(source) {
  if (!source || typeof source !== 'object') return null;
  if (source.kind === 'wordnet') return 'Meaning from WordNet';
  if (source.kind !== 'ncert') return null;
  const code = typeof source.code === 'string' ? source.code.toLowerCase().slice(0, 5) : '';
  const book = BOOK_BY_CODE[code] || (typeof source.book === 'string' ? source.book.replace(/\s+:/g, ':').trim() : null);
  const num = (v) => (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
  const parts = [book, num(source.chapterNo) !== null ? `Ch ${num(source.chapterNo)}` : null, num(source.page) !== null ? `p. ${num(source.page)}` : null];
  return parts.filter(Boolean).join(', ') || null;
}

/** One card as the client draws it: words only, plus its subject's art and light. */
export function slimCard(card) {
  const art = subjectArt(card.subject);
  return {
    id: card.id,
    subject: card.subject,
    subjectName: subjectName(card.subject),
    label: KIND_LABELS[card.kind] || 'Card',
    must: card.importance === 'must',
    front: faceOf(card),
    back: String(card.back || ''),
    // The app's "In short" line under the back (KeyCard.jsx InShort): labelled for a book card, plain for the English deck's own.
    note: typeof card.note === 'string' && card.note.trim() ? card.note.trim() : null,
    noteLabel: card.source?.kind === 'ncert' && typeof card.note === 'string' && card.note.trim() ? 'In short' : null,
    source: sourceOf(card.source),
    art: art ? { src: subjectArtSrc(art, 512), srcSet: subjectArtSrcSet(art), width: art.width, height: art.height, light: { night: art.light.night, day: art.light.day } } : null,
  };
}

/** The picks found in the served decks, in pick order. `decks` is loadDecks()'s result. */
export function pickKeyCards(decks, picks = KEY_CARD_PICKS) {
  return picks.map((id) => decks?.byId?.get(id)).filter((c) => c && typeof c.front === 'string' && typeof c.back === 'string').map(slimCard);
}

/**
 * The three keys with when each brings a new card back, from the scheduler the app rates with (FSRS over the exam horizon),
 * in the app's words: "back tomorrow", "back in 3 days", "back in 8 days" (data/learn/words.js returnWords and backLine).
 */
export function ratingKeys(at = Date.now()) {
  return [
    { rating: KEYCARD_RULES.ratings.missed, label: WORDS.missedIt },
    { rating: KEYCARD_RULES.ratings.gotIt, label: 'Got it' },
    { rating: KEYCARD_RULES.ratings.easy, label: 'Easy' },
  ].map((key) => ({ ...key, when: backLine(returnWords(schedule(null, key.rating, at).interval_days)) }));
}

/** The served bank: every card of every deck that passed its check, and how many subjects. */
export function bankOf(decks) {
  let cards = 0;
  for (const { cards: list } of decks?.bySubject?.values?.() || []) cards += Array.isArray(list) ? list.length : 0;
  return { cards, subjects: decks?.bySubject?.size || 0, taste: KEYCARD_RULES.free.tastePerChapter };
}

/** Is every pick a Free taste card in its served deck? (The test's check, here so it reads the same decks the page does.) */
export function picksAreFree(decks, picks = KEY_CARD_PICKS) {
  return picks.every((id) => {
    const card = decks?.byId?.get(id);
    if (!card) return false;
    const deck = decks.bySubject.get(card.subject)?.cards || [];
    return tasteIds(deck.filter((c) => c.chapterKey === card.chapterKey)).has(id);
  });
}

/**
 * What page.js renders: { cards, keys, bank } or null (no section) when no pick could be read. Reads the decks once, at build.
 * `decks` is for tests; `at` is the moment the keys' words are worked out for (their days do not depend on it until the horizon).
 */
export function keyCardsDemo({ decks, at = Date.now(), log = console.warn } = {}) {
  let served = decks;
  try {
    served = served || loadDecks({ log });
  } catch (error) {
    log(`[home key cards] decks unreadable: ${error?.message || error}`);
    return null;
  }
  const cards = pickKeyCards(served);
  if (!cards.length) return null;
  return { cards, keys: ratingKeys(at), bank: bankOf(served) };
}
