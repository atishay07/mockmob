/**
 * AI Rival profiles — single source of truth for archetypes.
 *
 * Tier semantics:
 *   tier === 'basic'   → covered by free 1/day or paid unlimited
 *   tier === 'premium' → covered by paid 2/day or paid + credits
 *   tier === 'credit'  → always costs credits even for paid users
 */

export const RIVAL_PROFILES = {
  NORTH_CAMPUS_RIVAL: {
    name: 'North Campus Rival',
    archetype: 'all-rounder',
    description: 'A balanced North Campus aspirant. Steady accuracy, no flashy tricks. Beat them and you are on track.',
    freeAllowed: true,
    paidAllowed: true,
    tier: 'basic',
    creditCost: 0,
    targetAccuracy: 0.78,
    avgTimePerQuestion: 55,
    strength: 'consistency across subjects',
    weakness: 'rarely takes risks on hard traps',
    difficultyMultiplier: 1.0,
    introStyle: 'measured, slightly cocky',
    accent: '#a3e635',
  },
  HANSRAJ_LEVEL: {
    name: 'Hansraj-Level Rival',
    archetype: 'elite-academic',
    description: 'A Hansraj-tier student. Sharp on conceptual questions, will punish weak Macroeconomics or Polity foundations.',
    freeAllowed: false,
    paidAllowed: true,
    tier: 'credit',
    creditCost: 2,
    targetAccuracy: 0.86,
    avgTimePerQuestion: 50,
    strength: 'concept depth',
    weakness: 'occasionally slow on quant',
    difficultyMultiplier: 1.18,
    introStyle: 'austere, top-of-class energy',
    accent: '#fbbf24',
  },
  SRCC_DREAM: {
    name: 'SRCC Dream Rival',
    archetype: 'commerce-precision',
    description: 'An SRCC B.Com aspirant. Near-perfect Accountancy and Business Studies. You need elite speed + accuracy to win.',
    freeAllowed: false,
    paidAllowed: true,
    tier: 'credit',
    creditCost: 2,
    targetAccuracy: 0.9,
    avgTimePerQuestion: 48,
    strength: 'commerce execution',
    weakness: 'humanities subjects',
    difficultyMultiplier: 1.22,
    introStyle: 'crisp, no-nonsense',
    accent: '#f472b6',
  },
  SPEED_DEMON: {
    name: 'Speed Demon',
    archetype: 'velocity',
    description: 'Trades a little accuracy for speed. Will finish before you. Beat them by attempting more without breaking.',
    freeAllowed: false,
    paidAllowed: true,
    tier: 'basic',
    creditCost: 0,
    targetAccuracy: 0.7,
    avgTimePerQuestion: 32,
    strength: 'pace under pressure',
    weakness: 'silly errors on traps',
    difficultyMultiplier: 0.95,
    introStyle: 'restless, rapid-fire',
    accent: '#22d3ee',
  },
  ACCURACY_MONSTER: {
    name: 'Accuracy Monster',
    archetype: 'precision',
    description: 'Slow but lethal. Accuracy near 92%. Beat them on volume, not on per-question hits.',
    freeAllowed: false,
    paidAllowed: true,
    tier: 'basic',
    creditCost: 0,
    targetAccuracy: 0.92,
    avgTimePerQuestion: 78,
    strength: 'never picks a wrong answer when sure',
    weakness: 'leaves questions unattempted',
    difficultyMultiplier: 1.05,
    introStyle: 'calm, surgical',
    accent: '#c084fc',
  },
  COMEBACK_RIVAL: {
    name: 'Comeback Rival',
    archetype: 'rubber-band',
    description: 'Starts behind, ends ahead. They get stronger every battle. Do not get complacent.',
    freeAllowed: false,
    paidAllowed: true,
    tier: 'basic',
    creditCost: 0,
    targetAccuracy: 0.74,
    avgTimePerQuestion: 58,
    strength: 'late-test focus',
    weakness: 'first 5 questions',
    difficultyMultiplier: 1.0,
    introStyle: 'patient, taunting',
    accent: '#34d399',
  },
  WEAKNESS_RIVAL: {
    name: 'Weakness Rival',
    archetype: 'targeted',
    description: 'Built specifically against your weakest chapters. The closer the battle, the more you have grown.',
    freeAllowed: false,
    paidAllowed: true,
    tier: 'credit',
    creditCost: 1,
    targetAccuracy: 0.82,
    avgTimePerQuestion: 52,
    strength: 'your specific weak topics',
    weakness: 'your strongest area',
    difficultyMultiplier: 1.12,
    introStyle: 'analytical, direct',
    accent: '#f87171',
  },
  BOSS_RIVAL: {
    name: 'Boss Rival',
    archetype: 'final-form',
    description: 'A composite top-1% rival. High accuracy, strong pace, no weaknesses. Survive the round, and you are CUET-ready.',
    freeAllowed: false,
    paidAllowed: true,
    tier: 'credit',
    creditCost: 3,
    targetAccuracy: 0.93,
    avgTimePerQuestion: 46,
    strength: 'every dimension',
    weakness: 'none',
    difficultyMultiplier: 1.3,
    introStyle: 'imposing, final-boss',
    accent: '#facc15',
  },
};

