import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { readAIWallet } from './aiCreditWallet';

/**
 * ONE credits balance (owner D78). Read-only sum of what a student can spend:
 *   included = this month's free credits left (the AI wallet's included-left),
 *   bonus    = credits bought (the AI wallet's bonus credits),
 *   balance  = users.credit_balance (the starting credits and credits earned).
 * Returns { total, freeLeft, freeAllowance, resetAt, held, parts: { included, bonus, balance } }.
 * held = bonus + balance. A part that cannot be read makes the total null: unknown is never 0. Nothing here writes.
 */
export async function getUnifiedWallet(user) {
  const wallet = await readAIWallet(user);
  let balance = Number.isFinite(Number(user?.creditBalance)) ? Math.trunc(Number(user.creditBalance)) : null;
  if (balance === null && user?.id) {
    try {
      const { data } = await supabaseAdmin().from('users').select('credit_balance').eq('id', user.id).maybeSingle();
      if (Number.isFinite(Number(data?.credit_balance))) balance = Math.trunc(Number(data.credit_balance));
    } catch { /* stays unknown */ }
  }
  const included = wallet?.known ? Number(wallet.includedRemaining) : null;
  const bonus = wallet?.known ? Number(wallet.bonusCredits) : null;
  const known = included !== null && bonus !== null && balance !== null;
  return {
    total: known ? included + bonus + balance : null,
    freeLeft: included,
    freeAllowance: wallet?.known ? Number(wallet.includedMonthlyCredits) : null,
    resetAt: wallet?.known ? wallet.resetAt : null,
    held: bonus !== null && balance !== null ? bonus + balance : null,
    parts: { included, bonus, balance },
  };
}
