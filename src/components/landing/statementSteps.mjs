// The statement as a story of clauses (LK69): on a phone each step lights one clause, and the subject shelf arrives
// on the last step. Words marked with * carry the accent. A clause ends at a word that ends with . , ; : ! or ?.

export const STATEMENT_STEPS = 4;

// Held only where the scene fits (phones from 700 px tall, small tablets from 780 px) and the reader has not asked
// for calm. hero-depth.css repeats these two ranges, and heroDepth tests keep the two in step.
export const STATEMENT_HOLD = '(max-width: 760px) and (min-height: 700px), (min-width: 761px) and (max-width: 959px) and (min-height: 780px)';

const ENDS = /[.,;:!?]$/;

// The brand's own name is the one word that is green from the first frame (owner LK125, 6 Nov 2026: "MockMob is not
// green inherently. It turns green after scrolling so it's looking very weird"): it never waits for its clause.
export const BRAND_WORD = 'MockMob';

/** [{ text, accent, brand, clause, offset }] for every word, with its clause (0-based) and its place in the clause. */
export function statementWords(text, steps = STATEMENT_STEPS) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  let groups = [[]];
  words.forEach((word, i) => {
    groups[groups.length - 1].push(i);
    if (ENDS.test(word.replace(/\*/g, '')) && i < words.length - 1) groups.push([]);
  });
  // More clauses than steps: join the two neighbours with the fewest words between them. Fewer: split the longest.
  while (groups.length > steps) {
    let at = 0;
    for (let i = 1; i < groups.length - 1; i += 1) if (groups[i].length + groups[i + 1].length < groups[at].length + groups[at + 1].length) at = i;
    groups.splice(at, 2, [...groups[at], ...groups[at + 1]]);
  }
  while (groups.length < steps) {
    let at = 0;
    groups.forEach((group, i) => { if (group.length > groups[at].length) at = i; });
    if (groups[at].length < 2) break;
    const half = Math.ceil(groups[at].length / 2);
    groups.splice(at, 1, groups[at].slice(0, half), groups[at].slice(half));
  }
  const info = new Array(words.length);
  groups.forEach((group, clause) => group.forEach((index, offset) => { info[index] = { clause, offset }; }));
  return words.map((word, i) => {
    const text = word.replace(/\*/g, '');
    return { text, accent: word.startsWith('*'), brand: text.replace(/[.,;:!?]+$/, '') === BRAND_WORD, ...info[i] };
  });
}
