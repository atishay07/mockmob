import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runGeneratorAbTest } from '../tools/abTestGenerators.mjs';

test('Kimi A/B harness writes no-publish comparison report', async () => {
  const originalMock = process.env.MOCK_AI;
  const originalKimiKey = process.env.KIMI_API_KEY;
  process.env.MOCK_AI = 'true';
  process.env.KIMI_API_KEY = originalKimiKey || 'test-key';
  const dir = mkdtempSync(join(tmpdir(), 'mockmob-kimi-ab-'));
  const report = await runGeneratorAbTest({
    route: 'english::Para Jumbles',
    models: 'deepseek-v4-flash,kimi',
    quality: 'balanced',
    auditDir: dir,
  });
  if (originalMock === undefined) delete process.env.MOCK_AI;
  else process.env.MOCK_AI = originalMock;
  if (originalKimiKey === undefined) delete process.env.KIMI_API_KEY;
  else process.env.KIMI_API_KEY = originalKimiKey;

  assert.equal(report.no_publish, true);
  assert.equal(report.results.length, 2);
  assert.ok(report.results.some((result) => result.model === 'kimi'));
  assert.ok('weak_distractor_rate' in report.results[0]);
  assert.ok('validator_accepted' in report.results[0]);
  assert.ok(existsSync(join(dir, 'latest.json')));
  assert.ok(existsSync(join(dir, 'latest.md')));
});

test('A/B harness does not switch production provider automatically', async () => {
  const originalProvider = process.env.GENERATOR_PROVIDER;
  const originalMock = process.env.MOCK_AI;
  const originalKimiKey = process.env.KIMI_API_KEY;
  try {
    process.env.MOCK_AI = 'true';
    process.env.KIMI_API_KEY ||= 'test-key';
    await runGeneratorAbTest({
      route: 'english::Vocabulary',
      models: 'kimi',
    });
    assert.equal(process.env.GENERATOR_PROVIDER, originalProvider);
  } finally {
    if (originalProvider === undefined) delete process.env.GENERATOR_PROVIDER;
    else process.env.GENERATOR_PROVIDER = originalProvider;
    if (originalMock === undefined) delete process.env.MOCK_AI;
    else process.env.MOCK_AI = originalMock;
    if (originalKimiKey === undefined) delete process.env.KIMI_API_KEY;
    else process.env.KIMI_API_KEY = originalKimiKey;
  }
});
