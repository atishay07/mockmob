import OpenAI from 'openai';
import { spawnSync } from 'node:child_process';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

if (!process.execArgv.includes('--use-system-ca') && process.env.MOCKMOB_DEEPSEEK_HEALTH_REEXEC !== '1') {
  const result = spawnSync(
    process.execPath,
    ['--use-system-ca', ...process.execArgv, fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    {
      env: { ...process.env, MOCKMOB_DEEPSEEK_HEALTH_REEXEC: '1' },
      stdio: 'inherit',
    },
  );
  process.exit(result.status ?? 1);
}

try {
  loadEnvFile('.env.local');
} catch {
  // Environment may already be injected in production shells.
}

const apiKey = process.env.DEEPSEEK_API_KEY;
const models = [
  process.env.DEEPSEEK_PRO_MODEL || process.env.GENERATOR_PRIMARY_MODEL || 'deepseek-v4-pro',
  process.env.DEEPSEEK_FLASH_MODEL || process.env.GENERATOR_FALLBACK_MODEL || 'deepseek-v4-flash',
  process.env.DEEPSEEK_CHAT_MODEL || process.env.GENERATOR_SECOND_FALLBACK_MODEL || 'deepseek-chat',
].filter((model, index, array) => model && array.indexOf(model) === index);
const timeoutMs = Number(process.env.DEEPSEEK_HEALTHCHECK_TIMEOUT_MS || 45000);
const client = apiKey
  ? new OpenAI({ apiKey, baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com' })
  : null;

function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function extractText(response) {
  return String(
    response?.choices?.[0]?.message?.content ||
    response?.choices?.[0]?.message?.reasoning_content ||
    response?.choices?.[0]?.delta?.content ||
    response?.output_text ||
    response?.text ||
    response?.data?.output_text ||
    response?.data?.choices?.[0]?.message?.content ||
    ''
  ).trim();
}

async function checkModel(model) {
  if (!client) {
    return { model, success: false, content_length: 0, parsed_json_ok: false, error: 'missing_deepseek_api_key' };
  }
  try {
    const response = await withTimeout(client.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 64,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Return strict JSON only.' },
        { role: 'user', content: 'Return exactly: {"ok":true}' },
      ],
    }), timeoutMs, `${model} timeout after ${timeoutMs}ms`);
    const text = extractText(response);
    let parsedJsonOk = false;
    try {
      parsedJsonOk = JSON.parse(text)?.ok === true;
    } catch {
      parsedJsonOk = false;
    }
    return {
      model,
      success: parsedJsonOk,
      content_length: text.length,
      parsed_json_ok: parsedJsonOk,
      error: parsedJsonOk ? null : 'invalid_or_empty_json',
    };
  } catch (error) {
    return {
      model,
      success: false,
      content_length: 0,
      parsed_json_ok: false,
      error: error.message,
    };
  }
}

const results = [];
for (const model of models) {
  results.push(await checkModel(model));
}

const pro = results[0] || {};
const flash = results[1] || {};
const chat = results[2] || {};
const selected = results.find((result) => result.success)?.model || 'defer_job';

console.log(JSON.stringify({
  pro_model: pro.model || null,
  pro_ok: pro.success === true,
  pro_empty_count: pro.success ? 0 : (pro.content_length === 0 ? 1 : 0),
  flash_model: flash.model || null,
  flash_ok: flash.success === true,
  chat_model: chat.model || null,
  chat_ok: chat.success === true,
  selected_generator_for_next_job: selected,
  results,
}, null, 2));
