// Search (lane palette, 18 Nov 2026): the pure rules of the one place to jump anywhere in the signed-in website.
// No React, no browser globals, no '@/' imports, so src/lib/search/searchModel.test.mjs runs every rule under node --test.
//
// Ranking: case and accent blind; a match at the start of the title beats a match at a word's start, which beats a match
// inside a word; every query word must match (in any order); ties keep the list's own order (pages in nav order, chapters in
// book order). A query word of five letters or more still matches a title word with one letter missing or two letters swapped.
// Synonyms (an item's `keywords`) count as a word-start match, so "marks" finds Marks trend and Your papers.
// Nothing here asks the server: every item is in memory when the student types.

/** The Enter word on the active row, by what the row does. */
export const ENTER = Object.freeze({ open: 'Open', start: 'Start' });

/** At most this many rows in one group, and in all (the empty query's Go to keeps its six pages). */
export const GROUP_LIMIT = 5;
export const TOTAL_LIMIT = 14;
/** Typos are forgiven only in query words this long or longer. */
export const TYPO_MIN = 5;

/** The groups in their own order: a tie between groups keeps this order. */
export const GROUPS = Object.freeze([
  { id: 'goto', label: 'Go to' },
  { id: 'start', label: 'Start' },
  { id: 'chapters', label: 'Chapters' },
  { id: 'colleges', label: 'Colleges and courses' },
]);

// Score of one query word, by where it matched.
const TIER = Object.freeze({ titleStart: 3, wordStart: 2, keyword: 2, inside: 1, extra: 0.5, typo: 0.25 });

const MARKS = /[̀-ͯ]/g;

/**
 * Text for matching, with a map back to the original: lower case, accents dropped, "&" read as "and", apostrophes and dots
 * joined ("St. Stephen's" -> "st stephens", "B.Com." -> "bcom"), every other run of non-letters one space, trimmed.
 * -> { text, map } where map[i] is the index in the original of folded character i.
 */
export function fold(input) {
  const src = String(input ?? '');
  let text = '';
  const map = [];
  let space = true;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    let piece;
    if (ch === '&') piece = ' and ';
    else if (ch === "'" || ch === '’' || ch === '‘' || ch === '.') piece = '';
    else piece = ch.normalize('NFD').replace(MARKS, '').toLowerCase().replace(/[^a-z0-9]/g, ' ');
    for (const p of piece) {
      if (p === ' ') {
        if (space) continue;
        space = true;
      } else space = false;
      text += p;
      map.push(i);
    }
  }
  if (text.endsWith(' ')) { text = text.slice(0, -1); map.pop(); }
  return { text, map };
}

/** The query's words, folded: "  Goodwill  NATURE " -> ['goodwill', 'nature']. */
export function queryWords(query) {
  const { text } = fold(query);
  return text ? text.split(' ') : [];
}

/** One item made ready for matching (folded once, not per keystroke). */
export function prepare(item) {
  const title = fold(item.title);
  return {
    ...item,
    _title: title,
    _words: wordsWithStarts(title.text),
    _keys: (item.keywords || []).map((k) => fold(k).text).filter(Boolean),
    _extra: fold(item.extra || '').text,
  };
}

function wordsWithStarts(text) {
  const out = [];
  let at = 0;
  for (const word of text ? text.split(' ') : []) {
    out.push({ word, at });
    at += word.length + 1;
  }
  return out;
}

/**
 * True when `word` is `target`'s start with one letter missing ("godwill" for "goodwill") or two neighbouring letters
 * swapped ("goodwlil"). Only for words of TYPO_MIN letters or more. Returns how many letters of target it covers, or 0.
 */
