// "How a Sunday goes" on the Sunday Mock's public page, as data (16 Nov 2026, evening). The owner on the first build, six
// headings each over a paragraph: "It should have a proper explanation, not just walls of text, and that is also not properly
// lined." So the page shows the paper as three figures and the day as a timeline, and every number here is the rule's own
// constant (src/lib/sundayMock.mjs), never typed: change the rule and the page follows. Pinned by sundayHow.test.mjs.
import { ANSWERS_AFTER_MINUTES, CLOSE_HOUR, MARK_RIGHT, MARK_WRONG, OPEN_HOUR, PAPER_COUNT, PAPER_MINUTES, SHARE_FLOOR } from '../../lib/sundayMock.mjs';
import { SUNDAY_BOARD_FLOOR } from '../../lib/daily/team.mjs';

/** A time of day in IST as the site writes it: "10:00 am", "11:05 pm". Minutes past the hour may run over (65 is the next hour's :05). */
export function clockWords(hour, minutes = 0) {
  const total = hour * 60 + minutes;
  const h24 = Math.floor(total / 60) % 24;
  const m = total % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'am' : 'pm'}`;
}

export const OPENS = clockWords(OPEN_HOUR);
export const LAST_START = clockWords(CLOSE_HOUR);
// The last paper can start at the close and run its full length; the answers open a few minutes after it must be in.
export const ANSWERS_AT = clockWords(CLOSE_HOUR, PAPER_MINUTES + ANSWERS_AFTER_MINUTES);

/** The paper in three figures: a number, its unit, and nothing else. */
export const PAPER_FIGURES = Object.freeze([
  Object.freeze({ figure: String(PAPER_COUNT), unit: 'questions' }),
  Object.freeze({ figure: String(PAPER_MINUTES), unit: 'minutes' }),
  Object.freeze({ figure: `+${MARK_RIGHT}`, unit: `right, −${MARK_WRONG} wrong` }),
]);

/** The day, in order. `when` is a clock time or the moment it hangs on; `title` is what happens; `line` is the one thing to know. */
export const SUNDAY_STEPS = Object.freeze([
  Object.freeze({ when: OPENS, title: 'The papers open', line: 'One full paper in each of your subjects, the same questions for everyone in that subject. Start whenever you like.' }),
  Object.freeze({ when: 'When you send', title: 'Your marks, at once', line: 'One sitting in each subject. Your marks show the moment you send the paper.' }),
  Object.freeze({ when: LAST_START, title: 'Last start', line: `A paper started by ${LAST_START} keeps its full ${PAPER_MINUTES} minutes.` }),
  Object.freeze({ when: ANSWERS_AT, title: 'Answers and explanations open', line: `Every answer, explained. You also see how many sat the paper and, once ${SHARE_FLOOR} or more have, how many got each question right.` }),
  // The college board (17 Nov 2026, src/lib/daily/team.mjs): the same moment, its own step.
  Object.freeze({ when: 'Then', title: 'The college board', line: `Colleges by the average marks of the students playing for them, once ${SUNDAY_BOARD_FLOOR} of a college\u2019s students have sat it.` }),
  Object.freeze({ when: 'After', title: 'Talk it over with your Mob', line: 'In a Mob you see which friends sat it, and their marks if they share them.' }),
]);
