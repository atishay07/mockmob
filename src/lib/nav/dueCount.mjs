// The Revise count in the navigation (release 11 verifier M1, 19 Oct 2026). The number beside "Your papers" (the sidebar and
// Practice's row of tabs) and on the dock's Practice is how many mistakes Revise brings back today. A bare "8" there read as
// "8 papers", and "8 due" still could, so it says "8 to revise", and a screen reader hears "Your papers, 8 questions to revise today".
// PURE, no imports, so the shell, the row of tabs and the tests read the same words.

/** The visible count: "8 to revise", "99+ to revise". */
export const dueBadge = (n) => `${n > 99 ? '99+' : n} to revise`;

/** The count in words for a screen reader: "8 questions to revise today". */
export const dueWords = (n) => `${n} ${n === 1 ? 'question' : 'questions'} to revise today`;

/** The link's whole accessible name when it carries the count: "Your papers, 8 questions to revise today". */
export const dueLabel = (label, n) => `${label}, ${dueWords(n)}`;
