// The first full mock in each subject is free (CTO decision, 19 Oct 2026, about 2:50 am, recorded for the owner).
//
// Why: the owner's D109 ("I don't know my range") estimates a student's range after ONE full mock per subject of their set.
// A fresh Free account cannot pay 50 credits for each of five subjects, and G16 says a fresh account must be complete without
// Pro or payment. A full mock has no AI cost (its questions come from the bank), so the first one in each subject is on us.
//
// The rule, one place (this file decides; src/lib/server/firstFullMock.js reads and writes the facts):
//   * Who: a Free student. Pro already pays nothing for any mode, and a Mob paper is free already (data/practice_charge.js).
//   * What: a Full mock (mode 'full', the 50-question, 60-minute paper). NTA mode needs Pro, so it is never the free one.
//   * Once per subject, ever, and it is used when it is STARTED, not when it is finished. The free start writes one row to
//     learning_allowances (kind 'first_full_mock:<subject>', period 'ever', reference = the session id). That table's primary
//     key (user_id, kind, period) is the lock: two starts at the same moment cannot both write it, so only one is free, and an
//     abandoned free start still holds the row, so leaving a paper unfinished can never earn another free one. This is the
//     same table and the same key the other free paths use (today's included set, the first set in a subject, the full sample).
//   * Not for a student who has already finished a full-length paper in that subject: any saved Full mock or NTA mode attempt
//     in the subject (attempts.selection_meta->>'mode'). Their first full mock has happened, so the next one is charged.
//   * A paid start that was abandoned does not count (it cost 50 credits, so it cannot be farmed, and on the device-held path
//     its ledger line does not name a subject anyway).
//   * Unknown is never free: a fact that could not be read prices the paper as before (50 credits).
//   * A replay of the free start (the same generation key, so the same session id) is the same free paper, never a second
//     free one and never a charge. A different start finds the row taken and is charged exactly as before.
import { TEST_MODES } from './test_modes.js';

export const FIRST_FULL_MOCK_MODE = 'full';
export const FIRST_FULL_MOCK_PERIOD = 'ever';
export const FIRST_FULL_MOCK_KIND_PREFIX = 'first_full_mock:';
/** The machine reason the quote carries when this rule makes the price 0 (clients may switch on it). */
export const FIRST_FULL_MOCK_REASON = 'first_full_mock_free';

/** The modes whose saved attempt means the student has already sat a full-length paper: Full mock and NTA mode. */
export const FULL_PAPER_MODES = Object.freeze(
  Object.values(TEST_MODES).filter((m) => m.fixedCount > 0 && m.fixedDurationSec > 0).map((m) => m.id),
);

/** The four states. 'mine' only on a start: the free row is already held by this very session (a replay). */
export const FIRST_FULL_MOCK_STATE = Object.freeze({ available: 'available', mine: 'mine', used: 'used', unknown: 'unknown' });

// The words (R6, D84, D114: short, true and in his voice). `price` is what the quote's `reason` says and what the apps show
// beside the price; `short` is the price chip where there is only room for a word; `plan` is the pricing page's line.
export const FIRST_FULL_MOCK_COPY = Object.freeze({
  price: 'Free: your first full mock in this subject is on us.',
  short: 'Free',
  plan: 'Your first full mock in every subject is free.',
});

/** 'first_full_mock:<subject>' for an internal subject id, or null when the id is not one. */
export function firstFullMockKind(subject) {
  return typeof subject === 'string' && /^[a-z0-9_]{1,40}$/.test(subject) ? `${FIRST_FULL_MOCK_KIND_PREFIX}${subject}` : null;
}

/** Does the rule apply to this start at all? Free student, Full mock, not a Mob paper. */
export function firstFullMockApplies({ isPremium = false, modeId, mobPaper = null } = {}) {
  return isPremium !== true && !mobPaper && modeId === FIRST_FULL_MOCK_MODE;
}

/**
 * The state from the facts the server read.
 *   facts.fullPapers  saved Full mock or NTA mode attempts in the subject; null when the read failed
 *   facts.claim       { reference } when the free row exists, null when it does not, undefined when the read failed
 *   sessionId         the start's own session id (a start only; the quote has none)
 * Returns 'available' | 'mine' | 'used' | 'unknown'.
 */
export function firstFullMockState(facts, { sessionId = null } = {}) {
  const S = FIRST_FULL_MOCK_STATE;
  if (!facts || typeof facts !== 'object') return S.unknown;
  const { fullPapers, claim } = facts;
  if (claim === undefined) return S.unknown;
  // The free row first: a replay of the free start stays free even after another paper was finished.
  if (claim) return sessionId && String(claim.reference) === String(sessionId) ? S.mine : S.used;
  if (!Number.isInteger(fullPapers) || fullPapers < 0) return S.unknown;
  return fullPapers > 0 ? S.used : S.available;
}

/** Is a start in this state free? 'available' (it will take the row) or 'mine' (it already holds it). */
export function firstFullMockIsFree(state) {
  return state === FIRST_FULL_MOCK_STATE.available || state === FIRST_FULL_MOCK_STATE.mine;
}
