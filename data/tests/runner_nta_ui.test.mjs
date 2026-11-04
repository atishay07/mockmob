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

// ---- NTA style is NTA's screen (web-1105-runner, 5 Nov 2026) --------------------------------------------------------
// The runner's NTA style has the anatomy and the words of the home page's preview (src/components/landing/ExamScreen.jsx,
// NtaScreen), which follows NTA's CBT guidelines (CUET (UG) 2025 Information Bulletin, Appendix V). The keys are NTA's, in
// NTA's capitals; the palette carries the section summary (a count in each of NTA's five symbols) and a > fold; clicking the
// chosen option again clears it; Submit opens the section summary before anything is sent.
async function ntaStyle() {
  const s = await h.mount({ mode: 'nta', params: { interface: 'nta' } });
  await h.click(h.one('button', 'Continue in this window'));
  return s;
}
const chip = (n) => h.find('.nta-n-palette .nta-palette-chip')[n - 1];
const legend = () => h.find('.nta-n-palette .nta-n-legend li').map((li) => h.text(li));
const heading = () => h.text(h.one('.nta-n-qhead h1'));

test('NTA style: NTA\'s header, section bar, keys and palette, in NTA\'s words and capitals', async () => {
  const s = await ntaStyle();
  try {
    assert.equal(h.one('.nta-runner').getAttribute('data-interface'), 'nta');
    const page = h.text(s.container);
    for (const words of ['CUET (UG)', 'Question Paper', 'Subject Name', 'Accountancy', 'Remaining Time', 'Question 1:', 'Mark for Review & Next', 'Clear Response', 'Save & Next', 'Question Palette', 'Warnings 0/3']) {
      assert.ok(page.includes(words), `"${words}" is on the NTA-style screen`);
    }
    // The sentence-case keys, the blue header with its progress bar and the four rounded counters are gone from NTA style.
    for (const old of ['Save & next', 'Mark for review & next', 'Clear response', 'Submit test', 'MockMob CUET Test Console']) assert.ok(!page.includes(old), `"${old}" is not NTA's`);
    assert.equal(h.find('.nta-test-header').length, 0);
    assert.equal(h.find('.nta-summary-grid').length, 0);
    // The Remaining Time, top right, as hh:mm:ss.
    assert.equal(h.text(h.one('.nta-n-cand__time .nta-timer')), '01:00:00');
    assert.equal(h.one('.nta-n-cand__time .nta-timer').getAttribute('role'), 'timer');
    // The section on the top bar, highlighted; the section summary above the palette, in NTA's order.
    assert.equal(h.one('.nta-n-tab').getAttribute('aria-current'), 'true');
    assert.deepEqual(legend(), ['5Not Visited', '1Not Answered', '0Answered', '0Marked for Review', '0Answered & Marked for Review (will be considered for evaluation)']);
    assert.deepEqual(h.find('.nta-navigation .nta-nav-button').map((b) => h.text(b)), ['Mark for Review & Next', 'Clear Response', 'Previous', 'Save & Next']);
    // Phones: the same keys in the fixed bar, and the palette as a sheet.
    assert.deepEqual(h.find('.nta-mobile-actions button').map((b) => h.text(b)), ['Previous', 'Clear Response', 'Question Palette', 'Mark for Review & Next', 'Save & Next']);
    // Options are numbered radios: no letter chips, and NTA has no strike-out.
    assert.deepEqual(h.find('.nta-option').map((o) => h.text(o)), ['1.first 1', '2.second 1', '3.third 1', '4.fourth 1']);
    assert.equal(h.find('.nta-option-letter').length, 0);
  } finally { await s.unmount(); }
});

test('NTA style: the chosen option clicked again clears it; Mark for Review & Next marks; Save & Next saves and takes the mark off; Clear Response clears', async () => {
  const s = await ntaStyle();
  try {
    await h.advance(2000); await h.click(h.find('.nta-option')[1]);
    assert.equal(h.find('.nta-option')[1].getAttribute('aria-pressed'), 'true');
    assert.equal(chip(1).getAttribute('aria-label'), 'Question 1, Answered');
    await h.advance(1000); await h.click(h.find('.nta-option')[1]);
    assert.equal(h.find('.nta-option')[1].getAttribute('aria-pressed'), 'false', 'clicking the chosen option again deselects it');
    assert.equal(chip(1).getAttribute('aria-label'), 'Question 1, Not Answered');
    await h.advance(1000); await h.click(h.find('.nta-option')[0]);
    await h.advance(1000); await h.click(h.one('.nta-nav-button', 'Mark for Review & Next'));
    assert.equal(chip(1).getAttribute('aria-label'), 'Question 1, Answered & Marked for Review');
    assert.equal(heading(), 'Question 2:');
    assert.equal(chip(2).getAttribute('aria-current'), 'step');
    // Back to question 1 by the palette, then Save & Next: saved as answered, the review mark taken off.
    await h.advance(1000); await h.click(chip(1));
    assert.equal(heading(), 'Question 1:');
    await h.advance(1000); await h.click(h.one('.nta-nav-button', 'Save & Next'));
    assert.equal(chip(1).getAttribute('aria-label'), 'Question 1, Answered');
    assert.equal(heading(), 'Question 2:');
    // The keyboard still answers (1 to 4) and moves (arrows); Clear Response clears the question in focus.
    await h.advance(1000); await h.key('3');
    assert.equal(chip(2).getAttribute('aria-label'), 'Question 2, Answered');
    await h.advance(1000); await h.click(h.one('.nta-nav-button', 'Clear Response'));
    assert.equal(chip(2).getAttribute('aria-label'), 'Question 2, Not Answered');
    await h.advance(1000); await h.key('ArrowRight');
    assert.equal(heading(), 'Question 3:');
    assert.deepEqual(legend(), ['3Not Visited', '2Not Answered', '1Answered', '0Marked for Review', '0Answered & Marked for Review (will be considered for evaluation)']);
    // What is sent: the answer, and the record of every press (the mark on, then off).
    await h.click(h.one('.nta-submit-button', 'Submit'));
    await h.click(h.one('.nta-n-summary button', 'Submit'));
    const [sent] = s.submitted();
    assert.deepEqual(sent.body.answers, { q1: 0 });
    assert.deepEqual(sent.body.events.filter((e) => e.type === 'mark').map((e) => [e.qid, e.marked]), [['q1', true], ['q1', false]]);
    assert.deepEqual(sent.body.events.filter((e) => e.type === 'answer').map((e) => [e.qid, e.answer]), [['q1', 1], ['q1', null], ['q1', 0], ['q2', 2], ['q2', null]]);
  } finally { await s.unmount(); }
});

