// Live smoke test of student-facing AI against the configured database (owner-authorised 4 Oct 2026).
// One tiny request per configured model, each through reserve_runtime_ai -> provider -> receipt_runtime_ai.
// Writes runtime_ai_requests rows (that is the point: real receipts). No student data is sent.
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const system = 'You are a CUET Accountancy tutor. Reply with one JSON object: {"reply": string} under 40 words.';
const user = 'In one sentence: what is a sacrificing ratio?';
const targets = [[process.env.AI_FAST_PROVIDER, process.env.AI_FAST_MODEL], [process.env.AI_DEFAULT_PROVIDER, process.env.AI_SMART_MODEL], [process.env.AI_FALLBACK_PROVIDER, process.env.AI_FALLBACK_MODEL]];
const results = [];
for (const [provider, model] of targets) {
  const key = `smoke:${model}:${randomUUID()}`; const maxTokens = 200;
  const bound = Buffer.byteLength(system + user) + 128;
  const { data: res, error } = await sb.rpc('reserve_runtime_ai', { p_key: key, p_provider: provider, p_model: model, p_input_bound: bound, p_output_bound: maxTokens });
  if (error) { results.push({ model, reserved: false, error: error.message }); continue; }
  const started = Date.now(); let text = '', inTok, outTok, failure = null;
  try {
    if (provider === 'anthropic') {
      const c = new Anthropic({ maxRetries: 0 });
      const r = await c.messages.create({ model, max_tokens: maxTokens, ...(/^claude-sonnet-5/.test(model) ? { thinking: { type: 'between_tools' } } : { temperature: 0.4 }), system, messages: [{ role: 'user', content: user }] });
      text = r.content.filter(b => b.type === 'text').map(b => b.text).join(''); inTok = r.usage.input_tokens; outTok = r.usage.output_tokens;
    } else {
      const c = new OpenAI({ maxRetries: 0 });
      const r = await c.chat.completions.create({ model, max_tokens: maxTokens, temperature: 0.4, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] });
      text = r.choices[0].message.content; inTok = r.usage.prompt_tokens; outTok = r.usage.completion_tokens;
    }
  } catch (e) { failure = `${e.status || ''} ${e.message}`.slice(0, 200); }
  const cost = failure ? null : (inTok * res.inputRate + outTok * res.outputRate) / 1e6;
  const { error: rErr } = await sb.rpc('receipt_runtime_ai', { p_key: key, p_cost: cost, p_receipt: { smoke: true, inTok, outTok, failure } });
  let json = null; try { json = JSON.parse(text.replace(/^```(?:json)?\s*|```\s*$/g, '')); } catch {}
  results.push({ provider, model, reservedUsd: res.reserved, actualUsd: cost, inTok, outTok, ms: Date.now() - started, jsonOk: Boolean(json?.reply), reply: json?.reply?.slice(0, 160) || text.slice(0, 160), failure, receipted: !rErr });
}
const { data: budget } = await sb.from('runtime_ai_budget').select('*').eq('id', 'student_ai').single();
const out = { ranAt: new Date().toISOString(), results, budget };
mkdirSync('docs/brain/reports', { recursive: true }); writeFileSync('docs/brain/reports/ai-live-smoke-2026-10-04.json', JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
