// The one action on a mistake in Today's weak chapters, in the words the result and Review use (release 7, owner D15:
// data/repair_presentation.mjs actionLabel). PURE.
//   a blank           Try it again
//   a wrong answer    Repair (no saved repair)
//   once repaired     Check it held until the check on a new question is taken; then See repair (it opens free), with what the check found
import { actionLabel } from '../../../data/repair_presentation.mjs';

/**
 * `m` is one of a chapter's recent misses ({ qid, outcome: 'wrong' | 'skip' }), `attempt` the saved paper (savedRepairs) and
 * `row` the mistake's repair-record row (checkedState: pending, passed, not_passed or not_available), or null.
 * Returns { label, state }: the action's words and the state word beside it (null for none).
 */
export function mistakeAction(m, attempt, row = null) {
  if (m?.outcome === 'skip') return { label: actionLabel('blank'), state: null };
  const saved = Boolean(attempt?.savedRepairs?.[m?.qid]) || Boolean(row);
  if (!saved) return { label: actionLabel('open'), state: null };
  if (row?.checkedState === 'pending') return { label: actionLabel('check'), state: 'Repaired' };
  if (row?.checkedState === 'passed') return { label: actionLabel('held'), state: 'Held' };
  if (row?.checkedState === 'not_passed') return { label: actionLabel('slipped'), state: 'Slipped' };
  return { label: actionLabel('see'), state: 'Repaired' };
}
