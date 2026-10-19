// Common sets of CUET subjects, one tap (the app's SubjectSets, flutter_app lib/features/onboarding/data/subject_sets.dart; the owner
// praised them on 19 Oct, G9). Nothing is ticked until the student taps one. With a course chosen, only the sets that keep that
// course open are offered (so BMS gets the sets with Maths and the General Test, and a science course gets none); without one, the
// first three. Subject ids are the website's public ids. PURE.
import { evaluateGroup } from '../../lib/du/eligibility.js';
import { selectionFromSubjects } from '../../lib/du/courseRule.mjs';

export const SETS_LABEL = 'Common sets, one tap';

export const COMMON_SETS = Object.freeze([
  Object.freeze({ id: 'commerce', title: 'Commerce', subjects: Object.freeze(['accountancy', 'business_studies', 'economics', 'english']) }),
  Object.freeze({ id: 'commerce-maths', title: 'Commerce with Maths', subjects: Object.freeze(['accountancy', 'business_studies', 'economics', 'mathematics', 'english']) }),
  Object.freeze({ id: 'commerce-test', title: 'Commerce with General Test', subjects: Object.freeze(['accountancy', 'business_studies', 'economics', 'english', 'general_test']) }),
  Object.freeze({ id: 'maths-test', title: 'Maths and General Test', subjects: Object.freeze(['accountancy', 'economics', 'mathematics', 'english', 'general_test']) }),
]);

/** The sets to offer (at most `max`): those whose subjects MockMob can all practise and, with a course, that keep it open. */
export function setsFor({ group = null, rules = null, available = [], max = 3 } = {}) {
  const have = new Set(available);
  return COMMON_SETS
    .filter((set) => set.subjects.every((id) => have.has(id)))
    .filter((set) => !group || !rules || evaluateGroup(group, selectionFromSubjects(set.subjects, rules)).eligible)
    .slice(0, max);
}

/** True when the picks are exactly this set, in any order. */
export function setMatches(set, selected) {
  const a = new Set(Array.isArray(selected) ? selected : []);
  return a.size === set.subjects.length && set.subjects.every((id) => a.has(id));
}

/** The picks after a tap: the set replaces them; a tap on the set already chosen puts it away. */
export function applySet(set, selected) {
  return setMatches(set, selected) ? [] : [...set.subjects];
}
