import 'server-only';
import { Database } from '@/../data/db';
import { supabaseAdmin } from '@/lib/supabase';
import { buildAdmissionCompass } from '@/lib/admissionCompass';
import { learningRecord } from '@/lib/server/learning';
import { getUsageSnapshot } from '@/services/usage/getDailyUsage';
import { ONE_BALANCE_NOTE, oneBalanceForModel } from './creditsForModel.js';
import { readStanding } from '@/services/mobi/standing';
import { standingForModel } from '@/../data/mobi_standing';
import { shownName } from '@/lib/displayName.mjs';
import { openAttemptsOnly } from '@/lib/server/answerHold';

/**
 * Build a compact context object for the AI Mentor.
 *
 * Goals:
 *  - Never send raw attempt history (cost + privacy).
 *  - Tolerate missing tables/fields (free users, new accounts).
 *  - Compute deterministic facts so the model only does *recommendation*.
 *
 * Returns a JSON-safe object. Never throws; always returns at least
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

  // One read of the attempts for the whole context: the shared plan below reads the same ones, and so does the caller's own record
  // read when it passes its memo (Ask Mobi's chat route, which has already read them for the free answers).
  const attemptsMemo = options.memo instanceof Map ? options.memo : new Map();
  // Pull data in parallel; each branch swallows its own errors.
  const [
    attempts,
    progressRows,
    bookmarkRows,
    usageSnapshot,
  ] = await Promise.all([
    // A Mob paper still open for the Mob is not in the model's context until it closes (src/lib/mob/paperHold.mjs).
    // 'insights_strict' (egress, 20 Oct 2026): every summary below reads marks, counts, subject and time, the standing reads each
    // question's chapter and difficulty, and the plan its concept; nothing reads a stem, an option or an answer key, so the database
    // sends about a tenth of each row (a student's whole history was 525 KB for 15 papers; a chatty tester was the largest reader).
    Database.getAttempts(userId, { memo: attemptsMemo, slim: 'insights_strict' }).then((rows) => openAttemptsOnly(rows)).catch(() => []),
    // Only the columns the summaries below read (egress A12): progress counts and dwell, and the newest save's time. The votes read
    // that used to sit here was never used by anything, so it is gone.
    safeSelect('user_question_progress', userId, 500, PROGRESS_COLUMNS),
    safeSelect('question_bookmarks', userId, 500, 'created_at'),
    getUsageSnapshot(effectiveUser).catch(() => null),
  ]);
  // The student's own colleges (My colleges) with DU's 2026 Round 1 closing marks, and where their practice range stands
  // against them (data/mobi_standing.js, the same read as "Where you stand"). Arithmetic on the record, never a prediction.
  // The newest 60 papers, as the standing route reads. A failed read leaves both out; the rest of the context stands.
  const standing = await readStanding(userId, { attempts: attempts.slice(0, 60) }).catch(() => null);
  const standingView = standingForModel(standing);
  const { colleges: targetColleges = [], ...collegeStanding } = standingView || {};

  const recentMockSummary = summarizeAttempts(attempts.slice(0, 5));
  const lastMockSummary = summarizeAttempt(attempts[0]);
  const weaknessSummary = summarizeWeakness(progressRows);
  const mistakeDNA = computeMistakeDNA({ attempts, progressRows });
  const timeBehavior = computeTimeBehavior({ attempts, progressRows });
  const savedQuestionSummary = summarizeBookmarks(bookmarkRows);
  const skippedQuestionSummary = summarizeSkipped(progressRows);

  // The older Compass summary carries estimated scores and chance labels. Once the honest standing is there, it is left out,
  // so the model never quotes a chance beside the student's real cutoffs.
  let admissionCompassSummary = null;
  if (!standingView) {
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
  }

  const recommendedDeterministicActions = buildDeterministicRecommendations({
    isPaid,
    recentMockSummary,
    weaknessSummary,
    mistakeDNA,
    admissionCompassSummary,
  });
  const aiConfidence = buildAIConfidence({
    recentMockSummary,
    lastMockSummary,
    weaknessSummary,
    savedQuestionSummary,
    skippedQuestionSummary,
    admissionCompassSummary,
    selectedSubjects: effectiveUser?.subjects,
  });

  const sharedPlan = await learningRecord(userId, { memo: attemptsMemo }).catch(() => null);
  return {
    sharedPlan: sharedPlan ? {primary:sharedPlan.primary,alternatives:sharedPlan.alternatives,pathwayState:sharedPlan.pathwayState,...(sharedPlan.sequence ? {sequence:sharedPlan.sequence,study:sharedPlan.study} : {})} : null,
    userId,
    // A name the student gave, never the email's own prefix or a handle (src/lib/displayName.mjs): Mobi must not say it.
    displayName: shownName(effectiveUser?.name, effectiveUser?.email) || 'Student',
    planType: isPaid ? 'paid' : 'free',
    isPaid,
    exam: 'CUET',
    selectedSubjects: Array.isArray(effectiveUser?.subjects) ? effectiveUser.subjects : [],

    // My colleges, in the student's order: each with its 2026 Round 1 closing marks for the category used, where the practice
    // range sits against it and the marks short. collegeStanding is the range and the chapters that close the gap fastest.
    targetCourses: [...new Set(targetColleges.map((c) => c.programme).filter(Boolean))],
    targetColleges,
    collegeStanding: standingView ? collegeStanding : null,

    recentMockSummary,
    lastMockSummary,
    weaknessSummary,
    mistakeDNA,
    timeBehavior,
    savedQuestionSummary,
    skippedQuestionSummary,
    admissionCompassSummary,
    aiConfidence,
    revisionPriority: buildRevisionPriority({ weaknessSummary, savedQuestionSummary, skippedQuestionSummary }),
    recommendedDeterministicActions,

    // One credits balance (18 Oct 2026, D78): aiCredits.total is the student's ONE balance (free this month + bought +
    // held users.credit_balance). The held part is named inside it and is never sent as a separate figure, so the model
    // cannot add the two together and count held credits twice.
    aiCredits: oneBalanceForModel(usageSnapshot),
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

  const categories = {
    conceptErrors: { score: clamp(Math.round(wrongRatio * 100), 0, 100), confidence: conf(dataPoints) },
    trapErrors: { score: clamp(Math.round(fastWrong * 100), 0, 100), confidence: conf(progressRows.length) },
    timePressureErrors: { score: clamp(Math.round(skipRatio * 100), 0, 100), confidence: conf(attempts.length) },
    carelessErrors: { score: clamp(Math.round(fastWrong * 60), 0, 100), confidence: conf(progressRows.length) },
    revisionDecayErrors: { score: clamp(Math.round(repeatedWrong * 100), 0, 100), confidence: conf(progressRows.length) },
    guessingErrors: { score: clamp(Math.round(Math.max(0, wrongRatio - skipRatio) * 80), 0, 100), confidence: conf(attempts.length) },
  };
  const dominantPattern = Object.entries(categories)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 2)
    .map(([key, value]) => ({ key, score: value.score, confidence: value.confidence }));

  return {
    ...categories,
    dominantPattern,
    _meta: { dataPoints, slowness: slowOverall },
  };
}

function countFastWrong(rows) {
  // Rows where dwell is short but accuracy poor: likely traps/careless.
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

function buildAIConfidence({
  recentMockSummary,
  lastMockSummary,
  weaknessSummary,
  savedQuestionSummary,
  skippedQuestionSummary,
  admissionCompassSummary,
  selectedSubjects,
}) {
  const evidence = [];
  let score = 20;

  const attemptCount = recentMockSummary?.attemptCount || 0;
  if (attemptCount >= 5) {
    score += 30;
    evidence.push(`last ${attemptCount} attempts`);
  } else if (attemptCount >= 2) {
    score += 18;
    evidence.push(`${attemptCount} recent attempts`);
  } else if (attemptCount === 1) {
    score += 8;
    evidence.push('one recent attempt');
  } else {
    evidence.push('no mock attempt yet');
  }

  if (lastMockSummary?.ageHours != null) {
    if (lastMockSummary.ageHours <= 72) {
      score += 12;
      evidence.push('fresh mock data');
    } else if (lastMockSummary.ageHours <= 168) {
      score += 6;
      evidence.push('mock data from this week');
    }
  }

  if ((weaknessSummary?.weakChapters || []).length >= 2) {
    score += 14;
    evidence.push('repeated weak chapters');
  } else if ((weaknessSummary?.weakChapters || []).length === 1) {
    score += 8;
    evidence.push('one weak chapter signal');
  }

  if ((savedQuestionSummary?.count || 0) > 0) {
    score += 4;
    evidence.push('saved-question history');
  }
  if ((skippedQuestionSummary?.questionsSkipped || 0) > 0) {
    score += 5;
    evidence.push('skip pattern');
  }
  if (admissionCompassSummary?.estimatedScore) {
    score += 8;
    evidence.push('Compass score band');
  }
  if (Array.isArray(selectedSubjects) && selectedSubjects.length > 0) {
    score += 4;
    evidence.push('selected subjects');
  }

  const finalScore = clamp(score, 18, 92);
  return {
    score: finalScore,
    label: finalScore >= 70 ? 'high' : finalScore >= 45 ? 'medium' : 'low',
    evidence,
  };
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
    recs.push({ kind: 'mistake_replay', priority: 'high', reason: 'trap_errors_high' });
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

export const PROGRESS_COLUMNS = 'subject,chapter,attempt_count,correct_count,skip_count,best_dwell_ms';

async function safeSelect(table, userId, limit = 500, columns = '*') {
  try {
    let q = supabaseAdmin().from(table).select(columns).eq('user_id', userId);
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
    aiConfidence: { score: 18, label: 'low', evidence: ['missing user context'] },
    revisionPriority: [],
    recommendedDeterministicActions: [],
    aiCredits: { total: 0, includedRemaining: 0, bonusCredits: 0, heldCredits: 0, resetAt: null, note: ONE_BALANCE_NOTE },
    dailyUsage: { aiMentorMessages: 0, basicRivalBattles: 0, premiumRivalBattles: 0 },
    limits: null,
    contextVersion: 1,
    generatedAt: Date.now(),
    _empty: true,
    _reason: reason,
  };
}
