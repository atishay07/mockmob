import 'server-only';
import { getUsageSnapshot, resolveActionQuota } from '@/services/usage/getDailyUsage';
import { consumeAIWalletCredits } from './aiCreditWallet';

/**
 * Spends the right AI allowance for a paid feature.
 *
 * Order:
 *   1. Validate plan/feature rules.
 *   2. Spend the user's dedicated AI wallet.
 *
 * Normal MockMob credits are never read or mutated here.
 */
export async function consumeAIAllowance({ user, action, params = {}, referencePrefix = 'ai' }) {
  if (!user?.id) {
    return { ok: false, error: 'missing_user', status: 401 };
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
      balance: quota.balance ?? snapshot.aiCreditBalance ?? 0,
      quota,
      snapshot,
    };
  }

  const creditUnits = quota.creditUnits || quota.creditCost || 0;
  if (creditUnits > 0) {
    const reference = `${referencePrefix}_${user.id}_${Date.now()}`;
    const charge = await consumeAIWalletCredits({
      user,
      amount: creditUnits,
      action,
      reference,
      idempotencyKey: reference,
      metadata: { action, quota },
    });

    if (!charge.ok) {
      return {
        ok: false,
        error: charge.error || 'insufficient_ai_credits',
        status: charge.status || 402,
        required: charge.required ?? creditUnits,
        balance: charge.balance ?? charge.wallet?.total ?? snapshot.aiCreditBalance ?? 0,
        quota,
        snapshot,
      };
    }

    return {
      ok: true,
      quota,
      snapshot: { ...snapshot, aiWallet: charge.wallet, aiCreditBalance: charge.wallet?.total ?? snapshot.aiCreditBalance },
      charge: charge.charge,
    };
  }

  return {
    ok: true,
    quota,
    snapshot,
    charge: {
      kind: creditUnits > 0 ? 'included_monthly' : 'included',
      amount: 0,
      creditUnits,
      reference: null,
      includedRemainingAfter:
        creditUnits > 0
          ? Math.max(0, (snapshot.includedAiCreditsRemaining || 0) - creditUnits)
          : snapshot.includedAiCreditsRemaining,
    },
  };
}
