// Key cards: the pure words and shapes every Key cards screen shares (KEYCARDS-BUILD-SPEC.md section 3, card format in
// KEYCARDS-CONTENT-SPEC.md). No React, no I/O, so node --test reads it as the screens do.
//
// Copy rules (spec, owner standards): plain sentence case, no exclamation marks, no emoji, no arrows, never "mastered",
// "mastery" or "marks to recover", no percentage under 6 answers. No middle dot anywhere (owner rule T-124): the compact
// meta strings use commas ("18 cards, 6 due", "Business Studies Part 1, Ch 1, p. 3").

import { resolveChapter } from '../../../data/cuet_syllabus.js';

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

/**
 * The book's name as the syllabus prints it (data/cuet_syllabus.js ncert.book), from the NCERT code where the decks spell one
 * book several ways: Accountancy's cards say "Accountancy : Partnership Accounts", "Accountancy – Partnership Accounts" and
 * "Accountancy Part 1 (Partnership Accounts)" for the one book whose chapters the screens call "Accountancy Part 1, Ch 2".
 */
export const BOOK_BY_CODE = Object.freeze({ leac1: 'Accountancy Part 1', leac2: 'Accountancy Part 2', lebs1: 'Business Studies Part 1', lebs2: 'Business Studies Part 2' });
export function bookName(source) {
  const code = typeof source?.code === 'string' ? source.code.toLowerCase() : '';
  return BOOK_BY_CODE[code.slice(0, 5)] || (typeof source?.book === 'string' ? source.book.replace(/\s+:/g, ':').trim() : null) || null;
}

/** Is this card NCERT's own words (a book source), as against the English deck's authored or WordNet cards? */
export const isNcert = (card) => !card?.source || card.source.kind === 'ncert';

/**
 * "Business Studies Part 1, Ch 1, p. 3" (the spec's reference) from a card's source; null when there is nothing to cite.
 * WordNet meanings say so on each card; the English deck's own cards carry no line (the chapter says where they come from).
 */
export function sourceLine(source) {
  if (!source || typeof source !== 'object') return null;
  if (source.kind === 'wordnet') return 'Meaning from WordNet';
  if (source.kind === 'authored') return null;
  const n = (v) => (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
  const parts = [bookName(source), n(source.chapterNo) !== null ? `Ch ${n(source.chapterNo)}` : null, n(source.page) !== null ? `p. ${n(source.page)}` : null];
  const line = parts.filter(Boolean).join(', ');
  return line || null;
}

/** Where a chapter's cards come from when it has no NCERT book (the English deck); null for a book chapter. */
export function deckOrigin(cards = []) {
  const kinds = new Set((Array.isArray(cards) ? cards : []).filter((c) => c && !c.locked).map((c) => c.source?.kind).filter(Boolean));
  if (!kinds.size || kinds.has('ncert')) return null;
  return kinds.has('wordnet') ? 'Written for MockMob, with some meanings from WordNet' : 'Written for MockMob';
}

const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/**
 * "Business Studies Part 1, Ch 1" from a chapter's ncert block ({ book, chapter }). `title` and `unit` drop what the screen
 * already says: no reference at all when it is only the chapter's own title again (Computerised Accounting System), and just
 * "Ch 7" under a unit heading that is the book's name (Politics in India since Independence).
 */
export function chapterRef(ncert, { title = null, unit = null } = {}) {
  if (!ncert || !ncert.book) return null;
  const n = ncert.chapter !== null && ncert.chapter !== undefined && Number.isFinite(Number(ncert.chapter)) ? Number(ncert.chapter) : null;
  if (n === null) return title && same(ncert.book, title) ? null : ncert.book;
  return unit && same(ncert.book, unit) ? `Ch ${n}` : `${ncert.book}, Ch ${n}`;
}

/** Is the unit just the book's name again, or the chapter's own title? Then a header need not print it. */
export const unitRepeats = (unit, { title = null, ncert = null } = {}) => !unit || same(unit, title) || same(unit, ncert?.book);

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

/**
 * A list line's own marker, when NCERT numbered or lettered it ("1. Liquidity Ratios", "(a) Fixed Assets Turnover Ratio",
 * "(iii) with standards"): [marker, rest], or null. The screen then draws that marker instead of its own bullet, never both.
 */
export function ownMarker(line) {
  const m = /^(\((?:\d{1,2}|[ivx]{1,5}|[a-z])\)|(?:\d{1,2}|[ivx]{1,5}|[a-z])[.)]|[•–-])\s+(\S.*)$/i.exec(String(line || '').trim());
  return m ? [m[1], m[2]] : null;
}

