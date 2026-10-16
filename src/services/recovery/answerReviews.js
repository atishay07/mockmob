import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { publicationEligibility, sharedEligibilitySnapshot } from '@/../data/evidence_registry';
import { computeAnswerReviews, readFullQuestionRows, readQuestionRows } from '@/../data/question_reads';

// The result page's review of each question's current key. Reads the question rows without the signed evidence
// record and reads the full rows only for questions whose key changed since the session (data/question_reads.js).
export async function readAnswerReviews(attempt) {
  if (!(attempt.questionsSnapshot || []).length) return { answerReviews: {}, answerReviewState: 'ready' };
  const db = supabaseAdmin();
  // Registry and calibration parsed once per server instance, not once per question (4.9 MB each time).
  return computeAnswerReviews({
    attempt,
    readRows: (ids) => readQuestionRows(db, ids),
    readFullRows: (ids) => readFullQuestionRows(db, ids),
    eligible: (row) => publicationEligibility(row, sharedEligibilitySnapshot()).eligible,
  });
}
