// Public Key card decks (/key-cards and /key-cards/<subject>/<chapter>): the pure model. No I/O, no React, no '@/' imports, so
// node --test drives it with real or fake decks (src/lib/keycardsPublic.test.mjs). The server (src/lib/server/keycardsPublic.js)
// hands it the app's own published cards, so the public page shows exactly what a Free account is given:
//   * only chapters in the live syllabus (retired chapters and cards outside it never appear),
//   * only published cards (the served decks, minus cards suspended for everyone by reports: createKeycards().published()),
//   * of each chapter, only its taste (data/keycards.js tasteIds: the first five Must-know cards in book order), whole;
//   * every other card of the chapter only as deckView's locked stub: its kind label, never its words, counted by kind.
// A chapter with fewer taste cards than five shows what it has; a chapter with none has no page.
//
// Addresses: the subject is the public site's own slug (/cuet/<slug>, src/lib/subjectPages.mjs); the chapter is its key without
// the subject ("accountancy.partnership-fundamentals" -> "partnership-fundamentals"). A chapter key is the identity every
// student's Key cards rows are stored under, so it never changes, and keys are unique, so two chapters of one subject can never
// share a slug (buildPublicDecks still refuses a duplicate, loudly).
import { KIND_LABELS, deckView, tasteIds } from '../../data/keycards.js';

export const KEY_CARDS_PATH = '/key-cards';

/** The fields a card is drawn from (CardFace, NcertText, CardSource, TexHtml): nothing else of a deck's record leaves the server. */
export const PUBLIC_CARD_FIELDS = Object.freeze(['id', 'subject', 'chapterKey', 'kind', 'front', 'back', 'blanks', 'note', 'source', 'texHtml', 'importance']);

const CHAPTER_KEY = /^([a-z0-9_]+)\.([a-z0-9]+(?:-[a-z0-9]+)*)$/;

/** "partnership-fundamentals" from "accountancy.partnership-fundamentals"; null for anything that is not a chapter key. */
export function chapterSlugOf(chapterKey) {
  const m = CHAPTER_KEY.exec(String(chapterKey ?? ''));
  return m ? m[2] : null;
}

/** The public page of a chapter: /key-cards/<subject slug>/<chapter slug>. */
export const deckPath = (subjectSlug, chapterSlug) => `${KEY_CARDS_PATH}/${subjectSlug}/${chapterSlug}`;
/** A subject's chapters on the index. */
export const subjectAnchor = (subjectSlug) => `${KEY_CARDS_PATH}#${subjectSlug}`;
/** The chapter's deck in the app (src/app/(app)/cards/[chapter]; Learn v2 sends it on to /learn/c/<key>/cards). */
export const appDeckPath = (chapterKey) => `/cards/${chapterKey}`;

/** A card as the public page sends it: the drawn fields only, never an empty one. */
export function publicCard(card) {
  const out = {};
  for (const field of PUBLIC_CARD_FIELDS) if (card?.[field] !== undefined && card?.[field] !== null) out[field] = card[field];
  return out;
}

/**
 * The locked cards as the Free deck shows them, tallied by kind: [{ kind, label, count }], most first, then in the order the
 * kinds are listed (KIND_LABELS). `stubs` are deckView's locked stubs ({ kind, label, locked: true }).
 */
export function lockedKinds(stubs) {
  const order = Object.keys(KIND_LABELS);
  const tally = new Map();
  for (const s of stubs || []) {
    if (!s?.locked) continue;
    const kind = String(s.kind || 'card');
    const row = tally.get(kind) || { kind, label: s.label || KIND_LABELS[kind] || 'Card', count: 0 };
    row.count += 1;
    tally.set(kind, row);
  }
  const rank = (kind) => { const i = order.indexOf(kind); return i < 0 ? order.length : i; };
  return [...tally.values()].sort((a, b) => b.count - a.count || rank(a.kind) - rank(b.kind));
}

/**
 * One chapter's public model, or null when it has no free card. `cards` are the chapter's published cards (any order).
 * { key, slug, title, unit, ncert, total, mustKnow, open: [publicCard], locked: [{ kind, label, count }], lockedCount }
 */
