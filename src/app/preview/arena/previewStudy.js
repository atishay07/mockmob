// Illustrative papers for the Badges and Personal bests on Progress (development preview only; never
// built into a student surface). Server-scored, dated back from now, run through the same code the
// real /api/me/study-record uses, so what the preview shows is what the rules say about these papers.
import { BADGE_STEPS, buildStudyRecord } from '@/lib/studyBadges';
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

// ---------------------------------------------------------------------------------------------
// The server's badge list (GET /api/me/badges, docs/design-decisions/badges-api-1016.md) as the preview serves it,
// in the same shape the route sends. ?badges=none|some|all|unknown|error (some is the default); on the result,
// &earned=one|two adds the badge(s) that paper just earned, dated at the paper itself.
const TARGET = { sessions_10: 10, full_mocks_5: 5, repairs_5: 5, repairs_10: 10, repairs_25: 25, four_subjects: 4, weeks_met_4: 4, run_weeks_3: 3 };
const paperRecord = (attemptId, subject, mode, marks, before) => ({ attemptId, subject, mode, correct: Math.round((marks + 6) / 5), wrong: 6, total: mode === 'quick' ? 10 : 50, marks, maxMarks: mode === 'quick' ? 50 : 250, ...(before == null ? {} : { before }) });
// Days back from now, and the paper behind an attempt-derived badge.
const SOME = {
  first_scored_session: { back: 45 },
  first_full_mock: { back: 18 },
  first_nta: { back: 20, record: paperRecord('p4', 'business_studies', 'nta', 144) },
  first_repair: { back: 25 },
  first_week_met: { back: 8 },
  new_best: { back: 12, record: paperRecord('p5', 'accountancy', 'full', 165, 126) },
};
const COUNTS = { sessions_10: 7, full_mocks_5: 3, four_subjects: 3, repairs_5: 3, repairs_10: 3, repairs_25: 3, weeks_met_4: 1, run_weeks_3: 1 };

export function previewBadgesBody(kind, { now = Date.now(), attemptAt = null, earned = null } = {}) {
  let plan = {};
  if (kind === 'all') {
    plan = Object.fromEntries(BADGE_STEPS.map((s, i) => [s.id, { back: 60 - i * 3, record: SOME[s.id]?.record || (s.id === 'clean_set' ? paperRecord('p3', 'economics', 'quick', 50) : s.id === 'full_mocks_5' ? paperRecord('p9', 'accountancy', 'full', 150) : s.id === 'four_subjects' ? paperRecord('p6', 'english', 'quick', 41) : undefined) }]));
  } else if (kind !== 'none') plan = { ...SOME };
  // The paper just scored (the result view): its badges are dated at the paper itself.
  if (earned === 'one' && attemptAt != null) plan.new_best = { at: attemptAt, record: paperRecord('fixture-attempt', 'accountancy', 'full', 165, 126) };
  if (earned === 'two' && attemptAt != null) {
    plan.first_full_mock = { at: attemptAt };
    plan.full_mocks_5 = { at: attemptAt + 1000, record: paperRecord('fixture-attempt', 'accountancy', 'full', 150) };
  }
  const unavailable = kind === 'unknown' ? ['first_hold'] : [];
  const badges = BADGE_STEPS.map((s) => {
    const p = plan[s.id];
    const target = TARGET[s.id] || 1;
    const at = p ? (p.at != null ? p.at : now - p.back * 86400000) : null;
    const current = p ? target : Math.min(target - 1, kind === 'none' ? 0 : COUNTS[s.id] || 0);
    return { id: s.id, path: s.path, name: s.name, condition: s.condition, earned: !!p, earnedAt: at == null ? null : new Date(at).toISOString(), progress: { current, target }, record: p?.record || null };
  });
  return { version: 1, generatedAt: new Date(now).toISOString(), total: badges.length, earnedCount: badges.filter((b) => b.earned).length, bestRunEndedWeek: kind === 'none' ? null : '2026-10-05', unavailable, badges };
}
