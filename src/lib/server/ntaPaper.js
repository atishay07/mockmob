import 'server-only';
import { NTA_MIN_SERVE_QUESTIONS } from '@/../data/nta_engine';

/**
 * NTA mode starts only from a paper the engine served: 'exact', or 'closest' with at least
 * NTA_MIN_SERVE_QUESTIONS questions and its differences listed. Anything else is refused before a
 * session or credit exists, with the engine's message for the student.
 */
export function assertNtaPaperServable(questions, meta, code = 'INSUFFICIENT_PRACTICE_CONTENT') {
  const paper = meta?.ntaPaper;
  if (paper && paper.status !== 'refused' && questions.length >= NTA_MIN_SERVE_QUESTIONS) return;
  const error = new Error(code);
  error.publicMessage = paper?.notice?.summary || meta?.message || 'NTA mode is not ready for this subject yet. Try a Full Mock instead.';
  error.publicDetail = { reason: paper?.refusal?.reason || 'unavailable', items: paper?.notice?.items || [] };
  throw error;
}
