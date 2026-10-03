import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { CAPABILITIES } from '@/../data/capabilities';
import {
  PREPOS_PAUSED_MESSAGE,
  isPaidUser,
  isMissingFunction,
  isMissingRelation,
  projectWallet,
  unreadableWallet,
  walletWindow,
} from './aiWalletState';

export { PREPOS_PAUSED_MESSAGE, isPaidUser };

export const AI_FREE_MONTHLY_CREDITS = 10;
export const AI_PRO_INCLUDED_MONTHLY_CREDITS = 50;
export const AI_INCLUDED_MONTHLY_CREDITS = AI_PRO_INCLUDED_MONTHLY_CREDITS;
export const AI_FREE_BUDGET_INR_CAP = 5;
export const AI_INTERNAL_USD_TO_INR = 85;

/** Paid PrepOS spending is open only when the capability registry says so. */
export function paidAiOpen() {
  return CAPABILITIES.optionalAi.state === 'available';
}

/** Paid AI purchases (top-up checkout, charged Rival battles) have their own, stricter gate. */
export function aiCommerceOpen() {
  return paidAiOpen() && CAPABILITIES.aiTopUps.state === 'available';
}

// Plan IDs are preserved for historical orders and verification of captured payments.
// `status` reflects whether new purchases are open; it never makes a pack look live while paused.
export const AI_CREDIT_PACKS = [
  { key: 'prepos_10_50', planId: 'ai_credits_prepos_10_50', label: '₹10 PrepOS top-up', shortLabel: 'Starter', amountInr: 10, amountPaise: 1000, credits: 50 },
  { key: 'prepos_20_150', planId: 'ai_credits_prepos_20_150', label: '₹20 PrepOS top-up', shortLabel: 'Focus', amountInr: 20, amountPaise: 2000, credits: 150 },
  { key: 'prepos_50_400', planId: 'ai_credits_prepos_50_400', label: '₹50 PrepOS top-up', shortLabel: 'Sprint', amountInr: 50, amountPaise: 5000, credits: 400, featured: true },
].map((pack) => Object.freeze({
  ...pack,
  status: aiCommerceOpen() ? 'live' : 'paused',
  description: `${pack.credits} PrepOS credits that do not expire.`,
}));

export function getAICreditPack(packKeyOrPlanId) {
  const key = String(packKeyOrPlanId || '').trim();
  return AI_CREDIT_PACKS.find((pack) => pack.key === key || pack.planId === key) || null;
}

export function isAICreditPackPlanId(planId) {
  return Boolean(getAICreditPack(planId));
}

export function includedMonthlyCreditsForUser(user) {
  if (!user?.id) return 0;
  return isPaidUser(user) ? AI_PRO_INCLUDED_MONTHLY_CREDITS : AI_FREE_MONTHLY_CREDITS;
}

export function currentAIWalletWindow(input = new Date()) {
  return walletWindow(input);
}

/**
 * One read of the wallet. Never inserts, resets or synchronises a row; a missing row is
 * projected from the current allowance. A read failure returns an unknown balance.
 */
export async function readAIWallet(user) {
  const paid = isPaidUser(user);
  if (!user?.id) return unreadableWallet('error', { paid: false, reason: 'missing_user' });
  try {
    const { data, error } = await supabaseAdmin()
      .from('ai_credit_wallets')
      .select('user_id, included_monthly_credits, included_credits_used, bonus_credits, period_start, reset_at')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      return unreadableWallet(isMissingRelation(error) ? 'schema_unavailable' : 'error', { paid, reason: error.code || 'wallet_read_failed' });
    }
    return projectWallet(data, { paid, includedMonthlyCredits: includedMonthlyCreditsForUser(user), paidAiOpen: paidAiOpen() });
  } catch (err) {
    return unreadableWallet(isMissingRelation(err) ? 'schema_unavailable' : 'error', { paid, reason: 'wallet_read_failed' });
  }
}

// Older call sites import getAIWallet; it is the same pure read.
export const getAIWallet = readAIWallet;

/**
 * Spend PrepOS credits through the atomic RPC only. Requires a stable operation key that
 * the caller reuses across every retry. Fails closed while paid AI is paused, when the
 * RPC is missing, or on any error; there is no read-modify-write fallback.
 */
