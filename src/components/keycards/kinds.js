// Key cards: the pure words and shapes every Key cards screen shares (KEYCARDS-BUILD-SPEC.md section 3, card format in
// KEYCARDS-CONTENT-SPEC.md). No React, no I/O, so node --test reads it as the screens do.
//
// Copy rules (spec, owner standards): plain sentence case, no exclamation marks, no emoji, no arrows, never "mastered",
// "mastery" or "marks to recover", no percentage under 6 answers. No middle dot anywhere (owner rule T-124): the compact
// meta strings use commas ("18 cards, 6 due", "Business Studies Part 1, Ch 1, p. 3").

/** The label a student sees for each card kind, exactly as KEYCARDS-CONTENT-SPEC.md section 2 writes it. */
export const KIND_LABELS = Object.freeze({
  definition: 'Definition',
  term: 'Term',
  key_line: 'Key line',
  list: 'List',
  difference: 'Difference',
  steps: 'Steps',
  types: 'Types',
  formula: 'Formula',
  fact: 'Fact',
  example: 'Example',
  entry: 'Entry',
  quote: 'Quote',
  // English (authored or WordNet, never NCERT)
  word: 'Word',
  idiom: 'Idiom',
  one_word: 'One word',
  usage: 'Usage',
  rule: 'Rule',
});

export const kindLabel = (card) => card?.label || KIND_LABELS[card?.kind] || 'Card';

/** Kinds whose back is NCERT fragments joined by line breaks, drawn as a list. */
export const LIST_KINDS = Object.freeze(['list', 'steps', 'types']);
/** Kinds whose front is the quote with words blanked. */
export const BLANK_KINDS = Object.freeze(['term', 'key_line']);

export const RATINGS = Object.freeze([
  { rating: 1, label: 'Missed', key: '1' },
  { rating: 3, label: 'Got it', key: '2' },
  { rating: 4, label: 'Easy', key: '3' },
]);

export const MODES = Object.freeze([
  { id: 'read', label: 'Read' },
  { id: 'study', label: 'Study' },
  { id: 'last', label: 'Last look' },
]);

/** The one factual Pro line (spec section 3, Free). */
export const PRO_LINE = 'Pro opens every card in every chapter and keeps them on a schedule.';

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Business Studies Part 1, Ch 1, p. 3" (the spec's reference) from a card's source; null when there is nothing to cite. */
export function sourceLine(source) {
  if (!source || typeof source !== 'object') return null;
  if (source.kind === 'wordnet') return 'Meaning from WordNet';
  if (source.kind === 'authored') return 'Written for the MockMob English deck';
  const n = (v) => (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
  const parts = [source.book || null, n(source.chapterNo) !== null ? `Ch ${n(source.chapterNo)}` : null, n(source.page) !== null ? `p. ${n(source.page)}` : null];
  const line = parts.filter(Boolean).join(', ');
  return line || null;
}

/** "Business Studies Part 1, Ch 1" from a chapter's ncert block ({ book, chapter }). */
export function chapterRef(ncert) {
  if (!ncert || !ncert.book) return null;
  const n = ncert.chapter !== null && ncert.chapter !== undefined && Number.isFinite(Number(ncert.chapter)) ? Number(ncert.chapter) : null;
  return n !== null ? `${ncert.book}, Ch ${n}` : ncert.book;
}

/** "Business Studies Part 1, chapter 1": the same reference written out, for screen readers. */
export function chapterRefSpoken(ncert) {
  if (!ncert || !ncert.book) return null;
  const n = ncert.chapter !== null && ncert.chapter !== undefined && Number.isFinite(Number(ncert.chapter)) ? Number(ncert.chapter) : null;
  return n !== null ? `${ncert.book}, chapter ${n}` : ncert.book;
}

/**
 * The front split on its blanks: [{ text } | { blank: true, n }]. `____` (three or more underscores) is a blank, as the content
 * spec writes it. A front without blanks is one text part.
 */
export function splitBlanks(front) {
  const out = [];
  const text = String(front || '');
  const re = /_{3,}/g;
  let at = 0;
  let n = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > at) out.push({ text: text.slice(at, m.index) });
    out.push({ blank: true, n: n += 1 });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out.length ? out : [{ text }];
}

/**
 * The quote with its blanked words marked: [{ text } | { mark: word }], each blank found in order after the last one. A blank
 * that is not in the quote (it should always be: content check 3) is simply not marked.
 */
