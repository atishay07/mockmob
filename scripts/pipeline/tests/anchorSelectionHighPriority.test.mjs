import test from 'node:test';
import assert from 'node:assert/strict';
import { selectPyqAnchors } from '../../../data/pyq_anchors.js';

test('Boolean Algebra selects exact chapter anchor', () => {
  const selection = selectPyqAnchors({ subject: 'computer_science', concept_id: 'computer_science::boolean_algebra', question_type: 'statement_based' });
  assert.equal(selection.valid, true);
  assert.equal(selection.anchor_match_level, 'exact_chapter');
  assert.equal(selection.primary.chapter, 'Boolean Algebra');
});

test('Aldehydes exact anchor is selected', () => {
  const selection = selectPyqAnchors({ subject: 'chemistry', concept_id: 'chemistry::aldehydes_ketones_and_carboxylic_acids', question_type: 'statement_based' });
  assert.equal(selection.valid, true);
  assert.equal(selection.anchor_match_level, 'exact_chapter');
  assert.equal(selection.primary.chapter, 'Aldehydes, Ketones & Carboxylic Acids');
});

test('Molecular Basis exact anchor is selected', () => {
  const selection = selectPyqAnchors({ subject: 'biology', concept_id: 'biology::molecular_basis_of_inheritance', question_type: 'statement_based' });
  assert.equal(selection.valid, true);
  assert.equal(selection.anchor_match_level, 'exact_chapter');
  assert.equal(selection.primary.chapter, 'Molecular Basis of Inheritance');
});

test('Money & Banking exact anchor is selected', () => {
  const selection = selectPyqAnchors({ subject: 'economics', concept_id: 'economics::money_and_banking', question_type: 'statement_based' });
  assert.equal(selection.valid, true);
  assert.equal(selection.anchor_match_level, 'exact_chapter');
  assert.equal(selection.primary.chapter, 'Money & Banking');
});
