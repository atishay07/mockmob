// The web runner's capture (spec tmp/mistake-lab-v4/SPEC.md 6, items 1 to 6): what the timed runner records and
// sends, checked against the server's own validator. The event builder is tested on its own; then the real runner
// (src/app/(app)/test/TestPageClient.jsx, rendered by data/tests/runner_harness.mjs) is driven as a student drives it
// and everything it sends (each in-progress save and the submit) must pass data/recovery.js scoreSession, with the
// record data/paper_trace.js reads. That the NTA page itself is unchanged is data/tests/runner_nta_ui.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as h from './runner_harness.mjs';
import { scoreSession, submitMeta, clientMeta, VISIT_VIA, MAX_SESSION_EVENTS } from '../recovery.js';
import { readTrace, questionTraceLines } from '../paper_trace.js';
import { buildTimeDecisions } from '../time_decisions.js';
import { buildMistakeLab } from '../mistake_lab.js';

// After the harness: its module hooks resolve the '@/' paths inside src/.
const { nextEvent, onScreenQid, endReason, captureMeta, RUNNER_VERSION, EVENT_ROOM } = await import('../../src/lib/runnerCapture.js');

const clock = (now, limitMs) => ({ startedAt: 1_000_000, now: 1_000_000 + now, limitMs });
const strip = (list) => list.map(({ seq, at, ...rest }) => rest);

// ---- the event builder ----------------------------------------------------------------------------
test('nextEvent numbers events from 1 and never lets the clock go back', () => {
  const events = [];
  for (const [now, type, value] of [[0, 'visit'], [5000, 'answer', 2], [4000, 'mark', true], [9000, 'visit', 'next']]) {
    events.push(nextEvent(events, clock(now), 'q1', type, value));
  }
  assert.deepEqual(events.map((e) => e.seq), [1, 2, 3, 4]);
  assert.deepEqual(events.map((e) => e.at), [0, 5000, 5000, 9000], 'an earlier device clock reading is held at the previous event');
  assert.deepEqual(strip(events), [
    { qid: 'q1', type: 'visit' }, { qid: 'q1', type: 'answer', answer: 2 }, { qid: 'q1', type: 'mark', marked: true }, { qid: 'q1', type: 'visit', via: 'next' },
  ]);
});

test('answers, marks and plain visits are built exactly as before slice 2', () => {
  assert.deepEqual(nextEvent([], clock(1200), 'q2', 'answer', null), { seq: 1, qid: 'q2', type: 'answer', at: 1200, answer: null });
  assert.deepEqual(nextEvent([], clock(1200), 'q2', 'mark', 'yes'), { seq: 1, qid: 'q2', type: 'mark', at: 1200, marked: false });
  assert.deepEqual(nextEvent([], clock(1200), 'q2', 'visit'), { seq: 1, qid: 'q2', type: 'visit', at: 1200 });
  assert.deepEqual(nextEvent([], clock(99_000, 60_000), 'q2', 'answer', 1).at, 99_000, 'only an end is held to the limit');
});

test('a visit carries only a via the server accepts', () => {
  for (const via of VISIT_VIA) assert.equal(nextEvent([], clock(0), 'q1', 'visit', via).via, via);
  for (const via of ['jump', '', null, 3]) assert.equal('via' in nextEvent([], clock(0), 'q1', 'visit', via), false, String(via));
});

test('strike, away, back and end take only what the server accepts', () => {
  assert.deepEqual(strip([nextEvent([], clock(0), 'q1', 'strike', { option: 1, on: true })]), [{ qid: 'q1', type: 'strike', option: 1, on: true }]);
  for (const bad of [null, { option: -1, on: true }, { option: 1.5, on: true }, { option: 1, on: 'yes' }, { on: false }]) {
    assert.equal(nextEvent([], clock(0), 'q1', 'strike', bad), null, JSON.stringify(bad));
  }
  assert.deepEqual(strip([nextEvent([], clock(0), 'q1', 'away'), nextEvent([], clock(0), 'q1', 'back')]), [{ qid: 'q1', type: 'away' }, { qid: 'q1', type: 'back' }]);
  assert.equal(nextEvent([], clock(0), 'q1', 'end', 'quit'), null);
  assert.equal(nextEvent([], clock(0), 'q1', 'scroll'), null, 'no type the server does not know');
  assert.equal(nextEvent([], { startedAt: 0, now: 5 }, 'q1', 'visit'), null, 'nothing before the paper has started');
  assert.equal(nextEvent([], clock(0), '', 'visit'), null, 'every event names a question');
  assert.equal(nextEvent(Array.from({ length: 5000 }, (_, i) => ({ seq: i + 1, at: 0 })), clock(0), 'q1', 'visit'), null, 'the 5,000-event cap');
});

