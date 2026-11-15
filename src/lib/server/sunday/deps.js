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
import { drawPaper } from './draw';
import { sundayMockEnabled } from '@/lib/sundayFlag.mjs';

// The kill switch (src/lib/sundayFlag.mjs): SUNDAY_MOCK_ENABLED=false turns the Sunday Mock off; unset leaves it on.
export { sundayMockEnabled };
// The generation key's secret (service.js sundayGenerationKey): any of these server secrets; each student's key stays unguessable.
const secret = () => process.env.SUNDAY_MOCK_SECRET || process.env.PRACTICE_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/** A launchable CUET subject: the stored id the practice engine uses, its public id (the runner's address) and official name. */
function subjectInfo(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > 60) return { ok: false };
  const resolved = resolveSubject(raw);
  const selection = normalizeSubjectSelection({ subject: raw });
  if (!resolved?.launch || !selection.valid) return { ok: false };
  return { ok: true, id: selection.internalSubject, publicId: toPublicSubjectId(selection.internalSubject), name: resolved.officialName };
}

// The paper rows live in learning_allowances (./store.js); the draw reads the subject's past Sunday papers from it.
const store = createSundayStore(() => supabaseAdmin());

/**
 * The week's paper from the central bank (./draw.js): the Full mock selector with a seeded order (an HMAC of the Sunday and the
 * subject under the server secret), no personal exclusions, and the subject's last 8 Sunday papers left out. `exclude`: ids that
 * must not be drawn (the frozen ones, when a withdrawn question is replaced).
 */
async function pickPaper(subject, week, { exclude = [] } = {}) {
  return drawPaper({
    secret: secret(), subject, week, extraExclude: exclude, readPaper: (period) => store.readPaper(period),
    getQuestions: (s, n, opts) => Database.getQuestions(s, n, { mode: 'full', count: n, requestedCount: n, returnMeta: true, requireEvidence: false, ...opts }),
  });
}

// The frozen paper's full rows through the stamp cache (data/mob_question_reads.js loadFull): withdrawn questions are left out.
const loaders = createMobQuestionLoaders({ db: () => supabaseAdmin(), attach: (rows) => Database._attachPassageMetadata(rows), toOut: questionOut });

let cached = null;
export function sundayService() {
  if (cached) return cached;
  cached = createSundayService({
    secret: secret(),
    store,
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
