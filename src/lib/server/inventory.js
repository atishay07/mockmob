import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { refreshInventory } from '@/../data/inventory_fingerprint';
import { assertFullBankRead } from '@/../data/full_bank_guard';
import { SERVE_MEMO_MS, servedInventory } from './inventorySnapshot';

// Cache only public aggregates, never keys or personal evidence.
// A full count reads every visible question with the 22 columns the count uses (data/inventory_count.js; about
// 32.7 MB on 16 Oct 2026, 23.6 MB of it the signed evidence records, against 43.9 MB for select('*')) and
// checks each one's publication evidence. It runs once a day, from the cron (/api/internal/refresh-inventory),
// and only on Vercel production (data/full_bank_guard.js). Requests serve the stored row; they never count.
let cached = null;

/**
 * Recompute the aggregates and store them. Called only by the daily cron. Outside Vercel production it
 * throws FullBankReadBlocked before reading anything. The stored row is now the only source requests
 * use, so a failed write is an error (the cron reports it) rather than silently ignored.
 */
export async function refreshInventorySnapshot() {
  assertFullBankRead('the inventory refresh');
  // The full count (about 33 MB of rows) runs only when something it depends on changed: data/inventory_fingerprint.js has the
  // exact list and the rule. An unchanged bank re-stamps the stored row after a few head counts; any doubt is the full count.
  const { value } = await refreshInventory(supabaseAdmin());
  cached = { value, until: Date.now() + SERVE_MEMO_MS };
  return value;
}

/** The stored counts, or an "unavailable" fallback when there are none. Never reads the whole bank. */
export async function publicInventory() {
  if (cached?.until > Date.now()) return cached.value;
  const { value, memo } = await servedInventory({
    readStored: async () => (await supabaseAdmin().from('public_inventory_snapshot').select('value,computed_at').eq('id', 'current').maybeSingle()).data,
  });
  if (memo) cached = { value, until: Date.now() + SERVE_MEMO_MS };
  return value;
}