test('NTA style: the > fold folds the palette; Submit opens the section summary, Keep answering sends nothing, its Submit sends once', async () => {
  const s = await ntaStyle();
  try {
    const fold = () => h.one('.nta-n-fold');
    assert.equal(fold().getAttribute('aria-expanded'), 'true');
    assert.equal(fold().getAttribute('aria-label'), 'Hide the Question Palette');
    await h.click(fold());
    assert.equal(fold().getAttribute('aria-expanded'), 'false');
    assert.equal(fold().getAttribute('aria-label'), 'Show the Question Palette');
    assert.ok(h.one('.nta-n-palette').hasAttribute('hidden'), 'folded away');
    assert.equal(h.one('.nta-n-body').getAttribute('data-palette'), 'closed');
    await h.click(fold());
    assert.ok(!h.one('.nta-n-palette').hasAttribute('hidden'), 'and back');
    // Submit: NTA's five counts first; nothing leaves the page until the summary's own Submit.
    await h.advance(3000); await h.click(h.one('.nta-n-palette .nta-submit-button', 'Submit'));
    const summary = h.one('.nta-n-summary');
    assert.equal(summary.getAttribute('role'), 'dialog');
    assert.equal(summary.getAttribute('aria-modal'), 'true');
    assert.match(h.text(summary), /^Submit the test\?Accountancy, 6 questions5Not Visited1Not Answered0Answered0Marked for Review0Answered & Marked for Review/);
    assert.equal(s.submitted().length, 0);
    await h.advance(2000); await h.click(h.one('.nta-n-summary button', 'Keep answering'));
    assert.equal(h.find('.nta-n-summary').length, 0);
    assert.equal(s.submitted().length, 0, 'Keep answering sends nothing');
    // Escape closes it too.
    await h.click(h.one('.nta-n-palette .nta-submit-button', 'Submit'));
    await h.key('Escape');
    assert.equal(h.find('.nta-n-summary').length, 0);
    await h.advance(1000); await h.click(h.one('.nta-n-palette .nta-submit-button', 'Submit'));
    await h.click(h.one('.nta-n-summary button', 'Submit'));
    assert.equal(s.submitted().length, 1);
    const types = s.submitted()[0].body.events.map((e) => e.type + (e.via ? `:${e.via}` : '') + (e.reason ? `:${e.reason}` : ''));
    assert.deepEqual(types, ['visit', 'visit:sheet', 'visit', 'visit:sheet', 'visit', 'visit:sheet', 'end:submit'], 'each look at the summary is the NTA submit check\'s sheet visit');
  } finally { await s.unmount(); }
});

test('NTA style: the Question Paper icon opens the whole paper, numbered as NTA numbers it, and closes back to the question', async () => {
  const s = await ntaStyle();
  try {
    await h.click(h.one('.nta-n-paper', 'Question Paper'));
    const view = h.one('.nta-n-paperview');
    assert.equal(view.getAttribute('role'), 'dialog');
    assert.equal(h.find('.nta-n-paperview__q').length, 6);
    assert.equal(h.text(h.find('.nta-n-paperview__q')[3]), 'Question 4: Question 4 text');
    assert.deepEqual(h.find('.nta-n-paperview__options')[0].querySelectorAll('li').map((li) => h.text(li)), ['1. first 1', '2. second 1', '3. third 1', '4. fourth 1']);
    // While it is open the keyboard does not answer behind it.
    await h.key('2');
    assert.equal(chip(1).getAttribute('aria-label'), 'Question 1, Not Answered');
    await h.click(h.one('.nta-n-dialog__close'));
    assert.equal(h.find('.nta-n-paperview').length, 0);
    assert.equal(heading(), 'Question 1:');
  } finally { await s.unmount(); }
});
