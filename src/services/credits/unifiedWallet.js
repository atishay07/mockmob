import 'server-only';
import { readAIWallet } from './aiCreditWallet';
import { unifiedFromWallet } from './aiWalletState';

/**
 * The one credits balance (owner, 18 Oct 2026, D78), read-only:
 *   total      = freeLeft + held
 *   freeLeft   = this month's free credits left (ai_credit_wallets, projected through the IST-month sync)
 *   held       = bought/held credits: ai_credit_wallets.bonus_credits + users.credit_balance
 *   parts      = { included, bonus, balance }, the order every spend takes them in (public.mm_wallet_take)
 *   resetAt    = when the free credits come back
 * known: false (and every number null) when either part could not be read, or on a database without the one credits
 * balance migration (wallet.oneBalance === false). Never writes.
 */
export async function getUnifiedWallet(user) {
  const wallet = await readAIWallet(user);
  // Old database (migration not applied): no one total exists yet, so it is unknown and every caller uses its legacy figure
  // (users.credit_balance for practice, the AI wallet for AI).
  return { ...unifiedFromWallet(wallet, oneBalanceKnown(wallet) ? wallet.balanceCredits : null), wallet };
}

const oneBalanceKnown = (wallet) => Boolean(wallet?.known) && wallet.oneBalance !== false;
