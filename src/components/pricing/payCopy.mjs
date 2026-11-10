// What happens when you get Pro: the three steps under /pricing's plan cards, their help line and the refund question
// (owner, 10 Nov 2026: "add the few things a student deciding to pay would want to see"). A 16-year-old and the parent who
// pays ask the same things before the key: what is paid today, when Pro turns on, whether it renews and how to stop it,
// whether the payment is safe, and who to write to.
// Every sentence restates something the site already does or publishes, and a test holds each one to its source
// (data/tests/pricing_pay_steps_1110.test.mjs):
//   - the first payment is taken at the start, the plan renews on the same date each month, and Pro stays to the end of the
//     paid month after a cancel: the page's own questions (src/app/pricing/page.js buildFaqs) and /refunds;
//   - Get Pro sends a signed-out student to sign in, Pro is active once the payment is verified, a monthly payment still being
//     confirmed turns Pro on within a few minutes, and "do not pay again": src/components/billing/RazorpayPaymentButton.jsx;
//   - where to cancel (Account, under Plan, Cancel renewal) and what is not refunded: src/app/refunds/page.js;
//   - what MockMob keeps of a payment (references, never the full card, UPI or bank credentials): src/app/privacy/page.js;
//   - "we reply within a day": src/app/contact/page.js and src/lib/helpFaq.mjs.
// Plain sentence case: no "!", no em dash. Pure: no React and no env reads; the offer and the sign-in state come in as
// arguments, so node --test can run every branch.
import { SUPPORT_EMAIL } from '../../lib/helpFaq.mjs';

/** A date that never breaks across two lines ("31 July 2027"). */
const unbroken = (text) => String(text).replace(/ /g, ' ');

export const PAY_COPY = Object.freeze({
  title: 'What happens when you get Pro',
  // The one thing that goes wrong with a payment, and what to do about it.
  help: ['Money left your account but Pro is not on? Do not pay again. Email', 'and we reply within a day.'],
  email: SUPPORT_EMAIL,
  mailto: `mailto:${SUPPORT_EMAIL}?subject=Payment%20help`,
});

/**
 * The three steps, in the order they happen: the payment, Pro turning on, and what comes after (the renewal and how to stop
 * it on the monthly plan; nothing at all on one-time access).
 */
export function paySteps(offer, { signedIn = false } = {}) {
  const monthly = offer.purchasable === 'monthly';
  const rupees = monthly ? offer.monthly.rupees : offer.oneTime.rupees;
  const signIn = signedIn ? '' : 'Get Pro asks you to sign in first. ';
  return [
    {
      key: 'pay',
      title: monthly ? `Pay ₹${rupees} today` : `Pay ₹${rupees} once`,
      line: `${signIn}You pay in Razorpay’s checkout. MockMob does not store your full card number, UPI PIN or bank password.`,
    },
    {
      key: 'on',
      title: 'Pro turns on',
      line: monthly
        ? 'On the account you are signed in to, as soon as the payment is verified. If it is still being confirmed, Pro turns on within a few minutes.'
        : 'On the account you are signed in to, as soon as the payment is verified.',
    },
    monthly
      ? {
        key: 'renew',
        title: 'Next month, it renews',
        line: `₹${rupees} on the same date each month, until you cancel. To cancel, open Account, then Plan, and tap Cancel renewal. You keep Pro to the end of the month you paid for.`,
      }
      : {
        key: 'ends',
        title: 'Nothing renews',
        line: `One payment covers Pro through ${unbroken(offer.oneTime.expires)}. After that your account moves to Free. Your history, saved questions and credits stay.`,
      },
  ];
}

/** The refund question, in the published policy's own terms (/refunds), for the page's questions and its FAQ data. */
export function refundFaq(offer) {
  const tail = `If a payment failed or was taken twice, email ${SUPPORT_EMAIL} with your account email, the payment date, the amount and the Razorpay payment ID. We check Razorpay’s records and help resolve it on Razorpay’s timeline.`;
  return {
    q: 'Can I get a refund?',
    a: offer.purchasable === 'monthly'
      ? `No. A payment that has gone through is not refunded, and that includes a month you have already been charged for. Free needs no card, so you can try MockMob before you pay. To avoid the next charge, cancel before the paid-through date shown in Account, under Plan. ${tail}`
      : `No. A payment that has gone through is not refunded. Free needs no card, so you can try MockMob before you pay. Pro is one payment with no renewal, so nothing more is charged. ${tail}`,
  };
}