test('the 5,000-event record keeps room for answers: time away and strike-outs go first, then visits and marks', () => {
  const filled = (n) => Array.from({ length: n }, (_, i) => ({ seq: i + 1, qid: 'q1', type: 'visit', at: 0 }));
  const kinds = (n) => ({
    away: !!nextEvent(filled(n), clock(0), 'q1', 'away'), back: !!nextEvent(filled(n), clock(0), 'q1', 'back'),
    strike: !!nextEvent(filled(n), clock(0), 'q1', 'strike', { option: 1, on: true }),
    via: 'via' in (nextEvent(filled(n), clock(0), 'q1', 'visit', 'next') || {}),
    set: nextEvent(filled(n), clock(0), 'q1', 'visit', 'set')?.via === 'set',
    visit: !!nextEvent(filled(n), clock(0), 'q1', 'visit'), mark: !!nextEvent(filled(n), clock(0), 'q1', 'mark', true),
    answer: !!nextEvent(filled(n), clock(0), 'q1', 'answer', 2), end: !!nextEvent(filled(n), clock(0, 60_000), 'q1', 'end', 'submit'),
  });
  assert.deepEqual(EVENT_ROOM, { telemetry: 4000, visits: 4800, answers: MAX_SESSION_EVENTS });
  assert.deepEqual(kinds(3999), { away: true, back: true, strike: true, via: true, set: true, visit: true, mark: true, answer: true, end: true });
  assert.deepEqual(kinds(4000), { away: false, back: false, strike: false, via: false, set: true, visit: true, mark: true, answer: true, end: true });
  assert.deepEqual(kinds(4800), { away: false, back: false, strike: false, via: false, set: false, visit: false, mark: false, answer: true, end: true });
  assert.deepEqual(kinds(4999), { away: false, back: false, strike: false, via: false, set: false, visit: false, mark: false, answer: true, end: true });
  assert.deepEqual(kinds(5000), { away: false, back: false, strike: false, via: false, set: false, visit: false, mark: false, answer: false, end: false });
  // A student who leaves the tab and crosses out options thousands of times still has every answer recorded, and the
  // record the server receives is never over its limit.
  const events = [];
  const at = (k) => clock(k * 10);
  for (let k = 0; events.length < 4000; k++) events.push(nextEvent(events, at(k), 'q1', k % 2 ? 'back' : 'away'));
  for (let k = 0; k < 3000; k++) { const e = nextEvent(events, at(4000 + k), 'q1', k % 3 === 0 ? 'strike' : k % 3 === 1 ? 'away' : 'visit', k % 3 === 0 ? { option: 1, on: true } : 'next'); if (e) events.push(e); }
  assert.equal(events.length, 4800, 'telemetry stopped at 4,000 and visits at 4,800');
  for (let k = 0; k < 150; k++) events.push(nextEvent(events, at(9000 + k), `q${(k % 3) + 1}`, 'answer', k % 4));
  events.push(nextEvent(events, at(9200, 3_600_000), 'q1', 'end', 'submit'));
  assert.equal(events.length, 4951);
  const s = scoreSession([1, 2, 3].map((n) => ({ id: `q${n}`, correctIndex: 0, options: ['a', 'b', 'c', 'd'] })), { q1: 3, q2: 0, q3: 1 }, events, 3_600_000); // the last of 150 answers on each question
  assert.equal(s.recovery.telemetry, 'self_reported', 'every answer is in the record: it matches the submitted answers');
  assert.equal(s.recovery.end.reason, 'submit');
});

