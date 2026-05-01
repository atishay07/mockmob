// Single source of truth for mock-test modes.
// Imported by the API (selection logic + credits), the dashboard launcher (UI),
// and the test runner (duration). Do not duplicate these constants elsewhere.

export const TEST_MODES = {
  quick: {
    id: 'quick',
    label: 'Quick Practice',
    blurb: 'Fast revision with flexible question counts.',
    badge: 'Free',
    premium: false,
    creditCost: 10,
    creditAction: 'attempt',           // RPC action key
    countOptions: [5, 10, 15, 20],
    defaultCount: 10,
    durationPerQuestionSec: 60,        // ~60s/Q
    difficulty: { easy: 0.40, medium: 0.40, hard: 0.20 },
    allowDifficultyOverride: true,
    useWeakTopics: false,
    recencyLimit: 3,
    maxPerConcept: 2,
  },
  smart: {
    id: 'smart',
    label: 'Smart Practice',
    blurb: 'Adaptive practice that targets your weak topics.',
    badge: 'Premium',
    premium: true,
    creditCost: 0,
    creditAction: null,                // premium — no spend
    countOptions: [10, 15, 20],
    defaultCount: 15,
    // Adaptive timing: total duration = sum of per-difficulty seconds across the
    // returned question set. Overrides durationPerQuestionSec when present.
    adaptiveDurationByDifficulty: { easy: 45, medium: 60, hard: 90 },
    durationPerQuestionSec: 60,        // fallback if questions lack difficulty
    difficulty: { easy: 0.30, medium: 0.50, hard: 0.20 },
    allowDifficultyOverride: false,
    useWeakTopics: true,
    weakAccuracyThreshold: 0.6,
    recencyLimit: 5,
    maxPerConcept: 2,
  },
  full: {
    id: 'full',
    label: 'Full Mock',
    blurb: 'Balanced full-length test — 50 questions, 60 minutes.',
    badge: 'Most Popular',
    premium: false,
    creditCost: 50,
    creditAction: 'attempt_full',      // new RPC action key
    fixedCount: 50,
    fixedDurationSec: 60 * 60,         // 60 minutes, no override
    difficulty: { easy: 0.40, medium: 0.40, hard: 0.20 },
    allowDifficultyOverride: true,
    useWeakTopics: false,
    recencyLimit: 5,
    maxPerConcept: 2,
  },
  nta: {
    id: 'nta',
    label: 'NTA Mode',
    blurb: 'Strict CUET exam simulation — 50 questions, 60 minutes.',
    badge: 'Premium',
    premium: true,
    creditCost: 0,
    creditAction: null,
    fixedCount: 50,
    fixedDurationSec: 60 * 60,         // 60 minutes (corrected from 45)
    difficulty: { easy: 0.30, medium: 0.45, hard: 0.25 },
    allowDifficultyOverride: false,
    useWeakTopics: false,
    recencyLimit: 8,
    maxPerConcept: 2,
    preferAnchor: true,                // Ranking signal only; missing metadata must not block NTA mocks.
  },
};

export const MODE_IDS = Object.keys(TEST_MODES);

export function getMode(id) {
  return TEST_MODES[id] || TEST_MODES.quick;
}

export function isValidModeId(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(TEST_MODES, id);
}

export function defaultModeFor(isPremium) {
  return isPremium ? 'smart' : 'quick';
}

// Resolve the count for a given mode. Fixed-count modes ignore caller input.
export function resolveCount(mode, requested) {
  if (mode.fixedCount) return mode.fixedCount;
  const list = mode.countOptions || [];
  const fallback = mode.defaultCount || list[0] || 10;
  const n = Number(requested);
  if (!Number.isFinite(n)) return fallback;
  return list.includes(n) ? n : fallback;
}

// Resolve total test duration in seconds.
//   1. fixedDurationSec wins (Full Mock, NTA Mode)
//   2. adaptiveDurationByDifficulty sums per-question seconds (Smart)
//   3. otherwise count * durationPerQuestionSec (Quick + fallback)
//
// `questions` is the actual question set returned from the API. When called
// before generation (e.g. on the dashboard preview), pass an empty array and
// the function falls back to count * durationPerQuestionSec.
export function resolveDurationSec(mode, countOrQuestions) {
  if (mode.fixedDurationSec) return mode.fixedDurationSec;

  const isQuestionList = Array.isArray(countOrQuestions);
  const questions = isQuestionList ? countOrQuestions : [];
  const count = isQuestionList ? questions.length : Math.max(1, Number(countOrQuestions) || 0);

  if (mode.adaptiveDurationByDifficulty && questions.length > 0) {
    const map = mode.adaptiveDurationByDifficulty;
    const fallback = mode.durationPerQuestionSec || 60;
    let total = 0;
    for (const q of questions) {
      const d = ['easy', 'medium', 'hard'].includes(q?.difficulty) ? q.difficulty : 'medium';
      total += map[d] ?? fallback;
    }
    return total;
  }

  return count * (mode.durationPerQuestionSec || 60);
}

// Compute integer per-difficulty targets that sum exactly to count.
export function computeDifficultyTargets(count, weights) {
  if (count <= 0) return { easy: 0, medium: 0, hard: 0 };
  const target = {
    easy: Math.round(count * (weights.easy || 0)),
    medium: Math.round(count * (weights.medium || 0)),
    hard: Math.round(count * (weights.hard || 0)),
  };
  let diff = count - (target.easy + target.medium + target.hard);
  const order = ['medium', 'easy', 'hard'];
  while (diff !== 0) {
    for (const key of order) {
      if (diff === 0) break;
      if (diff > 0) { target[key]++; diff--; }
      else if (target[key] > 0) { target[key]--; diff++; }
    }
  }
  return target;
}
