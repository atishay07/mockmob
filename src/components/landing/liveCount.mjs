import { SAMPLE_SUBJECTS } from './sampleSubjects.mjs';

// THE landing page's question count, defined once. Basis: the questions a student can practise in the 15 CUET
// subjects MockMob offers (the same list as the sample's chooser, which sampleBank.test.mjs checks against
// data/cuet_controls.js), read from the stored daily snapshot behind /api/stats (landingStats.mjs, one read per
// page load). The snapshot's subjectCounts are already the practice library's own counts (the same publication and
// family-hold rules practice applies), so a figure here is a question a student can be served.
//
// Not used, because each is a different number: the snapshot's bankSize and the sum of every stored subject (41 on
// 15 Oct 2026, most of them not offered for practice, 7,544 against 5,288 for the 15), and any count taken while a
// figure is still counting up. The question total and the subject total share one basis: the practised subjects'
// own counts. General Test is stored under its internal id "gat".
const STORED_ID = { general_test: 'gat' };

export const PRACTISED_IDS = Object.freeze(SAMPLE_SUBJECTS.map((subject) => STORED_ID[subject.id] || subject.id));

/** { questions, subjects } over the practised subjects that have at least one question, or null when none do. */
export function practisedCounts(subjectCounts) {
  if (!subjectCounts || typeof subjectCounts !== 'object') return null;
  let questions = 0;
  let subjects = 0;
  for (const id of PRACTISED_IDS) {
    const n = Math.floor(Number(subjectCounts[id]));
    if (Number.isFinite(n) && n > 0) { questions += n; subjects += 1; }
  }
  return questions > 0 ? { questions, subjects } : null;
}

/** How the page writes a count: whole numbers in Indian digit grouping. */
export function formatCount(n) {
  return Math.floor(Number(n)).toLocaleString('en-IN');
}
