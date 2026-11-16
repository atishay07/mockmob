// The words of the home page's Daily Five and Sunday Mock block (DailyFiveRow.jsx HomeBlock), kept pure so node --test can
// pin them (dailyStripCopy.test.mjs).
// 16 Nov 2026, evening: the owner could not tell from "English and General Test" what the five are, and "No. 2" told him
// nothing. 16 Nov, 10:25 pm, on his phone, of the two short rows that followed: "a very small subsection, not something
// important ... the visual hierarchy is not here". So the block is now the week as seven calendar leaves (weekRail), then two
// cards, each in three levels: the state and its time (largest), the name and one sentence, three figures, and one key.
// Every number is the product's own constant, never typed.
import { DAILY_FIVE_PATH, DAILY_FIVE_SIZE, calendarWeekOf, dayLabel, untilShort } from '../../lib/dailyFive.mjs';
import { LAUNCH_WEEK, PAPER_COUNT, PAPER_MINUTES, dateLabel, sundayState, sundayWindow } from '../../lib/sundayMock.mjs';
import { ANSWERS_AT, LAST_START, OPENS, PAPER_FIGURES } from '../../app/sunday-mock/sundayHow.mjs';

export const STRIP_HEAD = Object.freeze({
  h2: 'Five a day. One paper a Sunday.',
  sub: 'Two fixed dates in your week, the same for every student. Both are free.',
});

// What the five are: the two papers nearly every CUET student sits, so one five can be the same for everyone. How many and
// "no sign-up" are two of the card's three figures, so the sentence does not say them twice.
export const DAILY_LINE = 'The same five for everyone today, from English and the General Test.';
// The paper's size is in its figures; the sentence says what it is and that it needs an account (the five does not).
export const SUNDAY_LINE = 'One full paper in each of your subjects, the same for everyone. Sign up to sit it.';

/** The Daily Five in three figures: { figure, unit }. A figure may be a word when the fact is not a number. */
export const DAILY_FIGURES = Object.freeze([
  Object.freeze({ figure: String(DAILY_FIVE_SIZE), unit: 'questions' }),
  Object.freeze({ figure: 'Free', unit: '' }),
  Object.freeze({ figure: 'No sign-up', unit: '' }),
]);
/** The Sunday Mock in three figures: the paper's own two (sundayHow.mjs PAPER_FIGURES) and what it costs. */
export const SUNDAY_FIGURES = Object.freeze([
  PAPER_FIGURES[0],
  PAPER_FIGURES[1],
  Object.freeze({ figure: 'Free', unit: '' }),
]);
// The rule's own numbers, checked by the test (PAPER_FIGURES is built from them).
export const SUNDAY_PAPER = Object.freeze({ count: PAPER_COUNT, minutes: PAPER_MINUTES });

const DAY_MS = 24 * 60 * 60 * 1000;
/** "5 days", "1 day", or hours and minutes inside the last day. */
export function waitWords(ms) {
  const days = Math.floor(Math.max(0, Number(ms) || 0) / DAY_MS);
  return days >= 1 ? `${days} ${days === 1 ? 'day' : 'days'}` : untilShort(ms);
}

/**
 * The Daily Five's card. `result` is { score, clock } once today is played; `begun` true once a question is answered and `at`
 * the question the student is on (1 to 5); `streak` the run of days; `waitMs` the wait to 12:00 am IST (null before the clock
 * is read: no time is claimed then).
 *   status  the state, the card's largest words with its time: "Open today", "You are on question 3", "Done today, 4/5"
 *   when    the time left, or the run once played ("3 days in a row"; the next five's wait on a first day)
 *   line    what it is, in one sentence; figures: three; go: the key's words; href: where the key goes
 */
export function dailyRow({ result = null, begun = false, at = null, streak = 0, waitMs = null } = {}) {
  const wait = waitMs === null ? null : untilShort(waitMs);
  const base = { line: DAILY_LINE, figures: DAILY_FIGURES, href: DAILY_FIVE_PATH };
  if (result) {
    return {
      ...base,
      state: 'played',
      status: `Done today, ${result.score}/${DAILY_FIVE_SIZE}`,
      when: streak >= 2 ? `${streak} days in a row` : wait === null ? '' : `Next five in ${wait}`,
      go: 'See your result',
    };
  }
  const on = Number.isInteger(at) && at >= 1 && at <= DAILY_FIVE_SIZE ? at : null;
  return {
    ...base,
    state: begun ? 'begun' : 'open',
    status: begun ? (on ? `You are on question ${on}` : 'You have started') : 'Open today',
    when: wait === null ? '' : `${wait} left`,
    go: begun ? 'Continue' : 'Play today’s five',
  };
}

