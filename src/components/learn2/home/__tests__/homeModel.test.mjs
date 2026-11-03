// node --test src/components/learn2/home/__tests__/homeModel.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OPTION_COMING, allNotStarted, cardsText, freeEach, hasCards, optionLine, playableParts, chapterTotal, distinctKinds, effectiveChoice, filterParts, homeSuggestions, istDay, marksOrder, marksText, metaLine, nothingToPlay, optionChapterCount, pickupProgress, plural,
  findHintLine, findHints, impliedOptionLine, roadmapRow, verdictText, searchPlaceholder, setHead, shelfFromParam, shelfKeys, shownOptionUnits, sortRows, sortsFor, splitTitle, stateShape, subjectLine, suggestionTarget, unitHeading, unitsSignature, visibleRefs,
} from '../homeModel.mjs';

const row = (key, extra = {}) => ({ key, title: key.toUpperCase(), ref: 'Ch 1', cards: 10, questions: 4, mistakes: 0, due: 0, state: { key: 'none', label: 'Not started' }, meta: '', marksOpen: null, lesson: null, ...extra });
const parts = [
  { id: 'p1', title: 'Part 1, Partnership Accounts', option: null, units: [
    { title: 'Accounting for Partnership', optionId: null, chapters: [row('a', { marksOpen: 12 }), row('b', { marksOpen: 35 }), row('c')] },
  ] },
  { id: 'p2', title: 'Part 2', option: { label: 'Your part', choices: [{ id: 'afs', label: 'Analysis' }, { id: 'cas', label: 'Computerised' }], chosen: null, hint: '' }, units: [
    { title: 'Company Accounts', optionId: null, chapters: [row('d', { marksOpen: 35, lesson: { id: 'l1', title: 'Share capital basics', minutes: 7, read: false } })] },
    { title: 'Analysis of Financial Statements', optionId: 'afs', chapters: [row('e'), row('f')] },
    { title: 'Computerised Accounting', optionId: 'cas', chapters: [row('g')] },
  ] },
];

test('state words get a shape of their own', () => {
  assert.equal(stateShape('holding'), 'strong');
  assert.equal(stateShape('needs_work'), 'weak');
  assert.equal(stateShape('unknown'), 'unknown');
  assert.equal(stateShape('something else'), 'none');
});

test('the subject line says only counts that are real, chapters first, with dots, and never a due count (R3 R6)', () => {
  assert.equal(subjectLine({ cards: 866, chapters: 14, lessons: 4 }), '14 chapters · 866 Key cards · 4 lessons');
  assert.equal(subjectLine({ cards: 1, chapters: 1, lessons: 0 }), '1 chapter · 1 Key card');
  assert.doesNotMatch(subjectLine({ cards: 866, chapters: 14, lessons: 4, due: 9 }), /due/);
  assert.equal(plural(2, 'card'), '2 cards');
});

test('R3 R5: the roadmap draws only chapters with cards; a part keeps its option switch even when its side is empty', () => {
  const afs = [{ id: 'p', title: 'Part 2, Company Accounts', option: { label: 'Your part', choices: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], chosen: 'b' }, units: [
    { title: 'Share capital', optionId: null, chapters: [row('x'), row('soon', { cards: 0, questions: 0 })] },
    { title: 'Analysis', optionId: 'a', chapters: [row('y')] },
    { title: 'Computerised', optionId: 'b', chapters: [row('z', { cards: 0, questions: 0 }), row('w', { cards: 0, questions: 4 })] },
  ] }, { id: 'q', title: 'Part 3', option: null, units: [{ title: 'Empty', optionId: null, chapters: [row('e', { cards: 0 })] }] }];
  assert.equal(hasCards(row('a')), true);
  assert.equal(hasCards(row('a', { cards: 0, questions: 9 })), false, 'questions alone are not a playable chapter');
  const out = playableParts(afs);
  assert.deepEqual(out.map((p) => p.id), ['p'], 'a part with no chapter and no switch is dropped');
  assert.deepEqual(out[0].units.map((u) => u.title), ['Share capital', 'Analysis'], 'the empty option unit and its coming-soon rows are gone');
  assert.deepEqual(out[0].units[0].chapters.map((r) => r.key), ['x']);
  assert.equal(shownOptionUnits(out[0].units.filter((u) => u.optionId), 'b').length, 0, 'the picked option has none: the page says so');
  assert.equal(OPTION_COMING, 'Cards for this option are coming.');
  assert.equal(optionChapterCount(out[0].units, 'b'), 0);
  assert.deepEqual(playableParts(null), []);
});

