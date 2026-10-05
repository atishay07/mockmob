import { correctIndexOf } from './mistake_repair.js';

const text = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const optionText = option => text(typeof option === 'string' ? option : option?.text);
export function sameQuestionContent(before, after) {
  return text(before.question ?? before.body) === text(after.question ?? after.body)
    && text(before.passageText ?? before.passage_text) === text(after.passageText ?? after.passage_text)
    && Array.isArray(before.options) && Array.isArray(after.options)
    && before.options.length === after.options.length
    && before.options.every((option, i) => optionText(option) === optionText(after.options[i]));
}

// A source-backed receipt for the exact question reported by the owner. This is a display
// correction, not permission to publish other questions or to overwrite scored attempts.
export const CIRCULAR_QUEUE_CORRECTION = Object.freeze({
  questionId: 'dea6e298-269e-4b18-afd4-53c0b3be7cf5',
  body: 'Assertion: A circular queue is more efficient than a linear queue in terms of space utilization when the queue size is fixed.\nReason: A circular queue allows reuse of empty slots by wrapping around the array.',
  options: [
    'Both Assertion and Reason are true, but the Reason does not explain the Assertion.',
    'Assertion is true, but Reason is false.',
    'Assertion is false, but Reason is true.',
    'Both Assertion and Reason are true, and the Reason explains the Assertion.',
  ],
  correctIndex: 3,
  explanation: 'Both statements are true. In a fixed array, dequeuing frees slots at the front. A circular queue wraps its pointers around to reuse those slots, avoiding the false overflow of a simple linear array queue. That reuse is exactly why space is used more efficiently, so the Reason explains the Assertion.',
  source: { title: 'OpenDSA: Array-based circular queues', url: 'https://opendsa-server.cs.vt.edu/ODSA/Books/pubbook/odsa-all/fall-2019/Public_Instance/html/Queue.html', locator: '9.12.1.2 and 9.12.1.3; enqueue/dequeue increment modulo maxSize' },
  checkedAt: '2026-10-06',
});

export function answerReview(snapshot, current, detail, { evidenceEligible = false } = {}) {
  const originalIndex = correctIndexOf(snapshot);
  if (!current || current.is_deleted) return { state: 'withdrawn', originalIndex };
  if (current.status !== 'live' || current.verification_state === 'disputed') return { state: 'under_review', originalIndex };
  const currentIndex = correctIndexOf(current);
  if (!sameQuestionContent(snapshot, current)) return { state: 'content_changed', originalIndex };
  if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= current.options.length) return { state: 'under_review', originalIndex };
  if (currentIndex === originalIndex) return null;
  const receipt = current.id === CIRCULAR_QUEUE_CORRECTION.questionId
    && sameQuestionContent(CIRCULAR_QUEUE_CORRECTION, current)
    && currentIndex === CIRCULAR_QUEUE_CORRECTION.correctIndex ? CIRCULAR_QUEUE_CORRECTION : null;
  if (!receipt && !evidenceEligible) return { state: 'key_changed_unverified', originalIndex, currentIndex };
  const chosenIndex = detail?.givenIndex;
  const marksFor = index => !Number.isInteger(chosenIndex) ? 0 : chosenIndex === index ? 5 : -1;
  return { state: 'corrected', originalIndex, currentIndex,
    explanation: receipt?.explanation || text(current.explanation), source: receipt?.source || null,
    chosenIndex: Number.isInteger(chosenIndex) ? chosenIndex : null,
    originalMarks: marksFor(originalIndex), correctedMarks: marksFor(currentIndex),
    adjustment: marksFor(currentIndex) - marksFor(originalIndex),
    scoreState: 'derived_display_only', checkedAt: receipt?.checkedAt || current.validated_at || null };
}
