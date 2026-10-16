// Development-only sample record for /preview/arena. Built with the real scorer so the
// shapes match production attempts. Illustrative data, never real students.
import { scoreSession } from '@/../data/recovery';
import { computePrepOSInsights, readout } from '@/../data/prepos_insights';

const OPTIONS = ['A', 'B', 'C', 'D'].map((key) => ({ key, text: key }));
const DAY = 86_400_000;

function attempt(id, daysAgo, spec, subject = 'accountancy') {
  const questions = spec.map((s, i) => ({ id: `${id}-q${i + 1}`, chapter: s.chapter, difficulty: s.difficulty || 'medium', correctIndex: 0, options: OPTIONS }));
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
