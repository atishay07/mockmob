// The home page's words, in one pure module (4 Nov 2026, LK71 and decision 18), so node --test can hold them to their
// budgets (landingCopy.test.mjs) and page.js, FeatureTour, LabCinema, MistakeLab and ExamScreen render from one place.
// Pure: no React, no browser, no clock. Anything that depends on a release switch or the offer comes in as an argument,
// so a test can evaluate every branch.
//
// Budgets (the proposal's "copy" field, enforced by landingCopy.test.mjs):
//   section sub           at most 20 words
//   tour slide body       at most 25 words, then at most 2 points of at most 10 words each
//   Lab and Recovery step at most 45 words of step text, the numbers living inside the mock screen
//   FAQ answer            at most 45 words
// Copy rules: no middle dots, no "not just" contrast, no exclamation marks, no hype, sentence case. The only label above an h2 is
// a product-name brand stamp (BRAND_STAMPS, R3-D2, owner LK108/LK114, 5 Nov 2026): never a generic kicker or eyebrow.
// Voice (R3-D2, LK114): the two-beat cadence where it is true: "Fix it once. Check it holds.", "Practise. Replay. Repair.",
// "Fix why you missed it."
// Truth: every number comes from a capability gate, the offer, labStory.mjs or the live bank (never typed in here), and no
// claim is new: each line is an older line of this page, shortened.

import { labStory, signed } from './labStory.mjs';
import { perDay, paceWords, MONTH_DAYS } from '../../lib/payments/value.mjs';
import { SUBJECT_CLAIM } from '../../../data/subject_claim.js';

