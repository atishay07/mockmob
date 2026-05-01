import 'server-only';
import { Database } from '@/../data/db';
import { supabaseAdmin } from '@/lib/supabase';
import { buildAdmissionCompass } from '@/lib/admissionCompass';
import { getUsageSnapshot } from '@/services/usage/getDailyUsage';

/**
 * Build a compact context object for the AI Mentor.
 *
 * Goals:
 *  - Never send raw attempt history (cost + privacy).
 *  - Tolerate missing tables/fields (free users, new accounts).
 *  - Compute deterministic facts so the model only does *recommendation*.
 *
 * Returns a JSON-safe object. Never throws — always returns at least
 * { userId, displayName, exam, isPaid, ... } with safe defaults.
 */
export async function getStudentAIContext({ user, options = {} } = {}) {
  const userId = user?.id;
  if (!userId) {
    return safeEmptyContext({ reason: 'no_user' });
  }

  const dbUser = await Database.getUserById(userId).catch(() => null);
  const effectiveUser = dbUser || user;
  const isPaid =
    effectiveUser?.subscriptionStatus === 'active' ||
    effectiveUser?.isPremium === true;

  // Pull data in parallel; each branch swallows its own errors.
  const [
    attempts,
    progressRows,
    bookmarkRows,
    voteRows,
    usageSnapshot,
    targetRows,
  ] = await Promise.all([
    Database.getAttempts(userId).catch(() => []),
    safeSelect('user_question_progress', userId),
    safeSelect('question_bookmarks', userId),
    safeSelect('question_votes', userId, 100),
    getUsageSnapshot(effectiveUser).catch(() => null),
    // TODO: replace with real targets table once /admission-compass writes one.
    Promise.resolve([]),
  ]);

  const recentMockSummary = summarizeAttempts(attempts.slice(0, 5));
  const lastMockSummary = summarizeAttempt(attempts[0]);
  const weaknessSummary = summarizeWeakness(progressRows);
  const mistakeDNA = computeMistakeDNA({ attempts, progressRows });
  const timeBehavior = computeTimeBehavior({ attempts, progressRows });
  const savedQuestionSummary = summarizeBookmarks(bookmarkRows);
  const skippedQuestionSummary = summarizeSkipped(progressRows);

  let admissionCompassSummary = null;
  try {
    const compass = buildAdmissionCompass({
      user: effectiveUser,
      subjects: [],
      attempts,
      category: 'general',
    });
    admissionCompassSummary = {
      eligible: compass.eligible,
      readiness: compass.readiness,
      estimatedScore: compass.estimatedScore,
      scoreBand: compass.scoreBand?.label || null,
      topRecommendations: (compass.recommendations || []).slice(0, 3).map((r) => ({
        college: r.short,
        course: r.course,
        target: r.target,
        scoreGap: r.scoreGap,
        chance: r.chance?.label || null,
        subjectFit: r.subjectFit,
      })),
      improvementMoves: (compass.improvementMoves || []).slice(0, 3),
    };
  } catch (err) {
    admissionCompassSummary = { error: 'compass_unavailable' };
  }

  const recommendedDeterministicActions = buildDeterministicRecommendations({
    isPaid,
    recentMockSummary,
    weaknessSummary,
    mistakeDNA,
    admissionCompassSummary,
  });

  return {
    userId,
    displayName: effectiveUser?.name || 'Student',
    planType: isPaid ? 'paid' : 'free',
    isPaid,
    exam: 'CUET',
    selectedSubjects: Array.isArray(effectiveUser?.subjects) ? effectiveUser.subjects : [],

    // TODO: persist DU target on user profile; surface here when available.
    targetCourses: targetRows.targetCourses || [],
    targetColleges: targetRows.targetColleges || [],

    recentMockSummary,
    lastMockSummary,
    weaknessSummary,
    mistakeDNA,
    timeBehavior,
    savedQuestionSummary,
    skippedQuestionSummary,
    admissionCompassSummary,
    revisionPriority: buildRevisionPriority({ weaknessSummary, savedQuestionSummary, skippedQuestionSummary }),
    recommendedDeterministicActions,

    creditBalance: effectiveUser?.creditBalance ?? 0,
    dailyUsage: usageSnapshot?.used || { aiMentorMessages: 0, basicRivalBattles: 0, premiumRivalBattles: 0 },
    limits: usageSnapshot?.limits || null,
    contextVersion: 1,
    generatedAt: Date.now(),
    ...(options.includeRaw ? { _raw: { attemptCount: attempts.length, progressCount: progressRows.length } } : {}),
  };
}

// ----- summarisers -----

