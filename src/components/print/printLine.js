// The words and numbers of a printed MockMob sheet's mark (PrintMark.jsx), pure so a test can pin them
// (data/tests/print_mark.test.mjs).
import { shownFirstName } from '../../lib/displayName.mjs';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "31 Oct 2026": day, three-letter month, year. The same on every device (no locale or ICU differences, never "Sept"). */
export function printDate(date = new Date()) {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * The footer line on every printed page. With the student's first name: "Printed for Asha from mockmob.in on 31 Oct 2026."
 * Without one (signed out, no name, or a name that is only the email's handle): "Printed from mockmob.in on 31 Oct 2026."
 * No middle dots, no dashes.
 */
export function printedLine({ name = '', email = '', date = new Date() } = {}) {
  const first = (shownFirstName(name, email) || '').replace(/[^\p{L}\p{M}'’.-]/gu, '').slice(0, 30);
  return `Printed ${first ? `for ${first} ` : ''}from mockmob.in on ${printDate(date)}.`;
}

/** The watermark's geometry, in millimetres: the wordmark's width, the grid, the tilt. Every other number derives from these. */
export const MARK = Object.freeze({
  width: 54, // the wordmark, about 8.4 mm tall
  stepX: 150, // between two marks on a row
  stepY: 70, // between two rows
  angle: -28,
  opacity: 0.07, // black
});
