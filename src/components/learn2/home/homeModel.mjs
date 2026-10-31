// Learn home, the pure parts (B 3.1 and 3.2, DESIGN-SPEC A7): how a chapter row reads, what the sort and the filter do to
// the map, and which units the part switch shows. No imports, so the page and its test read the same rules.

/** The ring beside a state word: the word is the first cue, the shape the second (never colour alone). */
const SHAPE = { none: 'none', thin: 'thin', needs_work: 'weak', getting_there: 'mid', holding: 'strong', unknown: 'unknown' };
export const stateShape = (key) => SHAPE[key] || 'none';

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "868 Key cards, 14 chapters, 4 lessons". A count that is 0 is not said (lessons switched off, a subject with no lessons yet). */
export function subjectLine(subject) {
  if (!subject) return '';
  const bits = [];
  if (subject.cards > 0) bits.push(plural(subject.cards, 'Key card'));
  if (subject.chapters > 0) bits.push(plural(subject.chapters, 'chapter'));
  if (subject.lessons > 0) bits.push(plural(subject.lessons, 'lesson'));
  return bits.join(', ');
}

/** The count at the end of a row. A chapter with no cards says so in its meta line instead (B 3.1 states). */
export const cardsText = (row) => (row?.cards > 0 ? plural(row.cards, 'card') : '');

/** A chapter with no cards and no questions has nothing to play (A3-24): its row says so and is drawn in ink-2. */
export const nothingToPlay = (row) => Boolean(row) && !(row.cards > 0) && !(row.questions > 0);

/** The one meta line. The server's own line when it sends one; the truthful fallback for a chapter with no cards. */
export function metaLine(row) {
  if (nothingToPlay(row)) return 'Nothing to practise here yet.';
  if (row?.meta) return row.meta;
  if (row && !(row.cards > 0)) return 'No Key cards yet. Questions ready.';
  return '';
}

const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

/** A unit heading is drawn only when it says something the chapter's own name does not (a one-chapter unit of the same name). */
export function unitHeading(unit) {
  if (!unit?.title) return null;
  if (unit.chapters?.length === 1 && norm(unit.chapters[0].title) === norm(unit.title)) return null;
  return unit.title;
}

/** The chapters of a unit that match a live filter, by chapter name, NCERT reference or lesson name. */
export function matchesQuery(row, query) {
  const q = norm(query);
  if (!q) return true;
  return [row.title, row.ref, row.lesson?.title].some((text) => norm(text).includes(q));
}

/** parts with only the chapters that match; units and parts left empty are dropped. Keys and order are untouched. */
export function filterParts(parts, query) {
  if (!norm(query)) return parts;
  return parts
    .map((part) => ({ ...part, units: part.units.map((unit) => ({ ...unit, chapters: unit.chapters.filter((row) => matchesQuery(row, query)) })).filter((unit) => unit.chapters.length) }))
    .filter((part) => part.units.length);
}

/** The part's option choice as drawn: a choice the student just tapped (held until the server agrees), else the saved one. */
export const effectiveChoice = (part, local) => local?.[part.id] ?? part.option?.chosen ?? null;

/** The option units a part shows: the chosen one's, or every one while nothing is chosen (both parts show until you choose). */
export function shownOptionUnits(units, choice) {
  const options = units.filter((unit) => unit.optionId);
  return choice ? options.filter((unit) => unit.optionId === choice) : options;
}

/** A signature of a set of units, so the part switch knows when what is drawn really changes. */
export const unitsSignature = (units) => units.map((unit) => `${unit.optionId || ''}:${unit.chapters.map((row) => row.key).join(',')}`).join('|');

/** Every chapter of the map in book order, each with its part and unit. */
export function flatRows(parts) {
  const flat = [];
  for (const part of parts) for (const unit of part.units) for (const row of unit.chapters) flat.push({ row, part, unit, at: flat.length });
  return flat;
}

/**
 * Marks open: every chapter in one list, the most marks open first; chapters with no figure last, each group in book order.
 * `parts` is the server's body (already limited to the chosen option's chapters).
 */
export function marksOrder(parts) {
  const figure = (row) => (Number.isFinite(row.marksOpen) && row.marksOpen !== 0 ? Math.abs(row.marksOpen) : null);
  return flatRows(parts).sort((a, b) => {
    const x = figure(a.row);
    const y = figure(b.row);
    if (x === null && y === null) return a.at - b.at;
    if (x === null) return 1;
    if (y === null) return -1;
    return y - x || a.at - b.at;
  });
}