function summarizeAttempts(attempts) {
  if (!attempts.length) {
    return { attemptCount: 0, avgScore: null, avgAccuracy: null, recentSubjects: [] };
  }
  const totals = attempts.reduce(
    (acc, a) => {
      const correct = a.correct || 0;
      const wrong = a.wrong || 0;
      const answered = correct + wrong;
      acc.score += a.score || 0;
      acc.accuracy += answered ? (correct / answered) * 100 : 0;
      acc.subjects.add(a.subject);
      return acc;
    },
    { score: 0, accuracy: 0, subjects: new Set() },
  );
  return {
    attemptCount: attempts.length,
    avgScore: Math.round(totals.score / attempts.length),
    avgAccuracy: Math.round(totals.accuracy / attempts.length),
    recentSubjects: [...totals.subjects].slice(0, 5),
    bestScore: Math.max(...attempts.map((a) => a.score || 0)),
    worstScore: Math.min(...attempts.map((a) => a.score || 0)),
  };
}

function summarizeAttempt(attempt) {
  if (!attempt) return null;
  const correct = attempt.correct || 0;
  const wrong = attempt.wrong || 0;
  const total = attempt.total || 0;
  const answered = correct + wrong;
  return {
    attemptId: attempt.id,
    subject: attempt.subject,
    score: attempt.score || 0,
    correct,
    wrong,
    unattempted: attempt.unattempted || Math.max(0, total - answered),
    total,
    accuracy: answered ? Math.round((correct / answered) * 100) : 0,
    completedAt: attempt.completedAt,
    ageHours: attempt.completedAt ? Math.max(0, Math.round((Date.now() - attempt.completedAt) / 3_600_000)) : null,
  };
}

