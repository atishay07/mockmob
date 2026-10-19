// Help: the questions and answers on the website, the same six as the app's Help (flutter_app
// lib/features/you/help/faq.dart), checked against what the website really does. Where the website works
// differently from the phone (the credits history, sign-in, offline answers) the answer says how it works here.
// Credit words come from creditCopy.mjs, the same source as the rest of the site. Plain sentence case:
// no "!", no em dash, no middle dot. Pure, so a test can hold every word.
import { PRACTICE_PRICE_LINE } from './creditCopy.mjs';

export const SUPPORT_EMAIL = 'support@mockmob.in';
export const HELP_HEADING = 'Common questions';
export const HELP_LEDE = 'Short answers to what students ask most. Not here? Write to us and a person replies.';

export const FAQ_ITEMS = Object.freeze([
  Object.freeze({
    id: 'credits',
    question: 'What are credits?',
    answer: Object.freeze([
      // One balance (D78), said as it works: the free 50 refill each IST calendar month and do not carry over
      // (aiWalletState.js walletWindow, included_credits_used resets); bought and earned credits stay until spent.
      'One balance pays for everything: practice sets, full mocks, Ask Mobi replies and repair explanations. Every account gets 50 free credits each month, and they are used first. They refill to 50 at the start of every month, so unused free credits do not carry over.',
      'Credits you buy or earn are used after the free ones, and they never expire. A credit pack is a one-time payment: it never renews and never charges you again.',
      PRACTICE_PRICE_LINE,
      'Mobi charges for finished jobs, never for talking. 1 credit fixes a mistake for good (why your option looked right, why the key is right, a rule to keep and 2 fresh questions), or settles a doubt (Mobi’s answer, one follow-up and 2 real CUET questions to test it). Everything Mobi reads from your record is free. The cost shows before you start. On Pro, practice needs no credits at all, so your credits go to Mobi.',
    ]),
  }),
  Object.freeze({
    id: 'history',
    question: 'How do I see what I have used?',
    answer: Object.freeze([
      'Open Account, then Credits. Every line says what it was for, how many credits it used, and how many are left.',
    ]),
  }),
  Object.freeze({
    id: 'nta',
    question: 'What is NTA mode?',
    answer: Object.freeze([
      'NTA mode sets a paper out like the real CUET screen. The question palette, Mark for Review and the timer look and behave as they do on exam day. It comes with Pro.',
      'Nothing else appears while the paper runs. Your result, review and repair come after you submit.',
    ]),
  }),
  Object.freeze({
    id: 'study-days',
    question: 'What counts as a study day?',
    answer: Object.freeze([
      'A day on which you finish a scored session of at least 5 answers (a practice or a mock), or a Mistake Repair. Your weekly goal is how many study days you aim for in a week. You set it in Account, under Weekly goal.',
      'MockMob counts only the days you finished something. Going away? Pause study days in the app and your run is kept. Account shows the pause.',
    ]),
  }),
  Object.freeze({
    id: 'sign-in',
    question: 'I cannot sign in. What can I do?',
    answer: Object.freeze([
      'Choose the email code. We send a code to your address, and it works even when Google does not. Not there? It can take a minute, so check Spam or Promotions too. You can also tap the button in that email.',
      'Google does not open inside the Instagram, Facebook or WhatsApp browser. Open MockMob in Chrome or Safari, or use the email code.',
      `Still stuck? Write to ${SUPPORT_EMAIL} from your account address.`,
    ]),
  }),
  Object.freeze({
    id: 'offline',
    question: 'What happens to my answers if I lose connection?',
    answer: Object.freeze([
      'They stay on this device and the timer keeps running. Reconnect before you submit. If you submit while offline, MockMob waits and sends it when you are back online, as long as the submission window is still open.',
    ]),
  }),
]);

export const FAQ_IDS = Object.freeze(FAQ_ITEMS.map((item) => item.id));

/** The id a ?q= or #hash names, or null when it is not one of the questions. */
export function faqIdFrom(value) {
  const id = String(value || '').replace(/^#/, '').trim().toLowerCase();
  return FAQ_IDS.includes(id) ? id : null;
}

export const SUPPORT_ROW = Object.freeze({
  label: 'Write to us',
  note: `${SUPPORT_EMAIL}. We reply within a day.`,
  href: `mailto:${SUPPORT_EMAIL}?subject=MockMob%20help`,
});
