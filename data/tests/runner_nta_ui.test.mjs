// Inside a timed NTA paper nothing visible or behavioural may change (spec tmp/mistake-lab-v4/SPEC.md 3 and 6): the
// capture added for the Mistake Lab is data only. This renders the real NTA runner (src/app/(app)/test/TestPageClient.jsx,
// through data/tests/runner_harness.mjs) twice on the same clock: once with capture (src/lib/runnerCapture.js) and
// once with only what the runner recorded before slice 2. Both are driven through the same student paths (answer,
// Next, the palette, a mark, Previous, the keys, leaving the tab, the NTA style buttons, submit, time up, the third
// warning), and the page must be the same after every step: markup, timer, warnings, dialogs, the submit and the
// result address. The integrity guard is the real one, so a change to how it counts a warning would show here too.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as h from './runner_harness.mjs';

async function run(capture, path, storage) {
  const s = await h.mount({ mode: 'nta', capture, storage });
  const shots = [];
  try { await h.NTA_PATHS[path](s, (label) => shots.push({ label, html: s.html(), text: h.text(s.container) })); }
  finally { await s.unmount(); }
  return { shots, submits: s.submitted().map((r) => r.body), pushed: [...s.router.pushed] };
}

function samePage(a, b) {
  assert.deepEqual(a.shots.map((x) => x.label), b.shots.map((x) => x.label));
  a.shots.forEach((shot, i) => {
    const other = b.shots[i].html;
    if (shot.html === other) return;
    const at = [...shot.html].findIndex((c, j) => c !== other[j]);
    assert.fail(`after "${shot.label}" the page differs at ${at}:\n  with capture:    ${shot.html.slice(Math.max(0, at - 160), at + 160)}\n  without capture: ${other.slice(Math.max(0, at - 160), at + 160)}`);
  });
  assert.deepEqual(a.pushed, b.pushed, 'the same result address');
  assert.equal(a.submits.length, b.submits.length, 'the same number of submits');
}

const OLD_TYPES = new Set(['visit', 'answer', 'mark']);
for (const [path, storage] of [['submit', 'device'], ['submit', 'server'], ['timeUp', 'device'], ['strikes', 'device']]) {
  test(`NTA page with and without capture is identical at every step: ${path}, ${storage}-held`, async () => {
    const on = await run('on', path, storage);
    const off = await run('off', path, storage);
    samePage(on, off);
    // Both runs really differ in what they record, so the comparison means something.
    const [sent] = on.submits; const [plain] = off.submits;
    assert.equal(sent.events.at(-1).type, 'end');
    assert.equal(sent.client.platform, 'web');
    assert.ok(plain.events.every((e) => OLD_TYPES.has(e.type) && !('via' in e)), 'without capture: visits, answers and marks only');
    assert.equal('client' in plain, false);
    assert.deepEqual(sent.answers, plain.answers, 'the same answers are submitted');
  });
}

test('the NTA guard still counts a tab switch as a warning when capture records the away', async () => {
  const { shots, submits } = await run('on', 'strikes', 'device');
  const at = (label) => shots.find((x) => x.label === label).text;
  assert.match(at('hidden 1'), /Warning 1 of 3/);
  assert.match(at('hidden 2'), /Warning 2 of 3/);
  assert.match(at('hidden 3'), /Session ended/);
  assert.equal(submits.length, 1, 'the third warning submits once');
  assert.deepEqual(submits[0].events.filter((e) => e.type === 'away' || e.type === 'back').map((e) => e.type), ['away', 'back', 'away', 'back', 'away']);
});
