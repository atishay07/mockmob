// B7 (15 Nov 2026): the Lab's regular set ("Practise <chapter>" in Prove, when no five fresh questions are ready) starts
// nothing itself. It opens Practice with the subject, the chapter and 10 questions chosen, where the price (or "Free: today's
// included set") shows before anything starts, as every other start does (data/result_next_move.mjs practiseHref).
// Pure, no React.
import { practiceSubjectId } from '../../lib/paperCopy.mjs';
import { PRICE_AT_START_LINE } from '../../lib/dailySet.mjs';

export const LAB_SET_SIZE = 10;
export const LAB_PRICE_LINE = PRICE_AT_START_LINE;

/** { href, label } for the Lab's regular set on `chapter` (or the subject, without one). */
export function labPracticeLink({ subject, chapter = null } = {}) {
  const p = new URLSearchParams({ subject: practiceSubjectId(subject) || '', mode: 'quick', count: String(LAB_SET_SIZE) });
  if (chapter) p.set('chapter', chapter);
  return { href: `/dashboard?${p}`, label: chapter ? `Practise ${LAB_SET_SIZE} on ${chapter}` : `Practise ${LAB_SET_SIZE} more` };
}
