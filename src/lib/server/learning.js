import 'server-only';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { Database } from '@/../data/db';
import { publicationEligibility } from '@/../data/evidence_registry';
import { currentRegistry } from '@/../data/evidence_registry';
import { excludeHeldFamilies } from '@/../data/evidence_holds';
import { validatePathway, createEpisode, advanceEpisode, publicEpisode, learningPlan, allowancePeriod, permittedStep } from '@/../data/learning_engine';
import { tonightCompletion, studyMilestones } from '@/../data/study_progress';
import { pathwayDigest } from '@/../data/pathway_validation';
import { studyRecord, getStudyPreferences } from './study';
import { withPlanActions } from './actionFields';
import { guidedSequence, istDay } from '@/../data/study_engine';
import { composeLearningRecord, allInOrder, memoValidator } from './learningRecordCompose';

export const durableLearningEnabled = () => process.env.LEARNING_SESSIONS_ENABLED === 'true';
const readManifest = () => JSON.parse(readFileSync(`${process.cwd()}/data/recovery_pathways.json`, 'utf8'));

export async function releasedPathways(validate = validateCurrentPathway) {
  const manifest = readManifest();
  if (!durableLearningEnabled() || process.env.RECOVERY_PATHWAYS_ENABLED !== 'true' || manifest.state !== 'released') return [];
  const pathways = manifest.pathways.map(validatePathway);
  // Every item must match current authenticated evidence, not just a release flag. The checks
  // run in parallel; the first failure by position is thrown, as the sequential loop did.
  await allInOrder(pathways.map(p => () => validate(p)));
  return pathways;
}

export async function validateCurrentPathway(p) {
  validatePathway(p);
  const registry = currentRegistry();
  const registered = registry.pathways?.[p.id];
  // The complete explanation, matrix and solver inputs need authenticated
  // pathway evidence too, not only independently valid referenced questions.
  const digest = pathwayDigest(p);
  if (p.state !== 'released' || !registered || registered.digest !== digest || registered.version !== p.version || registered.calibrationState !== 'released' || registered.ruleVersion !== p.ruleVersion || registered.sourceVersion !== p.sourceVersion) throw new Error('PATHWAY_EVIDENCE_UNAVAILABLE');
  const items = [...p.probes, ...p.repair, ...p.checks];
  const db = supabaseAdmin();
  const { data, error } = await db.from('questions').select('*').in('id', items.map(i => i.questionId));
  if (error) throw new Error('CONTENT_EVIDENCE_UNAVAILABLE');
  const current = await excludeHeldFamilies(data || [], db);
  for (const i of items) {
    const row = current.find(q => q.id === i.questionId);
    if (!row || !publicationEligibility(row).eligible || row.evidence?.record?.content_hash !== i.contentHash || row.evidence?.record?.family_id !== i.familyId) throw new Error('CONTENT_EVIDENCE_CHANGED');
  }
}

// The plan behind Today and the next-step card. The reads run in parallel (see
// learningRecordCompose.js); data/tests/learning_plan_speed.test.mjs proves the result matches
// the earlier sequential version. view 'step' leaves out the episode list, supported concepts
// and milestones, which the next-step card does not show.
export async function learningRecord(userId, { subject, minutes, view } = {}) {
  const db = supabaseAdmin();
  const validate = memoValidator(validateCurrentPathway);
  return composeLearningRecord(userId, { subject, minutes, view }, {
    env: { STUDY_GUIDED_PLAN_ENABLED: process.env.STUDY_GUIDED_PLAN_ENABLED },
    getStudyPreferences,
    getAttempts: id => Database.getAttempts(id),
    loadEpisodes: id => db.from('learning_episodes').select('*').eq('user_id', id).order('created_at', { ascending: false }),
    loadActiveSession: id => db.from('recovery_sessions').select('id,subject,mode,expires_at,selection_meta').eq('user_id', id).eq('state', 'active').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1),
    validateCurrentPathway: validate,
    releasedPathways: () => releasedPathways(validate),
    studyRecord, publicEpisode, learningPlan, guidedSequence, istDay, withPlanActions, tonightCompletion, studyMilestones,
  });
}

export async function loadEpisode(userId, id) {
  const { data, error } = await supabaseAdmin().from('learning_episodes').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
  if (error) throw new Error('LEARNING_STORAGE_UNAVAILABLE');
  if (!data) throw new Error('EPISODE_NOT_FOUND');
  return data;
}

