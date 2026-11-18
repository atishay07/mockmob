// Marks trend (?view=radar) fixtures for lane insight (18 Nov 2026). Development only; illustrative data, never real students.
// One set of papers feeds both reads the page makes, so the marks, the trend, the chapter map, the pace rows and the marks
// split always agree: GET /api/analytics (with its `insight` part built by the server's own src/lib/insight/build.mjs) and
// GET /api/prepos/insights (the record, by data/prepos_insights.js). Papers are scored by the real scorer (previewRecord.js).
//   ?data=ready   (default) two subjects, seven papers, a spread of chapter states, timed papers, changed answers
//   ?data=sparse  one 10-question paper with a few answers
//   ?data=empty   no paper: each block's quiet form
//   ?data=error | loading   handled by the preview's account-read switch (every read fails or waits)
// &plan=pro shows the pace rows and the changed-answer line; Free gets neither (the server sends Free no pace rows and the
// page leaves Your pace out, the record's own Pro row saying it once).
import { previewAttempt } from './previewRecord';
import { computePrepOSInsights, readout } from '@/../data/prepos_insights';
import { buildInsight } from '@/lib/insight/build.mjs';
import { resolveChapter, unitsFor } from '@/../data/cuet_syllabus';
import { getCanonicalSubject, isTopSubject } from '@/../data/canonical_syllabus';

const R = 0;
const W = 1;
const SUBJECTS = ['accountancy', 'business_studies'];
const NAMES = { accountancy: 'Accountancy', business_studies: 'Business Studies' };
const nameOf = (id) => getCanonicalSubject(id)?.subject_name || NAMES[id] || id;

// One chapter's part of a paper: [chapter, right, wrong, blank, { change: 'gain' | 'loss' }].
function spec(parts, dwell) {
  const out = [];
  let k = 0;
  for (const [chapter, right, wrong, blank = 0, opts = {}] of parts) {
    for (let i = 0; i < right; i += 1) out.push({ chapter, final: R, ...(opts.change === 'gain' && i === 0 ? { first: W } : {}) });
    for (let i = 0; i < wrong; i += 1) out.push({ chapter, final: W, ...(opts.change === 'loss' && i === 0 ? { first: R } : {}) });
    for (let i = 0; i < blank; i += 1) out.push({ chapter });
  }
  // A paper's questions take about `dwell` seconds each, some quicker and some slower.
  return out.map((q) => ({ ...q, dwell: dwell + [-12, 0, 9, -4, 15, 3][(k += 1) % 6] }));
}

function paper(id, subject, daysAgo, mode, parts, dwell) {
  const a = previewAttempt(id, daysAgo, spec(parts, dwell), subject);
  return { ...a, mode, selectionMeta: { ...a.selectionMeta, mode, scoringVersion: 'server_snapshot_v1' } };
}

