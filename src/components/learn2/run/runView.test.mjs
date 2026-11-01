// node --test src/components/learn2/run/runView.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { FREE_END_LINE, checkpointLines, endHeadline, endNumbers, endProgress, pileFrontSize, reviseLabel, stopSheetLine } from '../stage/endModel.mjs';
import { answerTally, endLines, endTitle, freeEndLines, frontStep, itemsFinished, leadView, movedParts, placeReinsert, positionWords, reviseSummary, rightLine, runPiles, stageTag, stateKeyOf } from './runView.mjs';

const card = (id, cardId = id, extra = {}) => ({ id, type: 'card', card: { id: cardId }, ...extra });
const q = (id, origin = 'chapter') => ({ id, type: 'question', origin, question: { id: `q-${id}` } });

test('frontStep follows the length steps of B1', () => {
  assert.equal(frontStep('What is partnership?'), 's');
  assert.equal(frontStep('x'.repeat(61)), 'm');
  assert.equal(frontStep('x'.repeat(121)), 'l');
});

test('stageTag says why a card is here, and nothing in a recap', () => {
  assert.equal(stageTag({ stage: 'due' }), 'Due today');
  assert.equal(stageTag({ reason: 'line' }), 'The line you needed');
  assert.equal(stageTag({ reason: 'earlier' }), 'Back from earlier');
  assert.equal(stageTag({ stage: 'again', again: true }), 'Back from earlier');
  assert.equal(stageTag({ stage: 'due' }, { recap: true }), null);
  assert.equal(stageTag({ stage: 'new' }), null);
});

test('runPiles counts distinct cards, marks the current pile, and says "left" on a resumed run', () => {
  const items = [card('i1', 'c1'), card('i2', 'c2'), q('i3'), card('i4', 'c1', { again: true }), q('i5', 'mistake')];
  const piles = runPiles(items, 3, { at: 3 });
  assert.deepEqual(piles.map((p) => [p.id, p.label, p.value, p.current]), [['cards', 'Key cards', '2 of 2', true], ['questions', 'Questions', '1 of 1', false], ['mistakes', '1 old mistake', '', false]]);
  const resumed = runPiles(items, 0, { resumed: true });
  assert.equal(resumed[0].value, '2 left');
  // R2 screens 10: before anything is done, the rail reads totals, never a column of zeros.
  const fresh = runPiles([...items, card('i6', 'c3')], 0, { at: 0 });
  assert.deepEqual(fresh.map((p) => p.label), ['3 Key cards', '1 question', '1 old mistake']);
  for (const p of fresh) assert.doesNotMatch(`${p.label} ${p.value}`, /(^|\s)0( |$)/);
});

test('answerTally keeps plain questions and old mistakes apart, with the streak', () => {
  const items = [q('a'), q('b'), q('c'), q('m', 'mistake')];
  const answers = { a: { result: { correct: true } }, b: { result: { correct: true } }, c: { result: { correct: true } }, m: { result: { correct: false } } };
  const t = answerTally(items, answers);
  assert.deepEqual(t, { answered: 3, right: 3, tried: 1, fixed: 0, streak: 0 });
  assert.equal(answerTally(items.slice(0, 3), answers).streak, 3);
  assert.equal(rightLine(3), 'Right. 3 in a row.');
  assert.equal(rightLine(2), 'Right.');
});

test('positionWords names the item for the live region', () => {
  assert.equal(positionWords({ type: 'card' }, 3, 21), 'Card 3 of 21');
  assert.equal(positionWords({ type: 'question' }, 4, 21), 'Question 4 of 21');
});

