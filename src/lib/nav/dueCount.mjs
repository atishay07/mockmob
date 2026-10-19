// The Revise count in the navigation (release 11 verifier M1, 19 Oct 2026). The number beside "Your papers" (the sidebar and
// Practice's row of tabs) and on the dock's Practice is how many mistakes Revise brings back today. A bare "8" read as
// "8 papers", so the sidebar and the dock say "8 due" (short enough for one line in a sidebar row and for the dock's Practice slot,
// clear of the Start key), the row of tabs has room for "8 to revise", and a screen reader hears the whole thing everywhere:
// "Your papers, 8 questions to revise today". PURE, no imports, so the shell, the row of tabs and the tests read the same words.

/** The visible count on the sidebar and the dock: "8 due", "99+ due". */
export const dueBadge = (n) => `${n > 99 ? '99+' : n} due`;

/** The visible count on Practice's row of tabs, where there is room: "8 to revise", "99+ to revise". */
export const dueTabBadge = (n) => `${n > 99 ? '99+' : n} to revise`;

/** The count in words for a screen reader: "8 questions to revise today". */
export const dueWords = (n) => `${n} ${n === 1 ? 'question' : 'questions'} to revise today`;

/** The link's whole accessible name when it carries the count: "Your papers, 8 questions to revise today". */
export const dueLabel = (label, n) => `${label}, ${dueWords(n)}`;
