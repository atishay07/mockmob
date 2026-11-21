// The Daily Five's demo on the home page (owner LK365, 21 Nov 2026: "this Daily 5 feature has to be completely rethought ...
// it should be more than just this basic thing"; design tmp/1121-stories/DAILY-SPEC.md, "Your five"). Pure data, node-testable
// (dailyStoryScript.test.mjs); the screen that plays it is DailyStory.jsx, worked by the landing's demo cursor
// (src/components/landing/demo/CursorDemo.jsx) inside DailyFiveRow.jsx HomeBlock.
//
// The story, in four beats a 16 year old can follow with the sound off (rebuilt 22 Nov 2026, owner LK366):
//   1. five questions are picked for you: the five rows arrive one by one, each with why it is there;
//   2. the first is one you got wrong before: the cursor opens it, the question shows with "You missed this on 14 Nov";
//   3. get it right and that mistake is fixed: the option turns, a small "Fixed" lands on place 1's bubble;
//   4. finish all five and your streak grows by a day: the bubbles fill, the run steps from 6 to 7, today's square fills.
// The data is an EXAMPLE (the card says so): one sample student's five, built by the real rules. Each reason line is the
// page's own (src/lib/dailyFiveMine.mjs mineLabel), the mix line is mixLine, the day's end lines are fedLines, all called
// here so the demo can never say what /daily would not.
import { DAILY_FIVE_SIZE } from '../../lib/dailyFive.mjs';
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
  fixedMark: 'Fixed', // the small mark that lands on place 1's bubble (beat 3)
  after: `After all ${DAILY_FIVE_SIZE}`,
  score: `${STORY_SCORE}/${DAILY_FIVE_SIZE} today`,
  dayUnit: 'days in a row',
  didHead: MINE_COPY.doneHead, // 'What today’s five did'
});

// The beats' lines, in the order a student meets the thing (owner LK366, 22 Nov 2026: "This daily 5: I'm unable to understand,
// and the overall explanation is really weak about what exactly this is"). Each is a whole plain sentence of at most 58
// characters. The card shows the line of the beat under way above the screen; before the demo plays it shows the first, and
// after it ends it keeps the fourth (the screen rests on the day's end). Under reduced motion it lists all four.
export const DAILY_SAY = Object.freeze([
  // The sample's five are MINE_PLAN's mix (2 missed, 2 weak, 1 new), each row with its reason (mineLabel).
  'Each day, five questions are picked for you.',
  // Place 1 is a missed question (kind 'missed'); its label says the day ("You missed this on 14 Nov").
  'The first is one you got wrong before.',
  // A right answer on a missed question is fed 'fixed' (the server's word, fedLines "1 mistake fixed"); it does not clear
  // the item from Revise (critic 21 Nov), so the line says the mistake is fixed, nothing more.
  'Get it right and that mistake is fixed.',
  // A whole Daily Five (all five places answered) is a streak day: src/lib/server/streakDays.js dailyFiveStreakDays (5
  // answers, chain.mjs DAY_GOAL 5); a guest's own run is this device's record (dailyFive.mjs streakOf).
  'Finish all five and your streak grows by a day.',
]);

// The script (CursorDemo steps). Every target is a real <button> in DailyStory.jsx with that data-demo hook; what follows a
// click is DailyStory's own state and its CSS (daily-story.css), transform and opacity only.
// Pace (owner LK366, 22 Nov 2026: the last version changed its beats every 2.8 s while the screen changed twice under each):
// every line stays at least 3.2 s; the cursor's first move comes 800 ms after its line; nothing on the screen changes in
// the last 1.2 s of a beat (each beat ends on an `exact` wait the catch-up clock never shortens); the whole runs about
// 15.9 s (scriptMs) and then rests on the day's end. Stress: the part a beat is about keeps full strength and the rest
// falls to half (daily-story.css `[data-part]`); no outline around groups of rows.
/** The still end of every beat: nothing on the screen changes in it (the line before the next one is read on a still screen). */
export const QUIET_MS = 1300;
export const DAILY_STORY = Object.freeze({
  id: 'daily',
  title: 'Daily Five',
  steps: Object.freeze([
    // 1. The five arrive one by one with why each is there (daily-story.css: 220 ms apart, the last lands at about 1.4 s).
    // The cursor waits; nothing is stressed: all five are the subject.
    { say: DAILY_SAY[0], focus: null, wait: 3600 },
    // 2. Place 1 is stressed, the cursor opens it, and the question shows with its reason label (the options wait for beat 3).
    { say: DAILY_SAY[1], focus: '[data-demo="daily-slot-1"]', wait: 800 },
    { target: '[data-demo="daily-slot-1"]', at: [0.5, 0.5], move: 650, click: true, dwell: 0 },
    // The screen's change (the question view, 420 ms) lands inside the first wait; a slow phone may shorten that one to
    // catch up with the script's clock, never the last 1.3 s (`exact`), so a beat always ends on a still screen.
    { focus: '.dst-q__ask', wait: 700 },
    { wait: QUIET_MS, exact: true },
    // 3. The options are stressed, the cursor answers B (right): the option turns, "Fixed" lands on place 1's bubble, and
    // the line under the options says why (all landed 600 ms after the click). Then nothing is stressed: the answer and
    // what it did are all the subject.
    { say: DAILY_SAY[2], focus: '.dst-q__options', wait: 800 },
    { target: '[data-demo="daily-pick-B"]', at: [0.4, 0.5], move: 600, click: true, dwell: 0 },
    { focus: null, wait: 800 },
    { wait: QUIET_MS, exact: true },
    // 4. Next: after all five, the bubbles fill, the run steps from 6 to 7 and today's square fills (daily-story.css, by
    // 1.4 s after the click), then what the five did (by 1.8 s). The screen then rests there.
    { say: DAILY_SAY[3], wait: 800 },
    { target: '[data-demo="daily-next"]', at: [0.5, 0.5], move: 600, click: true, dwell: 0 },
    { wait: 1800 },
    { wait: QUIET_MS, exact: true },
  ]),
});

export { MINE_PLAN };
