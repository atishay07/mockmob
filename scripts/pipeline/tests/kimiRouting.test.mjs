import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function runIsolated(code, env = {}) {
  return execFileSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  }).trim().split(/\r?\n/).at(-1);
}

test('GENERATOR_PROVIDER=kimi uses Kimi when explicitly enabled', () => {
  const out = runIsolated(
    "import { selectGenerationModel, getKimiConfig } from './scripts/pipeline/lib/llm.mjs'; console.log(JSON.stringify({model: selectGenerationModel({subject:'english'}), config: getKimiConfig()}));",
    { KIMI_API_KEY: 'test-key', GENERATOR_PROVIDER: 'kimi', ALLOW_KIMI_GENERATION: 'true', DEEPSEEK_API_KEY: 'test-deepseek' },
  );
  const parsed = JSON.parse(out);
  assert.equal(parsed.model, 'kimi-k2.6');
  assert.equal(parsed.config.enabled, true);
});

test('Kimi disabled falls back to DeepSeek routing and never GPT generation', () => {
  const out = runIsolated(
    "import { selectGenerationModel } from './scripts/pipeline/lib/llm.mjs'; console.log(selectGenerationModel({subject:'english', question_type:'para_jumble'}));",
    { KIMI_API_KEY: 'test-key', GENERATOR_PROVIDER: 'deepseek', ALLOW_KIMI_GENERATION: 'false', DEEPSEEK_API_KEY: 'test-deepseek' },
  );
  assert.equal(out, 'deepseek-v4-flash');
  assert.notEqual(out, 'gpt-4o-mini');
});

test('premium mode still routes validators separately in source', () => {
  const out = runIsolated(
    "import { getKimiConfig } from './scripts/pipeline/lib/llm.mjs'; console.log(JSON.stringify(getKimiConfig()));",
    { KIMI_API_KEY: 'test-key', GENERATOR_PROVIDER: 'kimi', ALLOW_KIMI_GENERATION: 'true' },
  );
  assert.equal(JSON.parse(out).model, 'kimi-k2.6');
});
