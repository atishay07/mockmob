import 'server-only';
import { Database } from '@/../data/db';
import { normalizeSubjectSelection } from '@/../data/cuet_controls';
import { isValidTopSyllabusPair } from '@/../data/canonical_syllabus';
import { getMode, isValidModeId, resolveCount, resolveDurationSec } from '@/../data/test_modes';
import { scoreSession, scorePracticeSubmission } from '@/../data/recovery';
import { openPractice, practiceId, sealPractice } from '@/../data/practice_ticket';
import { publicSessionView } from '@/../shared/recoveryContract';
import { supabaseAdmin } from '@/lib/supabase';
import { durableLearningEnabled, episodeCheckQuestion } from './learning';
import { allowancePeriod } from '@/../data/learning_engine';
import { tonightMetadata } from '@/../data/study_progress';

const secret = () => process.env.PRACTICE_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function startPractice(userId, input) {
  const db = supabaseAdmin();
  if (input.sessionId) {
    const { data } = await db.from('recovery_sessions').select('*').eq('user_id', userId).eq('id', input.sessionId).maybeSingle();
    if (!data) throw new Error('SESSION_NOT_FOUND');
    if (data.state !== 'active' || Date.parse(data.expires_at) <= Date.now()) throw new Error('SESSION_EXPIRED');
    if (data.selection_meta?.episodeId) await episodeCheckQuestion(userId,data.selection_meta.episodeId);
    return { ...publicSessionView(data), events: data.events };
  }
  const selection = normalizeSubjectSelection({ subject: input.subject });
  if (!selection.valid) throw new Error('SUBJECT_NOT_SUPPORTED');
  if (!/^[a-zA-Z0-9_-]{12,100}$/.test(input.generationKey || '')) throw new Error('INVALID_GENERATION_KEY');
  if (!isValidModeId(input.mode || 'quick')) throw new Error('INVALID_MODE');
  const mode = getMode(input.mode || 'quick');
  const chapters = (typeof input.chapters === 'string' ? input.chapters.split(',') : input.chapter ? [input.chapter] : []).filter(Boolean).slice(0, 12);
  if (chapters.some(chapter => !isValidTopSyllabusPair(selection.internalSubject, chapter))) throw new Error('INVALID_CHAPTER');
  const user = await Database.getUserById(userId);
  if (mode.premium && !user?.isPremium) throw new Error('PREMIUM_REQUIRED');
  const difficulty = ['easy', 'medium', 'hard'].includes(input.difficulty) ? input.difficulty : '';
  if (difficulty && !mode.allowDifficultyOverride) throw new Error('DIFFICULTY_NOT_ALLOWED');
  if (difficulty && !user?.isPremium) throw new Error('PREMIUM_REQUIRED');
  const count = resolveCount(mode, Math.max(5, Math.min(50, Number(input.count) || 10)));
  if (durableLearningEnabled()) {
    const { data: existing, error } = await db.from('recovery_sessions').select('*').eq('user_id', userId).eq('request_key', input.generationKey).maybeSingle();
    if (error) throw new Error('LEARNING_MIGRATION_REQUIRED');
    if (existing) {
      if (existing.state !== 'active' || Date.parse(existing.expires_at) <= Date.now()) throw new Error('SESSION_EXPIRED');
      return { ...publicSessionView(existing), events: existing.events };
    }
  }
  const id = practiceId(secret(), userId, input.generationKey, [selection.internalSubject, mode.id, count, [...chapters].sort(), difficulty]);
  const previous = await Database.getAttemptById(id);
  if (previous) throw new Error('SESSION_ALREADY_SUBMITTED');
  const { questions, meta } = await Database.getQuestions(selection.internalSubject, count, {
    mode: mode.id, userId, count, requestedCount: count, returnMeta: true,
    chapters: chapters.length ? chapters : undefined, difficulty: difficulty || undefined,
    generationKey: input.generationKey, requireEvidence: false,
  });
  if (questions.length < count) throw new Error('INSUFFICIENT_PRACTICE_CONTENT');
  scoreSession(questions); // A malformed key cannot become a scored session.
  const created = Date.now();
  const row = { id, user_id: userId, subject: selection.internalSubject, mode: mode.id,
    created_at: new Date(created).toISOString(), expires_at: new Date(created + resolveDurationSec(mode, questions) * 1000).toISOString(),
    questions, selection_meta: { ...meta, ...tonightMetadata({...input, mode:mode.id, count}, created), scoringVersion: 'server_practice_v1', scoringAuthority: 'server_snapshot', contentEvidence: 'legacy_bank', learningPurpose: input.purpose === 'baseline' ? 'baseline' : 'ordinary_practice' } };
  if (durableLearningEnabled()) {
    let quota = null;
    if (!user?.isPremium && mode.id === 'quick' && count === 10) quota = 'daily_practice';
    if (!user?.isPremium && input.purpose === 'baseline' && mode.id === 'quick' && count === 5 && ['english','accountancy','economics','business_studies'].includes(selection.internalSubject)) quota = `baseline:${selection.internalSubject}`;
    if (!user?.isPremium && input.purpose === 'full_sample' && mode.id === 'full' && ['english','accountancy','economics','business_studies'].includes(selection.internalSubject)) quota = `full_sample:${selection.internalSubject}`;
    const { data, error } = await db.rpc('start_learning_session', { p_row: { ...row, request_key: input.generationKey, state: 'active' }, p_credit_action: user?.isPremium ? null : mode.creditAction, p_quota_kind: quota, p_period: quota ? allowancePeriod(quota, created) : null });
    if (error) throw new Error(/credit/.test(error.message) ? 'INSUFFICIENT_CREDITS' : 'SESSION_CREATE_FAILED');
    return publicSessionView(data);
  }
  const ticket = sealPractice(row, secret());
  // Existing atomic ledger makes retries free; charge only after a complete usable set exists.
  if (!user?.isPremium && mode.creditAction) {
    const paid = await Database.spendCredits(userId, mode.creditAction, `practice_${id}`);
    if (!paid) throw new Error('INSUFFICIENT_CREDITS');
  }
  const view = publicSessionView(row);
  view.meta = { ...view.meta, sessionTicket: ticket, storage: 'device', contentEvidence: 'legacy_bank' };
  return view;
}

export async function finishPractice(userId, input) {
  const row = openPractice(input.sessionTicket, secret(), userId, Date.now(), { allowExpired: true });
  if (row.id !== input.sessionId) throw new Error('SESSION_NOT_FOUND');
  const existing = await Database.getAttemptById(row.id);
  if (existing) {
    if (existing.userId !== userId) throw new Error('SESSION_NOT_FOUND');
    return existing;
  }
  if (Date.now() > Date.parse(row.expires_at) + 120000) throw new Error('SESSION_EXPIRED');
  const duration = Math.min(Date.parse(row.expires_at) - Date.parse(row.created_at), Date.now() - Date.parse(row.created_at) + 2000);
  const result = scorePracticeSubmission(row.questions, input.answers || {}, input.events || [], duration);
  // Observations from device-held telemetry are not certified recovery evidence.
  const score = result;
  try {
    return await Database.addAttempt({ ...score, id: row.id, userId, subject: row.subject,
      questionsSnapshot: row.questions, selectionMeta: { ...row.selection_meta, recovery: result.recovery } });
  } catch (error) {
    if (error.code !== '23505') throw error;
    const winner = await Database.getAttemptById(row.id);
    if (!winner || winner.userId !== userId) throw error;
    return winner; // Unique attempt ID prevents concurrent duplicate progress writes.
  }
}
