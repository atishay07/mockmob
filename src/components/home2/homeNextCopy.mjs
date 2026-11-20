// The words of /home-next, the clarity-first home (spec: mockmob-brain/docs/HOME-NEXT-SPEC-2026-11-20.md with its Revision 2,
// which wins over the text above it; owner LK360, LK361).
// Pure: no React, no browser, no clock, so data/tests/home_next_1120.test.mjs holds every rule:
//   * a section heading is at most seven words a 16-year-old new to CUET apps understands, with at most one sentence under it;
//   * sentence case, no em dashes, no exclamation marks;
//   * every figure comes from the product's own code and data, never typed here: labStory.mjs for the example mock,
//     homeCopy EXAM for the exam screen, bringMistakeCopy for a brought mistake, subject_claim.js for the subjects, the stored
//     inventory for the bank (coverageModel.mjs), data/test_modes.js and the wallet's constant for what Free holds;
//   * nothing the code cannot source: no past-paper percentage, no "first full mock free" (unverified on production), no
//     "Students" heading (no consented student quote exists).

import { labStory, signed } from '../landing/labStory.mjs';
import { COMPASS_HEAD, INSTAGRAM_HEAD, TRY_HEAD, EXAM, EXAM_HEAD, freePlan } from '../landing/homeCopy.mjs';
import { BRING_MISTAKE, bringMistakeWords } from '../landing/bringMistakeCopy.mjs';
import { SUBJECT_CLAIM, PUBLIC_SUBJECT_COUNT, PAPER_SHARE } from '../../../data/subject_claim.js';
import { FIRST_SET_COUNT } from '../../lib/firstSet.mjs';

export const HEADING_MAX_WORDS = 7;
export const words = (text) => String(text).trim().split(/\s+/).filter(Boolean).length;
/** Sentences in a line: each ends in . or ? (no "!", ever). A figure's decimal point is not an end. */
export const sentences = (text) => (String(text).replace(/(\d)\.(\d)/g, '$1,$2').match(/[^.?]+[.?]/g) || []).length;

const S = labStory();
const top = S.chapters[0];
const plan = S.swot.plan[0];
const planCount = Number((plan.label.match(/\d+/) || [])[0]) || null;
const lc = (text) => text.charAt(0).toLowerCase() + text.slice(1);

// ------------------------------------------------------------------ 3. the one product frame, four parts
// Each row holds for its own demo, 6 to 8 seconds (Revision 2, LK192: longer, less jumpy). `ms` is that row's hold.
export const PREP_HEAD = Object.freeze({ h2: 'Your whole CUET prep, in one place.', mark: 'one place.' });

// `verb` is the phone chip, `title` the desktop row's three or four words, `line` its one line, `path` the address in the
// frame's title bar (where that screen lives in the app). "Unlimited" is said of Pro only (homeCopy proPlan, the FAQ).
export const PARTS = Object.freeze([
  Object.freeze({ id: 'practise', icon: 'questions', verb: 'Practise', title: 'Practise like the exam', ms: 8000,
    line: 'Fresh mocks on the exam’s own screen. Unlimited on Pro.', path: 'mockmob.in/test' }),
  Object.freeze({ id: 'see', icon: 'mistakes', verb: 'See', title: 'See where marks went', ms: 7000,
    line: 'Every lost mark traced to its chapter.', path: 'mockmob.in/result' }),
  Object.freeze({ id: 'fix', icon: 'revise', verb: 'Fix', title: 'Fix what went wrong', ms: 8000,
    line: 'Bring a mistake from any test and ask Mobi why.', path: 'mockmob.in/mentor' }),
  Object.freeze({ id: 'aim', icon: 'compass', verb: 'Aim', title: 'Aim at a college', ms: 6000,
    line: 'Your score against real DU cutoffs.', path: 'mockmob.in/admission-compass' }),
]);

