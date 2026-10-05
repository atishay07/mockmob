import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { answerReview } from '@/../data/answer_corrections.mjs';
import { publicationEligibility } from '@/../data/evidence_registry';

export async function readAnswerReviews(attempt) {
  const snapshots = attempt.questionsSnapshot || [];
  if (!snapshots.length) return { answerReviews: {}, answerReviewState: 'ready' };
  const { data, error } = await supabaseAdmin().from('questions').select('*').in('id', snapshots.map(q => q.id));
  if (error) return { answerReviews: {}, answerReviewState: 'unavailable' };
  const current = new Map((data || []).map(q => [q.id, q]));
  const details = new Map((attempt.details || []).map(d => [d.qid, d]));
  const answerReviews = {};
  for (const q of snapshots) {
    const row = current.get(q.id);
    const review = answerReview(q, row, details.get(q.id), { evidenceEligible: !!row && publicationEligibility(row).eligible });
    if (review) answerReviews[q.id] = review;
  }
  return { answerReviews, answerReviewState: 'ready' };
}
