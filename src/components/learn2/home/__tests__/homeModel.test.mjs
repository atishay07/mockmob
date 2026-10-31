// node --test src/components/learn2/home/__tests__/homeModel.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { cardsText, distinctKinds, effectiveChoice, filterParts, marksOrder, marksText, metaLine, plural, shownOptionUnits, stateShape, subjectLine, suggestionTarget, unitHeading, unitsSignature } from '../homeModel.mjs';

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
  assert.equal(metaLine(row('x', { cards: 0, questions: 0 })), 'No Key cards yet.');
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
