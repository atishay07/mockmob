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
import { cachedChapterCounts, forgetChapterCountsFor } from '@/../data/mob_chapter_counts';
import { createMobQuestionLoaders } from '@/../data/mob_question_reads';
import { resolveSubject } from '@/../data/subject_registry';
import { normalizeSubjectSelection } from '@/../data/cuet_controls';
import { isValidTopSyllabusPair } from '@/../data/canonical_syllabus';
import { storedNamesFor } from '@/../data/cuet_syllabus';
import { ntaPatternFor } from '@/../data/nta_paper_pattern';
import { indexAtlas, trapForOption } from '@/../data/trap_atlas';
import blocklist from '@/../data/mob_name_blocklist.json';
import { playBillingEnabled } from '@/lib/payments/playBilling';
import { createMobService } from './service';

export const mobEnabled = () => process.env.MOB_ENABLED === 'true';
// The stop rule's switch (SOCIAL-SPEC section 13): MOB_INVITES_ENABLED=false pauses new invite links and joining by link.
// Anything else, unset included, leaves invites on. Existing Mobs keep working either way.
export const mobInvitesEnabled = () => process.env.MOB_INVITES_ENABLED !== 'false';
// Mob v3 (MOB-BUILD-SPEC-V3): MOB_V3_ENABLED gates everything new (its four migrations must be applied first);
// MOB_LIVE_ENABLED gates live rooms (Phase B). Both are read on every request.
export const mobV3Enabled = () => process.env.MOB_V3_ENABLED === 'true';
export const mobLiveEnabled = () => process.env.MOB_LIVE_ENABLED === 'true';
// MOB_FORMATS_ENABLED: races and Full mock together (owner D167). Needs migration 20261020140000_mob_v3_formats first;
// off, the picker offers only sprint, round and rematch and a race or mock start is refused (BODY_INVALID).
export const mobFormatsEnabled = () => process.env.MOB_FORMATS_ENABLED === 'true';
// MOB_LIVE_MAX_ROOMS: live rooms open across MockMob at once (default 30, read every request; see src/lib/mob/live.mjs).
export const mobLiveMaxRooms = () => process.env.MOB_LIVE_MAX_ROOMS;
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
 * Questions for a Mob paper from the central bank: the quick selector (a Full mock together: the full-mock selector, the
 * CUET pattern), with no personal exclusions, so every Mob member gets the same paper. `chapter` narrows an extra paper to
 * one chapter of the subject; `key` varies the draw. `exclude`: question ids that must not be drawn (the Mob's open and
 * recent games and held papers, web-security 20 Oct #2): the draw asks for that many more and drops them, in order.
 */
async function pickQuestionIds(subject, { mobId, week, count = 10, chapter = null, key = null, mode = 'quick', exclude = [] }) {
  const skip = new Set(Array.isArray(exclude) ? exclude : []);
  const ask = Math.min(100, count + Math.min(skip.size, 40));
  const { questions } = await Database.getQuestions(subject, ask, {
    mode: mode === 'full' ? 'full' : 'quick', count: ask, requestedCount: ask, returnMeta: true, requireEvidence: false,
    // Syllabus v2: the chapter's every stored spelling (an alias may still be on rows); retired chapters never resolve.
    chapters: chapter ? (storedNamesFor(subject, chapter).length ? storedNamesFor(subject, chapter) : [chapter]) : undefined, generationKey: `mob_${mobId}_${week}${key ? `_${key}` : ''}`,
  });
  return (questions || []).map((q) => q.id).filter((id) => !skip.has(id));
}

/**
 * A paper's sections for the Mob's mark sheets: per question, its syllabus unit (English: its pattern section).
 * { key, label } or null when the chapter is not on the syllabus.
 */
function sectionsFor(subject, questions) {
  const pattern = ntaPatternFor(subject);
  const english = pattern?.kind === 'language';
  const units = new Map((pattern?.chapters || []).map((c) => [c.chapter, { key: `unit_${c.unitIndex}`, label: c.unit }]));
  return (questions || []).map((q) => {
    const chapter = String(q?.chapter || '').trim();
    if (english) {
      if (pattern.passages.chapters.includes(chapter)) return { key: pattern.passages.sectionId, label: pattern.passages.label };
      const s = pattern.sections.find((x) => x.chapters.includes(chapter));
      return s ? { key: s.id, label: s.label } : null;
    }
    return units.get(chapter) || null;
  });
}

const validChapter = (subject, chapter) => isValidTopSyllabusPair(subject, chapter);

/**
 * For the extra-paper chooser: per chapter of a subject, the longest extra paper the bank can really build (data/mob_chapter_counts.js
 * has the computation and the rule for keeping it: five minutes, then revalidated against the subject's rows, the family holds and
 * the evidence expiry, a day at most; only a Pro opening the chooser reads it). A failed extra drops the subject so the next look is fresh.
 */
export const forgetChapterCounts = (subject) => forgetChapterCountsFor(supabaseAdmin(), subject);
const chapterCounts = (subject) => cachedChapterCounts(supabaseAdmin(), subject);

// The frozen paper's questions in paper order, canonical option order (quick papers never shuffle options). Two loaders, because only the
// start paths hand the rows to the practice session (data/mob_question_reads.js has the rule): `loadQuestions` reads the full rows
// through the stamp cache, `loadQuestionsLight` serves every other read (keys, review, the race's next question, comparisons) from
// the light columns kept two minutes.
const questionLoaders = createMobQuestionLoaders({ db: () => supabaseAdmin(), attach: (rows) => Database._attachPassageMetadata(rows), toOut: questionOut });
const loadQuestions = (ids) => questionLoaders.loadFull(ids);
const loadQuestionsLight = (ids, options) => questionLoaders.loadLight(ids, options);

async function trapNameFor(question, optionIndex) {
  if (!question?.id) return null;
  const atlas = indexAtlas(await readAtlasRows([question.id]));
  return trapForOption({ question, index: optionIndex, atlasByHash: atlas.get(question.id) || null })?.label || null;
}

/**
 * Finished attempts of Mob papers. A weekly paper's attempts carry { mobId, weekStart }; an extra paper's also carry its
 * extraId, so the two are told apart here. selection_meta comes with them for the time and changes the side-by-side keeps.
 */
async function findAttempts(userIds, { mobId, week, extraId = null, gameId = null }) {
  const tag = gameId ? { mobPaper: { mobId, gameId } } : extraId ? { mobPaper: { mobId, extraId } } : { mobPaper: { mobId, weekStart: week } };
  const { data, error } = await supabaseAdmin().from('attempts').select('id,user_id,correct,total,details,selection_meta,completed_at')
    .in('user_id', userIds).contains('selection_meta', tag).limit(20);
  if (error) throw error;
  // A weekly paper is neither an extra paper nor a Mob game's full mock (both carry the week too).
  return (data || [])
    .filter((r) => Boolean(r.selection_meta?.mobPaper?.extraId) === Boolean(extraId) && Boolean(r.selection_meta?.mobPaper?.gameId) === Boolean(gameId))
    .map((r) => ({ id: r.id, userId: r.user_id, correct: r.correct, total: r.total, details: r.details || [], selectionMeta: r.selection_meta || {}, completedAt: Date.parse(r.completed_at) }));
}

let cached = null;
export function mobService() {
  if (cached) return cached;
  cached = createMobService({
    rpc, secret: secret(), randomBytes: (n) => randomBytes(n), blocklist, subjectInfo,
    loadUser: (id) => Database.getUserById(id),
    validChapter, pickQuestionIds, loadQuestions, loadQuestionsLight, trapNameFor, findAttempts, chapterCounts, sectionsFor, forgetChapterCounts, invitesEnabled: mobInvitesEnabled,
    v3Enabled: mobV3Enabled, liveEnabled: mobLiveEnabled, formatsEnabled: mobFormatsEnabled, liveMaxRooms: mobLiveMaxRooms, billingOn: () => playBillingEnabled(),
    // Lazy, because practiceSessions.js imports the sitting hook from this module.
    startPractice: async (userId, input, server) => (await import('@/lib/server/practiceSessions')).startPractice(userId, input, server),
  });
  return cached;
}

export function mobDeps() {
  return {
    enabled: mobEnabled, v3Enabled: mobV3Enabled, liveEnabled: mobLiveEnabled, auth: (request) => auth(request), rateLimit: checkPersistentRateLimit, giveBack: giveBackRateLimit, waitFor: rateLimitWait,
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