export function chapterDeck(chapter, cards) {
  const slug = chapterSlugOf(chapter?.key);
  if (!slug || chapter?.retired) return null;
  const list = (cards || []).filter((c) => c?.id && c.chapterKey === chapter.key);
  // deckView on the Free plan: the taste cards whole, in book order, the rest as locked stubs (the app's own function).
  const view = deckView(list, { isPro: false });
  const open = view.filter((c) => !c.locked);
  if (!open.length) return null;
  const stubs = view.filter((c) => c.locked);
  return {
    key: chapter.key,
    slug,
    title: chapter.title || chapter.name || slug,
    unit: chapter.unit || null,
    ncert: chapter.ncert?.book ? { book: chapter.ncert.book, chapter: Number.isFinite(Number(chapter.ncert.chapter)) ? Number(chapter.ncert.chapter) : null } : null,
    total: list.length,
    mustKnow: list.filter((c) => c.importance === 'must').length,
    open: open.map(publicCard),
    locked: lockedKinds(stubs),
    lockedCount: stubs.length,
  };
}

/**
 * Every public deck. Pure: the caller hands in what the app serves.
 *   pages        the public subject pages, in site order: [{ id, slug, name, stream }] (src/lib/subjectPages.mjs SUBJECT_PAGES)
 *   served       the subject ids with a served deck (loadDecks().bySubject keys); a subject without one has no page
 *   unitsFor     (subject) -> [{ unit, chapters: [{ key, title, name, unit, ncert, retired }] }] (the syllabus, no option: every chapter)
 *   cardsOf      (subject) -> the subject's published cards (createKeycards().published().cardsOf)
 * Returns { subjects: [{ id, slug, name, stream, chapters, open, total }], totals: { subjects, chapters, cards }, find(subjectSlug, chapterSlug) }.
 */
export function buildPublicDecks({ pages = [], served = [], unitsFor, cardsOf }) {
  const has = new Set(served);
  const subjects = [];
  const bySlug = new Map();
  for (const page of pages) {
    if (!has.has(page.id)) continue;
    const cards = cardsOf(page.id) || [];
    const chapters = [];
    const seen = new Set();
    for (const unit of unitsFor(page.id) || []) {
      for (const chapter of unit.chapters || []) {
        if (seen.has(chapter.key)) continue;
        seen.add(chapter.key);
        const deck = chapterDeck({ ...chapter, unit: chapter.unit || unit.unit }, cards);
        if (!deck) continue;
        const address = `${page.slug}/${deck.slug}`;
        if (bySlug.has(address)) throw new Error(`[key-cards] two chapters share the address ${address}`);
        const full = { ...deck, subject: { id: page.id, slug: page.slug, name: page.name }, path: deckPath(page.slug, deck.slug), appPath: appDeckPath(deck.key) };
        bySlug.set(address, full);
        chapters.push(full);
      }
    }
    if (!chapters.length) continue;
    subjects.push({
      id: page.id, slug: page.slug, name: page.name, stream: page.stream || null, chapters,
      open: chapters.reduce((n, c) => n + c.open.length, 0), total: chapters.reduce((n, c) => n + c.total, 0),
    });
  }
  const totals = {
    subjects: subjects.length,
    chapters: subjects.reduce((n, s) => n + s.chapters.length, 0),
    cards: subjects.reduce((n, s) => n + s.open, 0),
  };
  return {
    subjects,
    totals,
    find: (subjectSlug, chapterSlug) => bySlug.get(`${subjectSlug}/${chapterSlug}`) || null,
    params: () => [...bySlug.values()].map((c) => ({ subject: c.subject.slug, chapter: c.slug })),
  };
}

/** The empty model (Key cards switched off, or nothing served): no pages, no links. */
export const NO_DECKS = Object.freeze(buildPublicDecks({ pages: [], served: [], unitsFor: () => [], cardsOf: () => [] }));

// ---------------------------------------------------------------- words a search result shows (seoMetadata)

/** "Accountancy Part 1, chapter 1" (the NCERT book and chapter), or null for a chapter with no book (English). */
export function bookRef(ncert) {
  if (!ncert?.book) return null;
  return ncert.chapter !== null && ncert.chapter !== undefined ? `${ncert.book}, chapter ${ncert.chapter}` : ncert.book;
}

/** The page title: "Accounting for Partnership: Basic Concepts, CUET Accountancy Key cards | MockMob". */
export const chapterTitle = (deck) => `${deck.title}, CUET ${deck.subject.name} Key cards | MockMob`;

/** The description: what the page holds, in numbers read from the deck. */
export function chapterDescription(deck) {
  const n = deck.open.length;
  const from = bookRef(deck.ncert) ? ` from NCERT ${bookRef(deck.ncert)}` : '';
  const free = n >= deck.total ? `All ${deck.total} Key cards` : `${n} of the ${deck.total} Key cards`;
  return `${free} for ${deck.title}${from}, free to read with no account. Read the front, say the answer, turn the card over. CUET ${deck.subject.name}.`;
}
