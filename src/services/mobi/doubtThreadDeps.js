import 'server-only';
// The real dependencies of the doubt thread (src/services/mobi/doubtThread.js): the thread store on mentor_sessions, the
// bank reads and the `seen` and progress writes the repair check already uses, and the model client for the follow-up.
import { supabaseAdmin } from '@/lib/supabase';
import { Database } from '@/../data/db';
import { SUBJECTS } from '@/../data/subjects';
import { toInternalSubjectId, toPublicSubjectId } from '@/../data/cuet_controls';
import { createCheckStore } from '@/services/recovery/repairCheckStore';
import { createThreadStore } from './threadStore';
import { buildReplyDeps } from '@/services/prepos/replyDeps';
import { userLimitMessage } from '@/../data/repair_failures';

/** Every chapter of the student's subjects (or of every subject when none is chosen): [{ subject, chapter }] with public subject ids. */
export function chapterCatalog(user) {
  const mine = new Set((Array.isArray(user?.subjects) ? user.subjects : []).map((s) => toPublicSubjectId(toInternalSubjectId(s))));
  const list = SUBJECTS.filter((s) => !mine.size || mine.has(toPublicSubjectId(s.id)));
  return list.flatMap((s) => (s.chapters || []).map((chapter) => ({ subject: toPublicSubjectId(s.id), chapter })));
}

export function buildThreadDeps({ user }) {
  const db = supabaseAdmin();
  const checks = createCheckStore({ db, recordProgress: (args) => Database._recordAttemptProgress(args) });
  const reply = buildReplyDeps({ user });
  return {
    ...createThreadStore({ db }),
    now: () => Date.now(),
    // The bank stores internal subject ids (gat); the thread keeps the public one (general_test).
    loadChapterCandidates: ({ subject, chapter }) => checks.loadChapterCandidates({ subject: toInternalSubjectId(subject), chapter }),
    loadSeen: (args) => checks.loadSeen({ ...args, subject: toInternalSubjectId(args.subject) }),
    loadExcluded: checks.loadExcluded,
    verifyPublished: checks.verifyPublished,
    recordSeen: checks.recordSeen,
    recordProgress: checks.recordProgress,
    generate: ({ requestKey, message, context, maxTokens }) => reply.generate({ requestKey, tier: 'fast', mode: 'revision', message, context, maxTokens }),
    sanitize: reply.sanitize,
    limitMessage: () => userLimitMessage(new Date()),
  };
}
