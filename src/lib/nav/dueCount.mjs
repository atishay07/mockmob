// The Revise count in the navigation (release 11 verifier M1, 19 Oct 2026). The number beside "Your papers" (the sidebar and
// Practice's row of tabs) and on the dock's Practice is how many mistakes Revise brings back today. A bare "8" there read as
// "8 papers", so it always carries its word: "8 due", and a screen reader hears "Your papers, 8 due in Revise today".
// PURE, no imports, so the shell, the row of tabs and the tests read the same words.

/** The visible count: "8 due", "99+ due". */
export const dueBadge = (n) => `${n > 99 ? '99+' : n} due`;

/** The count in words for a screen reader: "8 due in Revise today". */
export const dueWords = (n) => `${n} due in Revise today`;

/** The link's whole accessible name when it carries the count: "Your papers, 8 due in Revise today". */
export const dueLabel = (label, n) => `${label}, ${dueWords(n)}`;
