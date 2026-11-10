// node --test src/components/landing/labTimePlays.test.mjs
// W6 (20 Oct 2026): the Mistake Lab's Time screen met readers finished and still. It now waits in its first frame
// until the lab is in the window and deals again each time the lab comes back (LabCinema), and the replay's
// clock restarts when the lab comes into view (MistakeLab). Source-level; the browser walk is in tmp/v16-web/landing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LAB_SCENES } from './homeCopy.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const CINEMA = read('LabCinema.jsx');
const CSS = read('../../app/lab-cinema.css');
const LAB = read('MistakeLab.jsx');

// R11 (10 Nov 2026): Chapters is the Lab's first scene now, so the wait belongs to it; Time plays when it comes on stage, like
// the scenes after it.
test('the first scene (Chapters since R11) waits for the lab to be in view, then plays; the other scenes play when they come on', () => {
  assert.equal(LAB_SCENES[0].key, 'chapters');
  assert.ok(LAB_SCENES.findIndex((s) => s.key === 'time') > 0, 'Time is not the first scene any more');
  assert.match(CINEMA, /data-armed=\{i === 0 && !armed \? 'false' : 'true'\}/);
  assert.match(CINEMA, /intersectionRatio >= 0\.5\) setArmed\(true\)/);
  assert.match(CINEMA, /else if \(!entry\.isIntersecting\) setArmed\(false\)/);
  // Collapsed state is shared with the off state, and resets at once (no delayed reset on an undrawn section): the Chapters
  // bars wait at zero while armed is false, and Time's pace line still waits while its scene is off.
  assert.match(CSS, /\.lc-scene:is\(\[data-on='false'\], \[data-armed='false'\]\) \.lcp-ch__bar \{ transform: scaleX\(0\)/);
  assert.match(CSS, /\.lc-scene:is\(\[data-on='false'\], \[data-armed='false'\]\) \.lct__pace \{ transform: scaleY\(0\)/);
  assert.match(CSS, /\.lc-scene\[data-armed='false'\] :is\(\*, \*::after\) \{ transition: none !important; \}/);
});

test('the replay clock restarts on the rising edge of inView (or, held, of its score coming on screen), only while playing on its first step', () => {
  // R8 SEC-13: held, the score row's own visibility also counts, so the replay deals in as it scrolls into view and never
  // stands at 0 / 50 above the hold.
  assert.match(LAB, /const live = inView \|\| \(pinned && scoreSeen\);/);
  assert.match(LAB, /const rose = live && !wasInView\.current;/);
  assert.match(LAB, /if \(!rose \|\| reduced \|\| !playing \|\| hold \|\| step !== 0\) return;/);
  assert.match(LAB, /clockRef\.current = \{ token, elapsed: 0 \};\n\s+setRevealed\(0\);/);
  // Declared before the clock effect, so the restart is in place when the clock reads it.
  assert.ok(LAB.indexOf('const rose = live') < LAB.indexOf('A single elapsed clock owns the step'));
});
