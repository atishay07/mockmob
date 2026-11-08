// The one plan, shared by /pricing and the home page's #pricing (R3-D8, owner LK109, 5 Nov 2026: "The separate pricing page that
// you have made is really good so something like that can be implemented on the normal page also. Just the one plan, everything
// in it."). Extracted unchanged from src/app/pricing/page.js: the plan's words, its one line of terms, and the Free and Pro rows.
// Pure: no React and no env reads; release switches come in as arguments, so node --test can run every branch.
import { priceTag } from '../../lib/payments/offer.js';

export { priceTag };

/** The plan's own words (the app's Pro page, flutter_app/lib/features/billing/billing_copy.dart). D185: the key says Get Pro. */
export const PLAN_COPY = Object.freeze({
  label: 'MockMob Pro',
  plan: 'One plan, everything in it',
  key: 'Get Pro',
  compare: 'Free and Pro, side by side',
});

/**
 * The line under /pricing's last heading, "Free or Pro" (R4, owner LK134). "Unlimited mocks" is Pro's promise only on the
 * current offer (Full mock and Quick practice unlimited on Pro); the new recovery offer promises unlimited available practice
 * and reattempts (homeCopy proPlan), so it says that instead. Fix stage of R4 pricing, after review.
 */
export function choiceLine({ newOffer = false } = {}) {
  return newOffer
    ? 'Start on Free, no card needed. Go Pro for unlimited practice and reattempts.'
    : 'Start on Free, no card needed. Go Pro for unlimited mocks.';
}

/** The plan card's one line of terms, the dock's note and, while only one-time access is on sale, the monthly line. */
export function planTerms(offer) {
  return offer.purchasable === 'monthly'
    ? { renew: 'Renews every month. Cancel any time.', dock: `₹${offer.monthly.rupees} a month. Cancel any time.`, soon: null }
    : {
      renew: `One payment, through ${offer.oneTime.expires}. It does not renew.`,
      dock: `₹${offer.oneTime.rupees} once, through ${offer.oneTime.expires}.`,
      soon: `Monthly Pro at ₹${offer.monthly.rupees} a month opens soon.`,
    };
}

/**
 * Free and Pro, side by side: the app's rows (BillingCopy.compareRows), in the website's own true terms. A true cell is a tick,
 * false a dash (not included), and text says the rest. With the new offer released, its recovery rows (data/capabilities.js
 * RECOVERY_PACKAGING_ROWS) are passed in and used instead.
 */
export function compareRows({ newOffer = false, firstFullMockOn = false, recoveryRows = [], keyCards = false } = {}) {
  if (newOffer) return recoveryRows;
  return [
    ['A new paper every time', true, true],
    ['Full mocks', firstFullMockOn ? 'First one free, then 50 credits each' : '50 credits each', 'Unlimited'],
    ['Quick practice', '1 credit a question', 'Unlimited'],
    ['Smart practice', false, true],
    ['Exam-day screen', false, true],
    ['Easy, Medium, Hard', false, true],
    // R8 PRICE-02: each mock's own review (time, changed answers, the chapter behind each miss) is open on Free; what Free
    // limits is the ranking across mocks (src/components/ai/RecordView.jsx FREE_CHAPTERS), so the row names that.
    ['Mistake Lab across your mocks', 'Top three chapters', 'Every chapter'],
    // Owner, 7 Nov 2026: the table showed only practice. One credits balance, 50 a month on both plans; Pro needs none for practice.
    ['Mistake Repair and Ask Mobi', '50 credits a month, shared with practice', '50 credits a month, all for Mobi'],
    ...(keyCards ? [['Key cards', 'A taste of each chapter', 'Every card']] : []),
  ];
}
