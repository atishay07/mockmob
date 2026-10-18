// Development-only sample record for /preview/arena. Built with the real scorer so the
// shapes match production attempts. Illustrative data, never real students.
import { scoreSession } from '@/../data/recovery';
import { computePrepOSInsights, readout } from '@/../data/prepos_insights';

const OPTIONS = ['A', 'B', 'C', 'D'].map((key) => ({ key, text: key }));
// Illustrative stems (original, never bank rows), so Today's weak chapters can show whole questions in the preview.
const STEMS = {
  'Partnership Fundamentals': [
    'A and B share profits 3:2. C is admitted for a 1/5th share. What is the sacrificing ratio of A and B?',
    'Goodwill brought in cash by a new partner is credited to which account?',
    'In the absence of a partnership deed, interest on a partner’s loan is allowed at what rate a year?',
  ],
  Goodwill: [
    'Average profit is ₹60,000 and normal profit is ₹45,000. What is goodwill at three years’ purchase of super profit?',
    'Which method values goodwill by capitalising the average profit at the normal rate of return?',
    'Hidden goodwill is the difference between which two amounts?',
  ],
  Ratios: [
    'Current assets are ₹2,40,000 and current liabilities ₹80,000. What is the current ratio?',
    'Which ratio shows how many times the interest charges are covered by profit before interest and tax?',
    'An increase in which item raises the quick ratio but leaves the current ratio unchanged?',
  ],
};
const DAY = 86_400_000;

function attempt(id, daysAgo, spec, subject = 'accountancy') {
  const questions = spec.map((s, i) => ({ id: `${id}-q${i + 1}`, chapter: s.chapter, difficulty: s.difficulty || 'medium', correctIndex: 0, options: OPTIONS, question: STEMS[s.chapter]?.[i % 3] || `Illustrative question ${i + 1} on ${s.chapter}.` }));
  const answers = {}; const events = []; let seq = 1; let at = 800;
  spec.forEach((s, i) => {
    const qid = questions[i].id;
    events.push({ seq: seq++, qid, at, type: 'visit' });
    if (s.first !== undefined) events.push({ seq: seq++, qid, at: at + 400, type: 'answer', answer: s.first });
    if (s.final !== undefined && s.final !== s.first) events.push({ seq: seq++, qid, at: at + (s.dwell ?? 50) * 1000 - 120, type: 'answer', answer: s.final });
    if (s.final !== undefined) answers[qid] = s.final;
    at += (s.dwell ?? 50) * 1000;
  });
  events.push({ seq: seq++, qid: questions.at(-1).id, at: at + 10, type: 'visit' });
  const result = scoreSession(questions, answers, events, at + 1000);
  return { id, userId: 'preview-user', subject, ...result, questionsSnapshot: questions, selectionMeta: { recovery: result.recovery }, completedAt: Date.now() - daysAgo * DAY };
}

// The paper builder, for the other preview records (previewFirstWeek.js builds its own papers with the same real scorer).
export { attempt as previewAttempt };

const R = 0; const W = 1;
const ATTEMPTS = [
  attempt('p1', 1, [
    { chapter: 'Partnership Fundamentals', final: R }, { chapter: 'Partnership Fundamentals', final: W }, { chapter: 'Partnership Fundamentals', first: R, final: W, dwell: 190 },
    { chapter: 'Goodwill', final: R }, { chapter: 'Goodwill' }, { chapter: 'Goodwill', final: R, difficulty: 'easy' },
    { chapter: 'Ratios', final: W, difficulty: 'easy' }, { chapter: 'Ratios', first: W, final: R }, { chapter: 'Ratios', final: R }, { chapter: 'Ratios' },
  ]),
  attempt('p2', 3, [
    { chapter: 'Partnership Fundamentals', final: W }, { chapter: 'Partnership Fundamentals', final: W }, { chapter: 'Partnership Fundamentals', final: R }, { chapter: 'Goodwill', final: W },
    { chapter: 'Goodwill', final: R }, { chapter: 'Ratios', final: R, difficulty: 'easy' }, { chapter: 'Ratios', final: W, difficulty: 'easy' }, { chapter: 'Ratios', final: R },
  ]),
  attempt('p3', 10, Array.from({ length: 8 }, (_, k) => ({ chapter: k < 4 ? 'Partnership Fundamentals' : 'Goodwill', final: k % 3 === 0 ? R : W }))),
];

/** One record paper in full (GET /api/attempts/{id} for p1, p2 and p3), so Today's weak chapters can load stems. */
export function previewRecordAttempt(id) {
  const a = ATTEMPTS.find((x) => x.id === id);
  return a ? { ...a, mode: 'quick', paper: { source: 'Quick practice', completedAt: a.completedAt } } : null;
}

export function previewInsights(names = { accountancy: 'Accountancy' }) {
  const insights = computePrepOSInsights(ATTEMPTS, { subjectNames: names });
  return { ok: true, insights, findings: readout(insights, { limit: 4 }) };
}

// The Score by session chart and the record's header read the same three attempts, so the range line
// ("3 sessions ... from <date> to <date>") and the chart's sessions always agree. Shaped like /api/analytics.
export function previewAnalytics() {
  const chronological = [...ATTEMPTS].sort((a, b) => a.completedAt - b.completedAt);
  const totals = ATTEMPTS.reduce((t, a) => ({ correct: t.correct + (a.correct || 0), wrong: t.wrong + (a.wrong || 0), unattempted: t.unattempted + (a.unattempted || 0) }), { correct: 0, wrong: 0, unattempted: 0 });
  const answered = totals.correct + totals.wrong + totals.unattempted;
  return {
    totalAttempts: ATTEMPTS.length, totals, scoring: { device: 0 },
    timeline: chronological.map((a, i) => ({ test: `T${i + 1}`, score: a.score, at: a.completedAt, scoring: 'server' })),
    subjects: [{ id: 'accountancy', name: 'Accountancy', tests: ATTEMPTS.length, avg: Math.round(ATTEMPTS.reduce((n, a) => n + a.score, 0) / ATTEMPTS.length), accuracy: answered ? Math.round((totals.correct / answered) * 100) : 0 }],
    weakChapters: [],
  };
}

// Compass Pro fixture: four practised papers with plausible, clearly illustrative mixes.
// `pattern` repeats r (right), w (wrong), b (blank). Never shown outside /preview/arena.
const pattern = (subject, mix, n) => ({ subject, details: Array.from({ length: n }, (_, i) => ({ qid: `${subject}-${i}`, isCorrect: mix[i % mix.length] === 'r' ? true : mix[i % mix.length] === 'w' ? false : null })) });
const COMPASS_ATTEMPTS = [
  pattern('english', 'rrrrrrrwrb', 60),
  pattern('accountancy', 'rrrwwrrbrw', 48),
  pattern('business_studies', 'rrrrrwrrbr', 40),
  pattern('economics', 'rrwrrbrrwr', 34),
  pattern('history', 'rrw', 12),
];

export async function previewCompass(pro) {
  if (!pro) return { ok: true, locked: true };
  const { compassProjection } = await import('@/../data/compass_projection');
  const names = { english: 'English', accountancy: 'Accountancy', business_studies: 'Business Studies', economics: 'Economics', history: 'History' };
  const ranked = [{ subject: 'accountancy', chapter: 'Partnership Fundamentals', wrong: 9, skip: 2, n: 18 }];
  return { ok: true, locked: false, projection: compassProjection(COMPASS_ATTEMPTS, { subjectNames: names, rankedChapters: ranked }) };
}
