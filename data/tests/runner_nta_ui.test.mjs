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
    for (const words of ['CUET (UG)', 'Question Paper', 'Subject Name', 'Accountancy', 'Remaining Time', 'Question 1:', 'Mark for Review & Next', 'Clear Response', 'Save & Next', 'Question Palette']) {
      assert.ok(page.includes(words), `"${words}" is on the NTA-style screen`);
    }
    // LK195: the warnings counter is gone (it never moved); the rule is said on the instructions page and in the warning itself.
    assert.ok(!page.includes('Warnings'), 'no warnings counter');
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

test('NTA style (exam-true saving): a choice is held until Save & Next or Mark for Review & Next; the chosen option again, or Clear Response, clears it', async () => {
  const s = await ntaStyle();
  try {
    const pressed = () => h.find('.nta-option').map((o) => o.getAttribute('aria-pressed'));
    await h.advance(2000); await h.click(h.find('.nta-option')[1]);
    assert.deepEqual(pressed(), ['false', 'true', 'false', 'false'], 'the choice shows');
    assert.equal(chip(1).getAttribute('aria-label'), 'Question 1, Not Answered', 'but it is not saved');
    await h.advance(1000); await h.click(h.find('.nta-option')[1]);
    assert.deepEqual(pressed(), ['false', 'false', 'false', 'false'], 'clicking the chosen option again deselects it');
    await h.advance(1000); await h.click(h.find('.nta-option')[0]);
    await h.advance(1000); await h.click(h.one('.nta-nav-button', 'Mark for Review & Next'));
    assert.equal(chip(1).getAttribute('aria-label'), 'Question 1, Answered & Marked for Review', 'Mark for Review & Next saves and marks');
    assert.equal(heading(), 'Question 2:');
    assert.equal(chip(2).getAttribute('aria-current'), 'step');
    // Back to question 1 by the palette: its saved answer shows; Save & Next keeps it and takes the review mark off.
    await h.advance(1000); await h.click(chip(1));
    assert.equal(heading(), 'Question 1:');
    assert.deepEqual(pressed(), ['true', 'false', 'false', 'false']);
    await h.advance(1000); await h.click(h.one('.nta-nav-button', 'Save & Next'));
    assert.equal(chip(1).getAttribute('aria-label'), 'Question 1, Answered');
    assert.equal(heading(), 'Question 2:');
    // The keyboard chooses as a press does (held); Clear Response lets it go; an arrow moves on without saving.
    await h.advance(1000); await h.key('3');
    assert.deepEqual(pressed(), ['false', 'false', 'true', 'false']);
    assert.equal(chip(2).getAttribute('aria-label'), 'Question 2, Not Answered');
    await h.advance(1000); await h.click(h.one('.nta-nav-button', 'Clear Response'));
    assert.deepEqual(pressed(), ['false', 'false', 'false', 'false']);
    await h.advance(1000); await h.key('ArrowRight');
    assert.equal(heading(), 'Question 3:');
    assert.deepEqual(legend(), ['3Not Visited', '2Not Answered', '1Answered', '0Marked for Review', '0Answered & Marked for Review (will be considered for evaluation)']);
    // What is sent: the saved answer, and the record of every save and mark (a held choice is never recorded).
    await h.click(h.one('.nta-submit-button', 'Submit'));
    await h.click(h.one('.nta-n-summary button', 'Yes'));
    const [sent] = s.submitted();
    assert.deepEqual(sent.body.answers, { q1: 0 });
    assert.deepEqual(sent.body.events.filter((e) => e.type === 'mark').map((e) => [e.qid, e.marked]), [['q1', true], ['q1', false]]);
    assert.deepEqual(sent.body.events.filter((e) => e.type === 'answer').map((e) => [e.qid, e.answer]), [['q1', 0]]);
  } finally { await s.unmount(); }
});

test('NTA style: the > fold folds the palette; Submit opens NTA\'s Exam Summary, No sends nothing, Yes sends once', async () => {
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
    // NTA's own summary (nta.ac.in/Quiz, 17 Nov 2026): the counts under their names in NTA's order, then the question, Yes and No.
    assert.equal(h.text(h.one('.nta-n-summary h2')), 'Exam Summary');
    assert.deepEqual(h.find('.nta-n-table--wide th').map((th) => h.text(th)), ['No. of Questions', 'Answered', 'Not Answered', 'Marked for Review', 'Answered & Marked for Review (will be considered for evaluation)', 'Not Visited']);
    assert.deepEqual(h.find('.nta-n-table--wide td').map((td) => h.text(td)), ['6', '0', '1', '0', '0', '5']);
    assert.match(h.text(summary), /Are you sure you want to submit for final marking\?No changes will be allowed after submission\.YesNo$/);
    assert.equal(s.submitted().length, 0);
    await h.advance(2000); await h.click(h.one('.nta-n-summary button', 'No'));
    assert.equal(h.find('.nta-n-summary').length, 0);
    assert.equal(s.submitted().length, 0, 'No sends nothing');
    // Escape closes it too.
    await h.click(h.one('.nta-n-palette .nta-submit-button', 'Submit'));
    await h.key('Escape');
    assert.equal(h.find('.nta-n-summary').length, 0);
    await h.advance(1000); await h.click(h.one('.nta-n-palette .nta-submit-button', 'Submit'));
    await h.click(h.one('.nta-n-summary button', 'Yes'));
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
