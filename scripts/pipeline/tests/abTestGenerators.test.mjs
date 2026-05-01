import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runGeneratorAbTest } from '../tools/abTestGenerators.mjs';

test('A/B harness runs in no-publish mode and compares models', async () => {
  const originalMock = process.env.MOCK_AI;
  process.env.MOCK_AI = 'true';
  const dir = mkdtempSync(join(tmpdir(), 'mockmob-ab-'));
  const report = await runGeneratorAbTest({
    route: 'english::Para Jumbles',
    models: 'deepseek-v4-flash,deepseek-chat',
    auditDir: dir,
  });
  if (originalMock === undefined) delete process.env.MOCK_AI;
  else process.env.MOCK_AI = originalMock;
  assert.equal(report.results.length, 2);
  assert.ok(report.results.every((result) => result.model));
  assert.ok(report.winner);
});

test('A/B harness does not enable OpenAI generation automatically', async () => {
  const originalMock = process.env.MOCK_AI;
  const originalFlag = process.env.ALLOW_OPENAI_GENERATION_FOR_AUDIT;
  process.env.MOCK_AI = 'true';
  delete process.env.ALLOW_OPENAI_GENERATION_FOR_AUDIT;
  const report = await runGeneratorAbTest({
    route: 'english::Para Jumbles',
    models: 'gpt-4o',
  });
  if (originalMock === undefined) delete process.env.MOCK_AI;
  else process.env.MOCK_AI = originalMock;
  if (originalFlag === undefined) delete process.env.ALLOW_OPENAI_GENERATION_FOR_AUDIT;
  else process.env.ALLOW_OPENAI_GENERATION_FOR_AUDIT = originalFlag;
  assert.equal(report.results[0].skipped, true);
});
