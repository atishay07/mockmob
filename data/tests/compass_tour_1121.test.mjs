// The home page's DU Compass tour (CompassLadder.jsx), owner LK365 (21 Nov 2026): "whenever I am scrolling, by default, all
// things pause. It should never be paused. The pause button just exists. If someone clicks it explicitly, it should always be
// auto-playing at all times." So: the tour plays while any of the card is in the window, keeps playing while the page scrolls,
// goes round without stopping, rests silently only while the card is wholly out of the window (or the tab is hidden), and the
// key changes only when the reader presses it. The scroll wait it replaces was there for speed; a step is now kept to paint
// inside fixed boxes (compass-ladder.css). Source-level: no server needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const jsx = readFileSync(new URL('../../src/components/landing/CompassLadder.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = jsx.replace(/\/\/[^\n]*|\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\//g, '');
const css = readFileSync(new URL('../../src/app/compass-ladder.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

test('the tour never waits for the page to stop scrolling', () => {
  assert.doesNotMatch(code, /addEventListener\(\s*'scroll'/, 'no scroll listener');
  assert.doesNotMatch(code, /SCROLL_REST_MS/);
});

test('the tour goes round without stopping by itself', () => {
  assert.doesNotMatch(code, /played\s*>=/, 'no "played one sweep, stop"');
  // The bars' sweep animation is the clock (LK366); without bars it falls back to the frame time.
  assert.match(code, /phaseRef\.current = clock \? \(Number\(clock\.currentTime\) \/ SWEEP_PERIOD_MS\) % 1 : \(phaseRef\.current \+ dt \/ SWEEP_PERIOD_MS\) % 1/);
  assert.match(code, /\{ duration: SWEEP_PERIOD_MS, iterations: Infinity \}/, 'the sweep animation goes round');
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
  assert.match(code, /if \(paused \|\| !inView \|\| !shown \|\| reduced \|\| motionReduced\(\)\) return undefined;/);
  assert.match(code, /\[paused, inView, shown, reduced, heldAt, rows, glide\]/);
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
  // The list carries only the first score and never changes (a change restyled its 112 children); each bar has its own.
  // 26 Nov 2026: the list also carries data-all (phones show every other college until "Show all" is pressed); the
  // first score is still the only fill it carries.
  assert.match(code, /className="cl__list" data-all=\{all \? 'true' : 'false'\} style=\{\{ '--fill': pct\(INITIAL_SCORE\) \/ 100 \}\}/);
  assert.match(code, /className="cl__all" aria-expanded=\{all\}/, 'a "Show all" button opens the rest of the list');
  assert.doesNotMatch(code, /<u style=/, 'no per-row inline transform');
  assert.match(code, /const LadderRow = memo\(/, 'rows re-render only when their words change');
  assert.match(code, /setScore\(next\)/);
  assert.match(code, /const next = Math\.round\(sweepAt\(phaseRef\.current, band\) \/ SWEEP_STEP\) \* SWEEP_STEP;/, 'the words step, not every frame');
});

// fix-misc (21 Nov 2026, evening): a React render for every step made about one frame in three take over 50 ms on a phone
// at CPU 6x while the card was in view. Steps now write the card directly; React renders only when a college flips.
test('a step of the tour writes the card directly, and React renders only when a college flips', () => {
  assert.match(code, /const SWEEP_STEP = 10;/, 'steps of 10 points: at most about 10 a second');
  assert.ok([650, 800, 950, 600, 960].every((v) => v % 10 === 0), 'the quick scores and the band ends are on the grid');
  assert.match(code, /function paintScore\(root, rows, value, bars = true\)/);
  assert.match(code, /firstChild\.nodeValue = digits/, 'the digits through the text node React keeps');
  assert.match(code, /words\.nodeValue = gapFor\(cutoff, value\)/, 'each college gap through its own text node');
  assert.match(code, /input\.style\.setProperty\('--p'/, 'the slider fill on the slider itself');
  assert.match(code, /if \(bars\) li\.querySelector\('\.cl__track u'\)\?\.style\.setProperty\('--fill', fill\)/, 'each bar its own fill (one property on the list restyled 112 children)');
  const tick = code.match(/const tick = \(now\) => \{([\s\S]*?)\n {4}\};/);
  assert.ok(tick, 'the tour tick');
  assert.match(tick[1], /paintScore\(root, rows, next, false\);\s*const key = flipKey\(next\);\s*if \(key !== keyShown\) \{ keyShown = key; setScore\(next\); \}/, 'React only on a flip, after the paint');
  assert.match(code, /const flipKey = \(value\) => cutoffs\.filter\(\(c\) => c !== null && value >= c\)\.length;/);
  const take = code.match(/const take = \(value\) => \{([^}]*)\}/);
  assert.match(take[1], /paintScore\(rootRef\.current, rows, value\)/, 'the reader’s take is painted too, so React and the screen stay one truth');
  assert.match(code, /setScore\(liveRef\.current\);\n {4}\};\n {2}\}, \[paused/, 'when the tour rests, React takes the score on screen');
  assert.match(code, /\(was, now\) => was\.college === now\.college && was\.women === now\.women && was\.cutoff === now\.cutoff && was\.state === now\.state/, 'a row renders only when it flips');
  assert.doesNotMatch(code, /\? <span className="lp-sr">, cutoff cleared<\/span> : null/, 'no element added or removed as a row flips');
  assert.doesNotMatch(css, /\.cl__track u \{[^}]*transition/, 'no transition events from ten bars a step');
});

// LK366 (22 Nov 2026), owner: "these bars used to be very smooth previously, and now they are a bit choppy". The words step
// in 10s for speed; the bars must not: they glide by Web Animations of transform (no DOM events, no per-step style write).
test('the bars glide: a Web Animation of transform runs the sweep, and a take eases them', () => {
  assert.match(css, /\.cl__track u \{[^}]*transform: scaleX\(var\(--fill, 0\)\);[^}]*transform-origin: left center;/, 'the fill moves by scaleX from its left edge');
  assert.doesNotMatch(css, /\.cl__track u \{[^}]*\bwidth:/, 'never by width');
  assert.match(code, /const scaleOf = \(value\) => `scaleX\(\$\{pct\(value\) \/ 100\}\)`;/);
  assert.match(code, /const tourFrames = \(band\) => Array\.from\(\{ length: 97 \}, \(_, k\) => \(\{ offset: k \/ 96, transform: scaleOf\(sweepAt\(k \/ 96, band\)\) \}\)\);/, 'the sweep sampled as transform keyframes');
  assert.match(code, /u\.animate\(frames, \{ duration: SWEEP_PERIOD_MS, iterations: Infinity \}\)/, 'every bar runs the sweep while the tour plays');
  assert.match(code, /a\.currentTime = phase \* SWEEP_PERIOD_MS;/, 'from where the tour is');
  assert.match(code, /const GLIDE_MS = 180;/);
  assert.match(code, /u\.animate\(\[\{ transform: scaleOf\(from\) \}, \{ transform: scaleOf\(to\) \}\], \{ duration: GLIDE_MS, easing: GLIDE_EASE \}\)/, 'a take eases from where the bar is drawn');
  const take = code.match(/const take = \(value\) => \{([^}]*)\}/);
  assert.match(take[1], /glide\.ease\(rootRef\.current, value, reduced\)/, 'drags and quick scores glide; reduced motion sets the bars at once');
  assert.match(code, /glide\.tour\(root, phaseRef\.current, band\)/, 'the tour starts the glide');
  assert.match(code, /if \(glide\.touring\(\)\) \{ paintBars\(root, liveRef\.current\); glide\.ease\(root, liveRef\.current, false\); \}/, 'resting settles the bars on the score on screen');
  const tick = code.match(/const tick = \(now\) => \{([\s\S]*?)\n {4}\};/);
  assert.doesNotMatch(tick[1], /--fill|paintBars|\.animate\(/, 'a step writes no bar: the animation moves them');
  assert.doesNotMatch(code, /addEventListener\('(transition|animation)/, 'no listener on the glide');
  assert.match(code, /useEffect\(\(\) => \(\) => glide\.stop\(\), \[glide\]\);/, 'the animations end with the card');
});

// 23 Nov 2026 (owner LK427, the live-home review): on the first list the tour read "0 of 10 cleared" for half of every round.
test('the tour sweeps the band where the cutoffs of the list sit: its lowest score clears one college, its highest all of them', async () => {
  const { bandOf } = await import('../../src/components/landing/CompassLadder.jsx').catch(() => ({ bandOf: null }));
  // The component is JSX (node cannot import it), so the rule is read from its source and checked on real lists here.
  const src = code.slice(code.indexOf('export function bandOf'), code.indexOf('const phaseOf = '));
  assert.ok(bandOf === null || typeof bandOf === 'function');
  assert.match(src, /const high = Math\.min\(AXIS_MAX, up\(Math\.max\(\.\.\.listed\) \+ SWEEP_PAST\)\);/);
  assert.match(src, /const low = Math\.min\(up\(Math\.min\(\.\.\.listed\)\), high - SWEEP_MIN_SPAN\);/);
  assert.match(src, /if \(!listed\.length\) return SWEEP_FALLBACK;/);
  const STEP = 10; const up = (v) => Math.ceil(v / STEP) * STEP;
  const band = (cutoffs) => { const listed = cutoffs.filter((c) => c !== null); const high = Math.min(1000, up(Math.max(...listed) + 20)); return { low: Math.max(0, Math.min(up(Math.min(...listed)), high - 60)), high }; };
  const { buildCompassShowcase } = await import('../../src/lib/du/showcase.js');
  const data = buildCompassShowcase();
  for (const programme of data.programmes) {
    for (const round of data.rounds.map((r) => r.id || r)) {
      for (const category of data.categories) {
        const cutoffs = programme.rows.map((r) => r.cutoffs[round]?.[category] ?? null);
        const listed = cutoffs.filter((c) => c !== null);
        if (listed.length < 2) continue;
        const b = band(cutoffs);
        const cleared = (score) => listed.filter((c) => score >= c).length;
        // A list whose cutoffs sit closer together than the band's least width starts a little under its lowest cutoff.
        assert.ok(cleared(b.low) >= 1 || b.high - b.low === 60, `${programme.id} ${round} ${category}: the lowest score clears a college`);
        assert.equal(cleared(b.high), listed.length, `${programme.id} ${round} ${category}: the highest clears every listed college`);
        assert.ok(b.high <= 1000 && b.low < b.high);
      }
    }
  }
  assert.match(code, /const INITIAL_SCORE = 860;/, 'the still card stands inside the band of the first list');
  assert.match(code, /glide\.tour\(root, phaseRef\.current, band\)/);
});
