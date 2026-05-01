import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { istMonthStartISO } from '@/services/usage/istDay';

export const AI_FREE_MONTHLY_CREDITS = 10;
export const AI_PRO_INCLUDED_MONTHLY_CREDITS = 50;
export const AI_INCLUDED_MONTHLY_CREDITS = AI_PRO_INCLUDED_MONTHLY_CREDITS;
export const AI_FREE_BUDGET_INR_CAP = 5;
export const AI_INTERNAL_USD_TO_INR = 85;

export const AI_CREDIT_PACKS = [
  {
    key: 'prepos_10_50',
    planId: 'ai_credits_prepos_10_50',
    label: '₹10 PrepOS top-up',
    shortLabel: 'Starter',
    amountInr: 10,
    amountPaise: 1000,
    credits: 50,
    status: 'live',
    description: 'A quick refill for another focused PrepOS sprint.',
  },
  {
    key: 'prepos_20_150',
    planId: 'ai_credits_prepos_20_150',
    label: '₹20 PrepOS top-up',
    shortLabel: 'Focus',
    amountInr: 20,
    amountPaise: 2000,
    credits: 150,
    status: 'live',
    description: 'Best value for a week of missions, replay, and planning.',
    featured: true,
  },
  {
    key: 'prepos_50_400',
    planId: 'ai_credits_prepos_50_400',
    label: '₹50 PrepOS top-up',
    shortLabel: 'Sprint',
    amountInr: 50,
    amountPaise: 5000,
    credits: 400,
    status: 'live',
    description: 'For heavy PrepOS use without interrupting your CUET flow.',
  },
];

export function getAICreditPack(packKeyOrPlanId) {
  const key = String(packKeyOrPlanId || '').trim();
  return AI_CREDIT_PACKS.find((pack) => pack.key === key || pack.planId === key) || null;
}

export function isAICreditPackPlanId(planId) {
  return Boolean(getAICreditPack(planId));
}

export function isPaidUser(user) {
  return user?.subscriptionStatus === 'active' || user?.isPremium === true;
}

export function includedMonthlyCreditsForUser(user) {
  if (!user?.id) return 0;
  return isPaidUser(user) ? AI_PRO_INCLUDED_MONTHLY_CREDITS : AI_FREE_MONTHLY_CREDITS;
}

export function currentAIWalletWindow(input = new Date()) {
  const periodStart = istMonthStartISO(input);
  const start = new Date(periodStart);
  const shifted = new Date(start.getTime() + (5 * 60 + 30) * 60 * 1000);
  const resetUtc = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 1) - (5 * 60 + 30) * 60 * 1000;
  return {
    periodStart,
    resetAt: new Date(resetUtc).toISOString(),
  };
}

