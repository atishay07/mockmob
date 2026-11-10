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
  // The refund position, said once and here (owner, 10 Nov 2026: never opened with a no, never 'no refunds under any
  // circumstance', never a promise): a payment is normally not refunded once it has gone through; a double charge or a payment
  // that went wrong is looked at with Razorpay's records, on Razorpay's timeline. Then the one thing to do: do not pay again.
  help: ['A payment is normally not refunded once it has gone through. If you were charged twice, or money left your account and Pro is not on, do not pay again. Email', 'and we check it against Razorpay’s records and help sort it out on Razorpay’s timeline. We reply within a day.'],
  refunds: Object.freeze({ label: 'Refund policy', href: '/refunds' }),
  // The fold under each step.
  more: 'More',
  email: SUPPORT_EMAIL,
  mailto: `mailto:${SUPPORT_EMAIL}?subject=Payment%20help`,
});

/**
 * The three steps, in the order they happen: the payment, Pro turning on, and what comes after (the renewal and how to stop
 * it on the monthly plan; nothing at all on one-time access).
 * Each step is drawn as a moment on a rail (owner, 10 Nov 2026: "it's just a wall of text ... replace it with some sort of a
 * graphic"): `mark` names its drawn mark, `title` is its label on the rail, `short` the one line under it, `more` the detail
 * folded behind it. `line` stays the whole statement (short and more are its sentences, and a test holds them to it).
 * The rail takes any number of steps, so a new first step is one more object in this array (with its own `mark`).
 */
export function paySteps(offer, { signedIn = false } = {}) {
  const monthly = offer.purchasable === 'monthly';
  const rupees = monthly ? offer.monthly.rupees : offer.oneTime.rupees;
  const signIn = signedIn ? '' : 'Get Pro asks you to sign in first. ';
  return [
    {
      key: 'pay',
      mark: 'pay',
      short: 'You pay in Razorpay’s checkout.',
      more: `${signIn}MockMob does not store your full card number, UPI PIN or bank password.`,
      title: monthly ? `Pay ₹${rupees} today` : `Pay ₹${rupees} once`,
      line: `${signIn}You pay in Razorpay’s checkout. MockMob does not store your full card number, UPI PIN or bank password.`,
    },
    {
      key: 'on',
      mark: 'on',
      short: 'As soon as the payment is verified.',
      more: monthly
        ? 'On the account you are signed in to. If it is still being confirmed, Pro turns on within a few minutes.'
        : 'On the account you are signed in to.',
      title: 'Pro turns on',
      line: monthly
        ? 'On the account you are signed in to, as soon as the payment is verified. If it is still being confirmed, Pro turns on within a few minutes.'
        : 'On the account you are signed in to, as soon as the payment is verified.',
    },
    monthly
      ? {
        key: 'renew',
        mark: 'renew',
        short: `₹${rupees} on the same date each month, until you cancel.`,
        more: 'To cancel, open Account, then Plan, and tap Cancel renewal. You keep Pro to the end of the month you paid for.',
        title: 'Next month, it renews',
        line: `₹${rupees} on the same date each month, until you cancel. To cancel, open Account, then Plan, and tap Cancel renewal. You keep Pro to the end of the month you paid for.`,
      }
      : {
        key: 'ends',
        mark: 'ends',
        short: `One payment covers Pro through ${unbroken(offer.oneTime.expires)}.`,
        more: 'After that your account moves to Free. Your history, saved questions and credits stay.',
        title: 'Nothing renews',
        line: `One payment covers Pro through ${unbroken(offer.oneTime.expires)}. After that your account moves to Free. Your history, saved questions and credits stay.`,
      },
  ];
}