test('an end is held to the paper limit, and a time-up end is the limit itself', () => {
  assert.equal(nextEvent([], clock(30_000, 60_000), 'q1', 'end', 'submit').at, 30_000);
  assert.equal(nextEvent([], clock(61_500, 60_000), 'q1', 'end', 'nta_strikes').at, 60_000);
  assert.equal(nextEvent([], clock(59_250, 60_000), 'q1', 'end', 'time_up').at, 60_000, 'the countdown shows 0:00 for the whole last second');
  assert.equal(nextEvent([{ seq: 4, at: 60_400 }], clock(60_500, 60_000), 'q1', 'end', 'time_up').at, 60_400, 'never earlier than the event before it');
  assert.equal(nextEvent([], clock(45_000), 'q1', 'end', 'submit').at, 45_000, 'no limit known: the device clock');
});

test('onScreenQid is the question in focus (the last answer or visit); endReason keeps a first reason on a retry', () => {
  assert.equal(onScreenQid([{ qid: 'q3', type: 'visit' }, { qid: 'q5', type: 'answer' }], 'q1'), 'q5');
  assert.equal(onScreenQid([{ qid: 'q3', type: 'visit' }, { qid: 'q5', type: 'mark' }, { qid: 'q6', type: 'strike' }], 'q1'), 'q3', 'a mark or a strike on another question of the page does not move focus');
  assert.equal(onScreenQid([{ qid: 'q4', type: 'visit', via: 'set' }, { qid: 'q3', type: 'visit', via: 'next' }, { qid: 'q5', type: 'visit', via: 'set' }], 'q1'), 'q3', 'a question shown with its set is not in focus');
  assert.equal(onScreenQid([{ qid: 'q3', type: 'visit', via: 'sheet' }], 'q1'), 'q3', 'the question under the submit sheet');
  assert.equal(onScreenQid([], 'q1'), 'q1');
  assert.equal(endReason([], 'time_up'), 'time_up');
  assert.equal(endReason([{ type: 'end', reason: 'time_up' }, { type: 'away' }], undefined), 'time_up');
  assert.equal(endReason([{ type: 'end', reason: 'time_up' }], { type: 'click' }), 'time_up', 'a click event is no reason');
  assert.equal(endReason([], { type: 'click' }), 'submit');
});

test('onScreenQid and endReason work on a browser without Array.prototype.findLast (it runs before the NTA submit check)', () => {
  const original = Object.getOwnPropertyDescriptor(Array.prototype, 'findLast');
  delete Array.prototype.findLast;
  try {
    assert.equal(onScreenQid([{ qid: 'q3', type: 'visit' }, { qid: 'q5', type: 'mark' }], 'q1'), 'q3');
    assert.equal(onScreenQid(null, 'q1'), 'q1');
    assert.equal(endReason([{ type: 'end', reason: 'nta_strikes' }, { type: 'back' }], undefined), 'nta_strikes');
  } finally {
    Object.defineProperty(Array.prototype, 'findLast', original);
  }
});

test('captureMeta is the client meta and end reason the server keeps as they are', () => {
  const meta = captureMeta({ startedAt: Date.UTC(2026, 9, 15, 10, 0, 0) + 0.4, endedBy: 'time_up' });
  assert.deepEqual(meta.client, { platform: 'web', appVersion: RUNNER_VERSION, startedAt: Date.UTC(2026, 9, 15, 10) });
  assert.equal(meta.endedBy, 'time_up');
  assert.match(RUNNER_VERSION, /^runner\.2(\+[0-9a-f]{7,12})?$/);
  assert.deepEqual(clientMeta(meta, Date.UTC(2026, 9, 15, 11)), meta.client, 'every field survives the server check');
  assert.deepEqual(captureMeta({ startedAt: 0, endedBy: 'later' }), { client: { platform: 'web', appVersion: RUNNER_VERSION } });
});

// ---- the real runner ------------------------------------------------------------------------------
const elapsedAt = (s) => h.clock.now - s.startedAt;
/** What the server does with a device-held submit (src/lib/server/practiceSessions.js finishPractice). */
function serverScore(s, body) {
  const duration = Math.min(s.durationMs, elapsedAt(s) + 2000);
  return { score: scoreSession(s.questions, body.answers, body.events, duration), meta: submitMeta(body, body.events, h.clock.now) };
}
const types = (events) => events.map((e) => e.type + (e.via ? `:${e.via}` : '') + (e.reason ? `:${e.reason}` : ''));

