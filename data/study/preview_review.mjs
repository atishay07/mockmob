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
export function conceptsReview(fixtures_, kind = 'student') {
  const { student, empty, down } = fixtures_;
  if (kind === 'down') return { http: 503, body: reviewBody(down) };
  if (kind === 'empty') return { http: 200, body: reviewBody(empty) };
  const base = kind === 'student' ? student : fixtures_[kind] || student;
  const record = { ...base, chapters: base.chapters.map((c) => ({ ...c, name: SYLLABUS_NAMES[c.id] || c.name })) };
  return { http: 200, body: reviewBody(record) };
}

/** The attempt a lesson opened from a question reads (`from=q:{paper}:{n}`): the paper's name and, for the questions the record knows, the pick and the key. */
export function conceptsAttempt(student, paperId) {
  const paper = (student.papers || []).find((p) => p.id === paperId);
  if (!paper) return null;
  const items = (student.items || []).filter((i) => i.paper === paperId);
  const questions = Number(paper.questions) || 0;
  const at = (n) => items.find((i) => i.q === n);
  return {
    id: paperId, subject: String(paper.subject || '').toLowerCase().replace(/\s+/g, '_'),
    questionsSnapshot: Array.from({ length: questions }, (_, n) => ({ id: `${paperId}-q${n + 1}`, correctIndex: at(n + 1)?.key ? 'ABCD'.indexOf(at(n + 1).key) : null })),
    details: Array.from({ length: questions }, (_, n) => ({ qid: `${paperId}-q${n + 1}`, givenIndex: at(n + 1)?.pick ? 'ABCD'.indexOf(at(n + 1).pick) : null, isCorrect: !at(n + 1) })),
    paper: { source: paper.name, completedAt: Date.parse(paper.at) || null },
  };
}
