import 'server-only';
import { getUsageSnapshot, resolveActionQuota } from '@/services/usage/getDailyUsage';
import { consumeAIWalletCredits, paidAiOpen, PREPOS_PAUSED_MESSAGE } from './aiCreditWallet';

/**
 * Spends the right AI allowance for a paid feature.
 *
 * Order:
 *   1. Refuse while paid PrepOS is paused (no read, no charge).
 *   2. Validate plan/feature rules.
 *   3. Spend the dedicated AI wallet through the atomic RPC with the caller's stable
 *      operation key. The same key must be passed on every retry of one operation.
 *
 * Normal MockMob practice credits are never read or mutated here.
 */
export async function consumeAIAllowance({ user, action, params = {}, operationKey }) {
  if (!user?.id) {
    return { ok: false, error: 'missing_user', status: 401 };
  }
  if (!paidAiOpen()) {
    return { ok: false, error: 'prepos_paused', status: 503, message: PREPOS_PAUSED_MESSAGE, required: 0, balance: null };
  }

  const snapshot = await getUsageSnapshot(user);
  const quota = resolveActionQuota({ user, snapshot, action, params });

  if (!quota.allowed) {
    return {
      ok: false,
      error: quota.reason || 'ai_allowance_denied',
      status: quota.status || (quota.planRequired ? 402 : 400),
      planRequired: Boolean(quota.planRequired),
      upgradeHint: Boolean(quota.upgradeHint),
      required: quota.required ?? quota.creditUnits ?? quota.creditCost ?? 0,
      balance: quota.balance ?? snapshot.aiCreditBalance ?? null,
      quota,
      snapshot,
    };
  }

  const creditUnits = quota.creditUnits || quota.creditCost || 0;
  if (creditUnits === 0) {
    return { ok: true, quota, snapshot, charge: { kind: 'included', amount: 0, creditUnits: 0, reference: null } };
  }

  const charge = await consumeAIWalletCredits({
    user,
    amount: creditUnits,
    action,
    reference: operationKey,
    idempotencyKey: operationKey,
    metadata: { action, quota },
  });

  if (!charge.ok) {
    return {
      ok: false,
      error: charge.error || 'insufficient_ai_credits',
      status: charge.status || 402,
      message: charge.message,
      required: charge.required ?? creditUnits,
      balance: charge.balance ?? null,
      quota,
      snapshot,
    };
  }

  return { ok: true, quota, snapshot, charge: charge.charge };
}
