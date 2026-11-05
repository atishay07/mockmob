// Find's results, the arithmetic (R4, LK139). PURE, so node tests it; FindView.jsx draws it.
//   resultCounts(body, openCards)   the head line ("1 chapter, 10 cards"), Free's locked matches said once, and the open matches past
//                                   the search's limit. The search sorts open cards first (data/learn/search.js), so when any match
//                                   is locked every match past the limit is locked too: one line says the whole number.
//   cardPreview(sections, n)        the first n cards across the chapter groups, groups kept in order: the cards' preview while a
//                                   chapter or lesson matched; { sections, cut } where cut says some were left for "Show all".

const word = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function resultCounts(body, openCards = 0) {
  const chapters = (body?.chapters || []).length;
  const lessons = (body?.lessons || []).length;
  const lockedShown = (body?.cards || []).filter((x) => x?.locked || x?.card?.locked).length;
  const more = Math.max(0, Number(body?.more) || 0);
  const locked = lockedShown + (lockedShown ? more : 0);
  const moreOpen = lockedShown ? 0 : more;
  const line = [
    chapters ? word(chapters, 'chapter') : null,
    lessons ? word(lessons, 'lesson') : null,
    openCards ? word(openCards, 'card') : null,
  ].filter(Boolean).join(', ');
  return { chapters, lessons, cards: openCards, locked, moreOpen, line };
}

export function cardPreview(sections = [], n = Infinity) {
  const total = sections.reduce((a, s) => a + (s.cards || []).length, 0);
  if (!Number.isFinite(n) || total <= n) return { sections, cut: false };
  const out = [];
  let left = n;
  for (const s of sections) {
    if (left <= 0) break;
    const cards = (s.cards || []).slice(0, left);
    if (!cards.length) continue;
    out.push({ ...s, cards });
    left -= cards.length;
  }
  return { sections: out, cut: true };
}