const KIND_PREFIX = Object.freeze({ formula: /^formula\s*:\s*/i, rule: /^rule\s*:\s*/i, entry: /^journal entry\s*:\s*/i });
/**
 * The kind label and the front as a card shows them, without saying the kind twice: "Formula" over "Formula: Current ratio"
 * reads "Current ratio"; an entry whose front begins "Journal entry:" is labelled "Journal entry". Display only: the stored
 * front is untouched.
 */
export function cardFace(card) {
  const front = String(card?.front || '');
  const re = KIND_PREFIX[card?.kind];
  const label = card?.kind === 'entry' && re?.test(front) ? 'Journal entry' : kindLabel(card);
  if (!re || !re.test(front)) return { label, front };
  const rest = front.replace(re, '');
  return { label, front: /^\p{Ll}/u.test(rest) ? rest.charAt(0).toUpperCase() + rest.slice(1) : rest };
}

/**
 * A formula back as lines, each continuation that starts with "=" (or another operator) joined to the line above, so
 * "Trade Receivable Turnover ratio" + "= Net Credit Revenue ..." is one formula. [{ lhs, rhs } | { text }]: the first line
 * split at its first "=", so it breaks before the "=" rather than inside a term.
 */
export function formulaLines(back) {
  const merged = [];
  for (const line of backLines(back)) {
    if (merged.length && /^[=+×÷/]/.test(line)) merged[merged.length - 1] += ` ${line}`;
    else merged.push(line);
  }
  return merged.map((line, i) => {
    const at = i === 0 ? line.indexOf('=') : -1;
    return at > 0 ? { lhs: line.slice(0, at).trim(), rhs: line.slice(at).trim() } : { text: line };
  });
}

const AMOUNT = /^(?:rs\.?\s*)?[\d,]+(?:\.\d+)?(?:\s*\/-)?$/i;
const LABELLED = /^\((?:[a-z]|[ivx]+|\d+)\)\s/i;
/**
 * A journal entry back as rows, the way the book sets one: [{ kind: 'dr' | 'cr' | 'note' | 'text', text, amount? }].
 *   dr    "Bank A/c" with "Dr." (a lone "Dr." line belongs to the account above it; "X Dr. To Y" on one line is split)
 *   cr    "To Premium for Goodwill A/c", set in
 *   note  the narration in brackets, "(Amount brought by new partner as premium)"
 *   text  anything else ("1. When interest is due")
 * An amount line ("10,00,000") goes with the row above it. null when the back is not an entry (no Dr. and no To line),
 * so a "Treatment:" card stays a paragraph.
 */
export function entryRows(back) {
  const lines = String(back || '').replace(/(\bDr\.?)[ \t]+(?=To\s)/g, '$1\n').split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (!lines.some((l) => /(^|\s)Dr\.?(\s|$)/.test(l) || /^To\s/.test(l))) return null;
  const rows = [];
  const last = () => rows[rows.length - 1];
  for (const line of lines) {
    const lone = /^Dr\.?(?:\s+(.*))?$/.exec(line);
    if (lone && last() && last().kind !== 'dr' && last().kind !== 'note') {
      last().kind = 'dr';
      const rest = (lone[1] || '').trim();
      if (rest && AMOUNT.test(rest)) last().amount = rest;
      else if (rest) rows.push({ kind: 'note', text: rest });
      continue;
    }
    if (AMOUNT.test(line) && last() && !last().amount && (last().kind === 'dr' || last().kind === 'cr')) { last().amount = line; continue; }
    if (/^To\s/.test(line)) { rows.push({ kind: 'cr', text: line }); continue; }
    if (/^\(.*\)\.?$/.test(line) && !LABELLED.test(line)) { rows.push({ kind: 'note', text: line }); continue; }
    const dr = /^(.*?)\s+Dr\.?(?:\s+(.*))?$/.exec(line);
    if (dr && dr[1]) {
      rows.push({ kind: 'dr', text: dr[1] });
      const rest = (dr[2] || '').trim();
      if (rest && AMOUNT.test(rest)) last().amount = rest;
      else if (rest) rows.push({ kind: 'note', text: rest });
      continue;
    }
    rows.push({ kind: 'text', text: line });
  }
  return rows;
}

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

/**
 * The subject's units as blocks [{ unit | null, label, chapters, group }]. When every unit holds one chapter (Business
 * Studies) the units are one plain list in CUET order, so no name is printed twice and no lone heading floats. Otherwise each
 * unit is its own group, spaced from the next, and is headed only when the heading adds something: a unit of several
 * chapters (Accountancy's "Accounting for Partnership"), or one chapter under another name. Economics' "Money and Banking"
 * unit holds only the chapter "Money and Banking", so its group is that one row, never the name twice.
 */
