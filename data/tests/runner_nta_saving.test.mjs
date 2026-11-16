// NTA mode, made faithful (owner LK297, 17 Nov 2026; tmp/BUILD-BRIEF.md of web/1117-nta). These drive the real runner
// (src/app/(app)/test/TestPageClient.jsx through data/tests/runner_harness.mjs) as a student does:
//   N1  the instructions page comes before the clock: nothing is asked of the server until Start, and Start needs the tick;
//   N2  exam-true saving in NTA style: a choice is only held until Save & Next or Mark for Review & Next saves it; the palette,
//       Previous, an arrow key, the screen switch, a reload and the clock running out never save it; the draft, the events, the
//       offline queue and the submit carry saved answers only, each saved once;
//   N3  an NTA paper opens in NTA style unless the address names MockMob's screen;
//   N7  no warnings counter, the warning itself still comes;
//   N8  NTA's Exam Summary names a choice that is not saved; N9 Save & Next on the last question saves and stays;
//   the clock ticks once a second, on the second.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as h from './runner_harness.mjs';
import { TEST_MODES } from '../test_modes.js';
import { PAPER } from '../../src/lib/subjectPages.mjs';
import { launchPath } from '../../src/lib/firstSet.mjs';
import { practiceHref } from '../../src/lib/paper/problems.mjs';

const KEY = 'generation-nta-saving-01';
const nta = ({ params = {}, ...over } = {}) => ({ mode: 'nta', ...over, params: { generationKey: KEY, interface: 'nta', ...params } });
const draft = () => JSON.parse(localStorage.getItem(`mm:test:student-1:paper:g.${KEY}`) || 'null');
const chip = (n) => h.find('.nta-n-palette .nta-palette-chip')[n - 1];
const state = (n) => chip(n).getAttribute('aria-label').replace(/^Question \d+, /, '');
const heading = () => h.text(h.one('.nta-n-qhead h1'));
const pressed = () => h.find('.nta-option').map((o) => o.getAttribute('aria-pressed') === 'true');
const option = (i) => h.find('.nta-option')[i];
const key = (label) => h.one('.nta-navigation .nta-nav-button', label);
const answerEvents = (events) => events.filter((e) => e.type === 'answer').map((e) => [e.qid, e.answer]);
const page = (s) => h.text(s.container);

async function open(over = {}) {
  const s = await h.mount(nta(over));
  if (h.find('button').some((b) => h.text(b) === 'Continue in this window')) await h.click(h.one('button', 'Continue in this window'));
  return s;
}

// ---- N1 ---------------------------------------------------------------------------------------------------------------
test('N1: the instructions page comes first; no paper is asked for and no clock runs until the tick and Start', async (t) => {
  // The server starts the session when it is asked (as the real one does), so the clock is measured from Start.
  const replies = (url, init) => {
    if (url !== '/api/sessions' || init.method !== 'POST') return undefined;
    const questions = h.paper(6).map(({ correctIndex, ...q }) => q);
    return { id: 'session-1', startedAt: new Date(h.clock.now).toISOString(), expiresAt: new Date(h.clock.now + 3600000).toISOString(), serverNow: h.clock.now, questions,
      meta: { sessionId: 'session-1', mode: 'nta', requestedCount: 50, sessionTicket: 'ticket-1', storage: 'device', ntaPaper: { status: 'closest', items: [] } } };
  };
  const s = await h.mount(nta({ instructions: 'stay', replies }));
  t.after(() => s.unmount());
  const text = page(s);
  for (const words of ['General Instructions', 'Please read the instructions carefully', 'Navigating to a Question:', 'Answering a Question:', 'Save & Next', 'Mark for Review & Next', 'Clear Response']) assert.ok(text.includes(words), words);
  // The facts come from the mode, never typed: 50 questions, 60 minutes, +5, -1, 0.
  const { fixedCount, fixedDurationSec, marking } = TEST_MODES.nta;
  assert.ok(text.includes(`Questions${fixedCount}`) && text.includes(`Duration${fixedDurationSec / 60} min`));
  assert.ok(text.includes(`+${marking.right} right`) && text.includes(`−${Math.abs(marking.wrong)} wrong`) && text.includes(`${marking.blank} not answered`));
  // NTA's own rule on review marks, and the language said honestly.
  assert.match(text, /only Marked for Review is not evaluated\. Answered & Marked for Review is\./);
  assert.match(text, /MockMob papers are in English only\./);
  // The warning rule in words (LK195), from the policy's numbers.
  assert.match(text, /switching tabs or apps is a warning at once\. Losing focus for under 3 seconds is not\. The third warning ends the test and submits your saved answers\./);
  assert.ok(h.one('.nta-ins__start').hasAttribute('disabled'), 'Start waits for the tick');
  assert.equal(h.text(h.one('.nta-ins__hint')), 'Tick the box above to start.');
  await h.advance(5 * 60000, { coarse: true });
  assert.equal(s.requests.filter((r) => r.url === '/api/sessions').length, 0, 'reading costs no time');
  assert.ok(await h.startFromInstructions());
  assert.equal(s.requests.filter((r) => r.url === '/api/sessions' && r.method === 'POST').length, 1);
  await h.click(h.one('button', 'Continue in this window'));
  assert.equal(h.text(h.one('.nta-n-cand__time .nta-timer')), '01:00:00', 'the hour starts at Start');
});

