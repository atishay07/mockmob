// Receipt-only recovery for one V717 campaign prefix. Never resends anything.
// - Accepted batches (submitted/unresolved with a provider id) are reconciled with GET-only polling.
// - Rows still 'queued' with no provider id never left this machine (flush claims a row as 'dispatching' before
//   any network send), so with the worker lock held they can be cancelled and their reservation settled at zero.
// Usage: node --use-system-ca scripts/pipeline/tools/recoverReceiptsV717.mjs <campaign-id> [--cancel-unsent]
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';
import { readFileSync } from 'node:fs';
import { BudgetLedger } from '../lib/budgetLedger.mjs';
import { FactoryStore } from '../lib/factoryStore.mjs';
import { createFactoryTransportV713 } from '../lib/factoryTransportV713.mjs';
import { assertTrustedNetworkV713R3 } from '../lib/trustedNetworkV713R3.mjs';
import { longFetch } from '../lib/longFetch.mjs';
import { scopedAccounting } from '../lib/scopedAccounting.mjs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(ROOT);
const [campaign] = process.argv.slice(2), cancelUnsent = process.argv.includes('--cancel-unsent');
if (!campaign || !/^cuet-v717-[a-z0-9-]+$/.test(campaign)) throw Error('v717_campaign_id_required');
try { loadEnvFile('.env.local'); } catch {}
await assertTrustedNetworkV713R3();
const prefix = campaign + ':', ledgerPath = 'data/pipeline-budget.sqlite';
const ledger = new BudgetLedger(ledgerPath);
const scoped = state => ledger.db.prepare('SELECT * FROM provider_batches WHERE state=?').all(state)
 .filter(row => { try { return JSON.parse(row.request_json).config.candidate_id.startsWith(prefix); } catch { return false; } });
const ids = [...new Set([...scoped('submitted'), ...scoped('unresolved'), ...scoped('queued')].map(row => JSON.parse(row.request_json).config.candidate_id.slice(prefix.length)))];
const store = new FactoryStore(ledger, ledgerPath, { candidateIds: ids.length ? ids : ['none'] });
const out = { campaign, reconciled: [], still_pending: [], cancelled_unsent: [], errors: [] };
try {
 ledger.assertHistoryReconciled(); store.claim();
 const prices = JSON.parse(readFileSync('data/pipeline-prices.json', 'utf8'));
 const native = createFactoryTransportV713({ ledger, prices: () => prices, fetchImpl: longFetch, queueGemini: true });
 for (const row of [...scoped('submitted'), ...scoped('unresolved')].filter(row => row.provider_id)) {
  try { await native.reconcile(row.id); } catch (error) { out.errors.push({ id: row.id, error: String(error.message) }); }
  const next = ledger.db.prepare('SELECT state FROM provider_batches WHERE id=?').get(row.id)?.state;
  (['submitted', 'unresolved'].includes(next) ? out.still_pending : out.reconciled).push({ id: row.id, state: next });
 }
 if (cancelUnsent) for (const row of scoped('queued').filter(row => !row.provider_id)) {
  ledger.transaction(() => {
   const changed = ledger.db.prepare("UPDATE provider_batches SET state='cancelled_unsent',response_json=? WHERE id=? AND state='queued' AND provider_id IS NULL")
    .run(JSON.stringify({ cancelled_unsent: true, at: new Date().toISOString(), basis: 'Queued locally and never dispatched; cancelled under the worker lock before any provider contact.' }), row.id);
   if (changed.changes !== 1) throw Error('queued_row_changed');
   const config = JSON.parse(row.request_json).config;
   // Same transaction as the row cancellation (ledger.settle would open a nested transaction).
   const settled = ledger.db.prepare("UPDATE requests SET actual=0,state='settled',receipt_json=? WHERE id=? AND state IN ('reserved','submitted')")
    .run(JSON.stringify({ provider: config.provider, model: config.model, stage: config.stage, candidate_id: config.candidate_id, idempotency_key: row.id,
     billing_basis: 'Queued locally and never dispatched (no provider id, never claimed for flush); cancelled before any provider contact. Zero cost is exact, not an estimate.' }), row.reservation_id);
   if (settled.changes !== 1) throw Error('queued_reservation_state_unexpected');
  });
  out.cancelled_unsent.push(row.id);
 }
 out.accounting = scopedAccounting(ledger, prefix);
} finally { try { store.release(); } finally { ledger.close(); } }
console.log(JSON.stringify({ ...out, accounting: { settled_usd: out.accounting.settled_micro / 1e6, held_usd: out.accounting.held_micro / 1e6, receipt_complete: out.accounting.receipt_complete } }, null, 2));
