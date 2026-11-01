// The marks for "something is due" in the navigation (R3-SPEC rulings Z and S2, 1 Nov 2026). The sidebar and the phone dock never show a due
// number: a bare "8" read as "8 papers" (release 11 verifier M1) and "27 due" made Learn read as a to-do list. Each mark is a small dot with an
// aria-label that says what is waiting; the number lives on the page it opens (Learn's Revise row, the Papers page). PURE, no imports, so the
// shell, the row of tabs and the tests read the same words.

/** The dot beside Learn in the sidebar: Key cards are due. */
export const LEARN_DOT_LABEL = 'Key cards due in Learn';

/** The dot beside Your papers (sidebar, Papers tab) and on the dock's Practice: Revise has questions waiting. */
export const REVISE_DOT_LABEL = 'Questions to revise';

/** A link's whole accessible name when a dot is on it and the link needs its own name: "Your papers, questions to revise". */
export const dotName = (label, dotLabel) => `${label}, ${String(dotLabel).charAt(0).toLowerCase()}${String(dotLabel).slice(1)}`;
