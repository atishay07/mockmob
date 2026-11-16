// node --test src/components/landing/tourFree.test.mjs
// The tour on a touch screen is a DECK (17 Nov 2026; the owner on his phone, of the held stage with a free scroll that a
// finger had the night before: "the previous version ... was better than this"; of the stack before it: "a wastage of
// vertical space"). So on touch the tour is never held at all: ScrollStory is told to hold it only for a mouse or a
// trackpad (TOUR_HOLD), the story controller never sees it there, and the controller has no "free" story any more. The
// file keeps its name (package.json lists it); what it pins is that nothing but the reader's finger moves the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(here, rel), 'utf8').replace(/\r\n/g, '\n');
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

test('on touch the tour is not held: the controller never registers it, so it never lands, steers or settles the page', () => {
  const tour = code(read('./FeatureTour.jsx'));
  assert.match(tour, /<ScrollStory [^>]*hold=\{TOUR_HOLD\}/);
  const story = code(read('./ScrollStory.jsx'));
  // A story that is not held is never registered with the controller (it has no handle to land or steer).
  assert.match(story, /setPinned\(typeof IntersectionObserver !== 'undefined' && \(!heldQuery \|\| heldQuery\.matches\)/);
  assert.doesNotMatch(story, /\bfree\b/, 'no free stories');
  const ctrl = code(read('./storyController.mjs'));
  assert.doesNotMatch(ctrl, /\bfree\(|s\.free/, 'the controller has no free stories');
});

test('the deck moves only its own row: a tab puts the row on its card at once; the page is never scrolled by the tour', () => {
  const tour = code(read('./FeatureTour.jsx'));
  assert.match(tour, /track\.scrollTo\(\{ left: [^}]*behavior: 'instant' \}\)/);
  assert.doesNotMatch(tour, /window\.scrollTo|scrollIntoView|behavior: 'smooth'/);
  // The tab on show is read from the row with one observer (no scroll listener, no layout read while the row moves).
  assert.match(tour, /\{ root: track, threshold: DECK_SHOWN \}/);
  assert.match(tour, /const DECK_SHOWN = 0\.6;/);
});
