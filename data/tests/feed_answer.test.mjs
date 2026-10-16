import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { signFeedTicket, verifyFeedTicket, FEED_TICKET_TTL_MS } from '../../src/lib/server/feedTicket.js';
import { gradeFeedAnswer, feedPublicOptions } from '../explore_feed.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const env = { FEED_TICKET_SECRET: 'test-secret-one' };
const now = 1_800_000_000_000;

test('the feed route no longer sends the key or the explanation, and attaches a ticket', () => {
  const src = read('src/app/api/questions/feed/route.js');
  assert.doesNotMatch(src, /correct_answer\s*:/);
  assert.doesNotMatch(src, /explanation\s*:/);
  assert.match(src, /ticket:\s*signFeedTicket\(r\.id\)/);
  assert.match(src, /feedPublicOptions\(r\.options\)/);
});

test('the answer route rate-limits, demands a ticket from signed-out callers and checks servable rows', () => {
  const src = read('src/app/api/questions/[id]/answer/route.js');
  assert.match(src, /checkPersistentRateLimit/);
  assert.match(src, /status\)?,?\s*429|'Too many requests', 429/);
  assert.match(src, /!userId && !verifyFeedTicket\(/);
  assert.match(src, /readablePracticeQuestions/);
  assert.match(src, /\bauth\(request\)/);
  assert.match(src, /no-store/);
});

test('a ticket verifies for its own question only, until it expires', () => {
  const t = signFeedTicket('q1', { now, env });
  assert.ok(t);
  assert.equal(verifyFeedTicket(t, 'q1', { now: now + 1000, env }), true);
  assert.equal(verifyFeedTicket(t, 'q2', { now: now + 1000, env }), false);
  assert.equal(verifyFeedTicket(t, 'q1', { now: now + FEED_TICKET_TTL_MS + 1, env }), false);
});

test('a forged, altered or foreign ticket is refused', () => {
  const t = signFeedTicket('q1', { now, env });
  const [stamp, mac] = t.split('.');
  assert.equal(verifyFeedTicket(`${Number(stamp) + 1000}.${mac}`, 'q1', { now, env }), false);
  assert.equal(verifyFeedTicket(`${stamp}.${mac.slice(0, -1)}x`, 'q1', { now, env }), false);
  assert.equal(verifyFeedTicket(t, 'q1', { now, env: { FEED_TICKET_SECRET: 'another' } }), false);
  // A ticket signed to live far longer than the feed ever issues is not honoured.
  assert.equal(verifyFeedTicket(signFeedTicket('q1', { now, ttlMs: 10 * FEED_TICKET_TTL_MS, env }), 'q1', { now, env }), false);
  for (const bad of [undefined, null, '', 'x', '1.2.3', `${stamp}`, 12345, 'a'.repeat(200)]) assert.equal(verifyFeedTicket(bad, 'q1', { now, env }), false);
});

test('with no secret configured nothing is signed and nothing verifies', () => {
  assert.equal(signFeedTicket('q1', { now, env: {} }), null);
  assert.equal(verifyFeedTicket('1800000000000.abc', 'q1', { now, env: {} }), false);
});

const question = { options: [{ key: 'A', text: 'x' }, { key: 'B', text: 'y' }], correct_answer: 'B', explanation: '  Because y.  ' };

test('grading returns the verdict, the key and the explanation', () => {
  assert.deepEqual(gradeFeedAnswer(question, 'B'), { state: 'correct', correctKey: 'B', explanation: '  Because y.  ' });
  assert.equal(gradeFeedAnswer(question, 'A').state, 'incorrect');
  assert.equal(gradeFeedAnswer(question, 'A').correctKey, 'B');
  assert.equal(gradeFeedAnswer(question, null).state, 'revealed');
});

test('grading refuses a pick that is not an option and a question with no usable key', () => {
  assert.equal(gradeFeedAnswer(question, 'Z').state, 'invalid');
  assert.equal(gradeFeedAnswer(question, 'Z').correctKey, null);
  assert.equal(gradeFeedAnswer({ ...question, correct_answer: 'Q' }, 'A').state, 'unavailable');
  assert.equal(gradeFeedAnswer({ ...question, explanation: { text: 'Why' } }, 'B').explanation, 'Why');
  assert.equal(gradeFeedAnswer({ ...question, explanation: '   ' }, 'B').explanation, null);
});

test('public options carry only a key and text, never a stored flag', () => {
  assert.deepEqual(feedPublicOptions([{ key: 'A', text: 'x', is_correct: true, correct: true }, 'y']), [{ key: 'A', text: 'x' }, { key: 'B', text: 'y' }]);
});

test('the card grades through the server when the row carries no key', () => {
  const src = read('src/components/feed/QuestionCard.jsx');
  assert.match(src, /answerQuestion\(q\.id, \{ choice: key, ticket: q\.ticket \}\)/);
  assert.match(src, /holdsKey = q\.correct_answer != null/);
});
