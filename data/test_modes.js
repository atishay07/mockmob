// Single source of truth for mock-test modes.
// Imported by the API (selection logic + credits), the dashboard launcher (UI),
// and the test runner (duration). Do not duplicate these constants elsewhere.

export const TEST_MODES = {
  quick: {
    id: 'quick',
    label: 'Quick practice',
    blurb: 'Fast revision with flexible question counts.',
    badge: 'Free',
    premium: false,
    // Quick practice costs 1 practice credit a question (owner, 18 Oct, D65): 5 questions = 5, 10 = 10, 15 = 15, 20 = 20.
    // The price of a set comes from practiceCreditCost(); there is no flat creditCost. The database knows the per-count
    // actions attempt_5 / attempt_10 / attempt_15 / attempt_20 (supabase/migrations/20261018170000_...); the old flat
    // 'attempt' action (10) stays in the database for old callers and old app builds.
    creditPerQuestion: 1,
    countOptions: [5, 10, 15, 20],
    defaultCount: 10,
    durationPerQuestionSec: 60,        // ~60s/Q
    difficulty: { easy: 0.40, medium: 0.40, hard: 0.20 },
    allowDifficultyOverride: true,
    allowChapters: true,               // the only mode a student may narrow to chapters (START-1017 4.3)
    useWeakTopics: false,
    recencyLimit: 3,
    maxPerConcept: 2,
  },
  smart: {
    id: 'smart',
    label: 'Smart practice',
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
    label: 'Full mock',
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
    label: 'NTA mode',
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

// The fine-tune scope (START-1017 section 4.3, owner F9): what a student may set for each mode.
//   Quick practice: chapters and difficulty.  Full mock: difficulty only (it covers every chapter, like the exam).
//   Smart practice and NTA mode: nothing (we choose).  Clients show only these; the server refuses the rest.
export function fineTuneScope(id) {
  const mode = TEST_MODES[id];
  return { chapters: mode?.allowChapters === true, difficulty: mode?.allowDifficultyOverride === true };
}

// The refusal for a start that asks for what its mode does not allow, or null. `chapters` is a list
// (or a count); `difficulty` a level ('' or null for the mode's own mix).
export function fineTuneViolation(id, { chapters = [], difficulty = '' } = {}) {
  const scope = fineTuneScope(id);
  const asked = Array.isArray(chapters) ? chapters.filter(Boolean).length : Number(chapters) || 0;
  if (asked > 0 && !scope.chapters) return 'CHAPTERS_NOT_ALLOWED';
  if (difficulty && !scope.difficulty) return 'DIFFICULTY_NOT_ALLOWED';
  return null;
}

// What a Free student pays for a paper, in practice credits: 1 a question for Quick practice, the fixed price for a Full
// mock, nothing for the Pro modes. null for an unknown mode or a Quick count outside 5 / 10 / 15 / 20 (the server refuses it).
// This is the list price: a free allowance (today's included 10-question set, a first set in a subject) is taken off by the
// caller, and Pro pays nothing whatever this says.
export function practiceCreditCost(modeId, count) {
  const mode = TEST_MODES[modeId];
  if (!mode) return null;
  if (mode.premium) return 0;
  if (mode.creditPerQuestion) {
    const n = Number(count);
    return Number.isInteger(n) && mode.countOptions.includes(n) ? n * mode.creditPerQuestion : null;
  }
  return Number(mode.creditCost) || 0;
}

// The database spend action that charges practiceCreditCost(): 'attempt_<count>' for Quick practice, 'attempt_full' for
// a Full mock, null when nothing is spent (Pro modes) or the count is not one of the options.
export function practiceCreditAction(modeId, count) {
  const mode = TEST_MODES[modeId];
  if (!mode || mode.premium) return null;
  if (mode.creditPerQuestion) return practiceCreditCost(modeId, count) === null ? null : `attempt_${Number(count)}`;
  return mode.creditAction || null;
}

// The Quick practice actions the database prices per question (one place for db.js, the tests and the migration check).
export const PER_QUESTION_ACTIONS = Object.freeze(TEST_MODES.quick.countOptions.map((n) => `attempt_${n}`));

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
//   1. fixedDurationSec wins (Full mock, NTA mode)
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
