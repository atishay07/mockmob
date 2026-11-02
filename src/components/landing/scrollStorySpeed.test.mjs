// node --test src/components/landing/scrollStorySpeed.test.mjs
// LK47 (owner, 2 Nov 2026): "the scroll speed ... feels like a lot ... in the first section". The held stories had caught every
// wheel notch, swipe and scroll key and glided the page a whole step (about a screen) per gesture. The page now scrolls through
// a story at the reader's own speed: nothing in ScrollStory cancels a wheel, a touch or a key, and every listener it adds is passive.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const story = readFileSync(new URL('./ScrollStory.jsx', import.meta.url), 'utf8');
const code = story.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');

test('a held story never cancels the reader\'s own scrolling', () => {
  assert.doesNotMatch(code, /preventDefault\(/, 'no wheel, touch or key is cancelled');
  assert.doesNotMatch(code, /passive:\s*false/, 'no listener can cancel a scroll');
  assert.doesNotMatch(code, /overflow\s*=\s*['"]hidden/, 'the page is never frozen to stop momentum');
});

test('a wheel, a touch or a key during a picked step\'s glide hands the page back at once', () => {
  assert.match(code, /window\.addEventListener\('wheel', stop, opts\)/);
  assert.match(code, /window\.addEventListener\('touchstart', stop, opts\)/);
  assert.match(code, /const opts = \{ passive: true \}/);
});

test('picking a step still brings it on stage, instantly under reduced motion', () => {
  assert.match(code, /if \(instant \|\| reducedNow\(\) \|\| Math\.abs\(target - from\) < 2\) \{ put\(target\); return; \}/);
  assert.match(code, /story\.current = \{ go \}/);
});
