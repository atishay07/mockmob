// node --test src/components/landing/sectionHeadingPhase.test.mjs
// The docking heading on a 390 x 844 phone: band line at 61 + 52 = 113 px.
import test from 'node:test';
import assert from 'node:assert/strict';
import { headingPhase } from './sectionHeadingPhase.mjs';

const phone = { vh: 844, line: 113, hasTrack: true, end: 5000 };
// The sub sits 60 px under the title's bottom.
const at = (titleBottom, extra = {}) => headingPhase({ ...phone, titleBottom, restBottom: titleBottom + 60, ...extra });

test('the heading reads in full, sub and all, wherever it rests below the band', () => {
  assert.equal(at(580), 'full');
  assert.equal(at(320), 'full');
  assert.equal(at(150), 'full');
  assert.equal(at(114), 'full');
});

test('the band takes over once the title has gone under it; the sub stays until it has gone under too', () => {
  assert.equal(at(113), 'compact');
  assert.equal(at(80), 'compact');
  assert.equal(at(53), 'docked');
  assert.equal(at(-2900), 'docked');
});

test('a heading without a sub docks in one go once its title has gone under the band', () => {
  assert.equal(headingPhase({ ...phone, titleBottom: 147 }), 'full');
  assert.equal(headingPhase({ ...phone, titleBottom: 100 }), 'docked');
});

test('at the last step the track ends on the window bottom: the band stays; past it, the band leaves', () => {
  assert.equal(at(-3900, { end: 844 }), 'docked');
  assert.equal(at(-3900, { end: 843 }), 'docked');
  assert.equal(at(-4000, { end: 760 }), 'past');
});

test('coming back up, the same reads give the same phases in reverse', () => {
  const marks = [580, 320, 114, 113, 80, 53, -2900];
  const down = marks.map((titleBottom) => at(titleBottom));
  const up = [...marks].reverse().map((titleBottom) => at(titleBottom));
  assert.deepEqual(up, [...down].reverse());
});

test('a section without a held story keeps the band until its end nears the band', () => {
  const flat = { hasTrack: false };
  assert.equal(at(-800, { ...flat, end: 600 }), 'docked');
  assert.equal(at(-800, { ...flat, end: 300 }), 'past');
});
