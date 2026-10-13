import test from 'node:test';
import assert from 'node:assert/strict';
import { plainOptionTexts } from '../option_text.js';

test('strips a letter that every option carries, in the three stored styles', () => {
  assert.deepEqual(plainOptionTexts([{ text: 'A  7/2' }, { text: 'B  2/7' }, { text: 'C  5' }, { text: 'D  -7/2' }]), ['7/2', '2/7', '5', '-7/2']);
  assert.deepEqual(plainOptionTexts(['A. Planning', 'B. Staffing', 'C. Directing', 'D. Controlling']), ['Planning', 'Staffing', 'Directing', 'Controlling']);
  assert.deepEqual(plainOptionTexts(['A) A-2, B-1', 'B) A-1, B-2', 'C) A-3, B-1', 'D) A-2, B-3']), ['A-2, B-1', 'A-1, B-2', 'A-3, B-1', 'A-2, B-3']);
});

test('leaves real answers alone: a word that starts with a letter, partial prefixes, one or two options', () => {
  const plain = ['A new approach', 'B is smaller', 'Both', 'None'];
  assert.deepEqual(plainOptionTexts(plain), plain);
  assert.deepEqual(plainOptionTexts(['A. Yes', 'No', 'Maybe', 'Never']), ['A. Yes', 'No', 'Maybe', 'Never']);
  assert.deepEqual(plainOptionTexts(['A. Yes', 'C. No', 'B. Maybe', 'D. Never']), ['A. Yes', 'C. No', 'B. Maybe', 'D. Never']);
  assert.deepEqual(plainOptionTexts(['A', 'B', 'C', 'D']), ['A', 'B', 'C', 'D']);
  assert.deepEqual(plainOptionTexts(undefined), []);
});
