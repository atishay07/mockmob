// Live check of the Mistake Repair contract on real published bank questions (owner-authorised 4 Oct 2026).
// For each question a wrong option is picked deterministically; the real prompt runs through the runtime
// guard (reserve -> call -> receipt). No student, attempt or credit is involved; nothing is quarantined.
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { buildRepairPrompt, interpretRepair, correctIndexOf } from '../../data/mistake_repair.js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const N = Number(process.argv[2] || 8);
const { data: rows, error } = await sb.from('questions').select('id,subject,chapter,body,question,options,correct_answer,correct_index,status,verification_state')
  .in('subject', ['accountancy', 'economics', 'business_studies', 'english']).eq('status', 'live').neq('verification_state', 'disputed').limit(200);
if (error) throw error;
const pick = rows.filter(r => Array.isArray(r.options) && r.options.length === 4 && correctIndexOf(r) >= 0 && !r.passage_group_id).sort((a, b) => a.id.localeCompare(b.id)).filter((_, i) => i % Math.max(1, Math.floor(200 / N)) === 0).slice(0, N);
const client = new OpenAI({ maxRetries: 0 }); const model = process.env.AI_LUNA_MODEL || 'gpt-6-luna'; const provider = 'openai';
const results = [];
for (const r of pick) {
  const question = { ...r, question: r.question || r.body, options: r.options.map(o => (typeof o === 'string' ? o : o.text)) };
  const keyIndex = correctIndexOf(r); const chosenIndex = (keyIndex + 1) % 4;
  const prompt = buildRepairPrompt({ question, chosenIndex, keyIndex, subject: r.subject });
  const key = `eval:repair:${randomUUID()}`;
  const { data: res, error: rErr } = await sb.rpc('reserve_runtime_ai', { p_key: key, p_provider: provider, p_model: model, p_input_bound: Buffer.byteLength(prompt.system + prompt.user) + 128, p_output_bound: 700 });
  if (rErr) { results.push({ id: r.id, error: rErr.message }); continue; }
  let data = null, cost = null, fail = null;
  try {
    const c = await client.chat.completions.create({ model, temperature: 0.4, max_tokens: 700, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }] });
    data = JSON.parse(c.choices[0].message.content); cost = (c.usage.prompt_tokens * res.inputRate + c.usage.completion_tokens * res.outputRate) / 1e6;
  } catch (e) { fail = e.message.slice(0, 120); }
  await sb.rpc('receipt_runtime_ai', { p_key: key, p_cost: cost, p_receipt: { eval: 'mistake_repair', fail } });
  const verdict = interpretRepair(data, { keyIndex, optionCount: 4 });
  results.push({ id: r.id, subject: r.subject, chapter: r.chapter, keyIndex, solved: data?.solved_index, verdict: verdict.kind, costUsd: cost, repair: verdict.repair, fail });
}
const summary = { n: results.length, explained: results.filter(r => r.verdict === 'explained').length, disputed: results.filter(r => r.verdict === 'disputed').length, unusable: results.filter(r => r.verdict === 'unusable').length, totalUsd: results.reduce((s, r) => s + (r.costUsd || 0), 0) };
writeFileSync('docs/brain/reports/mistake-repair-live-eval-2026-10-04.json', JSON.stringify({ ranAt: new Date().toISOString(), model, summary, results }, null, 2) + '\n');
console.log(JSON.stringify(summary)); for (const r of results) console.log(r.verdict, r.subject, '|', r.chapter, '| key', r.keyIndex, 'solved', r.solved, '|', r.repair?.why_wrong?.slice(0, 110) || r.fail || '');
