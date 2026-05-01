import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGenerationPayload } from '../lib/passageNormalizer.mjs';

const passageText = Array(220).fill('urban planning requires careful public communication').join(' ');

test('passage_group questions flatten with passage metadata', () => {
  const payload = {
    passage_group: {
      passage_id: 'passage_1',
      title: 'City Signals',
      passage_type: 'factual',
      passage_text: passageText,
      questions: [
        { q: 'Which option best captures the passage?', o: ['A1', 'B1', 'C1', 'D1'], a: 'A', order_index: 1 },
        { q: 'Which inference is supported?', o: ['A2', 'B2', 'C2', 'D2'], a: 'B', order_index: 2 },
        { q: 'What is the tone?', o: ['A3', 'B3', 'C3', 'D3'], a: 'C', order_index: 3 },
        { q: 'Which detail supports the conclusion?', o: ['A4', 'B4', 'C4', 'D4'], a: 'D', order_index: 4 },
      ],
    },
  };
  const result = normalizeGenerationPayload(payload, { subject: 'english', chapter: 'Factual Passage', requires_passage: true });
  assert.equal(result.passageGroups.length, 1);
  assert.equal(result.questions.length, 4);
  assert.equal(result.questions[0].passage_text, passageText);
  assert.equal(result.questions[0].temporary_group_key, 'tmp_passage_1_1');
  assert.equal(result.passageGroups[0].linked_question_count, 4);
});

test('missing passage_text rejects passage group children', () => {
  const result = normalizeGenerationPayload({
    passage_group: {
      passage_id: 'passage_1',
      questions: [{ q: 'Question?', o: ['A', 'B', 'C', 'D'], a: 'A' }],
    },
  });
  assert.equal(result.questions.length, 0);
  assert.equal(result.stats.structural_rejected, 1);
});

test('standalone questions still normalize normally', () => {
  const result = normalizeGenerationPayload({ questions: [{ q: 'Standalone?', o: ['A', 'B', 'C', 'D'], a: 'A' }] });
  assert.equal(result.questions.length, 1);
  assert.equal(result.stats.raw_questions, 1);
});

test('requires_passage rejects raw questions output before selfCheck', () => {
  const result = normalizeGenerationPayload({
    questions: [{ q: 'Raw standalone?', o: ['A', 'B', 'C', 'D'], a: 'A' }],
  }, { subject: 'english', chapter: 'Factual Passage', requires_passage: true });
  assert.equal(result.questions.length, 0);
  assert.equal(result.stats.raw_questions, 1);
  assert.equal(result.stats.raw_questions_rejected_requires_passage, 1);
});

test('requires_passage requires at least 4 linked children', () => {
  const result = normalizeGenerationPayload({
    passage_group: {
      passage_id: 'passage_1',
      passage_text: passageText,
      questions: [
        { q: 'Question 1?', o: ['A', 'B', 'C', 'D'], a: 'A' },
        { q: 'Question 2?', o: ['A', 'B', 'C', 'D'], a: 'B' },
        { q: 'Question 3?', o: ['A', 'B', 'C', 'D'], a: 'C' },
      ],
    },
  }, { subject: 'english', chapter: 'Factual Passage', requires_passage: true });
  assert.equal(result.questions.length, 0);
  assert.equal(result.passageGroups.length, 0);
  assert.equal(result.stats.passage_groups_below_min_children, 1);
});
