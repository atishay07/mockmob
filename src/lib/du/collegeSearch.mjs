// One search matcher for every college and programme search on the website: the cutoff checker's
// college and programme finders, the combination planner's programme finder, and any later college
// field. Students type "bcom", "B.Com", "b com" or "bcom hons" and all of them mean B.Com. (Hons.);
// a dropped letter ("hansrj") still finds Hansraj. Pure (no DOM, no network), the same rules as the
// app's college_search.dart, tested by data/tests/college_search.test.mjs.

/** Lower case, "&" as "and", punctuation as spaces, single spaces, trimmed. */
export function duNormalise(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[.()[\],'’/\-:_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** duNormalise without spaces ("bcomhons"). */
export const duCompact = (s) => duNormalise(s).replace(/ /g, '');

/** Whole query words that stand for longer ones. One table, unit tested. */
export const DU_SEARCH_ALIASES = Object.freeze({
  bcom: 'b com',
  ba: 'b a',
  bsc: 'b sc',
  hons: 'hons',
  honours: 'hons',
  honors: 'hons',
  h: 'hons',
  eco: 'economics',
  econ: 'economics',
  econs: 'economics',
  polsci: 'political science',
  pol: 'political',
  psych: 'psychology',
  psy: 'psychology',
  eng: 'english',
  math: 'mathematics',
  maths: 'mathematics',
  bms: 'bachelor of management studies',
  bba: 'bba',
  fia: 'financial investment analysis',
  srcc: 'shri ram college of commerce',
  lsr: 'lady shri ram college for women',
  kmc: 'kirori mal college',
  svc: 'sri venkateswara college',
  jmc: 'jesus and mary college',
  dcac: 'delhi college of arts and commerce',
  sggscc: 'shri guru gobind singh college of commerce',
  hrc: 'hansraj college',
});

/** The query's words after aliases ("bcom hons" -> b, com, hons). */
export function duQueryTokens(q) {
  return queryTokenInfo(q).map((x) => x.t);
}

/**
 * The query's words with whether each must match a whole candidate word. A word that comes from an
 * alias standing for several words ("bcom" -> b, com), or a typed pair that spells one ("b com"), is a
 * complete word: "com" there must not reach into "Computer" or "Communication".
 */
function queryTokenInfo(q) {
  const words = duNormalise(q).split(' ').filter(Boolean);
  const whole = new Array(words.length).fill(false);
  for (let i = 0; i + 1 < words.length; i++) {
    if (DU_SEARCH_ALIASES[words[i] + words[i + 1]] === `${words[i]} ${words[i + 1]}`) whole[i] = whole[i + 1] = true;
  }
  const out = [];
  words.forEach((t, i) => {
    const parts = (DU_SEARCH_ALIASES[t] ?? t).split(' ');
    for (const part of parts) out.push({ t: part, whole: whole[i] || parts.length > 1 });
  });
  return out;
}

function candidateTokens(s) {
  const out = [];
  for (const t of duNormalise(s).split(' ')) {
    if (!t) continue;
    out.push(DU_SEARCH_ALIASES[t] === 'hons' ? 'hons' : t);
  }
  return out;
}

/** Damerau (optimal string alignment) distance of at most max. */
function withinEdits(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return false;
  const n = a.length;
  const m = b.length;
  let prev2 = new Array(m + 1).fill(0);
  let prev = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const cur = new Array(m + 1).fill(0);
    cur[0] = i;
    let rowMin = i;
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return false;
    prev2 = prev;
    prev = cur;
  }
  return prev[m] <= max;
}

function rank(query, qc, candidate) {
  const cc = duCompact(candidate);
  if (!cc) return null;
  if (cc.startsWith(qc)) return 0;
  if (qc.length >= 3 && cc.includes(qc)) return 1;
  const info = queryTokenInfo(query);
  if (!info.length) return null;
  const qt = info.map((x) => x.t);
  const ct = candidateTokens(candidate);
  const aliased = qt.join('');
  if (aliased !== qc && cc.startsWith(aliased)) return 0;
  // A whole word matches only a whole word; any other word may start a longer one.
  const hit = ({ t, whole }) => ct.some((c) => (whole ? c === t : c.startsWith(t)));
  if (info.every(hit)) return 2;
  const fuzzy = info.every((x) => {
    if (hit(x)) return true;
    if (x.whole) return false;
    const q = x.t;
    if (q.length < 5) return false;
    const allowed = q.length >= 8 ? 2 : 1;
    // A slip inside a word, or across a space the student left out ("hans raj" / "hansrj").
    return ct.some((c) => withinEdits(q, c, allowed) || (c.length > q.length && withinEdits(q, c.slice(0, q.length), allowed)))
      || withinEdits(q, cc.length > q.length + allowed ? cc.slice(0, q.length + 1) : cc, allowed);
  });
  return fuzzy ? 3 : null;
}

/**
 * How well query matches candidate (or one of its extra names): null for no match, lower is better.
 * 0: the candidate starts with the query (spaces and dots ignored); 1: contains it; 2: every query
 * word starts a candidate word; 3: every long query word is one slip away from a candidate word
 * (two at 8 letters or more), the short ones still start one.
 */
export function duMatchRank(query, candidate, extra = []) {
  const qc = duCompact(query);
  if (!qc) return 0;
  let best = null;
  for (const name of [candidate, ...extra]) {
    const r = rank(query, qc, String(name ?? ''));
    if (r !== null && (best === null || r < best)) best = r;
    if (best === 0) break;
  }
  return best;
}

/**
 * The items that match query, best first; ties by weight (higher first), then name A to Z. An empty
 * query returns every item in the caller's order. options: { extra(item) -> string[], weight(item) -> number }.
 */
export function duSearch(query, items, name, { extra, weight } = {}) {
  if (!duCompact(query)) return [...items];
  const scored = [];
  for (const item of items) {
    const r = duMatchRank(query, name(item), extra ? extra(item) : []);
    if (r !== null) scored.push([item, r]);
  }
  scored.sort((a, b) => {
    if (a[1] !== b[1]) return a[1] - b[1];
    if (weight) {
      const w = weight(b[0]) - weight(a[0]);
      if (w) return w;
    }
    const an = String(name(a[0]));
    const bn = String(name(b[0]));
    return an < bn ? -1 : an > bn ? 1 : 0;
  });
  return scored.map((s) => s[0]);
}

/** Does query match this one name at all? For filters that keep the caller's order. */
export const duMatches = (query, candidate, extra = []) => duMatchRank(query, candidate, extra) !== null;
