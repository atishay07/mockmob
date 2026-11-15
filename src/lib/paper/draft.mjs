// The device draft of a running paper (src/app/(app)/test/TestPageClient.jsx), 15 Nov 2026 (bugs-core B1, B2, B8, B12).
// Production holds every practice paper on the device, so this draft is the only copy of a student's answers until the
// submit lands. This file says where a draft lives, how long it is kept, which tab may write it, and what a submit must
// carry. Pure: no React and no storage of its own (callers pass the stored values in).
//
// The rule every part keeps: a submit never carries fewer answers than the newest draft on this device for this paper.
import { SUBMISSION_GRACE_MS, draftMatches } from '../../../data/session_draft.js';
import { LATE_WINDOW_MS } from '../../../data/late_paper.js';

export { SUBMISSION_GRACE_MS, LATE_WINDOW_MS };
export const DRAFT_VERSION = 2;
/**
 * How long a paper that was not sent by the end of its upload grace (answers still on the device: B8) and the small "sent"
 * mark that replaces a submitted draft are kept: the server takes a late paper for 7 days after its timer ends
 * (data/late_paper.js), so the draft is kept exactly that long. After this the sweep removes them.
 */
export const KEEP_AFTER_END_MS = LATE_WINDOW_MS;

export const draftPrefix = (userId) => `mm:test:${userId || 'anon'}:`;
const PAPER_PART = 'paper:';

/**
 * One key per paper (B2c): the session id the address names (a resume link), else the paper's generation key, which
 * Practice mints for every start. Two papers can never share a key, so starting a new paper never touches a live one.
 * Old drafts (keyed by subject, chapter, count, level and mode) are not migrated: the runner still reads one for the same
 * generation key, and the sweep removes them once their time is over.
 */
export function paperDraftKey(userId, { generationKey, sessionId } = {}) {
  const id = sessionId ? `s.${sessionId}` : generationKey ? `g.${generationKey}` : '';
  return id ? `${draftPrefix(userId)}${PAPER_PART}${id}` : null;
}

/** The key drafts had before 15 Nov 2026 (one per set, so a relaunch of the same set overwrote a live paper). */
export function legacyDraftKey(userId, { subject, chapter, count, difficulty = 'auto', modeId = 'quick' } = {}) {
  return `${draftPrefix(userId)}${subject}:${chapter || '*'}:${count}:${difficulty || 'auto'}:${modeId}`;
}

export const isPaperDraftKey = (key, userId) => typeof key === 'string' && key.startsWith(`${draftPrefix(userId)}${PAPER_PART}`) && !key.includes(':integrity');

export const answeredCount = (answers) => Object.values(answers && typeof answers === 'object' ? answers : {}).filter((value) => value !== undefined && value !== null).length;

/**
 * What a sent paper leaves in its draft's place: enough for a Back to the paper's address to open its result at once
 * (B5), and for another tab of the same paper to say it was sent there (B12). Small, and swept KEEP_AFTER_END_MS after the deadline.
 */
export function sentMark({ attemptId, endsAt, generationKey = null, sessionId = null, now }) {
  return { v: DRAFT_VERSION, submitted: true, attemptId: String(attemptId), endsAt, generationKey, sessionId, savedAt: now };
}
export const isSentMark = (saved) => saved?.submitted === true && typeof saved.attemptId === 'string' && saved.attemptId.length > 0;

/** Does this sent mark belong to the paper the address names? */
export function sentMarkMatches(saved, { generationKey, sessionId } = {}) {
  if (!isSentMark(saved)) return false;
  if (sessionId) return saved.sessionId === sessionId;
  return !!generationKey && saved.generationKey === generationKey;
}

/**
 * Where a stored draft is in its life:
 *   'live'   before the deadline: it can be resumed
 *   'grace'  past the deadline, inside the upload grace: reopening it sends these answers
 *   'late'   past the grace with answers that never reached the server (B8): kept 7 days on the device, never answered
 *            again; reopening it sends it, and the server takes it as a late paper for those 7 days
 *   'sent'   the paper was submitted; a small mark remains for KEEP_AFTER_END_MS
 *   'dead'   nothing worth keeping: removed by the sweep
 */
