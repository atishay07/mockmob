import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// LK81 (5 Nov 2026): the slow-phone stutter on the Lab and the tour. Measured at 4x CPU on the 22-swipe bench: frames over
// 100 ms 11 -> 0, worst frame 442 -> 91 ms, p95 24 -> 12 ms (tmp/home-1105-perf). These pin the three causes' fixes.
const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('LK81 held stories are drawn ahead of the reader while the page is idle, then handed back to auto', () => {
  const story = read('./ScrollStory.jsx');
  assert.match(story, /import \{ predraw \} from '\.\/storyPredraw\.mjs'/);
  assert.match(story, /if \(section\) predraw\(section\)/);
  const predraw = read('./storyPredraw.mjs');
  assert.match(predraw, /section\.dataset\.predraw = 'on'/);
  assert.match(predraw, /delete section\.dataset\.predraw/, 'the section goes back to content-visibility: auto');
  assert.match(predraw, /now\(\) - lastInput < QUIET_MS/, 'never while the reader is touching or scrolling');
  assert.match(read('../../app/landing.css'), /\.lp main > \[data-predraw='on'\] \{ content-visibility: visible; \}/);
});

test('LK81 the tour keeps every screen mounted: a step changes attributes, it does not rebuild a screen', () => {
  const tour = read('./FeatureTour.jsx');
  assert.doesNotMatch(tour, /':on:'/, 'no key that remounts the active screen on every step');
  assert.match(tour, /key=\{pinned \|\| !on \? 'still' : visit\}/);
  assert.match(read('./TourScreens.jsx'), /if \(active !== wasActive\)/, 'a screen coming back on stage restarts its demo in the same render');
});

test('LK81 pausing the tour restyles only the elements that animate, never the whole tour', () => {
  const css = read('../../app/feature-tour.css');
  assert.doesNotMatch(css, /\[data-playing='false'\] \.ts \*/);
  assert.doesNotMatch(css, /\[data-active='false'\] \.ts \*/);
  assert.match(css, /\.ft\[data-playing='false'\] :is\(\.ts__tick, \.ts__tap, \.ts__marks, \.ts__opt, \.ts__chips li, \.ts__typing i, \.ts__mobi i\)/);
});
