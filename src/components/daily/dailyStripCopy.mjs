// The words of the home page's Daily Five and Sunday Mock strip (DailyFiveRow.jsx HomeStrip), kept pure so node --test can
// pin them (dailyStripCopy.test.mjs). 16 Nov 2026, evening: the owner could not tell from "English and General Test" what the
// five are, and "No. 2" told him nothing. So each row says in one sentence what it is and who it is for, then when, then the tap.
import { untilShort } from '../../lib/dailyFive.mjs';
import { PAPER_COUNT, PAPER_MINUTES } from '../../lib/sundayMock.mjs';

export const STRIP_HEAD = Object.freeze({
  h2: 'Five a day. One paper a Sunday.',
  sub: 'Two fixed dates in your week, the same for every student. Both are free.',
});

// What the five are: the two papers nearly every CUET student sits, so one five can be the same for everyone.
export const DAILY_LINE = 'Five questions from English and the General Test, the same five for everyone today. No sign-up.';
export const SUNDAY_LINE = `One full paper in each of your subjects, ${PAPER_COUNT} questions in ${PAPER_MINUTES} minutes. Free with an account.`;

const DAY_MS = 24 * 60 * 60 * 1000;
/** "5 days", "1 day", or hours and minutes inside the last day. */
export function waitWords(ms) {
  const days = Math.floor(Math.max(0, Number(ms) || 0) / DAY_MS);
  return days >= 1 ? `${days} ${days === 1 ? 'day' : 'days'}` : untilShort(ms);
}

/**
 * The Daily Five's row. `result` is { score, clock } once today is played, `begun` true once a question is answered, `streak`
 * the run of days, `waitMs` the wait to 12:00 am IST (null before the clock is read).
 */
export function dailyRow({ result = null, begun = false, streak = 0, waitMs = null } = {}) {
  const wait = waitMs === null ? null : untilShort(waitMs);
  if (result) {
    return {
      state: 'played',
      line: `You scored ${result.score}/5 in ${result.clock}.${streak >= 2 ? ` Day ${streak} in a row.` : ''}`,
      when: wait === null ? '' : `Next five in ${wait}`,
      go: 'See your result',
    };
  }
  return {
    state: begun ? 'begun' : 'open',
    line: begun ? 'You have started today’s five. Your answers are kept.' : DAILY_LINE,
    when: wait === null ? '' : `Closes in ${wait}`,
    go: begun ? 'Continue' : 'Play today’s five',
  };
}

/** The Sunday Mock's row: open today (10:00 am to 10:00 pm IST), or the wait to the coming Sunday's 10:00 am. */
export function sundayRow({ open = false, waitMs = null, known = true } = {}) {
  return {
    line: SUNDAY_LINE,
    when: !known ? '' : open ? 'Open today until 10:00 pm' : waitMs === null ? '' : `Opens in ${waitWords(waitMs)}`,
    go: 'See how it works',
  };
}
