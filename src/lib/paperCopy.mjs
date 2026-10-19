// The headline difference (owner, 16 Oct 2026): one central question bank, and no fixed set of mocks to run out of.
// Said calmly, never as a banner, and only in words the code supports. The facts behind every line
// (docs/design-decisions/web-usp-mocks-1016.md has the file and line for each):
//   - A paper is assembled when it starts, from the subject's live bank: data/practice_pick.js (Quick, Full, Smart)
//     and data/nta_engine.js (NTA mode). There is no stored list of mocks per subject.
//   - Ordinary modes rank questions the student has not answered ahead of ones they have (data/mock_question_selector.js
//     rankCandidates), and leave out the questions of their last 3 (Quick) or 5 (Full, Smart) sessions in that subject
//     while enough others remain (data/practice_pick.js, data/test_modes.js recencyLimit).
//   - NTA mode builds unseen questions first, leaves out questions from earlier NTA papers while the CUET pattern can
//     still be met, and names any repeat on the paper itself (data/nta_engine.js, data/nta_pool.js).
//   - No cap on papers: starting one (src/lib/server/practiceSessions.js startPractice) counts nothing per day or per
//     subject. Pro spends nothing; Free spends credits per paper (data/test_modes.js creditCost).
//   - Never written: "never repeats", "unlimited" for Free, or any competitor. A small bank or a long run of papers can
//     bring back questions the student has answered, and NTA mode says so when it happens.
// Pure, no React, so a node test can hold the words. Sentence case; no "!", no em dash, no middle dot, no arrows.

import { usesLine, haveLine, PRACTICE_PRICE, PRACTICE_PRICE_LINE } from './creditCopy.mjs';
import { SUBJECT_CLAIM } from '../../data/subject_claim.js';
import { FIRST_FULL_MOCK_ON } from '../../data/first_full_mock.js';

const PUBLIC_ID = Object.freeze({ gat: 'general_test' });

/** The Practice link id for a stored attempt subject ("gat" is offered as "general_test"). */
export function practiceSubjectId(subject) {
  const id = String(subject || '');
  return PUBLIC_ID[id] || id;
}

/**
 * The bank count for a subject from /api/stats, or null when it is not known. Zero stays zero only when the counts
 * themselves are available; a failed or loading read is null, never 0.
 */
export function bankCount(stats, ...ids) {
  if (!stats || stats.state === 'unavailable' || stats.state === 'loading' || !stats.subjectCounts) return null;
  for (const id of ids) {
    if (id && Object.prototype.hasOwnProperty.call(stats.subjectCounts, id)) {
      const n = Number(stats.subjectCounts[id]);
      return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
    }
  }
  return 0;
}

const fmt = (n) => Number(n).toLocaleString('en-IN');

/** "the 1,404 Accountancy questions in the bank", or "the live question bank" when the count is not known. */
export function bankPhrase(count, subjectName) {
  if (Number.isInteger(count) && count > 0) {
    return `the ${fmt(count)} ${subjectName ? `${subjectName} ` : ''}question${count === 1 ? '' : 's'} in the bank`;
  }
  return 'the live question bank';
}

/**
 * The line under the modes on Practice. Every mode builds its paper fresh; the cap line differs by plan, because on
 * Free each paper costs credits (the price sits beside each mode).
 */
export function freshPaperLine({ count = null, subjectName = '', isPremium = false, mode = null } = {}) {
  // Smart practice and NTA mode are Pro only (data/test_modes.js premium: true), never paid for with credits,
  // so on Free their line says what they are part of rather than quoting a credit price they do not have.
  const proOnly = mode === 'nta' || mode === 'smart';
  const cap = isPremium ? 'There is no cap on how many you take.'
    : proOnly ? `${mode === 'nta' ? 'NTA mode' : 'Smart practice'} is part of Pro, which has no cap on how many you take.`
      : 'There is no cap on how many you take, only the credits each one uses.';
  // NTA mode draws only on questions with a checked quality score of 8 or more out of 10 (data/nta_engine.js
  // NTA_MIN_SCORE), a subset the public counts do not give, so its line never presents the whole bank as its pool.
  if (mode === 'nta') return `Each NTA paper is built fresh from the ${subjectName ? `${subjectName} ` : ''}questions that meet NTA mode’s quality bar${Number.isInteger(count) && count > 0 ? ` (the full bank holds ${fmt(count)})` : ''}, questions you have not answered first. ${cap}`;
  return `Every paper is built fresh from ${bankPhrase(count, subjectName)}, questions you have not answered first. ${cap}`;
}

/** Short mode specs on Practice. Full mock and NTA mode carry the fresh-paper fact; the others stay as they were. */
export const MODE_SPECS = Object.freeze({
  quick: '5 to 20 questions, 1 minute each',
  full: '50 questions, 60 minutes, a new paper every time',
  // Smart practice weights topics (data/practice_pick.js weakAccuracyThreshold on topics), not chapters.
  smart: 'Leans on the topics you miss most',
  nta: 'The closest thing to exam day: 50 questions in 60 minutes on an exam-style screen, with the question palette, mark for review, clear response, and a countdown that submits for you. Each paper leaves out your earlier NTA questions while the bank allows.',
});

/** The one-line specs on Practice's mode tiles (START-1017 4.2). NTA mode's long sentence above moves into the NTA panel
 * that opens under the tiles when NTA mode is chosen; it is not dropped. */
export const MODE_TILE_SPECS = Object.freeze({
  quick: MODE_SPECS.quick,
  full: MODE_SPECS.full,
  smart: MODE_SPECS.smart,
  nta: '50 questions, 60 minutes on the exam screen',
});

