// Learn v2: Find's search over one subject (B section 3.7, BUILD-1101 1.8 R13): chapter names, lesson titles and Key cards
// (front, quote and kind). PURE. A query needs 2 characters. Each result carries the match spans so the line can show what
// matched.
//   words        stopwords and the study words (meaning, define, definition, explain, what, which) are dropped, unless
//                nothing else is left; they are neither required nor scored
//   short forms  ioc, iod, p&l, pl, cfs, bs are read as their words before matching (ABBREVIATIONS, a small editable list)
//   required     every kept word appears in the record (in any searched field)
//   one edit     a word of 6 or more letters with no exact hit in a record matches a word of it within one edit, at half
//                weight ("revalution" finds revaluation)
//   score        per field: its weight for each distinct word found (half for a one-edit match), plus the phrase bonus
//                (the query from its first kept word to its last, inner small words included): never a count of repeats
//
//   normalise(text)               lowercase, NFKC, curly quotes straight
//   spans(text, words)            [{ start, end }] of every word in text, merged, in order
//   searchSubject({ query, chapters, lessons, cards, kindLabel, isOpen, limit })
import { isStopword } from '../keycards.js';

export const SEARCH_RULES = Object.freeze({ minChars: 2, cardLimit: 50, fuzzyFrom: 6 });
export const STUDY_WORDS = Object.freeze(['meaning', 'define', 'definition', 'explain', 'what', 'which']);
/** Short forms read as their words (R13). fifo, lifo, gdp, gnp, nnp, ndp stay words of their own. */
export const ABBREVIATIONS = Object.freeze({
  ioc: 'interest on capital', iod: 'interest on drawings', 'p&l': 'profit and loss', pl: 'profit and loss',
  cfs: 'cash flow statement', bs: 'balance sheet',
});

export const normalise = (text) => String(text ?? '').normalize('NFKC').toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
const STUDY = new Set(STUDY_WORDS);
const small = (w) => isStopword(w) || STUDY.has(w);

/**
 * The query read for matching: { words, phrase } where words are the required (and scored) words and phrase the bonus
 * phrase; null when the query is too short.
 */
export function readQuery(query) {
  let q = normalise(query).trim();
  if (q.length < SEARCH_RULES.minChars) return null;
  q = q.replace(/\bp\s*&\s*l\b/g, ' p&l ');
  const raw = q.split(/\s+/).map((t) => (t === 'p&l' ? t : t.replace(/&/g, ' and '))).join(' ').split(/\s+/)
    .map((t) => (t === 'p&l' ? t : t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))).filter(Boolean);
  const tokens = raw.flatMap((t) => (ABBREVIATIONS[t] ? ABBREVIATIONS[t].split(' ') : [t]));
  if (!tokens.length) return null;
  const keep = tokens.map((t) => !small(t));
  const any = keep.some(Boolean);
  const words = [...new Set(any ? tokens.filter((t, i) => keep[i]) : tokens)];
  if (!words.some((w) => w.length >= SEARCH_RULES.minChars)) return null;
  const first = any ? keep.indexOf(true) : 0;
  const last = any ? keep.lastIndexOf(true) : tokens.length - 1;
  return { words, phrase: tokens.slice(first, last + 1).join(' ') };
}

/** The query's required words (2+ characters each after trimming, small words dropped unless nothing else), or []. */
export function queryWords(query) {
  return readQuery(query)?.words || [];
}

/** Every place a word occurs in `text` (case-insensitive), merged and sorted. Same length as the text (NFKC aside). */
export function spans(text, words) {
  const hay = normalise(text);
  const out = [];
  for (const w of words) {
    let at = hay.indexOf(w);
    while (at >= 0) { out.push({ start: at, end: at + w.length }); at = hay.indexOf(w, at + w.length); }
  }
  return mergeSpans(out);
}

function mergeSpans(list) {
  const out = [...list].sort((a, b) => a.start - b.start || b.end - a.end);
  const merged = [];
  for (const s of out) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else merged.push({ ...s });
  }
  return merged;
}

/** True when a and b are one insert, delete or change apart. */
export function oneEdit(a, b) {
  if (a === b) return false;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i += 1;
  if (la === lb) return a.slice(i + 1) === b.slice(i + 1);
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/** The words of a text with their places: [{ w, start, end }]. */
function tokensOf(hay) {
  const out = [];
  for (const m of hay.matchAll(/[\p{L}\p{N}]+/gu)) out.push({ w: m[0], start: m.index, end: m.index + m[0].length });
  return out;
}

/**
 * Match a record's fields: null unless every word appears (exactly, or within one edit for a long word with no exact hit in
 * the record); else { fields: { name: spans }, score }.
 */
function match(fields, words, phrase) {
  const live = fields.filter(([, text]) => text).map(([name, text, weight]) => ({ name, text, weight, hay: normalise(text) }));
  const exact = new Set();
  for (const f of live) for (const w of words) if (f.hay.includes(w)) exact.add(w);
  const fuzzyWords = words.filter((w) => !exact.has(w) && w.length >= SEARCH_RULES.fuzzyFrom);
  if (exact.size + fuzzyWords.length < words.length) return null;
  const found = {};
  const fuzzyHit = new Set();
  let score = 0;
  for (const f of live) {
    const own = words.filter((w) => f.hay.includes(w));
    const list = spans(f.text, own);
    let part = own.length;
    if (fuzzyWords.length) {
      const toks = tokensOf(f.hay);
      for (const w of fuzzyWords) {
        const near = toks.filter((t) => oneEdit(w, t.w));
        if (!near.length) continue;
        fuzzyHit.add(w);
        part += 0.5;
        list.push(...near.map(({ start, end }) => ({ start, end })));
      }
    }
    if (!list.length) continue;
    found[f.name] = mergeSpans(list);
    score += f.weight * part + (f.hay.includes(phrase) ? f.weight * 4 : 0) + (f.hay.startsWith(phrase) ? f.weight * 2 : 0);
  }
  if (fuzzyHit.size < fuzzyWords.length) return null;
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
  const read = readQuery(query);
  const empty = { query: String(query ?? ''), tooShort: true, chapters: [], lessons: [], cards: [], more: 0, total: 0, cardCounts: {} };
  if (!read) return empty;
  const { words, phrase } = read;
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
