// What a visitor can actually buy today. Pure (reads plan env only), so pages and the practice
// quote use one source and never advertise checkout that cannot open.
import { CURRENT_OFFER } from '../../../data/capabilities.js';
import { isMonthlyBillingReady } from './plans.js';
import { parentPayOffered } from './parentPay.js';

export function publicOffer() {
  const monthlyReady = isMonthlyBillingReady();
  const offer = {
    monthly: Object.freeze({ planId: 'pro_monthly_99', rupees: 99, interval: 'month', autoRenews: true, ready: monthlyReady }),
    // The earlier one-time access stays on sale only until monthly billing opens.
    oneTime: Object.freeze({ planId: CURRENT_OFFER.planId, rupees: CURRENT_OFFER.rupees, expires: CURRENT_OFFER.expires, onSale: !monthlyReady }),
    purchasable: monthlyReady ? 'monthly' : 'one_time',
  };
  // "Ask a parent to pay" (lane F-B): a signed-in student may send a parent Razorpay's hosted link for monthly Pro, while it is
  // on sale and PARENT_PAY_ENABLED is on (src/lib/payments/parentPay.js). The signed-in shell's Pro sheet reads it from here.
  return Object.freeze({ ...offer, parentPay: parentPayOffered(offer) });
}

/** Short, accurate price line for badges and trust rows. */
export function priceLine(offer = publicOffer()) {
  return offer.purchasable === 'monthly'
    ? `Pro ₹${offer.monthly.rupees} a month`
    : `Pro ₹${offer.oneTime.rupees} once, through ${offer.oneTime.expires}`;
}

/** The /pricing headline: what a buyer is charged today, framed the same way as priceLine (release 9: one framing). */
export function priceHeadline(offer = publicOffer()) {
  return offer.purchasable === 'monthly'
    ? `Pro is ₹${offer.monthly.rupees} a month.`
    : `Pro is ₹${offer.oneTime.rupees} once, through ${offer.oneTime.expires}.`;
}

/** The Pro card's price tag: the rupees charged today and how often. */
export function priceTag(offer = publicOffer()) {
  return offer.purchasable === 'monthly'
    ? { price: `₹${offer.monthly.rupees}`, cycle: 'a month' }
    : { price: `₹${offer.oneTime.rupees}`, cycle: 'once' };
}
