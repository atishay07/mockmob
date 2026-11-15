// O5, tomorrow on the result (15 Nov 2026): one quiet line under the next move that names the real reason to come back,
// built only from facts the page can prove. Nothing is shown when the facts are not there.
//
//   1. This paper's wrong answers that come back in Revise. The fact is lab.prove.later, which the server builds for this
//      paper from the student's own Revise cards (src/app/api/attempts/[id]/route.js: cardsFor, the same planSeeds the
//      Revise read seeds with; data/revise.js buildLater). It names the first day any of them is due and how many come back
//      that day (never more than Revise's 10 a day). A wrong answer is due the day after it was given, so a set finished
//      tonight says "Tomorrow". "About N minutes" is Revise's own estimate for that many (data/revise.js minutesFor).
//   2. No wrong answers on this paper (nothing comes back in Revise): on Free, when today's included 10-question set exists
//      for this student (the quote's allowance, src/lib/dailySet.mjs), a new one opens tomorrow. Pro has no included set,
//      and an allowance that is off or could not be read says nothing.
// Pure, no React.
import { minutesFor } from '../../../data/revise.js';

const WHEN = new Set(['now', 'tomorrow', 'day']);
export const TOMORROW_FREE_SET = 'Tomorrow: one free 10-question set is waiting.';

/**
 * Whether today's included set exists for this student, from a GET /api/practice/quote body for a Quick set of 10:
 *   true   the allowance is on for this student (its state is 'available' or 'used' today; either way a new one opens tomorrow)
 *   false  the quote says there is no allowance (it is off, or the student is Pro)
 *   null   unknown (no quote, a failed read, or the allowance read failed)
 */
export function dailySetTomorrow(quote) {
  if (!quote || typeof quote !== 'object') return null;
  const allowance = quote.allowance;
  if (allowance && typeof allowance === 'object') {
    if (allowance.kind && (allowance.state === 'available' || allowance.state === 'used')) return true;
    return null;
  }
  if (allowance === null && typeof quote.creditCost === 'number') return false;
  return null;
}

/** The later block when it can be read: { count, when, dayLabel } with a positive count, else null. */
export function readLater(later) {
  if (!later || typeof later !== 'object' || later.state !== 'scheduled') return null;
  const count = Number(later.count);
  if (!Number.isInteger(count) || count < 1 || !WHEN.has(later.when)) return null;
  if (later.when === 'day' && (typeof later.dayLabel !== 'string' || !later.dayLabel.trim())) return null;
  return { count, when: later.when, dayLabel: later.dayLabel || null };
}

/**
 * The line, or null for nothing.
 *   later          attempt.lab.prove.later (or null)
 *   wrong          this paper's wrong answers (analysis.marks.wrong)
 *   isPremium      the student's plan
 *   dailyTomorrow  dailySetTomorrow(quote): true | false | null
 */
export function tomorrowLine({ later = null, wrong = 0, isPremium = false, dailyTomorrow = null } = {}) {
  const due = readLater(later);
  if (due) {
    const lead = due.when === 'tomorrow' ? 'Tomorrow' : due.when === 'now' ? 'Today' : due.dayLabel;
    const one = due.count === 1;
    const who = one ? 'this mistake' : `these ${due.count} mistakes`;
    const verb = due.when === 'now' ? (one ? 'is due' : 'are due') : one ? 'comes back' : 'come back';
    return `${lead}: ${who} ${verb} in Revise. About ${minutesFor(due.count)} minutes.`;
  }
  if (Number(wrong) === 0 && !isPremium && dailyTomorrow === true) return TOMORROW_FREE_SET;
  return null;
}

/** Whether the page needs the quote at all: only for a paper with no wrong answers, on Free, with no Revise line. */
export function needsDailyRead({ later = null, wrong = 0, isPremium = false } = {}) {
  return !readLater(later) && Number(wrong) === 0 && !isPremium;
}
