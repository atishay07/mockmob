// The price before the press on Today's lead card (W-060): a repair names its credit; Revise is free; a practice set or a full mock
// on a free account names its credits and the balance (Pro includes both, so nothing is printed). PURE, so the words are
// held by a test (data/tests/practice_credit_per_question.test.mjs).
//
// A practice set is 1 credit a question, so the cost follows the set's own size (its link carries count=); a mock is 50, unless it
// is the subject's free first full mock (below).
// Today's included 10-question set is the one price the allowance changes (src/lib/dailySet.mjs): when the server quote said it is
// free the line says so and names no number; when the allowance has not been read it names no number and says Practice shows
// the price. A mock, and any other count, never read the allowance.
//
// The first full mock in each subject is free (C-dec 1, data/first_full_mock.js). `firstFull` is { subject, state }: the rule's
// state for one subject, as the server quote said it (src/lib/useFirstFullMock.js). A mock in that subject reads 'Free: your first
// full mock in this subject is on us.' while it is 'available', no number while it is 'unknown', and its price once 'used'. A mock
// in any other subject was not read, so it names no number either. Without `firstFull` (a caller that never reads it) a mock
// is priced as before.
import { TEST_MODES, practiceCreditCost } from '../../../data/test_modes.js';
import { FIRST_FULL_MOCK_COPY, FIRST_FULL_MOCK_STATE } from '../../../data/first_full_mock.js';
import { usesLine } from '../creditCopy.mjs';
import { DAILY_FREE_LINE, DAILY_SET, PRICE_AT_START_LINE, dailySetState, isDailySet } from '../dailySet.mjs';

export function priceLineOf(m, { premium = false, balance = null, dailySet = DAILY_SET.priced, firstFull = null } = {}) {
  if (m.id === 'revise') return 'Free. No credits.';
  if (premium || m.aiEach || ['resume', 'check', 'done', 'plan'].includes(m.id) || (m.id === 'returning' && m.open > 0)) return null;
  const mock = m.kind === 'mock' || m.id === 'firstMock';
  const asked = Number(/[?&]count=(\d+)/.exec(m.key?.href || m.href || '')?.[1]);
  const count = Number.isFinite(asked) && asked > 0 ? asked : m.number;
  const listed = mock ? null : practiceCreditCost('quick', count);
  const cost = mock ? practiceCreditCost('full', TEST_MODES.full.fixedCount) : listed ?? practiceCreditCost('quick', TEST_MODES.quick.defaultCount);
  if (!(cost > 0)) return null;
  if (mock && firstFull && typeof firstFull === 'object') {
    const state = m.subject && m.subject === firstFull.subject ? firstFull.state : FIRST_FULL_MOCK_STATE.unknown;
    if (state === FIRST_FULL_MOCK_STATE.available) return FIRST_FULL_MOCK_COPY.price;
    if (state !== FIRST_FULL_MOCK_STATE.used) return PRICE_AT_START_LINE;
  }
  // The count the server resolves to (a stray count becomes the default set) is the set the allowance covers.
  if (!mock && isDailySet('quick', listed === null ? TEST_MODES.quick.defaultCount : count)) {
    const daily = dailySetState(dailySet);
    if (daily === DAILY_SET.free) return DAILY_FREE_LINE;
    if (daily === DAILY_SET.unknown) return PRICE_AT_START_LINE;
  }
  return usesLine({ what: mock ? 'This mock' : 'This set', cost, pool: 'practice', balance });
}
