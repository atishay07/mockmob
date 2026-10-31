// Learn v2: Find's search over one subject (B section 3.7): chapter names, lesson titles and Key cards (front, quote and
// kind). PURE. A query needs 2 characters; every word of it must appear (in any searched field of the record); each result
// carries the match spans so the line can show what matched.
//
//   normalise(text)               lowercase, NFKC, '&' as 'and', curly quotes straight
//   spans(text, words)            [{ start, end }] of every word in text, merged, in order
//   searchSubject({ query, chapters, lessons, cards, kindLabel, isOpen, limit })

export const SEARCH_RULES = Object.freeze({ minChars: 2, cardLimit: 50 });

export const normalise = (text) => String(text ?? '').normalize('NFKC').toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

/** The query's words (2+ characters each after trimming), or [] when the query is too short. */
export function queryWords(query) {
  const q = normalise(query).replace(/&/g, ' and ').trim();
  if (q.length < SEARCH_RULES.minChars) return [];
  const words = [...new Set(q.split(/\s+/).filter(Boolean))];
  return words.some((w) => w.length >= SEARCH_RULES.minChars) ? words : [];
}

/** Every place a word occurs in `text` (case-insensitive), merged and sorted. Same length as the text (NFKC aside). */
export function spans(text, words) {
  const hay = normalise(text);
  const out = [];
  for (const w of words) {
    let at = hay.indexOf(w);
    while (at >= 0) { out.push({ start: at, end: at + w.length }); at = hay.indexOf(w, at + w.length); }
  }
  out.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged = [];
  for (const s of out) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else merged.push({ ...s });
  }
  return merged;
}

/** Match a record's fields: null unless every word appears in at least one field; else { fields: { name: spans }, score }. */
function match(fields, words, phrase) {
  const found = {};
  const hit = new Set();
  let score = 0;
  for (const [name, text, weight] of fields) {
    if (!text) continue;
    const hay = normalise(text);
    const s = spans(text, words);
    if (!s.length) continue;
    found[name] = s;
    for (const w of words) if (hay.includes(w)) hit.add(w);
    score += weight * s.length + (hay.includes(phrase) ? weight * 4 : 0) + (hay.startsWith(phrase) ? weight * 2 : 0);
  }
  if (hit.size < words.length) return null;
  return { fields: found, score };
}

/**
 * input:
 *   query       the student's words
 *   chapters    [{ key, title, name?, cards }] in book order
 *   lessons     [{ id, title, chapterKey }]
 *   cards       the subject's cards [{ id, chapterKey, kind, front, quote, order }] (a locked card's text is searched
 *               but never returned: it comes back as `locked: true` with its stub)
 *   chapterTitle(key)   the chapter's title for a card result
 *   kindLabel(kind)     'Definition', 'Key line', ...
 *   isOpen(card)        false for a card the student's plan does not open (Free: not a taste card)
 *   stub(card)          what a locked card shows (its kind and label)
 * Returns { query, tooShort, chapters: [{ key, title, cards, match }], lessons: [{ id, title, chapterKey, match }],
 *   cards: [{ card, chapterKey, chapterTitle, match, locked }], more: n, total: n, cardCounts: { chapterKey: n } }
 *   (more: card matches past the limit; total: every card match; cardCounts: every card match per chapter).
 */
export function searchSubject({ query, chapters = [], lessons = [], cards = [], chapterTitle = (k) => k, kindLabel = (k) => k, isOpen = () => true, stub = (c) => ({ id: c.id, kind: c.kind, locked: true }), limit = SEARCH_RULES.cardLimit } = {}) {
  const words = queryWords(query);
  const empty = { query: String(query ?? ''), tooShort: true, chapters: [], lessons: [], cards: [], more: 0, total: 0, cardCounts: {} };
  if (!words.length) return empty;
  const phrase = words.join(' ');
  const rank = new Map(chapters.map((c, i) => [c.key, i]));
  const chapterHits = [];
  for (const c of chapters) {
    const m = match([['title', c.title, 3], ['name', c.name && c.name !== c.title ? c.name : null, 1]], words, phrase);
    if (m) chapterHits.push({ key: c.key, title: c.title, cards: c.cards || 0, match: m.fields, score: m.score });
  }
  const lessonHits = [];
  for (const l of lessons) {
    const m = match([['title', l.title, 3]], words, phrase);
    if (m) lessonHits.push({ id: l.id, title: l.title, chapterKey: l.chapterKey, match: m.fields, score: m.score });
  }
  const cardHits = [];
  for (const card of cards) {
    if (!card?.id) continue;
    const m = match([['front', card.front, 3], ['quote', card.quote, 1], ['kind', kindLabel(card.kind), 1]], words, phrase);
    if (!m) continue;
    const open = isOpen(card);
    cardHits.push({
      card: open ? card : stub(card), chapterKey: card.chapterKey, chapterTitle: chapterTitle(card.chapterKey),
      match: open ? m.fields : null, locked: !open, score: m.score, rank: rank.get(card.chapterKey) ?? 1e6, order: Number(card.order) || 0,
    });
  }
  const byScore = (a, b) => b.score - a.score;
  chapterHits.sort((a, b) => byScore(a, b) || (rank.get(a.key) ?? 0) - (rank.get(b.key) ?? 0));
  lessonHits.sort((a, b) => byScore(a, b) || String(a.title).localeCompare(String(b.title)));
  // Open cards first, then by how well they match, then book order.
  cardHits.sort((a, b) => (a.locked ? 1 : 0) - (b.locked ? 1 : 0) || byScore(a, b) || a.rank - b.rank || a.order - b.order);
  const strip = ({ score, rank: _r, order: _o, ...rest }) => rest;
  // Every card match per chapter (past the limit too), so a header can say one true number: "27 cards in 1 chapter".
  const cardCounts = {};
  for (const h of cardHits) cardCounts[h.chapterKey] = (cardCounts[h.chapterKey] || 0) + 1;
  return {
    query: String(query ?? ''),
    tooShort: false,
    chapters: chapterHits.map(strip),
    lessons: lessonHits.map(strip),
    cards: cardHits.slice(0, limit).map(strip),
    more: Math.max(0, cardHits.length - limit),
    total: cardHits.length,
    cardCounts,
  };
}
