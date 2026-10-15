// The web runner's capture (spec tmp/mistake-lab-v4/SPEC.md 6, items 1 to 6): what the timed runner records and
// sends, checked against the server's own validator. The event builder is tested on its own; then the real runner
// (src/app/(app)/test/TestPageClient.jsx, rendered by data/tests/runner_harness.mjs) is driven as a student drives it
// and everything it sends (each in-progress save and the submit) must pass data/recovery.js scoreSession, with the
// record data/paper_trace.js reads. That the NTA page itself is unchanged is data/tests/runner_nta_ui.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as h from './runner_harness.mjs';
import { scoreSession, submitMeta, clientMeta, VISIT_VIA } from '../recovery.js';
import { readTrace, questionTraceLines } from '../paper_trace.js';

// After the harness: its module hooks resolve the '@/' paths inside src/.
const { nextEvent, onScreenQid, endReason, captureMeta, RUNNER_VERSION } = await import('../../src/lib/runnerCapture.js');

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

test('an end is held to the paper limit, and a time-up end is the limit itself', () => {
  assert.equal(nextEvent([], clock(30_000, 60_000), 'q1', 'end', 'submit').at, 30_000);
  assert.equal(nextEvent([], clock(61_500, 60_000), 'q1', 'end', 'nta_strikes').at, 60_000);
  assert.equal(nextEvent([], clock(59_250, 60_000), 'q1', 'end', 'time_up').at, 60_000, 'the countdown shows 0:00 for the whole last second');
  assert.equal(nextEvent([{ seq: 4, at: 60_400 }], clock(60_500, 60_000), 'q1', 'end', 'time_up').at, 60_400, 'never earlier than the event before it');
  assert.equal(nextEvent([], clock(45_000), 'q1', 'end', 'submit').at, 45_000, 'no limit known: the device clock');
});

test('onScreenQid is the question the last event named; endReason keeps a first reason on a retry', () => {
  assert.equal(onScreenQid([{ qid: 'q3' }, { qid: 'q5' }], 'q1'), 'q5');
  assert.equal(onScreenQid([], 'q1'), 'q1');
  assert.equal(endReason([], 'time_up'), 'time_up');
  assert.equal(endReason([{ type: 'end', reason: 'time_up' }, { type: 'away' }], undefined), 'time_up');
  assert.equal(endReason([{ type: 'end', reason: 'time_up' }], { type: 'click' }), 'time_up', 'a click event is no reason');
  assert.equal(endReason([], { type: 'click' }), 'submit');
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
  assert.deepEqual(types(body.events), ['visit', 'answer', 'visit:next', 'visit:palette', 'mark', 'visit:previous', 'visit:next', 'answer', 'away', 'back', 'visit:next', 'visit:next', 'end:submit']);
  assert.deepEqual(body.events.map((e) => e.seq), body.events.map((_, i) => i + 1), 'seq rises by one, as the database requires');
  const { score, meta } = serverScore(s, body);
  assert.equal(score.recovery.telemetry, 'self_reported');
  assert.deepEqual(score.recovery.presence.map((e) => [e.type, e.qid, e.at]), [['away', 'q4', 41000], ['back', 'q4', 111000]]);
  assert.deepEqual(score.recovery.marks.map((e) => [e.qid, e.marked]), [['q4', true]]);
  assert.deepEqual(score.recovery.end, { seq: 13, qid: 'q6', at: 128000, reason: 'submit' });
  assert.deepEqual(score.recovery.timeline.filter((e) => e.via).map((e) => e.via), ['next', 'palette', 'previous', 'next', 'next', 'next']);
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
  assert.deepEqual(types(body.events), ['visit', 'strike', 'strike', 'strike', 'answer', 'visit:swipe', 'end:submit']);
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
  assert.deepEqual(types(body.events), ['visit', 'answer', 'visit:next', 'away', 'visit:resume', 'answer', 'end:submit']);
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