test('placeReinsert moves a card already ahead (never a copy) and puts a new one 3 later, after a resume too (A8 F9, F11)', () => {
  const list = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id }));
  const moved = placeReinsert(list, { itemId: 'f', at: 3, moved: true }, { current: 0 });
  assert.deepEqual(moved.map((x) => x.id), ['a', 'b', 'c', 'f', 'd', 'e']);
  assert.equal(moved.length, list.length);
  const copy = placeReinsert(list, { itemId: 'r1', at: 4, item: { type: 'card' } }, { current: 1 });
  assert.deepEqual(copy.map((x) => x.id), ['a', 'b', 'c', 'd', 'r1', 'e', 'f']);
  const twice = placeReinsert(copy, { itemId: 'r1', at: 4, item: { type: 'card' } }, { current: 1 });
  assert.equal(twice, copy);
  // A resumed run holds only the items after `offset`; the server's place is in the whole list.
  const resumed = placeReinsert(list, { itemId: 'r2', at: 12, item: {} }, { current: 0, offset: 10 });
  assert.deepEqual(resumed.map((x) => x.id), ['a', 'b', 'r2', 'c', 'd', 'e', 'f']);
  // Never before the item on screen.
  const early = placeReinsert(list, { itemId: 'r3', at: 0, item: {} }, { current: 2 });
  assert.equal(early.findIndex((x) => x.id === 'r3'), 3);
});

test('the end reads lines, not repeated numbers (A4 3.4.2)', () => {
  const d = {
    numbers: { cards: 16, questions: 3, fixed: 1, mistakes: 2, detail: { cards: '16 got it' } },
    lines: [{ label: 'Cards', text: '16 got it' }, { label: 'Questions', text: '3 of 3 right' }, { label: 'Mistakes', text: '1 of 2 fixed, 1 still open' }],
  };
  assert.deepEqual(endLines(d), [
    { label: 'Key cards', value: '16 rated, all got it' },
    { label: 'Questions', value: '3 of 3 right' },
    { label: 'Old mistakes', value: '1 of 2 fixed, 1 still open' },
  ]);
  const mixed = endLines({ numbers: { cards: 4, mistakes: 0, detail: { cards: '2 got it, 1 easy, 1 missed' } }, lines: [{ label: 'Cards', text: '2 got it, 1 easy, 1 missed, 2 looked at' }, { label: 'Mistakes', text: '0 of 2 fixed, 2 still open' }] });
  assert.deepEqual(mixed, [{ label: 'Key cards', value: '4 rated: 2 got it, 1 easy, 1 missed, 2 looked at' }]);
});

test('the Revise summary, the moved line and the state keys', () => {
  assert.deepEqual(reviseSummary([{ label: 'back on Wed', count: 14 }, { label: 'back in 20 days', count: 2 }]), { total: 16, line: '14 back Wed, 2 back in 20 days' });
  assert.deepEqual(movedParts('Admission of a Partner moved from Getting there to Holding.'), { from: 'Getting there', to: 'Holding' });
  assert.equal(movedParts(null), null);
  assert.equal(stateKeyOf('Getting there'), 'getting_there');
});

test('the lead names its length on a run and its own verb otherwise; Free splits its line', () => {
  assert.deepEqual(leadView({ kind: 'next', title: 'Next: Goodwill', minutes: 10, evidence: 'The next chapter in your book.', run: { kind: 'mix', minutes: 10 } }), { heading: 'Next: Goodwill', reason: 'The next chapter in your book.', key: 'Start 10 minutes' });
  assert.deepEqual(leadView({ kind: 'revise', title: 'Revise 12 due cards', minutes: 3, href: '/review/revise' }), { heading: null, reason: null, key: 'Revise 12 due cards' });
  assert.deepEqual(freeEndLines({ line: 'Your free Learn session for today is done. Explore questions stay free. Pro has as many as you like.' }), { head: 'Your free Learn session for today is done.', rest: 'Explore questions stay free. Pro has as many as you like.' });
  assert.deepEqual(endTitle('10 minutes on Goodwill'), { lead: '10 minutes on', name: 'Goodwill' });
  assert.deepEqual(endTitle('Quick recap of Goodwill', { kind: 'recap' }), { lead: 'Quick recap of', name: 'Goodwill' });
});

