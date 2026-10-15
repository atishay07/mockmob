// node --test src/components/landing/sectionHeadingPhase.test.mjs
// The docking heading on a 390 x 844 phone: band line at 61 + 52 = 113 px.
import test from 'node:test';
import assert from 'node:assert/strict';
import { headingPhase } from './sectionHeadingPhase.mjs';

const phone = { vh: 844, line: 113, titleHeight: 70, hasTrack: true, end: 5000 };

test('the heading reads in full while it sits low on the screen', () => {
  assert.equal(headingPhase({ ...phone, fullTop: 500, titleBottom: 580 }), 'full');
});

test('its sub lifts away once the heading rises past 30% of the window', () => {
  assert.equal(headingPhase({ ...phone, fullTop: 240, titleBottom: 320 }), 'lift');
});

test('the band takes over once the title is half under it, and holds through the story', () => {
  assert.equal(headingPhase({ ...phone, fullTop: 70, titleBottom: 150 }), 'lift');
  assert.equal(headingPhase({ ...phone, fullTop: -40, titleBottom: 147, titleHeight: 70 }), 'compact');
  assert.equal(headingPhase({ ...phone, fullTop: -3000, titleBottom: -2900 }), 'compact');
});

test('at the last step the track ends on the window bottom: the band stays; past it, the band leaves', () => {
  assert.equal(headingPhase({ ...phone, fullTop: -4000, titleBottom: -3900, end: 844 }), 'compact');
  assert.equal(headingPhase({ ...phone, fullTop: -4000, titleBottom: -3900, end: 843 }), 'compact');
  assert.equal(headingPhase({ ...phone, fullTop: -4100, titleBottom: -4000, end: 760 }), 'past');
});

test('coming back up, the same reads give the same phases in reverse', () => {
  const down = [580, 320, 147, -2900].map((titleBottom) => headingPhase({ ...phone, titleBottom, fullTop: titleBottom - 80 }));
  const up = [-2900, 147, 320, 580].map((titleBottom) => headingPhase({ ...phone, titleBottom, fullTop: titleBottom - 80 }));
  assert.deepEqual(up, [...down].reverse());
});

test('a section without a held story keeps the band until its end nears the band', () => {
  const flat = { ...phone, hasTrack: false, fullTop: -900, titleBottom: -800 };
  assert.equal(headingPhase({ ...flat, end: 600 }), 'compact');
  assert.equal(headingPhase({ ...flat, end: 300 }), 'past');
});