test('an NTA paper sends via, time away, marks and its end, and the server keeps every one', async (t) => {
  const s = await h.mount({ mode: 'nta' });
  t.after(() => s.unmount());
  await h.NTA_PATHS.submit(s, () => {});
  const [submit] = s.submitted();
  assert.ok(submit, 'one submit');
  const body = submit.body;
  // Submit test with questions left: the NTA check opens over question 6 (via sheet), and the paper is submitted.
  assert.deepEqual(types(body.events), ['visit', 'answer', 'visit:next', 'visit:palette', 'mark', 'visit:previous', 'visit:next', 'answer', 'away', 'back', 'visit:next', 'visit:next', 'visit:sheet', 'end:submit']);
  assert.deepEqual(body.events.map((e) => e.seq), body.events.map((_, i) => i + 1), 'seq rises by one, as the database requires');
  const { score, meta } = serverScore(s, body);
  assert.equal(score.recovery.telemetry, 'self_reported');
  assert.deepEqual(score.recovery.presence.map((e) => [e.type, e.qid, e.at]), [['away', 'q4', 41000], ['back', 'q4', 111000]]);
  assert.deepEqual(score.recovery.marks.map((e) => [e.qid, e.marked]), [['q4', true]]);
  assert.deepEqual(score.recovery.end, { seq: 14, qid: 'q6', at: 128000, reason: 'submit' });
  assert.deepEqual(score.recovery.timeline.filter((e) => e.via).map((e) => e.via), ['next', 'palette', 'previous', 'next', 'next', 'next', 'sheet']);
  assert.deepEqual(meta, { client: { platform: 'web', appVersion: RUNNER_VERSION, startedAt: s.startedAt }, endedBy: 'submit' });
  // The record reads as the student lived it: the 70 seconds away are not time on question 4.
  const trace = readTrace(score.recovery);
  assert.equal(trace.dwell.get('q4'), (28000 - 21000) + (41000 - 34000) + (118000 - 111000));
  assert.deepEqual(questionTraceLines(trace, 'q4'), ['You marked it for review at 0:24. It was still marked when you submitted.', 'Away from the paper for 1m 10s while this question was open. Not counted.']);
  assert.equal(trace.dwell.get('q6'), 2000, 'the last question runs to the end');
});

test('time up: the end is the paper limit, reason time_up, and the trace says time ran out at 60:00', async (t) => {
  const s = await h.mount({ mode: 'nta' });
  t.after(() => s.unmount());
  await h.NTA_PATHS.timeUp(s, () => {});
  const body = s.submitted()[0].body;
  assert.deepEqual(body.events.at(-1), { seq: 4, qid: 'q2', type: 'end', at: 3600000, reason: 'time_up' });
  assert.equal(body.endedBy, 'time_up');
  const { score, meta } = serverScore(s, body);
  assert.equal(meta.endedBy, 'time_up');
  assert.deepEqual(questionTraceLines(readTrace(score.recovery), 'q2'), ['Time ran out at 60:00 with this question open.']);
});

test('the third warning: three aways, two backs, then the end with reason nta_strikes', async (t) => {
  const s = await h.mount({ mode: 'nta' });
  t.after(() => s.unmount());
  await h.NTA_PATHS.strikes(s, () => {});
  const body = s.submitted()[0].body;
  assert.deepEqual(types(body.events), ['visit', 'answer', 'away', 'back', 'away', 'back', 'away', 'end:nta_strikes']);
  const { score, meta } = serverScore(s, body);
  assert.equal(meta.endedBy, 'nta_strikes');
  assert.equal(score.recovery.end.reason, 'nta_strikes');
  assert.equal(score.recovery.presence.length, 5);
});

