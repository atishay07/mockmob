// The one client read of Review's record (src/lib/reviewRead.js): shared in flight, kept while fresh, a failure is never an empty
// record, and the badge's number follows what the server confirmed (LEARN-REVIEW-1017 5.12, packet P-LR3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readReview, invalidateReview, resetReviewRead } from '../../src/lib/reviewRead.js';
import { getReviseDue, setReviseDue } from '../../src/lib/reviseDue.js';

const body = (total) => ({ state: 'ready', reviseDue: { total }, chapters: [] });
function counting(reply) {
  const calls = [];
  const get = async (path) => { calls.push(path); const out = typeof reply === 'function' ? reply(calls.length) : reply; if (out instanceof Error) throw out; return out; };
  return { calls, get };
}

test('many readers at once make one request, and a fresh answer is reused', async () => {
  resetReviewRead();
  const { calls, get } = counting(body(8));
  const [a, b, c] = await Promise.all([readReview({ get }), readReview({ get }), readReview({ get })]);
  assert.equal(calls.length, 1);
  assert.deepEqual([a.reviseDue.total, b.reviseDue.total, c.reviseDue.total], [8, 8, 8]);
  await readReview({ get });
  assert.equal(calls.length, 1, 'kept while fresh');
  assert.deepEqual(calls, ['/api/me/review']);
});

test('invalidating makes the next reader ask again, and force always asks', async () => {
  resetReviewRead();
  const { calls, get } = counting((n) => body(10 - n));
  await readReview({ get });
  invalidateReview();
  assert.equal((await readReview({ get })).reviseDue.total, 8);
  await readReview({ get, force: true });
  assert.equal(calls.length, 3);
});

test('a failed read is unavailable, never an empty record, and it is not asked again for a moment', async () => {
  resetReviewRead();
  const { calls, get } = counting(new Error('network'));
  const first = await readReview({ get });
  assert.deepEqual(first, { state: 'unavailable' });
  await readReview({ get });
  assert.equal(calls.length, 1, 'a broken read is not hammered');
  const down = counting({ version: 1, state: 'unavailable', message: 'Your mistakes did not load.' });
  resetReviewRead();
  assert.equal((await readReview({ get: down.get })).state, 'unavailable');
  await readReview({ get: down.get });
  assert.equal(down.calls.length, 1);
});

test('the first read fills the badge number; a later read of the kept record does not overwrite a count the server confirmed', async () => {
  resetReviewRead();
  assert.equal(getReviseDue(), undefined, 'nothing read yet: no badge, never zero');
  const { calls, get } = counting(body(8));
  await readReview({ get });
  assert.equal(getReviseDue(), 8);
  setReviseDue(6);
  await readReview({ get });
  assert.equal(getReviseDue(), 6, 'a kept answer is older than the confirmed count');
  assert.equal(calls.length, 1);
  await readReview({ get, force: true });
  assert.equal(getReviseDue(), 8, 'a read the student asked for is the newest word');
});

test('a failed read leaves the badge unknown, and an empty record does not invent a count', async () => {
  resetReviewRead();
  await readReview({ get: counting(new Error('network')).get });
  assert.equal(getReviseDue(), undefined);
  resetReviewRead();
  await readReview({ get: counting({ state: 'empty', papers: [] }).get });
  assert.equal(getReviseDue(), undefined);
});
