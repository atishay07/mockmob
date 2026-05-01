import test from 'node:test';
import assert from 'node:assert/strict';
import { callKimiChatCompletion, discoverKimiModels, extractGenerationText, getKimiConfig, healthCheckKimi, isKimiEnabled } from '../lib/llm.mjs';

test('Kimi config defaults safely and missing key disables provider', () => {
  const config = getKimiConfig();
  assert.equal(config.base_url, process.env.KIMI_BASE_URL || 'https://api.moonshot.ai/v1');
  assert.equal(config.model, process.env.KIMI_MODEL || 'kimi-k2.6');
  if (!process.env.KIMI_API_KEY) assert.equal(isKimiEnabled(), false);
});

test('Kimi chat completion parser handles choices message content and missing usage', async () => {
  const fakeClient = {
    chat: {
      completions: {
        create: async () => ({
          choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
        }),
      },
    },
  };
  const { response } = await callKimiChatCompletion({ messages: [] }, { client: fakeClient, timeoutMs: 1000 });
  assert.equal(extractGenerationText(response, 'kimi'), '{"ok":true}');
  const health = await healthCheckKimi({ client: fakeClient, timeoutMs: 1000 });
  assert.equal(health.ok, true);
});

test('Kimi model discovery handles /models failure without crashing', async () => {
  const result = await discoverKimiModels({
    apiKey: 'test-key',
    fetchImpl: async () => ({ ok: false, status: 500 }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'models_http_500');
});

test('Kimi model discovery lists configured models', async () => {
  const result = await discoverKimiModels({
    apiKey: 'test-key',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ data: [{ id: process.env.KIMI_MODEL || 'kimi-k2.6' }] }),
    }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.configured_model_available, true);
});
