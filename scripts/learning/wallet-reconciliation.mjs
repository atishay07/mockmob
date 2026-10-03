// Read-only PrepOS wallet reconciliation. Compares each stored wallet with what its ledger
// implies: purchased (bonus) credits = grants − bonus spends; included credits used this
// period = included spends since period_start. It never writes, refunds or grants.
//
//   node scripts/learning/wallet-reconciliation.mjs --fixture path.json   (offline)
//   node scripts/learning/wallet-reconciliation.mjs --remote-read         (explicit, read-only)
//
// Output: reports/wallet-reconciliation.json. Mismatches are leads for a person to check
// against payment receipts; the report does not decide who is owed what.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function reconcileWallets(wallets = [], ledger = []) {
  const byUser = new Map();
  for (const row of ledger) {
    const list = byUser.get(row.user_id) || [];
    list.push(row);
    byUser.set(row.user_id, list);
  }
  const rows = [];
  for (const wallet of wallets) {
    const entries = byUser.get(wallet.user_id) || [];
    byUser.delete(wallet.user_id);
    let grants = 0, bonusSpent = 0, includedSpentThisPeriod = 0, unexplained = 0;
    for (const e of entries) {
      const meta = e.metadata && typeof e.metadata === 'object' ? e.metadata : {};
      if (num(e.amount) > 0 && meta.kind === 'release') {
        // A release reverses an earlier reservation; it is not a purchase.
        bonusSpent -= num(meta.bonusRestored);
        if (Date.parse(e.created_at) >= Date.parse(wallet.period_start)) includedSpentThisPeriod -= num(meta.includedRestored);
      } else if (num(e.amount) > 0) grants += num(e.amount);
      else if (num(e.amount) < 0) {
        const inc = num(meta.includedSpent), bon = num(meta.bonusSpent);
        if (inc + bon !== -num(e.amount)) unexplained += 1; // spend without a source split
        bonusSpent += bon;
        if (Date.parse(e.created_at) >= Date.parse(wallet.period_start)) includedSpentThisPeriod += inc;
      }
    }
    const expectedBonus = grants - bonusSpent;
    const bonusDelta = num(wallet.bonus_credits) - expectedBonus;
    const includedDelta = num(wallet.included_credits_used) - includedSpentThisPeriod;
    rows.push({
      userId: wallet.user_id,
      storedBonus: num(wallet.bonus_credits), expectedBonus, bonusDelta,
      storedIncludedUsed: num(wallet.included_credits_used), expectedIncludedUsed: includedSpentThisPeriod, includedDelta,
      ledgerRows: entries.length, unexplainedSpends: unexplained,
      status: bonusDelta === 0 && includedDelta === 0 && unexplained === 0 ? 'ok' : 'mismatch',
    });
  }
  for (const [userId, entries] of byUser) rows.push({ userId, ledgerRows: entries.length, status: 'ledger_without_wallet' });
  const summary = rows.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});
  return { generatedAt: new Date().toISOString(), wallets: wallets.length, ledgerRows: ledger.length, summary, rows };
}

async function readRemote() {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase URL/service key not set; nothing was read.');
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const page = async (table, columns) => {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from(table).select(columns).order('user_id').range(from, from + 999);
      if (error) throw new Error(`${table}: ${error.message}`);
      out.push(...(data || []));
      if (!data || data.length < 1000) return out;
    }
  };
  return {
    wallets: await page('ai_credit_wallets', 'user_id, included_credits_used, bonus_credits, period_start'),
    ledger: await page('ai_credit_ledger', 'user_id, amount, metadata, created_at, idempotency_key, wallet_source'),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2);
  const fixture = args[args.indexOf('--fixture') + 1];
  let input;
  if (args.includes('--fixture') && fixture) input = JSON.parse(readFileSync(fixture, 'utf8'));
  else if (args.includes('--remote-read')) input = await readRemote();
  else { console.error('Pass --fixture <file> or the explicit --remote-read flag.'); process.exit(2); }
  const report = reconcileWallets(input.wallets, input.ledger);
  mkdirSync('reports', { recursive: true });
  // User IDs stay in the local report only; it is not uploaded anywhere.
  writeFileSync('reports/wallet-reconciliation.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ wallets: report.wallets, ledgerRows: report.ledgerRows, summary: report.summary }));
}