test('practice and full mocks send every cross-out and restore, swipes, and the submit sheet\'s end', async (t) => {
  const questions = h.paper(); questions[0].correctIndex = 1; // B is the key of question 1
  const s = await h.mount({ mode: 'full', questions });
  t.after(() => s.unmount());
  const option = (n) => h.find('.nta-option')[n];
  await h.advance(4000); await h.fire(option(1), 'contextmenu'); // B crossed out
  await h.advance(3000); await h.key('!', { code: 'Digit3', shiftKey: true }); // C crossed out from the keyboard
  await h.advance(2000);
  await h.fire(option(1), 'pointerdown', { pointerType: 'mouse' }); await h.advance(500); // a long press (460 ms) restores B
  await h.fire(option(1), 'pointerup'); await h.fire(option(1), 'click');
  assert.ok(option(2).getAttribute('class').includes('is-struck'), 'C still shows crossed out');
  assert.ok(!option(1).getAttribute('class').includes('is-struck'), 'B shows restored');
  await h.advance(2000); await h.click(option(0));
  const stage = h.one('.pr-stage');
  await h.advance(3000);
  await h.fire(stage, 'pointerdown', { pointerType: 'touch', clientX: 300, clientY: 200 });
  await h.fire(stage, 'pointermove', { pointerType: 'touch', clientX: 150, clientY: 202 });
  await h.fire(stage, 'pointerup', { pointerType: 'touch', clientX: 150, clientY: 202 });
  await h.fire(stage, 'click'); // the browser's click after the swipe, swallowed by the stage
  await h.advance(5000); await h.click(h.one('.nta-submit-button', 'Submit test'));
  await h.click(h.one('.pr-sheet button', 'Submit now'));
  const body = s.submitted()[0].body;
  assert.deepEqual(types(body.events), ['visit', 'strike', 'strike', 'strike', 'answer', 'visit:swipe', 'visit:sheet', 'end:submit']);
  const { score } = serverScore(s, body);
  assert.deepEqual(score.recovery.strikes.map(({ qid, option: o, on, at }) => [qid, o, on, at]), [['q1', 1, true, 4000], ['q1', 2, true, 7000], ['q1', 1, false, 9460]]);
  const trace = readTrace(score.recovery);
  assert.deepEqual(questionTraceLines(trace, 'q1', { keyIndex: questions[0].correctIndex }), ['You crossed out B, the key, at 0:04 and restored it at 0:09.', 'You crossed out C at 0:07.']);
});

test('a server-held paper: every in-progress save passes the server check and keeps seq unbroken', async (t) => {
  const s = await h.mount({ mode: 'nta', storage: 'server' });
  t.after(() => s.unmount());
  await h.click(h.one('button', 'Continue in this window'));
  await h.advance(4000); await h.click(h.find('.nta-option')[3]);
  await h.advance(2000); await h.visibility(true);
  await h.advance(9000); await h.visibility(false);
  await h.click(h.one('button', 'Continue in this window'));
  await h.advance(3000); await h.click(h.one('.nta-nav-button', 'Next'));
  await h.advance(2000);
  const saves = s.synced();
  assert.ok(saves.length >= 3, 'the 1.5 second save ran');
  for (const save of saves) {
    // src/lib/server/recoverySessions.js recordEvents: validation only, bounded by the server's elapsed time.
    assert.doesNotThrow(() => scoreSession(s.questions, {}, save.body.events, Math.min(s.durationMs, elapsedAt(s) + 2000)));
    assert.deepEqual(save.body.events.map((e) => e.seq), save.body.events.map((_, i) => i + 1));
  }
  assert.deepEqual(types(saves.at(-1).body.events), ['visit', 'answer', 'away', 'back', 'visit:next']);
});

test('a reload on the same device: the away was saved at once, and the paper reopens with a resume visit', async (t) => {
  const first = await h.mount({ mode: 'full', params: { generationKey: 'generation-reload-0001' } });
  let open = first;
  t.after(() => open.unmount());
  await h.advance(6000); await h.click(h.find('.nta-option')[2]);
  await h.advance(4000); await h.click(h.one('.nta-nav-button', 'Next'));
  await h.advance(3000);
  // The tab is closing: no render may follow, so the away must be in the saved draft at once.
  const saved = h.withoutRender(() => {
    h.document.hidden = true; h.document.dispatchEvent(new h.FakeEvent('visibilitychange'));
    return JSON.parse([...Array(localStorage.length).keys()].map((i) => localStorage.getItem(localStorage.key(i))).find((v) => v.includes('"events"')));
  });
  assert.equal(saved.events.at(-1).type, 'away', 'the away is in the saved draft before any render');
  await first.unmount({ keepStorage: true });
  await h.advance(120000);
  const second = await h.mount({ mode: 'full', params: { generationKey: 'generation-reload-0001' } });
  open = second;
  assert.equal(second.requests.length, 0, 'resumed from this device, no new session');
  await h.advance(5000); await h.click(h.find('.nta-option')[0]);
  await h.advance(1000); await h.click(h.one('.nta-submit-button', 'Submit test'));
  await h.click(h.one('.pr-sheet button', 'Submit now'));
  const body = second.submitted()[0].body;
  assert.deepEqual(types(body.events), ['visit', 'answer', 'visit:next', 'away', 'visit:resume', 'answer', 'visit:sheet', 'end:submit']);
  const score = scoreSession(second.questions, body.answers, body.events, Math.min(first.durationMs, h.clock.now - first.startedAt + 2000));
  const trace = readTrace(score.recovery);
  assert.equal(trace.dwell.get('q2'), 3000 + 5000 + 1000, 'the two minutes closed are not time on question 2');
  assert.equal(body.client.startedAt, first.startedAt, 'the paper\'s own start, not the reload');
});