test('R3 R5: the option line names the part and its options; Free says "5 Key cards free in each chapter" once, Pro never', () => {
  assert.equal(optionLine({ title: 'Part 2, Company Accounts and Analysis of Financial Statements', option: { choices: [{}, {}] } }), 'Part 2 has two options. Pick the one your school teaches.');
  assert.equal(optionLine({ title: 'Computerised', option: { choices: [{}, {}, {}] } }, 0), 'Part 1 has three options. Pick the one your school teaches.');
  const rows = [{ progress: { of: 5 } }, { progress: { of: 3 } }, { progress: { of: 0 } }];
  assert.equal(freeEach(rows, false), '5 Key cards free in each chapter');
  assert.equal(freeEach([{ progress: { of: 1 } }], false), '1 Key card free in each chapter');
  assert.equal(freeEach(rows, true), null);
  assert.equal(freeEach([], false), null);
  // A row itself never says "free": the roadmap row's line is counted as cards.
  assert.doesNotMatch(roadmapRow({ progress: { of: 5, seen: 2, questions: 4, tried: 0 } }).line, /free/i);
});

test('a chapter with no cards says so and never hides', () => {
  assert.equal(cardsText(row('x', { cards: 0 })), '');
  assert.equal(metaLine(row('x', { cards: 0 })), 'No Key cards yet. Questions ready.');
  assert.equal(metaLine(row('x', { cards: 0, questions: 0 })), 'Nothing to practise here yet.');
  assert.equal(nothingToPlay(row('x', { cards: 0, questions: 0 })), true);
  assert.equal(nothingToPlay(row('x', { cards: 0 })), false);
  assert.equal(metaLine(row('x', { meta: '3 due, no lesson yet' })), '3 due, no lesson yet');
});

test('a one-chapter unit of the same name has no heading of its own', () => {
  assert.equal(unitHeading({ title: 'Debentures', chapters: [{ title: 'debentures' }] }), null);
  assert.equal(unitHeading({ title: 'Company Accounts', chapters: [{ title: 'Share Capital' }, { title: 'Debentures' }] }), 'Company Accounts');
});

test('the live filter matches chapter, reference and lesson names and drops empty units', () => {
  const out = filterParts(parts, 'share');
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].units.map((u) => u.chapters.map((c) => c.key)), [['d']]);
  assert.equal(filterParts(parts, '  ').length, 2);
  assert.equal(filterParts(parts, 'zzz').length, 0);
});

test('the part switch shows both parts until one is chosen, then only that one', () => {
  const units = parts[1].units;
  assert.deepEqual(shownOptionUnits(units, null).map((u) => u.optionId), ['afs', 'cas']);
  assert.deepEqual(shownOptionUnits(units, 'cas').map((u) => u.optionId), ['cas']);
  assert.equal(effectiveChoice(parts[1], { p2: 'afs' }), 'afs');
  assert.equal(effectiveChoice(parts[1], {}), null);
  assert.equal(effectiveChoice({ id: 'p9', option: { chosen: 'x' } }, {}), 'x');
  assert.notEqual(unitsSignature(shownOptionUnits(units, 'cas')), unitsSignature(shownOptionUnits(units, null)));
});

test('marks open sorts the largest first, with chapters that have no figure last in book order', () => {
  const order = marksOrder(parts).map((x) => x.row.key);
  assert.deepEqual(order, ['b', 'd', 'a', 'c', 'e', 'f', 'g']);
  assert.equal(marksText(row('x', { marksOpen: 35 })), '35 marks');
  assert.equal(marksText(row('x', { marksOpen: null })), '');
  assert.equal(marksText(row('x', { marksOpen: 0 })), '');
});

test('a suggestion starts at once through its run or its href', () => {
  assert.equal(suggestionTarget({ action: { label: 'Start 10 minutes', run: { chapterKey: 'a', minutes: 10, leaveOut: [], kind: 'mix' } } }).type, 'run');
  assert.equal(suggestionTarget({ action: { label: 'Find', href: '/learn/find' } }).type, 'href');
  assert.equal(suggestionTarget({ action: { label: 'x' } }), null);
});

test('three suggestions of three kinds', () => {
  assert.equal(distinctKinds([{ kind: 'start' }, { kind: 'level' }, { kind: 'search' }]), true);
  assert.equal(distinctKinds([{ kind: 'due' }, { kind: 'due' }, { kind: 'fix' }]), false);
});