test('itemsFinished counts the item on screen once the server has it, so the stop sheet matches the end screen', () => {
  const c = card('c1');
  const question = q('q1');
  // Before the card is rated: only the items before it.
  assert.equal(itemsFinished({ phase: 'play', at: 3, length: 10, item: c }), 3);
  // Rated and confirmed, still flying away: the server already counts it, so the sheet does too.
  assert.equal(itemsFinished({ phase: 'play', at: 3, length: 10, item: c, acted: true }), 4);
  // A question counts once answered, not before.
  assert.equal(itemsFinished({ phase: 'play', at: 5, length: 10, item: question }), 5);
  assert.equal(itemsFinished({ phase: 'play', at: 5, length: 10, item: question, answered: true }), 6);
  // An unanswered card is never counted by "answered" alone.
  assert.equal(itemsFinished({ phase: 'play', at: 2, length: 10, item: c, answered: true }), 2);
  // Off the play screen every item of the list is finished.
  assert.equal(itemsFinished({ phase: 'end', at: 2, length: 10, item: null }), 10);
});

// ---------------------------------------------------------------- R2 ruling 5: the end formula, never a zero

test('R2 end formula: the headline says how far, never a zero', () => {
  assert.equal(endHeadline({ reached: 20, of: 20, minutes: 9 }), '20 done in 9 min');
  assert.equal(endHeadline({ reached: 20, of: 20 }), '20 done');
  assert.equal(endHeadline({ reached: 7, of: 20, minutes: 3 }), 'Stopped at 7 of 20');
  assert.equal(endHeadline({ reached: 20, of: 20, stopped: true }), 'Stopped at 20 of 20');
  assert.equal(endHeadline({ reached: 0, of: 20 }), null, 'nothing done leads with the chapter, not "0"');
  assert.equal(endHeadline({ reached: 3, of: 0 }), null);
});

test('R2 end formula: up to 3 numbers, every zero dropped, "0 of N" turned into a count of tries', () => {
  assert.deepEqual(endNumbers({ revise: 16, reviseText: reviseLabel([{ label: 'back on Wed', count: 14 }, { label: 'back in 20 days', count: 2 }]), answered: 2, right: 2, mistakes: 2, fixed: 1 }), [
    { value: '16', n: 16, label: 'in Revise, back Wed' },
    { value: '2 of 2', n: 2, label: 'questions right' },
    { value: '1 of 2', n: 1, label: 'mistakes fixed' },
  ]);
  assert.deepEqual(endNumbers({ revise: 0, seen: 12, answered: 3, right: 3 }).map((x) => [x.value, x.label]), [['12', 'cards seen'], ['3 of 3', 'questions right']]);
  assert.deepEqual(endNumbers({ answered: 2, right: 0, mistakes: 1, fixed: 0 }).map((x) => [x.value, x.label]), [['2', 'questions tried'], ['1', 'mistake tried']]);
  assert.deepEqual(endNumbers({}), []);
  const all = [endNumbers({ revise: 0, seen: 0, answered: 0, mistakes: 0 }), endNumbers({ revise: 3, seen: 5, answered: 4, right: 0, mistakes: 2, fixed: 0 }), endNumbers({ answered: 1, right: 1 })].flat();
  for (const x of all) assert.ok(x.n > 0 && !/^0( |$)/.test(x.value), `no zero: ${x.value}`);
  assert.ok(endNumbers({ revise: 1, answered: 1, right: 1, mistakes: 1, fixed: 1, seen: 9 }).length <= 3);
  assert.equal(reviseLabel([]), 'in Revise');
});

test('R2 end formula: the progress bar grows from before to now, and is absent when nothing is seen', () => {
  assert.deepEqual(endProgress({ of: 46, seen: 31, before: 15 }), { from: 15 / 46, to: 31 / 46, label: '31 of 46 cards seen' });
  assert.equal(endProgress({ of: 46, seen: 0, before: 0 }), null);
  assert.equal(endProgress(null), null);
  assert.equal(endProgress({ of: 10, seen: 12, before: 30 }).to, 1);
});

test('R2: the stop sheet, the checkpoint and the Free line say it once, with no zero', () => {
  assert.equal(stopSheetLine(5, 20), '5 of 20 done. It\u2019s all saved.');
  assert.equal(checkpointLines({ answered: 1, right: 1 }, { done: 8, of: 17, left: 'About 6 min left' }).line, '8 of 17 done, about 6 min left.');
  assert.equal(FREE_END_LINE, 'That was today\u2019s free session. Pro has no daily limit.');
  assert.equal(pileFrontSize('The Partnership Act does not require'), 13);
  assert.equal(pileFrontSize('Interest on capital is a charge, appropriation'), 12);
});