export async function getAIWallet(user) {
  const paid = isPaidUser(user);
  const includedMonthlyCredits = includedMonthlyCreditsForUser(user);
  if (!user?.id) return emptyWallet({ paid: false, reason: 'missing_user' });

  const window = currentAIWalletWindow();
  const sb = supabaseAdmin();

  try {
    const { data: existing, error: readError } = await sb
      .from('ai_credit_wallets')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (readError && !isMissingRelation(readError)) {
      return emptyWallet({ paid, schemaReady: false, reason: readError.message, includedMonthlyCredits });
    }
    if (readError && isMissingRelation(readError)) {
      return emptyWallet({ paid, schemaReady: false, reason: 'ai_credit_wallets_missing', includedMonthlyCredits });
    }

    if (!existing) {
      const { data: inserted, error: insertError } = await sb
        .from('ai_credit_wallets')
        .insert({
          user_id: user.id,
          included_monthly_credits: includedMonthlyCredits,
          included_credits_used: 0,
          bonus_credits: 0,
          period_start: window.periodStart,
          reset_at: window.resetAt,
        })
        .select('*')
        .single();
      if (insertError) {
        return emptyWallet({ paid, schemaReady: false, reason: insertError.message, includedMonthlyCredits });
      }
      return walletOut(inserted, { paid, schemaReady: true });
    }

    const existingMonthlyCredits = Math.max(0, Number(existing.included_monthly_credits) || 0);
    const needsMonthlyReset = new Date(existing.period_start).getTime() < new Date(window.periodStart).getTime();
    const needsAllowanceSync = existingMonthlyCredits !== includedMonthlyCredits;

    if (needsMonthlyReset || needsAllowanceSync) {
      const { data: reset, error: resetError } = await sb
        .from('ai_credit_wallets')
        .update({
          included_monthly_credits: includedMonthlyCredits,
          included_credits_used: needsMonthlyReset ? 0 : Math.min(Number(existing.included_credits_used) || 0, includedMonthlyCredits),
          period_start: needsMonthlyReset ? window.periodStart : existing.period_start,
          reset_at: needsMonthlyReset ? window.resetAt : existing.reset_at,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select('*')
        .single();
      if (resetError) {
        return walletOut(existing, { paid, schemaReady: true, degraded: true, reason: resetError.message });
      }
      return walletOut(reset, { paid, schemaReady: true });
    }

    return walletOut(existing, { paid, schemaReady: true });
  } catch (err) {
    return emptyWallet({ paid, schemaReady: false, reason: err?.message || 'wallet_read_failed', includedMonthlyCredits });
  }
}

export async function consumeAIWalletCredits({
  user,
  amount,
  action,
  reference,
  idempotencyKey,
  metadata = {},
}) {
  const cost = Math.max(0, Math.round(Number(amount) || 0));
  if (!user?.id) return { ok: false, error: 'missing_user', status: 401 };
  if (cost === 0) {
    const wallet = await getAIWallet(user);
    return { ok: true, charged: 0, wallet, charge: zeroCharge(wallet) };
  }

  const window = currentAIWalletWindow();
  const rpcResult = await consumeViaRpc({
    user,
    amount: cost,
    action,
    reference,
    idempotencyKey,
    metadata,
    window,
  });
  if (rpcResult.ok || rpcResult.error !== 'rpc_unavailable') {
    return rpcResult;
  }

  return consumeDirectly({
    user,
    amount: cost,
    action,
    reference,
    idempotencyKey,
    metadata,
  });
}

export async function grantPurchasedAICredits({
  userId,
  credits,
  packKey,
  paymentId,
  orderId,
  idempotencyKey,
  metadata = {},
}) {
  const amount = Math.max(0, Math.round(Number(credits) || 0));
  if (!userId) return { ok: false, error: 'missing_user', status: 400 };
  if (amount <= 0) return { ok: false, error: 'invalid_credit_amount', status: 400 };

  const reference = orderId || paymentId || packKey || 'ai_topup';
  const key = idempotencyKey || `ai_topup:${reference}:${paymentId || 'captured'}`;

  const rpc = await grantViaRpc({
    userId,
    amount,
    packKey,
    paymentId,
    orderId,
    idempotencyKey: key,
    metadata,
  });
  if (rpc.ok || rpc.error !== 'rpc_unavailable') return rpc;

  return grantDirectly({
    userId,
    amount,
    packKey,
    paymentId,
    orderId,
    idempotencyKey: key,
    metadata,
  });
}

async function grantViaRpc({ userId, amount, packKey, paymentId, orderId, idempotencyKey, metadata }) {
  try {
    const { data, error } = await supabaseAdmin().rpc('mm_ai_grant_bonus_credits', {
      p_user_id: userId,
      p_amount: amount,
      p_reason: 'ai_credit_purchase',
      p_reference: orderId || paymentId || null,
      p_idempotency_key: idempotencyKey,
      p_metadata: {
        ...(metadata || {}),
        packKey: packKey || null,
        paymentId: paymentId || null,
        orderId: orderId || null,
      },
    });

    if (error) {
      if (isMissingFunction(error)) return { ok: false, error: 'rpc_unavailable' };
      return { ok: false, error: error.message || 'ai_credit_grant_failed', status: 500 };
    }

    if (!data?.ok) {
      return { ok: false, error: data?.error || 'ai_credit_grant_failed', status: 500 };
    }

    return {
      ok: true,
      granted: Number(data.granted || amount),
      balance: Number(data.balance || 0),
      idempotent: Boolean(data.idempotent),
    };
  } catch (err) {
    if (isMissingFunction(err)) return { ok: false, error: 'rpc_unavailable' };
    return { ok: false, error: err?.message || 'ai_credit_grant_failed', status: 500 };
  }
}

async function grantDirectly({ userId, amount, packKey, paymentId, orderId, idempotencyKey, metadata }) {
  const sb = supabaseAdmin();
  const window = currentAIWalletWindow();

  try {
    const { data: existingLedger, error: ledgerReadError } = await sb
      .from('ai_credit_ledger')
      .select('balance_after, amount')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (ledgerReadError && !isMissingRelation(ledgerReadError)) {
      return { ok: false, error: ledgerReadError.message || 'ai_credit_ledger_read_failed', status: 500 };
    }
    if (existingLedger) {
      return {
        ok: true,
        granted: Math.abs(Number(existingLedger.amount) || amount),
        balance: Number(existingLedger.balance_after || 0),
        idempotent: true,
      };
    }

    const { data: existing } = await sb
      .from('ai_credit_wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) {
      const { data: inserted, error: insertError } = await sb
        .from('ai_credit_wallets')
        .insert({
          user_id: userId,
          included_monthly_credits: AI_FREE_MONTHLY_CREDITS,
          included_credits_used: 0,
          bonus_credits: amount,
          period_start: window.periodStart,
          reset_at: window.resetAt,
        })
        .select('*')
        .single();
      if (insertError) return { ok: false, error: insertError.message || 'ai_wallet_insert_failed', status: 500 };
      const wallet = walletOut(inserted, { paid: false, schemaReady: true });
      await insertLedger({
        userId,
        amount,
        action: 'ai_credit_purchase',
        reference: orderId || paymentId || null,
        idempotencyKey,
        balanceAfter: wallet.total,
        source: 'grant',
        metadata: { ...(metadata || {}), packKey, paymentId, orderId },
      });
      return { ok: true, granted: amount, balance: wallet.total };
    }

    const bonusCredits = Math.max(0, Number(existing.bonus_credits) || 0);
    const nextBonus = bonusCredits + amount;
    const includedRemaining = Math.max(
      0,
      (Number(existing.included_monthly_credits) || 0) - (Number(existing.included_credits_used) || 0),
    );
    const balanceAfter = includedRemaining + nextBonus;

    const { error: updateError } = await sb
      .from('ai_credit_wallets')
      .update({ bonus_credits: nextBonus, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (updateError) return { ok: false, error: updateError.message || 'ai_wallet_update_failed', status: 500 };

    await insertLedger({
      userId,
      amount,
      action: 'ai_credit_purchase',
      reference: orderId || paymentId || null,
      idempotencyKey,
      balanceAfter,
      source: 'grant',
      metadata: { ...(metadata || {}), packKey, paymentId, orderId },
    });

    return { ok: true, granted: amount, balance: balanceAfter };
  } catch (err) {
    return { ok: false, error: err?.message || 'ai_credit_grant_failed', status: 500 };
  }
}

async function consumeViaRpc({ user, amount, action, reference, idempotencyKey, metadata, window }) {
  const includedMonthlyCredits = includedMonthlyCreditsForUser(user);
  try {
    const { data, error } = await supabaseAdmin().rpc('mm_ai_consume_credits', {
      p_user_id: user.id,
      p_amount: amount,
      p_action: action || 'ai',
      p_reference: reference || null,
      p_idempotency_key: idempotencyKey || null,
      p_included_monthly_credits: includedMonthlyCredits,
      p_period_start: window.periodStart,
      p_reset_at: window.resetAt,
      p_metadata: metadata && typeof metadata === 'object' ? metadata : {},
    });

    if (error) {
      if (isMissingFunction(error)) return { ok: false, error: 'rpc_unavailable' };
      return { ok: false, error: error.message || 'ai_credit_rpc_failed', status: 500 };
    }

    if (!data?.ok) {
      return {
        ok: false,
        error: data?.error || 'insufficient_ai_credits',
        status: 402,
        required: data?.required ?? amount,
        balance: data?.balance ?? 0,
        wallet: normalizeRpcWallet(data, { paid: isPaidUser(user), includedMonthlyCredits }),
      };
    }

    const wallet = normalizeRpcWallet(data, { paid: isPaidUser(user), includedMonthlyCredits });
    return {
      ok: true,
      charged: data.charged ?? amount,
      wallet,
      charge: {
        kind: sourceKind(data),
        amount: data.charged ?? amount,
        creditUnits: amount,
        reference: data.reference || reference || null,
        balance: data.balance ?? wallet.total,
        includedSpent: data.includedSpent || 0,
        bonusSpent: data.bonusSpent || 0,
      },
    };
  } catch (err) {
    if (isMissingFunction(err)) return { ok: false, error: 'rpc_unavailable' };
    return { ok: false, error: err?.message || 'ai_credit_rpc_failed', status: 500 };
  }
}

async function consumeDirectly({ user, amount, action, reference, idempotencyKey, metadata }) {
  const wallet = await getAIWallet(user);
  if (!wallet.schemaReady) {
    return {
      ok: false,
      error: 'ai_credit_schema_missing',
      status: 503,
      required: amount,
      balance: 0,
      wallet,
    };
  }
  if (wallet.total < amount) {
    return {
      ok: false,
      error: 'insufficient_ai_credits',
      status: 402,
      required: amount,
      balance: wallet.total,
      wallet,
    };
  }

  const includedSpent = Math.min(wallet.includedRemaining, amount);
  const bonusSpent = amount - includedSpent;
  const nextIncludedUsed = wallet.includedUsed + includedSpent;
  const nextBonus = wallet.bonusCredits - bonusSpent;
  const balanceAfter = (wallet.includedMonthlyCredits - nextIncludedUsed) + nextBonus;

  const { data, error } = await supabaseAdmin()
    .from('ai_credit_wallets')
    .update({
      included_credits_used: nextIncludedUsed,
      bonus_credits: nextBonus,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .select('*')
    .single();

  if (error) {
    return { ok: false, error: error.message || 'ai_credit_update_failed', status: 500, wallet };
  }

  await insertLedger({
    userId: user.id,
    amount: -amount,
    action,
    reference,
    idempotencyKey,
    balanceAfter,
    source: includedSpent && bonusSpent ? 'mixed' : includedSpent ? 'included' : 'bonus',
    metadata: { ...(metadata || {}), includedSpent, bonusSpent },
  });

  const updatedWallet = walletOut(data, { paid: isPaidUser(user), schemaReady: true });
  return {
    ok: true,
    charged: amount,
    wallet: updatedWallet,
    charge: {
      kind: includedSpent && bonusSpent ? 'mixed_ai_credits' : includedSpent ? 'included_monthly' : 'bonus_credits',
      amount,
      creditUnits: amount,
      reference: reference || null,
      balance: updatedWallet.total,
      includedSpent,
      bonusSpent,
    },
  };
}

async function insertLedger({
  userId,
  amount,
  action,
  reference,
  idempotencyKey,
  balanceAfter,
  source,
  metadata,
}) {
  try {
    await supabaseAdmin().from('ai_credit_ledger').insert({
      user_id: userId,
      amount,
      reason: amount < 0 ? 'ai_spend' : action || 'admin_adjustment',
      feature: action || null,
      reference: reference || null,
      wallet_source: source || null,
      balance_after: balanceAfter,
      idempotency_key: idempotencyKey || null,
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
    });
  } catch (err) {
    console.warn('[ai_credits] ledger insert skipped:', err?.message || err);
  }
}

function walletOut(row, { paid, schemaReady, degraded = false, reason = null }) {
  const includedMonthlyCredits = Math.max(0, Number(row?.included_monthly_credits) || 0);
  const includedUsed = Math.max(0, Number(row?.included_credits_used) || 0);
  const includedRemaining = Math.max(0, includedMonthlyCredits - includedUsed);
  const bonusCredits = Math.max(0, Number(row?.bonus_credits) || 0);
  return {
    paid: Boolean(paid),
    schemaReady: schemaReady !== false,
    degraded,
    reason,
    includedMonthlyCredits,
    includedUsed,
    includedRemaining,
    bonusCredits,
    total: includedRemaining + bonusCredits,
    resetAt: row?.reset_at || currentAIWalletWindow().resetAt,
    periodStart: row?.period_start || currentAIWalletWindow().periodStart,
  };
}

function emptyWallet({ paid, schemaReady = true, reason = null, includedMonthlyCredits = 0 }) {
  const window = currentAIWalletWindow();
  return {
    paid: Boolean(paid),
    schemaReady,
    degraded: Boolean(reason),
    reason,
    includedMonthlyCredits,
    includedUsed: 0,
    includedRemaining: includedMonthlyCredits,
    bonusCredits: 0,
    total: includedMonthlyCredits,
    resetAt: window.resetAt,
    periodStart: window.periodStart,
  };
}

function normalizeRpcWallet(data, { paid, includedMonthlyCredits = AI_PRO_INCLUDED_MONTHLY_CREDITS }) {
  const window = currentAIWalletWindow();
  return {
    paid: Boolean(paid),
    schemaReady: true,
    degraded: false,
    reason: null,
    includedMonthlyCredits,
    includedUsed: Math.max(0, includedMonthlyCredits - Number(data?.includedRemaining || 0)),
    includedRemaining: Math.max(0, Number(data?.includedRemaining || 0)),
    bonusCredits: Math.max(0, Number(data?.bonusCredits || 0)),
    total: Math.max(0, Number(data?.balance || 0)),
    resetAt: window.resetAt,
    periodStart: window.periodStart,
  };
}

function sourceKind(data) {
  const included = Number(data?.includedSpent || 0);
  const bonus = Number(data?.bonusSpent || 0);
  if (included > 0 && bonus > 0) return 'mixed_ai_credits';
  if (included > 0) return 'included_monthly';
  if (bonus > 0) return 'bonus_credits';
  return 'ai_credits';
}

function zeroCharge(wallet) {
  return {
    kind: 'included',
    amount: 0,
    creditUnits: 0,
    reference: null,
    balance: wallet?.total ?? 0,
    includedSpent: 0,
    bonusSpent: 0,
  };
}

function isMissingRelation(error) {
  const text = `${error?.code || ''} ${error?.message || error || ''}`.toLowerCase();
  return text.includes('42p01') || text.includes('does not exist') || text.includes('schema cache');
}

function isMissingFunction(error) {
  const text = `${error?.code || ''} ${error?.message || error || ''}`.toLowerCase();
  return text.includes('42883') || text.includes('function') || text.includes('schema cache');
}
