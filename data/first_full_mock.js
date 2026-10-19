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
//     in the subject (attempts.selection_meta->>'mode' in 'full', 'nta': what every other screen counts as a mock, MOCK_MODES).
//     Their first full mock has happened, so the next one is charged. (Production, 19 Oct: 11 papers from May 2026 saved with no
//     selection_meta at all, 50 questions each, 9 students, are not counted, as no screen counts them as mocks either.)
//   * The full sample (allowance 'full_sample:<subject>', durable sessions only, never granted on production: 0 rows) was the
//     same promise for four subjects, so it is folded in: a full sample already taken means this subject's free full mock was
//     given, and once the free full mock is used (or a full paper is saved) a full-sample start is charged. One free full mock
//     per subject, whichever path gives it.
//   * A paid start that was abandoned does not count (it cost 50 credits, so it cannot be farmed, and on the device-held path
//     its ledger line does not name a subject anyway).
//   * Unknown is never free: a fact that could not be read prices the paper as before (50 credits), and leaves every other
//     path exactly as it was.
//   * A replay of the free start (the same generation key, so the same session id) is the same free paper, never a second
//     free one and never a charge.
//   * A start launched from a quote that said "free" (Practice sends firstFree=1) is never charged without a warning (release 11
//     verifier L1): when another device or tab took the subject's free row since that quote, or this start finds the row taken
//     while it claims it, it is refused with FIRST_FULL_MOCK_TAKEN and nothing is charged. The client asks for a new quote and
//     shows the price before the student starts again. A start sent without firstFree (the app's builds) that finds the row
//     already taken before it claims is charged as before, which is the price its own quote then showed.
//   * The kill switch (C-dec 1 promised it; verifier L4): FIRST_FULL_MOCK_ENABLED. ON when unset; "false" turns it off. Off, the
//     server never grants the free first full mock (every Full mock is priced and charged as before this rule) and every line
//     that says the first full mock is free is left out. next.config.mjs passes the variable into the builds, so a change takes
//     a redeploy, as every environment variable on Vercel does.
import { TEST_MODES, practiceCreditCost } from './test_modes.js';

/** Is the rule on? `value` is FIRST_FULL_MOCK_ENABLED: unset or anything but "false" is on. */
export function firstFullMockEnabled(value = switchValue()) {
  return String(value ?? '').trim().toLowerCase() !== 'false';
}
// Written out as `process.env.FIRST_FULL_MOCK_ENABLED` so the build can put the value into the browser bundle (next.config.mjs).
function switchValue() {
  try { return process.env.FIRST_FULL_MOCK_ENABLED; } catch { return undefined; }
}
/** The switch as this build reads it: the words below are written once, when the module loads. */
export const FIRST_FULL_MOCK_ON = firstFullMockEnabled();

/**
 * The refusals a start gets when the free first full mock it was quoted is not free now. Nothing is charged either way; the
 * sessions route sends the sentence as `message` (src/app/api/sessions/route.js) and the client asks for a new quote.
 *   FIRST_FULL_MOCK_TAKEN      409: the subject's free one was taken by another start (reason 'taken'), or the rule is off ('off')
 *   FIRST_FULL_MOCK_UNCHECKED  503: whether it is still free could not be read just now; trying again may start it free
 */
export const FIRST_FULL_MOCK_TAKEN = 'FIRST_FULL_MOCK_TAKEN';
export const FIRST_FULL_MOCK_UNCHECKED = 'FIRST_FULL_MOCK_UNCHECKED';
export const FIRST_FULL_MOCK_REFUSAL_COPY = Object.freeze({
  taken: 'Your free full mock in this subject was already started on another device or tab, so this one is not free. It did not start, and nothing was charged. Check the price, then start again.',
  off: 'This full mock is not free any more. It did not start, and nothing was charged. Check the price, then start again.',
  unchecked: 'We could not check that this full mock is still free, so it did not start and nothing was charged. Try again in a moment.',
});
export function firstFullMockTakenError(reason = 'taken') {
  const message = reason === 'off' ? FIRST_FULL_MOCK_REFUSAL_COPY.off : FIRST_FULL_MOCK_REFUSAL_COPY.taken;
  return Object.assign(new Error(FIRST_FULL_MOCK_TAKEN), { publicMessage: message, publicDetail: { retryable: false, requote: true, reason } });
}
export function firstFullMockUncheckedError() {
  return Object.assign(new Error(FIRST_FULL_MOCK_UNCHECKED), { publicMessage: FIRST_FULL_MOCK_REFUSAL_COPY.unchecked, publicDetail: { retryable: true, requote: true, reason: 'unchecked' } });
}
/** Did the start say its quote was free? Practice sends firstFree=1 with a start whose quote carried freeReason. */
export function quotedFirstFree(input) {
  const v = input?.firstFree;
  return v === true || v === 1 || v === '1' || v === 'true';
}

export const FIRST_FULL_MOCK_MODE = 'full';
export const FIRST_FULL_MOCK_PERIOD = 'ever';
export const FIRST_FULL_MOCK_KIND_PREFIX = 'first_full_mock:';
/** The durable-only full sample this rule folds in (data/practice_charge.js, data/practice_quote.js allowanceKindFor). */
export const FULL_SAMPLE_KIND_PREFIX = 'full_sample:';
/** The machine reason the quote carries when this rule makes the price 0 (clients switch on it to say FIRST_FULL_MOCK_COPY.price). */
export const FIRST_FULL_MOCK_REASON = 'first_full_mock_free';

