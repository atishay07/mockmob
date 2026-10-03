import test from 'node:test';
import assert from 'node:assert/strict';
import { alignOfflineQuestion } from '../lib/offlineBatchFactory.mjs';

test('Money & Banking questions align exactly to platform taxonomy', () => {
  const alignment = alignOfflineQuestion({
    subject: 'Economics',
    chapter: 'Money & Banking',
    question_text: 'A commercial bank changes credit creation after the RBI raises CRR. Which Money & Banking effect follows?',
    concept: 'CRR',
    options: {
      A: 'Credit falls because reserves rise.',
      B: 'Budget deficit rises because tax falls.',
      C: 'Consumer utility rises because price changes.',
      D: 'Production cost falls because wage changes.',
    },
    answer_explanation: 'CRR belongs to Money & Banking.',
    answer_check: 'RBI reserve policy affects bank credit.',
  }, { expectedSubject: 'Economics', expectedChapter: 'Money & Banking' });

  assert.equal(alignment.chapter_alignment, 'exact');
  assert.equal(alignment.resolved_subject, 'economics');
  assert.equal(alignment.resolved_chapter, 'Money & Banking');
});

test('wrong chapter Economics questions are not kept in Money & Banking', () => {
  const alignment = alignOfflineQuestion({
    subject: 'Economics',
    chapter: 'Money & Banking',
    question_text: 'A fiscal deficit rises because government expenditure exceeds government revenue. Which budget effect follows?',
    concept: 'Fiscal deficit',
    options: {
      A: 'Government Budget & the Economy',
      B: 'Money supply M1',
      C: 'Repo rate transmission',
      D: 'Demand deposits',
    },
    answer_explanation: 'This is about fiscal deficit.',
    answer_check: 'Fiscal deficit is a budget concept.',
  }, { expectedSubject: 'Economics', expectedChapter: 'Money & Banking' });

  assert.equal(alignment.chapter_alignment, 'invalid');
  assert.equal(alignment.resolved_chapter, 'Government Budget & the Economy');
});
