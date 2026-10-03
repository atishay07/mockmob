import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateOfflineQuestionFiles, validateRawQuestionSchema } from '../lib/offlineBatchFactory.mjs';

test('generated offline batch files are valid JSON with 10 questions each', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mockmob-offline-schema-'));
  const result = generateOfflineQuestionFiles({
    subject: 'Economics',
    chapter: 'Money & Banking',
    quality: 'balanced',
    count: 20,
    batchSize: 10,
    out: dir,
  });

  assert.equal(result.files.length, 2);
  for (const file of result.files) {
    const payload = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal(payload.questions.length, 10);
    assert.equal(payload.metadata.question_count, 10);
    for (const question of payload.questions) {
      assert.deepEqual(validateRawQuestionSchema(question, payload.metadata), []);
    }
  }
});
