// The words of the home page's Daily Five and Sunday Mock block (DailyFiveRow.jsx HomeBlock), kept pure so node --test can
// pin them (dailyStripCopy.test.mjs).
// 16 Nov 2026, evening: the owner could not tell from "English and General Test" what the five are, and "No. 2" told him
// nothing. 16 Nov, 10:25 pm, on his phone, of the two short rows that followed: "a very small subsection, not something
// important ... the visual hierarchy is not here". So the block is now the week as seven calendar leaves (weekRail), then two
// cards, each in three levels: the state and its time (largest), the name and one sentence, three figures, and one key.
// Every number is the product's own constant, never typed.
// 17 Nov 2026 (owner LK293: the look was understood, but it read as Prepium's; "building something unique" around a team): the
// head says the game in two beats, the week rail is gone from the block (the run of days is /daily's), and the Daily Five is
// an admit card with "Playing for" a DU college and the five as answer bubbles (omrLabel), then today's college board.
import { DAILY_FIVE_PATH, DAILY_FIVE_SIZE, untilShort } from '../../lib/dailyFive.mjs';
import { LAUNCH_WEEK, MARK_RIGHT, MARK_WRONG, PAPER_COUNT, PAPER_MINUTES, dateLabel, sundayState, sundayWindow } from '../../lib/sundayMock.mjs';
import { ANSWERS_AT, LAST_START, OPENS, PAPER_FIGURES } from '../../app/sunday-mock/sundayHow.mjs';

export const COLLEGE_DAILY = process.env.NEXT_PUBLIC_DAILY_COLLEGE_BOARD === 'true';
// Owner LK321 (18 Nov 2026), of "Play for your college": "I don't know if you should add like colleges names ... any issues
// legally ... something more simpler can be done". The simpler game is the default: the same five for everyone, and your own
// run of days. The college board stays in the code behind this switch (set at build time) until he decides.
// 21 Nov 2026 (owner LK365: "this Daily 5 feature has to be completely rethought ... it should be more than just this basic
// thing"; tmp/1121-stories/DAILY-SPEC.md "Your five"): a signed-in student's five come from their own record (the questions
// they got wrong, their weak chapters, their subjects: src/lib/dailyFiveMine.mjs); a guest plays the shared five. So the head
// says what the five are for, and the sub line says who gets which, true for a guest and for a student. `mark` is the phrase
// the page's head underlines (page.js).
export const PERSONAL_HEAD = Object.freeze({
  h2: 'Five a day, built from your mistakes.',
  // 21 Nov 2026 critic: "each day's five bring back what you got wrong" overstated it for a new account (no mistakes yet).
  // 22 Nov 2026 (owner LK366: "the overall explanation is really weak about what exactly this is"): one plain sentence says
  // what the five are, in MINE_PLAN's numbers (src/lib/dailyFiveMine.mjs: 2 missed, 2 weak, 1 from your subjects; a place
  // with nothing to fill it passes to the next kind), and one says the streak rule (a whole five is a streak day:
  // src/lib/server/streakDays.js, chain.mjs DAY_GOAL 5). It still opens "Signed in": a guest plays the shared five (the
  // card's small print says so), so a guest is never told the five are their own mistakes.
  // 22 Nov 2026, later (owner LK367: "good enough, but still a bit confusing for a newcomer"): the line now speaks to the
  // newcomer first (what to do now, with no account), then says what the five become once there is a record to build from.
  // 23 Nov 2026 (owner LK427: "fixing the UI and explanation"; the paragraph was a wall of text on a phone): the line says
  // what it is and what to do now; how it works is three small pictures under the head (DAILY_HOW, DailyHow.jsx).
  sub: 'Five questions a day. Play today’s now: free, no sign-up.',
  mark: 'your mistakes.',
});
/**
 * How the Daily Five works, as three pictures with a few words each (owner LK427, 23 Nov 2026: a newcomer should get it in
 * about three seconds, shown rather than written). Each is a product rule: a wrong answer anywhere is a `missed` candidate
 * (src/lib/dailyFiveMine.mjs: "questions the student answered wrong before today"), two of the five places go to them
 * (MINE_PLAN), and a whole five is a streak day (src/lib/server/streakDays.js). Nothing here says "until": a question that
 * comes back and is answered right is marked fixed (fedLines), which the demo below shows.
 */
export const DAILY_HOW = Object.freeze([
  Object.freeze({ id: 'miss', title: 'You get one wrong', line: 'in a mock or in practice' }),
  Object.freeze({ id: 'back', title: 'It comes back', line: 'in your Daily Five' }),
  Object.freeze({ id: 'streak', title: 'Your streak grows', line: 'when you finish all five' }),
]);
export const DAILY_HOW_LABEL = 'How the Daily Five works';
/** The line beside the card's "Example" mark, over the demo: the demo is a student's own five (2 missed, 2 weak, 1 new),
 *  which an account gets after it has practised; a guest plays the shared five (owner LK428, 23 Nov 2026). */
