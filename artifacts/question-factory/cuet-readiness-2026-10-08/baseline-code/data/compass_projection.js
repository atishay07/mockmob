// Compass Pro: a practice projection and a personal DU shortlist. Pure; no model call.
//
// What it is: arithmetic on the student's own server-scored practice. For each CUET paper
// (50 questions, +5 / -1), it asks "if exam day went exactly like your practice in this subject,
// what would the paper be worth?", using the share of questions attempted and the accuracy's
// Wilson range. What it is not: a prediction, a percentile, a normalised CUET score or an
// admission chance. Copy that renders these numbers must say so.
import { wilson, MARK_RIGHT, MARK_WRONG } from './prepos_insights.js';

export const QUESTIONS_PER_PAPER = 50;
export const PAPER_MAX = QUESTIONS_PER_PAPER * MARK_RIGHT; // 250
export const MIN_PAPER_SAMPLE = 30; // answered or skipped practice questions before a paper is projected
export const LANGUAGE_IDS = new Set(['english', 'hindi', 'assamese', 'bengali', 'gujarati', 'kannada', 'malayalam', 'marathi', 'odia', 'punjabi', 'sanskrit', 'tamil', 'telugu', 'urdu']);

/** Right / wrong / blank counts per subject from server-scored attempts. */
export function subjectSummaries(attempts = [], subjectNames = {}) {
  const map = new Map();
  for (const a of attempts) {
    if (!a?.subject || !Array.isArray(a.details) || !a.details.length) continue;
    const s = map.get(a.subject) || { subject: a.subject, name: subjectNames[a.subject] || a.subject, n: 0, right: 0, wrong: 0, skip: 0, sessions: 0 };
    s.sessions += 1;
    for (const d of a.details) {
      s.n += 1;
      if (d.isCorrect === true) s.right += 1;
      else if (d.isCorrect === false) s.wrong += 1;
      else s.skip += 1;
    }
    map.set(a.subject, s);
  }
  return [...map.values()].sort((x, y) => y.n - x.n);
}

const paperMarks = (attemptShare, accuracy) => {
  const perQuestion = attemptShare * (accuracy * MARK_RIGHT + (1 - accuracy) * MARK_WRONG);
  return Math.max(0, Math.min(PAPER_MAX, Math.round(perQuestion * QUESTIONS_PER_PAPER)));
};

/** One paper's projection, or `thin` when the record is too small to say anything. */
export function projectPaper(summary) {
  const attempted = summary.right + summary.wrong;
  const base = { subject: summary.subject, name: summary.name, n: summary.n, right: summary.right, wrong: summary.wrong, skip: summary.skip, language: LANGUAGE_IDS.has(summary.subject) };
  if (summary.n < MIN_PAPER_SAMPLE || attempted === 0) return { ...base, status: 'thin', needed: Math.max(0, MIN_PAPER_SAMPLE - summary.n) };
  const share = attempted / summary.n;
  const acc = wilson(summary.right, attempted);
  return {
    ...base, status: 'ready', attemptShare: Math.round(share * 100), accuracy: acc,
    mid: paperMarks(share, summary.right / attempted), low: paperMarks(share, acc.low / 100), high: paperMarks(share, acc.high / 100),
    open: PAPER_MAX - paperMarks(share, summary.right / attempted),
  };
}

/**
 * A four-paper total in the shape most DU programmes use (one language + three domain papers),
 * built from the student's strongest projected papers. `complete` is false when fewer than four
 * papers have enough practice; the partial sum is then reported as partial, never padded.
 */
export function projectTotal(papers) {
  const ready = papers.filter((p) => p.status === 'ready');
  const language = ready.filter((p) => p.language).sort((a, b) => b.mid - a.mid)[0] || null;
  const domain = ready.filter((p) => !p.language).sort((a, b) => b.mid - a.mid).slice(0, 3);
  const used = [...(language ? [language] : []), ...domain];
  const sum = (key) => used.reduce((total, p) => total + p[key], 0);
  return { papers: used.map((p) => p.subject), count: used.length, complete: Boolean(language) && domain.length === 3, max: used.length * PAPER_MAX, mid: sum('mid'), low: sum('low'), high: sum('high') };
}

/** Where a projected band sits against one published cutoff. */
export function compareToCutoff(band, cutoff) {
  if (cutoff === null || cutoff === undefined || !Number.isFinite(cutoff)) return { position: 'none' };
  if (band.low >= cutoff) return { position: 'above', by: Math.round((band.low - cutoff) * 10) / 10 };
  if (band.high < cutoff) return { position: 'below', by: Math.round((cutoff - band.high) * 10) / 10 };
  return { position: 'within' };
}

/** The projected paper with the most marks left open: the one that can move the total most. */
export function nextMove(papers, rankedChapters = []) {
  const ready = papers.filter((p) => p.status === 'ready').sort((a, b) => b.open - a.open);
  const target = ready[0];
  if (!target) return null;
  const chapter = rankedChapters.find((c) => c.subject === target.subject) || null;
  return { subject: target.subject, name: target.name, open: target.open, mid: target.mid, chapter: chapter ? { name: chapter.chapter, wrong: chapter.wrong, skip: chapter.skip, n: chapter.n } : null };
}

export function compassProjection(attempts, { subjectNames = {}, rankedChapters = [] } = {}) {
  const papers = subjectSummaries(attempts, subjectNames).map(projectPaper);
  return { papers, total: projectTotal(papers), next: nextMove(papers, rankedChapters), minSample: MIN_PAPER_SAMPLE, paperMax: PAPER_MAX };
}
