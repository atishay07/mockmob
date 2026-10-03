import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeCandidatesWithReasons } from '../lib/offlineBatchFactory.mjs';

test('offline dedupe rejects repeated candidates in the same batch', () => {
  const candidates = [
    {
      candidate_id: 'c1',
      body: 'Read the following statements about repo rate and bank credit. Statement I: Repo rate affects borrowing cost. Statement II: Higher borrowing cost can reduce credit demand.',
      correct_answer: 'A',
      concept_pattern: 'Repo Rate',
    },
    {
      candidate_id: 'c2',
      body: 'Read the statements about repo rate and bank credit. Statement I: Repo rate affects borrowing cost. Statement II: Higher borrowing cost can reduce credit demand.',
      correct_answer: 'A',
      concept_pattern: 'Repo Rate',
    },
  ];

  const result = dedupeCandidatesWithReasons(candidates, []);
  assert.equal(result.unique.length, 1);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].reason, 'duplicate_against_db_or_batch');
});
