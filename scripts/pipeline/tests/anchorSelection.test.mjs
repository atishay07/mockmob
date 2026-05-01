import test from 'node:test';
import assert from 'node:assert/strict';
import { selectPyqAnchors } from '../../../data/pyq_anchors.js';

test('Para Jumbles does not select Narrative Passage as a direct anchor', () => {
  const selection = selectPyqAnchors({
    subject: 'english',
    concept_id: 'english::para_jumbles',
    difficulty: 'medium',
    question_type: 'para_jumble',
  });
  assert.equal(selection.valid, true);
  assert.notEqual(selection.primary.chapter, 'Narrative Passage');
  assert.notEqual(selection.anchor_match_level, 'mismatched_concept');
});

test('Narrative Passage does not select Para Jumbles as a direct anchor', () => {
  const selection = selectPyqAnchors({
    subject: 'english',
    concept_id: 'english::narrative_passage',
    difficulty: 'medium',
    question_type: 'inference',
  });
  assert.equal(selection.valid, true);
  assert.notEqual(selection.primary.chapter, 'Para Jumbles');
});

test('Physics EMI anchor selection is exact or low-confidence structure, not Dual Nature direct', () => {
  const selection = selectPyqAnchors({
    subject: 'physics',
    concept_id: 'physics::electromagnetic_induction',
    difficulty: 'medium',
    question_type: 'assertion_reason',
  });
  assert.equal(selection.valid, true);
  if (selection.primary.chapter === 'Dual Nature of Radiation & Matter') {
    assert.equal(selection.anchor_confidence, 'low');
    assert.ok(selection.primary.structure_only);
  }
});
