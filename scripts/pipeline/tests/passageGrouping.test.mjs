import test from 'node:test';
import assert from 'node:assert/strict';
import { canPublishPassageGroup } from '../lib/passageNormalizer.mjs';
import {
  buildPassageRefillJobPayload,
  getPassageGroupPublishDecision,
  validatePassageQuality,
} from '../lib/passageQuality.mjs';

const passageText = Array(8).fill('The passage explains how a school library responded to digital skimming by building slower reading routines. Teachers noticed that deliberate pauses, peer discussion, handwritten notes, and evidence-based reflection helped learners recover attention. However, the author presents this change as a balanced response to technology rather than a rejection of digital tools, which creates enough contrast for inference, tone, purpose, and detail questions.').join(' ');

test('passage group normalizer publish helper defaults to at least two validated children', () => {
  const group = { passage_text: passageText };
  assert.equal(canPublishPassageGroup([{}], group), false);
  assert.equal(canPublishPassageGroup([{ passage_text: passageText }, { passage_text: passageText }], group), true);
});

test('child without parent passage metadata cannot publish as group', () => {
  assert.equal(canPublishPassageGroup([{}, {}, {}], {}), false);
});

test('order_index can be preserved by sorting children', () => {
  const sorted = [{ order_index: 3 }, { order_index: 1 }, { order_index: 2 }]
    .sort((a, b) => Number(a.order_index) - Number(b.order_index));
  assert.deepEqual(sorted.map((item) => item.order_index), [1, 2, 3]);
});

test('balanced passage group publishes as partial with two accepted children when passage passes', () => {
  const group = { subject: 'english', chapter: 'Factual Passage', passage_type: 'factual', passage_text: passageText };
  const passage = validatePassageQuality(group, 'balanced');
  const decision = getPassageGroupPublishDecision({
    group,
    acceptedChildren: [{}, {}],
    generatedChildren: [{}, {}, {}, {}, {}, {}],
    mode: 'balanced',
    passageQuality: passage,
  });
  assert.equal(decision.published, true);
  assert.equal(decision.group_status, 'partial');
  assert.equal(decision.needs_refill, true);
  assert.equal(decision.refill_target_children, 2);
});

test('speed passage group publishes with two accepted children', () => {
  const group = { subject: 'english', chapter: 'Factual Passage', passage_type: 'factual', passage_text: passageText };
  const decision = getPassageGroupPublishDecision({
    group,
    acceptedChildren: [{}, {}],
    generatedChildren: [{}, {}, {}, {}, {}, {}],
    mode: 'speed',
    passageQuality: validatePassageQuality(group, 'speed'),
  });
  assert.equal(decision.published, true);
  assert.equal(decision.min_required_children, 2);
});

test('premium passage group requires at least three accepted children', () => {
  const group = { subject: 'english', chapter: 'Factual Passage', passage_type: 'factual', passage_text: passageText };
  const passage = { passage_verdict: 'accept', passage_score: 9.1, passage_quality_band: 'A_PLUS', passage_issues: [] };
  assert.equal(getPassageGroupPublishDecision({ group, acceptedChildren: [{}, {}], mode: 'premium', passageQuality: passage }).published, false);
  assert.equal(getPassageGroupPublishDecision({ group, acceptedChildren: [{}, {}, {}], mode: 'premium', passageQuality: passage }).published, true);
});

test('passage below quality threshold rejects whole group', () => {
  const group = { subject: 'english', chapter: 'Factual Passage', passage_type: 'factual', passage_text: 'Too short.' };
  const decision = getPassageGroupPublishDecision({
    group,
    acceptedChildren: [{}, {}, {}, {}],
    mode: 'balanced',
    passageQuality: validatePassageQuality(group, 'balanced'),
  });
  assert.equal(decision.published, false);
  assert.match(decision.draft_reason, /passage_quality_failed/);
});

test('partial group creates refill payload', () => {
  const decision = { needs_refill: true, refill_target_children: 2 };
  const payload = buildPassageRefillJobPayload({
    group: { id: 'pg_1', subject: 'english', chapter: 'Factual Passage', passage_text: passageText },
    acceptedChildren: [{ q: 'Which option best captures the passage?' }, { q: 'What can be inferred?' }],
    decision,
    mode: 'balanced',
  });
  assert.equal(payload.type, 'passage_group_refill');
  assert.equal(payload.target_additional_questions, 2);
  assert.equal(payload.passage_group_id, 'pg_1');
});
