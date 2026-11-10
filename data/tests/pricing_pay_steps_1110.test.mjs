// /pricing, the payer's pass (owner, 10 Nov 2026): "/pricing is about a 9 out of 10. Find what would make it a 10: refine the
// weak spots and add the few things a student deciding to pay would want to see."
// What was added: "What happens when you get Pro", three numbered steps right under the two plan cards (what is paid today,
// when Pro turns on, the renewal and how to stop it), the line that says who to write to when a payment goes wrong, and the
// refund question among the page's questions. Words: src/components/pricing/payCopy.mjs.
// What was refined: the hero's column can no longer grow past the gutters on 360 and 390 px phones, the price line under the
// hero key is on the first screen of a 360 x 640 phone, and a link inside a sentence is 44 px tall to the finger.
// These tests hold every sentence of the new block to the place the site already says or does it, pin where the block sits and
// who sees it, and keep it a list on hairlines (never a row of cards, never volt). Source-level and pure: no server is needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PAY_COPY, paySteps, refundFaq } from '../../src/components/pricing/payCopy.mjs';
import { SUPPORT_EMAIL } from '../../src/lib/helpFaq.mjs';

const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const PAGE = 'src/app/pricing/page.js';
const SHEET = 'src/app/pricing/pro-page.css';
const NBSP = String.fromCharCode(160);

const monthly = (r = 99) => ({ purchasable: 'monthly', monthly: { rupees: r }, oneTime: { rupees: 99, expires: '31 July 2027' } });
const oneTime = (r = 99, expires = '31 July 2027') => ({ purchasable: 'one_time', monthly: { rupees: 99 }, oneTime: { rupees: r, expires } });
const said = (offer, opts) => paySteps(offer, opts).flatMap((s) => [s.title, s.line]);

// ------------------------------------------------------------------------------------------------ the three steps
test('pay steps: what is paid today, when Pro turns on and what comes next, for the offer on sale', () => {
  const m = paySteps(monthly());
  assert.deepEqual(m.map((s) => s.key), ['pay', 'on', 'renew']);
  assert.deepEqual(m.map((s) => s.title), ['Pay ₹99 today', 'Pro turns on', 'Next month, it renews']);
  assert.equal(m[0].line, 'Get Pro asks you to sign in first. You pay in Razorpay’s checkout. MockMob does not store your full card number, UPI PIN or bank password.');
  assert.equal(m[1].line, 'On the account you are signed in to, as soon as the payment is verified. If it is still being confirmed, Pro turns on within a few minutes.');
  assert.equal(m[2].line, '₹99 on the same date each month, until you cancel. To cancel, open Account, then Plan, and tap Cancel renewal. You keep Pro to the end of the month you paid for.');

  const o = paySteps(oneTime());
  assert.deepEqual(o.map((s) => s.key), ['pay', 'on', 'ends']);
  assert.deepEqual(o.map((s) => s.title), ['Pay ₹99 once', 'Pro turns on', 'Nothing renews']);
  assert.equal(o[1].line, 'On the account you are signed in to, as soon as the payment is verified.');
  assert.equal(o[2].line, `One payment covers Pro through 31${NBSP}July${NBSP}2027. After that your account moves to Free. Your history, saved questions and credits stay.`);
});

test('pay steps: a signed-in student is not told to sign in, and the price follows the offer', () => {
  assert.match(paySteps(monthly())[0].line, /^Get Pro asks you to sign in first\. /);
  assert.match(paySteps(monthly(), { signedIn: false })[0].line, /^Get Pro asks you to sign in first\. /);
  assert.equal(paySteps(monthly(), { signedIn: true })[0].line, 'You pay in Razorpay’s checkout. MockMob does not store your full card number, UPI PIN or bank password.');
  assert.doesNotMatch(said(oneTime(), { signedIn: true }).join(' '), /sign in first/);

  assert.equal(paySteps(monthly(149))[0].title, 'Pay ₹149 today');
  assert.match(paySteps(monthly(149))[2].line, /^₹149 on the same date each month, until you cancel\./);
  assert.equal(paySteps(oneTime(199, '31 March 2028'))[0].title, 'Pay ₹199 once');
  assert.ok(paySteps(oneTime(199, '31 March 2028'))[2].line.includes(`through 31${NBSP}March${NBSP}2028.`), 'the date never splits');
});