export function getRivalProfile(rivalType) {
  return RIVAL_PROFILES[rivalType] || null;
}

export function listRivalProfiles() {
  return Object.entries(RIVAL_PROFILES).map(([id, profile]) => ({ id, ...profile }));
}

const BASIC_RIVALS = new Set(['NORTH_CAMPUS_RIVAL', 'SPEED_DEMON', 'ACCURACY_MONSTER', 'COMEBACK_RIVAL']);
const PREMIUM_RIVALS = new Set(['HANSRAJ_LEVEL', 'SRCC_DREAM', 'WEAKNESS_RIVAL', 'BOSS_RIVAL']);

/**
 * Quota slot a rival type counts against.
 *   'rival_basic'   → covered by free 1/day (only NORTH for free users) or paid unlimited.
 *   'rival_premium' → covered by paid 2/day premium quota; credits beyond.
 */
export function quotaSlotFor(rivalType) {
  if (BASIC_RIVALS.has(rivalType)) return 'rival_basic';
  if (PREMIUM_RIVALS.has(rivalType)) return 'rival_premium';
  return null;
}

export function isBasicRival(rivalType) {
  return BASIC_RIVALS.has(rivalType);
}

export function isPremiumRival(rivalType) {
  return PREMIUM_RIVALS.has(rivalType);
}

/**
 * Free users can only run NORTH_CAMPUS_RIVAL once a day.
 * Paid users get all basic rivals unlimited + 2/day premium quota.
 * After premium quota is exhausted, per-profile creditCost applies.
 */
export function rivalAccessRule({ rivalType, isPaid, basicQuotaRemaining, premiumQuotaRemaining }) {
  const profile = RIVAL_PROFILES[rivalType];
  if (!profile) return { allowed: false, reason: 'unknown_rival' };

  if (BASIC_RIVALS.has(rivalType)) {
    if (!isPaid) {
      if (rivalType !== 'NORTH_CAMPUS_RIVAL') {
        return { allowed: false, planRequired: true, reason: 'basic_rival_paid_only' };
      }
      if (basicQuotaRemaining <= 0) {
        return { allowed: false, reason: 'free_daily_rival_used', upgradeHint: true };
      }
      return { allowed: true, requiresCredits: false, creditCost: 0 };
    }
    // paid: unlimited basic
    return { allowed: true, requiresCredits: false, creditCost: 0 };
  }

  if (PREMIUM_RIVALS.has(rivalType)) {
    if (!isPaid) return { allowed: false, planRequired: true, reason: 'premium_rival_paid_only' };
    if (premiumQuotaRemaining > 0) {
      return { allowed: true, requiresCredits: false, creditCost: 0 };
    }
    return {
      allowed: true,
      requiresCredits: true,
      creditCost: profile.creditCost || 1,
      reason: 'premium_quota_exhausted_credits_required',
    };
  }

  return { allowed: false, reason: 'unmapped_rival' };
}