function summarizeWeakness(progressRows) {
  if (!progressRows.length) {
    return { weakChapters: [], strongChapters: [], coverage: 0 };
  }
  const byChapter = new Map();
  for (const row of progressRows) {
    const key = `${row.subject}::${row.chapter || 'unspecified'}`;
    const entry = byChapter.get(key) || {
      subject: row.subject,
      chapter: row.chapter || 'unspecified',
      attempt: 0,
      correct: 0,
      skip: 0,
    };
    entry.attempt += row.attempt_count || 0;
    entry.correct += row.correct_count || 0;
    entry.skip += row.skip_count || 0;
    byChapter.set(key, entry);
  }
  const list = [...byChapter.values()]
    .filter((e) => e.attempt >= 3)
    .map((e) => ({
      subject: e.subject,
      chapter: e.chapter,
      accuracy: Math.round((e.correct / e.attempt) * 100),
      attempts: e.attempt,
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  return {
    weakChapters: list.filter((e) => e.accuracy < 60).slice(0, 6),
    strongChapters: list.filter((e) => e.accuracy >= 80).slice(0, 4),
    coverage: byChapter.size,
  };
}

function computeMistakeDNA({ attempts, progressRows }) {
  // Best-effort categorisation. Each axis returns a 0-100 score + confidence.
  const totalAttempts = attempts.reduce((sum, a) => sum + (a.total || 0), 0);
  const wrongTotal = attempts.reduce((sum, a) => sum + (a.wrong || 0), 0);
  const unattemptedTotal = attempts.reduce((sum, a) => sum + (a.unattempted || 0), 0);

  const wrongRatio = totalAttempts ? wrongTotal / totalAttempts : 0;
  const skipRatio = totalAttempts ? unattemptedTotal / totalAttempts : 0;

  const fastWrong = countFastWrong(progressRows);
  const slowOverall = computeSlowness(progressRows);
  const repeatedWrong = countRepeatedWrong(progressRows);
  const dataPoints = attempts.length + Math.min(progressRows.length, 100);

  const conf = (n) => (n >= 25 ? 'high' : n >= 8 ? 'medium' : 'low');

  return {
    conceptErrors: { score: clamp(Math.round(wrongRatio * 100), 0, 100), confidence: conf(dataPoints) },
    trapErrors: { score: clamp(Math.round(fastWrong * 100), 0, 100), confidence: conf(progressRows.length) },
    timePressureErrors: { score: clamp(Math.round(skipRatio * 100), 0, 100), confidence: conf(attempts.length) },
    carelessErrors: { score: clamp(Math.round(fastWrong * 60), 0, 100), confidence: conf(progressRows.length) },
    revisionDecayErrors: { score: clamp(Math.round(repeatedWrong * 100), 0, 100), confidence: conf(progressRows.length) },
    guessingErrors: { score: clamp(Math.round((wrongRatio - skipRatio) * 80), 0, 100), confidence: conf(attempts.length) },
    _meta: { dataPoints, slowness: slowOverall },
  };
}

function countFastWrong(rows) {
  // Rows where dwell is short but accuracy poor → likely traps/careless.
  let fastWrong = 0;
  let total = 0;
  for (const r of rows) {
    if (!r.attempt_count || !r.best_dwell_ms) continue;
    total += 1;
    const accuracy = r.correct_count / r.attempt_count;
    if (r.best_dwell_ms < 25_000 && accuracy < 0.5) fastWrong += 1;
  }
  return total ? fastWrong / total : 0;
}

function computeSlowness(rows) {
  const dwells = rows.map((r) => Number(r.best_dwell_ms)).filter((v) => Number.isFinite(v) && v > 0);
  if (!dwells.length) return null;
  return Math.round(dwells.reduce((s, v) => s + v, 0) / dwells.length);
}

function countRepeatedWrong(rows) {
  let repeated = 0;
  let total = 0;
  for (const r of rows) {
    if (!r.attempt_count || r.attempt_count < 2) continue;
    total += 1;
    const accuracy = r.correct_count / r.attempt_count;
    if (accuracy < 0.5) repeated += 1;
  }
  return total ? repeated / total : 0;
}

function computeTimeBehavior({ attempts, progressRows }) {
  const slowness = computeSlowness(progressRows);
  const totalUnattempted = attempts.reduce((s, a) => s + (a.unattempted || 0), 0);
  const totalQuestions = attempts.reduce((s, a) => s + (a.total || 0), 0);
  return {
    avgDwellMs: slowness,
    unattemptedRate: totalQuestions ? Math.round((totalUnattempted / totalQuestions) * 100) : null,
    pace: slowness == null ? 'unknown' : slowness < 35_000 ? 'fast' : slowness < 70_000 ? 'balanced' : 'slow',
  };
}

function summarizeBookmarks(rows) {
  return { count: rows.length, latest: rows[0]?.created_at || null };
}

function summarizeSkipped(rows) {
  const skipped = rows.filter((r) => (r.skip_count || 0) > 0);
  const bySubject = new Map();
  for (const r of skipped) {
    bySubject.set(r.subject, (bySubject.get(r.subject) || 0) + (r.skip_count || 0));
  }
  return {
    totalSkips: skipped.reduce((s, r) => s + (r.skip_count || 0), 0),
    questionsSkipped: skipped.length,
    topSubjects: [...bySubject.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([subject, count]) => ({ subject, count })),
  };
}

function buildRevisionPriority({ weaknessSummary, savedQuestionSummary, skippedQuestionSummary }) {
  const items = [];
  for (const w of weaknessSummary.weakChapters.slice(0, 3)) {
    items.push({ kind: 'weak_chapter', subject: w.subject, chapter: w.chapter, accuracy: w.accuracy });
  }
  if (savedQuestionSummary.count > 0) {
    items.push({ kind: 'saved_questions', count: savedQuestionSummary.count });
  }
  if (skippedQuestionSummary.questionsSkipped > 0) {
    items.push({ kind: 'skipped_questions', count: skippedQuestionSummary.questionsSkipped });
  }
  return items;
}

function buildDeterministicRecommendations({
  isPaid,
  recentMockSummary,
  weaknessSummary,
  mistakeDNA,
  admissionCompassSummary,
}) {
  const recs = [];
  if (recentMockSummary.attemptCount === 0) {
    recs.push({ kind: 'take_diagnostic_mock', priority: 'high' });
    return recs;
  }
  if (mistakeDNA.timePressureErrors.score > 35) {
    recs.push({ kind: 'speed_drill', priority: 'high', reason: 'time_pressure_high' });
  }
  if (mistakeDNA.trapErrors.score > 35) {
    recs.push({ kind: 'trap_drill', priority: 'high', reason: 'trap_errors_high' });
  }
  if (weaknessSummary.weakChapters.length > 0) {
    recs.push({
      kind: 'targeted_revision',
      priority: 'medium',
      target: weaknessSummary.weakChapters[0],
    });
  }
  if (admissionCompassSummary?.estimatedScore && admissionCompassSummary.estimatedScore < 600) {
    recs.push({ kind: 'broaden_coverage', priority: 'medium' });
  }
  if (!isPaid) {
    recs.push({ kind: 'upgrade_for_full_diagnostics', priority: 'low' });
  }
  return recs;
}

// ----- helpers -----

async function safeSelect(table, userId, limit = 500) {
  try {
    let q = supabaseAdmin().from(table).select('*').eq('user_id', userId);
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function safeEmptyContext({ reason }) {
  return {
    userId: null,
    displayName: 'Student',
    planType: 'free',
    isPaid: false,
    exam: 'CUET',
    selectedSubjects: [],
    targetCourses: [],
    targetColleges: [],
    recentMockSummary: { attemptCount: 0 },
    lastMockSummary: null,
    weaknessSummary: { weakChapters: [], strongChapters: [], coverage: 0 },
    mistakeDNA: null,
    timeBehavior: { pace: 'unknown' },
    savedQuestionSummary: { count: 0 },
    skippedQuestionSummary: { totalSkips: 0, questionsSkipped: 0, topSubjects: [] },
    admissionCompassSummary: null,
    revisionPriority: [],
    recommendedDeterministicActions: [],
    creditBalance: 0,
    dailyUsage: { aiMentorMessages: 0, basicRivalBattles: 0, premiumRivalBattles: 0 },
    limits: null,
    contextVersion: 1,
    generatedAt: Date.now(),
    _empty: true,
    _reason: reason,
  };
}
