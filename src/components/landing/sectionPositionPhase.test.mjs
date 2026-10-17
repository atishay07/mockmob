// node --test src/components/landing/sectionPositionPhase.test.mjs
// The position band on a 390 x 844 phone: the site bar is 61 px and the band 40 px, so its bottom edge is at 101.
import test from 'node:test';
import assert from 'node:assert/strict';
import { positionAt, positionPhase, positionProgress } from './sectionPositionPhase.mjs';

const phone = { vh: 844, line: 101, hasTrack: true, end: 5000 };
const at = (titleBottom, extra = {}) => positionPhase({ ...phone, titleBottom, ...extra });

test('the band stays out of the way while the heading still reads below it', () => {
  assert.equal(at(700), 'before');
  assert.equal(at(320), 'before');
  assert.equal(at(102), 'before');
});

test('the band takes over once the heading has gone under it, and holds while the story runs', () => {
  assert.equal(at(101), 'on');
  assert.equal(at(40), 'on');
  assert.equal(at(-3000), 'on');
});

test('at the last step the track ends on the window bottom: the band stays; past it, the band leaves', () => {
  assert.equal(at(-3900, { end: 844 }), 'on');
  assert.equal(at(-3900, { end: 841 }), 'on');
  assert.equal(at(-4000, { end: 760 }), 'past');
});

test('a section without a held story keeps the band until its end nears the band', () => {
  const flat = { hasTrack: false };
  assert.equal(at(-800, { ...flat, end: 600 }), 'on');
  assert.equal(at(-800, { ...flat, end: 300 }), 'past');
});

test('coming back up, the same reads give the same phases in reverse', () => {
  const marks = [700, 320, 102, 101, 40, -3000, -3900];
  const down = marks.map((titleBottom) => at(titleBottom));
  const up = [...marks].reverse().map((titleBottom) => at(titleBottom));
  assert.deepEqual(up, [...down].reverse());
});

test('the rule is empty until the stage pins, fills as the hold runs and is full on the last step', () => {
  // A track one window plus three beats tall: the hold is the three beats.
  const track = { height: 844 + 3 * 600, vh: 844, line: 101, hasTrack: true };
  assert.equal(positionProgress({ ...track, top: 300 }), 0);
  assert.equal(positionProgress({ ...track, top: 0 }), 0);
  assert.equal(positionProgress({ ...track, top: -900 }), 0.5);
  assert.equal(positionProgress({ ...track, top: -1800 }), 1);
  assert.equal(positionProgress({ ...track, top: -2600 }), 1);
});

test('a section without a held track fills as its bottom comes up to the window bottom', () => {
  const flat = { height: 2000, vh: 844, line: 101, hasTrack: false };
  assert.equal(positionProgress({ ...flat, top: 101 }), 0);
  assert.ok(positionProgress({ ...flat, top: -400 }) > 0.3 && positionProgress({ ...flat, top: -400 }) < 0.5);
  assert.equal(positionProgress({ ...flat, top: 844 - 2000 }), 1);
  // Shorter than a screen: it never jumps straight to full.
  const short = { height: 500, vh: 844, line: 101, hasTrack: false };
  assert.equal(positionProgress({ ...short, top: 101 }), 0);
  assert.ok(positionProgress({ ...short, top: -50 }) < 1);
  assert.equal(positionProgress({ ...short, top: 101, height: 0 }), 0);
});

test('the band names the first section that is on, and none when no section is', () => {
  const lab = { titleBottom: -400, top: -300, height: 3275, hasTrack: true };
  const tour = { titleBottom: 900, top: 3000, height: 5705, hasTrack: true };
  assert.deepEqual(positionAt([lab, tour, null], { line: 101, vh: 844 }), { index: 0, progress: positionProgress({ top: -300, height: 3275, vh: 844, line: 101, hasTrack: true }) });
  assert.equal(positionAt([null, tour, null], { line: 101, vh: 844 }).index, -1, 'the tour is below the window: its heading has not gone under the band');
  assert.equal(positionAt([null, null, null], { line: 101, vh: 844 }).index, -1);
  const tourOn = { titleBottom: -40, top: -120, height: 5705, hasTrack: true };
  assert.equal(positionAt([null, tourOn, null], { line: 101, vh: 844 }).index, 1);
  const labDone = { titleBottom: -3000, top: -3200, height: 3275, hasTrack: true }; // track bottom at 75: past
  assert.equal(positionAt([labDone, tourOn, null], { line: 101, vh: 844 }).index, 1, 'a story that has run no longer owns the band');
});