export function typoCovers(word, target) {
  const n = word.length;
  if (n < TYPO_MIN) return 0;
  // One letter missing: some letter of target's first n + 1, taken out, leaves the word.
  if (target.length >= n + 1) {
    const head = target.slice(0, n + 1);
    for (let j = 0; j <= n; j += 1) if (head.slice(0, j) + head.slice(j + 1) === word) return n + 1;
  }
  // Two neighbouring letters swapped.
  if (target.length >= n) {
    const head = target.slice(0, n);
    if (head !== word) {
      for (let j = 0; j < n - 1; j += 1) {
        if (word[j] === head[j + 1] && word[j + 1] === head[j] && word.slice(0, j) === head.slice(0, j) && word.slice(j + 2) === head.slice(j + 2)) return n;
      }
    }
  }
  return 0;
}

// Where one query word matches an item, best first: { score, range: [start, end) in the folded title, or null }.
function matchWord(item, word) {
  const t = item._title.text;
  if (t.startsWith(word)) return { score: TIER.titleStart, range: [0, word.length] };
  const start = t.indexOf(` ${word}`);
  if (start >= 0) return { score: TIER.wordStart, range: [start + 1, start + 1 + word.length] };
  if (word.length >= 2 && item._keys.some((k) => k.split(' ').some((part) => part.startsWith(word)))) return { score: TIER.keyword, range: null };
  const inside = t.indexOf(word);
  if (inside >= 0) return { score: TIER.inside, range: [inside, inside + word.length] };
  if (item._extra && (item._extra.startsWith(word) || item._extra.includes(` ${word}`))) return { score: TIER.extra, range: null };
  for (const { word: w, at } of item._words) {
    const covered = typoCovers(word, w);
    if (covered) return { score: TIER.typo, range: [at, at + covered] };
  }
  return null;
}

/**
 * How well a prepared item matches the query words: { score, ranges } (ranges in the ORIGINAL title, merged, for the bold
 * letters), or null when any word does not match. A title that starts with the whole query gets a little more, and one that
 * is exactly the query a little more again.
 */
export function matchItem(item, words) {
  if (!words.length) return null;
  let score = 0;
  const folded = [];
  for (const word of words) {
    const hit = matchWord(item, word);
    if (!hit) return null;
    score += hit.score;
    if (hit.range) folded.push(hit.range);
  }
  const phrase = words.join(' ');
  if (words.length > 1 && item._title.text.startsWith(phrase)) score += 1;
  // Words typed apart that the title writes as one ("b com" for "B.Com.") still lead.
  if (words.length > 1 && item._title.text.replace(/ /g, '').startsWith(words.join(''))) score += 3;
  if (item._title.text === phrase) score += 1;
  return { score, ranges: originalRanges(folded, item._title.map) };
}

function originalRanges(folded, map) {
  const out = folded
    .map(([s, e]) => [map[s], map[Math.max(s, e - 1)] + 1])
    .filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e) && e > s)
    .sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of out) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  return merged;
}

/** A title cut into plain and matched parts for drawing: [{ text, hit }]. */
export function titleParts(title, ranges = []) {
  const src = String(title ?? '');
  const parts = [];
  let at = 0;
  for (const [s, e] of ranges) {
    if (s > at) parts.push({ text: src.slice(at, s), hit: false });
    parts.push({ text: src.slice(s, e), hit: true });
    at = e;
  }
  if (at < src.length) parts.push({ text: src.slice(at), hit: false });
  return parts.filter((p) => p.text);
}

/**
 * The results for a query. `sources` is { goto, start, chapters, colleges }, each a list of PREPARED items in its own order;
 * an item may carry `rank` (0 first; the student's own chapters are 0, other subjects' 1, so theirs come after).
 * `empty` is what the empty query shows: { goto: [...ids], start: [...ids] }.
 * -> [{ id, label, rows: [{ ...item, ranges }] }], best group first, at most GROUP_LIMIT rows a group and TOTAL_LIMIT in all.
 */