// The Practise screen: question 3 of the exam screen's own five (homeCopy EXAM, the runner's strings), at the same clock.
// The NTA line is the exam section's own first sentence (EXAM_HEAD.sub, LK319), and the key opens that section's full-screen
// runner (EXAM.full.open).
export const PRACTICE = Object.freeze({
  subject: EXAM.subject,
  attempt: EXAM.attempt,
  total: EXAM.total,
  question: EXAM.questions[EXAM.start.index],
  clock: `${String(Math.floor(EXAM.startSeconds / 60)).padStart(2, '0')}:${String(EXAM.startSeconds % 60).padStart(2, '0')}`,
  heading: EXAM.mockmob.questionOf(EXAM.start.index + 1, EXAM.total),
  timer: EXAM.mockmob.timer,
  saved: EXAM.saved,
  nta: `${EXAM_HEAD.sub.split('. ')[0]}.`,
  full: EXAM.full.open,
});

// The Fix screen: a mistake brought from another test (bringMistakeCopy.mjs, the live home's own worked example), what the
// student leaves with, and what it costs in credits. `price` is built on the page from the app's constants (fixPrice below).
export const FIX = Object.freeze({
  from: BRING_MISTAKE.slip.label,
  q: BRING_MISTAKE.slip.q,
  chose: BRING_MISTAKE.slip.options[BRING_MISTAKE.slip.chosen],
  key: BRING_MISTAKE.slip.options[BRING_MISTAKE.slip.correct],
  slipLabel: BRING_MISTAKE.read.slip[0],
  slip: BRING_MISTAKE.read.slip[1],
  chapter: BRING_MISTAKE.read.chapter,
  leave: BRING_MISTAKE.value,
});
/** The price line, from the app's own numbers (src/services/mobi/mistakePrices.mjs, the wallet's AI_FREE_MONTHLY_CREDITS). */
export const fixPrice = ({ photo, credits, photoCredits, free }) => bringMistakeWords({ photo, credits, photoCredits, free }).price;

// The Aim screen is a still of DU Compass (Revision 2: one interactive Compass on the page, section 7), with a way down to it.
export const AIM = Object.freeze({ ask: 'If your score were', down: 'Try your own score below', href: '#compass' });

// ------------------------------------------------------------------ 5. the Mistake Lab in four beats (labStory.mjs only)
export const LAB_NEXT = Object.freeze({
  h2: 'See exactly where your marks went.',
  mark: 'marks went.',
  example: 'Example',
  paper: `${EXAM.subject}, a ${S.facts.right + S.facts.wrong + S.facts.blank}-question mock`,
  after: 'MockMob does this after every mock.',
  // Each beat: `verb` the phone chip, `title` the row, `figure` and `unit` the one large figure in the frame, `line` its one
  // sentence (the row's line from 960 px, the caption over the frame on a phone).
  beats: Object.freeze([
    Object.freeze({ id: 'score', verb: 'Score', title: 'Your score', ms: 6500, figure: String(S.facts.marks), unit: `of ${S.facts.outOf} marks`,
      line: `You scored ${S.facts.marks} of ${S.facts.outOf}.` }),
    Object.freeze({ id: 'where', verb: 'Where', title: 'Where they went', ms: 7000, figure: String(top.lost), unit: `of ${S.lostMarks} lost marks`,
      line: `${top.lost} of your ${S.lostMarks} lost marks are in one chapter: ${top.chapter}.` }),
    Object.freeze({ id: 'changes', verb: 'Changes', title: 'Answers you changed', ms: 7000, figure: signed(S.net), unit: `marks from ${S.changes.length} changed answers`,
      line: `You changed ${S.changes.length} answers. It cost you ${Math.abs(S.net)} marks.` }),
    Object.freeze({ id: 'next', verb: 'Next', title: 'What to do next', ms: 6500, figure: String(planCount), unit: `questions on ${top.chapter}`,
      line: `Next: ${lc(plan.label)}.` }),
  ]),
});

/** The example mock's rows for the frame's pictures (labStory.mjs, so they agree with every other Lab figure). */
export const LAB_EXAMPLE = Object.freeze({
  facts: S.facts,
  chapters: S.chapters.map((c) => Object.freeze({ chapter: c.chapter, lost: c.lost, right: c.right, of: c.of })),
  lostMarks: S.lostMarks,
  rows: S.rows.map((r) => Object.freeze({ n: r.n, verdict: r.verdict })),
  changes: S.changes.map((c) => Object.freeze({ n: c.n, from: c.from, to: c.to, net: c.net, fromVerdict: c.fromVerdict, toVerdict: c.toVerdict, gap: c.gap })),
  net: S.net,
  plan: Object.freeze({ label: plan.label, reason: plan.reason }),
});

