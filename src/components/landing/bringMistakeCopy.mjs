// The home page's "bring a mistake" block. Third build, 16 Nov 2026 night. The owner on the second, on his phone: the older
// words ("your coaching sheet, your school paper or a book") were easier to read, and the block should say "what exactly is
// needed and what value we are providing them over any other thing". So it says what to bring, and what comes back that a
// plain answer does not: the CUET chapter the question belongs to, the slip, two fresh checks, and ten more on that chapter
// from MockMob's own bank.
//
// One worked example, written by us and checked by bringMistakeCopy.test.mjs (every fraction and ratio is worked out there
// from the question's own numbers), walked through in the feature's own four steps: the question as the student brought it
// with the option they chose; the read Mobi gives in the app's own parts (src/services/mobi/bringMistake.mjs: the chapter
// from MockMob's CUET list, what this tests, why the answer is what it is, the likely slip); one of the fresh checks,
// answerable here; and the practice set the answer ends on (nextStep in the same file). The chapter's name is the one
// MockMob's own list has (src/services/mobi/mistakeChapters.mjs), pinned by the test.
// The counts are the app's: the practice set is the first-set count Practice runs (src/lib/firstSet.mjs), and the number
// of checks is the number the reply must carry (readAnswer in bringMistake.mjs, pinned by the test). What it costs and how a
// question gets in (typed, or a photo while Mobi reads photos) is said by bringMistakeWords from the app's own numbers.
import { FIRST_SET_COUNT } from '../../lib/firstSet.mjs';

/** The fresh checks every answer carries (bringMistake.mjs readAnswer takes exactly this many). */
export const MISTAKE_CHECKS = 2;
/** The practice set an answer ends on: "Practise 10 <chapter> questions" (bringMistake.mjs nextStep). */
export const PRACTICE_COUNT = FIRST_SET_COUNT;

const CHAPTER = 'Admission of Partner';

export const BRING_MISTAKE = Object.freeze({
  stamp: Object.freeze({ icon: 'mistakes', name: 'Ask Mobi' }),
  h2: 'Got one wrong in another test?',
  // What comes back, said once, as four short items: what a plain answer does not give.
  value: Object.freeze({
    label: 'What you leave with',
    items: Object.freeze([
      Object.freeze({ lead: 'CUET chapter', line: 'Where the question sits in your syllabus' }),
      Object.freeze({ lead: 'Your slip', line: 'Where your answer went wrong' }),
      Object.freeze({ figure: MISTAKE_CHECKS, lead: 'checks', line: 'New questions to check you have it' }),
      Object.freeze({ figure: PRACTICE_COUNT, lead: 'more', line: 'From MockMob’s bank, on that chapter' }),
    ]),
  }),
  steps: Object.freeze(['Question', 'Read', 'Check', 'Practise']),
  next: Object.freeze(['See Mobi’s read', 'Now check you have it', 'Then practise']),
  slip: Object.freeze({
    label: 'From a coaching test',
    subject: 'Accountancy',
    q: 'A and B share profits in the ratio 3 : 2. C is admitted for a 1/5 share. The new profit-sharing ratio is:',
    options: Object.freeze(['12 : 8 : 5', '3 : 2 : 1', '3 : 2 : 5', '9 : 6 : 5']),
    correct: 0,
    chosen: 1,
    chosenLabel: 'You chose',
    // What to bring. The question is required; the answer the student marked is optional in the app, and it is what the
    // slip is read from (bringMistake.mjs: "If the student gave chosenAnswer ..."), so the line asks for it without saying
    // Mobi cannot answer without it.
    needs: 'Bring the question, its options and the answer you marked.',
    photo: 'A photo of the page works too.',
  }),
  read: Object.freeze({
    title: 'Mobi’s read',
    chapterLabel: 'CUET chapter',
    chapter: CHAPTER,
    tests: Object.freeze(['What this tests', 'The new ratio when a new partner’s share comes out of both old partners.']),
    why: Object.freeze({
      label: 'Why it is 12 : 8 : 5',
      // [who, working, share of the whole]: lined up one a line, the shares on one edge.
      lines: Object.freeze([
        Object.freeze(['A', '3/5 of the 4/5 left', '12/25']),
        Object.freeze(['B', '2/5 of the 4/5 left', '8/25']),
        Object.freeze(['C', 'its own 1/5', '5/25']),
      ]),
    }),
    slip: Object.freeze(['The likely slip', '3 : 2 : 1 just puts C beside the old 3 : 2. C’s 1/5 has to come out of the whole first.']),
  }),
  check: Object.freeze({
    title: 'A fresh one, same idea',
    hint: 'Tap the answer you would mark.',
    after: `In the app Mobi sets you ${MISTAKE_CHECKS} of these.`,
    q: 'P and Q share profits 5 : 3. R is admitted for a 1/5 share. The new ratio is:',
    options: Object.freeze(['5 : 3 : 1', '5 : 3 : 2', '25 : 15 : 8', '4 : 3 : 1']),
    correct: 1,
    why: '4/5 is left. P gets 5/8 of it = 1/2, Q gets 3/10 and R has 1/5: that is 5 : 3 : 2.',
    right: 'Correct.',
    wrong: 'Not quite.',
  }),
  // The last link: the practice set the app's answer ends on, from the bank, on the chapter Mobi named.
  practice: Object.freeze({
    title: 'Then practise',
    count: PRACTICE_COUNT,
    what: `${CHAPTER} questions`,
    from: 'From MockMob’s own question bank',
    why: `The ${MISTAKE_CHECKS} checks are Mobi’s own. These ${PRACTICE_COUNT} come from the bank, on the chapter you slipped on.`,
  }),
  honest: 'This example is ours, and Mobi can be wrong.',
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
  const from = 'Bring it here: a question from your coaching sheet, your school paper or a book.';
  return {
    sub: photo ? `${from} Take a photo or type it in.` : `${from} Type or paste it in.`,
    price: photo
      ? `A typed question uses ${unit(credits)}, a photo ${unit(photoCredits)}. Free gives you ${free} credits a month.`
      : `One question uses ${unit(credits)}. Free gives you ${free} credits a month.`,
  };
}
