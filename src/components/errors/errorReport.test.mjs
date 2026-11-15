// The error pages' pure helpers: the report sent to the app's error log, the reporter's memory and its silence on failure,
// the reference shown to the student and the rule behind "Try again".
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, cleanMessage, createReporter, deviceClassOf, reportError, screenOf, stackFrames, MAX_REPORTS_PER_LOAD } from './errorReport.mjs';
import { ERROR_COPY, needsFreshLoad, referenceOf, supportHref, tryAgain } from './errorCopy.mjs';
import { normalizeError } from '../../lib/server/appErrors.js';

const chromeStack = [
  'TypeError: Cannot read properties of undefined (reading \'options\')',
  '    at QuestionCard (https://www.mockmob.in/_next/static/chunks/app/test/page-3f2a.js?dpl=dpl_abc:1:2345)',
  '    at renderWithHooks (https://www.mockmob.in/_next/static/chunks/framework.js:9:100)',
].join('\n');

test('the message keeps its shape and loses every quoted part (a student\'s words can be quoted in it)', () => {
  const json = new SyntaxError('Unexpected token \'T\', "The answer is (B) because the firm" is not valid JSON');
  const clean = cleanMessage(json);
  assert.equal(clean, 'SyntaxError: Unexpected token \'T\', "…" is not valid JSON');
  assert.ok(!clean.includes('answer'));
  assert.equal(cleanMessage(new TypeError("Cannot read properties of undefined (reading 'options')")), "TypeError: Cannot read properties of undefined (reading 'options')");
  assert.ok(!cleanMessage(new Error('Bad text `my own long answer here`')).includes('my own'));
  assert.ok(!cleanMessage(new Error("Saw 'a long single quoted sentence written by me'")).includes('written by me'));
  assert.ok(cleanMessage(new Error('x'.repeat(5000))).length <= 300);
  assert.equal(cleanMessage(null), 'Error');
  assert.equal(cleanMessage('plain string thrown'), 'Error: plain string thrown');
});

test('only stack frames leave the browser, without the message line or query strings', () => {
  const frames = stackFrames(chromeStack);
  assert.ok(!frames.includes('TypeError'));
  assert.equal(frames.split('\n').length, 2);
  assert.ok(!frames.includes('dpl='));
  assert.match(frames, /at QuestionCard \(https:\/\/www\.mockmob\.in\/_next\/static\/chunks\/app\/test\/page-3f2a\.js:1:2345\)/);
  assert.equal(stackFrames('render@https://x.test/a.js:1:2\nnot a frame'), 'render@https://x.test/a.js:1:2');
  assert.equal(stackFrames(undefined), '');
  const many = Array.from({ length: 40 }, (_, i) => `    at f${i} (a.js:${i}:1)`).join('\n');
  assert.equal(stackFrames(many).split('\n').length, 12);
});

test('the route goes without its query or fragment', () => {
  assert.equal(screenOf('/test'), '/test');
  assert.equal(screenOf('/result/abc?x=1#y'), '/result/abc');
  assert.equal(screenOf('nope'), null);
  assert.equal(deviceClassOf({ coarse: true, shortSide: 390 }), 'phone');
  assert.equal(deviceClassOf({ coarse: true, shortSide: 800 }), 'tablet');
  assert.equal(deviceClassOf({ coarse: false, shortSide: 390 }), 'other');
});

test('a report has the collector\'s shape and survives the server\'s own scrubbing, digest included', () => {
  const error = new Error('An error occurred in the Server Components render.');
  error.digest = '2213259427@E394';
  const body = buildReport(error, { pathname: '/today?subject=accountancy', where: 'app', coarse: true, shortSide: 390, build: 'a1b2c3d4e5f6' });
  assert.equal(body.kind, 'other');
  assert.equal(body.platform, 'web');
  assert.equal(body.screen, '/today');
  assert.equal(body.device_class, 'phone');
  assert.equal(body.build, 'a1b2c3d4e5f6');
  assert.match(body.message, /\[web app digest_2213259427\]$/);
  const row = normalizeError(body);
  assert.ok(row, 'the server accepts it');
  assert.equal(row.platform, 'web');
  assert.equal(row.screen, '/today');
  assert.match(row.message, /digest_2213259427/, 'the digest is not taken for a phone number');
  assert.equal(buildReport(new Error('x'), { build: 'not a build id!' }).build, undefined);
});

