// Learn v2: the Must-know re-tier (B5, DESIGN-SPEC "B1-B8 still hold"; research docs/brain/learn-1031/understand/R6-mustknow.md,
// rule R2). PURE. The decks mark about 70 percent of cards Must-know (an author judgement nothing enforced); the owner said
// "everything just has a must know mark to it" (LK13). This overlay keeps the deck files, their hashes and verdicts unchanged
// and re-tiers at load time: about one card in four per chapter is Must-know.
//
//   score     3 x min(question links, 3) + kind weight (definition, formula 4; steps, difference, list 3; types, entry 2;
//             key line, fact, term 1; example 0) + 1 for a Summary or Recap section
//   per chapter   the top round(25 percent) by score, then `asked`, then book order; at least 6, at most 40, never more than
//             the chapter has
//   one concept   two cards that ask the same thing ("Define partnership." and "What is partnership?") are one concept: only
//             the better one can be Must-know (the one whose NCERT chapter is the chapter's own, then the higher score)
//
//   mustTier(cards, linkCount)        Set of the Must-know card ids
//   linkCounts(linksBySubject)        Map(cardId -> questions linked to it) from data/keycards/links/<subject>.json maps
//   withMustTier(decks)               a loadDecks() result with every card's importance re-tiered (memoised per decks)

export const MUST_RULES = Object.freeze({ share: 0.25, min: 6, max: 40, linkCap: 3, linkWeight: 3 });

export const KIND_WEIGHT = Object.freeze({
  definition: 4, formula: 4, steps: 3, difference: 3, list: 3, types: 2, entry: 2, key_line: 1, fact: 1, term: 1, example: 0,
});

const SUMMARY = /\b(summary|recap)\b/i;

/** How many Must-know cards a chapter of `n` cards gets. */
export const mustTarget = (n) => Math.min(n, Math.max(MUST_RULES.min, Math.min(MUST_RULES.max, Math.round(n * MUST_RULES.share))));

/** A card's re-tier score (higher is more Must-know). */
export function mustScore(card, links = 0) {
  const kind = KIND_WEIGHT[card?.kind] ?? 1;
  const summary = SUMMARY.test(String(card?.source?.section || '')) ? 1 : 0;
  return MUST_RULES.linkWeight * Math.min(Number(links) || 0, MUST_RULES.linkCap) + kind + summary;
}

/**
 * The concept a card asks about: its front with the question frame taken off ("Define partnership." and "What is
 * partnership?" are both "partnership"). Cloze cards, lists and long fronts are their own concept (null).
 */
export function conceptOf(card) {
  const front = String(card?.front || '').trim();
  if (!front || front.includes('____')) return null;
  const m = /^(?:define|what is meant by|what do you mean by|what is|what are|meaning of)\s+(?:the\s+|an?\s+)?(.+?)[.?]?$/i.exec(front);
  if (!m) return null;
  const words = m[1].toLowerCase().replace(/[‘’'"“”]/g, '').replace(/[^a-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 5) return null;
  return `${card.kind === 'definition' || card.kind === 'term' ? 'def' : card.kind}:${words.join(' ')}`;
}

/** The NCERT chapter number most of a chapter's cards come from (the chapter's own). */
function ownChapterNo(cards) {
  const n = new Map();
  for (const c of cards) {
    const no = c?.source?.chapterNo;
    if (no === undefined || no === null) continue;
    n.set(no, (n.get(no) || 0) + 1);
  }
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** Map(cardId -> number of questions linked to it), over every subject's links map ({ questionId: [cardIds] }). */
export function linkCounts(linksBySubject) {
  const out = new Map();
  const maps = linksBySubject instanceof Map ? [...linksBySubject.values()] : Array.isArray(linksBySubject) ? linksBySubject : [linksBySubject || {}];
  for (const map of maps) {
    for (const ids of Object.values(map || {})) {
      for (const id of new Set(Array.isArray(ids) ? ids : [])) out.set(id, (out.get(id) || 0) + 1);
    }
  }
  return out;
}

/** The Must-know ids of a set of cards (any chapters): rule R2 per chapter, one card per concept. */
export function mustTier(cards, linkCount = new Map()) {
  const byChapter = new Map();
  for (const c of cards || []) {
    if (!c?.id || !c.chapterKey) continue;
    const list = byChapter.get(c.chapterKey) || [];
    list.push(c);
    byChapter.set(c.chapterKey, list);
  }
  const out = new Set();
  const links = (id) => (linkCount instanceof Map ? linkCount.get(id) : linkCount?.[id]) || 0;
  for (const list of byChapter.values()) {
    const own = ownChapterNo(list);
    const offChapter = (c) => (own !== null && c?.source?.chapterNo !== undefined && c.source.chapterNo !== own ? 1 : 0);
    const ranked = list.map((c) => ({ c, score: mustScore(c, links(c.id)) }))
      .sort((a, b) => b.score - a.score
        || (Number(b.c.asked) || 0) - (Number(a.c.asked) || 0)
        || offChapter(a.c) - offChapter(b.c)
        || (Number(a.c.order) || 0) - (Number(b.c.order) || 0)
        || String(a.c.id).localeCompare(String(b.c.id)));
    // One concept, one Must-know card: the duplicate that is the chapter's own source and scores higher wins.
    const best = new Map();
    for (const r of ranked) {
      const k = conceptOf(r.c);
      if (!k) continue;
      const held = best.get(k);
      if (!held || offChapter(held.c) > offChapter(r.c)) best.set(k, r);
    }
    const eligible = ranked.filter((r) => { const k = conceptOf(r.c); return !k || best.get(k) === r; });
    const n = Math.min(mustTarget(list.length), eligible.length);
    for (const r of eligible.slice(0, n)) out.add(r.c.id);
  }
  return out;
}

const memo = new WeakMap();

/**
 * A decks object (loadDecks(): { bySubject: Map(subject -> { version, cards }), byId, links, disabled }) with the re-tier
 * applied: every card is a copy with `importance` 'must' or 'good' by mustTier(), and `deckImportance` keeps the deck's own
 * mark. The input is not changed. Memoised, so every caller of one decks object gets the same overlaid object.
 */
export function withMustTier(decks) {
  if (!decks || typeof decks !== 'object') return decks;
  if (memo.has(decks)) return memo.get(decks);
  const counts = linkCounts(decks.links || new Map());
  const bySubject = new Map();
  const byId = new Map();
  for (const [subject, deck] of decks.bySubject || new Map()) {
    const must = mustTier(deck.cards || [], counts);
    const cards = (deck.cards || []).map((c) => ({ ...c, importance: must.has(c.id) ? 'must' : 'good', deckImportance: c.importance }));
    bySubject.set(subject, { ...deck, cards });
    for (const c of cards) byId.set(c.id, c);
  }
  const out = { ...decks, bySubject, byId, mustTier: true };
  memo.set(decks, out);
  memo.set(out, out);
  return out;
}
