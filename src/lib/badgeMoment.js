// What earning a badge says, and which badges are owed a moment (lane "badges", 16 Nov 2026). PURE: no I/O, no clock (callers
// pass `now`), no storage of its own (callers pass an object with getItem and setItem). Reads the board studyBadges.js builds
// from the server's list (badgePathsFromApi); never decides that anything is earned.
//
// Truth rules, held by data/tests/badge_moment_1116.test.mjs:
//   a moment is drawn only for a badge the server dates (earned with a real earnedAt), recent, and not seen on this device;
//   every sentence is true of the record: a paper is named only when the server's record names it, counts carry their unit;
//   nothing ranks the student against anyone (no rank, no percentile, no "top"), and no word is a lock, a flame or a cheer.
import { paperKind, subjectName } from './studyBadges.js';
import { RECENT_MS, SEEN_PREFIX, countLeft, isSeen, toMs } from './badgeShelf.js';

/** What each badge needs, in plain words (the collection's line under a badge not earned yet). The rules are the conditions'. */
export const NEEDS = {
  first_scored_session: 'Answer 5 or more questions in one set.',
  first_full_mock: 'Finish a 50-question full mock.',
  first_nta: 'Finish a paper in NTA mode.',
  sessions_10: 'Finish 10 sets of 5 or more answers.',
  full_mocks_5: 'Finish 5 full mocks or NTA papers.',
  first_repair: 'Repair one of your mistakes.',
  repairs_5: 'Finish 5 repairs.',
  repairs_10: 'Finish 10 repairs.',
  repairs_25: 'Finish 25 repairs.',
  first_hold: 'Get a fresh question right on a mistake you repaired.',
  first_week_met: 'Reach your study-day goal in one week.',
  weeks_met_4: 'Reach your goal in 4 weeks. They need not be in a row.',
  run_weeks_3: 'Reach your goal 3 weeks in a row.',
  clean_set: 'Get every answer right in a set of 10 or more questions.',
  four_subjects: 'Finish a scored set in 4 different subjects.',
  new_best: 'Beat your own marks on the same kind of mock.',
};

// What the student did, said to them, when no paper is on record (the record adds the paper where the server names it).
const DID = {
  first_scored_session: 'Your first set with 5 or more answers was scored.',
  first_full_mock: 'Your first 50-question full mock was scored.',
  first_nta: 'You finished your first paper in NTA mode.',
  sessions_10: 'You have 10 scored sets of 5 or more answers.',
  full_mocks_5: 'You have finished 5 full mocks or NTA papers.',
  first_repair: 'You finished your first repair.',
  repairs_5: 'You have finished 5 repairs.',
  repairs_10: 'You have finished 10 repairs.',
  repairs_25: 'You have finished 25 repairs.',
  first_hold: 'A mistake you repaired was answered right on a fresh question.',
  first_week_met: 'A week reached your study-day goal.',
  weeks_met_4: '4 weeks have reached your goal.',
  run_weeks_3: '3 weeks in a row reached your goal.',
  clean_set: 'Every answer was right in a scored set of 10 or more questions.',
  four_subjects: 'You have scored sets in 4 different subjects.',
  new_best: 'You beat your own marks on the same kind of mock.',
};

// The same fact for a friend (the share line): about the badge, never about anyone else.
const FACT = {
  first_scored_session: 'For a first scored set of 5 or more answers.',
  first_full_mock: 'For a first 50-question full mock.',
  first_nta: 'For a first paper in NTA mode.',
  sessions_10: 'For 10 scored sets.',
  full_mocks_5: 'For 5 full mocks.',
  first_repair: 'For a first repaired mistake.',
  repairs_5: 'For 5 repaired mistakes.',
  repairs_10: 'For 10 repaired mistakes.',
  repairs_25: 'For 25 repaired mistakes.',
  first_hold: 'For a repaired mistake that held on a fresh question.',
  first_week_met: 'For a first week at my study-day goal.',
  weeks_met_4: 'For 4 weeks at my study-day goal.',
  run_weeks_3: 'For 3 weeks in a row at my study-day goal.',
  clean_set: 'For every answer right in a set of 10 or more.',
  four_subjects: 'For scored sets in 4 subjects.',
  new_best: 'For beating my own best on the same kind of mock.',
};

const n = (v) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null);

/**
 * The one true sentence of what the student did. With the server's record of the paper (the five badges a paper earns), the
 * paper is named: "Every answer right: 10 of 10 in your Economics practice set." Without one, the badge's own fact.
 */
export function earnedSentence(stepId, record = null) {
  const r = record && record.attemptId ? record : null;
  if (r) {
    const where = `your ${subjectName(r.subject)} ${paperKind(r.mode)}`;
    const marks = n(r.marks), max = n(r.max ?? r.maxMarks);
    const hasMarks = marks != null && max != null && max > 0;
    if (stepId === 'new_best' && hasMarks && n(r.before) != null) return `${marks} of ${max} marks on ${where}. Your best before was ${n(r.before)}.`;
    if (stepId === 'clean_set' && max != null && max >= 50) { const q = Math.round(max / 5); return `Every answer right: ${q} of ${q} in ${where}.`; }
    if (stepId === 'first_nta' && hasMarks) return `You finished your first paper in NTA mode: ${subjectName(r.subject)}, ${marks} of ${max} marks.`;
    if (stepId === 'full_mocks_5') return `${where[0].toUpperCase()}${where.slice(1)} was your 5th full mock or NTA paper.`;
    if (stepId === 'four_subjects') return `${where[0].toUpperCase()}${where.slice(1)} made it 4 subjects.`;
  }
  return DID[stepId] || '';
}

