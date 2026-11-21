// The CUET 2026 paper, checked against MockMob (owner, 22 Nov 2026: "we had to make that a percentage coverage of each
// subject ... from the CUET 2026 question paper ... I want that also built into this pass").
//
// Where the numbers come from: data/coverage/cuet2026/ (README.md is the summary; METHOD.md the rule). NTA's 2026 master
// papers, one shift a subject (Accountancy 20 May, Business Studies 20 May, Economics 24 May 2026), every question
// authenticated against NTA's final key. Each question was checked twice, independently, against MockMob's served question
// bank and Key cards as they stood on 20 Nov 2026, under the strict rule; a question counts only when BOTH checks found it
// covered. Reading-skill items are left out of the count (5 in Economics, 1 in Business Studies), so the totals are 55, 45
// and 49. coverage2026.test.mjs holds these figures to the README's own line.
//
// The check was made after the exam, on the bank as it is now: the words never say MockMob predicted the paper.
export const COVERAGE_2026 = Object.freeze({
  subjects: Object.freeze([
    Object.freeze({ id: 'accountancy', name: 'Accountancy', covered: 38, of: 55, sat: '20 May 2026' }),
    Object.freeze({ id: 'economics', name: 'Economics', covered: 32, of: 45, sat: '24 May 2026' }),
    Object.freeze({ id: 'business-studies', name: 'Business Studies', covered: 30, of: 49, sat: '20 May 2026' }),
  ]),
});

/** A whole percent, rounded half up. */
export const coveragePct = (covered, of) => (of > 0 ? Math.round((covered / of) * 100) : 0);

/** Every subject together: { covered, of, pct }. */
export function coverageTotal(list = COVERAGE_2026.subjects) {
  const covered = list.reduce((n, s) => n + s.covered, 0);
  const of = list.reduce((n, s) => n + s.of, 0);
  return { covered, of, pct: coveragePct(covered, of) };
}

const TOTAL = coverageTotal();
export const COVERAGE_COPY = Object.freeze({
  kicker: 'Checked against the real paper',
  h2: 'The CUET 2026 paper, question by question.',
  mark: 'question by question.',
  sub: `We took NTA’s real 2026 papers and checked every question against MockMob. ${TOTAL.covered} of ${TOTAL.of} are already taught in our questions and Key cards.`,
  totalLabel: 'of the 2026 questions we checked',
  row: (covered, of) => `${covered} of ${of} questions`,
  note: 'One 2026 shift for each subject. A question counts only when two separate checks both found it in MockMob. Reading passages are left out.',
});