/**
 * The Sunday Mock's card at `now` (null before the clock is read). Before the launch week every date is the launch week's.
 *   phase   'soon' (Monday to Saturday, and Sunday before 10:00 am), 'open' (Sunday 10:00 am to 10:00 pm), 'closing' (10:00 pm
 *           to the answers), 'next' (after the answers open: the next Sunday), 'unknown' (no clock yet)
 *   status  "Opens Sunday 22 Nov, 10:00 am", "Opens tomorrow, 10:00 am", "Opens today at 10:00 am", "Open now until 10:00 pm" ...
 *   when    "In 5 days", "In 3 h 20 min", "6 h 12 min left", "Answers at 11:05 pm"
 *   open    true only while a paper can be started: then its key is the block's one volt key
 */
export function sundayRow({ now = null } = {}) {
  const base = { line: SUNDAY_LINE, figures: SUNDAY_FIGURES, go: 'See how Sunday works', href: '/sunday-mock', open: false };
  if (now === null || !Number.isFinite(Number(now))) return { ...base, phase: 'unknown', status: '', when: '', week: null };
  const t = Number(now);
  let st = sundayState(t);
  if (st.week < LAUNCH_WEEK) st = { ...sundayWindow(LAUNCH_WEEK), phase: 'before', answersOpen: false, dow: st.dow, next: LAUNCH_WEEK, prelaunch: true };
  if (st.phase === 'open') {
    return { ...base, phase: 'open', status: `Open now until ${LAST_START}`, when: `${untilShort(st.closesAt - t)} left`, go: 'Sit today’s paper', href: '/sunday', open: true, week: st.week };
  }
  if (st.phase === 'closed' && !st.answersOpen) {
    return { ...base, phase: 'closing', status: 'Closed for new starts', when: `Answers at ${ANSWERS_AT}`, week: st.week };
  }
  const week = st.phase === 'closed' ? st.next : st.week;
  // From Saturday the wait is in hours ("In 25 h"), never "In 1 day" beside "tomorrow".
  const ms = sundayWindow(week).opensAt - t;
  const wait = `In ${st.phase === 'before' && (st.dow === 6 || st.dow === 0) ? untilShort(ms) : waitWords(ms)}`;
  // This week's Sunday is on the rail right above the card, with its date: the card says the day and the hour. Any other
  // Sunday (the next one, or the first one before the launch week) carries its date.
  if (st.phase === 'closed') return { ...base, phase: 'next', status: `Next one ${dateLabel(week)}`, when: `${wait}, at ${OPENS}`, week };
  if (st.prelaunch) return { ...base, phase: 'soon', status: `First one ${dateLabel(week)}`, when: `${wait}, at ${OPENS}`, week };
  const status = st.dow === 6 ? `Opens tomorrow, ${OPENS}` : st.dow === 0 ? `Opens today at ${OPENS}` : `Opens Sunday, ${OPENS}`;
  return { ...base, phase: 'soon', status, when: wait, week };
}

/**
 * The week rail: Monday to Sunday of today's IST week from this device's record (dailyFive.mjs calendarWeekOf, the same
 * model as /daily's week), each day with what it carries: five questions, or on a Sunday from the launch week, the Mock.
 * The tick is the five's, never the Mock's: a Sunday whose five this device has finished shows the tick by its 5, since a
 * tick by "Mock" would say the paper was sat.
 */
export function weekRail(dates, today) {
  return calendarWeekOf(dates, today).map((d) => ({ ...d, carries: d.name === 'Sunday' && d.date >= LAUNCH_WEEK && !d.played ? 'Mock' : String(DAILY_FIVE_SIZE) }));
}

/** The rail in one sentence, for a screen reader (the leaves themselves are a picture). */
export function railLabel(days) {
  if (!Array.isArray(days) || days.length !== 7) return 'This week';
  const sunday = days[6];
  const played = days.filter((d) => d.played).length;
  const sundayWords = sunday.carries === 'Mock' ? ' and the Sunday Mock on Sunday' : '';
  const playedWords = played ? `Played on this device: ${played} ${played === 1 ? 'day' : 'days'}.` : 'None played on this device yet.';
  return `This week, ${dayLabel(days[0].date)} to ${dayLabel(sunday.date)}: a Daily Five every day${sundayWords}. ${playedWords}`;
}
