import test from 'node:test';
import assert from 'node:assert/strict';
import { extractGenerationText, getDeepSeekRawShapeForLog } from '../lib/llm.mjs';

test('extractGenerationText parses choices[0].message.content', () => {
  const text = extractGenerationText({
    choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
  }, 'deepseek');
  assert.equal(text, '{"ok":true}');
});

test('extractGenerationText parses alternate response shapes', () => {
  assert.equal(extractGenerationText({ output_text: '{"ok":true}' }, 'deepseek'), '{"ok":true}');
  assert.equal(extractGenerationText({ text: '{"ok":true}' }, 'deepseek'), '{"ok":true}');
  assert.equal(extractGenerationText({ data: { output_text: '{"ok":true}' } }, 'deepseek'), '{"ok":true}');
  assert.equal(extractGenerationText({ data: { choices: [{ message: { content: '{"ok":true}' } }] } }, 'deepseek'), '{"ok":true}');
});

test('reasoning_content is accepted only when it contains final JSON', () => {
  assert.equal(
    extractGenerationText({ choices: [{ message: { reasoning_content: '{"ok":true}' } }] }, 'deepseek'),
    '{"ok":true}',
  );
  assert.throws(
    () => extractGenerationText({ choices: [{ message: { reasoning_content: 'I should return JSON next.' } }] }, 'deepseek'),
    /reasoning_content/,
  );
});

test('raw shape log omits content while reporting shape', () => {
  const shape = getDeepSeekRawShapeForLog({
    choices: [{ message: { content: '{"secret":"not printed"}' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1 },
  }, 'deepseek-chat');
  assert.equal(shape.model, 'deepseek-chat');
  assert.equal(shape.has_choices, true);
  assert.equal(shape.has_content, true);
  assert.ok(shape.content_length > 0);
  assert.deepEqual(shape.response_keys, ['choices', 'usage']);
  assert.equal(Object.values(shape).includes('{"secret":"not printed"}'), false);
});
