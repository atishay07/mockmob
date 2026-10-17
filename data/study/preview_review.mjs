// The design student as GET /api/me/review returns it, for the development previews of Concepts and Practice's Concepts panel
// (/preview/study, /preview/arena?view=dashboard&study=on). PURE. The fixture's chapter names are illustrative ("Issue of
// shares"); the preview catalog is the real pilot lesson set, whose chapters carry the syllabus titles, so the preview renames
// the fixture's chapters to the syllabus titles they stand for. Every number (marks, open mistakes, blanks, Revise due) is the
// fixture's own, run through the same reviewBody() the server uses; nothing is typed by hand.
import { reviewBody } from '../review_input.mjs';

export const SYLLABUS_NAMES = Object.freeze({
  adm: 'Admission of Partner', ret: 'Retirement & Death of Partner', iss: 'Share Capital', cfs: 'Cash Flow Statement',
  dis: 'Dissolution of Partnership Firm', rat: 'Accounting Ratios', pom: 'Principles of Management',
});

/** kind: 'student' (default, a record with open mistakes), 'empty' (no paper), 'down' (the read failed). `fixtures` is { student, empty, down }, the parsed fixture files. */
export function conceptsReview({ student, empty, down }, kind = 'student') {
  if (kind === 'down') return { http: 503, body: reviewBody(down) };
  if (kind === 'empty') return { http: 200, body: reviewBody(empty) };
  const record = { ...student, chapters: student.chapters.map((c) => ({ ...c, name: SYLLABUS_NAMES[c.id] || c.name })) };
  return { http: 200, body: reviewBody(record) };
}
