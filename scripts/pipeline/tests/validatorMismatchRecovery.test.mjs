import test from 'node:test';
import assert from 'node:assert/strict';
import { alignValidationResultsByCandidateId } from '../lib/llm.mjs';

test('validator result mismatch keeps returned candidate results', () => {
  const questions = [
    { candidate_id: 'c1', q: 'Q1', o: ['A', 'B', 'C', 'D'], a: 'A' },
    { candidate_id: 'c2', q: 'Q2', o: ['A', 'B', 'C', 'D'], a: 'A' },
    { candidate_id: 'c3', q: 'Q3', o: ['A', 'B', 'C', 'D'], a: 'A' },
  ];
  const rows = [
    { candidate_id: 'c1', index: 0, verdict: 'accept', score: 0.9, exam_quality: 0.8, distractor_quality: 0.8, conceptual_depth: 0.7, trap_quality: 'high', cuet_alignment: true, issues: [] },
    { candidate_id: 'c3', index: 2, verdict: 'reject', score: 0.2, exam_quality: 0.2, distractor_quality: 0.2, conceptual_depth: 0.2, trap_quality: 'low', cuet_alignment: false, issues: ['weak'] },
  ];
  const aligned = alignValidationResultsByCandidateId(questions, rows, 'mini', 'gpt-4o-mini');
  assert.equal(aligned[0].verdict, 'accept');
  assert.equal(aligned[1], null);
  assert.equal(aligned[2].verdict, 'reject');
});

test('validator results can still align by index when candidate_id is absent', () => {
  const aligned = alignValidationResultsByCandidateId(
    [{ candidate_id: 'c1' }, { candidate_id: 'c2' }],
    [{ index: 1, verdict: 'accept', score: 0.8, exam_quality: 0.8, distractor_quality: 0.8, conceptual_depth: 0.7, trap_quality: 'medium', cuet_alignment: true, issues: [] }],
    'mini',
    'gpt-4o-mini',
  );
  assert.equal(aligned[0], null);
  assert.equal(aligned[1].verdict, 'accept');
});
