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
export function compareRows({ newOffer = false, firstFullMockOn = false, recoveryRows = [] } = {}) {
  if (newOffer) return recoveryRows;
  return [
    ['A new paper every time', true, true],
    ['Full mocks', firstFullMockOn ? 'First one free, then 50 credits each' : '50 credits each', 'Unlimited'],
    ['Quick practice', '1 credit a question', 'Unlimited'],
    ['Smart practice', false, true],
    ['Exam-day screen', false, true],
    ['Easy, Medium, Hard', false, true],
    ['Insights in detail', 'Top three chapters', true],
  ];
}
