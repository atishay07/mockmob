import 'server-only';
import { NTA_MIN_SERVE_QUESTIONS } from '@/../data/nta_engine';

// Refusals the question bank decides. The engine works a refusal out with a fixed seed, so the same
// sentence comes back on every retry: detail.retryable is false and a client offers another way
// forward (a Full Mock) instead of "Try again".
export const NTA_BANK_REFUSALS = new Set(['no_scored_questions', 'no_passage_sets', 'too_few_questions']);

/**
 * NTA mode starts only from a paper the engine served: 'exact', or 'closest' with at least
 * NTA_MIN_SERVE_QUESTIONS questions and its differences listed. Anything else is refused before a
 * session or credit exists, with the engine's message for the student. detail: { reason, cause (why
 * no question was eligible, when that is the reason), retryable, items (what the bank is short of) }.
 */
export function assertNtaPaperServable(questions, meta, code = 'INSUFFICIENT_PRACTICE_CONTENT') {
  const paper = meta?.ntaPaper;
  if (paper && paper.status !== 'refused' && questions.length >= NTA_MIN_SERVE_QUESTIONS) return;
  const error = new Error(code);
  const reason = paper?.refusal?.reason || 'unavailable';
  error.publicMessage = paper?.notice?.summary || meta?.message || 'NTA mode is not ready for this subject yet. Try a Full Mock instead.';
  error.publicDetail = { reason, ...(paper?.refusal?.cause ? { cause: paper.refusal.cause } : {}), retryable: !NTA_BANK_REFUSALS.has(reason), items: paper?.notice?.items || [] };
  throw error;
}

const LETTERS = 'ABCDE';
const keyAt = (options, i) => (options[i] && typeof options[i] === 'object' && options[i].key != null ? String(options[i].key).trim().toUpperCase() : LETTERS[i]);

/**
 * The option layout of a served NTA paper, stored with the session next to the questions it describes.
 *
 * The session snapshot already holds exactly what the student saw: the options in their served order
 * and the answer key remapped to that order (scoring reads the snapshot, never the bank). This adds
 * what the engine says about how the options were arranged, so a result can always be explained and a
 * resume can never show a different order than the one that was scored:
 *   order[qid]  the engine's option permutation for the question: served position i shows stored
 *               option order[i] (the identity when the question's options had to stay in place)
 *   key[qid]    the letter of the correct option as served (position after any shuffle)
 *   shuffled    true when at least one question's options were actually moved
 * A shuffle that left the key pointing at the wrong option cannot become a scored session: it is
 * refused here, before a session or a credit exists.
 *
 * Engine contract (data/nta_item_checks.js ntaServedRow, called by assembleNtaPaper): every served row
 * carries `nta_option_order` and `nta_options_shuffled`, its options already relabelled A, B, C, D in
 * served order, and `correct_index` / `correct_answer` remapped. Database.getNtaPaper passes the order on
 * each question as `optionOrder`. The order is seeded by (generation key, question id), so the same
 * key always serves the same order: a resume, a replay and the stored snapshot agree.
 * Also read: `option_order` / `nta_option_order` on a question, and `meta.ntaPaper.optionOrder[qid]`.
 */
export function ntaOptionLayout(questions, meta, code = 'INSUFFICIENT_PRACTICE_CONTENT') {
  const order = {};
  const key = {};
  for (const q of questions) {
    const options = Array.isArray(q.options) ? q.options : [];
    const given = q.optionOrder ?? q.nta_option_order ?? q.option_order ?? meta?.ntaPaper?.optionOrder?.[q.id] ?? null;
    const served = Number.isInteger(q.correctIndex) ? q.correctIndex : -1;
    const bad = (reason) => {
      const error = new Error(code);
      error.publicMessage = 'This paper could not be prepared safely, so it was not started. Try again, or take a Full Mock instead. No credits were charged.';
      error.publicDetail = { reason, items: [] };
      throw error;
    };
    if (given !== null) {
      const sorted = Array.isArray(given) ? [...given].sort((a, b) => a - b) : null;
      if (!sorted || sorted.length !== options.length || sorted.some((value, i) => value !== i)) bad('option_order_invalid');
      if (!options.every((_, i) => keyAt(options, i) === LETTERS[i])) bad('option_letters_not_in_order');
      order[q.id] = [...given];
    }
    if (served >= 0 && served < options.length) {
      // The stored letter, when there is one, must name the option the index points at.
      const letter = String(q.correctAnswer ?? q.correct_answer ?? '').trim().toUpperCase();
      if (/^[A-E]$/.test(letter) && letter !== keyAt(options, served)) bad('answer_key_not_remapped');
      key[q.id] = keyAt(options, served);
    }
  }
  const moved = Object.values(order).some((permutation) => permutation.some((original, position) => original !== position));
  return { version: 1, shuffled: moved, order, key };
}