test('N1: a paper already running goes straight back to its clock: its draft, a start receipt, or a session id', async (t) => {
  const first = await open();
  let current = first;
  t.after(() => current.unmount());
  await h.click(option(2)); await h.click(key('Save & Next'));
  await first.unmount({ keepStorage: true });
  current = await h.mount(nta({ instructions: 'stay', startedAt: first.startedAt }));
  assert.equal(h.find('.nta-ins').length, 0, 'no instructions over a running paper');
  assert.equal(current.requests.filter((r) => r.url === '/api/sessions').length, 0, 'the draft reopened');
  if (h.find('button').some((b) => h.text(b) === 'Continue in this window')) await h.click(h.one('button', 'Continue in this window'));
  assert.equal(state(1), 'Answered');
  await current.unmount();
  current = await h.mount(nta({ instructions: 'stay', params: { generationKey: 'generation-receipt', startReceipt: 'receipt-1' } }));
  assert.equal(h.find('.nta-ins').length, 0);
  assert.equal(current.requests.filter((r) => r.url === '/api/sessions' && r.method === 'POST').length, 1, 'the receipt brings the same clock back');
  await current.unmount();
  current = await h.mount(nta({ instructions: 'stay', params: { generationKey: null, sessionId: 'session-9' } }));
  assert.equal(h.find('.nta-ins').length, 0);
});

// ---- N2 ---------------------------------------------------------------------------------------------------------------
test('N2: a held choice is never saved, drafted or sent; the palette, Previous and an arrow key let it go', async (t) => {
  const s = await open();
  t.after(() => s.unmount());
  await h.advance(2000); await h.click(option(1));
  assert.deepEqual(pressed(), [false, true, false, false], 'the choice shows');
  assert.equal(state(1), 'Not Answered', 'the palette counts saved answers only');
  assert.deepEqual(draft().answers, {}, 'nothing in the draft');
  assert.deepEqual(answerEvents(draft().events), [], 'nothing recorded');
  // The palette: NTA's point 7a, "does NOT save your answer to the current question".
  await h.advance(1000); await h.click(chip(3));
  assert.equal(heading(), 'Question 3:');
  assert.equal(state(1), 'Not Answered');
  await h.click(chip(1));
  assert.deepEqual(pressed(), [false, false, false, false], 'back on question 1 the unsaved choice is gone');
  // Previous.
  await h.click(key('Save & Next'));
  assert.equal(heading(), 'Question 2:');
  await h.click(option(3));
  await h.click(key('Previous'));
  assert.equal(heading(), 'Question 1:');
  assert.equal(state(2), 'Not Answered');
  // An arrow key.
  await h.click(option(0));
  await h.key('ArrowRight');
  assert.equal(heading(), 'Question 2:');
  assert.equal(state(1), 'Not Answered');
  assert.deepEqual(draft().answers, {});
  await h.click(h.one('.nta-n-palette .nta-submit-button', 'Submit'));
  await h.click(h.one('.nta-n-summary button', 'Yes'));
  assert.deepEqual(s.submitted()[0].body.answers, {}, 'nothing held was sent');
  assert.deepEqual(answerEvents(s.submitted()[0].body.events), []);
});

