// The daily streak's words (17 Nov 2026, LK296): one vocabulary for Today, You, the top bar chip, the streak sheet, the Mob den
// and /mob/chains. Pure, so node:test checks every line (data/tests/streak_1117.test.mjs), including the copy rule:
// never "lost", "behind", "hurry", "at risk", "missed", "break" or "fail" (denCopy.mjs line 4; W-063: no pressure). A miss is never
// drawn or said as a failure; a new streak starts, and the best stays.
// Every number comes from the server's body (GET /api/me/streak): the rule's 5, the make-up's 10, the passes and the pause days.

export const STREAK_NAME = 'Daily streak';
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_MS = 86_400_000;
const addDays = (key, d) => new Date(Date.parse(`${key}T00:00:00Z`) + d * DAY_MS).toISOString().slice(0, 10);
export const weekdayOf = (key) => WEEKDAYS[new Date(`${key}T00:00:00Z`).getUTCDay()];
export const daysWord = (n) => (n === 1 ? '1 day' : `${n} days`);
const qs = (n) => (n === 1 ? '1 question' : `${n} questions`);
const more = (n) => (n === 1 ? '1 more question' : `${n} more questions`);
const passes = (n) => (n === 1 ? '1 rest pass' : `${n} rest passes`);

/** The one rule for a day, said the same way everywhere (S2). */
export const ruleLine = (answers = 5) => `A day counts when you answer ${answers} questions in practice, a Daily Five or a Mob game, or finish a repair.`;

/** The week view's states (S5): what each mark means, in words. A day without practice is plain, never a failure. */
export const WEEK_STATES = Object.freeze({
  done: 'counted',
  rested: 'kept by a rest pass',
  made_up: 'made up',
  paused: 'paused for exams',
  open: 'still open',
  today: 'today',
  none: 'no practice',
});
const LOOK = { practised: 'done', rested: 'rested', made_up: 'made_up', paused: 'paused', open: 'open', today: 'today' };

/** The last 7 days, oldest first: [{ day, look, name, label, today }]. 'missed' and 'none' both draw as a plain day. */
export function streakWeek(body) {
  const week = Array.isArray(body?.week) ? body.week : [];
  const todayKey = week.length ? week[week.length - 1].day : null;
  return week.map((d) => {
    const isToday = d.day === todayKey;
    // A pause day today that has not counted shows as paused (the chain's own week calls it 'today').
    const look = isToday && d.state === 'today' && body?.today?.paused ? 'paused' : LOOK[d.state] || 'none';
    const name = isToday ? 'Today' : weekdayOf(d.day).slice(0, 3);
    return { day: d.day, look, name, today: isToday, label: `${isToday ? 'Today' : weekdayOf(d.day)}: ${WEEK_STATES[look]}` };
  });
}

/** The legend under the week: only the marks that are on it, in one line. */
export function weekLegend(marks) {
  const parts = [];
  if (marks.some((m) => m.look === 'rested')) parts.push('Moon: a rest pass kept the day.');
  if (marks.some((m) => m.look === 'made_up')) parts.push('Ring: a day you made up.');
  if (marks.some((m) => m.look === 'paused')) parts.push('Bar: an exam pause day.');
  if (marks.some((m) => m.look === 'open')) parts.push('Dashed: a day still open.');
  return parts.join(' ');
}

/** The make-up in words, no timer (S4): "Yesterday is still open. Answer 10 today to keep your streak." */
export function makeUpLine(makeUp, today) {
  if (!makeUp?.day) return null;
  const which = today && makeUp.day === addDays(today, -1) ? 'Yesterday' : weekdayOf(makeUp.day);
  const left = Math.max(0, (makeUp.needed ?? 10) - (makeUp.answeredToday ?? 0));
  return {
    text: `${which} is still open. Answer ${makeUp.needed} today to keep your streak.`,
    progress: left > 0 ? `You have answered ${makeUp.answeredToday ?? 0} of ${makeUp.needed} today.` : null,
  };
}

/** The calm notice after a covered day (S3): the newest rest pass or make-up of the last two days. */
export function noticeLine(body, today) {
  const recent = (body?.notices || []).filter((n) => today && (n.day === addDays(today, -1) || n.day === addDays(today, -2)))
    .sort((a, b) => b.day.localeCompare(a.day))[0];
  if (!recent) return null;
  const when = recent.day === addDays(today, -1) ? 'Yesterday' : weekdayOf(recent.day);
  return recent.kind === 'made_up'
    ? `${when} was made up. Your streak is still going.`
    : `${when} was covered by a rest pass. Your streak is still going.`;
}

/** The rest passes (S3), with bug 6 fixed: at the cap the line says so, and never promises a pass that would not come. */
export function passLine(p) {
  const held = p?.held ?? 0;
  const max = p?.max ?? 2;
  const at = p?.next?.at;
  if (held >= max) return { title: `${passes(held)}, the most you can hold`, next: 'Use one and the next can be earned.' };
  if (held === 0) return { title: 'No rest pass yet', next: at ? `Your next comes at day ${at}.` : null };
  return { title: passes(held), next: at ? `Next pass at day ${at}.` : null };
}
export const passRule = (r = {}) => `A rest pass covers a day without practice by itself. You earn one at day ${r.passFirstAt ?? 3}, one every ${r.passEvery ?? 7} days, and one for every ${r.passPerFixes ?? 3} repairs that hold.`;
export const makeUpRule = (r = {}) => `A day still open can be made up with ${r.makeUp ?? 10} answers on either of the next two days, once in ${r.makeUpEvery ?? 14} days.`;

