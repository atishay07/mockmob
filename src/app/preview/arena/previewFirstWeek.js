// Development-only fixtures for the first week on Today (release 8): /preview/arena?view=today&firstweek=1..7 is a student on that day of
// the path who followed it up to yesterday (every step before today done, today's not), built with the real rhythm engine and the real
// scorer from original illustrative questions, never real students. `&receipt=` picks what the after-the-mock receipt finds on the
// first full mock (from day 6): chapter (the default: the repaired chapters Partnership is clean, Ratios is not), question (one repaired
// question came up again and was answered right) or none (every repaired chapter still has a wrong answer, so there is no line).
// For the result page: ?view=result&firstweek=6&attempt=fw-p5 opens the first full mock with the repair record the receipt reads.
//   day 1  nothing saved
//   day 2  the starting set (day 1), and 3 mistakes repaired that night
//   day 3  + Revise recalled on day 2
//   day 4  + a second set on the weak chapter (day 3)
//   day 5  + a first set in Economics (day 4)
//   day 6  + the first full mock (day 5)
//   day 7  + 2 mistakes of the mock repaired (day 6); Change plan is today's step
import { computeRhythm } from '@/lib/server/rhythm';
import { computePrepOSInsights, readout } from '@/../data/prepos_insights';
import { previewAttempt } from './previewRecord';
import { fixtureRevise } from './previewMock';
import { fixtureReviseQueue } from './previewRevise';

const DAY = 86_400_000;
const R = 0; const W = 1;
const NAMES = { accountancy: 'Accountancy', economics: 'Economics' };
const PF = 'Partnership Fundamentals';
const specOf = (groups) => groups.flatMap(([chapter, verdicts]) => [...verdicts].map((c) => ({ chapter, ...(c === 'r' ? { final: R } : c === 'w' ? { final: W } : {}) })));
const iso = (ms) => new Date(ms).toISOString();

const MOCK = {
  chapter: [[PF, 'rrbrrrbrrrrb'], ['Goodwill', 'rrwrwwbrrb'], ['Ratios', 'rrwwrrbrwr'], ['Cash flow statement', 'rbrwbwrrbw'], ['Admission of a partner', 'rwrwbrwb']],
  none: [[PF, 'rrbrrwrrbrrb'], ['Goodwill', 'rrwrwwbrrb'], ['Ratios', 'rrwwrrbrwr'], ['Cash flow statement', 'rbrwbwrrbw'], ['Admission of a partner', 'rwrwbrwb']],
};

const cache = new Map();