const MODE_NAMES = Object.freeze({ quick: 'Quick practice', full: 'Full mock', smart: 'Smart practice', nta: 'NTA mode' });
const MODE_COST = Object.freeze({ quick: PRACTICE_PRICE.set, full: PRACTICE_PRICE.full });   // quick: the 10-question set; Quick practice is 1 credit a question

/**
 * The result page's next step: take another paper in the same subject and mode, built fresh. Returns the heading,
 * the lines and the Practice link; the price line follows the plan and never guesses a credit cost it cannot know.
 */
export function nextPaper({ mode, subject, subjectName = '', count = null, total = null, isPremium = false, balance = null } = {}) {
  const modeId = Object.prototype.hasOwnProperty.call(MODE_NAMES, mode) ? mode : null;
  const params = new URLSearchParams();
  if (subject) params.set('subject', practiceSubjectId(subject));
  if (modeId) params.set('mode', modeId);
  if (modeId === 'quick' && [5, 10, 15, 20].includes(Number(total))) params.set('count', String(total));
  const href = `/dashboard${params.size ? `?${params}` : ''}`;
  const name = modeId ? MODE_NAMES[modeId] : 'paper';
  const where = subjectName ? ` in ${subjectName}` : '';
  const fresh = modeId === 'nta'
    ? `Your next NTA paper${where} is built new from the questions that meet NTA mode’s quality bar: questions from this paper and your earlier NTA papers stay out while the bank allows, and any repeat is named on the paper.`
    : `Your next ${modeId ? name : 'paper'}${where} is built new from ${bankPhrase(count, '')}, questions you have not answered first.`;
  let price;
  if (isPremium) price = 'There is no cap on how many papers you take, and Pro covers every one.';
  else if (modeId === 'nta' || modeId === 'smart') price = `There is no cap on how many papers you take. ${name} needs Pro.`;
  else if (modeId === 'full') price = `There is no cap on how many papers you take. ${usesLine({ what: 'A Full mock', cost: MODE_COST.full, pool: 'practice', balance })}`;
  else price = ['There is no cap on how many papers you take. Practice shows the price before it starts.', haveLine(balance) && `You have ${creditCountShort(balance)}.`].filter(Boolean).join(' ');
  return { title: 'Take another fresh paper', fresh, price, href, action: modeId ? `Set up another ${modeId === 'nta' ? 'NTA paper' : name}` : 'Set up another paper' };
}

function creditCountShort(balance) {
  const n = Math.max(0, Math.trunc(Number(balance)));
  return `${fmt(n)} credit${n === 1 ? '' : 's'}`;
}

/** Pricing: the one calm sentence under the plans' lead. The bank size is the stored daily count, or left out. */
export function pricingBankLine(bankSize) {
  const bank = Number.isInteger(bankSize) && bankSize > 0 ? `a live bank of ${fmt(bankSize)} questions` : 'the live question bank';
  return `There is no fixed set of mocks: each paper is built when you start it, from ${bank}, questions you have not answered first. Pro covers as many as you take. On Free, each paper uses credits${FIRST_FULL_MOCK_ON ? ', except your first full mock in each subject, which is free' : ''}.`;
}

/** Pricing: what the bank covers. Only the subjects Practice offers are counted, never the thin or dropped ones. */
export function pricingSubjectLine() {
  return `${SUBJECT_CLAIM.withSource}.`;
}

/** Pricing FAQ: the question students ask about other sites' mock counts, answered with the code's rules. */
export function pricingBankFaq(bankSize) {
  const bank = Number.isInteger(bankSize) && bankSize > 0 ? ` (${fmt(bankSize)} questions in the subjects Practice offers, at the last daily count)` : '';
  return {
    q: 'How many mocks do I get per subject?',
    a: `As many as you take. MockMob keeps one checked question bank${bank}, and each paper is built from it when you start, with questions you have not answered first. With Pro there is no cap. On Free, each paper uses credits. ${PRACTICE_PRICE_LINE} A subject with a small bank can bring back questions you have answered before; NTA mode names any repeat on the paper.`,
  };
}

/** Onboarding: the subjects step's lead, and the count on each subject tile. "No cap" is Pro's; Free pays credits
 *  for each mock, said in the same breath (release 9 audit: the lead was shown to Free students without it). Since 19 Oct the
 *  first full mock in each subject is free (C-dec 1), the best news a new student can read here, so it leads. */
export const ONBOARDING_LEAD = FIRST_FULL_MOCK_ON
  ? 'Pick up to 5. Every mock is built fresh from one live question bank, and your first full mock in each subject is free. After that, each one uses credits on Free; on Pro there is no cap. Swap subjects any time.'
  : 'Pick up to 5. Every mock is built fresh from one live question bank. Each one uses credits on Free; on Pro there is no cap. Swap subjects any time.';

/** Onboarding: each step's headline and lead (M-006, 18 Oct: bolder and punchier, still true, no exclamation marks). */
export const ONBOARDING_STEPS = Object.freeze({
  subjects: Object.freeze({ title: 'Your papers. Your mocks.', lead: ONBOARDING_LEAD }),
  edit: Object.freeze({ title: 'Your papers, your call.', lead: 'Up to 5. Practice and every mock run on these.' }),
  days: Object.freeze({ title: 'How many days a week can you give?', lead: 'Today keeps your week in view: seven days, a mark on every study day. Skip and we start you on 4.' }),
  colleges: Object.freeze({ title: 'Which colleges are you chasing?', lead: 'Pick a course, then up to 8 colleges. Today puts your first one up front with its 2026 cutoff. Change them any time on Account.' }),
});
export function tileCount(count) {
  return Number.isInteger(count) && count > 0 ? `${fmt(count)} question${count === 1 ? '' : 's'}` : null;
}
