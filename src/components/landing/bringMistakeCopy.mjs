// The home page's "bring a mistake" block (16 Nov 2026; owner: every feature presented with care, in MockMob's own identity,
// saying what it is exactly). One worked example, written by us and checked by bringMistakeCopy.test.mjs (the ratios are
// worked out there from the question's own numbers), walked through in the feature's own three steps: the question as the
// student brought it with the option they chose, the read Mobi gives in the app's own three parts
// (src/services/mobi/bringMistake.mjs: what this tests, why the answer is what it is, the likely slip), and one of the two
// fresh checks, answerable here. In the app Mobi writes these for the student's own question; the block says so.
// What it costs and how a question gets in (typed, or a photo while Mobi reads photos) is said by bringMistakeWords from the
// app's own numbers, never typed here.

export const BRING_MISTAKE = Object.freeze({
  stamp: Object.freeze({ icon: 'mistakes', name: 'Ask Mobi' }),
  h2: 'Got one wrong in another test?',
  steps: Object.freeze(['Your question', 'Mobi’s read', 'Check']),
  next: Object.freeze(['See Mobi’s read', 'Now check you have it']),
  slip: Object.freeze({
    label: 'From a coaching test',
    subject: 'Accountancy',
    q: 'A and B share profits in the ratio 3 : 2. C is admitted for a 1/5 share. The new profit-sharing ratio is:',
    options: Object.freeze(['12 : 8 : 5', '3 : 2 : 1', '3 : 2 : 5', '9 : 6 : 5']),
    correct: 0,
    chosen: 1,
    chosenLabel: 'You chose',
  }),
  read: Object.freeze({
    title: 'Mobi’s read',
    rows: Object.freeze([
      Object.freeze(['What this tests', 'Admission of a partner: the new ratio when the new partner’s share comes out of both old partners.']),
      Object.freeze(['Why it is 12 : 8 : 5', 'C takes 1/5, so 4/5 is left. A gets 3/5 of 4/5 = 12/25. B gets 2/5 of 4/5 = 8/25. C has 5/25.']),
      Object.freeze(['The likely slip', '3 : 2 : 1 keeps the old 3 : 2 and puts C beside it, without first taking C’s share out of the whole.']),
    ]),
  }),
  check: Object.freeze({
    title: 'A fresh one, same idea',
    hint: 'Tap the answer you would mark.',
    after: 'In the app: two checks like this one, then a practice set from MockMob’s own question bank.',
    q: 'P and Q share profits 5 : 3. R is admitted for a 1/5 share. The new ratio is:',
    options: Object.freeze(['5 : 3 : 1', '5 : 3 : 2', '25 : 15 : 8', '4 : 3 : 1']),
    correct: 1,
    why: '4/5 is left. P gets 5/8 of it = 1/2, Q gets 3/10 and R has 1/5: that is 5 : 3 : 2.',
    right: 'Correct.',
    wrong: 'Not quite.',
  }),
  honest: 'This example is ours. In the app Mobi writes the read and two checks for your own question, and Mobi can be wrong.',
  keyGuest: 'Sign up free and bring yours',
  keyStudent: 'Bring a mistake',
});

export const BRING_MISTAKE_PATH = '/mentor';

/**
 * The lines that depend on what the app does today. `photo`: Mobi reads a photo of the question (data/mistake_photo.mjs).
 * `credits` and `photoCredits`: what a typed and a photographed question cost; `free`: the credits Free gets each month.
 */
export function bringMistakeWords({ photo = false, credits = 1, photoCredits = 2, free = 50 } = {}) {
  const unit = (n) => `${n} ${n === 1 ? 'credit' : 'credits'}`;
  return {
    sub: photo
      ? 'Take a photo of the question, or type it in. Mobi shows what it was testing and where you slipped, then checks you have it.'
      : 'Type or paste the question in. Mobi shows what it was testing and where you slipped, then checks you have it.',
    price: photo
      ? `A typed question uses ${unit(credits)}, a photo ${unit(photoCredits)}. Free gives you ${free} credits a month.`
      : `One question uses ${unit(credits)}. Free gives you ${free} credits a month.`,
  };
}
