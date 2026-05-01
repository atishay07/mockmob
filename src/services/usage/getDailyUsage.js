import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { istDayStartISO, istMonthStartISO } from './istDay';
import { AI_FREE_MONTHLY_CREDITS, AI_INCLUDED_MONTHLY_CREDITS, getAIWallet } from '@/services/credits/aiCreditWallet';

export const INCLUDED_MONTHLY_AI_CREDITS = AI_INCLUDED_MONTHLY_CREDITS;

/**
 * Credit costs are the server-side source of truth. The model may describe an
 * action, but only this file decides whether the user can run it.
 */
export const CREDIT_COSTS = {
  mentor_chat: 1,
  ai_mentor_extra: 1,
  deep_mentor_analysis: 3,
  mock_autopsy: 3,
  trap_drill: 3,
  custom_mock_plan: 3,
  admission_path: 3,
  premium_rival: 1,
  rival_college: 3,
  rival_weakness: 3,
  rival_boss: 3,
  rival_rematch: 1,
  deep_recovery_plan: 3,
};

export const LIMITS = {
  free: {
    monthlyAiCredits: AI_FREE_MONTHLY_CREDITS,
    basicRivalBattles: 1,
    premiumRivalBattles: 0,
  },
  paid: {
    monthlyAiCredits: INCLUDED_MONTHLY_AI_CREDITS,
    basicRivalBattles: Infinity,
    premiumRivalBattles: 'credit_based',
  },
};

export function planTierFor(user) {
  return user?.subscriptionStatus === 'active' || user?.isPremium === true ? 'paid' : 'free';
}

export function getCreditCostForAction(action, params = {}) {
  if (action === 'mentor_chat') return CREDIT_COSTS.mentor_chat;
  if (action === 'mentor_deep') return CREDIT_COSTS.deep_mentor_analysis;
  if (action === 'mock_autopsy' || action === 'show_mock_autopsy') return CREDIT_COSTS.mock_autopsy;
  if (action === 'trap_drill' || action === 'create_trap_drill' || action === 'mistake_replay' || action === 'create_mistake_replay') return CREDIT_COSTS.trap_drill;
  if (action === 'custom_mock_plan' || action === 'create_next_mock') {
    return params?.custom === true ? CREDIT_COSTS.custom_mock_plan : 0;
  }
  if (action === 'admission_path') return CREDIT_COSTS.admission_path;
  if (action === 'rival_college') return CREDIT_COSTS.rival_college;
  if (action === 'rival_weakness') return CREDIT_COSTS.rival_weakness;
  if (action === 'rival_boss') return CREDIT_COSTS.rival_boss;
  if (action === 'rival_premium') return CREDIT_COSTS.premium_rival;
  if (action === 'rival_rematch') return CREDIT_COSTS.rival_rematch;
  if (action === 'deep_recovery_plan') return CREDIT_COSTS.deep_recovery_plan;
  return 0;
}

export function mentorModeToQuotaAction(mode) {
  if (mode === 'autopsy') return 'mock_autopsy';
  if (mode === 'trap_drill' || mode === 'mistake_replay') return 'trap_drill';
  if (mode === 'admission') return 'admission_path';
  if (mode === 'comeback') return 'deep_recovery_plan';
  if (mode === 'mock_plan') return 'custom_mock_plan';
  return 'mentor_chat';
}

export function rivalTypeToQuotaAction(rivalType) {
  if (rivalType === 'HANSRAJ_LEVEL' || rivalType === 'SRCC_DREAM') return 'rival_college';
  if (rivalType === 'WEAKNESS_RIVAL') return 'rival_weakness';
  if (rivalType === 'BOSS_RIVAL') return 'rival_boss';
  return 'rival_premium';
}

