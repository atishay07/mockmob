import test from 'node:test';
import assert from 'node:assert/strict';
import { repairFailureForKind, composeFailureMessage, nextMonthStart, WALLET_UNAVAILABLE, REPAIR_FAILURE_CODES } from '../repair_failures.js';

const OCT = new Date('2026-10-14T06:00:00Z');

test('each failed-call kind maps to one code, one HTTP status and plain copy', () => {
  assert.deepEqual(repairFailureForKind('timeout', { now: OCT }), { error: 'provider_timeout', http: 504, message: 'This one took too long.' });
  for (const kind of ['quota', 'rate_limit', 'server', 'network', 'auth', 'bad_request', 'price', 'provider_unavailable']) {
    const failure = repairFailureForKind(kind, { now: OCT });
    assert.equal(failure.error, 'provider_unavailable', kind);
    assert.equal(failure.http, 503);
    assert.match(failure.message, /aren’t available right now/);
  }
  assert.deepEqual(repairFailureForKind('budget', { now: OCT }), { error: 'budget_reached', http: 503, message: 'Repairs are paused until 1 November.' });
  assert.equal(repairFailureForKind('guard_paused', { now: OCT }).error, 'paused');
  // Anything else (bad output, an unclassified failure, no failure at all) keeps the code the app already knows.
  for (const kind of [null, undefined, 'unknown', 'refusal', 'usage_missing']) {
    assert.deepEqual(repairFailureForKind(kind, { now: OCT }), { error: 'unusable_output', http: 502, message: 'The repair could not be prepared reliably this time.' }, String(kind));
  }
  for (const kind of ['timeout', 'quota', 'budget', 'guard_paused', 'unknown']) assert.ok(REPAIR_FAILURE_CODES.includes(repairFailureForKind(kind, { now: OCT }).error));
});

test('the credit sentence is only "not charged" once the release happened', () => {
  assert.equal(composeFailureMessage('This one took too long.', true), 'This one took too long. You were not charged.');
  assert.match(composeFailureMessage('This one took too long.', false), /Your credit is held briefly and returns automatically\.$/);
  assert.doesNotMatch(composeFailureMessage('This one took too long.', false), /not charged/);
  assert.match(WALLET_UNAVAILABLE.message, /Nothing was charged/);
});

test('the budget message names the first day of the next Indian month', () => {
  assert.equal(nextMonthStart(new Date('2026-10-14T06:00:00Z')), '1 November');
  assert.equal(nextMonthStart(new Date('2026-12-20T06:00:00Z')), '1 January', 'rolls over the year');
  // 19:00 UTC on 31 October is 00:30 IST on 1 November, so the budget already belongs to November.
  assert.equal(nextMonthStart(new Date('2026-10-31T19:00:00Z')), '1 December');
  assert.equal(nextMonthStart(new Date('2026-10-31T17:00:00Z')), '1 November');
});

test('every message states what happened to the credit', () => {
  const kinds = ['timeout', 'quota', 'budget', 'guard_paused', 'unknown'];
  for (const kind of kinds) {
    const failure = repairFailureForKind(kind, { now: OCT });
    assert.match(composeFailureMessage(failure.message, true), /You were not charged\.$/);
  }
});
