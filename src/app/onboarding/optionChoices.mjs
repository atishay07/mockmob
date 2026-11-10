// The subjects whose paper has a section or a part a school teaches (data/cuet_syllabus.js SUBJECT_OPTIONS), asked at onboarding
// right after the subject is picked (LK94). The ids, labels and defaults are the syllabus's own; a test keeps them equal. The
// one-line explanation of each choice lives here, so the screen says what the choice is in words a student knows.
// A small copy rather than an import: the syllabus file carries every chapter and would ride along in the onboarding bundle.

export const OPTIONS_LATER = 'You can change this later in Learn.';

export const OPTION_ASKS = Object.freeze({
  mathematics: {
    name: 'Mathematics', label: 'Section', default: 'B1',
    choices: [
      { id: 'B1', label: 'B1 Mathematics', line: 'The Class 12 Mathematics paper: algebra, calculus, vectors.' },
      { id: 'B2', label: 'B2 Applied Mathematics', line: 'The Class 12 Applied Mathematics paper: modelling, finance, statistics.' },
    ],
  },
  computer_science: {
    name: 'Computer Science', label: 'Section', default: 'B1',
    choices: [
      { id: 'B1', label: 'B1 Computer Science', line: 'The Computer Science course: Python, data structures, databases.' },
      { id: 'B2', label: 'B2 Informatics Practices', line: 'The Informatics Practices course: Python with Pandas, data handling, databases.' },
    ],
  },
  // The note says what NTA's syllabus says (owner, 10 Nov 2026: "CUET gives the option between both parts ... check the latest
  // bulletin"): the CUET (UG) 2026 Accountancy syllabus prints Unit V as Analysis of Financial Statements and then "Optional to
  // Unit V: Computerised Accounting System" (data/CUET 2026/accountancy.pdf), so a student prepares one of the two. The earlier
  // line ("The 2025 CUET paper asked Analysis of Financial Statements only") rested on one shift's reprint and is gone. All 16
  // live subjects' 2026 syllabi were read again on 10 Nov: only Mathematics, Computer Science and Accountancy carry a choice.
  // AFS stays the default; a CAS pick drops Analysis of Financial Statements from practice and mocks.
  accountancy: {
    name: 'Accountancy', label: 'Part', default: 'AFS',
    note: 'The CUET syllabus gives Unit V two ways. Pick the one your school teaches.',
    choices: [
      { id: 'AFS', label: 'Analysis of Financial Statements', line: 'Reading financial statements: ratios and cash flow.' },
      { id: 'CAS', label: 'Computerised Accounting', line: 'Keeping accounts on a computer: spreadsheets and databases.' },
    ],
  },
});

/** The ask for a subject id, or null when its paper has no section or part to choose. */
export const optionAsk = (subjectId) => OPTION_ASKS[subjectId] || null;

/** The picked subjects that need an option, in the order they were picked. */
export const subjectsAsking = (selected) => (Array.isArray(selected) ? selected : []).filter((id) => optionAsk(id));

/** The choice shown for a subject: what the student tapped, else what Learn already holds, else the default. */
export function shownChoice(subjectId, { touched = {}, saved = {} } = {}) {
  const ask = optionAsk(subjectId);
  if (!ask) return null;
  const valid = (id) => ask.choices.some((c) => c.id === id);
  if (valid(touched[subjectId])) return touched[subjectId];
  if (valid(saved[subjectId])) return saved[subjectId];
  return ask.default;
}

/**
 * The writes to make once the subjects are saved: [{ subject, option }]. A first run saves every picked subject's choice, the
 * default included, so Learn never starts with both parts showing. Editing subjects saves only what the student touched or what
 * Learn already holds, so a choice that could not be read back is never overwritten by a default.
 */
export function optionsToSave(selected, { edit = false, touched = {}, saved = {} } = {}) {
  return subjectsAsking(selected)
    .filter((id) => !edit || touched[id] || saved[id])
    .map((id) => ({ subject: id, option: shownChoice(id, { touched, saved }) }));
}
