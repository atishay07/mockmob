// Learn home, the pure parts (B 3.1 and 3.2, DESIGN-SPEC A7, R2 rulings 1 and 2): how a roadmap row reads, what the sort and the
// filter do to the map, and which units the part switch shows. Its only import is the roadmap's own pure rules, so the page, the
// service and the tests read one rule for coverage.
import { coverageLine, coverageShare, verdictOf } from '../../../../data/learn/roadmap.js';

/** The ring beside a state word: the word is the first cue, the shape the second (never colour alone). */
const SHAPE = { none: 'none', thin: 'thin', needs_work: 'weak', getting_there: 'mid', holding: 'strong', unknown: 'unknown' };
export const stateShape = (key) => SHAPE[key] || 'none';

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * "14 chapters · 866 Key cards · 4 lessons" (R3 ruling R6; the chapters are the playable ones, C2). A count that is 0 is not said
 * (lessons switched off, a subject with no lessons yet). Never a due count: due cards are the Revise row and the sidebar's dot.
 */
export function subjectLine(subject) {
  if (!subject) return '';
  const bits = [];
  if (subject.chapters > 0) bits.push(plural(subject.chapters, 'chapter'));
  if (subject.cards > 0) bits.push(plural(subject.cards, 'Key card'));
  if (subject.lessons > 0) bits.push(plural(subject.lessons, 'lesson'));
  return bits.join(' · ');
}

/** A chapter is on the roadmap when it has cards (R3 rulings C2 and R5): coming-soon chapters and chapters with no cards are not drawn. */
export const hasCards = (row) => Number(row?.cards) > 0;

/**
 * The parts as the roadmap draws them: only the chapters that have cards; a unit with none is dropped; a part with none is dropped
 * unless it has an option switch (the student still picks a side, and the page says when that side has no cards yet).
 */
export function playableParts(parts) {
  return (parts || [])
    .map((part) => ({ ...part, units: part.units.map((unit) => ({ ...unit, chapters: unit.chapters.filter(hasCards) })).filter((unit) => unit.chapters.length) }))
    .filter((part) => part.units.length || part.option);
}

const NUMBER_WORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
/**
 * True when a part opens with chapters every student reads and ends with its option units (Accountancy's Part 2: Share Capital and
 * Debentures for all, then Analysis of Financial Statements or Computerised Accounting, CUET 2026 Unit V and "Optional to Unit V").
 * The choice then sits right above the option units, after the common ones (R4, LK139).
 */
export function optionAtTail(part) {
  const units = part?.units || [];
  const first = units.findIndex((u) => u.optionId);
  return first > 0 && units.slice(first).every((u) => u.optionId);
}

/**
 * "Part 2 has two options. Pick the one your school teaches." (one line above the option pills, R5). `at` is the part's place
 * (0-based). When the part opens with common chapters and ends with the options (optionAtTail), the line sits after the common ones
 * and says so: "The rest of Part 2 has two options. ..." (R4, LK139: the choice changes only the last unit).
 */
export function optionLine(part, at = 0) {
  const n = part?.option?.choices?.length || 0;
  const number = /^Part\s+(\d+)/i.exec(String(part?.title || ''))?.[1] || String(at + 1);
  return `${optionAtTail(part) ? 'The rest of Part' : 'Part'} ${number} has ${NUMBER_WORD[n] || n} options. Pick the one your school teaches.`;
}

/**
 * The same line once a choice is drawn (saved, or tapped and saving): it says which, plainly, so a part chosen at onboarding never
 * reads as waiting for a pick (owner, 5 Nov, LK94; the app's HomeModel.chosenOptionLine, word for word):
 * "Part 2 has two options. Yours is Analysis of Financial Statements." With no choice, or one the data does not name, it asks.
 */
export function chosenOptionLine(part, choice, at = 0) {
  const label = choice ? (part?.option?.choices || []).find((c) => c.id === choice)?.label : null;
  if (!label) return optionLine(part, at);
  return optionLine(part, at).replace(' Pick the one your school teaches.', ` Yours is ${label}.`);
}

/** The one line when the picked option has no chapters with cards at all (R5). */
export const OPTION_COMING = 'Cards for this option are coming.';

/**
 * "5 Key cards free in each chapter" for the roadmap's header, said once; null on Pro (R5, R4 first-timer#1: it says 5 of what).
 * `rows` are the roadmap rows; the 5 is the open count a Free chapter carries in `progress.of`, never a row's own size.
 */
export function freeEach(rows, isPro) {
  if (isPro) return null;
  const n = Math.max(0, ...(rows || []).map((r) => Number(r?.progress?.of) || 0));
  return n > 0 ? `${plural(n, 'Key card')} free in each chapter` : null;
}