test('pay steps: the owner’s money and copy rules hold on both offers', () => {
  for (const [offer, price] of [[monthly(), '₹99'], [monthly(149), '₹149'], [oneTime(), '₹99'], [oneTime(199), '₹199']]) {
    for (const signedIn of [false, true]) {
      const text = said(offer, { signedIn });
      const all = text.join(' ');
      // LK168: the price is the plan's price, never multiplied by months; no other rupee figure is typed.
      for (const figure of all.match(/₹[\d,]+/g) || []) assert.equal(figure, price, all);
      // A monthly and a one-time price never share a sentence.
      if (offer.purchasable === 'monthly') assert.doesNotMatch(all, /\bonce\b|Nothing renews/, all);
      else assert.doesNotMatch(all, /a month|each month|Next month|cancel/i, all);
      // Plain sentence case: no "!", no em dash, no middle dot, no countdown, nobody else named.
      for (const line of text) {
        assert.doesNotMatch(line, /[!—·]/, line);
        assert.doesNotMatch(line, /hurry|only today|last chance|limited time|offer ends/i, line);
      }
      for (const step of paySteps(offer, { signedIn })) {
        assert.match(step.title, /^[A-Z][^.]*$/, `${step.title}: a title, no full stop`);
        assert.match(step.line, /\.$/, step.line);
      }
    }
  }
  assert.equal(PAY_COPY.title, 'What happens when you get Pro');
  assert.deepEqual([...PAY_COPY.help], ['Money left your account but Pro is not on? Do not pay again. Email', 'and we reply within a day.']);
  assert.doesNotMatch(`${PAY_COPY.title} ${PAY_COPY.help.join(' ')}`, /[!—·₹]/);
  assert.equal(PAY_COPY.email, SUPPORT_EMAIL);
  assert.equal(PAY_COPY.mailto, `mailto:${SUPPORT_EMAIL}?subject=Payment%20help`);
});

// ------------------------------------------------------------------------------------------------ every sentence has a source
test('pay steps: each sentence restates what the site already does or publishes', () => {
  const pay = read('src/components/billing/RazorpayPaymentButton.jsx');
  // Get Pro sends a signed-out student to sign in; Pro is active once the payment is verified; a monthly payment that is still
  // being confirmed turns Pro on within a few minutes; money left the account: do not pay again.
  assert.ok(pay.includes("window.location.href = loginPathFor('/pricing#plans');"), 'signed out: Get Pro goes to sign in, and sign-in comes back to the plan');
  assert.ok(pay.includes('Payment verified. Pro is active'), 'Pro is active once the payment is verified');
  assert.ok(pay.includes('Your payment is being confirmed. Pro turns on within a few minutes.'), 'still being confirmed');
  assert.ok(pay.includes('If money left your account, do not pay again.'), 'do not pay again');

  // The renewal, where to cancel and what stays: /refunds, the Account plan card and the page's own questions.
  const refunds = read('src/app/refunds/page.js');
  assert.ok(refunds.includes('You can cancel at any time in Account, under Plan, with Cancel renewal.'));
  assert.ok(refunds.includes('You keep Pro until the end of the month you already paid for, then your account moves to Free.'));
  assert.ok(read('src/components/billing/PlanCard.jsx').includes("'Cancel renewal'"), 'the key in Account is called Cancel renewal');
  const page = read(PAGE);
  assert.ok(page.includes('The first payment is taken when you start, and it renews on the same date each month until you cancel.'));
  assert.ok(page.includes('then your account moves to Free. Your history, saved questions and credits stay.'), 'what stays after Pro ends');

  // What MockMob keeps of a payment. The payments table keeps Razorpay's record of a payment, so the step names only what is
  // never stored (the full card number, the UPI PIN, the bank password) and never says "no payment details".
  assert.ok(read('src/app/privacy/page.js').includes('but not your full card, UPI or bank credentials'));
  assert.doesNotMatch(said(monthly()).join(' '), /no payment details|never see|do not keep any/i);

  // Who to write to, and how fast the reply is.
  assert.equal(SUPPORT_EMAIL, 'support@mockmob.in');
  assert.ok(read('src/app/contact/page.js').includes('We reply within a day.'));
  assert.ok(read('src/lib/helpFaq.mjs').includes('We reply within a day.'));
});

