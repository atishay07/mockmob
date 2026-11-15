// 15 Nov 2026 (lane sun2): the /sunday top bar title, the cutoff calculator's linked course with no subjects, and the Daily
// Five's loading card drawn as the start card (no layout shift when the five arrive). Source checks; the captures are in
// tmp/1115-shots/sun2/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('/sunday names itself in the top bar without a navigation item', () => {
  const src = read('src/app/(app)/AppLayoutClient.jsx');
  const title = src.slice(src.indexOf('const currentTitle'), src.indexOf('function startTour'));
  assert.match(title, /\^\\\/sunday\(\\\/\|\$\)\/\.test\(activePath\) \? 'Sunday Mock'/);
  assert.doesNotMatch(read('src/lib/arenaNavigation.js'), /id: 'sunday'/, 'no navigation item');
});

test('a course in the calculator link with no subjects: one line naming it, and the subject finder focused', () => {
  const src = read('src/components/du/CutoffCalculator.jsx');
  assert.match(src, /const pickFor = !hasSelection && linkedCourse \? linkedCourse : null;/);
  assert.match(src, /\{pickFor \? <p className="du-sub du-linked">Pick your subjects to check <b>\{pickFor\.name\}<\/b>\.<\/p> : null\}/);
  assert.match(src, /finder\.focus\(\{ preventScroll: true \}\)/);
  // The finder's keyboard rule comes back after the programmatic focus, and on cleanup.
  assert.match(src, /finder\.removeAttribute\(DU_SEARCH_ATTR\)/);
  assert.equal((src.match(/finder\.setAttribute\(DU_SEARCH_ATTR, ''\)/g) || []).length, 2);
});

test('the Daily Five loading card is the start card with a quiet disabled key, so nothing shifts when the five arrive', () => {
  const src = read('src/components/daily/DailyFive.jsx');
  const loading = src.slice(src.indexOf('// ---------- Loading and failed ----------'), src.indexOf('// ---------- Start ----------'));
  const start = src.slice(src.indexOf('// ---------- Start ----------'), src.indexOf('// ---------- Playing ----------'));
  for (const line of [
    'Five questions, one at a time, each with its answer explained.',
    'The clock starts when you press Start.',
    'One go a day. An answer can’t be changed.',
    'Your score is saved to your account and counts as a study day.',
  ]) {
    assert.ok(loading.includes(line), `loading: ${line}`);
    assert.ok(start.includes(line), `start: ${line}`);
  }
  assert.match(loading, /<div className="dly__go">\s*<button type="button" className="mm-btn mm-btn--secondary dly__wait" disabled/);
  assert.match(start, /<div className="dly__go">\s*<button type="button" className="mm-btn mm-btn--primary" onClick=\{start\}>/);
  assert.doesNotMatch(loading, /mm-drill__loading/, 'no question skeleton, which was taller than the start card');
  assert.match(loading, /aria-busy=\{failed \? undefined : 'true'\}/);
});
