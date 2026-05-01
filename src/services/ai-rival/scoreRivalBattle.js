import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { getRivalProfile } from './rivalProfiles';

/**
 * Score a submitted Shadow Benchmark deterministically.
 * Never uses AI. This is the source of truth for win/loss.
 *
 * @param {{
 *   battleId: string,
 *   userId: string,
 *   answers: Array<{qid: string, selectedIndex: number|null, timeSeconds: number|null}>,
 * }} args
 */
export async function scoreRivalBattle({ battleId, userId, answers }) {
  const sb = supabaseAdmin();

  const { data: battle, error: battleErr } = await sb
    .from('rival_battles')
    .select('*')
    .eq('id', battleId)
    .eq('user_id', userId)
    .single();

  if (battleErr || !battle) {
    return { ok: false, error: 'battle_not_found', status: 404 };
  }
  if (battle.status === 'submitted') {
    return { ok: false, error: 'battle_already_submitted', status: 409 };
  }

  const profile = getRivalProfile(battle.rival_type);
  const questionIds = battle.question_ids || [];
  const { data: questions, error: qErr } = await sb
    .from('questions')
    .select('id, correct_index, correct_answer, options, subject, chapter, difficulty')
    .in('id', questionIds);

  if (qErr || !questions) {
    return { ok: false, error: 'questions_lookup_failed', status: 500 };
  }

  const questionById = new Map(questions.map((q) => [q.id, q]));

  let correct = 0;
  let answered = 0;
  let totalTime = 0;
  const detailRows = [];

  for (const a of answers || []) {
    const q = questionById.get(a.qid);
    if (!q) continue;
    const correctIndex = resolveCorrectIndex(q);
    const selectedIndex = Number.isInteger(a.selectedIndex) ? a.selectedIndex : null;
    const time = Math.max(0, Math.min(600, Number(a.timeSeconds) || 0));
    totalTime += time;
    let isCorrect = null;
    if (selectedIndex != null) {
      answered += 1;
      isCorrect = selectedIndex === correctIndex;
      if (isCorrect) correct += 1;
    }
    detailRows.push({
      battle_id: battleId,
      user_id: userId,
      question_id: q.id,
      selected_answer: selectedIndex,
      is_correct: isCorrect,
      time_spent_seconds: time,
    });
  }

  const total = questionIds.length;
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
  const score = Math.round(correct * 10 * (profile?.difficultyMultiplier || 1));

  let result;
  if (score > battle.rival_score) result = 'win';
  else if (score < battle.rival_score) result = 'loss';
  else if (totalTime < battle.rival_time_seconds) result = 'win';
  else if (totalTime > battle.rival_time_seconds) result = 'loss';
  else result = 'tie';

  const shareCard = buildShareCard({ result, profile, score, rivalScore: battle.rival_score, accuracy });
  const nextMoveHint = buildNextMoveHint({ result, accuracy, totalTime, totalQuestions: total, profile });

  // Persist answers + update battle.
  if (detailRows.length) {
    const { error: ansErr } = await sb.from('rival_battle_answers').insert(detailRows);
    if (ansErr) console.error('[rival] answer insert failed:', ansErr);
  }

  const submittedAt = new Date().toISOString();
  const { error: updErr } = await sb
    .from('rival_battles')
    .update({
      status: 'submitted',
      user_score: score,
      user_accuracy: accuracy,
      user_time_seconds: totalTime,
      result,
      submitted_at: submittedAt,
      metadata: { ...(battle.metadata || {}), shareCard, nextMoveHint },
    })
    .eq('id', battleId);

  if (updErr) {
    console.error('[rival] battle update failed:', updErr);
    return { ok: false, error: 'battle_update_failed', status: 500 };
  }

  await persistSharePayload({ battleId, shareCard });

  return {
    ok: true,
    result,
    user: {
      score,
      accuracy,
      correct,
      answered,
      total,
      totalTimeSeconds: totalTime,
    },
    rival: {
      score: battle.rival_score,
      accuracy: battle.rival_accuracy,
      totalTimeSeconds: battle.rival_time_seconds,
      profile: battle.rival_profile,
    },
    rivalType: battle.rival_type,
    shareCard,
    nextMoveHint,
  };
}

async function persistSharePayload({ battleId, shareCard }) {
  try {
    await supabaseAdmin()
      .from('rival_battles')
      .update({ share_payload: shareCard })
      .eq('id', battleId);
  } catch (err) {
    console.warn('[rival] share payload column unavailable:', err?.message || err);
  }
}

function resolveCorrectIndex(q) {
  if (Number.isInteger(q?.correct_index) && q.correct_index >= 0) return q.correct_index;
  const raw = String(q?.correct_answer || '').trim().toUpperCase();
  const map = { A: 0, B: 1, C: 2, D: 3, E: 4 };
  if (raw in map) return map[raw];
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);
  return -1;
}

function buildShareCard({ result, profile, score, rivalScore, accuracy }) {
  const verb = result === 'win' ? 'beat' : result === 'loss' ? 'lost to' : 'tied with';
  const rivalName = profile?.name || 'Shadow Benchmark';
  return {
    headline: `I ${verb} ${rivalName}`,
    score,
    rivalScore,
    accuracy,
    rankTitle: titleFor({ result, accuracy }),
    rematchCta: 'Rematch on MockMob',
    palette: { accent: profile?.accent || '#d2f000' },
  };
}

function titleFor({ result, accuracy }) {
  if (result === 'win' && accuracy >= 85) return 'CLEAN VICTORY';
  if (result === 'win') return 'VICTORY';
  if (result === 'tie') return 'DEAD HEAT';
  if (accuracy >= 60) return 'CLOSE MISS';
  return 'GROUND TO GAIN';
}

function buildNextMoveHint({ result, accuracy, totalTime, totalQuestions, profile }) {
  if (result === 'loss' && accuracy < 50) {
    return 'Run Mistake Replay on your weakest subject before the next retry.';
  }
  if (result === 'loss' && totalQuestions && totalTime / totalQuestions > (profile?.avgTimePerQuestion || 60) * 1.3) {
    return 'You are losing on speed, not knowledge. Try Speed Benchmark next.';
  }
  if (result === 'win' && accuracy < 75) {
    return 'You won, but accuracy is shaky. Lock it in with a focused chapter revision.';
  }
  if (result === 'win') {
    return 'Step up only if this felt clean. Otherwise replay the questions you nearly missed.';
  }
  return 'Take a Quick Practice mock to compound the rhythm.';
}