// ------------------------------------------------------------------------------------------------ the refund question
test('refund question: the published policy in plain words, for the offer on sale', () => {
  const m = refundFaq(monthly());
  const o = refundFaq(oneTime());
  for (const faq of [m, o]) {
    assert.equal(faq.q, 'Can I get a refund?');
    assert.equal(typeof faq.a, 'string', 'a plain string: the page feeds it to its FAQ data');
    assert.match(faq.a, /^No\. A payment that has gone through is not refunded/);
    assert.ok(faq.a.includes('Free needs no card, so you can try MockMob before you pay.'));
    assert.ok(faq.a.includes(`email ${SUPPORT_EMAIL} with your account email, the payment date, the amount and the Razorpay payment ID.`));
    assert.ok(faq.a.endsWith('We check Razorpay’s records and help resolve it on Razorpay’s timeline.'));
    assert.doesNotMatch(faq.a, /[!—·₹]/, 'no price is typed in the answer');
    assert.doesNotMatch(faq.a, /money back|guarantee|within \d+ days/i, 'nothing the policy does not promise');
  }
  assert.ok(m.a.includes('and that includes a month you have already been charged for.'));
  assert.ok(m.a.includes('To avoid the next charge, cancel before the paid-through date shown in Account, under Plan.'));
  assert.ok(o.a.includes('Pro is one payment with no renewal, so nothing more is charged.'));
  assert.doesNotMatch(o.a, /a month|next charge|cancel/i);

  // Its sources: /refunds (no refunds for completed payments, the paid-through date, Razorpay's records and timeline, what to
  // send), /contact (the Razorpay payment ID) and the Free plan's own line on this page (no card).
  const refunds = read('src/app/refunds/page.js');
  assert.ok(refunds.includes('MockMob does not allow refunds for completed payments, monthly Pro renewals, one-time Pro access'));
  assert.ok(refunds.includes('A month that has been charged is not refunded when you cancel. To avoid the next charge, cancel before the paid-through date shown in Account, under Plan.'));
  assert.ok(refunds.includes('We will check Razorpay records and help resolve payment-provider errors according to their timeline.'));
  assert.ok(refunds.includes('include your registered email, payment date, amount, and transaction reference'));
  assert.ok(read('src/app/contact/page.js').includes('Include your Razorpay payment ID if you have it.'));
  assert.ok(read(PAGE).includes('Enough to see whether MockMob suits you. No card needed.'));
});