export function draftFate(saved, now) {
  if (!saved || typeof saved !== 'object') return 'dead';
  if (isSentMark(saved)) return Number.isFinite(saved.endsAt) && saved.endsAt + KEEP_AFTER_END_MS > now ? 'sent' : 'dead';
  if (!Number.isFinite(saved.endsAt) || !Array.isArray(saved.questions) || !saved.questions.length) return 'dead';
  if (saved.endsAt > now) return 'live';
  if (saved.endsAt + SUBMISSION_GRACE_MS > now) return 'grace';
  if (answeredCount(saved.answers) > 0 && saved.endsAt + KEEP_AFTER_END_MS > now) return 'late';
  return 'dead';
}

/** A draft of this paper whose time and grace are over but whose answers never reached the server (B8): it can still be sent. */
export function lateDraft(saved, match, now) {
  return draftMatches(saved, match) && draftFate(saved, now) === 'late';
}

// ---- one tab per paper (B12) -----------------------------------------------------------------------------------------
// Each tab that opens a paper claims it ({ tab, at }) and writes its claim into every save. The newest claim wins: a second
// tab opened on the same paper starts from the newest draft and claims it, and the older tab stops writing and says the paper
// is open in another tab, with one key that takes it back (a reload, which reads the newest draft again).

/** Has another tab taken this paper since this tab claimed it, or sent it? */
export function claimedElsewhere(stored, claim) {
  if (!stored || typeof stored !== 'object' || !claim) return false;
  if (isSentMark(stored)) return true;
  return typeof stored.owner === 'string' && stored.owner !== claim.tab && Number(stored.claimedAt) > Number(claim.at);
}

// ---- what a submit carries -------------------------------------------------------------------------------------------
const progressSeq = (events) => (Array.isArray(events) ? events : [])
  .reduce((most, event) => (event && event.type !== 'end' && Number.isFinite(event.seq) && event.seq > most ? event.seq : most), 0);

/**
 * The answers and events a submit sends: this tab's own, unless the stored draft of the same paper went further (another
 * tab of it answered after this one stopped), in which case the stored draft's, with this tab's end event put after them.
 * Never the other way round: a submit never carries fewer answers than the newest draft on this device.
 */
export function newestProgress(memory, stored) {
  const own = { answers: memory?.answers || {}, events: Array.isArray(memory?.events) ? memory.events : [], from: 'memory' };
  if (!stored || typeof stored !== 'object' || isSentMark(stored) || !stored.answers || typeof stored.answers !== 'object') return own;
  if (memory?.sessionId && stored.selectionMeta?.sessionId !== memory.sessionId) return own;
  const theirs = progressSeq(stored.events);
  if (theirs <= progressSeq(own.events)) return own;
  const events = [...stored.events];
  const end = own.events.at(-1);
  if (end?.type === 'end') events.push({ ...end, seq: (events.at(-1)?.seq || 0) + 1, at: Math.max(end.at || 0, events.at(-1)?.at || 0) });
  return { answers: { ...stored.answers }, events, from: 'stored' };
}

// ---- the sweep -------------------------------------------------------------------------------------------------------
/**
 * Which of this user's stored keys to remove: drafts whose fate is 'dead', unreadable values under the paper prefix, and NTA
 * warning counts whose draft is gone. `entries` is [key, value] pairs; `keep` is the key of the paper being opened now.
 * Values that are not drafts this file knows are left alone.
 */
export function draftsToSweep(entries, userId, now, { keep = null } = {}) {
  const prefix = draftPrefix(userId);
  const fates = new Map();
  const remove = [];
  for (const [key, raw] of entries || []) {
    if (typeof key !== 'string' || !key.startsWith(prefix) || key.includes(':integrity') || key === keep) continue;
    let saved = null;
    try { saved = JSON.parse(raw); } catch { saved = null; }
    if (!saved || typeof saved !== 'object') { if (key.startsWith(prefix + PAPER_PART)) remove.push(key); continue; }
    if (!('endsAt' in saved)) continue;
    const fate = draftFate(saved, now);
    fates.set(key, fate);
    if (fate === 'dead') remove.push(key);
  }
  for (const [key] of entries || []) {
    if (typeof key !== 'string' || !key.startsWith(prefix)) continue;
    const at = key.indexOf(':integrity');
    if (at < 0) continue;
    const base = key.slice(0, at);
    if (keep && base === keep) continue;
    if (!fates.has(base) || fates.get(base) === 'dead') remove.push(key);
  }
  return remove;
}

/** Every [key, value] under this user's draft prefix in a Storage (never throws). */
export function storedDrafts(storage, userId) {
  const prefix = draftPrefix(userId);
  const out = [];
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key?.startsWith(prefix)) out.push([key, storage.getItem(key)]);
    }
  } catch { /* storage blocked: nothing to read */ }
  return out;
}