test('a paper resumed from the server opens with a resume visit after the saved events', async (t) => {
  const saved = [{ seq: 1, qid: 'q1', type: 'visit', at: 0 }, { seq: 2, qid: 'q1', type: 'answer', at: 5000, answer: 1 }];
  const s = await h.mount({ mode: 'nta', storage: 'server', events: saved });
  t.after(() => s.unmount());
  await h.click(h.one('button', 'Continue in this window'));
  await h.advance(2000);
  const last = s.synced().at(-1).body.events;
  assert.deepEqual(last.slice(0, 2), saved);
  assert.deepEqual(strip(last.slice(2)), [{ qid: 'q1', type: 'visit', via: 'resume' }]);
  assert.deepEqual(h.find('.nta-option').map((o) => o.getAttribute('aria-pressed')), ['false', 'true', 'false', 'false'], 'the saved answer is back');
});

// ---- passage sets, strike-out parity and the submit sheet ---------------------------------------------------------
/** A paper with one passage set: q1 single, q2 to q5 one set (four questions on one page), q6 and q7 single. */
function passagePaper() {
  return h.paper(7).map((q, i) => (i >= 1 && i <= 4
    ? { ...q, passageGroupId: 'set-a', passageText: 'Illustrative passage for questions 2 to 5.', passageTitle: 'Case study', orderIndex: i }
    : q));
}
const block = (n) => h.find('.nta-question-block')[n];
const optionIn = (n, k) => block(n).querySelectorAll('.nta-option')[k];

// The student's path through the set, the same with and without capture.
async function passagePath(s, snap) {
  await h.click(h.one('button', 'Continue in this window')); snap('entered');
  await h.advance(7000); await h.click(h.find('.nta-option')[1]); snap('answered q1');
  await h.advance(5000); await h.click(h.one('.nta-nav-button', 'Next')); snap('set page');
  await h.advance(20000); await h.click(optionIn(1, 3)); snap('answered q3 on the page');
  await h.advance(10000); await h.click(block(2).querySelector('.nta-text-button')); snap('marked q4');
  await h.advance(8000); await h.click(h.one('.nta-nav-button', 'Next')); snap('q6');
  await h.advance(6000); await h.click(h.find('.nta-palette-chip').find((b) => h.text(b) === '3')); snap('palette 3');
  await h.advance(4000); await h.click(h.one('.nta-nav-button', 'Next')); snap('q6 again');
  await h.advance(3000); await h.click(h.one('.nta-nav-button', 'Next')); snap('q7');
  await h.advance(2000); await h.click(h.one('.nta-submit-button', 'Submit test')); snap('submitted');
}

