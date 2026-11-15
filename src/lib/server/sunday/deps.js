import 'server-only';
// Production wiring for the Sunday Mock (./service.js, ./http.js, ./store.js): Supabase, the central bank's Full mock selector,
// the Mob's frozen-paper question loader and the practice session engine. The routes under src/app/api/sunday import sundayDeps().
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { mobileOptions } from '@/lib/server/mobileCors';
import { Database, questionOut } from '@/../data/db';
import { createMobQuestionLoaders } from '@/../data/mob_question_reads';
import { resolveSubject } from '@/../data/subject_registry';
import { normalizeSubjectSelection, toPublicSubjectId } from '@/../data/cuet_controls';
import { servedOut } from '@/../data/option_order';
import { createSundayService } from './service';
import { createSundayStore } from './store';

// The kill switch: SUNDAY_MOCK_ENABLED=false turns every /api/sunday route, the Today card, the Practice row, the den block and
// the public page off. Anything else (unset included) leaves the Sunday Mock on: it needs no migration.
export const sundayMockEnabled = () => process.env.SUNDAY_MOCK_ENABLED !== 'false';
const secret = () => process.env.SUNDAY_MOCK_SECRET || process.env.PRACTICE_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/** A launchable CUET subject: the stored id the practice engine uses, its public id (the runner's address) and official name. */
function subjectInfo(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > 60) return { ok: false };
  const resolved = resolveSubject(raw);
  const selection = normalizeSubjectSelection({ subject: raw });
  if (!resolved?.launch || !selection.valid) return { ok: false };
  return { ok: true, id: selection.internalSubject, publicId: toPublicSubjectId(selection.internalSubject), name: resolved.officialName };
}

/**
 * The week's paper from the central bank: the Full mock selector (the CUET pattern, 50 questions), with no personal exclusions
 * and a key fixed by the Sunday and subject, so the draw is the same for everyone. `exclude`: ids that must not be drawn (the
 * frozen ones, when a withdrawn question is replaced).
 */
async function pickPaper(subject, week, { exclude = [] } = {}) {
  const skip = new Set(Array.isArray(exclude) ? exclude : []);
  const ask = Math.min(100, 50 + Math.min(skip.size, 40));
  const { questions } = await Database.getQuestions(subject, ask, {
    mode: 'full', count: ask, requestedCount: ask, returnMeta: true, requireEvidence: false, generationKey: `sunday_${week}_${subject}`,
  });
  return (questions || []).map((q) => q.id).filter((id) => !skip.has(id));
}

// The frozen paper's full rows through the stamp cache (data/mob_question_reads.js loadFull): withdrawn questions are left out.
const loaders = createMobQuestionLoaders({ db: () => supabaseAdmin(), attach: (rows) => Database._attachPassageMetadata(rows), toOut: questionOut });

let cached = null;
export function sundayService() {
  if (cached) return cached;
  cached = createSundayService({
    secret: secret(),
    store: createSundayStore(() => supabaseAdmin()),
    loadUser: (id) => Database.getUserById(id),
    subjectInfo,
    pickPaper,
    loadQuestions: (ids) => loaders.loadFull(ids),
    serve: servedOut,
    // Lazy: practiceSessions.js pulls in the whole practice engine.
    startPractice: async (userId, input, server) => (await import('@/lib/server/practiceSessions')).startPractice(userId, input, server),
  });
  return cached;
}

export function sundayDeps() {
  return { enabled: sundayMockEnabled, auth: (request) => auth(request), rateLimit: checkPersistentRateLimit, cors: mobileOptions, service: sundayService() };
}
