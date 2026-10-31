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

/** The one meta line. The server's own line when it sends one; the truthful fallback for a chapter with no cards. */
export function metaLine(row) {
  if (row?.meta) return row.meta;
  if (row && !(row.cards > 0)) return row.questions > 0 ? 'No Key cards yet. Questions ready.' : 'No Key cards yet.';
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

/**
 * Marks open: every chapter in one list, the most marks open first; chapters with no figure last, each group in book order.
 * `parts` is the server's body (already limited to the chosen option's chapters).
 */
export function marksOrder(parts) {
  const flat = [];
  for (const part of parts) for (const unit of part.units) for (const row of unit.chapters) flat.push({ row, part, unit, at: flat.length });
  const figure = (row) => (Number.isFinite(row.marksOpen) && row.marksOpen !== 0 ? Math.abs(row.marksOpen) : null);
  return flat.sort((a, b) => {
    const x = figure(a.row);
    const y = figure(b.row);
    if (x === null && y === null) return a.at - b.at;
    if (x === null) return 1;
    if (y === null) return -1;
    return y - x || a.at - b.at;
  });
}

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