test('an NTA passage set: every question on the page is recorded as opened, and the page itself is unchanged', async () => {
  const run = async (capture) => {
    const s = await h.mount({ mode: 'nta', capture, questions: passagePaper() });
    const shots = [];
    try { await passagePath(s, (label) => shots.push({ label, html: s.html() })); } finally { await s.unmount(); }
    return { s, shots };
  };
  const on = await run('on');
  const off = await run('off');
  assert.deepEqual(on.shots.map((x) => x.label), off.shots.map((x) => x.label));
  on.shots.forEach((shot, i) => assert.ok(shot.html === off.shots[i].html, `the NTA page differs after "${shot.label}"`));
  assert.match(on.shots[2].html, /Questions 2 to 5/, 'the set is one page');

  const body = on.s.submitted()[0].body;
  const tq = (e) => `${e.type}:${e.qid}${e.via ? `:${e.via}` : ''}${e.reason ? `:${e.reason}` : ''}`;
  assert.deepEqual(body.events.map(tq), [
    'visit:q1', 'answer:q1',
    'visit:q3:set', 'visit:q4:set', 'visit:q5:set', 'visit:q2:next', // the set's page, q2 in focus
    'answer:q3', 'visit:q3', // picking an answer in q3 moves focus there
    'mark:q4', // a mark does not
    'visit:q6:next',
    'visit:q2:set', 'visit:q4:set', 'visit:q5:set', 'visit:q3:palette', // the page again, from the palette
    'visit:q6:next', 'visit:q7:next', 'visit:q7:sheet', 'end:q7:submit',
  ]);
  const { score } = serverScore(on.s, body);
  const attempt = { questionsSnapshot: on.s.questions, details: score.details, selectionMeta: { mode: 'nta', durationMinutes: 60, scoringVersion: 'server_snapshot_v1', recovery: score.recovery } };
  const td = buildTimeDecisions(attempt);
  const row = (qid) => td.rows.find((r) => r.qid === qid);
  assert.equal(row('q5').opened, true);
  assert.equal(row('q5').lines[0], 'Shown with its passage 2 times. You never answered it or moved to it, so no time is counted on it.');
  assert.deepEqual(row('q4').lines, ['Shown with its passage 2 times. You never answered it or moved to it, so no time is counted on it.', 'You marked it for review at 0:42. It was still marked when you submitted.']);
  assert.equal(row('q2').ms, 20000, 'q2 was in focus from landing until q3 was answered');
  assert.equal(row('q3').ms, 18000 + 4000);
  const lab = buildMistakeLab({ attempt });
  assert.equal(lab.groups.some((g) => g.id === 'never_opened'), false, 'nothing the student saw is "never opened"');
  assert.equal(lab.replay.facts[0], 'You opened all 7 questions.');
});

test('a passage set reached by the palette on a sub-question puts that one in focus, the rest shown', async (t) => {
  const s = await h.mount({ mode: 'full', questions: passagePaper() });
  t.after(() => s.unmount());
  await h.advance(3000); await h.click(h.find('.nta-palette-chip').find((b) => h.text(b) === '4'));
  await h.advance(5000); await h.click(h.one('.nta-nav-button', 'Previous'));
  await h.advance(2000); await h.click(h.one('.nta-nav-button', 'Next'));
  const events = s.synced().length ? s.synced().at(-1).body.events : null;
  assert.equal(events, null, 'a device-held paper sends nothing before the submit');
  await h.advance(1000); await h.click(h.one('.nta-submit-button', 'Submit test'));
  await h.click(h.one('.pr-sheet button', 'Submit now'));
  const tq = (e) => `${e.type}:${e.qid}${e.via ? `:${e.via}` : ''}${e.reason ? `:${e.reason}` : ''}`;
  assert.deepEqual(s.submitted()[0].body.events.map(tq), [
    'visit:q1', 'visit:q2:set', 'visit:q3:set', 'visit:q5:set', 'visit:q4:palette', 'visit:q1:previous',
    'visit:q3:set', 'visit:q4:set', 'visit:q5:set', 'visit:q2:next', 'visit:q2:sheet', 'end:q2:submit',
  ]);
});

