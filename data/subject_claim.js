// The subject claim, in one place (decision: docs/brain/SUBJECT-COVERAGE-2026-10-17.md, 17 Oct 2026).
//
// Pure: no imports, so a client component, a route and node --test can all load it.
//
// What MockMob may say about its subjects:
//   "Full NTA-pattern mocks for the 15 subjects behind 19 of every 20 CUET papers."
// The 15 are CUET_PUBLIC_ALLOWED_SUBJECTS (data/cuet_controls.js). 19 of every 20 is their share of all CUET
// paper registrations in 2026: 94.9% (93.9% in 2025), from the public NTA-derived subject-wise registrations.
// MockMob never claims "80% of students" or "every subject", and never prints a count that includes the thin
// subjects it only stores or the four CUET dropped in 2025. data/tests/subject_claim.test.mjs holds the numbers
// against the allowlist, so a change to the 15 fails a test until this claim is reviewed.

/** The count the claim names. Equal to CUET_PUBLIC_ALLOWED_SUBJECTS.length (a test holds them together). */
export const PUBLIC_SUBJECT_COUNT = 15;

/** Share of all CUET UG paper registrations that the public subjects cover, in 2026 and 2025 (percent). */
export const PAPER_SHARE = Object.freeze({ year: 2026, percent: 94.9, previousYear: 2025, previousPercent: 93.9, outOf: 20, covered: 19 });

/** The claim, long and short. Use `long` where there is room, `short` where it is tight, `meta` in descriptions. */
export const SUBJECT_CLAIM = Object.freeze({
  long: `Full NTA-pattern mocks for the ${PUBLIC_SUBJECT_COUNT} subjects behind ${PAPER_SHARE.covered} of every ${PAPER_SHARE.outOf} CUET papers`,
  short: `The ${PUBLIC_SUBJECT_COUNT} subjects behind ${PAPER_SHARE.covered} of every ${PAPER_SHARE.outOf} CUET papers`,
  meta: `Full NTA-pattern mocks for the ${PUBLIC_SUBJECT_COUNT} subjects behind ${PAPER_SHARE.covered} of every ${PAPER_SHARE.outOf} CUET papers`,
  withSource: `Full NTA-pattern mocks for the ${PUBLIC_SUBJECT_COUNT} subjects behind ${PAPER_SHARE.covered} of every ${PAPER_SHARE.outOf} CUET papers (${PAPER_SHARE.year} NTA data)`,
  source: `Share of CUET UG ${PAPER_SHARE.year} paper registrations, from public NTA-derived data.`,
});

// The four papers CUET dropped in 2025. Their question rows stay in the database; they are never offered.
export const RETIRED_SUBJECTS = Object.freeze({
  entrepreneurship: 'Entrepreneurship',
  teaching_aptitude: 'Teaching Aptitude',
  legal_studies: 'Legal Studies',
  engineering_graphics: 'Engineering Graphics',
});
export const RETIRED_SUBJECT_IDS = Object.freeze(Object.keys(RETIRED_SUBJECTS));

const norm = (raw) => String(raw ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/** True for a subject CUET dropped in 2025, by any spelling of its id. */
export function isRetiredSubject(raw) {
  return Object.prototype.hasOwnProperty.call(RETIRED_SUBJECTS, norm(raw));
}

/** The list without the retired subjects. Entries may be ids or { id } objects; anything else passes through. */
export function withoutRetiredSubjects(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((entry) => !isRetiredSubject(entry && typeof entry === 'object' ? entry.id : entry));
}

/** The retired subjects in a stored list, as ids in their stored order, without repeats. */
export function retiredSubjectsIn(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.map(norm).filter((id) => isRetiredSubject(id)))];
}

/**
 * A subjects-catalogue-shaped entry for a retired id, so a saved choice can be named and explained
 * ("Teaching Aptitude: CUET dropped this paper in 2025") without the catalogue offering it.
 */
export function retiredSubjectEntry(raw) {
  const id = norm(raw);
  if (!isRetiredSubject(id)) return null;
  return {
    id,
    name: RETIRED_SUBJECTS[id],
    practice: 'retired',
    practiceReason: 'CUET dropped this paper in 2025, so there is no practice for it. Edit your subjects to choose a current CUET subject.',
  };
}

/**
 * How many subjects a stored per-subject count map covers, counting only the public subjects.
 * `publicIds` are the ids to count (internal or public spelling, as the keys of the map are stored).
 * Returns null when the counts are not an object, so a failed read is never printed as 0.
 */
export function coveredPublicSubjects(subjectCounts, publicIds) {
  if (!subjectCounts || typeof subjectCounts !== 'object') return null;
  const allowed = new Set(publicIds);
  let covered = 0;
  for (const [id, count] of Object.entries(subjectCounts)) {
    if (allowed.has(id) && Number(count) > 0) covered += 1;
  }
  return covered;
}
