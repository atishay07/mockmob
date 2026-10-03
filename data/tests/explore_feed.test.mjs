import test from 'node:test';
import assert from 'node:assert/strict';
import { feedWindow, advanceFeedPage, appendUniqueQuestions, chapterGroups, questionFeedback } from '../explore_feed.js';

test('raw page boundary advances even when every row is quarantined', () => {
  assert.deepEqual(advanceFeedPage(20, 20, 20), { nextOffset: 40, hasMore: true });
  assert.deepEqual(advanceFeedPage(40, 20, 3), { nextOffset: 43, hasMore: false });
});
test('feed bounds reject non-numeric and oversized windows', () => {
  assert.deepEqual(feedWindow('no', 'NaN'), { limit: 20, offset: 0 });
  assert.deepEqual(feedWindow(1000, -50), { limit: 50, offset: 0 });
});
test('vote-driven reordering cannot duplicate a question already on screen', () => {
  assert.deepEqual(appendUniqueQuestions([{ id: 'a' }], [{ id: 'a' }, { id: 'b' }, { id: 'b' }]), [{ id: 'a' }, { id: 'b' }]);
});
test('chapter selectors accept grouped and flat API contracts', () => {
  const chapters = [{ id: 'x', name: 'Revaluation' }];
  assert.deepEqual(chapterGroups({ grouped: true, units: [{ name: 'Partnership', chapters }] }), [{ name: 'Partnership', chapters }]);
  assert.deepEqual(chapterGroups({ grouped: false, chapters }), [{ name: 'Chapters', chapters }]);
});
test('feedback abstains on missing key and distinguishes revealing from an answer', () => {
  const q = { options: [{ key: 'A' }, { key: 'B' }], correct_answer: 'B' };
  assert.equal(questionFeedback(q, 'B').state, 'correct');
  assert.equal(questionFeedback(q, 'A').state, 'incorrect');
  assert.equal(questionFeedback(q, null).state, 'revealed');
  assert.equal(questionFeedback({ ...q, correct_answer: 'C' }, 'A').state, 'unavailable');
});