export async function getDailyUsage(userId) {
  const sb = supabaseAdmin();
  const since = istDayStartISO();

  const [mentorCount, basicRivalCount, premiumRivalCount] = await Promise.all([
    safeCount(
      sb
        .from('ai_usage_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('feature', 'mentor_chat')
        .gte('created_at', since),
    ),
    safeCount(
      sb
        .from('rival_battles')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('rival_type', ['NORTH_CAMPUS_RIVAL', 'SPEED_DEMON', 'ACCURACY_MONSTER', 'COMEBACK_RIVAL'])
        .gte('created_at', since),
    ),
    safeCount(
      sb
        .from('rival_battles')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('rival_type', ['HANSRAJ_LEVEL', 'SRCC_DREAM', 'WEAKNESS_RIVAL', 'BOSS_RIVAL'])
        .gte('created_at', since),
    ),
  ]);

  return {
    aiMentorMessages: mentorCount,
    basicRivalBattles: basicRivalCount,
    premiumRivalBattles: premiumRivalCount,
  };
}

export async function getMonthlyAIUsage(userId) {
  const since = istMonthStartISO();
  try {
    const { data, error } = await supabaseAdmin()
      .from('ai_usage_logs')
      .select('feature, metadata')
      .eq('user_id', userId)
      .gte('created_at', since)
      .limit(1000);

    if (error) {
      return emptyMonthlyUsage(error.message);
    }

    let includedAiCreditsUsed = 0;
    let extraAiCreditsUsed = 0;
    let totalAiCreditsUsed = 0;

    for (const row of data || []) {
      const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
      const charge = metadata.charge && typeof metadata.charge === 'object' ? metadata.charge : {};
      const units = normalizeUnits(
        charge.creditUnits ?? metadata.creditUnits ?? defaultUnitsForFeature(row.feature, metadata),
      );

      if (units <= 0) continue;
      totalAiCreditsUsed += units;

      if (charge.kind === 'included_monthly' || metadata.includedMonthly === true || legacyIncluded(row.feature, charge)) {
        includedAiCreditsUsed += units;
      } else if (charge.kind === 'credits') {
        extraAiCreditsUsed += units;
      }
    }

    return {
      includedAiCreditsUsed,
      extraAiCreditsUsed,
      totalAiCreditsUsed,
      monthStart: since,
      degraded: false,
    };
  } catch (err) {
    return emptyMonthlyUsage(err?.message || 'monthly_usage_failed');
  }
}

export async function getUsageSnapshot(user) {
  const tier = planTierFor(user);
  const limits = LIMITS[tier];
  const [used, monthly, aiWallet] = await Promise.all([
    getDailyUsage(user.id),
    getMonthlyAIUsage(user.id),
    getAIWallet(user),
  ]);

  const includedMonthlyAiCredits = aiWallet.includedMonthlyCredits;
  const includedAiCreditsRemaining = aiWallet.includedRemaining;

  const remaining = {
    aiCredits: aiWallet.total,
    // Legacy UI compatibility: this used to mean daily mentor messages.
    aiMentorMessages: aiWallet.total,
    basicRivalBattles:
      limits.basicRivalBattles === Infinity
        ? Infinity
        : Math.max(0, limits.basicRivalBattles - used.basicRivalBattles),
    premiumRivalBattles: aiWallet.total,
  };

  return {
    tier,
    isPaid: tier === 'paid',
    limits,
    used,
    monthly,
    includedMonthlyAiCredits,
    includedAiCreditsRemaining,
    remaining,
    aiCreditBalance: aiWallet.total,
    aiWallet,
    // Normal MockMob credits are kept separate for legacy screens.
    normalCreditBalance: user?.creditBalance || 0,
    creditBalance: aiWallet.total,
    creditCosts: CREDIT_COSTS,
  };
}

export function resolveActionQuota({ user, snapshot, action, params = {} }) {
  const tier = planTierFor(user);
  const isPaid = tier === 'paid';
  const cost = getCreditCostForAction(action, params);

  if (action === 'upgrade_plan' || action === 'buy_credits') {
    return { allowed: true, requiresCredits: false, creditCost: 0, creditUnits: 0 };
  }

  if (action === 'rival_basic') {
    if (isPaid) {
      return { allowed: true, requiresCredits: false, creditCost: 0, creditUnits: 0 };
    }
    if ((snapshot?.remaining?.basicRivalBattles || 0) > 0) {
      return { allowed: true, requiresCredits: false, creditCost: 0, creditUnits: 0 };
    }
    return {
      allowed: false,
      planRequired: false,
      upgradeHint: true,
      reason: 'free_daily_rival_used',
      status: 429,
    };
  }

  if (action === 'mentor_chat') {
    return resolvePaidCreditGate({ snapshot, cost, action });
  }

  if (
    action === 'mock_autopsy' ||
    action === 'trap_drill' ||
    action === 'mistake_replay' ||
    action === 'custom_mock_plan' ||
    action === 'admission_path' ||
    action === 'mentor_deep' ||
    action === 'deep_recovery_plan' ||
    action === 'rival_premium' ||
    action === 'rival_college' ||
    action === 'rival_weakness' ||
    action === 'rival_boss' ||
    action === 'rival_rematch'
  ) {
    if (!isPaid) {
      return { allowed: false, planRequired: true, reason: `${action}_paid_only`, creditUnits: cost };
    }
    return resolvePaidCreditGate({ snapshot, cost, action });
  }

  return { allowed: false, reason: 'unknown_action', creditUnits: 0 };
}

function resolvePaidCreditGate({ snapshot, cost, action }) {
  if (!cost) {
    return { allowed: true, requiresCredits: false, creditCost: 0, creditUnits: 0 };
  }

  const includedRemaining = snapshot?.includedAiCreditsRemaining ?? snapshot?.remaining?.aiCredits ?? 0;
  if (includedRemaining >= cost) {
    return {
      allowed: true,
      requiresCredits: false,
      creditCost: 0,
      creditUnits: cost,
      chargeKind: 'included_monthly',
      includedRemainingAfter: includedRemaining - cost,
    };
  }

  const balance = snapshot?.creditBalance || 0;
  if (balance >= cost) {
    return {
      allowed: true,
      requiresCredits: true,
      creditCost: cost,
      creditUnits: cost,
      chargeKind: 'credits',
      reason: 'included_ai_credits_exhausted',
    };
  }

  return {
    allowed: false,
    reason: 'insufficient_credits',
    requiresCredits: true,
    creditCost: cost,
    creditUnits: cost,
    balance,
    required: cost,
    status: 402,
  };
}

async function safeCount(query) {
  try {
    const { count, error } = await query;
    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

function normalizeUnits(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(0, Math.round(n));
}

function defaultUnitsForFeature(feature, metadata) {
  if (feature === 'mentor_chat') {
    return getCreditCostForAction(mentorModeToQuotaAction(metadata?.mode || 'mentor'));
  }
  if (feature === 'trap_drill' || feature === 'mistake_replay') return CREDIT_COSTS.trap_drill;
  if (feature === 'mock_autopsy') return CREDIT_COSTS.mock_autopsy;
  if (feature === 'rival_premium') return CREDIT_COSTS.premium_rival;
  return 0;
}

function legacyIncluded(feature, charge) {
  return !charge.kind && ['mentor_chat', 'trap_drill', 'mock_autopsy'].includes(feature);
}

function emptyMonthlyUsage(reason) {
  return {
    includedAiCreditsUsed: 0,
    extraAiCreditsUsed: 0,
    totalAiCreditsUsed: 0,
    monthStart: istMonthStartISO(),
    degraded: true,
    reason,
  };
}
