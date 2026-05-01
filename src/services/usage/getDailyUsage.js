import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { istDayStartISO } from './istDay';

/**
 * Daily-usage limits. Free users get *zero* mentor messages; that's the
 * paywall. Paid users get included quotas, then can spend credits.
 */
export const LIMITS = {
  free: {
    aiMentorMessages: 0,
    basicRivalBattles: 1,
    premiumRivalBattles: 0,
  },
  paid: {
    aiMentorMessages: 5,
    basicRivalBattles: Infinity,
    premiumRivalBattles: 2,
  },
};

/**
 * Per-action credit costs for usage that exceeds included quotas.
 * Server-side single source of truth — the AI cannot override these.
 */
export const CREDIT_COSTS = {
  ai_mentor_extra: 1,
  ai_rival_extra_basic: 1, // free user buying a 2nd basic rival in a day
  ai_rival_extra_premium: 1, // paid user past 2 premium rivals
  ai_rival_college: 2, // HANSRAJ_LEVEL, SRCC_DREAM
  ai_rival_boss: 3, // BOSS_RIVAL
  ai_rival_weakness: 1, // WEAKNESS_RIVAL
  trap_drill: 1,
  mock_autopsy: 1,
  custom_mock_plan: 2,
};

/**
 * Resolve the user's plan tier as a key into LIMITS.
 */
export function planTierFor(user) {
  return user?.subscriptionStatus === 'active' || user?.isPremium === true ? 'paid' : 'free';
}

/**
 * Read today's IST usage counts for a user.
 */
export async function getDailyUsage(userId) {
  const sb = supabaseAdmin();
  const since = istDayStartISO();

  const [mentorResult, basicRivalResult, premiumRivalResult] = await Promise.all([
    sb
      .from('ai_usage_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('feature', 'mentor_chat')
      .gte('created_at', since),
    sb
      .from('rival_battles')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('rival_type', ['NORTH_CAMPUS_RIVAL', 'SPEED_DEMON', 'ACCURACY_MONSTER', 'COMEBACK_RIVAL'])
      .gte('created_at', since),
    sb
      .from('rival_battles')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('rival_type', ['HANSRAJ_LEVEL', 'SRCC_DREAM', 'WEAKNESS_RIVAL', 'BOSS_RIVAL'])
      .gte('created_at', since),
  ]);

  return {
    aiMentorMessages: mentorResult.count || 0,
    basicRivalBattles: basicRivalResult.count || 0,
    premiumRivalBattles: premiumRivalResult.count || 0,
  };
}

/**
 * Returns plan info + remaining quota for the UI.
 */
export async function getUsageSnapshot(user) {
  const tier = planTierFor(user);
  const limits = LIMITS[tier];
  const used = await getDailyUsage(user.id);

  const remaining = {
    aiMentorMessages: Math.max(0, (limits.aiMentorMessages || 0) - used.aiMentorMessages),
    basicRivalBattles:
      limits.basicRivalBattles === Infinity
        ? Infinity
        : Math.max(0, limits.basicRivalBattles - used.basicRivalBattles),
    premiumRivalBattles: Math.max(0, limits.premiumRivalBattles - used.premiumRivalBattles),
  };

  return {
    tier,
    isPaid: tier === 'paid',
    limits,
    used,
    remaining,
    creditBalance: user?.creditBalance || 0,
    creditCosts: CREDIT_COSTS,
  };
}

/**
 * For a single action+user, decide whether it's covered by the included
 * quota or whether the user must spend credits (and how many).
 *
 * Returns: { allowed, requiresCredits, creditCost, reason, planRequired }
 */
export function resolveActionQuota({ user, snapshot, action }) {
  const tier = planTierFor(user);
  const isPaid = tier === 'paid';

  switch (action) {
    case 'mentor_chat': {
      if (!isPaid) {
        return { allowed: false, planRequired: true, reason: 'mentor_paid_only' };
      }
      if (snapshot.remaining.aiMentorMessages > 0) {
        return { allowed: true, requiresCredits: false, creditCost: 0 };
      }
      return {
        allowed: true,
        requiresCredits: true,
        creditCost: CREDIT_COSTS.ai_mentor_extra,
        reason: 'mentor_quota_exhausted',
      };
    }
    case 'rival_basic': {
      if (!isPaid) {
        if (snapshot.remaining.basicRivalBattles > 0) {
          return { allowed: true, requiresCredits: false, creditCost: 0 };
        }
        return {
          allowed: true,
          requiresCredits: true,
          creditCost: CREDIT_COSTS.ai_rival_extra_basic,
          reason: 'free_rival_quota_exhausted',
        };
      }
      return { allowed: true, requiresCredits: false, creditCost: 0 };
    }
    case 'rival_premium': {
      if (!isPaid) {
        return { allowed: false, planRequired: true, reason: 'premium_rival_paid_only' };
      }
      if (snapshot.remaining.premiumRivalBattles > 0) {
        return { allowed: true, requiresCredits: false, creditCost: 0 };
      }
      return {
        allowed: true,
        requiresCredits: true,
        creditCost: CREDIT_COSTS.ai_rival_extra_premium,
        reason: 'premium_rival_quota_exhausted',
      };
    }
    case 'rival_college':
      return {
        allowed: isPaid,
        planRequired: !isPaid,
        requiresCredits: true,
        creditCost: CREDIT_COSTS.ai_rival_college,
      };
    case 'rival_boss':
      return {
        allowed: isPaid,
        planRequired: !isPaid,
        requiresCredits: true,
        creditCost: CREDIT_COSTS.ai_rival_boss,
      };
    case 'rival_weakness':
      return {
        allowed: isPaid,
        planRequired: !isPaid,
        requiresCredits: true,
        creditCost: CREDIT_COSTS.ai_rival_weakness,
      };
    case 'trap_drill':
      return {
        allowed: isPaid,
        planRequired: !isPaid,
        requiresCredits: true,
        creditCost: CREDIT_COSTS.trap_drill,
      };
    case 'mock_autopsy':
      return {
        allowed: isPaid,
        planRequired: !isPaid,
        requiresCredits: true,
        creditCost: CREDIT_COSTS.mock_autopsy,
      };
    case 'custom_mock_plan':
      return {
        allowed: isPaid,
        planRequired: !isPaid,
        requiresCredits: true,
        creditCost: CREDIT_COSTS.custom_mock_plan,
      };
    default:
      return { allowed: false, reason: 'unknown_action' };
  }
}
