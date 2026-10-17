import 'server-only';
// Production wiring for the Mob (src/lib/server/mob/service.js and http.js): Supabase, the central bank, the practice
// session engine and the trap atlas. The routes under src/app/api/mob import mobDeps() and nothing else.
import { randomBytes } from 'node:crypto';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { checkPersistentRateLimit, giveBackRateLimit, rateLimitWait } from '@/lib/server/rateLimit';
import { mobileOptions } from '@/lib/server/mobileCors';
import { readAtlasRows } from '@/lib/server/trapAtlas';
import { Database, questionOut } from '@/../data/db';
import { VISIBLE_QUESTION_FILTER } from '@/../data/practice_source';
import { resolveSubject } from '@/../data/subject_registry';
import { normalizeSubjectSelection } from '@/../data/cuet_controls';
import { isValidTopSyllabusPair } from '@/../data/canonical_syllabus';
import { indexAtlas, trapForOption } from '@/../data/trap_atlas';
import blocklist from '@/../data/mob_name_blocklist.json';
import { createMobService } from './service';

export const mobEnabled = () => process.env.MOB_ENABLED === 'true';
// The stop rule's switch (SOCIAL-SPEC section 13): MOB_INVITES_ENABLED=false pauses new invite links and joining by link.
// Anything else, unset included, leaves invites on. Existing Mobs keep working either way.
export const mobInvitesEnabled = () => process.env.MOB_INVITES_ENABLED !== 'false';
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

/**
 * Questions for a Mob paper from the central bank: the quick selector, with no personal exclusions, so every Mob member
 * gets the same paper. `chapter` narrows an extra paper to one chapter of the subject; `key` varies the draw.
 */
async function pickQuestionIds(subject, { mobId, week, count = 10, chapter = null, key = null }) {
  const { questions } = await Database.getQuestions(subject, count, {
    mode: 'quick', count, requestedCount: count, returnMeta: true, requireEvidence: false,
    chapters: chapter ? [chapter] : undefined, generationKey: `mob_${mobId}_${week}${key ? `_${key}` : ''}`,
  });
  return (questions || []).map((q) => q.id);
}

const validChapter = (subject, chapter) => isValidTopSyllabusPair(subject, chapter);

/**
 * Questions ready per chapter of a subject (the same visibility filter practice uses), for the extra-paper chooser.
 * Kept 10 minutes per subject on this instance: the bank changes slowly and the chooser opens often.
 */
const chapterCache = new Map();
async function chapterCounts(subject) {
  const hit = chapterCache.get(subject);
  if (hit && hit.at > Date.now() - 600_000) return hit.rows;
  const counts = new Map();
  for (let offset = 0; offset < 20_000; offset += 1000) {
    const { data, error } = await supabaseAdmin().from('questions').select('chapter').eq('subject', subject).eq('is_deleted', false)
      .or(VISIBLE_QUESTION_FILTER).order('id').range(offset, offset + 999);
    if (error) throw error;
    for (const r of data || []) if (r.chapter) counts.set(r.chapter, (counts.get(r.chapter) || 0) + 1);
    if (!data || data.length < 1000) break;
  }
  const rows = [...counts].map(([chapter, ready]) => ({ chapter, ready }));
  chapterCache.set(subject, { at: Date.now(), rows });
  return rows;
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

/**
 * Finished attempts of Mob papers. A weekly paper's attempts carry { mobId, weekStart }; an extra paper's also carry its
 * extraId, so the two are told apart here. selection_meta comes with them for the time and changes the side-by-side keeps.
 */
async function findAttempts(userIds, { mobId, week, extraId = null }) {
  const tag = extraId ? { mobPaper: { mobId, extraId } } : { mobPaper: { mobId, weekStart: week } };
  const { data, error } = await supabaseAdmin().from('attempts').select('id,user_id,correct,total,details,selection_meta,completed_at')
    .in('user_id', userIds).contains('selection_meta', tag).limit(20);
  if (error) throw error;
  return (data || [])
    .filter((r) => Boolean(r.selection_meta?.mobPaper?.extraId) === Boolean(extraId))
    .map((r) => ({ id: r.id, userId: r.user_id, correct: r.correct, total: r.total, details: r.details || [], selectionMeta: r.selection_meta || {}, completedAt: Date.parse(r.completed_at) }));
}

let cached = null;
export function mobService() {
  if (cached) return cached;
  cached = createMobService({
    rpc, secret: secret(), randomBytes: (n) => randomBytes(n), blocklist, subjectInfo,
    loadUser: (id) => Database.getUserById(id),
    validChapter, pickQuestionIds, loadQuestions, trapNameFor, findAttempts, chapterCounts, invitesEnabled: mobInvitesEnabled,
    // Lazy, because practiceSessions.js imports the sitting hook from this module.
    startPractice: async (userId, input, server) => (await import('@/lib/server/practiceSessions')).startPractice(userId, input, server),
  });
  return cached;
}

export function mobDeps() {
  return {
    enabled: mobEnabled, auth: (request) => auth(request), rateLimit: checkPersistentRateLimit, giveBack: giveBackRateLimit, waitFor: rateLimitWait,
    cors: mobileOptions, service: mobService(),
  };
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

// ---- /admin/funnel: the Mob block (SOCIAL-SPEC section 13). Aggregate counts only; the page suppresses small groups. ----

/** { ok: true, raw } or { ok: false, reason: 'off' | 'missing' | 'failed' }. */
export async function readMobMetrics(now = Date.now()) {
  if (!mobEnabled()) return { ok: false, reason: 'off' };
  try {
    return { ok: true, raw: await rpc('mob_metrics', { p_now: new Date(now).toISOString() }) };
  } catch (error) {
    return { ok: false, reason: /PGRST20[25]|42883|42P01|does not exist|schema cache|Could not find the function/i.test(`${error?.code || ''} ${error?.message || ''}`) ? 'missing' : 'failed' };
  }
}
