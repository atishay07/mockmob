// Pure PrepOS wallet state. No I/O, so it is unit-tested directly. The server wallet
// service reads rows and hands them here; nothing in this file inserts, resets or spends.
//
// States:
//   available           schema healthy, paid AI open, balance > 0
//   empty               schema healthy, paid AI open, genuine zero balance
//   paused              schema healthy, paid AI paused; stored balances shown, not spendable
//   schema_unavailable  wallet table/function missing; no balance is known
//   error               any other read failure; no balance is known
// A wallet that cannot be read never reports a number: total/included/bonus are null.

import { effectivePremiumFromRow } from '../../lib/payments/entitlements.js';

/**
 * The single effective-entitlement rule (status, paid-through date, legacy flag) applied to
 * an app-shaped user, recomputed at call time so a long-lived object cannot outlive expiry.
 */
export function isPaidUser(user, nowMs = Date.now()) {
  if (!user) return false;
  return effectivePremiumFromRow({
    subscription_status: user.subscriptionStatus,
    premium_until: user.premiumUntil ?? null,
    is_premium: user.isPremium === true,
  }, nowMs);
}

export const PREPOS_PAUSED_MESSAGE = 'PrepOS paid features are temporarily unavailable. Your credits have not been used.';
export const WALLET_UNAVAILABLE_MESSAGE = 'Your PrepOS credits could not be read just now. Nothing has been charged. Try again later.';

export function walletWindow(input = new Date()) {
  // IST (UTC+05:30) calendar month.
  const offset = (5 * 60 + 30) * 60 * 1000;
  const shifted = new Date(new Date(input).getTime() + offset);
  const start = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) - offset;
  const reset = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 1) - offset;
  return { periodStart: new Date(start).toISOString(), resetAt: new Date(reset).toISOString() };
}

export function isMissingRelation(error) {
  const text = `${error?.code || ''} ${error?.message || error || ''}`.toLowerCase();
  return text.includes('42p01') || text.includes('does not exist') || text.includes('schema cache');
}

export function isMissingFunction(error) {
  const text = `${error?.code || ''} ${error?.message || error || ''}`.toLowerCase();
  return text.includes('42883') || text.includes('pgrst202') || (text.includes('function') && text.includes('not')) || text.includes('schema cache');
}

/** A wallet whose balance is unknown. */
export function unreadableWallet(state, { paid = false, reason = null } = {}) {
  return {
    state, spendable: false, paid: Boolean(paid), known: false,
    message: WALLET_UNAVAILABLE_MESSAGE, reason,
    includedMonthlyCredits: null, includedUsed: null, includedRemaining: null, bonusCredits: null, total: null,
    resetAt: null, periodStart: null, materialized: false,
    // Legacy field kept for older readers; it now only means "the schema answered".
    schemaReady: false, degraded: true,
  };
}

/**
 * Project a stored wallet row (or its absence) into a read-only view.
 * The monthly reset and allowance sync are projected, not written: the atomic consume
 * RPC applies them inside its own transaction.
 */
export function projectWallet(row, { paid, includedMonthlyCredits, paidAiOpen, now = new Date() }) {
  const window = walletWindow(now);
  const allowance = Math.max(0, Number(includedMonthlyCredits) || 0);
  let includedUsed = 0;
  let bonusCredits = 0;
  let periodStart = window.periodStart;
  let resetAt = window.resetAt;
  if (row) {
    bonusCredits = Math.max(0, Number(row.bonus_credits) || 0);
    const stale = Date.parse(row.period_start) < Date.parse(window.periodStart);
    includedUsed = stale ? 0 : Math.min(allowance, Math.max(0, Number(row.included_credits_used) || 0));
    if (!stale) { periodStart = row.period_start || periodStart; resetAt = row.reset_at || resetAt; }
  }
  const includedRemaining = Math.max(0, allowance - includedUsed);
  const total = includedRemaining + bonusCredits;
  const state = !paidAiOpen ? 'paused' : total > 0 ? 'available' : 'empty';
  return {
    state, spendable: state === 'available', paid: Boolean(paid), known: true,
    message: state === 'paused' ? PREPOS_PAUSED_MESSAGE : state === 'empty' ? 'You have no PrepOS credits left this month.' : null,
    reason: null,
    includedMonthlyCredits: allowance, includedUsed, includedRemaining, bonusCredits, total,
    resetAt, periodStart, materialized: Boolean(row),
    schemaReady: true, degraded: false,
  };
}

/** Client-side guard: map any credits response to something safe to render. */
export function walletFromResponse(body, { ok = true } = {}) {
  const wallet = body?.wallet;
  if (!ok || !wallet || typeof wallet.state !== 'string') return unreadableWallet('error');
  if (!wallet.known) return { ...unreadableWallet(wallet.state), message: wallet.message || WALLET_UNAVAILABLE_MESSAGE };
  return wallet;
}
