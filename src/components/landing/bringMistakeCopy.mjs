// The home page's "bring a mistake" block (16 Nov 2026; owner: every feature presented with care, in MockMob's own identity,
// saying what it is exactly). One worked example, written by us and checked by bringMistakeCopy.test.mjs (the ratios are
// worked out there from the question's own numbers): a question pasted from another test with the option the student chose,
// the read Mobi gives in the app's own three parts (src/services/mobi/bringMistake.mjs: what this tests, why the answer is
// what it is, the likely slip), and one of the two fresh checks, answerable here. In the app Mobi writes these for the
// student's own question; the block says so.

export const BRING_MISTAKE = Object.freeze({
  stamp: Object.freeze({ icon: 'mistakes', name: 'Ask Mobi' }),
  h2: 'Got one wrong in another test?',
  sub: 'Paste the question from your coaching sheet, your school paper or a book. Mobi shows what it was testing, where you slipped, and checks you have it.',
  slip: Object.freeze({
    label: 'Pasted from a coaching test',
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
    title: 'Now check you have it',
    q: 'P and Q share profits 5 : 3. R is admitted for a 1/5 share. The new ratio is:',
    options: Object.freeze(['5 : 3 : 1', '5 : 3 : 2', '25 : 15 : 8', '4 : 3 : 1']),
    correct: 1,
    why: '4/5 is left. P gets 5/8 of it = 1/2, Q gets 3/10 and R has 1/5: that is 5 : 3 : 2.',
    right: 'Correct.',
    wrong: 'Not quite.',
  }),
  honest: 'This example is ours. In the app Mobi writes the read and two checks for your own question, and Mobi can be wrong.',
  chips: Object.freeze(['1 credit a question', 'Free gives you 50 credits a month', 'Typed or pasted text']),
  keyGuest: 'Sign up free and paste yours',
  keyStudent: 'Paste a mistake',
});

export const BRING_MISTAKE_PATH = '/mentor';
