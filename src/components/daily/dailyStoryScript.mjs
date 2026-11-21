// The Daily Five's demo on the home page (owner LK365, 21 Nov 2026: "this Daily 5 feature has to be completely rethought ...
// it should be more than just this basic thing"; design tmp/1121-stories/DAILY-SPEC.md, "Your five"). Pure data, node-testable
// (dailyStoryScript.test.mjs); the screen that plays it is DailyStory.jsx, worked by the landing's demo cursor
// (src/components/landing/demo/CursorDemo.jsx) inside DailyFiveRow.jsx HomeBlock.
//
// The story, in four beats a 16 year old can follow with the sound off:
//   1. the five and why each is there (two you missed, two from your weak chapters, one new);
//   2. the cursor opens the first: a question this student got wrong on 14 Nov comes back;
//   3. it is answered right: the bubble turns, and the mistake is fixed;
//   4. after all five, the day counts: the streak's day fills and the day's end says what the five did.
// The data is an EXAMPLE (the card says so): one sample student's five, built by the real rules. Each reason line is the
// page's own (src/lib/dailyFiveMine.mjs mineLabel), the mix line is mixLine, the day's end lines are fedLines, all called
// here so the demo can never say what /daily would not.
import { DAILY_FIVE_SIZE, shortDate } from '../../lib/dailyFive.mjs';
import { MINE_COPY, MINE_PLAN, fedLines, mineLabel, mixLine } from '../../lib/dailyFiveMine.mjs';

// The sample five, places 1 to 5 in the order the server builds them (MINE_PLAN: 2 missed, 2 weak, 1 subject). Subjects and
// chapters are the syllabus's own display names (data/cuet_syllabus.js). The one question the cursor answers is place 1, a
// plain Accounting Ratios fact (current ratio = current assets / current liabilities, NCERT Accountancy Part 2, ch. 5).
export const STORY_FIVE = Object.freeze([
  Object.freeze({ n: 1, why: Object.freeze({ kind: 'missed', subject: 'Accountancy', chapter: 'Accounting Ratios', since: '2026-11-14' }), mark: true }),
  Object.freeze({ n: 2, why: Object.freeze({ kind: 'missed', subject: 'Economics', chapter: 'Money and Banking', since: '2026-11-12' }), mark: false }),
  Object.freeze({ n: 3, why: Object.freeze({ kind: 'weak', subject: 'Business Studies', chapter: 'Principles of Management' }), mark: true }),
  Object.freeze({ n: 4, why: Object.freeze({ kind: 'weak', subject: 'Accountancy', chapter: 'Cash Flow Statement' }), mark: true }),
  Object.freeze({ n: 5, why: Object.freeze({ kind: 'subject', subject: 'Economics', chapter: 'Market Equilibrium and Simple Applications' }), mark: true }),
]);

/** The mix of the sample five, counted from it (always 5). */
export const STORY_MIX = Object.freeze(STORY_FIVE.reduce((m, p) => ({ ...m, [p.why.kind]: m[p.why.kind] + 1 }), { missed: 0, weak: 0, subject: 0 }));

/** Each place's label as /daily draws it above the stem (mineLabel), with its subject and chapter. */
export const STORY_SLOTS = Object.freeze(STORY_FIVE.map((p) => Object.freeze({
  n: p.n, kind: p.why.kind, label: mineLabel(p.why), subject: p.why.subject, chapter: p.why.chapter,
})));

// The question of place 1, drawn as /daily draws a question (DailyFive.jsx: the stem, four lettered options, then "Correct."
// and the reason). `right` is the index of the right option.
export const STORY_QUESTION = Object.freeze({
  q: 'Which ratio compares current assets with current liabilities?',
  options: Object.freeze(['Quick ratio', 'Current ratio', 'Debt equity ratio', 'Proprietary ratio']),
  right: 1,
  why: 'Current ratio is current assets divided by current liabilities.',
});

// The day's end of the sample: place 1 fixed (fed 'fixed'), place 2 missed again (fed 'mistakes': back to the mistakes),
// the weak and new places right (fed null). Score and lines are counted from the marks and fed values, never typed.
export const STORY_FED = Object.freeze(['fixed', 'mistakes', null, null, null]);
export const STORY_SCORE = STORY_FIVE.filter((p) => p.mark).length;
export const STORY_FED_LINES = Object.freeze(fedLines(STORY_FED.reduce((c, f) => ({ fixed: c.fixed + (f === 'fixed' ? 1 : 0), sent: c.sent + (f === 'mistakes' ? 1 : 0) }), { fixed: 0, sent: 0 })));