// ------------------------------------------------------------------------------------------------ where it sits, who sees it
test('/pricing: the steps sit right under the two plans, before the value section, and a Pro student does not see them', () => {
  const page = stripComments(read(PAGE));
  assert.ok(page.includes("import { PAY_COPY, paySteps, refundFaq } from '@/components/pricing/payCopy.mjs';"));
  // The page's order is unchanged (LK173: Also in Pro, Free or Pro, the detailed value, the comparison table); the new block
  // is one more section between the plans and the value section.
  const order = ['className="pro-hero"', 'id="pro-also-h"', 'id="pro-choice-h"', '<PlanChoice ', 'id="plan-free"', 'className="pro-sec pro-pay"', '<PricingValue', 'id="compare"', 'Questions people actually ask.'];
  const at = order.map((mark) => page.indexOf(mark));
  for (const [i, mark] of order.entries()) assert.ok(at[i] > -1, `${mark} is on the page`);
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'the order of the page');
  assert.match(page, /\{isCurrentUserPremium \? null : \(\s*<section className="pro-sec pro-pay" aria-labelledby="pro-pay-h">/);
  // A section of its own: it does not ask the phone bar to step aside, so Get Pro is one tap away while the steps are read.
  assert.match(page, /<section className="pro-sec pro-choice" aria-labelledby="pro-choice-h" data-dock-yield="">/);
  assert.doesNotMatch(page, /pro-pay"[^>]*data-dock-yield/);
  // Every word comes from payCopy.mjs, for the offer on sale and the student's sign-in state; the steps are an ordered list.
  assert.ok(page.includes('<h2 className="pro-pay__title" id="pro-pay-h">{PAY_COPY.title}</h2>'));
  assert.ok(page.includes('<ol className="pro-pay__steps">'));
  assert.ok(page.includes('paySteps(offer, { signedIn: Boolean(session?.user?.id) })'));
  assert.ok(page.includes('<h3>{step.title}</h3>') && page.includes('<p>{step.line}</p>'));
  assert.ok(page.includes('<a className="mm-link mm-link--inline" href={PAY_COPY.mailto}>{PAY_COPY.email}</a>'));
  // No second way to pay: the page still has its one pay key.
  assert.equal(page.split('<RazorpayPaymentButton').length - 1, 1);
});

test('/pricing: the refund question follows the cancel question, and its answer reaches the FAQ data as a string', () => {
  const page = stripComments(read(PAGE));
  const cancel = page.indexOf("q: 'What happens when I cancel?'");
  const refund = page.indexOf('refundFaq(offer),');
  const bank = page.indexOf('pricingBankFaq(bankSize),');
  assert.ok(cancel > -1 && refund > cancel && bank > refund, 'cancel, then refund, then the bank');
  assert.equal(page.split('refundFaq(').length - 1, 1, 'asked once');
});

// ------------------------------------------------------------------------------------------------ how it is drawn
test('/pricing: the steps are a list on hairlines in the page’s tokens, never a row of cards, and inline links are 44 px tall', () => {
  const css = read(SHEET);
  const rules = stripComments(css).split('\n').filter((line) => line.includes('.pro-pay'));
  assert.ok(rules.length >= 12, 'the block has its rules');
  const block = [];
  const lines = stripComments(css).split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes('.pro-pay')) continue;
    let rule = lines[i];
    while (!rule.includes('}') && i + 1 < lines.length) { i += 1; rule += ` ${lines[i].trim()}`; }
    block.push(rule);
  }
  for (const rule of block) {
    assert.doesNotMatch(rule, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, `tokens only: ${rule}`);
    assert.doesNotMatch(rule, /background|box-shadow|border-radius|var\(--volt\)|var\(--accent-text/, `a list, not a card, and no volt: ${rule}`);
    assert.doesNotMatch(rule, /transition|animation/, `nothing moves: ${rule}`);
  }
  assert.ok(css.includes('.mm-pro .pro-pay__step + .pro-pay__step { border-top: 1px solid var(--line); }'), 'one hairline between steps');
  assert.match(css, /\.mm-pro \.pro-pay__n \{[^}]*font-weight: 800;[^}]*color: var\(--ink-3\);/, 'a heavy, quiet numeral');
  assert.match(css, /\.mm-pro \.pro-pay__step h3 \{[^}]*color: var\(--ink\);/);
  assert.match(css, /\.mm-pro \.pro-pay__step p \{[^}]*font-size: 0\.9375rem;[^}]*color: var\(--ink-2\);/, '15 px body text');
  // Phones: the number beside the words. Desktop: three columns under the two cards, and the spacing the cards had to the value
  // section is kept (pricing-value.css sets it on .pro-choice + .pro-val, which no longer matches).
  assert.ok(css.includes('.mm-pro .pro-pay__step { display: grid; grid-template-columns: 1.75rem minmax(0, 1fr);'));
  const wide = css.slice(css.indexOf('@media (min-width: 960px)'));
  assert.match(wide, /\.mm-pro \.pro-pay__steps \{\s*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.ok(wide.includes('.mm-pro .pro-choice:has(+ .pro-pay) { padding-bottom: 2.5rem; }'));
  assert.ok(wide.includes('.mm-pro .pro-pay + .pro-val { padding-top: 2.5rem; }'));
  assert.ok(read('src/components/pricing/pricing-value.css').includes('.mm-pro .pro-choice + .pro-val { padding-top: 2.5rem; }'), 'the rule this one stands in for');
  // A link inside a sentence ("Email us", the support address): 14 px of padding above and below a line of at least 16 px.
  assert.ok(css.includes('.mm.mm-pro .mm-link.mm-link--inline { padding-block: 14px; }'));
});

test('/pricing: the hero fits a small phone (one column inside the gutters, the price on the first screen at 360 x 640)', () => {
  const css = read(SHEET);
  assert.ok(css.includes('.mm-pro .pro-hero__grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.75rem; justify-items: center; }'), 'the column cannot grow past the gutters');
  assert.match(css, /@supports \(height: 100svh\) \{\s*@media \(max-width: 959px\) \{\s*\.mm-pro \.pro-art \{ --pro-u: clamp\(0\.7px, calc\(\(100svh - 404px\) \/ 282\), 1px\); \}/, 'the art gives way on a short screen');
});
