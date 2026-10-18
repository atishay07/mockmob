// Today, release 10: the taste pass (owner D89 to D90, 18 Oct 7:40 pm; docs/brain/OWNER-TASTE-PROFILE.md). Each test locks one
// critic finding that was fixed, so a later pass cannot quietly bring it back.
//   D90  the swap choices say what they do, nudge on the first visits, and the swap moves with the tap
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const css = (path) => read(path).replace(/\/\*[\s\S]*?\*\//g, '');

test('D90: the two choices say they swap the lead, carry a swap mark, and press in', () => {
  const move = read('src/components/today/TodayMove.jsx');
  assert.match(move, /<p className="tm__or-h" id="tm-or-h">Or make one of these your move<\/p>/);
  assert.match(move, /aria-labelledby="tm-or-h"/);
  assert.match(move, /<Repeat2 className="tm__choice-i" size=\{16\}/);
  const sheet = css('src/components/today/today.css');
  assert.match(sheet, /\.tm__or-h \{[^}]*font-size: 12\.5px;[^}]*color: var\(--a-ink-3\)/);
  assert.match(sheet, /\.tm__choice:active \{[^}]*transform: scale\(0\.98\)/);
});

test('D90: the first-run nudge plays 1.2 s after landing until the first swap, at most 3 visits, storage guarded', () => {
  const move = read('src/components/today/TodayMove.jsx');
  assert.match(move, /SWAP_HINT_KEY = 'mm:today-swap-hint:v1'/);
  assert.match(move, /if \(seen >= 3\) return undefined;/);
  assert.match(move, /\}, 1200\);/);
  assert.match(move, /try \{ const v = window\.localStorage\.getItem\(SWAP_HINT_KEY\)/);
  assert.match(read('src/app/(app)/today/page.jsx'), /swapLearned\(\);/, 'a swap clears the hint for good');
  const sheet = css('src/components/today/today.css');
  assert.match(sheet, /\.tm__or\[data-hint\] \.tm__choice \{ animation: tm-nudge 720ms[^}]*box-shadow: inset 0 0 0 1px var\(--a-line-strong\)/);
  assert.match(sheet, /@keyframes tm-nudge \{ 0%, 50%, 100% \{ transform: none; \} 25%, 75% \{ transform: translateY\(-3px\); \} \}/);
});

test('D90: the swap is direction-aware, has no blur, and the move that left sits in the tapped cell', () => {
  const sheet = css('src/components/today/today.css');
  const body = sheet.match(/\.app-shell \.tm__body \{[^}]*\}/)[0];
  assert.doesNotMatch(body, /filter/, 'no blur');
  assert.match(sheet, /\.tm__body\[data-out\] \{ opacity: 0; transform: translateX\(-20px\); transition-duration: 140ms;/);
  assert.match(sheet, /\.tm__body\[data-out\]\[data-dir='l'\] \{ transform: translateX\(20px\); \}/);
  assert.match(sheet, /\.tm__body\[data-in\] \{ transition: none; animation: tm-in-r 280ms cubic-bezier\(0\.2, 0\.9, 0\.25, 1\.1\) both; \}/);
  assert.match(sheet, /\.tm__choice\[data-arrived\] \{ animation: tm-cell-in 180ms ease both; \}/);
  const page = read('src/app/(app)/today/page.jsx');
  assert.match(page, /const dir = slot === 0 \? 'l' : 'r';/);
  assert.match(page, /if \(at >= 0 && marked\.length === 2 && at !== traded\.slot\) return \[marked\[1\], marked\[0\]\];/);
  assert.match(page, /if \(reducedMotion\(\)\) \{ put\(\); return; \}/, 'reduced motion swaps at once');
});