export function markBlanks(quote, blanks = []) {
  const text = String(quote || '');
  const words = Array.isArray(blanks) ? blanks.filter((w) => typeof w === 'string' && w.trim()) : [];
  if (!words.length) return [{ text }];
  const out = [];
  let at = 0;
  const lower = text.toLowerCase();
  for (const word of words) {
    const i = lower.indexOf(word.toLowerCase(), at);
    if (i < 0) continue;
    if (i > at) out.push({ text: text.slice(at, i) });
    out.push({ mark: text.slice(i, i + word.length) });
    at = i + word.length;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}

/** The lines of a list, steps or types back (NCERT fragments joined by line breaks). */
export const backLines = (back) => String(back || '').split(/\n+/).map((l) => l.trim()).filter(Boolean);

/** Whole cards and locked stubs from a deck's `cards`, in the order they came (book order). */
export function splitDeck(cards = []) {
  const open = [];
  const locked = [];
  for (const c of Array.isArray(cards) ? cards : []) (c?.locked ? locked : open).push(c);
  return { open, locked };
}

/**
 * The deck in reading order with every locked stub gathered into ONE quiet row after the open cards (spec: "a quiet stub
 * row with the count and one upgrade line, not a wall of locks"). Returns [{ card } | { stub: n }].
 */
export function readingRows(cards = []) {
  const rows = [];
  let locked = 0;
  for (const c of Array.isArray(cards) ? cards : []) {
    if (c?.locked) locked += 1;
    else if (c) rows.push({ card: c });
  }
  if (locked) rows.push({ stub: locked });
  return rows;
}

/**
 * A chapter row's counts: "18 cards, 6 due" (the spec's line; ", 0 due" only once the chapter is in Revise, since before
 * that nothing can be due), and for Free a second line "5 of 38 open". { line, open } with `open` null for Pro.
 */
export function countsLine(ch, isPro) {
  const cards = Number(ch?.cards) || 0;
  if (!cards) return { line: 'No cards yet', open: null };
  const due = Number(ch?.due) || 0;
  const added = Number(ch?.added) || 0;
  const line = due || added ? `${plural(cards, 'card')}, ${due} due` : plural(cards, 'card');
  const open = isPro ? null : `${Math.min(Number(ch?.unlocked) || 0, cards)} of ${cards} open`;
  return { line, open };
}

/** The state word with its non-colour cue (an icon name the screen draws). Labels come from the server, exactly. */
export function stateCue(state) {
  const s = state?.state || 'none';
  const label = state?.label || { none: 'Not started', thin: 'Too few answers', weak: 'Needs work', mid: 'Getting there', strong: 'Holding' }[s] || 'Not started';
  return { state: s, label: state?.fading ? `${label}, fading` : label, fading: Boolean(state?.fading) };
}

/** "14 due today, about 4 minutes." The minutes come from the server (15 seconds a card). */
export function todayLine(today) {
  const due = Number(today?.due) || 0;
  if (!due) return 'Nothing due today.';
  const minutes = Math.max(1, Number(today?.minutes) || Math.ceil(due * 0.25));
  return `${plural(due, 'card')} due today, about ${plural(minutes, 'minute')}.`;
}

/** The end of a session, counts only: [{ label, n }] in rating order. */
export function endCounts(ratings = {}) {
  return RATINGS.map((r) => ({ label: r.label, n: Number(ratings[r.rating]) || 0 }));
}

/** A chapter key from a subject and a stored chapter name, as cuet_syllabus.js builds them ('business_studies.financial-management'). */
export const slugChapter = (subject, name) => `${subject}.${String(name || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;

/** The chapter row in a GET /api/keycards body for a subject and a stored chapter name (by key, then by title, then by the
 *  stored `name` when the server sends it; an old alias such as 'Admission of a Partner' only matches through `name`). */
export function findChapter(home, subject, name) {
  const entry = home?.subjects?.find((s) => s.subject === subject);
  if (!entry || !name) return null;
  const key = slugChapter(subject, name);
  const want = String(name).trim().toLowerCase();
  for (const unit of entry.units || []) {
    for (const ch of unit.chapters || []) {
      if (ch.key === key || [ch.title, ch.name].some((t) => String(t || '').trim().toLowerCase() === want)) return { ...ch, unit: unit.unit };
    }
  }
  return null;
}

/** An NCERT excerpt can start mid-sentence: a back whose first character is a lowercase letter reads with a leading ellipsis. Display only. */
export const startsMidSentence = (text) => typeof text === 'string' && /^\p{Ll}/u.test(text.trimStart());
export const withLead = (text) => (startsMidSentence(text) ? `\u2026${text.trimStart()}` : text);
