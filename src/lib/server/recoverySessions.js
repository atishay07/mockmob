import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { Database } from '@/../data/db';
import { scoreSession, scorePracticeSubmission } from '@/../data/recovery';
import { getMode, isValidModeId, resolveCount, resolveDurationSec } from '@/../data/test_modes';
import { normalizeSubjectSelection } from '@/../data/cuet_controls';
import { randomUUID } from 'node:crypto';
import { LAUNCH_SUBJECTS, publicSessionView } from '@/../shared/recoveryContract';
import { episodeCheckQuestion, respondEpisode } from './learning';
import { replayExposures } from '@/../data/mistake_replay';

export function publicSession(row) {
  return publicSessionView(row);
}

export async function startSession(userId, input) {
  if (input.episodeId) {
    const { row: episode, item, question } = await episodeCheckQuestion(userId, input.episodeId);
    const db = supabaseAdmin();
    const key = `check_${episode.id}_${episode.revision}`;
    const { data: previous, error: readError } = await db.from('recovery_sessions').select('*').eq('user_id', userId).eq('request_key', key).maybeSingle();
    if (readError) throw new Error('LEARNING_STORAGE_UNAVAILABLE');
    if (previous) {
      if (previous.state !== 'active') throw new Error('SESSION_ALREADY_SUBMITTED');
      if (Date.parse(previous.expires_at) + 120000 <= Date.now()) {
        await respondEpisode(userId, episode.id, { requestKey: `submission_${previous.id}`, itemId: previous.selection_meta.itemId, type: 'choice', value: null }, { scoredCheck: true, incompleteCheck: 'expired' });
        throw new Error('CHECK_EXPIRED_RETURN_TO_REPAIR');
      }
      if (Date.parse(previous.expires_at) <= Date.now()) throw new Error('SESSION_EXPIRED');
      return { ...publicSession(previous), events: previous.events };
    }
    const at = Date.now();
    const row = { id: randomUUID(), user_id: userId, request_key: key, subject: episode.pathway.subject, mode: 'quick', state: 'active', questions: [question], selection_meta: { episodeId: episode.id, episodeRevision: episode.revision, itemId: item.id, learningPurpose: 'fresh_check', contentEvidence: 'released_pathway', scoringAuthority: 'server_snapshot' }, created_at: new Date(at).toISOString(), expires_at: new Date(at + 300000).toISOString() };
    const { data, error } = await db.rpc('start_recovery_session', { p_row: row, p_credit_action: null });
    if (error) throw new Error('SESSION_CREATE_FAILED');
    return publicSession(data);
  }
  const selection = normalizeSubjectSelection({ subject: input.subject });
  if (!selection.valid || !LAUNCH_SUBJECTS.some(s => s.id === selection.internalSubject)) throw new Error('SUBJECT_NOT_SUPPORTED');
  if (!/^[a-zA-Z0-9_-]{12,100}$/.test(input.generationKey || '')) throw new Error('INVALID_GENERATION_KEY');
  if (!isValidModeId(input.mode || 'quick')) throw new Error('INVALID_MODE');
  const mode = getMode(input.mode || 'quick');
  if (!mode) throw new Error('INVALID_MODE');
  const db = supabaseAdmin();
  const { data: existing, error: readError } = await db.from('recovery_sessions').select('*').eq('user_id', userId).eq('request_key', input.generationKey).maybeSingle();
  if (readError) throw new Error('RECOVERY_MIGRATION_REQUIRED');
  if (existing) {
    if (existing.state !== 'active') throw new Error('SESSION_ALREADY_SUBMITTED');
    if (Date.parse(existing.expires_at) <= Date.now()) throw new Error('SESSION_EXPIRED');
    return publicSession(existing);
  }
  const user = await Database.getUserById(userId);
  if (mode.premium && !user?.isPremium) throw new Error('PREMIUM_REQUIRED');
  const count = resolveCount(mode, Math.max(5, Math.min(50, Number(input.count) || 5)));
  let exposures = [];
  if (input.recoveryFrom) {
    const previous = await Database.getAttemptById(input.recoveryFrom);
    if (!previous || previous.userId !== userId) throw new Error('SESSION_NOT_FOUND');
    exposures = (await Database.getAttempts(userId)).flatMap(a => a.questionsSnapshot || []);
  }
  const result = await Database.getQuestions(selection.internalSubject, count, {
    mode: mode.id, userId, returnMeta: true, requestedCount: count,
    requireEvidence: true,
    ...(input.recoveryFrom ? replayExposures([{ questionsSnapshot: exposures }]) : {}),
    chapter: typeof input.chapter === 'string' ? input.chapter : undefined,
    chapters: typeof input.chapters === 'string' ? input.chapters.split(',').slice(0,12) : undefined,
    generationKey: input.generationKey,
  });
  if (input.recoveryFrom) {
    const previous = await Database.getAttemptById(input.recoveryFrom);
    if (!previous || previous.userId !== userId) throw new Error('SESSION_NOT_FOUND');
    result.meta = { ...result.meta, recoveryFrom: previous.id, freshQuestionFamilies: true };
  }
  if (result.questions.length < count) throw new Error('INSUFFICIENT_VERIFIED_CONTENT');
  const id = randomUUID();
  const created = new Date();
  const row = { id, user_id: userId, request_key: input.generationKey, subject: selection.internalSubject,
    mode: mode.id, state: 'active', questions: result.questions, selection_meta: result.meta,
    created_at: created.toISOString(), expires_at: new Date(+created + resolveDurationSec(mode, result.questions) * 1000).toISOString() };
  // Credit charge and session insert share one transaction; insufficient inventory is checked first.
  const { data, error } = await db.rpc('start_recovery_session', { p_row: row,
    p_credit_action: !user?.isPremium && !(mode.id === 'quick' && count === 5) ? mode.creditAction : null });
  if (error) throw new Error(/credit/i.test(error.message) ? 'INSUFFICIENT_CREDITS' : 'SESSION_CREATE_FAILED');
  if (data.state !== 'active' || Date.parse(data.expires_at) <= Date.now()) throw new Error('SESSION_EXPIRED');
  return publicSession(data);
}

