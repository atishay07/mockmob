// GET /api/wallet: the one read behind the Wallet page on the website and the Android app. Pure body builder (no I/O), so a test
// holds the shape. The route reads the student, the AI wallet and the history once each and hands them here.
//
// Field names are a contract with the app (documented in docs/brain/WALLET-RAZORPAY.md): add fields, never rename or remove.
//   { ok, practice:{ balance, unlimited, approxQuestions, perQuestion, fullMock, label, renewsOn },
//     ai:{ balance, includedRemaining, includedMonthly, boughtBalance, renewsOn, resetAt, state, label },
//     plan:{ name, until }, proOffer:{ rupees, expires, planId } | null,
//     packs:[ { packId, pool, label, credits, priceInr, pricePaise, perCreditInr, featured } ],
//     commerce:{ open, message },
//     history:[ { at, pool, what, delta, balanceAfter } ] | null, historyState:'ready'|'unavailable' }
// A balance that cannot be read is null, never 0.
import { PRACTICE_LABEL, AI_LABEL, istDate, planOf } from './credits.js';
import { packViews, walletCommerceOpen, WALLET_COMMERCE_CLOSED_MESSAGE } from '../wallet/walletPacks.mjs';
import { TEST_MODES, practiceCreditCost } from '../../../data/test_modes.js';
import { CURRENT_OFFER } from '../../../data/capabilities.js';

export const WALLET_HISTORY_SIZE = 20;

const int = (v) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null;

export function walletBody({ practiceBalance, wallet, paid, premiumUntil, history, env }) {
  const practice = int(practiceBalance);
  const perQuestion = TEST_MODES.quick.creditPerQuestion;
  const aiKnown = Boolean(wallet?.known) && int(wallet.total) !== null;
  const open = walletCommerceOpen(env);
  const plan = planOf({ paid, premiumUntil });
  return {
    ok: true,
    practice: {
      balance: practice,
      unlimited: Boolean(paid),
      approxQuestions: practice === null ? null : Math.floor(Math.max(0, practice) / perQuestion),
      perQuestion,
      fullMock: practiceCreditCost('full', TEST_MODES.full.fixedCount),
      label: PRACTICE_LABEL,
      renewsOn: null,
    },
    ai: {
      balance: aiKnown ? int(wallet.total) : null,
      includedRemaining: aiKnown ? int(wallet.includedRemaining) : null,
      includedMonthly: aiKnown ? int(wallet.includedMonthlyCredits) : null,
      boughtBalance: aiKnown ? int(wallet.bonusCredits) : null,
      renewsOn: aiKnown ? istDate(wallet.resetAt) : null,
      resetAt: aiKnown ? wallet.resetAt : null,
      state: wallet?.state || 'error',
      label: AI_LABEL,
    },
    plan,
    proOffer: paid ? null : { rupees: CURRENT_OFFER.rupees, expires: CURRENT_OFFER.expires, planId: CURRENT_OFFER.planId },
    packs: packViews(),
    commerce: { open, message: open ? null : WALLET_COMMERCE_CLOSED_MESSAGE },
    history: Array.isArray(history) ? history : null,
    historyState: Array.isArray(history) ? 'ready' : 'unavailable',
  };
}
