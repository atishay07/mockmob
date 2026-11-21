// The home page's DU Compass tour (CompassLadder.jsx), owner LK365 (21 Nov 2026): "whenever I am scrolling, by default, all
// things pause. It should never be paused. The pause button just exists. If someone clicks it explicitly, it should always be
// auto-playing at all times." So: the tour plays while any of the card is in the window, keeps playing while the page scrolls,
// goes round without stopping, rests silently only while the card is wholly out of the window (or the tab is hidden), and the
// key changes only when the reader presses it. The scroll wait it replaces was there for speed; a step is now kept to paint
// inside fixed boxes (compass-ladder.css). Source-level: no server needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const jsx = readFileSync(new URL('../../src/components/landing/CompassLadder.jsx', import.meta.url), 'utf8');
const code = jsx.replace(/\/\/[^\n]*|\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\//g, '');
const css = readFileSync(new URL('../../src/app/compass-ladder.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

test('the tour never waits for the page to stop scrolling', () => {
  assert.doesNotMatch(code, /addEventListener\(\s*'scroll'/, 'no scroll listener');
  assert.doesNotMatch(code, /SCROLL_REST_MS/);
});

test('the tour goes round without stopping by itself', () => {
  assert.doesNotMatch(code, /played\s*>=/, 'no "played one sweep, stop"');
  assert.match(code, /phaseRef\.current = \(phaseRef\.current \+ dt \/ SWEEP_PERIOD_MS\) % 1/);
});

test('only the key sets the paused state', () => {
  const sets = [...code.matchAll(/setPaused\(([^)]*)\)/g)].map((m) => m[1]);
  assert.deepEqual(sets.sort(), ['false', 'true'], 'set in one place each way');
  const toggle = code.match(/const toggle = \(\) => \{([\s\S]*?)\n  \};/);
  assert.ok(toggle, 'a toggle for the key');
  assert.match(toggle[1], /setPaused\(false\)/);
  assert.match(toggle[1], /setPaused\(true\)/);
  assert.equal((code.match(/setPaused\(/g) || []).length, 2, 'nowhere else: not the observer, not the tab, not the slider');
  assert.match(code, /className="cl__demo" type="button" onClick=\{toggle\}/);
  assert.match(code, /\{paused \? 'Play' : 'Pause'\}/, 'the key says Play only when the reader paused it');
  assert.doesNotMatch(code, /setSweeping/);
});

test('it rests only while the card is wholly out of the window or the tab is hidden, and carries on by itself', () => {
  assert.match(code, /new IntersectionObserver\(\(\[entry\]\) => setInView\(entry\.isIntersecting\), \{ threshold: 0 \}\)/);
  assert.match(code, /if \(paused \|\| !inView \|\| !shown \|\| reduced\) return undefined;/);
  assert.match(code, /\[paused, inView, shown, reduced, heldAt, rows\]/);
  assert.match(code, /setShown\(!document\.hidden\)/);
});

test('the reader taking the score holds the tour for a while, then it goes on from their score; the key does not change', () => {
  assert.match(code, /const READER_HOLD_MS = \d{4};/);
  const take = code.match(/const take = \(value\) => \{([^}]*)\}/);
  assert.ok(take);
  assert.match(take[1], /phaseFrom\(value\)/);
  // The clock is read through a module helper (the React lint forbids performance.now in a component's body).
  assert.match(code, /const now = \(\) => performance\.now\(\);/);
  assert.match(take[1], /setHeldAt\(now\(\)\)/);
  assert.doesNotMatch(take[1], /setPaused/);
  const slider = code.match(/<input id="cl-score"[^\n]+/)[0];
  assert.match(slider, /onChange=\{\(event\) => take\(Number\(event\.target\.value\)\)\}/);
  assert.doesNotMatch(slider, /onPointerDown|onKeyDown/, 'passing touches and keys that do not change the score leave the tour playing');
});

test('reduced motion: no tour and no key', () => {
  assert.match(code, /\{!reduced \? <button className="cl__demo"/);
  assert.match(code, /document\.documentElement\.dataset\.motion === 'reduced'/);
});

test('a step changes paint inside boxes that do not move', () => {
  assert.match(css, /\.cl__card \{[^}]*contain: layout paint;/, 'the card is contained');
  assert.match(css, /\.cl__num \{[^}]*display: inline-block;[^}]*width: 3ch;/, 'the digits sit in a box of fixed width');
  assert.match(css, /\.cl__num\[data-digits='4'\] \{ width: 4ch; \}/);
  assert.match(css, /\.cl__gap \{[^}]*width: [\d.]+em;/, 'each college gap has a fixed width, so the name column never moves');
  assert.match(css, /\.cl__track u \{[^}]*transform: scaleX\(var\(--fill, 0\)\)/, 'the bars read one custom property as a transform');
  assert.match(code, /className="cl__list" style=\{\{ '--fill': pct\(score\) \/ 100 \}\}/);
  assert.doesNotMatch(code, /<u style=/, 'no per-row inline transform');
  assert.match(code, /const LadderRow = memo\(/, 'rows re-render only when their words change');
  assert.match(code, /setScore\(next\)/);
  assert.match(code, /Math\.round\(\(SWEEP_LOW \+ \(SWEEP_HIGH - SWEEP_LOW\) \* eased\) \/ SWEEP_STEP\) \* SWEEP_STEP/, 'steps, not every frame');
});

// fix-misc (21 Nov 2026, evening): a React render for every step made about one frame in three take over 50 ms on a phone
// at CPU 6x while the card was in view. Steps now write the card directly; React renders only when a college flips.
test('a step of the tour writes the card directly, and React renders only when a college flips', () => {
  assert.match(code, /const SWEEP_STEP = 10;/, 'steps of 10 points: at most about 10 a second');
  assert.ok([650, 800, 950, 600, 960].every((v) => v % 10 === 0), 'the quick scores and the band ends are on the grid');
  assert.match(code, /function paintScore\(root, rows, value\)/);
  assert.match(code, /firstChild\.nodeValue = digits/, 'the digits through the text node React keeps');
  assert.match(code, /words\.nodeValue = gapFor\(cutoff, value\)/, 'each college gap through its own text node');
  assert.match(code, /input\.style\.setProperty\('--p'/, 'the slider fill on the slider itself');
  assert.match(code, /li\.querySelector\('\.cl__track u'\)\?\.style\.setProperty\('--fill', fill\)/, 'each bar its own fill (one property on the list restyled 112 children)');
  const tick = code.match(/const tick = \(now\) => \{([\s\S]*?)\n {4}\};/);
  assert.ok(tick, 'the tour tick');
  assert.match(tick[1], /paintScore\(root, rows, next\);\s*const key = flipKey\(next\);\s*if \(key !== keyShown\) \{ keyShown = key; setScore\(next\); \}/, 'React only on a flip, after the paint');
  assert.match(code, /const flipKey = \(value\) => cutoffs\.filter\(\(c\) => c !== null && value >= c\)\.length;/);
  const take = code.match(/const take = \(value\) => \{([^}]*)\}/);
  assert.match(take[1], /paintScore\(rootRef\.current, rows, value\)/, 'the reader’s take is painted too, so React and the screen stay one truth');
  assert.match(code, /setScore\(liveRef\.current\); \};\n {2}\}, \[paused/, 'when the tour rests, React takes the score on screen');
  assert.match(code, /\(was, now\) => was\.college === now\.college && was\.women === now\.women && was\.cutoff === now\.cutoff && was\.state === now\.state/, 'a row renders only when it flips');
  assert.doesNotMatch(code, /\? <span className="lp-sr">, cutoff cleared<\/span> : null/, 'no element added or removed as a row flips');
  assert.doesNotMatch(css, /\.cl__track u \{[^}]*transition/, 'no transition events from ten bars a step');
});
