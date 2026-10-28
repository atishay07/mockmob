// Read-only: measured settled cost and tokens per stage/provider for one accounting prefix (candidate_id prefix).
//   node scripts/pipeline/tools/stageCostReport.mjs <prefix>
import { DatabaseSync } from 'node:sqlite';
import { scopedAccounting } from '../lib/scopedAccounting.mjs';
const prefix = process.argv[2];
if (!prefix) throw new Error('prefix_required');
const db = new DatabaseSync('data/pipeline-budget.sqlite', { readOnly: true });
const scoped = scopedAccounting({ db }, prefix), byStage = {};
for (const r of scoped.requests) {
  const row = db.prepare('SELECT receipt_json FROM requests WHERE id=?').get(r.reservation_id), rc = row?.receipt_json ? JSON.parse(row.receipt_json) : {};
  const u = rc.usage || {}, k = `${r.provider}:${r.stage}`, a = byStage[k] ??= { requests: 0, settled: 0, unsettled: 0, held_usd: 0, usd: 0, input: 0, output: 0, reasoning: 0 };
  a.requests++;
  if (r.state === 'settled') { a.settled++; a.usd += r.settled_micro / 1e6; a.input += u.input_tokens || u.promptTokenCount || 0;
    a.output += (u.output_tokens ?? ((u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0))); a.reasoning += u.output_tokens_details?.reasoning_tokens || u.thoughtsTokenCount || 0; }
  else { a.unsettled++; a.held_usd += r.held_micro / 1e6; }
}
for (const a of Object.values(byStage)) Object.assign(a, { avg_usd: a.settled ? +(a.usd / a.settled).toFixed(6) : null, avg_input: a.settled ? Math.round(a.input / a.settled) : null,
  avg_output: a.settled ? Math.round(a.output / a.settled) : null, avg_reasoning: a.settled ? Math.round(a.reasoning / a.settled) : null, usd: +a.usd.toFixed(6), held_usd: +a.held_usd.toFixed(6) });
console.log(JSON.stringify({ prefix, settled_usd: scoped.settled_micro / 1e6, held_usd: scoped.held_micro / 1e6, requests: scoped.requests.length, by_stage: byStage }, null, 1));
