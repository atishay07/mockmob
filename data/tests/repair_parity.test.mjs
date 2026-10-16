import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RUN_COPY, arrowIntent, earlierMisses, earlierMissLine, missedCount, dayMonth } from '../../src/components/recovery/repairRun.js';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const rule = (css, selector) => {
  const at = css.indexOf(`${selector} {`);
  assert.ok(at >= 0, `${selector} has a rule`);
  return css.slice(at, css.indexOf('}', at));
};
const allRules = (css, selector) => {
  rule(css, selector);
  const out = [];
  for (let at = css.indexOf(`${selector} {`); at >= 0; at = css.indexOf(`${selector} {`, at + 1)) out.push(css.slice(at, css.indexOf('}', at)));
  return out.join('\n');
};
const minHeight = (css, selector) => { const body = allRules(css, selector); return Number((body.match(/min-height:\s*(\d+)px/) || body.match(/(?:^|[ ;{])height:\s*(\d+)px/) || [])[1]); };

test('every control in the repair run is at least 44 px tall', () => {
  const mistake = read('src/components/recovery/mistake-repair.css');
  const run = read('src/components/recovery/repair-run.css');
  for (const sel of ['.mr-fold__toggle', '.mr-copy', '.mr-retry', '.mr-next-btn', '.mr-practice']) assert.ok(minHeight(mistake, sel) >= 44, `${sel} is 44 px or taller`);
  for (const sel of ['.rt__finish', '.rt__seg', '.mr-earlier', '.re__mobi']) assert.ok(minHeight(run, sel) >= 44, `${sel} is 44 px or taller`);
  assert.ok(minHeight(run, '.re__quiet') >= 48 && minHeight(run, '.re__key') >= 48, 'the ending keys are 48 px or taller');
});

test('the earlier-miss line and the "Missed twice" tag are built only from the record and say it plainly', () => {
  const day = Date.UTC(2026, 9, 12, 6, 0, 0);
  const attempt = { missedBefore: { q1: [
    { attemptId: 'a1', source: 'Mock 2', completedAt: day },
    { attemptId: 'a2', source: 'Quick practice', completedAt: day - 9 * 86400000 },
  ], q2: [{ attemptId: 'a3', source: 'Mock 1' }], q3: 'x' } };
  const [newest] = earlierMisses(attempt, 'q1');
  assert.equal(earlierMissLine(newest, dayMonth), 'You also missed this question in Mock 2 on 12 October.');
  assert.equal(missedCount(attempt, 'q1'), 3);
  assert.equal(RUN_COPY.missedTimes(missedCount(attempt, 'q1')), 'Missed 3 times');
  assert.equal(RUN_COPY.missedTimes(2), 'Missed twice');
  // No date, a non-list or no record means "missed once": nothing is shown and nothing is invented.
  assert.deepEqual(earlierMisses(attempt, 'q2'), []);
  assert.deepEqual(earlierMisses(attempt, 'q3'), []);
  assert.deepEqual(earlierMisses({}, 'q1'), []);
  assert.equal(missedCount({}, 'q1'), 1);
  assert.equal(earlierMissLine(null), null);
});

test('arrow keys step from anywhere on the page, but never out of a field or with a modifier', () => {
  const ev = (key, target = { tagName: 'BODY' }, extra = {}) => ({ key, target, ...extra });
  assert.equal(arrowIntent(ev('ArrowLeft')), 'prev');
  assert.equal(arrowIntent(ev('ArrowRight')), 'next');
  assert.equal(arrowIntent(ev('ArrowLeft', { tagName: 'INPUT' })), null);
  assert.equal(arrowIntent(ev('ArrowRight', { tagName: 'TEXTAREA' })), null);
  assert.equal(arrowIntent(ev('ArrowRight', { tagName: 'DIV', isContentEditable: true })), null);
  assert.equal(arrowIntent(ev('ArrowRight', undefined, { altKey: true })), null);
  assert.equal(arrowIntent(ev('ArrowRight', undefined, { defaultPrevented: true })), null, 'a key the track already handled is not stepped twice');
  assert.equal(arrowIntent(ev('ArrowDown')), null);
});

test('the page listens for the arrows once a run has begun, and stops while the ending is open', () => {
  const page = read('src/app/(app)/result/[id]/ResultPageClient.jsx');
  assert.match(page, /if \(!engaged \|\| ending \|\| !runCurrent\) return undefined;/);
  assert.match(page, /window\.addEventListener\('keydown', onKey\)/);
  assert.match(page, /window\.removeEventListener\('keydown', onKey\)/);
  assert.match(page, /arrowIntent\(event\)/);
});

test('motion is gated: the hand-over and the ending beat play only when motion is allowed, Mobi is never in the NTA exam', () => {
  const run = read('src/components/recovery/repair-run.css');
  assert.match(run, /@media \(prefers-reduced-motion: no-preference\) \{\s*:root:not\(\[data-motion='reduced'\]\) \.mr-shell\[data-handover='a'\]/);
  const mistake = read('src/components/recovery/mistake-repair.css');
  assert.match(mistake, /:root:not\(\[data-motion='reduced'\]\) \.mr-fold\[data-animate\] \.mr-pick\[data-kind='key'\] circle/);
  const page = read('src/app/(app)/result/[id]/ResultPageClient.jsx');
  assert.match(page, /withMobi=\{!isNtaAttempt\}/);
  assert.match(read('src/components/recovery/MistakeRepair.jsx'), /nta \? null : <RepairMobi/);
});

test('the ending shows Mobi only with celebrations Full, reacting to the real outcome, with a tap cycle and a long press', () => {
  const ending = read('src/components/recovery/RepairEnding.jsx');
  assert.match(ending, /const full = prefs\.celebrations === 'full'/);
  assert.match(ending, /const mobi = full && withMobi/);
  assert.match(ending, /endingAct\(model\)/);
  assert.match(ending, /createTapCycle/);
  assert.match(ending, /LONG_PRESS_MS/);
  assert.match(ending, /RUN_COPY\.trySameAgain/);
  assert.match(ending, /className="re__band"/, 'the next move sits in the pinned band');
});