test('N2: a held choice over a saved answer leaves it alone; Save & Next replaces it once, and saving the same answer again records nothing', async (t) => {
  const s = await open();
  t.after(() => s.unmount());
  await h.click(option(0)); await h.click(key('Save & Next'));
  assert.deepEqual(draft().answers, { q1: 0 });
  await h.click(chip(1));
  assert.deepEqual(pressed(), [true, false, false, false], 'the saved answer shows');
  await h.click(option(2));
  assert.deepEqual(pressed(), [false, false, true, false]);
  await h.click(chip(2)); await h.click(chip(1));
  assert.deepEqual(pressed(), [true, false, false, false], 'leaving kept the saved answer');
  assert.deepEqual(draft().answers, { q1: 0 });
  await h.click(option(2)); await h.click(key('Save & Next'));
  assert.deepEqual(draft().answers, { q1: 2 });
  // Save & Next with nothing held, and a held choice moved back to the saved one, change nothing and record nothing.
  await h.click(chip(1)); await h.click(key('Save & Next'));
  await h.click(chip(1)); await h.click(option(0)); await h.click(option(2)); await h.click(key('Save & Next'));
  assert.deepEqual(draft().answers, { q1: 2 });
  assert.deepEqual(answerEvents(draft().events), [['q1', 0], ['q1', 2]], 'one event a real change, never a second for the same answer');
});

test('N2: Clear Response, or the chosen option pressed again, clears a saved answer at once; a review mark stays', async (t) => {
  const s = await open();
  t.after(() => s.unmount());
  await h.click(option(1)); await h.click(key('Mark for Review & Next'));
  assert.equal(state(1), 'Answered & Marked for Review', 'Mark for Review & Next saves and marks');
  await h.click(chip(1)); await h.click(key('Clear Response'));
  assert.deepEqual(pressed(), [false, false, false, false]);
  assert.equal(state(1), 'Marked for Review', 'cleared at once, still marked');
  assert.deepEqual(draft().answers, {});
  await h.click(option(3)); await h.click(key('Save & Next'));
  await h.click(chip(1)); await h.click(option(3));
  assert.equal(state(1), 'Not Answered', 'the saved option pressed again clears it');
  assert.deepEqual(draft().answers, {});
  // A held choice pressed again is let go and nothing is recorded for it.
  await h.click(chip(2)); await h.click(option(2)); await h.click(option(2));
  assert.deepEqual(pressed(), [false, false, false, false]);
  assert.deepEqual(answerEvents(draft().events), [['q1', 1], ['q1', null], ['q1', 3], ['q1', null]]);
  // Mark for Review & Next with nothing chosen: marked, not answered (not evaluated).
  await h.click(key('Mark for Review & Next'));
  assert.equal(state(2), 'Marked for Review');
});

test('N9: Save & Next on the last question saves and stays there, as NTA\'s own mock does; nothing opens', async (t) => {
  const s = await open();
  t.after(() => s.unmount());
  await h.click(chip(6));
  await h.click(option(1)); await h.click(key('Save & Next'));
  assert.equal(heading(), 'Question 6:');
  assert.equal(state(6), 'Answered');
  assert.equal(h.find('.nta-n-summary').length, 0);
  assert.equal(h.text(key('Save & Next')), 'Save & Next', 'the key keeps its name');
  assert.equal(s.submitted().length, 0);
});

test('N2: when the clock runs out, a held choice is not sent; the saved ones are', async (t) => {
  const s = await open();
  t.after(() => s.unmount());
  await h.advance(20000); await h.click(option(0)); await h.click(key('Save & Next'));
  await h.advance(20000); await h.click(option(1));
  await h.advance(s.durationMs, { coarse: true });
  assert.equal(s.submitted().length, 1);
  assert.deepEqual(s.submitted()[0].body.answers, { q1: 0 });
  assert.equal(s.submitted()[0].body.events.at(-1).reason, 'time_up');
});

