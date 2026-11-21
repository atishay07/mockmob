// The Learn row's story for the home page's one-place frame (owner LK365, 21 Nov 2026: the words of this row are right "but
// the animation, again, is extremely lackluster"). Pure data, node-testable (data/tests/story_learn_1121.test.mjs); the
// screen that plays it is LearnStory.jsx. Every word and number on the screen comes from here, and each comes from the
// product's own files, named beside it. The test holds each one to its source.

// The tour slide's title (src/components/landing/homeCopy.mjs buildTour, slide 'learn').
const TITLE = 'Learn the idea. Then make it stick.';

// The real study content: data/study/pilot.json, the units and cards that data/study/release.json publishes (all four
// Accountancy lessons are in the release). Lessons in the subject's own order (unit.order); minutes are the unit's
// estimatedMinutes; cards count the unit's recall cards. The overview line mirrors LessonOverview.jsx ("A 7-minute lesson
// and 5 cards").
export const LEARN_SUBJECT = 'Accountancy';
export const LEARN_LESSONS = Object.freeze([
  Object.freeze({ id: 'accountancy-sacrificing-gaining', title: 'Sacrificing and gaining ratios', chapter: 'Change in Profit Sharing Ratio', minutes: 7, cards: 5 }),
  Object.freeze({ id: 'accountancy-revaluation', title: 'Revaluation of assets and liabilities', chapter: 'Admission of Partner', minutes: 7, cards: 5 }),
  Object.freeze({ id: 'accountancy-capital-stages', title: 'Authorised, issued or subscribed?', chapter: 'Share Capital', minutes: 5, cards: 3 }),
  Object.freeze({ id: 'accountancy-liquidity-ratios', title: 'Current ratio and quick ratio', chapter: 'Accounting Ratios', minutes: 5, cards: 3 }),
]);

// The lesson the cursor opens, its step count (the unit's blocks) and the worked example it stops on: the unit's block
// 'ratio-gain-worked' (step 5 of 9). `lead + key + tail` is the block's body word for word; `key` is the line that gets the
// highlighter. `rows` are the block's table without its head row.
export const LEARN_LESSON = Object.freeze({
  id: 'accountancy-sacrificing-gaining',
  steps: 9,
  step: 5,
  label: 'Worked example', // src/components/study/studyCopy.js BLOCK_LABEL.worked_example
  title: 'No new partner: someone still gains',
  lead: 'X, Y and Z share 3:2:1 and decide to share equally. Over 6: X goes from 3/6 to 2/6, a sacrifice of 1/6. Y stays at 2/6, so nothing changes.',
  key: 'Z goes from 1/6 to 2/6, a gain of 1/6.',
  tail: 'Z must compensate X.',
  head: Object.freeze(['Partner', 'Old (over 6)', 'New (over 6)', 'Change']),
  rows: Object.freeze([
    Object.freeze(['X', '3/6', '2/6', 'Sacrifice 1/6']),
    Object.freeze(['Y', '2/6', '2/6', 'No change']),
    Object.freeze(['Z', '1/6', '2/6', 'Gain 1/6']),
  ]),
  keyRow: 2,
});

// The lesson's first recall card, 'accountancy-ratio-formula', its choice variant (v2): prompt, options, the right option,
// the note on the option the demo misses (optionNotes) and the explanation. The label is studyCopy.js itemLabel for a choice
// card ('Choose'); the run's head mirrors StudyRun.jsx ("Recall: <title>", "Card 1 of 5").
export const LEARN_CARD = Object.freeze({
  id: 'accountancy-ratio-formula',
  title: 'Sacrifice and gain formulas',
  label: 'Choose',
  prompt: 'Which expression gives a continuing partner’s gain?',
  options: Object.freeze(['New share − Old share', 'Old share − New share', 'New ratio × incoming share', 'Old share ÷ New share']),
  right: 0,
  miss: 1,
  notes: Object.freeze([null, 'That is the sacrifice.', 'That is how an incoming share is split, not a gain.', 'A ratio of shares does not measure the change.']),
  explanation: 'A gain is how much a share rose, so start from the new share.',
  // Another card of the same lesson, the one the schedule strip shows as known.
  other: 'Calculate a gain',
});

