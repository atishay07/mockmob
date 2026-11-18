// The `insight` part of GET /api/analytics (Marks trend, lane insight 18 Nov 2026): Your chapters, Your pace and Where your
// marks go, built from rows the product already stores. PURE: the route reads the rows and passes them in; the preview
// fixtures call this same function, so the page is drawn from the server's own shapes.
//
// Plan: the Pro plan's cross-paper pace and changed answers (pricing: "Pro ranks every chapter, with your pace and changed
// answers"; RecordView's "Pace detail from your replayed sessions is part of Pro") stay Pro here too: for Free the pace rows
// and the change line are not sent at all, only that they are Pro's. The chapter map and the marks split are free, as the
// record's chapters and ledger are.
// Each block is built on its own: one that throws is { state: 'error' } and the others still answer.
import { buildChapters } from './chapters.mjs';
import { buildPace } from './pace.mjs';
import { changesOf, marksSplit } from './marks.mjs';
import { CUET_PACE_SEC } from './words.mjs';
import { sourceLabels } from '../../components/recovery/repairRun.js';

export const INSIGHT_VERSION = 1;

const safe = (fn) => { try { return fn(); } catch { return { state: 'error' }; } };

/** The subjects the map draws: the subjects the student picked that the syllabus knows, in the student's order, once each. */
export function mapSubjects(picked, isTop) {
  return [...new Set((picked || []).map((s) => String(s || '').trim()).filter((s) => s && isTop(s)))];
}

/**
 * attempts       every attempt of the student (the timeline and totals read them all)
 * openAttempts   the attempts without Mob papers still held for their Mob
 * heldQids       the held papers' question ids
 * user           { isPremium, subjects } or null when the account could not be read
 * progress       { rows, incomplete } from readAnsweredProgress
 * optionOf       (subject) -> saved option or null
 * syllabus       { unitsFor, resolveChapter, isTop }
 * nameOf         (subject) -> the subject's name
 * totals         { wrong, unattempted } over `attempts`
 */
export function buildInsight({ attempts = [], openAttempts = [], heldQids = new Set(), user = null, progress = { rows: [], incomplete: false }, optionOf = () => null, syllabus, nameOf = (id) => id, totals = null, now = Date.now() } = {}) {
  const known = user !== null && typeof user === 'object';
  const isPro = known && user.isPremium === true;
  // The account unread: its subjects are unknown, so the map is a failed read (with its retry), never an empty one.
  const chapters = !known ? { state: 'error' } : safe(() => buildChapters({
    subjects: mapSubjects(known ? user.subjects : [], syllabus.isTop),
    unitsFor: syllabus.unitsFor, resolveChapter: syllabus.resolveChapter, optionOf, nameOf,
    progress: progress?.rows || [], incomplete: Boolean(progress?.incomplete), heldQids, papers: openAttempts, now,
  }));
  const pace = !known ? { state: 'error' }
    : !isPro ? { state: 'locked', paceSec: CUET_PACE_SEC }
      : safe(() => ({ state: 'ready', ...buildPace(openAttempts, { labels: sourceLabels(attempts), nameOf }) }));
  const marks = safe(() => {
    const t = totals || attempts.reduce((acc, a) => ({ wrong: acc.wrong + (Number(a.wrong) || 0), unattempted: acc.unattempted + (Number(a.unattempted) || 0) }), { wrong: 0, unattempted: 0 });
    const split = marksSplit({ papers: attempts.length, wrong: t.wrong, blank: t.unattempted });
    if (!split) return { state: 'none' };
    return { state: 'ready', ...split, changes: isPro ? changesOf(openAttempts) : null, changesLocked: !isPro };
  });
  return { version: INSIGHT_VERSION, plan: known ? (isPro ? 'pro' : 'free') : 'unknown', chapters, pace, marks };
}