export async function consumeAIWalletCredits({ user, amount, action, reference, idempotencyKey, metadata = {} }) {
  const cost = Math.max(0, Math.round(Number(amount) || 0));
  if (!user?.id) return { ok: false, error: 'missing_user', status: 401 };
  if (cost === 0) return { ok: true, charged: 0, charge: zeroCharge() };
  if (!paidAiOpen()) return { ok: false, error: 'prepos_paused', status: 503, message: PREPOS_PAUSED_MESSAGE };
  if (!/^[A-Za-z0-9:_-]{8,200}$/.test(String(idempotencyKey || ''))) {
    return { ok: false, error: 'operation_key_required', status: 400 };
  }

  const window = walletWindow();
  const includedMonthlyCredits = includedMonthlyCreditsForUser(user);
  try {
    const { data, error } = await supabaseAdmin().rpc('mm_ai_consume_credits', {
      p_user_id: user.id,
      p_amount: cost,
      p_action: action || 'ai',
      p_reference: reference || idempotencyKey,
      p_idempotency_key: idempotencyKey,
      p_included_monthly_credits: includedMonthlyCredits,
      p_period_start: window.periodStart,
      p_reset_at: window.resetAt,
      p_metadata: metadata && typeof metadata === 'object' ? metadata : {},
    });
    if (error) {
      return isMissingFunction(error)
        ? { ok: false, error: 'ai_credit_rpc_unavailable', status: 503, message: PREPOS_PAUSED_MESSAGE }
        : { ok: false, error: 'ai_credit_rpc_failed', status: 500, message: PREPOS_PAUSED_MESSAGE };
    }
    if (!data?.ok) {
      return { ok: false, error: data?.error || 'insufficient_ai_credits', status: 402, required: data?.required ?? cost, balance: data?.balance ?? null };
    }
    return {
      ok: true,
      charged: Number(data.charged ?? cost),
      idempotent: Boolean(data.idempotent),
      charge: {
        kind: sourceKind(data),
        amount: Number(data.charged ?? cost),
        creditUnits: cost,
        reference: data.reference || reference || idempotencyKey,
        operationKey: idempotencyKey,
        balance: data.balance ?? null,
        includedSpent: data.includedSpent || 0,
        bonusSpent: data.bonusSpent || 0,
      },
    };
  } catch (err) {
    return isMissingFunction(err)
      ? { ok: false, error: 'ai_credit_rpc_unavailable', status: 503, message: PREPOS_PAUSED_MESSAGE }
      : { ok: false, error: 'ai_credit_rpc_failed', status: 500, message: PREPOS_PAUSED_MESSAGE };
  }
}

/**
 * Grants for captured purchases (including historical orders verified late) go through
 * the atomic grant RPC only. Missing RPC → 503, never a direct balance write.
 */
export async function grantPurchasedAICredits({ userId, credits, packKey, paymentId, orderId, idempotencyKey, metadata = {} }) {
  const amount = Math.max(0, Math.round(Number(credits) || 0));
  if (!userId) return { ok: false, error: 'missing_user', status: 400 };
  if (amount <= 0) return { ok: false, error: 'invalid_credit_amount', status: 400 };

  const reference = orderId || paymentId || packKey || 'ai_topup';
  const key = idempotencyKey || `ai_topup:${reference}:${paymentId || 'captured'}`;
  try {
    const { data, error } = await supabaseAdmin().rpc('mm_ai_grant_bonus_credits', {
      p_user_id: userId,
      p_amount: amount,
      p_reason: 'pack_purchase',
      p_reference: orderId || paymentId || null,
      p_idempotency_key: key,
      p_metadata: { ...(metadata || {}), packKey: packKey || null, paymentId: paymentId || null, orderId: orderId || null },
    });
    if (error) {
      return isMissingFunction(error)
        ? { ok: false, error: 'ai_credit_grant_rpc_required', status: 503 }
        : { ok: false, error: error.message || 'ai_credit_grant_failed', status: 500 };
    }
    if (!data?.ok) return { ok: false, error: data?.error || 'ai_credit_grant_failed', status: 500 };
    return { ok: true, granted: Number(data.granted || amount), balance: Number(data.balance || 0), idempotent: Boolean(data.idempotent) };
  } catch (err) {
    return isMissingFunction(err)
      ? { ok: false, error: 'ai_credit_grant_rpc_required', status: 503 }
      : { ok: false, error: err?.message || 'ai_credit_grant_failed', status: 500 };
  }
}

function sourceKind(data) {
  const included = Number(data?.includedSpent || 0);
  const bonus = Number(data?.bonusSpent || 0);
  if (included > 0 && bonus > 0) return 'mixed_ai_credits';
  if (included > 0) return 'included_monthly';
  if (bonus > 0) return 'bonus_credits';
  return 'ai_credits';
}

function zeroCharge() {
  return { kind: 'included', amount: 0, creditUnits: 0, reference: null, balance: null, includedSpent: 0, bonusSpent: 0 };
}
