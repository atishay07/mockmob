// Stem text for the free steps (pure, so it is tested without React).
const text = (v) => (v == null ? '' : typeof v === 'string' || typeof v === 'number' ? String(v) : v.text ?? v.label ?? v.name ?? '');
// A stem that ends its sentence never takes a colon after it (".:" is a join, not punctuation).
export const cleanStem = (v) => text(v).replace(/([.?!])\s*:\s*$/, '$1');
const flat = (v) => String(v || '').replace(/[\s.?!:…]+$/u, '').replace(/\s+/g, ' ').trim().toLowerCase();
/** True when a row's stem line is the whole question, so the question block below it must not say it again (F11). A row whose
 *  stem is cut short (the server keeps the first line) is not the whole question: the block still shows it. */
export const sameStem = (rowStem, questionStem) => Boolean(flat(rowStem)) && flat(rowStem) === flat(questionStem);

