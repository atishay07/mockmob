import test from 'node:test';
import assert from 'node:assert/strict';
import { feedWindow, advanceFeedPage, appendUniqueQuestions, chapterGroups, questionFeedback,feedOptions } from '../explore_feed.js';

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

test('factory string options retain a usable answer and explicit keyed legacy options keep their identity',()=>{
  const q={options:['North','South','East','West'],correct_answer:'C'};
  assert.equal(questionFeedback(q,'C').state,'correct');assert.equal(questionFeedback(q,'B').state,'incorrect');
  assert.deepEqual(feedOptions(q.options)[2],{key:'C',text:'East'});
  const legacy={options:[{key:0,text:'Zero'},{key:1,text:'One'}],correct_answer:0};
  assert.equal(questionFeedback(legacy,0).state,'correct');assert.equal(feedOptions(legacy.options)[0].key,0);
});

test('dictionary options retain their explicit keys rather than acquiring array positions',()=>{
  const q={options:{D:'Delta',B:'Beta',A:'Alpha',C:'Gamma'},correct_answer:'B'};
  assert.equal(questionFeedback(q,'B').state,'correct');assert.deepEqual(feedOptions(q.options)[0],{key:'D',text:'Delta'});
});