export const COPY_BUDGET = Object.freeze({ sub: 20, tourBody: 25, tourPoints: 2, tourPointWords: 10, step: 45, faq: 45, viewport: 60 });
export const wordCount = (text) => (String(text).match(/[\p{L}\p{N}₹][\p{L}\p{N}’'₹.,:%+\-/×]*/gu) || []).length;

// ------------------------------------------------------------------ hero (P2 renders these)
/**
 * The one sentence under the headline (LK70): it says what MockMob is. "MockMob is CUET UG mock tests" is the ink part.
 * R3-D3 (LK99, 5 Nov 2026: "cleaner like Preparoo"): two lines at 16-17 px on a phone, so it is 72 characters, not 94;
 * the claim is the same (the review traces every miss to its chapter, homeCopy buildTour radar).
 */
export const HERO_LEAD = Object.freeze({ strong: 'MockMob is CUET UG mock tests', rest: ' that trace every lost mark to its chapter.' });

// ------------------------------------------------------------------ the statement (scrubs word by word; * marks an accent word)
// "MockMob" is a green word too (owner LK102, 5 Nov 2026: "the Mock Mob needs to be in green also").
export const STATEMENT = 'Your marks slipped somewhere. *MockMob shows you *where, picks the chapter for *tonight, and keeps your DU *shortlist in sight.';

// ------------------------------------------------------------------ section heads (h2 and the one sub under it)
export const LAB_HEAD = Object.freeze({
  h2: 'Every mark, traced back to a moment.',
  sub: 'Every mock opens in the Lab: time, changed answers and the reason behind each miss.',
});
export const TOUR_HEAD = Object.freeze({
  h2: 'What’s inside MockMob.',
  sub: 'Practise. Replay. Repair. Then one plan ties it together.',
});
export const RECOVERY_HEAD = Object.freeze({
  h2: 'Fix it once. Check it holds.',
  sub: 'Replay the session, repair the leak, then prove it on fresh questions days later.',
});
export const COMPASS_HEAD = Object.freeze({
  h2: 'Hold your shortlist up to real cutoffs.',
  sub: 'Slide a score. See which colleges it would have cleared in 2026, by category and round.',
});
export const DU_HEAD = Object.freeze({
  h2: 'Which DU courses are open to you?',
  sub: 'Tick your subjects to see every DU programme they open under the 2026 rules. Free, no signup.',
});
export const EXAM_HEAD = Object.freeze({
  h2: 'Practise calm, then rehearse exam day.',
  sub: 'This is the real exam screen. Switch to NTA style to rehearse; your answers stay.',
});
export const INSTAGRAM_HEAD = Object.freeze({
  h2: 'Featured by CUET creators.',
  sub: 'DU seniors and admissions creators show MockMob to their followers. Tap a reel to watch it here.',
});
export const WALL_HEAD = Object.freeze({ h2: 'Students, in their own words.' });
// The brand stamps above the section heads (R3-D2, owner LK108/LK114): the section's desk object (BrandIcon) and the product's
// own name in the brand-word colour, sentence case, no caps, no dots. Only product names stamp a head: it is the brand speaking,
// not a generic eyebrow. Key cards (LK112) takes 'keycards' when its section lands.
export const BRAND_STAMPS = Object.freeze({
  lab: Object.freeze({ icon: 'mistakes', name: 'Mistake Lab' }),
  recovery: Object.freeze({ icon: 'revise', name: 'Score Recovery Lab' }),
  compass: Object.freeze({ icon: 'compass', name: 'DU Compass' }),
  instagram: Object.freeze({ icon: 'feeds', name: 'MockMob on Instagram' }),
  wall: Object.freeze({ icon: 'mob', name: 'Wall of love' }),
  keycards: Object.freeze({ icon: 'keycards', name: 'Key cards' }),
});

export const FAQ_HEAD = Object.freeze({ h2: 'Before your first mock.' });
// The close band leads with sign-up and log-in (LK83/LK88, 5 Nov): its words ask for the first mock, not the sample.
export const CLOSE = Object.freeze({
  mobi: 'See you at your first mock.',
  h2: 'Ready for your first mock?',
  sub: 'Sign up free to keep every score and see what to fix next.',
});

/**
 * The pricing head (R3-D8, LK110). On the monthly plan the sub is the plan's value a day, worked out from the live offer
 * (src/lib/payments/value.mjs perDay: ₹99 over a 30-day month, rounded up), never typed; until monthly opens it is the
 * one-time term.
 */
export function pricingHead(offer) {
  const day = offer.purchasable === 'monthly' ? perDay(offer) : null;
  return {
    h2: 'Start free. Go Pro for unlimited mocks.',
    sub: day
      ? `₹${offer.monthly.rupees} a month is about ${day.perDay} a day.`
      : `₹${offer.oneTime.rupees} once covers Pro through ${offer.oneTime.expires}. Monthly Pro at ₹${offer.monthly.rupees} is on the way.`,
  };
}

// ------------------------------------------------------------------ the one plan on the home page (R3-D7, R3-D8)
// The /pricing page's one plan (owner LK109) as a glass card over the word "Pro". Its title, price and terms are the shared
// plan's (src/components/pricing/planOffer.mjs); these are the home card's own words. Every ₹ figure is worked out from the
// offer (value.mjs) and comes in as an argument.
export const PLAN_HOME = Object.freeze({
  backdrop: 'Pro',
  pricingLink: 'See everything in Pro',
  free: 'Or start on Free: 50 credits a month, no card needed.',
  freeCta: 'Start free',
});

/**
 * The plan card's lines, in three groups (R3-D7: the numbers band's true counts now live here, with a count-up). A line with
 * `count` draws a live number from /api/stats (PlanCounts.jsx): 'bank' the questions in the public bank, 'subjects' the public
 * subjects that hold questions; `rest` follows the number, and `fallback` is the whole line while the count cannot load. Every
 * Pro item is proPlan()'s, so the card and the lists say the same thing.
 */
export function planGroups({ newOffer = false } = {}) {
  const pro = proPlan({ newOffer });
  const bank = { count: 'bank', rest: 'questions in one live bank, every mock built fresh', fallback: 'One live question bank, every mock built fresh' };
  const subjects = { count: 'subjects', rest: 'CUET subjects with full mocks', fallback: SUBJECT_CLAIM.short };
  const lines = (...items) => items.map((item) => (typeof item === 'string' ? { text: item } : item));
  if (newOffer) {
    return [
      { label: 'Practise', lines: lines(bank, subjects, pro[2], pro[3]) },
      { label: 'Recover', lines: lines(pro[0], pro[1]) },
      { label: 'Keep', lines: lines(pro[4]) },
    ];
  }
  return [
    { label: 'Practise', lines: lines(bank, subjects, pro[0], pro[2]) },
    { label: 'Review', lines: lines(pro[3], pro[4]) },
    { label: 'Plan', lines: lines(pro[1]) },
  ];
}

/** The free plan as one quiet line under the card. `firstFullMock` is the rule's own sentence (FIRST_FULL_MOCK_COPY.plan) while
 *  the free first full mock is on, else null (page.js decides, data/first_full_mock.js). */
export const freeLine = ({ firstFullMock = null } = {}) => (firstFullMock ? `${PLAN_HOME.free} ${firstFullMock}` : PLAN_HOME.free);

export { paceWords };
const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const n = (count) => Number(count).toLocaleString('en-IN');

/**
 * The value receipt's words (PlanValue.jsx; round 5, owner 6 Nov 2026: "it should not look like that. We are just offering
 * mocks ... There should be a slider for how many things a student can do ... So many features other than mocks also do we
 * have, which the Pro plan gives"). `r` is one row of receipt.mjs receiptTable: every figure in it is computed from the offer,
 * the Full mock's size, one stated per-mock rule and the real Key cards bank. The receipt counts what a pace comes to, lists
 * what Pro includes beyond it without a number, and ends on the price divided by the count.
 * Truth: the counted lines and the included lines are each already said on this page: the plan card (proPlan), the Lab's FAQ
 * answer ("After every mock, the Lab shows ..."), and the Key cards bank line ("Pro every card"). Mistake Repair and Ask Mobi run
 * on monthly credits capped per student, so they are included by name, never with a count or "unlimited".
 */
export const VALUE_COPY = Object.freeze({
  title: (r) => `Everything your ${r.price} covers`,
  lead: 'No cap on full mocks. Each one brings its own Lab read and chapter review.',
  ask: 'How many full mocks will you sit?',
  /** The receipt's head: the period the price pays for (a monthly and a one-time price never share a sentence). */
  head: (r) => (r.kind === 'monthly' ? `MockMob Pro, one ${MONTH_DAYS}-day month` : `MockMob Pro, to ${r.until}`),
  /** The counted lines, in receipt.mjs order. `detail` takes the row's (or the line's) figures. */
  lines: Object.freeze({
    mocks: Object.freeze({ label: 'Full mocks', detail: ({ questions, about }) => `${n(questions)} questions. About ${about} a mock.` }),
    lab: Object.freeze({ label: 'Mistake Lab reads', detail: () => 'Time, changed answers and a SWOT for each' }),
    review: Object.freeze({ label: 'Chapter reviews', detail: () => 'Every ranked chapter, pace and changed answers' }),
    cards: Object.freeze({ label: 'Key cards', detail: ({ subjects }) => `Every card, in ${n(subjects)} subjects` }),
  }),
  /** What Pro includes beyond the counts, without a number: the plan card's own lines (proPlan: Smart practice and NTA mode,
   *  Compass Pro, unlimited saves), then the two helpers that run on monthly credits, said as such. */
  included: Object.freeze([
    Object.freeze({ label: proPlan()[2] }),
    Object.freeze({ label: 'Compass Pro for your DU shortlist' }),
    Object.freeze({ label: proPlan()[4] }),
    Object.freeze({ label: 'Mistake Repair and Ask Mobi', detail: 'On your monthly credits' }),
  ]),
  includedWord: 'Included',
  /** The close: one full mock with everything above it, then the sum it comes from (kept together by no-break spaces, so a
   *  phone never breaks it after the price). Unlike things are never added into one count (orchestrator review, 6 Nov). */
  total: 'A full mock, everything above included',
  sum: ({ price, mocks }) => `${price} ÷ ${n(mocks)} full mocks`,
  /** The answer, "Under 1 paisa" (the figure, in the brand word colour, held on one line by no-break spaces so a phone never
   *  parts the number from its unit), then " a question.". */
  each: (r) => cap(r.each.text).replace(/ /g, ' '),
  eachTail: ' a question.',
  /** What a screen reader hears once the slider settles on a pace. */
  live: (r) => `${cap(paceWords(r.pace).long)}: ${n(r.mocks)} full mocks, about ${r.perMock.about} a mock, ${r.each.text} a question.`,
});

// ------------------------------------------------------------------ the two Compass and Combo blocks
export const COMPASS_PRO = Object.freeze({
  badge: 'Compass Pro',
  title: 'Your practice, mapped to the colleges you want.',
  body: 'Turn your practice into a paper-by-paper range against your DU shortlist.',
  cta: 'See what Pro includes',
  items: Object.freeze([
    ['Practice projection', 'Each paper out of 250, shown as a range.'],
    ['Your DU shortlist', 'Up to 8 targets, compared with Rounds I to III.'],
    ['Next move', 'The paper with the most marks open, and its weakest chapter.'],
  ]),
  fine: 'Comparing cutoffs is free, always.',
});
export const COMBO = Object.freeze({
  badge: 'Combo Planner',
  title: 'Five CUET subjects. Pick them right.',
  body: 'Set your DU goals and subjects, then compare five-paper combinations against the published 2026 rules.',
  cta: 'Plan my subjects',
});

// ------------------------------------------------------------------ pricing lists
/** What the free plan holds. `firstFullMockItem` is FIRST_FULL_MOCK_COPY.planItem while that switch is on, else null. */
export function freePlan({ newOffer = false, firstFullMockItem = null } = {}) {
  if (newOffer) return ['One baseline per launch subject', 'One included daily 10-question set', 'One new recovery episode per week', 'Fresh checks for started episodes', '25 saved questions'];
  return ['Quick practice and Full mock on credits', ...(firstFullMockItem ? [firstFullMockItem] : []), 'Weekly progress tracking', '25 saved questions', 'Your standing'];
}
/** What Pro adds on top of Free. */
export function proPlan({ newOffer = false } = {}) {
  if (newOffer) return ['All available recovery pathways', 'Fresh delayed checks and full history', 'Unlimited available practice and reattempts', 'Full, Smart and NTA access', 'Unlimited saved questions'];
  return ['Unlimited Quick practice and Full mock', 'Compass Pro: your practice mapped to your DU shortlist', 'Smart practice and NTA mode', 'Full chapter review: every ranked chapter, pace and changed answers', 'Unlimited saved questions'];
}

// ------------------------------------------------------------------ the feature tour (one idea per slide)
// `icon` names a desk object (BrandIcon, data/brand_icons.mjs) or 'bell', the brass desk bell of Ask Mobi
// (public/brand/mascot/ask-deskbell.webp). `lede` is the one sentence phones show in place of body and points.
export const TOUR_ICON = Object.freeze({ arena: 'questions', repair: 'mistakes', learn: 'lesson', replay: 'revise', radar: 'today', prepos: 'bell', compass: 'compass', combo: 'papers', rival: 'you', mob: 'mob' });

/** The tour's slides. Study and the Mob appear only while they are live (the same switches the pages read). */
export function buildTour({ studyLive = false, studyLessons = 0, studySubjects = 0, mobLive = false } = {}) {
  const slide = (id, rest) => ({ id, icon: TOUR_ICON[id], ...rest });
  return [
    slide('arena', { label: 'Practice', line: 'Drills and full mocks on the exam clock', title: 'Train on the exam’s own clock.',
      body: 'A short drill for a free evening, or a full 50-question, 60-minute mock for the weekend. Same timer, same question palette.',
      lede: 'A quick drill on a free evening, or a full 50-question, 60-minute mock on the real clock.',
      points: ['Quick drills and full mocks', 'Close the tab mid-test and pick up later'], chip: 'Marked +5 / −1, the way CUET marks it.', href: '/dashboard', cta: 'Start practising' }),
    slide('repair', { label: 'Mistake Repair', line: 'Fix why you got it wrong, not the answer alone', title: 'Fix why you missed it.',
      body: 'After a wrong answer, see why your pick was tempting, where it breaks and what to remember, all written from the official key.',
      lede: 'Why your pick was tempting, where it breaks, and the rule to keep. From the official key, or not at all.',
      points: ['If the AI and the key disagree, you pay nothing', 'A 10-minute next step, then 5 fresh questions'], chip: 'The AI explains only once its answer matches the official key.', href: '/signup', cta: 'Try Mistake Repair' }),
    ...(studyLive && studyLessons ? [slide('learn', { label: 'Learn', line: 'Learn the idea, then keep it', title: 'Learn the idea behind the mark, then keep it.',
      body: 'Short lessons with worked examples and the common mistake, then recall cards that return before you forget.',
      lede: 'Short lessons with worked examples, then recall cards that come back before you forget.',
      points: [`${studyLessons} lessons across ${studySubjects} subjects`, 'Lessons and recall are free, no credits'], chip: 'Made to sit beside your NCERT.', href: '/learn', cta: 'Open Learn' })] : []),
    slide('replay', { label: 'Replay', line: 'See where the marks actually went', title: 'Replay your mock, move by move.',
      body: 'Every answer you changed, every question that ate your time, every skip, in order. Then turn the costly ones into a short drill.',
      lede: 'Every changed answer, every slow question and every skip, in the order it happened.',
      points: ['An answer-by-answer timeline', 'Save any question to revisit later'], chip: 'The whole mock in order, so you pick what to fix.', href: '/review', cta: 'Review your mistakes' }),
    slide('radar', { label: 'Chapter review', line: 'The chapter to fix first', title: 'Know the chapter to fix first.',
      body: 'A score is just a number. Chapter review traces every miss to its chapter, so tonight has a target.',
      lede: 'Every miss traced back to its chapter, so tonight has one clear target.',
      points: ['Weakest chapters, free after every mock', 'Pro adds pace and changed-answer detail'], chip: 'Built from your attempts alone.', href: '/analytics', cta: 'See chapter review' }),
    slide('prepos', { label: 'Ask Mobi', line: 'Ask what to do tonight', title: 'Ask what to do tonight. Get one clear step.',
      body: 'Mobi reads your practice record and answers with the leak, the pace problem and one next step, the same one Today shows.',
      lede: 'Ask about your own record and get one next step, the same one Today shows you.',
      points: ['Questions about your own record are free', 'One credit buys a whole Mobi job'], chip: 'Every plan gets 50 free credits a month.', href: '/mentor', cta: 'Ask Mobi' }),
    slide('compass', { label: 'DU Compass', line: 'Your shortlist against real DU cutoffs', title: 'Test your DU shortlist against real cutoffs.',
      body: 'Compare a score with published 2026 DU cutoffs by college, category and round, free. With Pro, Compass maps your practice to your shortlist.',
      lede: 'Your score against the published 2026 DU cutoffs, by college, category and round.',
      points: ['Programme eligibility rules, free', 'Pro: your practice projected onto your shortlist'], chip: 'Your practice, set against DU’s published cutoffs.', href: '/admission-compass', cta: 'Open Compass' }),
    slide('combo', { label: 'Combo Planner', line: 'Choose your five CUET papers', title: 'Picking five papers? Test the combination first.',
      body: 'Pick your DU goals and the subjects you can take, then see which five-paper combinations the published 2026 rules keep open.',
      lede: 'Pick your DU goals and see which five-paper combinations the 2026 rules keep open.',
      points: ['Free to use', 'Compare combinations side by side'], chip: 'Tested against DU’s published 2026 rules.', href: '/cuet-subject-combination', cta: 'Plan my subjects' }),
    slide('rival', { label: 'Benchmarks', line: 'Beat a target score under the clock', title: 'Beat the score you’re aiming for.',
      body: 'Take a short timed run against a fixed target for accuracy and pace, set at daily, college or DU level.',
      lede: 'A short timed run against a fixed target for accuracy and pace.',
      points: ['The daily benchmark is free', 'Every mock earns points toward your standing'], chip: 'Race a set target score against the clock.', href: '/leaderboard', cta: 'See your standing' }),
    ...(mobLive ? [slide('mob', { label: 'The Mob', line: 'Prep with your friends, on the same questions', title: 'Bring your friends. Race the same questions.',
      body: 'Start a Mob and share its code. Friends race the same five questions for 24 hours, then fix the one that caught you together.',
      lede: 'Your friends get the same five questions for 24 hours, then you fix what caught you, together.',
      points: ['Play as a Fold and earn new ones', 'Turn sharing off and your marks stay private'], chip: 'Playing every game your Mob starts is free on every plan.', href: '/mob', cta: 'Open the Mob' })] : []),
  ];
}

// ------------------------------------------------------------------ FAQ (answers at most 45 words)
export function buildFaqs({ offer, mobLive = false } = {}) {
  const price = offer.purchasable === 'monthly'
    ? `₹${offer.monthly.rupees} a month. It renews until you cancel in Account, and you keep Pro to the end of the month you paid for.`
    : `₹${offer.oneTime.rupees} once covers Pro through ${offer.oneTime.expires}, with no auto-renewal. Monthly Pro at ₹${offer.monthly.rupees} a month opens soon, and whoever pays now keeps the full term.`;
  return [
    { question: 'Can I try it before signing up?', answer: 'Yes. Answer five CUET-style questions at the top of this page, each with the reasoning behind the answer. No account needed.' },
    { question: 'What is MockMob built for?', answer: 'Timed CUET UG practice, a clear read of every mistake and one next step for tonight. It covers the 15 subjects behind 19 of every 20 CUET papers, and every mock is built fresh from one live question bank. Pro has no cap.' },
    ...(mobLive ? [{ question: 'What is the Mob?', answer: 'Your study group inside MockMob. Share a Mob’s code and everyone gets the same five questions for 24 hours. Fix it together then gives you a fresh question like the one that caught you. You can keep your marks private.' }] : []),
    { question: 'What is the Mistake Lab?', answer: 'After every mock, the Lab shows where your marks went: time on each question, every answer you changed, the reason behind each miss, and a SWOT with the set to do next. Mistake Repair then fixes the reasoning.' },
    { question: 'What does Pro cost?', answer: price },
  ];
}

// ------------------------------------------------------------------ Mistake Lab: four scenes on one sample session
const S = labStory();
/** The four Lab scenes (title, body, take). Numbers come from the sample session (labStory.mjs), never typed here. */
export const LAB_SCENES = Object.freeze([
  { key: 'time', tab: 'Time', title: 'Find the minutes that cost you.',
    body: `Every question against CUET’s pace of ${S.pace}. Overruns light up, and so does what they bought you.`,
    take: S.time.wrongAllOver && S.time.underAllRight ? `All ${S.facts.wrong} wrong answers ran over pace. Every quick one was right.` : `${S.time.overCount} questions ran over pace.` },
  { key: 'changes', tab: 'Changes', title: 'Every second thought, on the clock.',
    body: 'Your first pick, what you switched to and when, and what each switch won or cost.',
    take: `${S.changes.length} changes. Net ${signed(S.net)} marks.` },
  { key: 'repair', tab: 'Repair', title: 'Fix why you missed it.',
    body: 'Why your pick was tempting, where it breaks, and the rule to keep. Written from the official key, or not written at all.',
    take: 'If the AI can’t match the key, the question waits. You never pay for a guess.' },
  { key: 'swot', tab: 'SWOT', title: 'Leave every mock with a plan.',
    body: 'A SWOT after every mock, with the exact sets to do next. Free. No credits.',
    take: `Partnership cost marks in each of your last ${S.swot.partnershipLost.length} mocks. That set goes first.` },
]);

// ------------------------------------------------------------------ Score Recovery Lab: four held steps
export const RECOVERY_STEPS = Object.freeze([
  { key: 'replay', title: 'Replay the session', body: 'Every answer and every minute, with the marks each one cost.', ms: 4800 },
  { key: 'leak', title: 'Find where marks leaked', body: 'Every missed mark, sorted by how it went: changed answers, wrong picks and blanks.', ms: 4800 },
  { key: 'move', title: 'Get one next move', body: 'One next step, the same one Today shows you.', ms: 4800 },
  { key: 'check', title: 'Check it on fresh questions', body: 'New questions, days apart, show whether the fix held.', ms: 4800 },
]);

// ------------------------------------------------------------------ the exam screen (ExamScreen.jsx, from the real runner)
// Every string the MockMob interface shows is a string of src/app/(app)/test/TestPageClient.jsx (examPreviewParity.test.mjs
// holds that). NTA's own words live ONLY in EXAM.nta and are drawn only after the visitor picks "NTA style"; they are the
// words of NTA's CBT guidelines (CUET (UG) 2025 Information Bulletin, Appendix V), in NTA's own capitals (D6, 5 Nov 2026).
export const EXAM = Object.freeze({
  attempt: 'Quick practice',
  subject: 'Accountancy',
  saved: 'Saved on this device.',
  total: 15,
  startSeconds: 38 * 60 + 11,
  // The 15 chips: the first five are the live questions below, then ten more as they would stand mid-paper.
  // 'a' answered, 'n' not answered (visited), 'x' not visited. Question 3 is where the visitor lands.
  restStates: Object.freeze(['a', 'a', 'a', 'a', 'n', 'x', 'x', 'x', 'x', 'x']),
  start: Object.freeze({ index: 2, answers: { 0: 2, 1: 1 }, marked: { 1: true }, visited: [0, 1, 2], struck: { 2: [2] } }),
  mockmob: Object.freeze({
    interface: 'MockMob',
    switchLabel: 'Test interface',
    exit: 'Exit test',
    timer: 'Time remaining',
    questionOf: (n, total) => `Question ${n} of ${total}`,
    answered: (n) => `${n} answered`,
    heading: (n) => `Question ${n}`,
    chip: Object.freeze({ answered: 'Answered', marked: 'Marked', 'marked-answered': 'Answered and marked', visited: 'Not answered', notvisited: 'Not visited' }),
    mark: 'Mark',
    unmark: 'Unmark',
    clear: 'Clear',
    strikeNote: 'Press and hold an option to cross it out.',
    previous: 'Previous',
    next: 'Next',
    review: 'Review',
    counters: Object.freeze([['answered', 'Answered'], ['marked', 'Marked'], ['pending', 'Pending'], ['notvisited', 'Not visited']]),
    legend: Object.freeze([['answered', 'Answered'], ['marked', 'Marked'], ['visited', 'Not answered'], ['notvisited', 'Not visited'], ['marked-answered', 'Answered and marked']]),
    submit: 'Submit test',
    paletteTitle: 'Review palette',
  }),
  // NTA style: the CBT screen the guidelines describe. The timer and the candidate's profile image sit top right with the
  // Question Paper icon, the section is on the top bar, the Question Palette is on the right with the section summary
  // (a count in each symbol) above it and a > arrow at its left that folds it away, and the three keys are NTA's.
  nta: Object.freeze({
    interface: 'NTA style',
    exam: 'CUET (UG)',
    candidate: 'Candidate Name',
    you: 'Your Name',
    subjectName: 'Subject Name',
    remaining: 'Remaining Time',
    questionPaper: 'Question Paper',
    question: (n) => `Question ${n}:`,
    save: 'Save & Next',
    markNext: 'Mark for Review & Next',
    clearResponse: 'Clear Response',
    submit: 'Submit',
    legend: Object.freeze([['notvisited', 'Not Visited'], ['visited', 'Not Answered'], ['answered', 'Answered'], ['marked', 'Marked for Review'], ['marked-answered', 'Answered & Marked for Review (will be considered for evaluation)']]),
    paletteTitle: 'Question Palette',
    hidePalette: 'Hide the Question Palette',
    showPalette: 'Show the Question Palette',
  }),
  // The browser's address bar on the monitor: where this screen really lives. The runner reads `interface=nta` from the
  // address, so the NTA-style address is the one a Pro student opens.
  address: Object.freeze({ host: 'mockmob.in', mockmob: '/test?subject=accountancy&mode=quick', nta: '/test?subject=accountancy&mode=nta&interface=nta' }),
  gate: 'NTA mode uses the entire screen.',
  gateTitle: 'Enter your exam space',
  warnings: 'Warnings 0/3',
  ctaFree: 'See Pro',
  ctaPro: 'Set up an NTA mock',
  // Phones (R4-H6, owner LK129, 6 Nov 2026): the monitor stays a scaled picture of the real screen, and one key opens that
  // screen full screen at a readable size, sideways like a monitor, with the same switch, answers and clock.
  full: Object.freeze({ open: 'Try it full screen', title: 'The exam screen, full screen', close: 'Close full screen', turn: 'Turn your phone sideways.' }),
  // Five Accountancy questions, ours, with the chapter and difficulty chips the runner shows. `options` letters are A to D.
  questions: Object.freeze([
    { chapter: 'Admission of a partner', difficulty: 'Medium', text: 'Goodwill brought in by an incoming partner is shared by the old partners in:', options: ['New ratio', 'Old ratio', 'Sacrificing ratio', 'Equal ratio'] },
    { chapter: 'Admission of a partner', difficulty: 'Easy', text: 'The sacrificing ratio of the old partners is calculated as:', options: ['New ratio minus old ratio', 'Old ratio minus new ratio', 'Old ratio plus new ratio', 'Old ratio divided by new ratio'] },
    { chapter: 'Admission of a partner', difficulty: 'Medium', text: 'On admission, a profit on revaluation of assets and liabilities is shared by:', options: ['Old partners in the old ratio', 'All partners in the new ratio', 'The new partner only', 'Old partners in sacrificing ratio'] },
    { chapter: 'Admission of a partner', difficulty: 'Medium', text: 'On admission, the general reserve is transferred to the capital accounts of:', options: ['Old partners in the old ratio', 'All partners in the new ratio', 'The new partner only', 'Old partners in the new ratio'] },
    { chapter: 'Admission of a partner', difficulty: 'Hard', text: 'Premium for goodwill paid by the new partner in cash is credited to:', options: ['Old partners in sacrificing ratio', 'New partner’s capital account', 'The profit and loss account', 'The revaluation account'] },
  ]),
});