test('names read as the book reads them', async () => {
  const { displayTitle, kindWord, shortAction } = await import('../homeModel.mjs');
  assert.equal(displayTitle('Retirement/Death of a Partner'), 'Retirement and Death of a Partner');
  assert.equal(displayTitle('Economics / Business Economics'), 'Economics, Business Economics');
  assert.equal(displayTitle('Goodwill: Nature and Valuation'), 'Goodwill: Nature and Valuation');
  assert.equal(kindWord('due'), 'Due');
  assert.equal(shortAction('Revise these'), 'Revise');
  assert.equal(shortAction('Fix them, 10 minutes'), 'Fix, 10 min');
  assert.equal(shortAction('Pick up, 4 minutes'), 'Pick up, 4 min');
});

test('the sorts: due first, needs work first, marks open only with a figure', () => {
  const p = [{ id: 'p', title: 'P', units: [{ title: 'U', optionId: null, chapters: [
    row('a', { due: 0, mistakes: 0, state: { key: 'holding', label: 'Holding' } }),
    row('b', { due: 3, mistakes: 1, state: { key: 'needs_work', label: 'Needs work' } }),
    row('c', { due: 3, mistakes: 4, state: { key: 'none', label: 'Not started' } }),
    row('d', { due: 0, mistakes: 0, state: { key: 'thin', label: 'Too few answers' } }),
    row('e', { due: 1, mistakes: 0, state: { key: 'getting_there', label: 'Getting there' } }),
  ] }] }];
  assert.deepEqual(sortRows(p, 'due').map((x) => x.row.key), ['c', 'b', 'e', 'a', 'd']);
  assert.deepEqual(sortRows(p, 'needs').map((x) => x.row.key), ['b', 'e', 'd', 'c', 'a']);
  assert.deepEqual(sortRows(p, 'book').map((x) => x.row.key), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(sortsFor(p).map((s) => s.id), ['book', 'due', 'needs']);
  assert.deepEqual(sortsFor(parts).map((s) => s.id), ['book', 'due', 'needs', 'marks']);
});

test('a reference shows only where it changes down a unit', () => {
  const rows = [{ ref: 'Ch 1' }, { ref: 'Ch 1' }, { ref: 'Ch 2' }, { ref: 'Ch 2' }, { ref: 'Ch 2' }, { ref: 'Ch 3' }, { ref: null }, { ref: 'Ch 3' }];
  assert.deepEqual(visibleRefs(rows), ['Ch 1', '', 'Ch 2', '', '', 'Ch 3', '', '']);
  assert.deepEqual(visibleRefs(rows.slice(0, 2), { always: true }), ['Ch 1', 'Ch 1']);
});

test('a map of only Not started chapters says so once, and counts its chapters', () => {
  const fresh = [{ id: 'p', title: 'P', units: [{ title: 'U', chapters: [row('a'), row('b'), row('c')] }] }];
  assert.equal(allNotStarted(fresh), true);
  assert.equal(chapterTotal(fresh), 3);
  assert.equal(allNotStarted(parts), true);
  const started = [{ id: 'p', title: 'P', units: [{ title: 'U', chapters: [row('a'), row('b', { state: { key: 'holding', label: 'Holding' } })] }] }];
  assert.equal(allNotStarted(started), false);
  assert.equal(allNotStarted([]), false);
});

test('each choice of the part switch counts its chapters', () => {
  assert.equal(optionChapterCount(parts[1].units, 'afs'), 2);
  assert.equal(optionChapterCount(parts[1].units, 'cas'), 1);
  assert.equal(optionChapterCount(parts[1].units, 'zzz'), 0);
});

test('a suggestion is a bold headline and the rest; the lead keeps its title whole; search is never drawn', () => {
  assert.deepEqual(splitTitle({ title: '3 cards due in Accounting Ratios', headline: '3 cards due' }), { headline: '3 cards due', rest: ' in Accounting Ratios' });
  assert.deepEqual(splitTitle({ title: 'Next in the book: Retirement', headline: 'Next in the book' }), { headline: 'Next in the book', rest: ': Retirement' });
  assert.deepEqual(splitTitle({ title: 'Find your level', headline: 'Find your level' }), { headline: '', rest: 'Find your level' });
  assert.deepEqual(splitTitle({ title: 'Something else', headline: 'Other' }), { headline: '', rest: 'Something else' });
  assert.deepEqual(homeSuggestions([{ kind: 'pickup' }, { kind: 'search' }, { kind: 'due' }]).map((s) => s.kind), ['pickup', 'due']);
});

test('the pick-up track shows only real done and total', () => {
  assert.deepEqual(pickupProgress({ kind: 'pickup', evidence: 'You stopped at 6 of 16. About 5 minutes left.' }), { done: 6, of: 16 });
  assert.deepEqual(pickupProgress({ kind: 'pickup', done: 3, of: 12, evidence: 'x' }), { done: 3, of: 12 });
  assert.deepEqual(pickupProgress({ kind: 'pickup', done: 30, of: 12 }), { done: 12, of: 12 });
  assert.equal(pickupProgress({ kind: 'pickup', evidence: 'Nothing here' }), null);
  assert.equal(pickupProgress({ kind: 'due', evidence: 'You stopped at 6 of 16.' }), null);
});

test('the shelf keys say exactly what they hold, and zero is drawn as zero', () => {
  const keys = shelfKeys({ due: { count: 9, minutes: 2, all: 27 }, missed: { count: 6, days: 14 }, revise: { count: 26, chapters: 3 }, must: { count: 229, chapters: 14 } }, 'Accountancy');
  assert.deepEqual(keys.map((k) => [k.id, k.count, k.title]), [['due', 9, 'Due today'], ['missed', 6, 'Missed lately'], ['revise', 26, 'In Revise']]);
  assert.equal(keys[0].name, 'Due today: 9 Accountancy cards. Show them');
  assert.equal(keys[1].name, 'Missed lately: 6 cards in the last 14 days. Show them');
  assert.equal(keys[2].name, 'In Revise: 26 cards in 3 chapters. Show them');
  // R2 ruling 1 (LK27): a count that is 0 is never drawn; all zero, no keys at all.
  const zero = shelfKeys({ due: { count: 0 }, missed: { count: 0 }, revise: { count: 1, chapters: 1 } });
  assert.deepEqual(zero.map((k) => k.id), ['revise']);
  assert.equal(zero[0].name, 'In Revise: 1 card in 1 chapter. Show them');
  assert.deepEqual(shelfKeys({ due: { count: 0 }, missed: { count: 0 }, revise: { count: 0 } }), []);
  assert.deepEqual(shelfKeys(null), []);
});

test('a roadmap row: coverage through the chapter, the bar share, and "Needs work" as the only verdict', () => {
  const r = roadmapRow({ progress: { of: 46, seen: 31, questions: 10, tried: 4 }, state: { key: 'needs_work' } });
  assert.equal(r.line, '31 of 46 cards seen · 4 of 10 questions tried');
  assert.equal(r.verdict, 'Needs work');
  assert.ok(r.share > 0.67 && r.share < 0.68);
  const fresh = roadmapRow({ progress: { of: 46, seen: 0, questions: 10, tried: 0 }, state: { key: 'none' } });
  assert.equal(fresh.line, '46 cards · 10 questions');
  assert.equal(fresh.verdict, null);
  for (const key of ['getting_there', 'holding', 'thin', 'none']) assert.equal(roadmapRow({ progress: { of: 5, seen: 2, questions: 0, tried: 0 }, state: { key } }).verdict, null);
  assert.equal(roadmapRow({ progress: { of: 5, seen: 2, questions: 0, tried: 0 } }).line, '2 of 5 cards seen');
  assert.doesNotMatch(roadmapRow({ progress: { of: 5, seen: 5, questions: 3, tried: 3 } }).line, /%|master|0 of/i);
});

test('Find with nothing typed: four words to start from, and one line that names the first', () => {
  assert.equal(findHints('accountancy').length, 4);
  assert.equal(findHintLine('accountancy'), 'Search any word from the book, like “goodwill”.');
  assert.deepEqual(findHints('physics'), []);
  assert.equal(findHintLine('physics'), 'Search any word from the book.');
});

test('an opened set has a name and one true line', () => {
  const shelves = { due: { minutes: 2 }, missed: { days: 14 } };
  assert.deepEqual(setHead('due', { count: 9, chapters: 3, shelves }), { title: 'Due today', line: '9 cards in 3 chapters, about 2 min' });
  assert.deepEqual(setHead('missed', { count: 6, chapters: 3, shelves }), { title: 'Missed lately', line: '6 cards in 3 chapters, missed in the last 14 days' });
  assert.deepEqual(setHead('revise', { count: 1, chapters: 1 }), { title: 'In Revise', line: '1 card in 1 chapter' });
  assert.deepEqual(setHead('must', { count: 229, chapters: 14 }), { title: 'Must-know', line: '229 cards in 14 chapters' });
  assert.equal(shelfFromParam('missed'), 'missed');
  assert.equal(shelfFromParam('nonsense'), null);
  assert.equal(shelfFromParam(null), null);
});

test('the field says what it can search; the Free line is kept per India day', () => {
  assert.equal(searchPlaceholder(868), 'Search 868 Key cards');
  assert.equal(searchPlaceholder(0), 'Search chapters and lessons');
  assert.equal(searchPlaceholder(undefined), 'Search Key cards');
  assert.equal(istDay(Date.UTC(2026, 10, 1, 20, 0, 0)), '2026-11-02');
  assert.equal(istDay(Date.UTC(2026, 10, 1, 18, 29, 0)), '2026-11-01');
});

test('R4 ui-correctness#1 and first-timer#1: a Free row shows the real chapter size, not the free count', () => {
  // A Free chapter row as the server sends it: cards 45 in the chapter, 5 open on Free (progress.of), 10 questions.
  const free = { cards: 45, progress: { of: 5, seen: 0, questions: 10, tried: 0 }, state: { key: 'none' } };
  assert.equal(roadmapRow(free).line, '45 cards · 10 questions');
  assert.equal(roadmapRow(free).total, 45, 'a Free row card count equals the chapter total');
  assert.doesNotMatch(roadmapRow(free).line, /free/i);
  // Free-done: the first chapter has its 5 open cards seen and 3 of 10 questions tried; it must not read as finished.
  const done = { cards: 45, progress: { of: 5, seen: 5, questions: 10, tried: 3 }, state: { key: 'getting_there' } };
  assert.equal(roadmapRow(done).line, '5 of 45 cards seen · 3 of 10 questions tried');
  assert.ok(roadmapRow(done).share > 0.11 && roadmapRow(done).share < 0.12, 'the bar reads against the real total');
  // Pro and Free rows of the same chapter agree on the size.
  const pro = { cards: 45, progress: { of: 45, seen: 0, questions: 10, tried: 0 }, state: { key: 'none' } };
  assert.equal(roadmapRow(pro).line, roadmapRow(free).line);
  // Seen never exceeds the total, and an old body without `cards` falls back to progress.of.
  assert.equal(roadmapRow({ cards: 3, progress: { of: 5, seen: 5, questions: 0, tried: 0 } }).line, '3 of 3 cards seen');
  assert.equal(roadmapRow({ progress: { of: 46, seen: 0, questions: 0, tried: 0 } }).line, '46 cards');
});

test('R4 ruling V: "Needs work" says "from your papers" when that is its only evidence', () => {
  assert.equal(verdictText({ state: { key: 'needs_work' }, needsWorkFrom: 'papers' }), 'Needs work, from your papers');
  assert.equal(verdictText({ verdict: 'Needs work', needsWorkFrom: 'papers' }), 'Needs work, from your papers');
  assert.equal(verdictText({ state: { key: 'needs_work' }, needsWorkFrom: 'learn' }), 'Needs work');
  assert.equal(verdictText({ state: { key: 'needs_work' } }), 'Needs work', 'a body without the field reads plainly');
  assert.equal(verdictText({ state: { key: 'holding' }, needsWorkFrom: 'papers' }), null, 'no verdict, no suffix');
  assert.equal(roadmapRow({ cards: 10, progress: { of: 5, seen: 0, questions: 0, tried: 0 }, state: { key: 'needs_work' }, needsWorkFrom: 'papers' }).verdict, 'Needs work, from your papers');
});

test('R4 owner-eye#4 and first-timer#8: until an option is saved, one line names the option the list shows (from data)', () => {
  const choices = [{ id: 'afs', label: 'Analysis of Financial Statements' }, { id: 'ca', label: 'Computerised Accounting' }];
  const unit = (optionId) => ({ optionId, title: optionId, chapters: [{ key: optionId }] });
  const part = { option: { choices }, units: [unit('afs')] };
  assert.equal(impliedOptionLine(part, null), 'Showing Analysis of Financial Statements until you pick.');
  assert.equal(impliedOptionLine({ option: { choices: [choices[1], choices[0]] }, units: [unit('ca')] }, null), 'Showing Computerised Accounting until you pick.', 'the name follows the data');
  assert.equal(impliedOptionLine(part, 'afs'), null, 'a saved choice needs no line');
  assert.equal(impliedOptionLine({ option: { choices }, units: [unit('afs'), unit('ca')] }, null), null, 'both showing needs no line');
  assert.equal(impliedOptionLine({ units: [unit('afs')] }, null), null, 'a part without options');
  assert.equal(impliedOptionLine({ option: { choices }, units: [] }, null), null);
});
