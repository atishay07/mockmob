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

// ---------- The first screen's preset (W4, 20 Oct): most students take Commerce, so the four are ticked and one key accepts them ----------
// Shown only to a student with no stored choice. Two quiet add chips put Mathematics or the General Test on top (the five-paper cap
// still answers a sixth pick); "Pick my own" opens the full grid with nothing ticked. Same four as the app's first run. PURE.
export const PRESET_TITLE = 'Most students take Commerce';
export const PRESET_LEAD = 'Add Mathematics or the General Test if you take one too.';
export const PRESET_KEY = 'These are my subjects';
export const PRESET_OWN = 'Pick my own';
export const PRESET_BASE = COMMON_SETS[0].subjects;
export const PRESET_ADDS = Object.freeze(['mathematics', 'general_test']);

/** True when MockMob can practise all four preset subjects (otherwise the grid is the first screen, as before). */
export function presetAvailable(available = []) {
  const have = new Set(available);
  return PRESET_BASE.every((id) => have.has(id));
}

/** The add chips to offer: the ones MockMob can practise. */
export function presetAdds(available = []) {
  const have = new Set(available);
  return PRESET_ADDS.filter((id) => have.has(id));
}

/** The label on an add chip: "Add Mathematics", and "Remove Mathematics" once it is in the set. */
export function presetAddLabel(name, on) {
  return `${on ? 'Remove' : 'Add'} ${name}`;
}
