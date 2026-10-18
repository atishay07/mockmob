// GET /api/wallet: the one read behind the Wallet page on the website and the Android app. ONE credits balance (owner D78): this
// month's free credits left plus the credits a student holds. Pure body builder (no I/O), so a test holds the shape. The route reads
// the student, the unified wallet (src/services/credits/unifiedWallet.js) and the history once each and hands them here.
//
// Field names are a contract with the app (documented in docs/brain/WALLET-RAZORPAY.md): add fields, never rename or remove.
//   { ok, credits:{ total, freeLeft, freeAllowance, held, resetAt, renewsOn, parts:{ included, bonus, balance }, label, buys },
//     plan:{ name, until }, proOffer:{ rupees, expires, planId } | null,
//     packs:[ { packId, label, credits, priceInr, pricePaise, perCreditInr, fullMocks, featured } ],
//     commerce:{ open, message },
//     history:[ { at, pool, what, delta, balanceAfter } ] | null, historyState:'ready'|'unavailable' }
// A balance that cannot be read is null, never 0. history[].balanceAfter is the running total of this one balance, counted back from
// today's total; pool ("practice" or "ai") only says which ledger the line came from.
import { istDate, planOf } from './credits.js';
import { packViews, walletCommerceOpen, WALLET_COMMERCE_CLOSED_MESSAGE } from '../wallet/walletPacks.mjs';
import { TEST_MODES, practiceCreditCost } from '../../../data/test_modes.js';
import { CURRENT_OFFER } from '../../../data/capabilities.js';

export const WALLET_HISTORY_SIZE = 20;
export const CREDITS_LABEL = 'Credits';

const int = (v) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null;

/** What one credit buys, in one sentence. The numbers come from the practice price list, so the words and the price move together. */
export function creditsBuyLine() {
  const full = practiceCreditCost('full', TEST_MODES.full.fixedCount);
  return `1 credit = 1 question or 1 Ask Mobi reply. A full mock is ${full}.`;
}

const WHAT = Object.freeze({
  'AI credits added': 'Credits added',
  'Monthly AI credits': 'Free credits for the month',
  'Monthly AI credits ended': 'Free credits ended',
});

/** One list for one balance: the line wording in credit terms and a running balance counted back from today's total (null when unknown). */
export function unifyHistory(history, total) {
  if (!Array.isArray(history)) return null;
  let running = int(total);
  return history.map((line) => {
    const out = { at: line.at, pool: line.pool, what: WHAT[line.what] || line.what, delta: line.delta, balanceAfter: running };
    running = running === null ? null : running - (int(line.delta) ?? 0);
    return out;
  });
}

export function walletBody({ unified, paid, premiumUntil, history, env }) {
  const total = int(unified?.total);
  const open = walletCommerceOpen(env);
  const lines = unifyHistory(history, total);
  return {
    ok: true,
    credits: {
      total,
      freeLeft: int(unified?.freeLeft),
      freeAllowance: int(unified?.freeAllowance),
      held: int(unified?.held),
      resetAt: unified?.resetAt || null,
      renewsOn: unified?.resetAt ? istDate(unified.resetAt) : null,
      parts: { included: int(unified?.parts?.included), bonus: int(unified?.parts?.bonus), balance: int(unified?.parts?.balance) },
      label: CREDITS_LABEL,
      buys: creditsBuyLine(),
    },
    plan: planOf({ paid, premiumUntil }),
    proOffer: paid ? null : { rupees: CURRENT_OFFER.rupees, expires: CURRENT_OFFER.expires, planId: CURRENT_OFFER.planId },
    packs: packViews(),
    commerce: { open, message: open ? null : WALLET_COMMERCE_CLOSED_MESSAGE },
    history: lines,
    historyState: lines ? 'ready' : 'unavailable',
  };
}