test('N8: NTA\'s Exam Summary names a choice that is not saved; No keeps it on screen, and Yes sends saved answers only, once', async (t) => {
  const s = await open();
  t.after(() => s.unmount());
  await h.click(option(0)); await h.click(key('Save & Next'));
  await h.click(option(3));
  await h.click(h.one('.nta-n-palette .nta-submit-button', 'Submit'));
  assert.match(h.text(h.one('.nta-n-summary')), /Your choice on Question 2 is not saved\. Choose No, then Save & Next to keep it\./);
  assert.deepEqual(h.find('.nta-n-table--wide td').map((td) => h.text(td)), ['6', '1', '1', '0', '0', '4']);
  await h.click(h.one('.nta-n-summary button', 'No'));
  assert.deepEqual(pressed(), [false, false, false, true], 'the choice is still on screen');
  await h.click(key('Save & Next'));
  await h.click(h.one('.nta-n-palette .nta-submit-button', 'Submit'));
  assert.doesNotMatch(h.text(h.one('.nta-n-summary')), /not saved/);
  await h.click(h.one('.nta-n-summary button', 'Yes'));
  await h.advance(500);
  assert.equal(s.submitted().length, 1);
  assert.deepEqual(s.submitted()[0].body.answers, { q1: 0, q2: 3 });
});

test('N2: a reload brings back saved answers and the question, never a held choice', async (t) => {
  const first = await open();
  let current = first;
  t.after(() => current.unmount());
  await h.click(option(0)); await h.click(key('Save & Next'));
  await h.click(option(2));
  await first.unmount({ keepStorage: true });
  current = await h.mount(nta({ instructions: 'stay', startedAt: first.startedAt }));
  await h.click(h.one('button', 'Continue in this window'));
  assert.equal(heading(), 'Question 2:');
  assert.deepEqual(pressed(), [false, false, false, false]);
  assert.equal(state(1), 'Answered');
  assert.equal(state(2), 'Not Answered');
});

test('N2: a server-held paper syncs saves only; a held choice never reaches the server', async (t) => {
  const s = await open({ storage: 'server' });
  t.after(() => s.unmount());
  await h.advance(1000); await h.click(option(1));
  await h.advance(3200);
  assert.ok(s.synced().length > 0, 'the paper syncs');
  assert.ok(s.synced().every((r) => answerEvents(r.body.events).length === 0), 'no answer for a held choice');
  await h.click(key('Save & Next'));
  await h.advance(3200);
  assert.deepEqual(answerEvents(s.synced().at(-1).body.events), [['q1', 1]]);
});

test('N2: the switch to MockMob\'s screen lets a held choice go; there a tap saves, as before', async (t) => {
  const s = await open();
  t.after(() => s.unmount());
  await h.click(option(1));
  await h.click(h.one('button', 'MockMob'));
  assert.equal(h.one('.nta-runner').getAttribute('data-interface'), 'mockmob');
  assert.deepEqual(h.find('.nta-option').map((o) => o.getAttribute('aria-pressed') === 'true'), [false, false, false, false]);
  await h.click(h.find('.nta-option')[2]);
  assert.deepEqual(draft().answers, { q1: 2 }, 'MockMob\'s screen saves on tap');
  await h.click(h.one('button', 'NTA style'));
  assert.equal(state(1), 'Answered');
});