// The sample's run of days: 6 days in a row before today; finishing today's five makes it 7. The last seven days end today.
export const STORY_STREAK = Object.freeze({ before: 6, after: 7, days: Object.freeze(['S', 'M', 'T', 'W', 'T', 'F', 'S']) });

// The words on the screen (sentence case; no dash between clauses, no exclamation mark).
export const STORY_WORDS = Object.freeze({
  example: 'Example',
  head: MINE_COPY.head, // 'Your five for today'
  mix: mixLine(STORY_MIX), // '2 you missed, 2 from your weak chapters, 1 new'
  start: 'Start',
  next: 'Next question',
  correct: 'Correct.',
  fixed: 'Mistake fixed',
  after: `After all ${DAILY_FIVE_SIZE}`,
  score: `${STORY_SCORE}/${DAILY_FIVE_SIZE} today`,
  dayUnit: 'days in a row',
  didHead: MINE_COPY.doneHead, // 'What today’s five did'
});

// The beats' lines (the card shows each above the screen while it plays; at rest it shows REST_LINE).
export const DAILY_SAY = Object.freeze([
  'Your five: two you missed, two weak chapters, one new.',
  `A question you got wrong on ${shortDate(STORY_FIVE[0].why.since)} comes back.`,
  // A right answer on a missed question is fed 'fixed' (the server's word); it does not clear the item from Revise (critic 21 Nov).
  'Get it right now and it counts as fixed.',
  'Finish all five and today counts for your streak.',
]);
/** The line before the story plays, after it ends, and under reduced motion (the end state is shown). */
// True for every signed-in student: one with no mistakes yet gets weak-chapter and new questions from their subjects, and one
// with no subjects plays the shared five (CONTRACT.md reasons no_subjects, thin_bank), so the line names both sources.
export const REST_LINE = 'Signed in, your five come from your subjects and mistakes.';

// The script (CursorDemo steps). Every target is a real <button> in DailyStory.jsx with that data-demo hook; what follows a
// click is DailyStory's own state and its CSS (daily-story.css), transform and opacity only. Pace (COMMON.md): each line stays
// at least 2.2 s, the cursor waits at least 500 ms after a new line, the whole runs about 13.4 s.
export const DAILY_STORY = Object.freeze({
  id: 'daily',
  title: 'Daily Five',
  steps: Object.freeze([
    // 1. The five and why each is there: the eye walks the three kinds, one group at a time.
    // The cursor points at each kind's bubbles as the stress moves (no click).
    { say: DAILY_SAY[0], focus: '[data-kind-group="missed"]', wait: 600 },
    { target: '[data-kind-group="missed"]', at: [0.09, 0.5], move: 520, dwell: 420 },
    { focus: '[data-kind-group="weak"]', target: '[data-kind-group="weak"]', at: [0.09, 0.5], move: 420, dwell: 560 },
    { focus: '[data-kind-group="subject"]', target: '[data-kind-group="subject"]', at: [0.09, 0.5], move: 420, dwell: 640 },
    // 2. The first place opens: the question and the day it was missed, read together (the label and the stem; the options
    // wait for beat 3), so the thing that came back is the part in focus.
    { say: DAILY_SAY[1], focus: '[data-kind-group="missed"]', wait: 600 },
    { target: '[data-demo="daily-slot-1"]', at: [0.5, 0.5], move: 650, click: true, dwell: 450 },
    { focus: '.dst-q__ask', wait: 1000 },
    // 3. The right answer: the option and the bubble turn, the line says the mistake is fixed.
    { say: DAILY_SAY[2], focus: '.dst-q__options', wait: 600 },
    { target: '[data-demo="daily-pick-B"]', at: [0.4, 0.5], move: 600, click: true, dwell: 400 },
    { focus: '.dst-q__foot', wait: 1200 },
    // 4. After all five: the streak's day fills and the day's end says what the five did.
    { say: DAILY_SAY[3], focus: null, wait: 550 },
    { target: '[data-demo="daily-next"]', at: [0.5, 0.5], move: 600, click: true, dwell: 300 },
    { focus: '.dst-day__streak', wait: 2200 },
  ]),
});

export { MINE_PLAN };
