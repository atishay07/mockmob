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
 *
 * Field contract for app and web readers (kept stable; data/tests/one_balance_ship_together.test.mjs locks it). Every
 * figure below is what the database will actually let the student spend, so a screen never quotes more than a spend takes.
 *                                         one-balance database                     old database (migration not applied)
 *   GET /api/auth/me   creditBalance      the one total                            users.credit_balance (as before)
 *                      credits            {total, freeLeft, freeAllowance,         null
 *                                          resetAt, held, parts}
 *   GET /api/ai/credits wallet.total      the one total (AI spends every part)     free left + bonus (as before)
 *                      credits            the one view, known: true                known: false, numbers null
 *                      normalCreditBalance / practiceCredits.balance: users.credit_balance on both (a part, never add it)
 *   GET /api/ai/context aiCredits.total   the one total (heldCredits = part)       free left + bonus (heldCredits 0)
 *                      normalCreditBalance users.credit_balance on both
 *   GET /api/me/credits practice.balance  users.credit_balance (a part)            users.credit_balance
 *                      ai.balance         free left + bonus (a part)               free left + bonus
 *                      total block        the one total                            unknown (null)
 *   GET /api/me/review practiceCredits / aiCredits: the one total on both          users.credit_balance / the AI wallet
 * The app built on 18 Oct switches to the one balance only when GET /api/wallet answers (release 10); older app builds
 * read creditBalance and wallet.total, which on the one-balance database are the same one total, the amount any spend can
 * take. Which database is live is probed once (aiWalletState.js oneBalanceLive), so code and database cannot disagree.
 */
export async function getUnifiedWallet(user) {
  const wallet = await readAIWallet(user);
  // Old database (migration not applied): no one total exists yet, so it is unknown and every caller uses its legacy figure
  // (users.credit_balance for practice, the AI wallet for AI).
  return { ...unifiedFromWallet(wallet, oneBalanceKnown(wallet) ? wallet.balanceCredits : null), wallet };
}

const oneBalanceKnown = (wallet) => Boolean(wallet?.known) && wallet.oneBalance !== false;
