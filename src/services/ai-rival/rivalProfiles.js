/**
 * Shadow Benchmark profiles. Single source of truth for pressure-check settings.
 *
 * Product language stays plain: this is a timed benchmark, not a fantasy
 * opponent system.
 */

export const RIVAL_PROFILES = {
  NORTH_CAMPUS_RIVAL: {
    name: 'Daily Benchmark',
    archetype: 'daily benchmark',
    description: 'A short daily pressure check. Good for proving you can execute today without taking a full mock.',
    freeAllowed: true,
    paidAllowed: true,
    tier: 'basic',
    creditCost: 0,
    targetAccuracy: 0.78,
    avgTimePerQuestion: 55,
    strength: 'balanced score target',
    weakness: 'not personalized to weak chapters yet',
    difficultyMultiplier: 1.0,
    introStyle: 'clear and focused',
    accent: '#d2f000',
  },
  HANSRAJ_LEVEL: {
    name: 'College Benchmark',
    archetype: 'college benchmark',
    description: 'A higher benchmark for students preparing around competitive DU college targets.',
    freeAllowed: false,
    paidAllowed: true,
    tier: 'credit',
    creditCost: 2,
    targetAccuracy: 0.86,
    avgTimePerQuestion: 50,
    strength: 'concept depth',
    weakness: 'requires enough target data to be truly personal',
    difficultyMultiplier: 1.18,
    introStyle: 'direct and realistic',
    accent: '#eab308',
  },
  SRCC_DREAM: {
    name: 'DU Target Benchmark',
    archetype: 'dream college benchmark',
    description: 'A premium benchmark for your target college or course path. Use only after a few mocks.',
    freeAllowed: false,
    paidAllowed: true,
    tier: 'credit',
    creditCost: 2,
    targetAccuracy: 0.9,
    avgTimePerQuestion: 48,
    strength: 'high accuracy target',
    weakness: 'not useful without regular mock data',
    difficultyMultiplier: 1.22,
    introStyle: 'crisp and specific',
    accent: '#eab308',
  },
  SPEED_DEMON: {
    name: 'Speed Benchmark',
    archetype: 'pacing benchmark',
    description: 'Tests pacing. Useful when you know the material but lose marks by running out of time.',
    freeAllowed: false,
    paidAllowed: true,
    tier: 'basic',
    creditCost: 0,
    targetAccuracy: 0.7,
    avgTimePerQuestion: 32,
    strength: 'pace under pressure',
    weakness: 'accuracy can drop under traps',
    difficultyMultiplier: 0.95,
    introStyle: 'short and practical',
    accent: '#38bdf8',
  },
  ACCURACY_MONSTER: {
    name: 'Accuracy Benchmark',
    archetype: 'precision benchmark',
    description: 'Tests precision. Useful when careless errors are pulling down otherwise good attempts.',
    freeAllowed: false,
    paidAllowed: true,
    tier: 'basic',
    creditCost: 0,
    targetAccuracy: 0.92,
    avgTimePerQuestion: 78,
    strength: 'precision',
    weakness: 'slower pace',
    difficultyMultiplier: 1.05,
    introStyle: 'calm and exact',
    accent: '#a78bfa',
  },
  COMEBACK_RIVAL: {
    name: 'Recovery Benchmark',
    archetype: 'recovery benchmark',
    description: 'A basic benchmark for students trying to rebuild consistency after a poor mock.',
    freeAllowed: false,
    paidAllowed: true,
    tier: 'basic',
    creditCost: 0,
    targetAccuracy: 0.74,
    avgTimePerQuestion: 58,
    strength: 'balanced recovery target',
    weakness: 'less focused than Weakness Rival',
    difficultyMultiplier: 1.0,
    introStyle: 'steady and practical',
    accent: '#34d399',
  },
  WEAKNESS_RIVAL: {
    name: 'Weakness Benchmark',
    archetype: 'weakness benchmark',
    description: 'Targets weak chapters from your MockMob history. Use when Radar shows repeated leaks.',
    freeAllowed: false,
    paidAllowed: true,
    tier: 'credit',
    creditCost: 1,
    targetAccuracy: 0.82,
    avgTimePerQuestion: 52,
    strength: 'your weakest available topics',
    weakness: 'needs enough attempt history',
    difficultyMultiplier: 1.12,
    introStyle: 'analytical and direct',
    accent: '#f87171',
  },
  BOSS_RIVAL: {
    name: 'Composite Benchmark',
    archetype: 'hard composite benchmark',
    description: 'The hardest composite benchmark. Use after basic rivals feel too easy.',
    freeAllowed: false,
    paidAllowed: true,
    tier: 'credit',
    creditCost: 3,
    targetAccuracy: 0.93,
    avgTimePerQuestion: 46,
    strength: 'high pace and high accuracy',
    weakness: 'expensive if used too early',
    difficultyMultiplier: 1.3,
    introStyle: 'serious and concise',
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

export function rivalAccessRule({ rivalType, isPaid, basicQuotaRemaining }) {
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
    return { allowed: true, requiresCredits: false, creditCost: 0 };
  }

  if (PREMIUM_RIVALS.has(rivalType)) {
    if (!isPaid) return { allowed: false, planRequired: true, reason: 'premium_rival_paid_only' };
    return {
      allowed: true,
      requiresCredits: true,
      creditCost: profile.creditCost || 1,
      reason: 'premium_rival_credit_required',
    };
  }

  return { allowed: false, reason: 'unmapped_rival' };
}