test('the reporter swallows every failure and never throws', async () => {
  const throwing = createReporter({ send: () => { throw new Error('network down'); } });
  assert.equal(throwing(new Error('a')), false);
  let unhandled = 0;
  const onUnhandled = () => { unhandled += 1; };
  process.on('unhandledRejection', onUnhandled);
  const rejecting = createReporter({ send: () => Promise.reject(new Error('offline')) });
  assert.equal(rejecting(new Error('b')), true);
  await new Promise((resolve) => setTimeout(resolve, 20));
  process.off('unhandledRejection', onUnhandled);
  assert.equal(unhandled, 0, 'a failed request is caught');
  const hostile = { get name() { throw new Error('getter'); }, get message() { throw new Error('getter'); }, get stack() { throw new Error('getter'); }, get digest() { throw new Error('getter'); } };
  assert.doesNotThrow(() => createReporter({ send: () => {} })(hostile));
  assert.doesNotThrow(() => createReporter({})(new Error('no send')));
  assert.equal(createReporter({})(new Error('no send')), false);
  // Outside a browser the page helper does nothing.
  assert.equal(reportError(new Error('server side')), false);
});

test('each error is reported once, and a page that keeps crashing stops after a few reports', () => {
  const sent = [];
  const report = createReporter({ send: (body) => { sent.push(body); } });
  const crash = () => new Error('one');
  const error = crash();
  assert.equal(report(error, { pathname: '/today' }), true);
  assert.equal(report(error, { pathname: '/today' }), false, 'the same error object (React may run an effect twice)');
  assert.equal(report(crash(), { pathname: '/today' }), false, 'the same failure again on the same page (same place in the code)');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].errors.length, 1);
  for (let i = 0; i < 20; i += 1) report(new Error(`different ${i}`), { pathname: '/today' });
  assert.equal(sent.length, MAX_REPORTS_PER_LOAD);
});

test('the reference is the digest\'s hash only, and only a plain token', () => {
  assert.equal(referenceOf({ digest: '2213259427@E394' }), '2213259427');
  assert.equal(referenceOf({ digest: 'abc123' }), 'abc123');
  assert.equal(referenceOf({ digest: '<script>' }), null);
  assert.equal(referenceOf({}), null);
  assert.equal(referenceOf(null), null);
  assert.equal(supportHref('abc123'), 'mailto:support@mockmob.in?subject=Reference%20abc123');
  assert.equal(supportHref(null), 'mailto:support@mockmob.in');
});

test('Try again: a fresh load when code failed to load, the server again for a server failure, else a fresh draw', () => {
  const calls = [];
  const deps = { retry: () => calls.push('retry'), reset: () => calls.push('reset'), reload: () => calls.push('reload') };
  const chunk = new Error('Loading chunk 123 failed.');
  chunk.name = 'ChunkLoadError';
  assert.equal(needsFreshLoad(chunk), true);
  assert.equal(needsFreshLoad(new TypeError('Failed to fetch dynamically imported module: https://x/a.js')), true);
  assert.equal(needsFreshLoad(new Error('x')), false);
  tryAgain(chunk, deps);
  const server = new Error('server');
  server.digest = '123';
  tryAgain(server, deps);
  tryAgain(new Error('client'), deps);
  tryAgain(new Error('client'), { retry: deps.retry });
  tryAgain(new Error('client'), { reset: () => { throw new Error('boom'); }, reload: deps.reload });
  assert.deepEqual(calls, ['reload', 'retry', 'reset', 'retry', 'reload']);
  assert.doesNotThrow(() => tryAgain(new Error('nothing to call')));
});

test('the words are plain: no exclamation mark, no emoji, no arrows, no codes', () => {
  for (const [key, value] of Object.entries(ERROR_COPY)) {
    assert.ok(!value.includes('!'), `${key} has no exclamation mark`);
    assert.ok(!/[\u{1F300}-\u{1FAFF}←-⇿→]/u.test(value), `${key} has no emoji or arrow`);
  }
  assert.equal(ERROR_COPY.heading, 'Something broke on our side.');
  assert.equal(ERROR_COPY.line, 'Your account and your answers are safe. Try again, and if it keeps happening, tell us at support@mockmob.in.');
  assert.equal(ERROR_COPY.paperLine, 'Your answers so far are saved on this phone.');
  assert.deepEqual([ERROR_COPY.retry, ERROR_COPY.paperRetry, ERROR_COPY.toToday, ERROR_COPY.toHome, ERROR_COPY.toPractice], ['Try again', 'Reopen your paper', 'Go to Today', 'Go to the home page', 'Go to Practice']);
});