export const DAILY_EG = 'What a five looks like once you have practised.';

export const STRIP_HEAD = Object.freeze({
  h2: 'Five a day. Play for your college.',
  // Only a signed-in five counts on the college board (a guest's is kept on the device alone): the line says so.
  sub: 'The same five English and General Test questions for everyone. Each five you play signed in counts for the DU college you pick.',
  mark: 'your college.',
});

// What the five are, true for every reader (21 Nov 2026, "Your five"): a guest gets today's shared five, a signed-in student
// their own (it falls back to the shared five when theirs cannot be built). How many and "no sign-up" are two of the card's
// three figures, so the sentence does not say them twice.
export const DAILY_LINE = 'Five questions a day, new at 12:00 am. Signed in, the five are picked for you.';
/** The home card's small print under its key (DAILY-SPEC.md): true for a guest, who can play without an account. */
// 22 Nov 2026 (LK366): the head's line now opens "Signed in, you get five questions a day", so the print says the guest's
// half: free, and without an account the shared five (DailyFive.jsx loads dailyFiveUrl(day) first: one five for every
// guest; a signed-in student's own five replaces it only when GET /api/daily/mine builds one). It also
// carries the card's "Free" and "No sign-up" figures, which the card no longer draws.
export const DAILY_PRINT = 'Free. Without an account, you get the same five as every other guest.';

/**
 * Today's row for a signed-in student whose own five is built (GET /api/daily/mine, personal), before it is played: the mix in
 * short words and the time left ("Your five: 2 you missed, 2 weak chapters, 1 new. Closes in 1 h 44 min."). `mix` is the
 * route's { missed, weak, subject }; `wait` the time left in words (untilShort), '' before the clock is read. 21 Nov 2026
 * critic: the row had dropped the time and read the same before and after the five.
 */
export function todayMineLine({ mix, wait = '' } = {}) {
  const n = (v) => Math.max(0, Math.round(Number(v) || 0));
  if (!mix) return '';
  const parts = [
    n(mix.missed) ? `${n(mix.missed)} you missed` : null,
    n(mix.weak) ? `${n(mix.weak)} ${n(mix.weak) === 1 ? 'weak chapter' : 'weak chapters'}` : null,
    n(mix.subject) ? `${n(mix.subject)} new` : null,
  ].filter(Boolean);
  if (!parts.length) return '';
  return `Your five: ${parts.join(', ')}.${wait ? ` Closes in ${wait}.` : ''}`;
}

/**
 * Today's row once a personal five is played: the score, then the first thing the five did (dailyMineUi.mjs didLines, from
 * this device's note of each check's `fed`; "1 mistake fixed"), else the wait to the next five. Short enough for two lines.
 */
export function todayDoneLine({ score, did = [], wait = '' } = {}) {
  const first = Array.isArray(did) ? did.find((l) => typeof l === 'string' && l) : null;
  const tail = first ? ` ${first.charAt(0).toUpperCase()}${first.slice(1)}${/[.]$/.test(first) ? '' : '.'}` : wait ? ` Next five in ${wait}.` : '';
  return `Done today, ${score}/${DAILY_FIVE_SIZE}.${tail}`;
}
// The paper's size is in its figures; the sentence says what it is and that it needs an account (the five does not).
export const SUNDAY_LINE = 'One full paper in each of your subjects, the same for everyone. Sign up to sit it.';
/** The home card's two rows (owner, 26 Nov 2026; the council's verdict): what each is, in one line. A guest's five is the
 *  shared one, so the line says when the five become your own; the Sunday paper's size is in its figures beside it. */
export const CAL_COPY = Object.freeze({
  daily: 'Free. Signed in, the five come from your own mistakes.',
  sunday: 'One full paper, the same for everyone. Sign up to sit it.',
});
/** The home card's shorter sentence (17 Nov 2026): the figures under it say the paper's size. */
export const SUNDAY_LINE_SHORT = 'One full paper in each of your subjects. Sign up to sit it.';

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
 * The five's answer bubbles in one sentence, for a screen reader (the bubbles themselves are a picture): this device's
 * record of today. `marks` [true | false | null x5] or null; `current` the question being answered (0 to 4), or null.
 */
export function omrLabel(marks, current = null) {
  if (Array.isArray(marks) && marks.length === DAILY_FIVE_SIZE && marks.every((m) => m === true || m === false)) {
    return `Today on this device: ${marks.filter(Boolean).length} of ${DAILY_FIVE_SIZE} right.`;
  }
  if (Number.isInteger(current) && current >= 0 && current < DAILY_FIVE_SIZE) return `Today on this device: on question ${current + 1} of ${DAILY_FIVE_SIZE}.`;
  return `Today\u2019s ${DAILY_FIVE_SIZE} questions, none answered on this device yet.`;
}