export function blocksOf(units = []) {
  const live = units.filter((u) => (u.chapters || []).length);
  if (live.every((u) => u.chapters.length === 1)) return live.length ? [{ unit: null, label: null, chapters: live.map((u) => ({ ...u.chapters[0], unit: u.unit })), group: false }] : [];
  return live.map((u) => ({ unit: u.chapters.length === 1 && unitRepeats(u.unit, { title: u.chapters[0].title }) ? null : u.unit, label: u.unit, chapters: u.chapters, group: true }));
}

/** The state word with its non-colour cue (an icon name the screen draws). Labels come from the server, exactly. */
export function stateCue(state) {
  const s = state?.state || 'none';
  // 'unknown' (the server could not read the answers) is its own neutral state: never worded as "Not started".
  const label = state?.label || { none: 'Not started', thin: 'Too few answers', weak: 'Needs work', mid: 'Getting there', strong: 'Holding', unknown: 'Could not load' }[s] || 'Not started';
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
  // An old stored name (Review rows keep what the question carried, e.g. "Business Finance") resolves through the syllabus to
  // today's chapter key; a retired chapter has no Key cards, so no link.
  const resolved = resolveChapter(subject, name);
  if (resolved?.retired) return null;
  const keys = [slugChapter(subject, name), resolved?.key].filter(Boolean);
  const want = String(name).trim().toLowerCase();
  for (const unit of entry.units || []) {
    for (const ch of unit.chapters || []) {
      if (keys.includes(ch.key) || [ch.title, ch.name].some((t) => String(t || '').trim().toLowerCase() === want)) return { ...ch, unit: unit.unit };
    }
  }
  return null;
}

/**
 * One review stamp per card shown (code review M3). A rating's `clientReviewedAt` is also the server's replay key, so every retry
 * of that rating must send the same value: `prev` is the stamp held for the card on screen; a different card gets a new one.
 */
export function stampFor(prev, cardId, now = () => new Date().toISOString()) {
  return prev && prev.cardId === cardId ? prev : { cardId, at: now() };
}

/**
 * What a 402 from the card routes says, by the server's `reason` (code review H3, L2). 'reviews' is Free's 10 reviews a day (the
 * server's keycard_reviews, or a body with no reason), 'new' Free's 5 new cards a day (keycard_new), 'card' a card Free cannot
 * hold (keycards). `lead` goes before the one Pro line (PRO_LINE); `line` is a sentence of its own above it.
 */
export function limitKind(reason) {
  return reason === 'keycard_new' ? 'new' : reason === 'keycards' ? 'card' : 'reviews';
}
export function limitCopy(kind, { where = 'study' } = {}) {
  if (kind === 'new') return { title: 'Today’s new cards are used', line: null, lead: 'That is today’s 5 new cards on Free.', rest: where === 'study' ? 'Reading the cards stays open, and new cards come back tomorrow.' : null };
  if (kind === 'card') return { title: 'This card is part of Pro', line: null, lead: null, rest: null };
  return where === 'study'
    ? { title: 'Today’s free reviews are used', line: 'Free includes 10 card reviews a day. Reading the cards stays open, and the reviews come back tomorrow.', lead: null, rest: null }
    : { title: 'Today’s free card reviews are used', line: 'Free includes 10 Key card reviews a day. These cards stay due and come back tomorrow.', lead: null, rest: null };
}

/**
 * What "The line you needed" says after Add to Revise, from the count the server added (POST /api/keycards/add { added }, a
 * number or a list) out of the `asked` cards: it never says both when fewer went in.
 */
export function addedLine(added, asked) {
  const n = Array.isArray(added) ? added.length : Number(added);
  const got = Number.isFinite(n) ? Math.max(0, Math.min(asked, n)) : asked;
  if (got >= asked) return asked > 1 ? 'Both are in Revise. They come back when due.' : 'In Revise. It comes back when due.';
  if (got === 0) return asked > 1 ? 'These cards were already in Revise.' : 'This card was already in Revise.';
  return `${plural(got, 'card')} added to Revise. The other was already there or is part of Pro.`;
}

/**
 * An NCERT excerpt can start mid-sentence: a back whose first character is a lowercase letter reads with a leading ellipsis.
 * Display only, and only for the book's words (`card` given): an English answer such as "affect" is a whole answer, not an excerpt.
 */
export const startsMidSentence = (text, card = null) => typeof text === 'string' && /^\p{Ll}/u.test(text.trimStart()) && (!card || isNcert(card));
export const withLead = (text, card = null) => (startsMidSentence(text, card) ? `…${text.trimStart()}` : text);