/**
 * The one status line, by what matters most today: a day still open, a pause day, a covered day, today counted, or what today
 * needs. { text, sub? } — sub is a second short line (the make-up's progress).
 */
export function statusLine(body) {
  if (!body) return null;
  const todayKey = body.week?.[body.week.length - 1]?.day || null;
  const answered = body.today?.answered ?? 0;
  const needed = body.today?.needed ?? body.rule?.answers ?? 5;
  const mu = makeUpLine(body.makeUp, todayKey);
  if (mu) return { text: mu.text, sub: mu.progress, tone: 'open' };
  if (body.today?.paused && !body.today?.done) return { text: 'Today is an exam pause day. Your streak holds.', tone: 'calm' };
  const notice = noticeLine(body, todayKey);
  if (body.today?.done) return { text: notice ? `Today counts. ${notice}` : 'Today counts. See you tomorrow.', tone: 'done' };
  if (notice) return { text: notice, sub: `Answer ${more(Math.max(1, needed - answered))} today and it counts.`, tone: 'calm' };
  const left = Math.max(1, needed - answered);
  if (body.days > 0) return { text: answered > 0 ? `Answer ${more(left)} today and it counts.` : `Answer ${qs(needed)} today and it counts.`, tone: 'today' };
  if (body.best > 0) return { text: `A new streak starts with today. Your best is ${daysWord(body.best)}.`, tone: 'today' };
  return { text: answered > 0 ? `Answer ${more(left)} today to start your streak.` : `Answer ${qs(needed)} today to start your streak.`, tone: 'today' };
}

/**
 * Today's work toward the day counting, as figures for a bar: { answered, needed }. Null when there is nothing to fill:
 * today already counts, today is a pause day, or the server sent no rule. With a day still open (a make-up) the bar is the
 * make-up's own (10 by default), the same figures makeUpLine says in words.
 */
export function todayProgress(body) {
  if (!body || body.today?.done) return null;
  if (body.makeUp?.day) {
    const needed = Math.max(1, Math.round(body.makeUp.needed ?? 10));
    return { answered: Math.max(0, Math.min(needed, Math.round(body.makeUp.answeredToday ?? 0))), needed };
  }
  if (body.today?.paused) return null;
  const needed = Math.round(body.today?.needed ?? body.rule?.answers ?? 0);
  if (!(needed > 0) || needed > 20) return null;
  return { answered: Math.max(0, Math.min(needed, Math.round(body.today?.answered ?? 0))), needed };
}
/** When the student last saw today counted on this device (the block's one small moment is shown once a day). */
export const countedKey = (day) => `mm:streak-counted:${day}:v1`;

/** The next milestone (S6), or the one just reached with its real work: never marks. */
export function milestoneLine(body) {
  if (!body) return null;
  const next = (body.streakMilestones || []).find((m) => !m.done);
  return next ? `Next milestone: ${daysWord(next.at)}, ${next.left === 1 ? '1 day' : `${next.left} days`} to go.` : null;
}
export function milestoneMoment(m) {
  if (!m?.at) return null;
  // Titled as the milestone, not the current run (17 Nov review): the block's head already says today's number.
  return { title: `You reached ${daysWord(m.at)}`, text: `${qs(m.answered ?? 0)} answered since this streak began.` };
}
export const momentKey = (at) => `mm:streak-moment:${at}:v1`;

/** Exam pause days (S8), in words. */
export const PAUSE_TITLE = 'Exam pause days';
export function pauseLine(pause) {
  const max = pause?.max ?? 14;
  const left = Math.max(0, max - (pause?.usedThisSeason ?? 0));
  return `Set days ahead for school exams. Your streak holds on them. You have ${max} a season, and ${left} ${left === 1 ? 'is' : 'are'} left.`;
}
export function pauseSetLine(pause, today) {
  const days = (pause?.days || []).filter((d) => !today || d > today);
  if (!days.length) return null;
  const first = days[0];
  return days.length === 1 ? `1 pause day set: ${weekdayOf(first)} ${Number(first.slice(8))}.` : `${days.length} pause days set, from ${weekdayOf(first)} ${Number(first.slice(8))}.`;
}
export const pauseKey = (n) => (n === 1 ? 'Pause 1 day' : `Pause ${n} days`);
/** After pause days are set or cleared. */
export const pauseDoneLine = (n, set = true) => (set ? (n === 1 ? '1 day paused. Your streak holds on it.' : `${n} days paused. Your streak holds on them.`) : (n === 1 ? 'That day is no longer paused.' : 'Those days are no longer paused.'));

/** The chip's words: the number in figures, the label for a screen reader. */
export const chipLabel = (days, done) => `${STREAK_NAME}, ${daysWord(days)}${done ? ', today counted' : ''}. Opens your streak.`;
