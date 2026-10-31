// node --test src/components/learn2/print/printModel.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { printCards, rowPrints } from './printModel.mjs';
import { shelfView } from '../chapter/chapterModel.mjs';

test('only open Must-know cards are printed, in order', () => {
  const cards = [{ id: 1, importance: 'must' }, { id: 2, importance: 'good' }, { id: 3, importance: 'must', locked: true }, { id: 4, importance: 'must' }];
  assert.deepEqual(printCards(cards).map((c) => c.id), [1, 4]);
  assert.deepEqual(printCards(undefined), []);
});

test('Pro\'s print row prints, Free\'s stays the Pro line', () => {
  const base = { cards: { count: 5 }, questions: { total: 0 }, mistakes: { open: 0 }, lesson: null };
  const pro = shelfView({ shelf: { ...base, print: { mustKnow: 5, locked: false } } }).rows.find((r) => r.id === 'print');
  const free = shelfView({ shelf: { ...base, print: { mustKnow: 5, locked: true } } }).rows.find((r) => r.id === 'print');
  assert.equal(rowPrints(pro), true);
  assert.equal(pro.link, false);
  assert.equal(rowPrints(free), false);
  assert.equal(free.link, true);
});