// ---- N3, N7 and the clock ---------------------------------------------------------------------------------------------------
test('N3: an NTA paper opens in NTA style unless its address names MockMob\'s screen; the links carry the choice', async (t) => {
  let s = await h.mount(nta({ params: { interface: null } }));
  t.after(() => s.unmount());
  assert.equal(h.one('.nta-runner').getAttribute('data-interface'), 'nta');
  await s.unmount();
  s = await h.mount(nta({ params: { interface: 'mockmob' } }));
  assert.equal(h.one('.nta-runner').getAttribute('data-interface'), 'mockmob');
  assert.equal(launchPath({ subject: 'english', count: 50, mode: 'nta', ntaScreen: 'nta' }), '/test?subject=english&count=50&mode=nta&interface=nta');
  assert.equal(launchPath({ subject: 'english', count: 50, mode: 'nta', ntaScreen: 'mockmob' }), '/test?subject=english&count=50&mode=nta&interface=mockmob');
  assert.equal(launchPath({ subject: 'english', count: 50, mode: 'nta', ntaScreen: true }), '/test?subject=english&count=50&mode=nta&interface=nta');
  assert.equal(practiceHref({ subject: 'english', mode: 'nta', screen: 'mockmob' }), '/dashboard?subject=english&mode=nta&interface=mockmob');
});

test('N7: no warnings counter on either screen; leaving the tab still brings the warning', async (t) => {
  const s = await open();
  t.after(() => s.unmount());
  assert.doesNotMatch(page(s), /Warnings/);
  await h.click(h.one('button', 'MockMob'));
  assert.doesNotMatch(page(s), /Warnings/);
  await h.advance(2000); await h.visibility(true);
  assert.match(page(s), /Warning 1 of 3/);
  await h.visibility(false);
});

test('the clock: one tick a second, on the second, and right again when the tab comes back', async (t) => {
  const s = await open();
  t.after(() => s.unmount());
  const clock = () => h.text(h.one('.nta-n-cand__time .nta-timer'));
  assert.equal(clock(), '01:00:00');
  await h.advance(1000); assert.equal(clock(), '00:59:59');
  await h.advance(1); assert.equal(clock(), '00:59:58', 'the tick lands just after the second turns');
  await h.advance(998); assert.equal(clock(), '00:59:58', 'a second lasts a second');
  await h.advance(2); assert.equal(clock(), '00:59:57');
  await h.visibility(true);
  await h.advance(70000, { coarse: true });
  await h.visibility(false);
  assert.equal(clock(), '00:58:47', 'read again the moment the tab is back');
  await h.advance(1000); assert.equal(clock(), '00:58:46');
});

test('NTA style shows one question at a time, as the exam does: a passage question keeps its passage beside it, and only what was on screen is visited', async (t) => {
  const questions = h.paper(6).map((q, i) => (i >= 1 && i <= 3 ? { ...q, passageGroupId: 'p1', passageText: 'A short factual passage.', passageTitle: 'Factual passage', orderIndex: i } : q));
  const s = await open({ questions });
  t.after(() => s.unmount());
  await h.click(chip(2));
  assert.equal(heading(), 'Question 2:');
  assert.equal(h.find('.nta-passage').length, 1, 'the passage is beside the question');
  assert.equal(h.find('.nta-question-block').length, 1, 'one question on screen');
  assert.equal(state(3), 'Not Visited', 'the rest of the set was not on screen');
  await h.click(option(1)); await h.click(key('Save & Next'));
  assert.equal(heading(), 'Question 3:', 'Save & Next goes question by question through the set');
  assert.equal(state(2), 'Answered');
  await h.click(key('Previous'));
  assert.equal(heading(), 'Question 2:');
  await h.click(h.one('.nta-n-palette .nta-submit-button', 'Submit'));
  await h.click(h.one('.nta-n-summary button', 'Yes'));
  const visits = s.submitted()[0].body.events.filter((e) => e.type === 'visit');
  assert.equal(visits.filter((e) => e.via === 'set').length, 0, 'no question is recorded as seen with its set');
  assert.ok(!visits.some((e) => e.qid === 'q4'), 'question 4 was never opened');
});

test('the marking the instructions print is the marking every paper is scored with', () => {
  const { marking } = TEST_MODES.nta;
  assert.deepEqual({ right: marking.right, wrong: marking.wrong, blank: marking.blank }, { right: PAPER.right, wrong: PAPER.wrong, blank: PAPER.blank });
  assert.equal(TEST_MODES.nta.fixedCount, PAPER.questions);
  assert.equal(TEST_MODES.nta.fixedDurationSec / 60, PAPER.minutes);
});
