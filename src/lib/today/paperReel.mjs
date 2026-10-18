// Today's one-time "Play your paper back" card (owner D29, 18 Oct 4:10 am IST; the reel is the result's own engine,
// src/components/result/PaperReel.jsx and data/replay.js). PURE: no I/O beyond an injected storage, no clock (the caller
// passes `now`).
//
// After a fresh submission Today shows the card ONCE in the lead's place: "Play your paper back, 20 s", one tap to play it and
// one tap on "Not now". Once the card has been on screen for an attempt it is never shown for that attempt again (a list
// of the last 20 attempt ids in localStorage), and the Up next card returns. Nothing is invented: the script comes from the
// saved paper, through the same analysis, time read, costliest line and next move as the result page.
import { analyseSession } from '../../../data/session_recovery.js';
import { buildTimeDecisions } from '../../../data/time_decisions.js';
import { attemptMode, costliestLine, nextMove } from '../../../data/result_next_move.mjs';
import { reelSeconds } from '../../../data/replay.js';
import { practiceSubjectId } from '../paperCopy.mjs';
import { reelScriptOf } from '../../components/result/reelScript.mjs';

/** A paper is fresh for 3 hours after it was saved: the student has just come from the result, not back the next day. */
export const FRESH_MS = 3 * 3600000;
export const SEEN_KEY = 'mm:today-reel:v1';
const KEEP = 20;

/** The paper the card is about: the newest paper, when it was saved within FRESH_MS (a few minutes of clock skew allowed). */
export function freshPaper(papers, now = Date.now()) {
  const p = Array.isArray(papers) ? papers[0] : null;
  if (!p || typeof p.id !== 'string' || !p.id) return null;
  const at = Number(p.completedAt);
  if (!Number.isFinite(at)) return null;
  const age = now - at;
  return age >= -300000 && age <= FRESH_MS ? p : null;
}

const readList = (storage) => {
  try {
    const list = JSON.parse(storage?.getItem(SEEN_KEY) || '[]');
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
};

/** Has the card already been shown for this attempt? Unreadable storage counts as not seen (it then shows once per page). */
export const reelSeen = (storage, id) => readList(storage).includes(id);

/** Remember that the card was shown for this attempt. Never throws. */
export function markReelSeen(storage, id) {
  if (!id) return;
  try {
    const list = readList(storage).filter((x) => x !== id);
    list.push(id);
    storage?.setItem(SEEN_KEY, JSON.stringify(list.slice(-KEEP)));
  } catch { /* this visit only */ }
}

/**
 * The reel for one saved paper (GET /api/attempts/{id}), built exactly as the result page builds it. `{ script, seconds, move }`,
 * or null when there is nothing to play back (a paper with nothing answered, or a record that cannot be read).
 */
export function reelFor(attempt, { hour = null, aiCredits = null, practiceCredits = null, isPremium = false, subjectName = (id) => id } = {}) {
  try {
    const analysis = analyseSession(attempt);
    if (!analysis?.rows?.length) return null;
    const answerReviews = attempt.answerReviews || {};
    const served = attempt.lab?.time;
    const timeRead = served && typeof served === 'object' && typeof served.state === 'string' && (served.state !== 'ready' || Array.isArray(served.rows))
      ? served : buildTimeDecisions(attempt, { answerReviews });
    // A repair the server already holds counts as repaired, as on the result when it loads.
    const saved = new Set([...(Array.isArray(attempt.lab?.repaired) ? attempt.lab.repaired : []), ...Object.keys(attempt.savedRepairs && typeof attempt.savedRepairs === 'object' ? attempt.savedRepairs : {})]);
    const repaired = new Set((analysis.mistakes || []).filter((r) => saved.has(r.q.id)).map((r) => r.q.id));
    const move = nextMove({
      analysis, answerReviews, repairOrder: attempt.lab?.repairOrder || null, repaired, checks: {}, aiCredits,
      practiceCredits, isPremium, mode: attemptMode(attempt), subject: practiceSubjectId(attempt.subject), subjectName: subjectName(attempt.subject),
      labReady: Boolean(attempt.lab) && attempt.answerReviewState !== 'unavailable', hour,
    });
    const finding = costliestLine(analysis, { answerReviews });
    const script = reelScriptOf({ analysis, attempt, timeRead, finding, move });
    return script ? { script, seconds: reelSeconds(script), move } : null;
  } catch {
    return null;
  }
}

/** Where the reel's last key goes on Today: a repair or a check opens that question's result, anything else the paper's result. */
export function reelActHref(attemptId, { kind = null, target = null } = {}) {
  const base = `/result/${encodeURIComponent(attemptId)}`;
  return (kind === 'repair' || kind === 'check') && Number.isInteger(target?.number) ? `${base}?q=${target.number}` : base;
}