/** The modes whose saved attempt means the student has already sat a full-length paper: Full mock and NTA mode. */
export const FULL_PAPER_MODES = Object.freeze(
  Object.values(TEST_MODES).filter((m) => m.fixedCount > 0 && m.fixedDurationSec > 0).map((m) => m.id),
);

/** The four states. 'mine' only on a start: the free row is already held by this very session (a replay). */
export const FIRST_FULL_MOCK_STATE = Object.freeze({ available: 'available', mine: 'mine', used: 'used', unknown: 'unknown' });

const FULL_MOCK_PRICE = practiceCreditCost('full', TEST_MODES.full.fixedCount);

// The words (R6, D84, D114: short, true and in his voice).
//   price   the price of a full mock for a student who qualifies, wherever a screen shows that price (the Practice card's
//           Cost row on the web); the line the apps show for freeReason 'first_full_mock_free'
//   short   the price chip where there is only room for a word (the Full mock tile, the phone session bar)
//   reason  the quote's own `reason` sentence under the price, so the card does not say the price line twice
//   plan    the Free plan's line in sentences (Account > Plan)
//   planItem the same line in the pricing page's Free list, whose items are fragments without a full stop
//   tile    the Start sheet's Full mock row, a half-width tile on a phone (two lines at most at 390 px), under the row's own
//           "Full mock" title and its subject, so "one" is the full mock in that subject (copy pass, 19 Oct)
export const FIRST_FULL_MOCK_COPY = Object.freeze({
  price: 'Free: your first full mock in this subject is on us.',
  short: 'Free',
  tile: 'Your first one is free',
  reason: `No credits are charged for this one. Your next full mock in this subject costs ${FULL_MOCK_PRICE} credits.`,
  plan: 'Your first full mock in every subject is free.',
  planItem: 'Your first full mock in every subject is free',
});

/** 'first_full_mock:<subject>' for an internal subject id, or null when the id is not one. */
export function firstFullMockKind(subject) {
  return typeof subject === 'string' && /^[a-z0-9_]{1,40}$/.test(subject) ? `${FIRST_FULL_MOCK_KIND_PREFIX}${subject}` : null;
}

/** 'full_sample:<subject>' for an internal subject id, or null when the id is not one. */
export function fullSampleKind(subject) {
  return firstFullMockKind(subject) ? `${FULL_SAMPLE_KIND_PREFIX}${subject}` : null;
}

/** Does the rule apply to this start at all? The switch is on, a Free student, a Full mock, not a Mob paper. */
export function firstFullMockApplies({ isPremium = false, modeId, mobPaper = null } = {}) {
  return firstFullMockEnabled() && isPremium !== true && !mobPaper && modeId === FIRST_FULL_MOCK_MODE;
}

/**
 * The state from the facts the server read.
 *   facts.fullPapers  saved Full mock or NTA mode attempts in the subject; null when the read failed
 *   facts.claim       { reference } when the free row exists, null when it does not, undefined when the read failed
 *   facts.sample      true when a full-sample row exists for the subject (false or absent when not)
 *   sessionId         the start's own session id (a start only; the quote has none)
 * Returns 'available' | 'mine' | 'used' | 'unknown'.
 */
export function firstFullMockState(facts, { sessionId = null } = {}) {
  const S = FIRST_FULL_MOCK_STATE;
  if (!facts || typeof facts !== 'object') return S.unknown;
  const { fullPapers, claim, sample = false } = facts;
  if (claim === undefined) return S.unknown;
  // The free row first: a replay of the free start stays free even after another paper was finished.
  if (claim) return sessionId && String(claim.reference) === String(sessionId) ? S.mine : S.used;
  if (sample === true) return S.used;
  if (!Number.isInteger(fullPapers) || fullPapers < 0) return S.unknown;
  return fullPapers > 0 ? S.used : S.available;
}

/** Is a start in this state free? 'available' (it will take the row) or 'mine' (it already holds it). */
export function firstFullMockIsFree(state) {
  return state === FIRST_FULL_MOCK_STATE.available || state === FIRST_FULL_MOCK_STATE.mine;
}

/**
 * The rule's state as a server quote (GET /api/practice/quote) says it, for screens that price a full mock without being
 * Practice: 'available' when the quote prices this Full mock at 0 for this rule (freeReason) or says the free one is still there,
 * 'used' when it says it was given, else 'unknown' (no quote, a Pro quote, a failed read). 'unknown' is never free.
 */
export function firstFullMockFromQuote(quote) {
  if (!quote || typeof quote !== 'object') return FIRST_FULL_MOCK_STATE.unknown;
  if (quote.freeReason === FIRST_FULL_MOCK_REASON) return FIRST_FULL_MOCK_STATE.available;
  if (quote.firstFullMock === FIRST_FULL_MOCK_STATE.available || quote.firstFullMock === FIRST_FULL_MOCK_STATE.used) return quote.firstFullMock;
  return FIRST_FULL_MOCK_STATE.unknown;
}

/** Is this allowance kind the full sample the rule folds in? */
export function isFullSampleKind(kind) {
  return typeof kind === 'string' && kind.startsWith(FULL_SAMPLE_KIND_PREFIX);
}