/**
 * What the next badge on the same path needs, in one line, from the board (paths from badgePathsFromApi, entries from
 * countEntries): "Next: 10 repairs. 5 more repairs." or "Next: It held. Get a fresh question right on a mistake you repaired."
 * "Your best work" is not a sequence: "Also to earn: Four subjects. 1 more subject." A path with nothing left: its own line.
 * A badge the server could not read is never named as next.
 */
export function nextLine(paths, stepId, entries = {}) {
  const path = (paths || []).find((p) => p.steps.some((s) => s.id === stepId));
  if (!path) return '';
  const open = path.steps.filter((s) => s.id !== stepId && (s.status === 'next' || s.status === 'later'));
  const at = path.steps.findIndex((s) => s.id === stepId);
  const next = path.id === 'best' ? open[0] : path.steps.slice(at + 1).find((s) => s.status === 'next' || s.status === 'later') || open[0];
  if (!next) return path.steps.every((s) => s.status === 'earned') ? 'You have every badge on this path.' : '';
  const c = countLeft(next.id, entries);
  const lead = path.id === 'best' ? 'Also to earn' : 'Next';
  return `${lead}: ${next.name}. ${c ? `${c.more[0].toUpperCase()}${c.more.slice(1)}.` : NEEDS[next.id] || next.condition || ''}`.trim();
}

/** What the badge was for, said to a friend (the share picture's line). */
export const shareFact = (id) => FACT[id] || '';

/** "Earned 17 Nov" style date words are the caller's; this is the text a friend receives. Plain, no rank, no percentile. */
export function shareLine(step, dateWords = '') {
  const fact = FACT[step?.id] || '';
  return `${step?.name || 'A badge'}: a badge I earned on MockMob${dateWords ? `, ${dateWords}` : ''}. ${fact}`.trim();
}

/** The share picture's file name: "mockmob-badge-5-repairs.png". */
export const shareFileName = (step) => `mockmob-badge-${String(step?.name || 'badge').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`;

/**
 * Everything one earned badge's moment says: { id, name, pathId, pathTitle, sentence, next }. From the board only.
 */
export function momentOf(paths, records, stepId, entries = {}) {
  const path = (paths || []).find((p) => p.steps.some((s) => s.id === stepId));
  const step = path?.steps.find((s) => s.id === stepId);
  if (!step || step.status !== 'earned') return null;
  return { id: step.id, name: step.name, pathId: path.id, pathTitle: path.title, earnedAt: step.earnedAt, sentence: earnedSentence(step.id, records?.[step.id]), next: nextLine(paths, step.id, entries) };
}

// ---------------------------------------------------------------------------------------------
// Today: a badge earned away from a result (a repair, a week met, a fresh check that held) is owed its moment where the
// student is. Device-only, like the result's: the same `mm:badge-seen:<id>` keys.

/** The paper whose result already looked for its badges on this device. */
export const PAPER_KEY = 'mm:badge-paper:v1';

/** Earned badges dated within the last three days and not seen on this device, oldest first (so they land in the order earned). */
export function freshEarned(paths, now, storage) {
  if (!Number.isFinite(now)) return [];
  return (paths || []).flatMap((p) => p.steps)
    .filter((s) => s.status === 'earned' && s.earnedAt != null && !s.undated && now - s.earnedAt <= RECENT_MS && s.earnedAt <= now + 60000)
    .filter((s) => !isSeen(storage, s))
    .sort((a, b) => a.earnedAt - b.earnedAt);
}

/**
 * Whether Today should ask the server for its badge list at all (it costs a read on the page students open most): only when
 * something on this device suggests a badge may be waiting. A milestone the week's own read already dates (eleven of the
 * sixteen) that is recent and unseen, or a recent paper whose result did not get to look for its badges here.
 * @param {{milestones?: Array<{id, achievedAt}>, papers?: Array<{id, completedAt}>, now: number, storage?: object}} p
 */
export function mayBeOwed({ milestones = [], papers = [], now, storage = null }) {
  if (!Number.isFinite(now)) return false;
  for (const m of Array.isArray(milestones) ? milestones : []) {
    const at = toMs(m?.achievedAt);
    if (at == null || now - at > RECENT_MS || typeof m?.id !== 'string') continue;
    if (!isSeen(storage, { id: m.id, earnedAt: at })) return true;
  }
  const newest = (Array.isArray(papers) ? papers : []).map((p) => ({ id: p?.id, at: toMs(p?.completedAt) })).filter((p) => p.id && p.at != null).sort((a, b) => b.at - a.at)[0];
  if (newest && now - newest.at <= RECENT_MS) {
    let looked = null;
    try { looked = storage?.getItem(PAPER_KEY) ?? null; } catch { looked = null; }
    if (looked !== String(newest.id)) return true;
  }
  return false;
}

/** Remembers that this paper's result looked for its badges (a blocked storage only means Today may look once more). */
export function markPaperLooked(storage, attemptId) {
  if (!attemptId) return;
  try { storage?.setItem(PAPER_KEY, String(attemptId)); } catch { /* Today may ask once more; never an error */ }
}

export { SEEN_PREFIX };
