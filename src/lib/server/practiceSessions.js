import 'server-only';
import { Database } from '@/../data/db';
import { normalizeSubjectSelection } from '@/../data/cuet_controls';
import { isValidTopSyllabusPair } from '@/../data/canonical_syllabus';
import { fineTuneViolation, getMode, isValidModeId, practiceCreditAction, resolveCount, resolveDurationSec } from '@/../data/test_modes';
import { scoreSession, scorePracticeSubmission, submitMeta } from '@/../data/recovery';
import { openPractice, openStart, practiceId, sealPractice, sealStart } from '@/../data/practice_ticket';
import { publicSessionView } from '@/../shared/recoveryContract';
import { supabaseAdmin } from '@/lib/supabase';
import { durableLearningEnabled, episodeCheckQuestion } from './learning';
import { allowancePeriod } from '@/../data/learning_engine';
import { applyCheckedAnswers, checkedAnswersForSubmit } from './sessionCheck';
import { tonightMetadata } from '@/../data/study_progress';
import { assertNtaPaperServable, ntaOptionLayout } from './ntaPaper';
import { SUBMISSION_GRACE_MS } from '@/../data/session_draft';
import { practiceCharge } from '@/../data/practice_charge';

const secret = () => process.env.PRACTICE_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

// `server` carries what only the server may decide; POST /api/sessions never passes it. server.mobPaper (the Mob, set by
// src/lib/server/mob/service.js) serves the Mob's frozen weekly questions in canonical option order instead of the
// selector, and stamps selection_meta.mobPaper so the finish can record the sitting. A Mob paper charges no credits and
// uses no daily allowance (SOCIAL-SPEC section 15: free of practice credits for every member); the Mob service decides who
// may start one (one free weekly paper per student per week, Pro without that limit) before it ever calls this.
export async function startPractice(userId, input, server = {}) {
  const mobPaper = server?.mobPaper && Array.isArray(server.mobPaper.questions) ? server.mobPaper : null;
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
  const difficulty = ['easy', 'medium', 'hard'].includes(input.difficulty) ? input.difficulty : '';
  // The fine-tune scope (data/test_modes.js fineTuneScope): chapters only for Quick practice, a difficulty only where the
  // mode allows one. Every client sends only these, so a request asking for more was crafted, and is refused, not trimmed.
  const outOfScope = fineTuneViolation(mode.id, { chapters, difficulty });
  if (outOfScope) throw new Error(outOfScope);
  const user = await Database.getUserById(userId);
  if (mode.premium && !user?.isPremium) throw new Error('PREMIUM_REQUIRED');
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
  // Mathematics and Computer Science papers have two section-B variants; only NTA mode reads it.
  const ntaVariant = mode.id === 'nta' && /^[a-z]{2,12}$/.test(input.variant || '') ? input.variant : '';
  const id = practiceId(secret(), userId, input.generationKey, [selection.internalSubject, mode.id, count, [...chapters].sort(), difficulty, ...(ntaVariant ? [ntaVariant] : []), ...(mobPaper ? ['mob', mobPaper.mobId, mobPaper.weekStart, ...(mobPaper.extraId ? [mobPaper.extraId] : [])] : [])]);
  const previous = await Database.getAttemptById(id);
  if (previous) throw new Error('SESSION_ALREADY_SUBMITTED');
  const { questions, meta } = mobPaper
    ? { questions: mobPaper.questions, meta: { mode: mode.id, requestedCount: count, finalCount: mobPaper.questions.length, selectedCount: mobPaper.questions.length, selectionStrategy: 'mob_paper' } }
    : await Database.getQuestions(selection.internalSubject, count, {
    mode: mode.id, userId, count, requestedCount: count, returnMeta: true,
    chapters: chapters.length ? chapters : undefined, difficulty: difficulty || undefined,
    generationKey: input.generationKey, requireEvidence: false, ntaVariant: ntaVariant || undefined,
  });
  if (mode.id === 'nta') assertNtaPaperServable(questions, meta);
  else if (questions.length < count) throw new Error('INSUFFICIENT_PRACTICE_CONTENT');
  scoreSession(questions); // A malformed key cannot become a scored session.
  // The option order and remapped key the engine served are stored with the session (see ntaOptionLayout).
  const optionLayout = mode.id === 'nta' ? ntaOptionLayout(questions, meta) : null;
  // Device-held sessions keep no server row, so a start whose saved draft is gone must prove when the
  // session began. A valid receipt restores that start (and so the deadline); without one the session
  // starts now. The receipt covers the start only: the duration is always the official one.
  let created = Date.now();
  if (!durableLearningEnabled() && input.startReceipt !== undefined && input.startReceipt !== null && input.startReceipt !== '') {
    const proven = openStart(input.startReceipt, secret(), userId, id);
    if (proven === null) throw new Error('INVALID_START_RECEIPT');
    created = Math.min(proven, created);
  }
  const row = { id, user_id: userId, subject: selection.internalSubject, mode: mode.id,
    created_at: new Date(created).toISOString(), expires_at: new Date(created + resolveDurationSec(mode, questions) * 1000).toISOString(),
    questions, selection_meta: { ...meta, ...(optionLayout ? { ntaOptionLayout: optionLayout } : {}), ...tonightMetadata({...input, mode:mode.id, count}, created), scoringVersion: 'server_practice_v1', scoringAuthority: 'server_snapshot', contentEvidence: 'legacy_bank', learningPurpose: input.purpose === 'baseline' ? 'baseline' : 'ordinary_practice', ...(mobPaper ? { mobPaper: { mobId: mobPaper.mobId, weekStart: mobPaper.weekStart, ...(mobPaper.extraId ? { extraId: mobPaper.extraId } : {}) } } : {}) } };
  const charge = practiceCharge({ isPremium: user?.isPremium, mobPaper, modeId: mode.id, creditAction: practiceCreditAction(mode.id, count), count, purpose: input.purpose, subject: selection.internalSubject });
  if (durableLearningEnabled()) {
    const { quota } = charge;
    const { data, error } = await db.rpc('start_learning_session', { p_row: { ...row, request_key: input.generationKey, state: 'active' }, p_credit_action: charge.creditAction, p_quota_kind: quota, p_period: quota ? allowancePeriod(quota, created) : null });
    if (error) throw new Error(/credit/.test(error.message) ? 'INSUFFICIENT_CREDITS' : 'SESSION_CREATE_FAILED');
    return publicSessionView(data);
  }
  // Past the deadline and the upload grace there is nothing left to resume, and nothing may restart.
  if (Date.now() > Date.parse(row.expires_at) + SUBMISSION_GRACE_MS) throw new Error('SESSION_EXPIRED');
  const ticket = sealPractice(row, secret());
  // Existing atomic ledger makes retries free; charge only after a complete usable set exists.
  if (charge.creditAction) {
    const paid = await Database.spendCredits(userId, charge.creditAction, `practice_${id}`);
    if (!paid) throw new Error('INSUFFICIENT_CREDITS');
  }
  const view = publicSessionView(row);
  view.meta = { ...view.meta, sessionTicket: ticket, startReceipt: sealStart(secret(), userId, id, created), storage: 'device', contentEvidence: 'legacy_bank' };
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
  // A per-answer check (B13) makes that answer final, whatever the client submits for it now.
  const checked = await checkedAnswersForSubmit(supabaseAdmin(), row.id, userId);
  const result = scorePracticeSubmission(row.questions, applyCheckedAnswers(input.answers || {}, checked), input.events || [], duration);
  // Observations from device-held telemetry are not certified recovery evidence.
  const score = result;
  try {
    const saved = await Database.addAttempt({ ...score, id: row.id, userId, subject: row.subject,
      questionsSnapshot: row.questions, selectionMeta: { ...row.selection_meta, recovery: result.recovery, ...submitMeta(input, input.events) } });
    // A finished Mob paper counts for the Mob's ring (never throws; a sitting after Sunday 11:59 PM IST is not recorded).
    // The durable path (finishSession) is credited when a member next reads the Mob (mob/service.js syncSittings).
    if (row.selection_meta?.mobPaper) await (await import('./mob/deps')).recordMobSitting(userId, saved).catch(() => null);
    return saved;
  } catch (error) {
    if (error.code !== '23505') throw error;
    const winner = await Database.getAttemptById(row.id);
    if (!winner || winner.userId !== userId) throw error;
    return winner; // Unique attempt ID prevents concurrent duplicate progress writes.
  }
}
