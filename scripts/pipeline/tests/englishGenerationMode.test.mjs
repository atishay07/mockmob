import test from 'node:test';
import assert from 'node:assert/strict';
import { getEnglishGenerationMode } from '../lib/englishGenerationMode.mjs';

test('Para Jumbles maps to para_jumble without passage', () => {
  assert.deepEqual(getEnglishGenerationMode('Para Jumbles'), {
    mode: 'para_jumble',
    requires_passage: false,
    passage_type: null,
    allowed_in_quick_practice: true,
    allowed_in_full_mock: true,
    allowed_in_nta_mode: true,
  });
});

test('passage chapters map to passage_rc', () => {
  assert.equal(getEnglishGenerationMode('Narrative Passage').mode, 'passage_rc');
  assert.equal(getEnglishGenerationMode('Narrative Passage').requires_passage, true);
  assert.equal(getEnglishGenerationMode('Reading Comprehension').mode, 'passage_rc');
  assert.equal(getEnglishGenerationMode('Prose').mode, 'passage_rc');
});

test('Vocabulary and Grammar map to standalone modes', () => {
  assert.equal(getEnglishGenerationMode('Vocabulary').mode, 'vocabulary');
  assert.equal(getEnglishGenerationMode('Grammar').mode, 'grammar');
});