/** The map's sorts. "Marks open" is offered only when at least one chapter carries a figure (A3-11). */
export const SORTS = Object.freeze([
  { id: 'book', label: 'Book order' },
  { id: 'due', label: 'Due first' },
  { id: 'needs', label: 'Needs work first' },
  { id: 'marks', label: 'Marks open' },
]);
export const hasMarks = (parts) => flatRows(parts || []).some(({ row }) => Boolean(marksText(row)));
export const sortsFor = (parts) => SORTS.filter((s) => s.id !== 'marks' || hasMarks(parts));

/** Needs work, Getting there, Too few answers, Not started, Holding, then unknown. */
const NEEDS_RANK = { needs_work: 0, getting_there: 1, thin: 2, none: 3, holding: 4, unknown: 5 };

/** The chapters in one flat list in the chosen order. Ties keep book order. */
export function sortRows(parts, sort) {
  if (sort === 'marks') return marksOrder(parts);
  const flat = flatRows(parts);
  if (sort === 'due') return flat.sort((a, b) => (b.row.due || 0) - (a.row.due || 0) || (b.row.mistakes || 0) - (a.row.mistakes || 0) || a.at - b.at);
  if (sort === 'needs') {
    const rank = (row) => NEEDS_RANK[row.state?.key] ?? 5;
    return flat.sort((a, b) => rank(a.row) - rank(b.row) || a.at - b.at);
  }
  return flat;
}

/**
 * The reference ("Ch 1") each row shows. The app splits NCERT chapters into topics, so a reference repeats down a unit; it is drawn
 * only where it differs from the row above (A3-20). `always` (a sorted list, where the row above is somebody else's) draws every one.
 */
export function visibleRefs(rows, { always = false } = {}) {
  let prev = null;
  return rows.map((row) => {
    const ref = row?.ref ? String(row.ref) : '';
    const show = ref && (always || ref !== prev) ? ref : '';
    prev = ref || prev;
    return show;
  });
}

/** Every chapter of the map is "Not started": one line says it, the rows draw no state (A3-12). */
export function allNotStarted(parts) {
  const rows = flatRows(parts || []);
  return rows.length > 0 && rows.every(({ row }) => !row.state || row.state.key === 'none');
}
export const chapterTotal = (parts) => flatRows(parts || []).length;

/** The chapters behind one choice of "Your part": "5 chapters", "1 chapter" (A3-25). */
export const optionChapterCount = (units, optionId) => (units || []).filter((u) => u.optionId === optionId).reduce((n, u) => n + (u.chapters?.length || 0), 0);

/** "−35": the marks a chapter still has open, with a real minus sign. Empty when the server has no figure. */
export function marksText(row) {
  if (!Number.isFinite(row?.marksOpen) || row.marksOpen === 0) return '';
  return `−${Math.abs(row.marksOpen)}`;
}

/** What a screen reader hears for a row: name, reference, state, count, meta, and the marks when they are shown. */
export function rowSpoken(row, { marks = false } = {}) {
  const m = marks ? marksText(row) : '';
  return [displayTitle(row.title), row.ref, row.state?.label, cardsText(row), metaLine(row), m ? `${m.slice(1)} marks open` : ''].filter(Boolean).join('. ');
}

/** The suggestion's destination: its `run` (the key starts at once) or its `href`. */
export function suggestionTarget(suggestion) {
  const action = suggestion?.action || {};
  if (action.run?.chapterKey) return { type: 'run', run: action.run };
  if (action.href) return { type: 'href', href: action.href };
  return null;
}

/** The server's three suggestions are of three different kinds; this is the page's own check before it draws them. */
export const distinctKinds = (suggestions) => new Set((suggestions || []).map((s) => s.kind)).size === (suggestions || []).length;

/** A name as it is read: the book's slash between two words is "and" ("Retirement/Death of a Partner"), a " / " is a comma ("Economics, Business Economics"). */
export const displayTitle = (text) => String(text || '').replace(/(\p{L})\/(\p{L})/gu, '$1 and $2').replace(/\s+\/\s+/g, ', ');

/** The word above a suggestion's title (the label role): what kind of move it is. */
const KIND_WORD = { pickup: 'Pick up', due: 'Due', fix: 'Fix', next: 'Next', start: 'Start', level: 'Level', recap: 'Recap', search: 'Search' };
export const kindWord = (kind) => KIND_WORD[kind] || '';

