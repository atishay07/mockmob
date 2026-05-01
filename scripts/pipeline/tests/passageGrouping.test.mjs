import test from 'node:test';
import assert from 'node:assert/strict';
import { canPublishPassageGroup } from '../lib/passageNormalizer.mjs';

test('passage group requires at least three validated children', () => {
  const group = { passage_text: 'A mature passage with enough detail for linked questions.' };
  assert.equal(canPublishPassageGroup([{}, {}], group), false);
  assert.equal(canPublishPassageGroup([{}, {}, {}], group), true);
});

test('child without parent passage metadata cannot publish as group', () => {
  assert.equal(canPublishPassageGroup([{}, {}, {}], {}), false);
});

test('order_index can be preserved by sorting children', () => {
  const sorted = [{ order_index: 3 }, { order_index: 1 }, { order_index: 2 }]
    .sort((a, b) => Number(a.order_index) - Number(b.order_index));
  assert.deepEqual(sorted.map((item) => item.order_index), [1, 2, 3]);
});
