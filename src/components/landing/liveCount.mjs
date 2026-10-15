import { SAMPLE_SUBJECTS } from './sampleSubjects.mjs';

// The hero's live line counts only what a student can practise: the 15 CUET subjects MockMob offers (the same
// list as the sample's chooser, which sampleBank.test.mjs checks against data/cuet_controls.js). /api/stats'
// subjectCounts holds every subject the question bank has ever stored under (41 on 15 Oct 2026, most of them
// not offered for practice), and its bankSize counts all of them, so neither is used here as it comes. The
// question total and the subject total are taken from the same basis: the practised subjects' own counts.
// General Test is stored under its internal id "gat".
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