function build(day, variant) {
  const key = `${day}|${variant}`;
  if (cache.has(key)) return cache.get(key);
  const now = Date.now();
  const papers = [];
  const add = (id, onDay, subject, mode, groups, source) => {
    const a = previewAttempt(id, day - onDay, specOf(groups), subject);
    papers.push({ ...a, mode, selectionMeta: { ...a.selectionMeta, mode, scoringVersion: 'server_practice_v1' }, paper: { source, completedAt: a.completedAt } });
  };
  if (day > 1) add('fw-p1', 1, 'accountancy', 'quick', [[PF, 'rww'], ['Goodwill', 'rbw'], ['Ratios', 'wwrb']], 'Quick practice');
  if (day > 3) add('fw-p3', 3, 'accountancy', 'quick', [[PF, 'rrrwr'], ['Goodwill', 'rwb'], ['Ratios', 'wr']], 'Quick practice');
  if (day > 4) add('fw-p4', 4, 'economics', 'quick', [['Money and Banking', 'rrwrb'], ['Introduction to Microeconomics', 'rrwwr']], 'Quick practice');
  if (day > 5) {
    add('fw-p5', 5, 'accountancy', 'full', variant === 'none' ? MOCK.none : MOCK.chapter, 'Mock 1');
    if (variant === 'question') {
      // One repaired question (Partnership, day 1) comes up again on the mock, answered right.
      const i = papers.findIndex((p) => p.id === 'fw-p5');
      papers[i] = JSON.parse(JSON.stringify(papers[i]).replaceAll('"fw-p5-q1"', '"fw-p1-q2"'));
    }
  }
  const byId = (id) => papers.find((p) => p.id === id);
  const repairs = [];
  const repair = (paper, questionId, at) => {
    const q = (paper.questionsSnapshot || []).find((x) => x.id === questionId);
    repairs.push({ attemptId: paper.id, questionId, chapter: q?.chapter ?? null, subject: paper.subject, foundAt: iso(paper.completedAt), repairedAt: iso(at), checkedState: 'not_available', retriedAt: null });
  };
  if (byId('fw-p1')) for (const q of ['fw-p1-q2', 'fw-p1-q3', 'fw-p1-q7']) repair(byId('fw-p1'), q, byId('fw-p1').completedAt + 40 * 60000);
  if (day > 6 && byId('fw-p5')) {
    const wrong = byId('fw-p5').details.filter((d) => d.isCorrect === false).slice(0, 2).map((d) => d.qid);
    wrong.forEach((q, i) => repair(byId('fw-p5'), q, byId('fw-p5').completedAt + (20 + i * 6) * 60000));
  }
  repairs.sort((a, b) => (b.repairedAt > a.repairedAt ? 1 : -1));

  const activities = [
    ...papers.map((p) => ({ id: p.id, at: p.completedAt, kind: 'session', answered: p.correct + p.wrong, fullMock: p.mode === 'full' })),
    ...repairs.map((r, i) => ({ id: `rp${i}`, at: Date.parse(r.repairedAt), kind: 'repair' })),
  ];
  const rhythm = computeRhythm({ activities, daysPerWeek: 4, now });

  // Revise: due on day 2 (5 questions, nothing recalled), then recalled on day 2 (the cards moved up; one is back on day 3).
  let revise;
  if (day === 1) revise = fixtureRevise('empty');
  else {
    const base = fixtureReviseQueue('ready');
    const due = day === 2 ? 5 : day === 3 ? 1 : 0;
    const items = base.items.slice(0, due);
    revise = {
      ...base, due: items.length, shown: items.length, answeredToday: 0, minutes: items.length ? Math.max(5, Math.ceil(items.length / 5) * 5) : 0, items,
      boxes: day === 2 ? [5, 0, 0, 0] : day === 3 ? [1, 3, 0, 0] : [0, 3, 2, 0], cards: day === 2 ? 5 : 5 + (day > 3 ? 3 : 0),
      nextDay: day > 3 ? iso(now + 2 * DAY).slice(0, 10) : base.nextDay, nextDayLabel: day > 3 ? 'in 2 days' : base.nextDayLabel,
    };
    delete revise.queue;
  }

  const summary = [...papers].sort((a, b) => b.completedAt - a.completedAt).map((p) => ({
    id: p.id, subject: p.subject, mode: p.mode, correct: p.correct, wrong: p.wrong, unattempted: p.unattempted, total: p.total,
    marks: p.correct * 5 - p.wrong, maxMarks: p.total * 5, completedAt: p.completedAt, formatId: `${p.mode}:${p.subject}:q${p.total}:server_practice_v1`,
  }));
  const insights = papers.length ? computePrepOSInsights(papers, { subjectNames: NAMES }) : { state: 'empty', sessions: 0, questions: 0 };
  const made = {
    papers, summary, repairs, rhythm, revise,
    facts: { sessions: papers.length, mocks: papers.filter((p) => p.mode === 'full').length, timedMocks: 0, subject: papers.length ? 'accountancy' : null },
    insights: { ok: true, insights, findings: papers.length ? readout(insights, { limit: 4 }) : [] },
  };
  cache.set(key, made);
  return made;
}

/** The first-week fixtures: a Response promise for the reads Today and the result make, or null when `?firstweek=` is not set. */
export function previewFirstWeek(url, method, fixture, json) {
  const day = Number(fixture.get('firstweek'));
  if (!Number.isInteger(day) || day < 1 || day > 7 || method !== 'GET') return null;
  const made = build(day, ['question', 'none'].includes(fixture.get('receipt')) ? fixture.get('receipt') : 'chapter');
  const path = url.pathname;
  if (path === '/api/attempts/summary') return json({ items: made.summary, nextCursor: null });
  if (path === '/api/me/rhythm') return json(made.rhythm);
  if (path === '/api/me/timed-mock') return json(made.facts);
  if (path === '/api/me/repair-record') return json({ repairs: made.repairs });
  if (path === '/api/me/revise') return json(made.revise);
  if (path === '/api/prepos/insights') return json(made.insights);
  if (path === '/api/me/goal') return json({ daysPerWeek: 4, timezone: 'Asia/Kolkata', pausedUntil: null, weekdays: null });
  const paper = path.startsWith('/api/attempts/') ? made.papers.find((p) => p.id === decodeURIComponent(path.split('/').pop())) : null;
  if (paper) return json({ ...paper, answerReviewState: 'ready' });
  return null;
}
