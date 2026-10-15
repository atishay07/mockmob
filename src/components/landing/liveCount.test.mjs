import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRACTISED_IDS, practisedCounts } from './liveCount.mjs';
import { CUET_ALLOWED_SUBJECTS } from '../../../data/cuet_controls.js';

// The hero's live line counts the 15 practised subjects and their questions, never the whole stored bank.

test('the practised ids are the stored ids of the 15 CUET subjects', () => {
  assert.deepEqual([...PRACTISED_IDS].sort(), [...CUET_ALLOWED_SUBJECTS].sort());
  assert.equal(PRACTISED_IDS.length, 15);
  assert.ok(PRACTISED_IDS.includes('gat'));
});

test('subjects outside the 15 are left out of both numbers', () => {
  const counts = { accountancy: 100, gat: 40, english: 60, legacy_quant: 900, some_old_subject: 25 };
  assert.deepEqual(practisedCounts(counts), { questions: 200, subjects: 3 });
});

test('a practised subject with no questions is not counted as a subject', () => {
  assert.deepEqual(practisedCounts({ accountancy: 10, economics: 0, physics: '7' }), { questions: 17, subjects: 2 });
});

test('no usable counts gives null, so the line stays empty', () => {
  assert.equal(practisedCounts(null), null);
  assert.equal(practisedCounts({}), null);
  assert.equal(practisedCounts({ legacy_quant: 500 }), null);
  assert.equal(practisedCounts({ accountancy: 'x' }), null);
});