export async function startEpisode(userId, input) {
  if (!/^[a-zA-Z0-9_-]{12,100}$/.test(input.requestKey || '')) throw new Error('INVALID_REQUEST_KEY');
  const db = supabaseAdmin();
  const { data: existing, error } = await db.from('learning_episodes').select('*').eq('user_id', userId).eq('request_key', input.requestKey).maybeSingle();
  if (error) throw new Error('LEARNING_STORAGE_UNAVAILABLE');
  if (existing) { await validateCurrentPathway(existing.pathway); return publicEpisode(existing.pathway, existing.projection, Date.now()); }
  const { data: active, error: activeError } = await db.from('learning_episodes').select('*').eq('user_id', userId).eq('concept_id', input.conceptId).not('projection->>state', 'in', '(invalidated,maintained)').order('created_at').limit(1).maybeSingle();
  if (activeError) throw new Error('LEARNING_STORAGE_UNAVAILABLE');
  if (active) { await validateCurrentPathway(active.pathway); return publicEpisode(active.pathway, active.projection, Date.now()); }
  const p = (await releasedPathways()).find(p => p.id === input.conceptId);
  if (!p) throw new Error('PATHWAY_AWAITING_SOURCES_AND_CALIBRATION');
  // Legacy attempts are exposures too; server scoring is not required to have seen a family.
  const history = await Database.getAttempts(userId);
  const seen = history.flatMap(a => a.questionsSnapshot || []);
  const e = createEpisode(p, { id: randomUUID(), at: Date.now(), seenIds: seen.map(q => q.id), seenFamilies: seen.map(q => q.familyId).filter(Boolean) });
  const user = await Database.getUserById(userId);
  const { data, error: startError } = await db.rpc('start_learning_episode', { p_row: { id: e.id, user_id: userId, request_key: input.requestKey, concept_id: p.id, pathway: p, projection: e }, p_free_period: user?.isPremium ? null : allowancePeriod('weekly_episode', Date.now()) });
  if (startError) throw new Error(/weekly/.test(startError.message) ? 'WEEKLY_ALLOWANCE_USED' : /fresh/.test(startError.message) ? 'INSUFFICIENT_FRESH_CONTENT' : 'EPISODE_CREATE_FAILED');
  return publicEpisode(data.pathway, data.projection, Date.now());
}

export async function respondEpisode(userId, id, input, { scoredCheck = false, incompleteCheck = null } = {}) {
  if (!/^[a-zA-Z0-9_-]{12,100}$/.test(input.requestKey || '')) throw new Error('INVALID_REQUEST_KEY');
  const row = await loadEpisode(userId, id);
  const db = supabaseAdmin();
  const response = { itemId: input.itemId, type: input.type, value: input.value };
  if (incompleteCheck && scoredCheck) response.incompleteReason = incompleteCheck;
  // Retry the original projection even if the current step has already advanced.
  const { data: old, error } = await db.from('learning_observations').select('response,projection').eq('episode_id', id).eq('request_key', input.requestKey).maybeSingle();
  if (error) throw new Error('LEARNING_STORAGE_UNAVAILABLE');
  if (old) {
    if (old.response.itemId !== response.itemId || old.response.type !== response.type || old.response.value !== response.value || old.response.incompleteReason !== response.incompleteReason) throw new Error('IDEMPOTENCY_CONFLICT');
    await validateCurrentPathway(row.pathway);
    return publicEpisode(row.pathway, row.projection, Date.now());
  }
  await validateCurrentPathway(row.pathway);
  const check = ['immediate_check', 'delayed_check_1', 'delayed_check_2', 'maintained'].includes(row.projection.state);
  if (check && !scoredCheck) throw new Error('SCORED_SESSION_REQUIRED');
  const projection = advanceEpisode(row.pathway, row.projection, response, Date.now(), { incompleteCheck: scoredCheck ? incompleteCheck : null });
  const { data, error: updateError } = await db.rpc('advance_learning_episode', { p_id: id, p_user: userId, p_key: input.requestKey, p_response: response, p_revision: row.revision, p_projection: projection });
  if (updateError) throw new Error(/conflict/.test(updateError.message) ? 'STEP_CONFLICT' : 'EPISODE_UPDATE_FAILED');
  return publicEpisode(row.pathway, data, Date.now());
}

export async function episodeCheckQuestion(userId, episodeId) {
  const row = await loadEpisode(userId, episodeId);
  await validateCurrentPathway(row.pathway);
  if (!['immediate_check', 'delayed_check_1', 'delayed_check_2', 'maintained'].includes(row.projection.state)) throw new Error('CHECK_NOT_PERMITTED');
  const item = permittedStep(row.pathway, row.projection, Date.now());
  if (!item) throw new Error(row.projection.nextDueAt > Date.now() ? 'CHECK_NOT_DUE' : 'INSUFFICIENT_FRESH_CONTENT');
  return { row, item, question: { id: item.questionId, subject: row.pathway.subject, chapter: row.pathway.title, text: item.prompt, options: item.options, correctIndex: item.answer, familyId: item.familyId, conceptId: row.concept_id, verificationEvidence: { content_hash: item.contentHash } } };
}
