import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { getRivalProfile, quotaSlotFor, rivalAccessRule } from './rivalProfiles';
import { getUsageSnapshot, planTierFor, rivalTypeToQuotaAction } from '@/services/usage/getDailyUsage';
import { consumeAIAllowance } from '@/services/credits/consumeAIAllowance';

/**
 * Creates a Shadow Benchmark battle. Question selection, benchmark scoring, and final
 * score math are deterministic server-side logic. AI only adds intro/outro
 * flavor in the route layer.
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
  });

  if (!access.allowed) {
    return {
      ok: false,
      error: access.reason || 'rival_access_denied',
      planRequired: Boolean(access.planRequired),
      upgradeHint: Boolean(access.upgradeHint),
      status: access.status || (access.planRequired ? 402 : 429),
    };
  }

  const normalizedSubjects = Array.isArray(subjects) && subjects.length
    ? subjects.slice(0, 5)
    : (Array.isArray(user.subjects) && user.subjects.length ? user.subjects.slice(0, 1) : []);

  if (!normalizedSubjects.length) {
    return { ok: false, error: 'no_subjects_configured', status: 400 };
  }

  const count = clampInt(questionCount, 5, 30, 10);
  const timeLimit = clampInt(
    timeLimitMinutes,
    3,
    60,
    Math.max(5, Math.round((count * profile.avgTimePerQuestion) / 60) + 2),
  );
  const battleSeed = buildBattleSeed({ userId: user.id, rivalType, used: snapshot.used });

  const questions = await selectRivalQuestions({
    userId: user.id,
    subjects: normalizedSubjects,
    count,
    difficultyTarget: difficultyTarget || profileDifficulty(profile),
    rivalType,
    seed: battleSeed,
  });

  if (questions.length < Math.min(5, count)) {
    return {
      ok: false,
      error: 'no_questions_available',
      message: 'No complete benchmark question set is available for this subject yet. Try another subject or a shorter diagnostic mock.',
      status: 422,
    };
  }

  let chargeRecord = null;
  const requiresCharge = access.requiresCredits && access.creditCost > 0;

  const rivalBenchmark = simulateRivalBenchmark({
    profile,
    questions,
    count,
    timeLimitSeconds: timeLimit * 60,
    seed: battleSeed,
  });

  const { data, error } = await supabaseAdmin()
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
        battleSeed,
        charge: null,
        rivalAnswers: rivalBenchmark.answers,
      },
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[rival] insert failed:', error);
    return {
      ok: false,
      error: 'battle_insert_failed',
      message: 'Rival could not create the battle record. No AI credits were charged. Try again in a moment.',
      status: 500,
    };
  }

  if (requiresCharge) {
    const allowance = await consumeAIAllowance({
      user,
      action: rivalTypeToQuotaAction(rivalType),
      referencePrefix: `rival_${rivalType}_${data.id}`,
    });
    if (!allowance.ok) {
      await markBattleAbandoned({
        battleId: data.id,
        userId: user.id,
        reason: allowance.error || 'credit_charge_failed',
      });
      return {
        ok: false,
        error: allowance.error || 'credit_charge_failed',
        message:
          allowance.error === 'ai_credit_schema_missing'
            ? 'AI credits are not initialized yet. Run the AI overlay credits migration.'
            : 'This premium Rival needs AI credits before it can start.',
        planRequired: Boolean(allowance.planRequired),
        balance: allowance.balance,
        required: allowance.required,
        status: allowance.status || 402,
      };
    }
    chargeRecord = allowance.charge;
    await attachBattleCharge({
      battleId: data.id,
      userId: user.id,
      metadata: data.metadata,
      charge: chargeRecord,
    });
  }

  return {
    ok: true,
    battle: {
      id: data.id,
      rivalType,
      profile,
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

async function attachBattleCharge({ battleId, userId, metadata, charge }) {
  try {
    await supabaseAdmin()
      .from('rival_battles')
      .update({ metadata: { ...(metadata || {}), charge } })
      .eq('id', battleId)
      .eq('user_id', userId);
  } catch (err) {
    console.warn('[rival] charge metadata update skipped:', err?.message || err);
  }
}

async function markBattleAbandoned({ battleId, userId, reason }) {
  try {
    await supabaseAdmin()
      .from('rival_battles')
      .update({
        status: 'abandoned',
        metadata: { abandonedReason: reason, abandonedAt: new Date().toISOString() },
      })
      .eq('id', battleId)
      .eq('user_id', userId);
  } catch (err) {
    console.warn('[rival] abandoned marker skipped:', err?.message || err);
  }
}

async function selectRivalQuestions({ userId, subjects, count, difficultyTarget, rivalType, seed }) {
  const sb = supabaseAdmin();
  const perSubject = Math.max(1, Math.ceil(count / subjects.length));

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
      .select('id, subject, chapter, body, question, options, correct_index, difficulty, score')
      .eq('subject', subject)
      .eq('is_deleted', false)
      .or('status.eq.live,verification_state.eq.verified')
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

    pool.sort((a, b) => hashToUnit(`${seed}:${a.id}:pick`) - hashToUnit(`${seed}:${b.id}:pick`));
    collected.push(...pool.slice(0, Math.min(perSubject, remaining)));
  }

  return collected
    .map((q) => {
      const questionText = String(q.question || q.body || '').trim();
      const options = Array.isArray(q.options)
        ? q.options.map((o) => String(typeof o === 'string' ? o : o?.text ?? o?.label ?? o?.value ?? '').trim())
        : [];
      return {
        id: q.id,
        subject: q.subject,
        chapter: q.chapter,
        question: questionText,
        options: options.filter(Boolean),
        correctIndex: Number.isInteger(q.correct_index) ? q.correct_index : null,
        difficulty: q.difficulty || 'medium',
      };
    })
    .filter((q) => q.question.length >= 8 && q.options.length >= 2)
    .slice(0, count);
}

function simulateRivalBenchmark({ profile, questions, count, timeLimitSeconds, seed }) {
  let correct = 0;
  let totalTime = 0;
  const answers = [];

  for (const q of questions) {
    const diffAdj = q.difficulty === 'hard' ? -0.07 : q.difficulty === 'easy' ? 0.05 : 0;
    const pCorrect = clamp(profile.targetAccuracy + diffAdj, 0.3, 0.98);
    const isCorrect = hashToUnit(`${seed}:${q.id}:correct`) < pCorrect;
    const timeRoll = hashToUnit(`${seed}:${q.id}:time`) - 0.5;
    const t = Math.max(
      8,
      Math.round(profile.avgTimePerQuestion + timeRoll * 18 * profile.difficultyMultiplier),
    );

    totalTime += t;
    if (totalTime > timeLimitSeconds) {
      answers.push({ qid: q.id, isCorrect: false, timeSeconds: t, ranOut: true });
      continue;
    }
    if (isCorrect) correct += 1;
    answers.push({ qid: q.id, isCorrect, timeSeconds: t });
  }

  const accuracyPct = count ? Math.round((correct / count) * 100) : 0;
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
  return null;
}

function buildBattleSeed({ userId, rivalType, used }) {
  const day = new Date().toISOString().slice(0, 10);
  const count = (used?.basicRivalBattles || 0) + (used?.premiumRivalBattles || 0);
  return `${userId}:${rivalType}:${day}:${count}`;
}

function hashToUnit(input) {
  let h = 2166136261;
  const text = String(input);
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function clampInt(v, lo, hi, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
