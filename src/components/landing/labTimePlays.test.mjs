// node --test src/components/landing/labTimePlays.test.mjs
// W6 (20 Oct 2026): the Mistake Lab's Time screen met readers finished and still. It now waits in its first frame
// until the lab is in the window and deals again each time the lab comes back (LabCinema), and the replay's
// clock restarts when the lab comes into view (MistakeLab). Source-level; the browser walk is in tmp/v16-web/landing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const CINEMA = read('LabCinema.jsx');
const CSS = read('../../app/lab-cinema.css');
const LAB = read('MistakeLab.jsx');

test('the Time scene waits for the lab to be in view, then plays; other scenes keep their own trigger', () => {
  assert.match(CINEMA, /data-armed=\{i === 0 && !armed \? 'false' : 'true'\}/);
  assert.match(CINEMA, /intersectionRatio >= 0\.5\) setArmed\(true\)/);
  assert.match(CINEMA, /else if \(!entry\.isIntersecting\) setArmed\(false\)/);
  // Collapsed state is shared with the off state, and resets at once (no delayed reset on an undrawn section).
  assert.match(CSS, /\.lc-scene:is\(\[data-on='false'\], \[data-armed='false'\]\) \.lct__pace \{ transform: scaleY\(0\)/);
  assert.match(CSS, /\.lc-scene\[data-armed='false'\] :is\(\*, \*::after\) \{ transition: none !important; \}/);
});

test('the replay clock restarts on the rising edge of inView, only while playing on its first step', () => {
  assert.match(LAB, /const rose = inView && !wasInView\.current;/);
  assert.match(LAB, /if \(!rose \|\| reduced \|\| !playing \|\| hold \|\| step !== 0\) return;/);
  assert.match(LAB, /clockRef\.current = \{ token, elapsed: 0 \};\n\s+setRevealed\(0\);/);
  // Declared before the clock effect, so the restart is in place when the clock reads it.
  assert.ok(LAB.indexOf('const rose = inView') < LAB.indexOf('A single elapsed clock owns the step'));
});
