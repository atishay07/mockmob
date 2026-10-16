import 'server-only';
// Production wiring for the Mob (src/lib/server/mob/service.js and http.js): Supabase, the central bank, the practice
// session engine and the trap atlas. The routes under src/app/api/mob import mobDeps() and nothing else.
import { randomBytes } from 'node:crypto';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { mobileOptions } from '@/lib/server/mobileCors';
import { durableLearningEnabled } from '@/lib/server/learning';
import { readAtlasRows } from '@/lib/server/trapAtlas';
import { Database, questionOut, VISIBLE_QUESTION_FILTER } from '@/../data/db';
import { resolveSubject } from '@/../data/subject_registry';
import { normalizeSubjectSelection } from '@/../data/cuet_controls';
import { allowancePeriod } from '@/../data/learning_engine';
import { indexAtlas, trapForOption } from '@/../data/trap_atlas';
import blocklist from '@/../data/mob_name_blocklist.json';
import { createMobService } from './service';

export const mobEnabled = () => process.env.MOB_ENABLED === 'true';
const secret = () => process.env.MOB_ID_SECRET || process.env.NEXTAUTH_SECRET || process.env.PRACTICE_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function rpc(name, params) {
  const { data, error } = await supabaseAdmin().rpc(name, params);
  if (error) throw error;
  return data;
}

/** A launchable CUET subject: the stored id the practice engine uses and its official name. */
function subjectInfo(raw) {
  const resolved = resolveSubject(raw);
  const selection = normalizeSubjectSelection({ subject: raw });
  if (!resolved.launch || !selection.valid) return { ok: false };
  return { ok: true, id: selection.internalSubject, name: resolved.officialName };
}

async function readAllowanceUsed(userId) {
  const { data, error } = await supabaseAdmin().from('learning_allowances').select('kind')
    .eq('user_id', userId).eq('kind', 'daily_practice').eq('period', allowancePeriod('daily_practice', Date.now())).maybeSingle();
  return error ? null : Boolean(data);
}

/** Ten questions for the Mob's subject from the central bank: the quick selector, with no personal exclusions. */
async function pickQuestionIds(subject, { mobId, week }) {
  const { questions } = await Database.getQuestions(subject, 10, {
    mode: 'quick', count: 10, requestedCount: 10, returnMeta: true, requireEvidence: false, generationKey: `mob_${mobId}_${week}`,
  });
  return (questions || []).map((q) => q.id);
}

/** The frozen paper's questions in paper order, canonical option order (quick papers never shuffle options). */
async function loadQuestions(ids) {
  const list = (ids || []).filter((id) => typeof id === 'string').slice(0, 20);
  if (!list.length) return [];
  const { data, error } = await supabaseAdmin().from('questions').select('*').in('id', list).eq('is_deleted', false).or(VISIBLE_QUESTION_FILTER);
  if (error) throw error;
  const rows = await Database._attachPassageMetadata(data || []);
  const byId = new Map(rows.map((r) => [r.id, questionOut(r)]));
  return list.map((id) => byId.get(id)).filter(Boolean);
}

async function trapNameFor(question, optionIndex) {
  if (!question?.id) return null;
  const atlas = indexAtlas(await readAtlasRows([question.id]));
  return trapForOption({ question, index: optionIndex, atlasByHash: atlas.get(question.id) || null })?.label || null;
}

async function findAttempts(userIds, { mobId, week }) {
  const { data, error } = await supabaseAdmin().from('attempts').select('id,user_id,correct,total,details,completed_at')
    .in('user_id', userIds).contains('selection_meta', { mobPaper: { mobId, weekStart: week } }).limit(20);
  if (error) throw error;
  return (data || []).map((r) => ({ id: r.id, userId: r.user_id, correct: r.correct, total: r.total, details: r.details || [], completedAt: Date.parse(r.completed_at) }));
}

let cached = null;
export function mobService() {
  if (cached) return cached;
  cached = createMobService({
    rpc, secret: secret(), randomBytes: (n) => randomBytes(n), blocklist, subjectInfo,
    loadUser: (id) => Database.getUserById(id),
    allowanceEnabled: durableLearningEnabled(), readAllowanceUsed,
    pickQuestionIds, loadQuestions, trapNameFor, findAttempts,
    // Lazy, because practiceSessions.js imports the sitting hook from this module.
    startPractice: async (userId, input, server) => (await import('@/lib/server/practiceSessions')).startPractice(userId, input, server),
  });
  return cached;
}

export function mobDeps() {
  return { enabled: mobEnabled, auth: (request) => auth(request), rateLimit: checkPersistentRateLimit, cors: mobileOptions, service: mobService() };
}

/** finishPractice's hook (see practiceSessions.js). Never throws. */
export async function recordMobSitting(userId, attempt) {
  if (!mobEnabled()) return 'skipped';
  return mobService().recordFromAttempt(userId, attempt);
}

// ---- Moderation: the "Mob reports" list (moderators only; the route checks the role) ----

export async function listMobReports() {
  const { data, error } = await supabaseAdmin().from('mob_reports').select('id,reason,reported_name,created_at,mob_id,reported_id')
    .is('resolved_at', null).order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  // Reason, the name as reported and the date. Ids stay on the server; canRemove says the member is still in that Mob.
  return (data || []).map((r) => ({ id: r.id, reason: r.reason, name: r.reported_name || null, createdAt: r.created_at, canRemove: Boolean(r.mob_id && r.reported_id) }));
}

export async function resolveMobReport(id, { remove = false } = {}) {
  const db = supabaseAdmin();
  const { data: row, error } = await db.from('mob_reports').select('id,mob_id,reported_id,resolved_at').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!row) return 'not_found';
  let removed = null;
  if (remove && row.mob_id && row.reported_id) removed = await rpc('mob_remove', { p_actor: null, p_mob_id: row.mob_id, p_target: row.reported_id });
  const { error: e2 } = await db.from('mob_reports').update({ resolved_at: new Date().toISOString() }).eq('id', id);
  if (e2) throw e2;
  return removed === 'removed' ? 'removed' : 'resolved';
}
