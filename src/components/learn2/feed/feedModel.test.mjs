// The Explore feed's client rules: one definition of every count, the re-insert, the checkpoint, Up next.
import test from 'node:test';
import assert from 'node:assert/strict';
import { feedNumbers, checkpointText, upNextText, questionPlaces, spliceReinsert, secondsFrom, sheetRows, stoppedCount, itemsDone, feedHeld, continueKey } from './feedModel.mjs';
import { reachedPlace, stopSheetLine } from '../stage/endModel.mjs';

const card = (id, extra = {}) => ({ id, type: 'card', seconds: 18, card: { front: `Front ${id}` }, ...extra });
const q = (id, extra = {}) => ({ id, type: 'question', origin: 'chapter', seconds: 50, question: { body: `Stem ${id}` }, ...extra });
const ans = (correct) => ({ answer: { res: { correct } } });

test('questions count plain questions only; old mistakes have their own numbers (B7 G, A8 F6)', () => {
  const items = [card('c1'), q('q1'), card('c2'), q('m1', { origin: 'mistake' }), q('q2')];
  const states = { c1: { seen: true, kept: true }, c2: { seen: true }, q1: ans(true), m1: ans(true), q2: ans(false) };
  assert.deepEqual(feedNumbers(items, states), { answered: 2, right: 1, mistakes: 1, fixed: 1, kept: 1, seen: 2 });
});

test('the checkpoint: one headline that never leads with a zero, and one line (R2 screens 12)', () => {
  const a = checkpointText({ answered: 3, right: 2, seen: 5, kept: 2 }, { done: 8, of: 21, seconds: 330 });
  assert.equal(a.big, '2 of 3 right');
  assert.equal(a.status, '8 of 21 done, about 6 min left.');
  assert.equal(a.line, null);
  const b = checkpointText({ answered: 0, right: 0, seen: 6, kept: 0 }, { done: 8, of: 21, seconds: 0 });
  assert.equal(b.big, '6 cards seen');
  assert.equal(b.status, '8 of 21 done.');
  assert.equal(checkpointText({ answered: 2, right: 0 }, { done: 4, of: 9, seconds: 0 }).big, '2 questions tried');
  assert.equal(checkpointText({ answered: 0, seen: 3, kept: 1 }, { done: 4, of: 9, seconds: 0 }).big, '1 for Revise');
  for (const x of [a, b]) assert.doesNotMatch(`${x.big} ${x.status}`, /(^|\s)0 /);
});

test('Up next names the next slot', () => {
  assert.equal(upNextText({ type: 'item', item: card('c') }), 'Up next: a Key card');
  assert.equal(upNextText({ type: 'item', item: q('q') }), 'Up next: a question');
  assert.equal(upNextText({ type: 'item', item: q('m', { origin: 'mistake', mistake: { label: 'You missed this in Mock 4 on 24 Oct' } }) }), 'Up next: a question you missed in Mock 4 on 24 Oct');
  assert.equal(upNextText({ type: 'checkpoint' }), 'Up next: a checkpoint');
  assert.equal(upNextText({ type: 'end' }), 'Up next: how it went');
  assert.equal(upNextText(null), null);
});

test('question places skip old mistakes; seconds sum from a place', () => {
  const items = [card('c1'), q('q1'), q('m1', { origin: 'mistake' }), q('q2')];
  assert.deepEqual(questionPlaces(items).get('q2'), { n: 2, of: 2 });
  assert.equal(questionPlaces(items).has('m1'), false);
  assert.equal(secondsFrom(items, 2), 100);
});

test('re-insert: a copy goes in once at its place; a moved card moves and is never duplicated (A8 F9, F18)', () => {
  const list = [card('i1'), q('i2'), card('i3'), card('i4'), card('i5'), card('i6'), card('i7')];
  const copy = spliceReinsert(list, { answeredId: 'i2', reinsert: { itemId: 'r1', at: 4, item: card('r1') } });
  assert.deepEqual(copy.map((x) => x.id), ['i1', 'i2', 'i3', 'i4', 'r1', 'i5', 'i6', 'i7']);
  assert.equal(spliceReinsert(copy, { answeredId: 'i2', reinsert: { itemId: 'r1', at: 4, item: card('r1') } }), copy);
  const moved = spliceReinsert(list, { answeredId: 'i2', reinsert: { itemId: 'i7', at: 4, moved: true, item: card('i7') } });
  assert.deepEqual(moved.map((x) => x.id), ['i1', 'i2', 'i3', 'i4', 'i7', 'i5', 'i6']);
  assert.equal(moved.filter((x) => x.id === 'i7').length, 1);
  const closer = spliceReinsert(list, { answeredId: 'i2', reinsert: { itemId: 'i3', at: 2, moved: true } });
  assert.equal(closer, list);
});

test('re-insert in a resumed feed goes three after the answered item (A8 F11)', () => {
  const list = [q('i9'), card('i10'), card('i11'), card('i12'), card('i13')];
  const out = spliceReinsert(list, { answeredId: 'i9', reinsert: { itemId: 'r1', at: 11, item: card('r1') }, resumed: true });
  assert.deepEqual(out.map((x) => x.id), ['i9', 'i10', 'i11', 'r1', 'i12', 'i13']);
});

test('the phone sheet rows carry the state of each item', () => {
  const rows = sheetRows([card('c1'), q('q1'), q('q2')], { c1: { kept: true }, q1: ans(false) }, 3);
  assert.deepEqual(rows.map((r) => [r.n, r.kind, r.state]), [[4, 'Key card', 'kept'], [5, 'Question', 'wrong'], [6, 'Question', null]]);
});

