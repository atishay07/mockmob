// Review's page reads the body of GET /api/me/review and rebuilds the record for the shared next move (LEARN-REVIEW-1017
// packet P-LR1). The page's move must be the move of the record the server read, on every shared fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reviewBody, reviewMove, chapterRows, receipt } from '../review_input.mjs';
import { recordFromBody } from '../../src/components/review/reviewRecord.mjs';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/review/${name}.json`, import.meta.url), 'utf8'));
const NAMES = ['student', 'check_pending', 'zero_credits', 'all_held', 'one_paper', 'revise_dedupe', 'nothing_missed'];

for (const name of NAMES) {
  test(`Review page: the body rebuilt gives the same move, chapters and receipt (${name})`, () => {
    const record = fixture(name);
    const body = JSON.parse(JSON.stringify(reviewBody(record)));
    const rebuilt = recordFromBody(body);
    assert.deepEqual(reviewMove(rebuilt), reviewMove(record));
    assert.deepEqual(chapterRows(rebuilt), chapterRows(record));
    assert.deepEqual(receipt(rebuilt), receipt(record));
  });
}

test('Review page: the design student opens on Repair Q42 in Mock 3, and every row names its paper and 12-hour time', () => {
  const body = reviewBody(fixture('student'));
  const move = reviewMove(recordFromBody(body));
  assert.equal(move.label, 'Repair Q42');
  assert.equal(move.target.attemptId, 'm3');
  for (const item of body.items) assert.match(item.stamp, /^(Mock \d|Quick practice), \d{1,2} [A-Z][a-z]{2}, \d{1,2}:\d{2} (AM|PM)$/);
  // A repaired, held or slipped mistake is never repairable (it opens its saved repair, free: F17).
  for (const item of body.items) if (['repaired', 'held', 'slipped'].includes(item.state)) assert.equal(item.repairable, false);
});

test('Review page: a failed read and an empty account never rebuild into a ready record', () => {
  assert.equal(recordFromBody(reviewBody(fixture('record_down'))), null);
  assert.equal(recordFromBody(reviewBody(fixture('empty'))).state, 'empty');
});
