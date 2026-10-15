import test from 'node:test';
import assert from 'node:assert/strict';
import {
  edgeEnabled, groupOptions, indexOfValue, listboxKeyAction, normaliseOptions, pageEnabled,
  placePopover, segmentKeyTarget, stepEnabled, typeaheadMatch,
} from './controlsModel.mjs';

const opts = normaliseOptions([
  { value: '', label: 'Choose a subject', disabled: true },
  { value: 'acc', label: 'Accountancy' },
  { value: 'bst', label: 'Business Studies' },
  { value: 'eco', label: 'Economics', disabled: true },
  { value: 'eng', label: 'English' },
  { value: 'ent', label: 'Entrepreneurship' },
]);

test('normalises plain values and keeps labels, groups and disabled', () => {
  const n = normaliseOptions([5, { value: 10, label: '10 min', group: 'Short' }]);
  assert.deepEqual(n[0], { value: 5, label: '5', disabled: false });
  assert.equal(n[1].group, 'Short');
  assert.equal(n[1].disabled, false);
});

test('groups keep order, ungrouped options first (optgroup replacement)', () => {
  const g = groupOptions(normaliseOptions([
    { value: 'a', label: 'A', group: 'Unit 1' }, { value: '', label: 'All chapters' }, { value: 'b', label: 'B', group: 'Unit 2' }, { value: 'c', label: 'C', group: 'Unit 1' },
  ]));
  assert.deepEqual(g.map((s) => s.name), [null, 'Unit 1', 'Unit 2']);
  assert.deepEqual(g[1].items.map((i) => i.index), [0, 3]);
});

test('arrow movement skips disabled options and stops at the ends', () => {
  assert.equal(stepEnabled(opts, 2, 1), 4);
  assert.equal(stepEnabled(opts, 4, -1), 2);
  assert.equal(stepEnabled(opts, 1, -1), 1);
  assert.equal(stepEnabled(opts, 5, 1), 5);
  assert.equal(edgeEnabled(opts), 1);
  assert.equal(edgeEnabled(opts, true), 5);
  assert.equal(edgeEnabled(normaliseOptions([{ value: 1, disabled: true }])), -1);
});

test('page keys land on an enabled option', () => {
  const many = normaliseOptions(Array.from({ length: 30 }, (_, i) => ({ value: i, label: `Row ${i}`, disabled: i === 10 })));
  assert.equal(pageEnabled(many, 0, 1), 9);
  assert.equal(pageEnabled(many, 25, 1), 29);
  assert.equal(pageEnabled(many, 3, -1), 0);
});

test('typeahead finds by prefix, cycles on a repeated letter, ignores disabled', () => {
  assert.equal(typeaheadMatch(opts, 'b', -1), 2);
  assert.equal(typeaheadMatch(opts, 'e', 1), 4);
  assert.equal(typeaheadMatch(opts, 'e', 4), 5);
  assert.equal(typeaheadMatch(opts, 'ee', 5), 4);
  assert.equal(typeaheadMatch(opts, 'ent', 4), 5);
  assert.equal(typeaheadMatch(opts, 'eco', -1), -1);
  assert.equal(typeaheadMatch(opts, 'z', 0), -1);
});

test('select-only combobox keys follow the APG pattern', () => {
  assert.deepEqual(listboxKeyAction('ArrowDown', { open: false }), { type: 'open', focus: 'current-or-first' });
  assert.deepEqual(listboxKeyAction('ArrowUp', { open: false }), { type: 'open', focus: 'current-or-last' });
  assert.deepEqual(listboxKeyAction('End', { open: false }), { type: 'open', focus: 'last' });
  assert.equal(listboxKeyAction('Escape', { open: false }), null);
  assert.equal(listboxKeyAction('Tab', { open: false }), null);
  assert.deepEqual(listboxKeyAction('ArrowDown', { open: true }), { type: 'move', step: 1 });
  assert.deepEqual(listboxKeyAction('ArrowUp', { open: true, altKey: true }), { type: 'select-close' });
  assert.deepEqual(listboxKeyAction('Enter', { open: true }), { type: 'select-close' });
  assert.deepEqual(listboxKeyAction('Tab', { open: true }), { type: 'select-close', keepDefault: true });
  assert.deepEqual(listboxKeyAction('Escape', { open: true }), { type: 'close' });
  assert.deepEqual(listboxKeyAction('PageDown', { open: true }), { type: 'page', step: 1 });
});

test('segmented keys rove over enabled options and wrap', () => {
  const seg = normaliseOptions([{ value: 'auto' }, { value: 'easy', disabled: true }, { value: 'medium' }, { value: 'hard' }]);
  assert.equal(segmentKeyTarget(seg, 0, 'ArrowRight'), 2);
  assert.equal(segmentKeyTarget(seg, 3, 'ArrowRight'), 0);
  assert.equal(segmentKeyTarget(seg, 0, 'ArrowLeft'), 3);
  assert.equal(segmentKeyTarget(seg, 2, 'Home'), 0);
  assert.equal(segmentKeyTarget(seg, 0, 'End'), 3);
  assert.equal(segmentKeyTarget(seg, -1, 'ArrowRight'), 0);
  assert.equal(segmentKeyTarget(seg, 0, 'Enter'), null);
  assert.equal(segmentKeyTarget(normaliseOptions([{ value: 1, disabled: true }]), 0, 'ArrowRight'), null);
});

test('value lookup works for numbers and empty strings', () => {
  const n = normaliseOptions([{ value: '' , label: 'All' }, 10, 20]);
  assert.equal(indexOfValue(n, ''), 0);
  assert.equal(indexOfValue(n, 20), 2);
  assert.equal(indexOfValue(n, 'x'), -1);
});

test('popover opens below, flips above when the room below is short, and stays on screen', () => {
  const viewport = { width: 390, height: 800 };
  const low = placePopover({ top: 700, bottom: 748, left: 300, width: 160 }, viewport);
  assert.equal(low.placement, 'top');
  assert.equal(low.bottom, 800 - 700 + 6);
  assert.ok(low.left + low.width <= 390 - 12);
  const high = placePopover({ top: 100, bottom: 148, left: 16, width: 358 }, viewport);
  assert.equal(high.placement, 'bottom');
  assert.equal(high.top, 154);
  assert.equal(high.width, 358);
  assert.ok(high.maxHeight <= 340);
});