export function searchResults(query, sources = {}, { empty = null } = {}) {
  const words = queryWords(query);
  if (!words.length) {
    if (String(query ?? '').trim()) return [];
    return emptyResults(sources, empty);
  }
  const groups = [];
  GROUPS.forEach((group, order) => {
    const hits = [];
    (sources[group.id] || []).forEach((item, index) => {
      const m = matchItem(item, words);
      if (m) hits.push({ item, index, score: m.score, ranges: m.ranges });
    });
    if (!hits.length) return;
    hits.sort((a, b) => (a.item.rank || 0) - (b.item.rank || 0) || b.score - a.score || a.index - b.index);
    const best = Math.max(...hits.map((h) => h.score));
    groups.push({ id: group.id, label: group.label, order, best, rows: hits.slice(0, GROUP_LIMIT).map((h) => ({ ...h.item, ranges: h.ranges })) });
  });
  groups.sort((a, b) => b.best - a.best || a.order - b.order);
  let left = TOTAL_LIMIT;
  const out = [];
  for (const g of groups) {
    if (left <= 0) break;
    const rows = g.rows.slice(0, left);
    left -= rows.length;
    out.push({ id: g.id, label: g.label, rows });
  }
  return out;
}

function emptyResults(sources, empty) {
  const pick = (id, ids, limit) => {
    const list = sources[id] || [];
    const rows = ids ? ids.map((x) => list.find((item) => item.id === x)).filter(Boolean) : list;
    return rows.slice(0, limit).map((item) => ({ ...item, ranges: [] }));
  };
  const out = [];
  const go = pick('goto', empty?.goto || null, 6);
  if (go.length) out.push({ id: 'goto', label: 'Go to', rows: go });
  const start = pick('start', empty?.start || null, GROUP_LIMIT);
  if (start.length) out.push({ id: 'start', label: 'Start', rows: start });
  return out;
}

/** Every row of the results in reading order (what the arrow keys walk). */
export function flatRows(results) {
  return results.flatMap((g) => g.rows);
}

/** The next active index for an arrow key, wrapping: step +1 (down) or -1 (up). -1 when there is nothing to choose. */
export function moveActive(index, step, count) {
  if (!(count > 0)) return -1;
  if (!(index >= 0)) return step > 0 ? 0 : count - 1;
  return (((index + step) % count) + count) % count;
}

/** The line shown when nothing matches. */
export function nothingLine(query) {
  return `Nothing matches “${String(query ?? '').trim()}”. Try a chapter, a page or a college.`;
}

// ---------------------------------------------------------------------------------------------------------------------
// When a key opens Search.

/** Routes where no key opens Search: the paper (a stray key must never leave it), a Mob game, onboarding. */
export function searchBlockedOn(path) {
  const p = String(path || '');
  return /^\/(test|onboarding|mob\/game)(\/|$|\?)/.test(p);
}

/** True for a focus target that takes typing: an input, a textarea, a select or anything contenteditable. */
export function typesText({ tag = '', editable = false, type = '' } = {}) {
  const t = String(tag).toUpperCase();
  if (editable) return true;
  if (t === 'TEXTAREA' || t === 'SELECT') return true;
  if (t === 'INPUT') return !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file', 'image'].includes(String(type).toLowerCase());
  return false;
}

/**
 * What a key press does to Search: 'open' or null. Ctrl+K and Cmd+K open it from anywhere (an input too); "/" opens it only
 * when focus is not in something that takes typing. Never on a blocked route, never while another dialog or sheet is open,
 * never while Search is already open, never for a repeat, a press already handled, or one mid-composition (IME).
 * `key`: { key, ctrlKey, metaKey, altKey, shiftKey, repeat, isComposing, defaultPrevented }
 * `context`: { path, dialogOpen, open, target: { tag, editable, type } }
 */
export function searchKeyAction(key = {}, { path = '', dialogOpen = false, open = false, target = {} } = {}) {
  if (open || dialogOpen || searchBlockedOn(path)) return null;
  if (key.defaultPrevented || key.isComposing || key.repeat) return null;
  const k = String(key.key || '');
  if ((key.ctrlKey || key.metaKey) && !key.altKey && !key.shiftKey && k.toLowerCase() === 'k') return 'open';
  if (k === '/' && !key.ctrlKey && !key.metaKey && !key.altKey && !typesText(target)) return 'open';
  return null;
}
