import 'server-only';
// L4 (15 Nov 2026): which start of POST /api/sessions is a real recovery, the path whose Quick 5 is free (recoverySessions.js
// startSession). Only an episode check, or a fresh-question replay of a chapter that the student's own attempt (not a Mob
// paper still held) missed: what /api/recovery/replay and Repair's practice link offer. Every other start takes the Practice
// path, with its normal charge and the daily included set (practiceSessions.js startPractice). Prices are unchanged.
import { Database } from '@/../data/db';
import { normalizeSubjectSelection } from '@/../data/cuet_controls';
import { canonicalChapterName } from '@/../data/canonical_syllabus';
import { isHeld } from '@/lib/server/answerHold';

export async function isRecoveryStart(userId, body) {
  if (body?.episodeId) return true;
  const from = body?.recoveryFrom;
  const chapter = typeof body?.chapter === 'string' ? body.chapter.trim() : '';
  if (typeof from !== 'string' || !from || from.length > 100 || !chapter) return false;
  let attempt;
  // A failed read is not a reason to charge a replay that was offered free: nothing starts, and the student can try again.
  try { attempt = await Database.getAttemptById(from); } catch { throw new Error('SESSION_CREATE_FAILED'); }
  if (!attempt || attempt.userId !== userId || isHeld(attempt)) return false;
  const subject = normalizeSubjectSelection({ subject: body.subject }).internalSubject;
  if (!subject || subject !== attempt.subject) return false;
  const missed = new Set((attempt.details || []).filter((d) => d?.isCorrect !== true).map((d) => d?.qid));
  const wanted = canonicalChapterName(subject, chapter);
  return (attempt.questionsSnapshot || []).some((q) => missed.has(q?.id) && typeof q.chapter === 'string'
    && (q.chapter === chapter || canonicalChapterName(subject, q.chapter) === wanted));
}