let ready = null;
function readyPapers() {
  ready ||= [
    paper('ia1', 'accountancy', 20, 'full', [['Partnership Fundamentals', 5, 0], ['Profit & Loss Appropriation Account', 3, 1], ['Goodwill Valuation', 1, 3, 1, { change: 'loss' }], ['Admission of Partner', 3, 1], ['Share Capital', 5, 0], ['Accounting Ratios', 2, 1]], 50),
    paper('ib1', 'business_studies', 17, 'quick', [['Nature & Significance of Management', 6, 0], ['Principles of Management', 1, 4], ['Organising', 5, 1, 2]], 95),
    paper('ia2', 'accountancy', 14, 'quick', [['Partnership Fundamentals', 4, 1], ['Goodwill Valuation', 1, 2], ['Retirement & Death of Partner', 0, 3], ['Change in Profit Sharing Ratio', 2, 1], ['Debentures', 1, 1]], 80),
    paper('ib2', 'business_studies', 10, 'quick', [['Principles of Management', 0, 4], ['Business Environment', 5, 3, 1, { change: 'gain' }], ['Marketing Management', 6, 0]], 58),
    paper('ia3', 'accountancy', 7, 'quick', [['Partnership Fundamentals', 4, 0, 0, { change: 'gain' }], ['Profit & Loss Appropriation Account', 3, 1], ['Share Capital', 4, 0], ['Accounting Ratios', 3, 1]], 64),
    paper('ib3', 'business_studies', 4, 'quick', [['Nature & Significance of Management', 6, 0], ['Planning', 3, 1], ['Organising', 4, 0], ['Consumer Protection', 1, 0]], 70),
    paper('ia4', 'accountancy', 2, 'full', [['Goodwill Valuation', 1, 4], ['Admission of Partner', 5, 1, 1], ['Retirement & Death of Partner', 0, 3], ['Share Capital', 4, 0]], 76),
  ];
  return ready;
}
let sparse = null;
const sparsePapers = () => (sparse ||= [paper('is1', 'accountancy', 1, 'quick', [['Partnership Fundamentals', 3, 1], ['Goodwill Valuation', 1, 1, 1], ['Admission of Partner', 2, 1]], 66)]);

const papersFor = (state) => (state === 'empty' ? [] : state === 'sparse' ? sparsePapers() : readyPapers());

/** The answered progress rows these papers leave: one per answered question, its latest answer (user_question_progress). */
function progressOf(papers) {
  return papers.flatMap((a) => (a.details || []).filter((d) => typeof d.isCorrect === 'boolean').map((d) => {
    const q = a.questionsSnapshot.find((x) => x.id === d.qid);
    return { question_id: d.qid, subject: a.subject, chapter: q?.chapter, attempt_count: 1, last_correct: d.isCorrect, last_attempted_at: new Date(a.completedAt).toISOString() };
  }));
}

/** GET /api/analytics for view=radar, in the live route's shape. */
export function previewRadarAnalytics(state, { pro = false } = {}) {
  const papers = papersFor(state);
  const chronological = [...papers].sort((a, b) => a.completedAt - b.completedAt);
  const totals = papers.reduce((t, a) => ({ correct: t.correct + (a.correct || 0), wrong: t.wrong + (a.wrong || 0), unattempted: t.unattempted + (a.unattempted || 0) }), { correct: 0, wrong: 0, unattempted: 0 });
  const bySubject = new Map();
  for (const a of papers) {
    const s = bySubject.get(a.subject) || { tests: 0, total: 0, correct: 0, totalQ: 0 };
    s.tests += 1; s.total += a.score; s.correct += a.correct || 0; s.totalQ += a.total || 0;
    bySubject.set(a.subject, s);
  }
  const insight = buildInsight({
    attempts: papers, openAttempts: papers, heldQids: new Set(),
    user: { isPremium: pro, subjects: SUBJECTS },
    progress: { rows: progressOf(papers), incomplete: false },
    syllabus: { unitsFor, resolveChapter, isTop: isTopSubject }, nameOf,
    totals: { wrong: totals.wrong, unattempted: totals.unattempted },
  });
  return {
    insight,
    totalAttempts: papers.length, totals, scoring: { server: papers.length, device: 0 },
    timeline: chronological.map((a, i) => ({ test: `T${i + 1}`, score: a.score, at: a.completedAt, scoring: 'server' })),
    subjects: [...bySubject].map(([id, s]) => ({ id, name: NAMES[id] || id, tests: s.tests, avg: Math.round(s.total / s.tests), accuracy: s.totalQ ? Math.round((s.correct / s.totalQ) * 100) : 0 })),
    weakChapters: [],
  };
}

/** GET /api/prepos/insights for view=radar, from the same papers. */
export function previewRadarRecord(state) {
  const insights = computePrepOSInsights(papersFor(state), { subjectNames: NAMES });
  return { ok: true, insights, findings: readout(insights, { limit: 4 }) };
}
