// The preview models the one-credits-balance database (release 10, D78): every screen reads one total, built from the same three
// parts the wallet fixture shows (previewWallet.js): this month's free credits left (38 of 50), bought credits (30) and the held
// users.credit_balance part (40, or ?balance=). The shell chip (GET /api/ai/credits wallet.total), the Upgrade sheet
// (user.credits.total) and the Wallet page (GET /api/wallet credits.total) therefore show the same number: 108 by default. The
// session's creditBalance is that one total too, as GET /api/auth/me serves it on the one-balance database (unifiedWallet.js). For a
// student with nothing left, use ?wallet=zero&balance=0.
export const PREVIEW_FREE_LEFT = 38;
export const PREVIEW_BOUGHT = 30;

/** users.credit_balance in the fixture: 40, ?balance=N, or 0 on the wallet's zero and unknown fixtures. */
export function previewBalancePart(params, fallback = 40) {
  if (params.get('view') === 'wallet' && (params.get('wallet') === 'zero' || params.get('wallet') === 'unknown')) return 0;
  const b = params.get('balance');
  return b !== null && b !== '' && Number.isFinite(Number(b)) ? Number(b) : fallback;
}

/** The one total the fixture's account holds (null when the wallet cannot be read). ?wallet=zero spends the free and bought parts. */
export function previewOneTotal(params, fallback = 40) {
  if (params.get('wallet') === 'down' || params.get('wallet') === 'unknown') return null;
  const balance = previewBalancePart(params, fallback);
  return params.get('wallet') === 'zero' ? balance : PREVIEW_FREE_LEFT + PREVIEW_BOUGHT + balance;
}

/** The chip's figure on the wallet fixture: the page's total (108, or 0 for ?wallet=zero|unknown); elsewhere `fallback`. */
export function previewChipCredits(params, fallback) {
  if (params.get('view') !== 'wallet') return fallback;
  return previewOneTotal(params) ?? 0;
}