/** The key's short form for a phone row: "Revise these" is "Revise", "Fix them, 10 minutes" is "Fix, 10 min". The full label stays the key's name. */
export const shortAction = (label) => String(label || '').replace(/\s+(?:them|these|it|this|those)(?![a-z])/i, '').replace(/(?<![a-z])minutes?(?![a-z])/gi, 'min').replace(/\s+,/g, ',').trim();

/** The suggestions as Learn home draws them: a search suggestion is never drawn here, the field is on screen (A3-12). */
export const homeSuggestions = (list) => (list || []).filter((s) => s && s.kind !== 'search');

/** A suggestion's title as two parts: the engine's bold `headline`, then the rest ("3 cards due" and " in Accounting Ratios"). */
export function splitTitle(suggestion) {
  const title = String(suggestion?.title || '');
  const headline = String(suggestion?.headline || '');
  if (headline && title.length > headline.length && title.startsWith(headline)) return { headline, rest: title.slice(headline.length) };
  return { headline: '', rest: title };
}

/** "6 of 16 done" for a pick-up suggestion: its own fields when the service sends them, else the numbers its evidence line says. */
export function pickupProgress(suggestion) {
  if (suggestion?.kind !== 'pickup') return null;
  const own = suggestion.done ?? suggestion.progress?.done;
  const of = suggestion.of ?? suggestion.progress?.of;
  if (Number.isFinite(own) && Number.isFinite(of) && of > 0) return { done: Math.min(own, of), of };
  const m = /stopped at (\d+) of (\d+)/i.exec(String(suggestion.evidence || ''));
  if (!m) return null;
  const total = Number(m[2]);
  return total > 0 ? { done: Math.min(Number(m[1]), total), of: total } : null;
}

/** The field's placeholder: the card count when there are cards, what it can still find when there are none, and a plain word while it is unknown. */
export const searchPlaceholder = (cards) => (!Number.isFinite(cards) ? 'Search Key cards' : cards > 0 ? `Search ${cards} Key cards` : 'Search chapters and lessons');

/** The three shelf keys, from GET /api/learn/shelves (A3 3.2.3). Zero is a true value: it is drawn, quiet, and says so. */
export function shelfKeys(shelves, subjectName = '') {
  if (!shelves) return [];
  const sub = subjectName ? `${subjectName} ` : '';
  const due = Number(shelves.due?.count) || 0;
  const missed = Number(shelves.missed?.count) || 0;
  const revise = Number(shelves.revise?.count) || 0;
  const days = Number(shelves.missed?.days) || 14;
  const chapters = Number(shelves.revise?.chapters) || 0;
  return [
    { id: 'due', count: due, label: 'due today', zero: due === 0, name: due ? `Due today: ${due} ${sub}${due === 1 ? 'card' : 'cards'}. Show them` : 'No cards due today' },
    { id: 'missed', count: missed, label: 'missed lately', zero: missed === 0, name: missed ? `Missed lately: ${missed} ${missed === 1 ? 'card' : 'cards'} in the last ${days} days. Show them` : 'None missed lately' },
    { id: 'revise', count: revise, label: 'in Revise', zero: revise === 0, name: revise ? `In Revise: ${revise} ${revise === 1 ? 'card' : 'cards'} in ${plural(chapters, 'chapter')}. Show them` : 'Nothing in Revise yet' },
  ];
}
export const SHELF_IDS = Object.freeze(['due', 'missed', 'revise', 'must']);
export const shelfFromParam = (value) => (SHELF_IDS.includes(value) ? value : null);

/** The name and the one line of an opened set: "Due today" / "9 cards in 3 chapters, about 2 min". */
export function setHead(id, { count = 0, chapters = 0, shelves = null } = {}) {
  const base = `${plural(count, 'card')} in ${plural(chapters, 'chapter')}`;
  if (id === 'due') return { title: 'Due today', line: shelves?.due?.minutes ? `${base}, about ${shelves.due.minutes} min` : base };
  if (id === 'missed') return { title: 'Missed lately', line: `${base}, missed in the last ${shelves?.missed?.days || 14} days` };
  if (id === 'revise') return { title: 'In Revise', line: base };
  return { title: 'Must-know', line: base };
}

/** India's calendar day (UTC+5:30), as the service counts a Free session. */
export const istDay = (now = Date.now()) => new Date(now + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