test('practice strike parity with the app: picking a crossed-out option brings it back, and the chosen one is never crossed out', async (t) => {
  const questions = h.paper(); questions[0].correctIndex = 1;
  const s = await h.mount({ mode: 'full', questions });
  t.after(() => s.unmount());
  const option = (n) => h.find('.nta-option')[n];
  await h.advance(3000); await h.fire(option(1), 'contextmenu'); // B crossed out
  assert.ok(option(1).getAttribute('class').includes('is-struck'));
  await h.advance(4000); await h.click(option(1)); // B picked: it is brought back
  assert.ok(!option(1).getAttribute('class').includes('is-struck'), 'B shows restored');
  assert.equal(option(1).getAttribute('aria-pressed'), 'true');
  await h.advance(2000); await h.fire(option(1), 'contextmenu'); // the chosen option cannot be crossed out
  assert.ok(!option(1).getAttribute('class').includes('is-struck'));
  await h.advance(1000); await h.key('@', { code: 'Digit2', shiftKey: true }); // nor from the keyboard
  assert.ok(!option(1).getAttribute('class').includes('is-struck'));
  await h.advance(1000); await h.click(h.one('.nta-submit-button', 'Submit test'));
  await h.click(h.one('.pr-sheet button', 'Submit now'));
  const body = s.submitted()[0].body;
  assert.deepEqual(types(body.events), ['visit', 'strike', 'strike', 'answer', 'visit:sheet', 'end:submit']);
  const strikes = body.events.filter((e) => e.type === 'strike').map(({ option: o, on, at }) => [o, on, at]);
  assert.deepEqual(strikes, [[1, true, 3000], [1, false, 7000]], 'the restore is recorded just before the answer, as the app does');
  const { score } = serverScore(s, body);
  assert.deepEqual(questionTraceLines(readTrace(score.recovery), 'q1', { keyIndex: 1 }), ['You crossed out B, the key, at 0:03 and restored it at 0:07.']);
});

test('the submit sheet: its time is on no question, Keep answering returns to the same visit, the last time stops at the sheet', async (t) => {
  const s = await h.mount({ mode: 'full' });
  t.after(() => s.unmount());
  await h.advance(10000); await h.click(h.find('.nta-option')[0]);
  await h.advance(5000); await h.click(h.one('.nta-submit-button', 'Submit test')); // the sheet opens at 0:15
  await h.advance(40000); await h.click(h.one('.pr-sheet button', 'Keep answering')); // back at 0:55
  await h.advance(5000); await h.click(h.find('.nta-option')[2]); // changed at 1:00
  await h.advance(3000); await h.click(h.one('.nta-submit-button', 'Submit test')); // the sheet again at 1:03
  await h.advance(30000); await h.key('Escape'); // closed at 1:33
  await h.advance(2000); await h.click(h.one('.nta-submit-button', 'Submit test')); // and again at 1:35
  await h.advance(25000); await h.click(h.one('.pr-sheet button', 'Submit now')); // submitted at 2:00
  const body = s.submitted()[0].body;
  assert.deepEqual(types(body.events), ['visit', 'answer', 'visit:sheet', 'visit', 'answer', 'visit:sheet', 'visit', 'visit:sheet', 'end:submit']);
  const { score } = serverScore(s, body);
  const trace = readTrace(score.recovery);
  assert.equal(trace.dwell.get('q1'), 15000 + 8000 + 2000, '95 seconds on the sheet are on no question');
  assert.equal(trace.visits.get('q1'), 1);
  const attempt = { questionsSnapshot: s.questions, details: score.details, selectionMeta: { mode: 'full', durationMinutes: 60, scoringVersion: 'server_snapshot_v1', recovery: score.recovery } };
  assert.match(buildTimeDecisions(attempt).rows[0].lines[0], /^25s on this question, until you went to submit at 1:35\./);
});

test('NTA: the submit check is recorded around the browser dialog, and cancelling it changes nothing on the page', async (t) => {
  const s = await h.mount({ mode: 'nta' });
  t.after(() => { globalThis.confirm = () => true; return s.unmount(); });
  await h.click(h.one('button', 'Continue in this window'));
  await h.advance(6000); await h.click(h.find('.nta-option')[0]);
  const before = s.html();
  globalThis.confirm = () => { h.clock.now += 4000; return false; }; // four seconds reading the dialog, then Cancel
  await h.click(h.one('.nta-submit-button', 'Submit test'));
  assert.equal(s.html(), before, 'Cancel leaves the paper exactly as it was');
  assert.equal(s.submitted().length, 0);
  globalThis.confirm = () => true;
  await h.advance(3000); await h.click(h.one('.nta-submit-button', 'Submit test'));
  const body = s.submitted()[0].body;
  assert.deepEqual(types(body.events), ['visit', 'answer', 'visit:sheet', 'visit', 'visit:sheet', 'end:submit']);
  const trace = readTrace(serverScore(s, body).score.recovery);
  assert.equal(trace.dwell.get('q1'), 6000 + 3000, 'the 4 seconds in the dialog are on no question');
});