// When a card comes back: the study scheduler (data/study_scheduler.mjs, FSRS at 0.9 retention, the one src/lib/server/
// study.js runs). A wrong choice is rated 1 (data/study_engine.js) and FSRS brings the card back in 1 to 10 minutes, which the
// app words "in under an hour" (studyCopy.js whenDue). A card answered right from memory is rated 3: after its first
// 10-minute step it comes back in 2 days, then in 11. The test runs the scheduler and holds these numbers to it.
export const LEARN_SCHEDULE = Object.freeze({
  missedMinutesMax: 10,
  missedWords: 'in under an hour',
  knownDays: Object.freeze([2, 11]),
});

// The words on the strip. The ticks are not to scale (today, then days): they say when, the markers show the order.
export const LEARN_STRIP = Object.freeze({
  title: 'When these cards come back',
  ticks: Object.freeze(['Today', `In ${LEARN_SCHEDULE.knownDays[0]} days`, `In ${LEARN_SCHEDULE.knownDays[1]} days`]),
  missed: `Missed: back ${LEARN_SCHEDULE.missedWords}`,
  known: `Got it: back in ${LEARN_SCHEDULE.knownDays[0]} days, then ${LEARN_SCHEDULE.knownDays[1]}`,
});

// The end line: the tour slide's points (homeCopy.mjs buildTour 'learn'): the count arrives as props from the server
// (src/app/page.js STUDY_LESSONS and STUDY_SUBJECTS, from data/study/release.json).
export const LEARN_FREE = 'Lessons and recall are free, no credits';
export const lessonCount = (lessons, subjects) => (lessons > 0 && subjects > 0 ? `${lessons} lessons across ${subjects} subjects` : '');

// ------------------------------------------------------------------ the script (CursorDemo steps)
const OPEN = '[data-demo="learn-open"]';
const LOCK = '[data-demo="learn-lock"]';
const CHECK = '[data-demo="learn-check"]';
const NEXT = '[data-demo="learn-next"]';
const BACK = '[data-demo="learn-back"]';
const option = (i) => `[data-demo="learn-option"][data-i="${i}"]`;
const click = (target, move, dwell, more = {}) => Object.freeze({ target, move, dwell, click: true, ...more });

export const LEARN_STORY = Object.freeze({
  id: 'learn',
  title: TITLE,
  steps: Object.freeze([
    // 1. The subject's lessons; the cursor opens one and the lesson slides in (420 ms).
    Object.freeze({ say: 'Open a short lesson on the chapter.', focus: OPEN, wait: 700 }),
    click(OPEN, 560, 950),
    // 2. The worked example is the subject, told as motion (critic round, 21 Nov 2026 evening: five lines of text and a table
    // in 3.9 s was a wall to read): one line of setup, then the table fills a row at a time (X sacrifices 1/6, Y no change,
    // Z gains 1/6, lit), learn-story.css.
    // The cursor leaves the words first: it waits on the lesson's key, under the table, while the rows fill; the worked
    // example stays the subject until the key is pressed (the table's last row, Z's gain, is the point).
    Object.freeze({ say: 'Read the worked example.', focus: '.st-learn__worked', wait: 500 }),
    Object.freeze({ target: LOCK, move: 450, dwell: 1320, at: [0.7, 0.5] }),
    click(LOCK, 150, 600, { at: [0.7, 0.5] }),
    // 3. The recall card slides in over the lesson. A miss first (B, the sacrifice), then Check answer: the card answers, and
    // the cursor parks on Next (never on the explanation's words).
    Object.freeze({ say: 'Then recall it from memory.', focus: '.st-learn__opts', wait: 550 }),
    click(option(LEARN_CARD.miss), 480, 360, { at: [0.3, 0.5] }),
    click(CHECK, 450, 500, { focus: '.st-learn__card' }),
    Object.freeze({ target: NEXT, move: 400, dwell: 700, at: [0.8, 0.6] }),
    // 4. Next: the schedule strip rises; the missed card lands today, the known one in 2 days, then 11.
    Object.freeze({ say: 'A card you missed comes back sooner.', focus: NEXT, wait: 500 }),
    click(NEXT, 150, 250, { at: [0.8, 0.6] }),
    // The cursor steps off the strip's marks to the corner of its Back to lessons key (never pressed), and rests there while
    // the cards land.
    Object.freeze({ target: BACK, at: [0.94, 0.15], move: 450, dwell: 1850, focus: '.st-learn__strip' }),
  ]),
});
