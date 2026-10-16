// Illustrative papers for the Badges and Personal bests on Progress (development preview only; never
// built into a student surface). Server-scored, dated back from now, run through the same code the
// real /api/me/study-record uses, so what the preview shows is what the rules say about these papers.
import { buildStudyRecord } from '@/lib/studyBadges';
import { computeBests } from '@/lib/server/recap';

const DAY = 86400000;

function paper(id, back, { subject = 'accountancy', mode = 'quick', total = 10, correct = 7, wrong = 2, details = [], recovery } = {}) {
  const d = new Date(Date.now() - back * DAY);
  d.setHours(11, 0, 0, 0);
  return {
    id, subject, score: 0, correct, wrong, unattempted: total - correct - wrong, total, details,
    questionsSnapshot: Array.from({ length: total }, (_, i) => ({ id: `${id}-q${i}` })),
    selectionMeta: { mode, scoringVersion: 'server_practice_v1', ...(recovery ? { recovery } : {}) },
    formatId: `${mode}:${subject}:q${total}:server_practice_v1`,
    completedAt: d.getTime(),
  };
}

const timed = (id, secs) => secs.map((s, i) => ({ qid: `${id}-q${i}`, isCorrect: true, timeMs: s * 1000 }));

/** ?badges=none: one set and nothing else. Otherwise a mix of earned and locked. */
export function previewStudyRecord(kind) {
  if (kind === 'none') return buildStudyRecord([paper('p1', 2, { correct: 4, wrong: 3 })], []);
  const attempts = [
    paper('p1', 40, { subject: 'english', total: 20, correct: 12, wrong: 4 }),
    paper('p2', 33, { subject: 'accountancy', mode: 'full', total: 50, correct: 27, wrong: 9 }),
    paper('p3', 27, { subject: 'economics', total: 10, correct: 10, wrong: 0, details: timed('p3', [14, 9, 22, 18, 31, 12, 40, 16, 25, 19]) }),
    paper('p4', 20, { subject: 'business_studies', mode: 'nta', total: 50, correct: 30, wrong: 6 }),
    paper('p5', 12, { subject: 'accountancy', mode: 'full', total: 50, correct: 34, wrong: 5 }),
    paper('p6', 3, { subject: 'english', total: 20, correct: 15, wrong: 3 }),
    paper('p7', 1, { subject: 'economics', total: 10, correct: 6, wrong: 3 }),
  ];
  return buildStudyRecord(attempts, computeBests(attempts));
}
