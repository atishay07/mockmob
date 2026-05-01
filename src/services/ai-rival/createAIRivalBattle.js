import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { Database } from '@/../data/db';
import { getRivalProfile, quotaSlotFor, rivalAccessRule } from './rivalProfiles';
import { getUsageSnapshot, planTierFor } from '@/services/usage/getDailyUsage';
import { checkAndConsumeCredits } from '@/services/credits/checkAndConsumeCredits';

/**
 * Algorithmically create an AI Rival battle session.
 *
 * Determinism note: question selection, rival benchmark, and difficulty
 * weighting are all computed server-side without any AI call. AI is used
 * later for intro/outro flavour text only (see /api/ai/rival/start).
 */
export async function createAIRivalBattle({
  user,
  rivalType,
  subjects,
  questionCount,
  timeLimitMinutes,
  difficultyTarget,
  targetCollege,
}) {
  const profile = getRivalProfile(rivalType);
  if (!profile) {
    return { ok: false, error: 'unknown_rival_type', status: 400 };
  }

  const isPaid = planTierFor(user) === 'paid';
  const snapshot = await getUsageSnapshot(user);

  const access = rivalAccessRule({
    rivalType,
    isPaid,
    basicQuotaRemaining:
      snapshot.remaining.basicRivalBattles === Infinity ? Infinity : snapshot.remaining.basicRivalBattles,
    premiumQuotaRemaining: snapshot.remaining.premiumRivalBattles,
  });

  if (!access.allowed) {
    return {
      ok: false,
      error: access.reason || 'rival_access_denied',
      planRequired: Boolean(access.planRequired),
      upgradeHint: Boolean(access.upgradeHint),
      status: access.planRequired ? 402 : 429,
    };
  }

  const normalizedSubjects = Array.isArray(subjects) && subjects.length
    ? subjects.slice(0, 5)
    : (Array.isArray(user.subjects) && user.subjects.length ? user.subjects.slice(0, 1) : []);

  if (!normalizedSubjects.length) {
    return { ok: false, error: 'no_subjects_configured', status: 400 };
  }

  const count = clampInt(questionCount, 5, 30, 10);
  const timeLimit = clampInt(timeLimitMinutes, 3, 60, Math.max(5, Math.round((count * profile.avgTimePerQuestion) / 60) + 2));

  // Pick questions algorithmically (no AI).
  const questions = await selectRivalQuestions({
    userId: user.id,
    subjects: normalizedSubjects,
    count,
    difficultyTarget: difficultyTarget || profileDifficulty(profile),
    rivalType,
  });

  if (!questions.length) {
    return { ok: false, error: 'no_questions_available', status: 422 };
  }

  // Charge credits if required (AFTER question availability is confirmed).
  let chargeRecord = null;
  if (access.requiresCredits && access.creditCost > 0) {
    const reference = `rival_${rivalType}_${user.id}_${Date.now()}`;
    const charge = await checkAndConsumeCredits({
      userId: user.id,
      amount: access.creditCost,
      action: `ai_rival_${rivalType.toLowerCase()}`,
      reference,
    });
    if (!charge.ok) {
      return {
        ok: false,
        error: charge.error || 'credit_charge_failed',
        balance: charge.balance,
        required: charge.required,
        status: 402,
      };
    }
    chargeRecord = { reference, charged: charge.charged, balance: charge.balance };
  }

  const rivalBenchmark = simulateRivalBenchmark({ profile, questions, count, timeLimitSeconds: timeLimit * 60 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('rival_battles')
    .insert({
      user_id: user.id,
      rival_type: rivalType,
      status: 'in_progress',
      subjects: normalizedSubjects,
      question_ids: questions.map((q) => q.id),
      rival_profile: {
        name: profile.name,
        archetype: profile.archetype,
        targetAccuracy: profile.targetAccuracy,
        avgTimePerQuestion: profile.avgTimePerQuestion,
        strength: profile.strength,
        weakness: profile.weakness,
        difficultyMultiplier: profile.difficultyMultiplier,
        accent: profile.accent,
      },
      rival_score: rivalBenchmark.score,
      rival_accuracy: rivalBenchmark.accuracyPct,
      rival_time_seconds: rivalBenchmark.totalTimeSeconds,
      metadata: {
        timeLimitMinutes: timeLimit,
        difficultyTarget: difficultyTarget || null,
        targetCollege: targetCollege || null,
        slot: quotaSlotFor(rivalType),
        charge: chargeRecord,
        rivalAnswers: rivalBenchmark.answers,
      },
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[rival] insert failed:', error);
    return { ok: false, error: 'battle_insert_failed', status: 500 };
  }

  return {
    ok: true,
    battle: {
      id: data.id,
      rivalType,
      profile: profile,
      subjects: normalizedSubjects,
      questions: questions.map((q) => ({
        id: q.id,
        subject: q.subject,
        chapter: q.chapter,
        question: q.question,
        options: q.options,
        difficulty: q.difficulty,
      })),
      questionCount: questions.length,
      timeLimitMinutes: timeLimit,
      rivalBenchmark: {
        score: rivalBenchmark.score,
        accuracy: rivalBenchmark.accuracyPct,
        totalTimeSeconds: rivalBenchmark.totalTimeSeconds,
      },
      requiresCredits: Boolean(access.requiresCredits),
      creditCost: access.creditCost || 0,
      charge: chargeRecord,
      createdAt: data.created_at,
    },
  };
}

// ----- internals -----

async function selectRivalQuestions({ userId, subjects, count, difficultyTarget, rivalType }) {
  const sb = supabaseAdmin();
  const perSubject = Math.max(1, Math.ceil(count / subjects.length));

  // For WEAKNESS_RIVAL we bias toward chapters the user has historically failed.
  let weakChapters = new Set();
  if (rivalType === 'WEAKNESS_RIVAL') {
    try {
      const { data: progress } = await sb
        .from('user_question_progress')
        .select('subject, chapter, attempt_count, correct_count')
        .eq('user_id', userId)
        .in('subject', subjects);
      const ranked = (progress || [])
        .filter((r) => (r.attempt_count || 0) >= 2)
        .map((r) => ({
          key: `${r.subject}::${r.chapter || 'unspecified'}`,
          accuracy: r.attempt_count ? r.correct_count / r.attempt_count : 1,
        }))
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 8);
      weakChapters = new Set(ranked.map((r) => r.key));
    } catch {
      weakChapters = new Set();
    }
  }

  const collected = [];
  for (const subject of subjects) {
    const remaining = count - collected.length;
    if (remaining <= 0) break;

    const limit = Math.min(perSubject * 3, remaining * 4, 60);
    let query = sb
      .from('questions')
      .select('id, subject, chapter, question, options, correct_index, correct_answer, difficulty, score')
      .eq('subject', subject)
      .eq('is_deleted', false)
      .eq('status', 'live')
      .limit(limit);

    if (difficultyTarget && ['easy', 'medium', 'hard'].includes(difficultyTarget)) {
      query = query.eq('difficulty', difficultyTarget);
    }

    const { data, error } = await query;
    if (error || !data?.length) continue;

    let pool = data;
    if (weakChapters.size) {
      const weak = pool.filter((q) => weakChapters.has(`${q.subject}::${q.chapter || 'unspecified'}`));
      if (weak.length) pool = weak;
    }

    // Shuffle + take.
    pool.sort(() => Math.random() - 0.5);
    collected.push(...pool.slice(0, Math.min(perSubject, remaining)));
  }

  // Normalise option shape — Database.getQuestions does a similar thing,
  // but here we need raw rows so we can charge credits before paying for it.
  return collected.slice(0, count).map((q) => ({
    id: q.id,
    subject: q.subject,
    chapter: q.chapter,
    question: q.question,
    options: Array.isArray(q.options)
      ? q.options.map((o) => (typeof o === 'string' ? o : o?.text ?? o?.label ?? ''))
      : [],
    correctIndex: Number.isInteger(q.correct_index) ? q.correct_index : null,
    difficulty: q.difficulty || 'medium',
  }));
}

function simulateRivalBenchmark({ profile, questions, count, timeLimitSeconds }) {
  // Deterministic-ish simulation (uses Math.random but bounded).
  // For each question: rival has profile.targetAccuracy chance to be right,
  // adjusted ±5% by question difficulty. Time is sampled around avgTimePerQuestion.
  let correct = 0;
  let totalTime = 0;
  const answers = [];

  for (const q of questions) {
    const diffAdj = q.difficulty === 'hard' ? -0.07 : q.difficulty === 'easy' ? 0.05 : 0;
    const pCorrect = clamp(profile.targetAccuracy + diffAdj, 0.3, 0.98);
    const isCorrect = Math.random() < pCorrect;
    const t = Math.max(
      8,
      Math.round(profile.avgTimePerQuestion + (Math.random() - 0.5) * 18 * profile.difficultyMultiplier),
    );
    totalTime += t;
    if (totalTime > timeLimitSeconds) {
      // Rival ran out of time on remaining questions.
      answers.push({ qid: q.id, isCorrect: false, timeSeconds: t, ranOut: true });
      continue;
    }
    if (isCorrect) correct += 1;
    answers.push({ qid: q.id, isCorrect, timeSeconds: t });
  }

  const accuracyPct = count ? Math.round((correct / count) * 100) : 0;
  // Score uses MockMob's "every correct = +1 weight" base, scaled by difficulty multiplier.
  const score = Math.round(correct * 10 * profile.difficultyMultiplier);

  return {
    score,
    accuracyPct,
    correctCount: correct,
    totalTimeSeconds: Math.min(totalTime, timeLimitSeconds),
    answers,
  };
}

function profileDifficulty(profile) {
  if (profile.difficultyMultiplier >= 1.2) return 'hard';
  if (profile.difficultyMultiplier <= 0.95) return 'easy';
  return null; // mixed
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function clampInt(v, lo, hi, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