// ------------------------------------------------------------------ 6. coverage
// A chapter counts as covered only when the bank holds a set's worth of questions for it: the count a first practice set
// runs (src/lib/firstSet.mjs, 10). One question is not coverage (Revision 2).
export const COVER_MIN = FIRST_SET_COUNT;
export const COVER_HEAD = Object.freeze({ h2: 'How much of CUET does MockMob cover?', link: 'See the syllabus' });
const n = (value) => Number(value).toLocaleString('en-IN');
/** The one sentence under the heading: the sourced subject claim, then the live bank's count (null when it is unknown). */
export function coverLead(questions) {
  const claim = `The ${PUBLIC_SUBJECT_COUNT} subjects behind ${PAPER_SHARE.covered} of every ${PAPER_SHARE.outOf} CUET papers`;
  return Object.freeze({
    claim,
    count: Number.isFinite(questions) && questions > 0 ? n(questions) : null,
    text: Number.isFinite(questions) && questions > 0 ? `${claim}, with ${n(questions)} questions in the live bank.` : `${claim}.`,
  });
}
export const coverSource = () => SUBJECT_CLAIM.source;
/** The fine line under the card: across every subject, how many syllabus chapters reach a set's worth, and when counted. */
export const coverFine = ({ covered, chapters, countedOn }) => `Across all subjects, ${covered} of ${chapters} syllabus chapters have ${COVER_MIN} or more questions.${countedOn ? ` Counted ${countedOn} from the live bank, refreshed every day.` : ''}`;
export const chapterLine = (c) => (c.count >= COVER_MIN
  ? `${n(c.count)} questions in the bank`
  : c.count > 0 ? `${n(c.count)} question${c.count === 1 ? '' : 's'} so far, under a set of ${COVER_MIN}` : 'No questions in the bank yet');
export const subjectCovered = (s) => `${s.covered} of ${s.chapters.length} chapters have ${COVER_MIN} or more questions`;

// ------------------------------------------------------------------ the slim Daily Five and Sunday Mock row (Revision 2)
export const RHYTHM = Object.freeze({ h2: 'Five a day. One paper a Sunday.' });

// ------------------------------------------------------------------ the reused sections, one sentence under each heading
// Each is the live page's own first sentence (homeCopy.mjs), so nothing new is claimed.
export const TRY_NEXT = Object.freeze({ h2: TRY_HEAD.h2, sub: 'Get your score, with every miss explained.' });
export const COMPASS_NEXT = Object.freeze({ h2: COMPASS_HEAD.h2, sub: 'Slide a score to see which colleges it would have cleared in 2026.' });
// 9. One proof section: the creators (no consented student quote exists, so no "Students" heading; Revision 2).
// Sign-ups (owner LK362, 20 Nov 2026: "You can write 1,500+"). True as a floor: 1,493 students signed up last season and 61
// more since June 2026 (a production read recorded in the ledger at LK188), 1,554 in all. A floor, never a live count; raise
// it only from a new production read.
export const SIGNUPS_FLOOR = '1,500+';
export const SOCIAL_NEXT = Object.freeze({ h2: 'CUET creators on MockMob.', sub: `${SIGNUPS_FLOOR} students have signed up, and CUET creators show MockMob to their followers.` });

/** The FAQ's new question (Revision 2), answered from the code's constants: the wallet's free credits and the free plan. */
export function freeFaq({ freeCredits, dailySize }) {
  const items = freePlan({ newOffer: false, firstFullMockItem: null }).map(lc);
  const list = `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
  return Object.freeze({
    question: 'What do I get free?',
    answer: `${freeCredits} credits a month, with no card needed. Free covers ${list}. The Daily Five, ${dailySize} questions a day, is free with no sign-up.`,
  });
}
