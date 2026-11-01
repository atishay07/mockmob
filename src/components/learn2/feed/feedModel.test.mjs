// The Explore feed's client rules: one definition of every count, the re-insert, the checkpoint, Up next.
import test from 'node:test';
import assert from 'node:assert/strict';
import { feedNumbers, checkpointText, upNextText, questionPlaces, spliceReinsert, secondsFrom, sheetRows } from './feedModel.mjs';

const card = (id, extra = {}) => ({ id, type: 'card', seconds: 18, card: { front: `Front ${id}` }, ...extra });
const q = (id, extra = {}) => ({ id, type: 'question', origin: 'chapter', seconds: 50, question: { body: `Stem ${id}` }, ...extra });
const ans = (correct) => ({ answer: { res: { correct } } });

test('questions count plain questions only; old mistakes have their own numbers (B7 G, A8 F6)', () => {
  const items = [card('c1'), q('q1'), card('c2'), q('m1', { origin: 'mistake' }), q('q2')];
  const states = { c1: { seen: true, kept: true }, c2: { seen: true }, q1: ans(true), m1: ans(true), q2: ans(false) };
  assert.deepEqual(feedNumbers(items, states), { answered: 2, right: 1, mistakes: 1, fixed: 1, kept: 1, seen: 2 });
});

test('the checkpoint: right of answered, else cards seen and kept; the line only names keeping when something was kept', () => {
  const a = checkpointText({ answered: 3, right: 2, seen: 5, kept: 2 }, { done: 8, of: 21, seconds: 330 });
  assert.equal(a.big, '2 of 3 right');
  assert.equal(a.status, '8 of 21 done. About 6 min left.');
  assert.match(a.line, /already in Revise/);
  const b = checkpointText({ answered: 0, right: 0, seen: 6, kept: 0 }, { done: 8, of: 21, seconds: 0 });
  assert.equal(b.big, '6 cards seen, 0 kept');
  assert.equal(b.line, 'Keep going, or end here.');
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