/**
 * The line under the part's pills while no option is saved (R4 owner-eye#4, first-timer#8): which option the list below really shows.
 * The name is the choice's own label from the data, never typed here. When both options show, or one is saved, there is nothing to say.
 * `part.units` are the playable ones, so an option with no cards is not among them.
 */
export function impliedOptionLine(part, choice) {
  if (!part?.option || choice) return null;
  const ids = [...new Set((part.units || []).filter((u) => u.optionId).map((u) => u.optionId))];
  if (ids.length !== 1) return null;
  const label = (part.option.choices || []).find((c) => c.id === ids[0])?.label;
  return label ? `Showing ${label} until you pick.` : null;
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

/** The map's sorts. "Most marks left" is offered only when at least one chapter carries a figure (A3-11). */
export const SORTS = Object.freeze([
  { id: 'book', label: 'Book order' },
  { id: 'due', label: 'Due first' },
  { id: 'needs', label: 'Needs work first' },
  { id: 'marks', label: 'Most marks left' },
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

/** "35 marks": the marks a chapter still has open, said with a word (a bare minus reads as a penalty). Empty when the server has no figure. */
export function marksText(row) {
  if (!Number.isFinite(row?.marksOpen) || row.marksOpen === 0) return '';
  const n = Math.abs(row.marksOpen);
  return `${n} ${n === 1 ? 'mark' : 'marks'}`;
}

/** What a screen reader hears for a row: name, reference, state, count, meta, and the marks when they are shown. */
export function rowSpoken(row, { marks = false } = {}) {
  const m = marks ? marksText(row) : '';
  return [displayTitle(row.title), row.ref, row.state?.label, cardsText(row), metaLine(row), m ? `${m} left in this chapter` : ''].filter(Boolean).join('. ');
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
const KIND_WORD = { pickup: 'Pick up', due: 'Due', fix: 'Fix', next: 'Next', start: 'Start', level: 'Skip ahead', recap: 'Recap', search: 'Search' };
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

/**
 * The student's own sets (Find's rows and the search focused): Due today, Missed lately, In Revise, each with its count and its spoken name. The
 * status line "9 due · 6 missed · 26 in Revise" under the search field is gone (R3 ruling R4); a count that is 0 is never drawn
 * (LK27: "Revise should not be 0"); with every count at 0 there are no keys at all.
 */
export function shelfKeys(shelves, subjectName = '') {
  if (!shelves) return [];
  const sub = subjectName ? `${subjectName} ` : '';
  const due = Number(shelves.due?.count) || 0;
  const missed = Number(shelves.missed?.count) || 0;
  const revise = Number(shelves.revise?.count) || 0;
  const days = Number(shelves.missed?.days) || 14;
  const chapters = Number(shelves.revise?.chapters) || 0;
  return [
    { id: 'due', count: due, title: 'Due today', name: `Due today: ${due} ${sub}${due === 1 ? 'card' : 'cards'}. Show them` },
    { id: 'missed', count: missed, title: 'Missed lately', name: `Missed lately: ${missed} ${missed === 1 ? 'card' : 'cards'} in the last ${days} days. Show them` },
    { id: 'revise', count: revise, title: 'In Revise', name: `In Revise: ${revise} ${revise === 1 ? 'card' : 'cards'} in ${plural(Math.max(1, chapters), 'chapter')}. Show them` },
  ].filter((k) => k.count > 0);
}

/**
 * The verdict a row carries (R2 ruling 2, R4 ruling V): "Needs work" and nothing else. When the evidence is only from the student's
 * papers (`needsWorkFrom === 'papers'`) it says so; `'learn'`, a missing field or any other value reads plainly.
 */
export function verdictText(row) {
  const word = row?.verdict ?? verdictOf(row?.state?.key);
  if (!word) return null;
  return row?.needsWorkFrom === 'papers' ? `${word}, from your papers` : word;
}

/**
 * A roadmap row (R2 ruling 2, R4 ui-correctness#1): the coverage line, the 3 px bar's share and the verdict. The size is the chapter's
 * real card count (`row.cards`) on Free and Pro alike: Free's open count (`progress.of`, 5) is only what it may play, so it is the
 * header's line and never a row's total ("5 of 45 cards seen"). A row without `cards` (an old body) falls back to `progress.of`.
 * Never a zero, a % or "mastered".
 */
export function roadmapRow(row) {
  const p = row?.progress || null;
  if (!p) return { line: '', share: 0, seen: 0, verdict: verdictText(row), total: 0 };
  const total = Number(row?.cards) > 0 ? Number(row.cards) : Number(p.of) || 0;
  const cover = { ...p, of: total };
  return { line: coverageLine(cover), share: coverageShare(cover), seen: Math.min(Number(p.seen) || 0, total), verdict: verdictText(row), total };
}

/** Find with nothing typed: a few words from the book to start with, per subject (a tap searches it). */
const FIND_HINTS = Object.freeze({
  accountancy: ['goodwill', 'sacrificing ratio', 'revaluation', 'debentures'],
  business_studies: ['delegation', 'marketing mix', 'planning', 'motivation'],
  economics: ['elasticity', 'national income', 'money multiplier', 'opportunity cost'],
  english: ['synonym', 'antonym', 'idiom', 'one word substitution'],
  biology: ['pollination', 'DNA replication', 'Mendel', 'enzymes'],
  political_science: ['cold war', 'federalism', 'non-aligned', 'planning commission'],
});
export const findHints = (subject) => FIND_HINTS[subject] || [];
export const findHintLine = (subject) => { const w = findHints(subject)[0]; return w ? `Search any word from the book, like “${w}”.` : 'Search any word from the book.'; };

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

// ---------------------------------------------------------------- R7 W (LK59): Up next, one module
// The owner (3 Nov): the recommendations "making the overall UI very much more cluttered ... the implementation in the UI is just not
// good". Learn home drew its offer, two "Or" rows with their own lines, an "Up next" chip and amber "Needs work · from your papers" on
// the rows: five ways of saying what to do, in four looks. Now one module with Today's anatomy (TodayMove): ONE move on the card at a
// time (its headline, one line saying why, its key) and the others as short cells in its footer; a tap makes that one the move. The
// server's pick is marked "Suggested" while another is on the card. Every word comes from the server's roadmap (data/learn/roadmap.js);
// the only words added here are a kind's plain reason when the server sends none, and they say only what the run is.

const stripMinutes = (label) => String(label || '').replace(/\s*·\s*\d+\s*min$/i, '').trim();
const minutesOf = (o) => {
  const m = Number(o?.run?.minutes);
  if (m > 0) return m;
  try { const v = Number(new URL(o?.href || '', 'http://x').searchParams.get('min')); return v > 0 ? v : null; } catch { return null; }
};
/** What a kind's run is, in one line, when the server sends no line of its own. Says only what the run holds. */
export const MOVE_WHY = Object.freeze({
  revise: 'The cards due back today, oldest first.',
  continue: 'Your session from today, from where you stopped.',
  singles: 'One question at a time, with the answer explained.',
});

/** The Or row's own line said as the reason for that move: a fix's line is the chapter its mistakes are in. */
function whyOf(o) {
  if (o.kind === 'fix' && o.line) return `In ${displayTitle(o.line)}.`;
  if (o.line) { const l = displayTitle(o.line); return /[.!?]$/.test(l) ? l : `${l}.`; }
  return MOVE_WHY[o.kind] || null;
}
/** The key of a move from an Or row: "Start · 2 min" for a run or a feed (one word for starting, E-ENGLISH row 26), else the row's own label. */
function keyOf(o) {
  const m = minutesOf(o);
  if (o.kind === 'continue') return o.label;
  if (o.go === 'feed' && m) return `Start · ${m} min`;
  if (o.run && m) return `Start · ${m} min`;
  return o.label;
}

/**
 * The moves of the Up next module: the server's offer first (id 'lead', `suggested`), then its Or rows (at most two, the server's order).
 * Each: { id, kind, headline, why, sub, progress, key: { label, run?, href?, go? }, cell: { title, value } }. The cell is how the move reads
 * in the footer: its title (the label without its minutes) and its value (the minutes, or the reason when there are none).
 */
export function upNextMoves(roadmap) {
  if (!roadmap) return [];
  const lead = {
    id: 'lead', kind: roadmap.mode, suggested: true,
    headline: displayTitle(roadmap.headline), why: roadmap.line ? displayTitle(roadmap.line) : null, sub: roadmap.sub || null, progress: roadmap.progress || null,
    key: roadmap.key || null, quiet: roadmap.quiet || null,
    cell: { title: displayTitle(roadmap.headline), value: roadmap.key?.label && /·\s*\d+\s*min$/i.test(roadmap.key.label) ? roadmap.key.label.replace(/^.*·\s*/, '') : '' },
  };
  const alts = (roadmap.or || []).slice(0, 2).map((o) => {
    const m = minutesOf(o);
    return {
      id: o.kind, kind: o.kind, suggested: false, headline: stripMinutes(o.label), why: whyOf(o), sub: null, progress: null,
      key: { ...o, label: keyOf(o) }, quiet: null,
      cell: { title: stripMinutes(o.label), value: m ? `${m} min` : '' },
    };
  });
  return [lead, ...alts];
}

/** The footer's cells for the move on the card: every other move, in the server's order (the lead first, marked Suggested). */
export const otherMoves = (moves, onCard) => (moves || []).filter((m) => m.id !== onCard);
