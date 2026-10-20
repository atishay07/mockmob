// Full mock together's price (owner D174 and D175, 20 Oct 2026). Pure, so node:test drives it and the web reads the same
// numbers the server charges:
//   start  only a Pro member starts one (with or without PLAY_BILLING_ENABLED: the rule is the owner's, not the store's)
//   sit    a Pro member sits it free; a Free member pays the solo Full mock price (50 credits) to sit it, once per game,
//          when the sitting starts (never on joining the Mob or opening the game card)
//   free   there is no free first full mock here (FIRST_FULL_MOCK_ENABLED=false is live, and a Mob paper never takes it)
// The charge itself is the solo Full mock's: the same credit action ('attempt_full', priced by spend_credits in the
// database), the same ledger (credit_transactions) and the same idempotency reference (`practice_<session id>` on a
// device-held start, `recovery:<session id>` inside start_learning_session on a durable one). The session id is derived
// from a key that is fixed per game and member (src/lib/server/mob/service.js startMock), so a retry is never charged
// twice. Nothing here grants, refunds or charges: src/lib/server/practiceSessions.js does, through practiceCharge.
import { practiceCreditAction, practiceCreditCost, TEST_MODES } from '../../../data/test_modes.js';

/** The credit action a Free member's sitting is charged under: the solo Full mock's own. */
export const MOCK_SIT_ACTION = practiceCreditAction('full', TEST_MODES.full.fixedCount);
/** What a Free member pays to sit one Full mock together, in credits (the solo Full mock's price). */
export const MOCK_SIT_CREDITS = practiceCreditCost('full', TEST_MODES.full.fixedCount);

/**
 * The credit action for this member's sitting of a Full mock together: null for Pro, MOCK_SIT_ACTION for everyone else.
 * `pro` is the server's own read of the plan (isPremium === true); a failed read is Free, as everywhere in the Mob.
 */
export const mockSitAction = ({ pro }) => (pro === true ? null : MOCK_SIT_ACTION);

/**
 * The `starts.mock` block of the den view: what Full mock together costs THIS member and whether they may start one.
 *   costCredits         what you pay to sit one (0 with Pro)
 *   sitCredits          what a Free member pays to sit one (the list price, for "Free members pay 50 credits")
 *   proRequiredToStart  always true: only a Pro member starts one
 *   canStart            your plan allows the start (Pro); the other limits (3 open games, the bank) are checked on start
 *   proSitsFree         always true
 */
export function mockStartView({ pro }) {
  const isPro = pro === true;
  return { costCredits: isPro ? 0 : MOCK_SIT_CREDITS, sitCredits: MOCK_SIT_CREDITS, proRequiredToStart: true, canStart: isPro, proSitsFree: true };
}

/**
 * A Full mock together game's `price` for THIS member. `run` is your run on it: 'none' | 'playing' | 'finished'.
 *   costCredits  what starting your sitting costs you now: 0 with Pro, 0 once you have started it (a resume is never
 *                charged again), else MOCK_SIT_CREDITS
 *   sitCredits   the Free price, as above
 *   proSitsFree  always true
 */
export function mockGamePrice({ pro, run = 'none' }) {
  const started = run === 'playing' || run === 'finished';
  return { costCredits: pro === true || started ? 0 : MOCK_SIT_CREDITS, sitCredits: MOCK_SIT_CREDITS, proSitsFree: true };
}