export async function recordEvents(userId, input) {
  const db = supabaseAdmin();
  const { data: row } = await db.from('recovery_sessions').select('*').eq('id', input.sessionId).eq('user_id', userId).maybeSingle();
  if (!row) throw new Error('SESSION_NOT_FOUND');
  const bound = Math.min(Date.parse(row.expires_at) - Date.parse(row.created_at), Math.max(0, Date.now() - Date.parse(row.created_at)) + 2000);
  scoreSession(row.questions, {}, input.events, bound); // Validation only; no score is persisted.
  const { data, error } = await db.rpc('record_recovery_events', { p_id: row.id, p_user_id: userId, p_events: input.events });
  if (error) throw new Error(/expired/.test(error.message) ? 'SESSION_EXPIRED' : 'EVENT_CONFLICT');
  return { acknowledgedSequence: data.at(-1)?.seq || 0 };
}

export async function finishSession(userId, input) {
  if (typeof input.sessionId !== 'string') throw new Error('SERVER_SESSION_REQUIRED');
  const db = supabaseAdmin();
  const { data: row, error } = await db.from('recovery_sessions').select('*').eq('id', input.sessionId).eq('user_id', userId).maybeSingle();
  if (error || !row) throw new Error('SESSION_NOT_FOUND');
  if (row.state === 'submitted') {
    const saved = await Database.getAttemptById(row.id);
    if (row.selection_meta?.episodeId) await completeEpisodeCheck(userId, row, saved);
    return saved;
  }
  const duration = Date.parse(row.expires_at) - Date.parse(row.created_at);
  // Modest upload grace is not additional answering time; event bounds stay at the deadline.
  if (Date.now() > Date.parse(row.expires_at) + 120000) throw new Error('SESSION_EXPIRED');
  const elapsed = Math.max(0, Date.now() - Date.parse(row.created_at));
  const ordinary = row.selection_meta?.contentEvidence === 'legacy_bank';
  let invalidTelemetry = false;
  if (Date.now() <= Date.parse(row.expires_at) && input.events?.length) {
    try { await recordEvents(userId, input); }
    catch (error) {
      if (!ordinary || !/^invalid_event|^EVENT_CONFLICT/.test(error.message)) throw error;
      invalidTelemetry = true;
    }
  }
  const { data: current } = await db.from('recovery_sessions').select('events').eq('id', row.id).eq('user_id', userId).single();
  if (!current) throw new Error('SESSION_NOT_FOUND');
  const answers = {};
  for (const event of current.events) if (event.type === 'answer') answers[event.qid] = event.answer;
  // Final ordinary answers are accepted only before the deadline. Grace uploads
  // can use acknowledged answers, never supply additional answering time.
  const finalAnswers = ordinary && Date.now() <= Date.parse(row.expires_at) && input.answers ? input.answers : answers;
  const score = ordinary ? scorePracticeSubmission(row.questions, finalAnswers, invalidTelemetry ? [] : current.events, Math.min(duration, elapsed + 2000)) : scoreSession(row.questions, answers, current.events, Math.min(duration, elapsed + 2000));
  if (invalidTelemetry) score.recovery.telemetry = 'invalid';
  const result = { ...score, subject: row.subject, questionsSnapshot: row.questions,
    expected_event_count: current.events.length,
    selectionMeta: { ...row.selection_meta, scoringVersion: ordinary ? 'server_practice_v1' : 'server_snapshot_v1', recovery: score.recovery } };
  const { error: finishError } = await db.rpc('finish_recovery_session', { p_id: row.id, p_user_id: userId, p_result: result });
  if (finishError) throw new Error('SESSION_SUBMIT_FAILED');
  const saved = await Database.getAttemptById(row.id);
  if (row.selection_meta?.episodeId) await completeEpisodeCheck(userId, row, saved);
  return saved;
}

async function completeEpisodeCheck(userId, row, saved) {
  const detail = saved?.details?.find(d => d.qid === row.questions[0].id);
  const unanswered = !Number.isInteger(detail?.givenIndex);
  await respondEpisode(userId, row.selection_meta.episodeId, { requestKey: `submission_${row.id}`, itemId: row.selection_meta.itemId, type: 'choice', value: unanswered ? null : detail.givenIndex }, { scoredCheck: true, incompleteCheck: unanswered ? 'unanswered' : null });
}
