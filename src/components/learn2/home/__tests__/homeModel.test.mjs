// node --test src/components/learn2/home/__tests__/homeModel.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allNotStarted, cardsText, chapterTotal, distinctKinds, effectiveChoice, filterParts, homeSuggestions, istDay, marksOrder, marksText, metaLine, nothingToPlay, optionChapterCount, pickupProgress, plural,
  searchPlaceholder, setHead, shelfFromParam, shelfKeys, shownOptionUnits, sortRows, sortsFor, splitTitle, stateShape, subjectLine, suggestionTarget, unitHeading, unitsSignature, visibleRefs,
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

test('the subject line says only counts that are real', () => {
  assert.equal(subjectLine({ cards: 868, chapters: 14, lessons: 4 }), '868 Key cards, 14 chapters, 4 lessons');
  assert.equal(subjectLine({ cards: 1, chapters: 1, lessons: 0 }), '1 Key card, 1 chapter');
  assert.equal(plural(2, 'card'), '2 cards');
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
  assert.equal(marksText(row('x', { marksOpen: 35 })), '−35');
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
  assert.deepEqual(keys.map((k) => [k.id, k.count, k.label]), [['due', 9, 'due today'], ['missed', 6, 'missed lately'], ['revise', 26, 'in Revise']]);
  assert.equal(keys[0].name, 'Due today: 9 Accountancy cards. Show them');
  assert.equal(keys[1].name, 'Missed lately: 6 cards in the last 14 days. Show them');
  assert.equal(keys[2].name, 'In Revise: 26 cards in 3 chapters. Show them');
  const zero = shelfKeys({ due: { count: 0 }, missed: { count: 0 }, revise: { count: 1, chapters: 1 } });
  assert.deepEqual(zero.map((k) => k.zero), [true, true, false]);
  assert.equal(zero[0].name, 'No cards due today');
  assert.equal(zero[1].name, 'None missed lately');
  assert.equal(zero[2].name, 'In Revise: 1 card in 1 chapter. Show them');
  assert.deepEqual(shelfKeys(null), []);
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