// explore-learn-calm-2: one count of "done" for the checkpoint, the Close stop sheet and the stopped end.
const heldOf = (states) => (i) => feedHeld(i, states[i.id]);

test('the checkpoint count equals the stopped end count, with one card kept', () => {
  const items = Array.from({ length: 16 }, (_, i) => card(`c${i + 1}`));
  const states = { c1: { seen: true, kept: true }, c2: { seen: true }, c3: { seen: true }, c4: { seen: true }, c5: { seen: true }, c6: { seen: true }, c7: { seen: true }, c8: { seen: true } };
  const itemsDone = reachedPlace(items, heldOf(states), 0);
  assert.equal(itemsDone, 1);
  const done = stoppedCount(16, itemsDone);
  const cp = checkpointText(feedNumbers(items, states), { done, of: 16, seconds: 160 });
  assert.equal(cp.status, '1 of 16 done, about 3 min left.');
  assert.equal(stopSheetLine(done, 16), '1 of 16 done. It’s all saved.');
  assert.equal(cp.status.split(' of ')[0], String(stoppedCount(16, itemsDone)), 'the stopped end prints the same number');
});

test('the checkpoint count equals the stopped end count, with nothing held, and never prints a zero', () => {
  const items = Array.from({ length: 16 }, (_, i) => card(`c${i + 1}`));
  const states = Object.fromEntries(items.slice(0, 8).map((x) => [x.id, { seen: true }]));
  const itemsDone = reachedPlace(items, heldOf(states), 0);
  assert.equal(itemsDone, 0);
  const done = stoppedCount(16, itemsDone);
  assert.equal(done, 0);
  const cp = checkpointText(feedNumbers(items, states), { done, of: 16, seconds: 330 });
  assert.equal(cp.big, '8 cards seen');
  assert.equal(cp.status, 'About 6 min left.');
  assert.doesNotMatch(`${cp.big} ${cp.status}`, /(^|\s)0 /);
  assert.equal(checkpointText(feedNumbers(items, {}), { done: 0, of: 16, seconds: 0 }).status, '');
});

test('stoppedCount caps at the feed length and never goes below zero', () => {
  assert.equal(stoppedCount(10, 12), 10);
  assert.equal(stoppedCount(10, 0), 0);
  assert.equal(stoppedCount(10, undefined), 0);
});

// Walk I4: a Key card turned over counts as done (with a kept card or an answered question); a question only skipped does not.
test('I4: a turned card is done on the checkpoint, the stop sheet and the stopped end; a skipped question is not', () => {
  const items = Array.from({ length: 16 }, (_, i) => card(`c${i + 1}`));
  const states = { c1: { seen: true }, c2: { seen: true, turned: true, seenBack: true }, c3: { seen: true } };
  assert.equal(itemsDone(items, states, 0), 2, 'the last turned card sets the place');
  const done = stoppedCount(16, itemsDone(items, states, 0));
  const cp = checkpointText(feedNumbers(items, states), { done, of: 16, seconds: 160 });
  assert.equal(cp.status, '2 of 16 done, about 3 min left.');
  assert.equal(stopSheetLine(done, 16), '2 of 16 done. It’s all saved.');
  assert.equal(cp.big, '3 cards seen', 'the checkpoint big number is unchanged');
  assert.equal(itemsDone(items, { c1: { turned: true } }, 4), 5, 'a resumed feed adds its prefix');
  assert.equal(itemsDone(items, { c1: { seen: true } }, 0), 0, 'only seen is not done');
});

test('I4: a question only skipped is still not done; a kept card and an answered question are', () => {
  const items = [q('q1'), card('c1'), q('q2'), card('c2')];
  assert.equal(itemsDone(items, { q1: { skipped: true } }, 0), 0);
  assert.equal(itemsDone(items, { q1: { skipped: true }, c1: { kept: true } }, 0), 2);
  assert.equal(itemsDone(items, { q1: ans(true), c1: { seen: true }, q2: { skipped: true } }, 0), 1);
  assert.equal(itemsDone(items, { q1: ans(false), c1: { turned: true }, q2: ans(true) }, 0), 3);
  assert.equal(feedHeld(items[0], { skipped: true }), false);
  assert.equal(feedHeld(items[1], { seenBack: true }), true);
});

// Walk I12: the end key's minutes are the checkpoint's own figure.
test('I12: the stopped end key says the checkpoint minutes for the rest of the feed', () => {
  const items = Array.from({ length: 20 }, (_, i) => card(`c${i + 1}`));
  const rest = secondsFrom(items, 8);
  const cp = checkpointText(feedNumbers(items, {}), { done: 0, of: 20, seconds: rest });
  const minutes = Number(/about (\d+) min left/i.exec(cp.status)[1]);
  assert.equal(continueKey('Continue · 9 min', rest), `Continue · ${minutes} min`);
  assert.equal(continueKey('Continue · 9 min', rest), 'Continue · 4 min');
  assert.equal(continueKey('Continue · 9 min', 20), 'Continue · 1 min');
  assert.equal(continueKey('Continue · 9 min', 0), 'Continue · 9 min', 'no seconds left keeps the server label');
  assert.equal(continueKey('Keep going · 10 min', rest), 'Keep going · 10 min', 'only a Continue key');
});
