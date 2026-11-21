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
  // Today, not counted yet (21 Nov 2026 critic: "Today: today" said nothing). Once it counts, today's look is 'done': "Today: counted".
  today: 'not counted yet',
  none: 'no practice',
  ahead: 'still to come',
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
  // 19 Nov 2026: the words follow the line's drawing (StreakLine), not the old bubbles.
  if (marks.some((m) => m.look === 'rested')) parts.push('Moon and stripes: a rest pass kept the day.');
  if (marks.some((m) => m.look === 'made_up')) parts.push('Ring: a day you made up.');
  if (marks.some((m) => m.look === 'paused')) parts.push('Dashed line: an exam pause day.');
  if (marks.some((m) => m.look === 'open')) parts.push('Dashed ring: a day still open.');
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
export function milestoneMoment(m, days = null) {
  if (!m?.at) return null;
  // Titled as the milestone, not the current run (17 Nov review): the block's head already says today's number. The moment
  // shows for up to two days after the milestone (TodayStreak), so once the run is past it, it is said in the past (21 Nov
  // 2026 critic: "30 You reached 30 days" beside "31 days in a row" read as two different numbers).
  const past = Number.isFinite(Number(days)) && Number(days) > m.at;
  return { title: `${past ? 'You passed' : 'You reached'} ${daysWord(m.at)}`, text: `${qs(m.answered ?? 0)} answered since this streak began.` };
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

// ---------- 19 Nov 2026 (owner: "streaks are only implemented if they are useful"): one unbroken line to exam day ----------
// The streak is drawn as one volt highlighter band under every run of kept days (StreakLine), and it says what the line has
// made and what it will make by CUET. Arithmetic about question counts only, never a promise about marks.

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayNum = (key) => Number(key.slice(8, 10));
const fmt = (n) => Number(n).toLocaleString('en-IN');
const qsN = (n) => (n === 1 ? '1 question' : `${fmt(n)} questions`);

/**
 * The last `n` days for the line, oldest first: [{ day, look, name, initial, num, label, today }]. Built from the server's
 * calendar (two months) with today from the week, so 14 days carry the same looks as the 7 of streakWeek. Fewer days than
 * asked when the calendar does not reach back that far.
 */
export function streakDays(body, n = 7) {
  const week = streakWeek(body);
  if (!week.length) return [];
  if (n <= week.length) return week.slice(week.length - n).map(withShort);
  const todayKey = week[week.length - 1].day;
  const cal = new Map((Array.isArray(body?.calendar) ? body.calendar : []).map((d) => [d.day, d.state]));
  const inWeek = new Map(week.map((m) => [m.day, m]));
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const day = addDays(todayKey, -i);
    if (inWeek.has(day)) { out.push(withShort(inWeek.get(day))); continue; }
    if (!cal.has(day)) continue;
    const look = LOOK[cal.get(day)] || 'none';
    out.push(withShort({ day, look, name: weekdayOf(day).slice(0, 3), today: false, label: `${weekdayOf(day)} ${dayNum(day)} ${MONTH_SHORT[Number(day.slice(5, 7)) - 1]}: ${WEEK_STATES[look]}` }));
  }
  return out;
}
const withShort = (m) => ({ ...m, initial: m.today ? 'Today' : m.name.slice(0, 1), num: dayNum(m.day) });

/**
 * This month as the sheet's calendar: { title, lead, days } — `lead` blank cells before the 1st (weeks start on Monday), and
 * each day with its look; days after today are 'ahead' (or 'paused' when a pause day is set on them).
 */
export function streakMonth(body) {
  const week = streakWeek(body);
  if (!week.length) return null;
  const todayKey = week[week.length - 1].day;
  const month = todayKey.slice(0, 7);
  const days = [];
  for (const d of Array.isArray(body?.calendar) ? body.calendar : []) {
    if (!d?.day || d.day.slice(0, 7) !== month) continue;
    let look;
    if (d.day === todayKey) look = week[week.length - 1].look;
    else if (d.day > todayKey) look = d.state === 'paused' ? 'paused' : 'ahead';
    else look = LOOK[d.state] || 'none';
    days.push({ day: d.day, look, today: d.day === todayKey, name: String(dayNum(d.day)), initial: String(dayNum(d.day)), num: dayNum(d.day), label: `${d.day === todayKey ? 'Today, ' : ''}${weekdayOf(d.day)} ${dayNum(d.day)}: ${WEEK_STATES[look]}` });
  }
  if (!days.length) return null;
  const lead = (new Date(`${days[0].day}T00:00:00Z`).getUTCDay() + 6) % 7;
  const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return { title: `${MONTHS_LONG[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`, lead, days };
}

/** What this streak has made: "142 questions answered in this streak." Only with a run and real answers in it. */
export function runLine(body) {
  const answered = Math.round(Number(body?.run?.answered) || 0);
  if (!(body?.days >= 1) || answered <= 0) return null;
  return `${qsN(answered)} answered in this streak.`;
}

/** 'Sat 1 May 2027' for a day key, its spaces unbreakable so the date never splits across lines. */
export const examWords = (key) => [weekdayOf(key).slice(0, 3), dayNum(key), MONTH_SHORT[Number(key.slice(5, 7)) - 1], key.slice(0, 4)].join(' ');

/**
 * What the line makes by CUET at today's rule: "At 5 questions a day, that is 815 more before CUET (expected Sat 1 May 2027)."
 * From 3 days in a row, only with an exam day still ahead (the same date Road to CUET shows: the student's own, else the
 * expected window's first day). The days counted are today (unless it already counts) up to the day before the exam.
 * Never zero or negative; null when any figure is missing.
 */
export function paceLine(body, { examDay = null, today = null, own = false } = {}) {
  const todayKey = today || body?.week?.[body.week.length - 1]?.day || null;
  const needed = Math.round(Number(body?.today?.needed ?? body?.rule?.answers) || 0);
  if (!(body?.days >= 3) || !todayKey || !examDay || !(needed > 0)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(examDay) || examDay <= todayKey) return null;
  const between = Math.round((Date.parse(`${examDay}T00:00:00Z`) - Date.parse(`${todayKey}T00:00:00Z`)) / DAY_MS);
  const daysLeft = between - (body?.today?.done ? 1 : 0);
  const total = daysLeft * needed;
  if (!(total > 0)) return null;
  return `At ${qsN(needed)} a day, that is ${fmt(total)} more before CUET (${own ? '' : 'expected '}${examWords(examDay)}).`;
}

/** The streak's daily set: today's included Quick set (src/lib/firstSet.mjs FIRST_SET_HREF), the quickest practice start. */
export const KEEP_SET = 10;
export const KEEP_PRACTICE_HREF = `/dashboard?mode=quick&count=${KEEP_SET}`;
export const KEEP_DAILY_HREF = '/daily';

/**
 * The one tap that keeps the line, when today does not count yet: { kind, label, href } or null. Every start here counts by the
 * server's rule (ruleLine): a whole Daily Five makes a day, and a finished practice set's answers count. `daily` is whether
 * today's Daily Five is still to play on this account ('open' | 'begun' | 'played' | null for unknown). A day still open (a
 * make-up) needs 10 answers, more than a Daily Five holds, so it always starts a practice set.
 */
export function keepAction(body, { daily = null } = {}) {
  if (!body || body.today?.done) return null;
  if (body.today?.paused && !body.makeUp?.day) return null;
  if (body.makeUp?.day) {
    // The key says the one number the student owes (21 Nov 2026 critic: "Answer 6 more: start 10 questions" read as two
    // debts). The set it starts is Quick practice's smallest size that covers it (data/test_modes.js quick.countOptions:
    // 5, 10, 15, 20), so finishing it always answers enough.
    const left = Math.max(1, (body.makeUp.needed ?? 10) - (body.makeUp.answeredToday ?? 0));
    const set = Math.min(20, Math.max(5, Math.ceil(left / 5) * 5));
    return { kind: 'practice', label: `Answer ${left} more today`, href: `/dashboard?mode=quick&count=${set}` };
  }
  // 21 Nov 2026 (owner LK365, DAILY-SPEC): the five are the streak's daily unit, "Your five for today" on /daily.
  if (daily === 'open') return { kind: 'daily', label: 'Do today’s five', href: KEEP_DAILY_HREF };
  if (daily === 'begun') return { kind: 'daily', label: 'Finish today’s five', href: KEEP_DAILY_HREF };
  return { kind: 'practice', label: `Start ${KEEP_SET} practice questions`, href: KEEP_PRACTICE_HREF };
}

/** The earning moment where the work ends (Daily Five's end, a practice result): "Today counts. 13 days in a row." */
export function countedLine(body) {
  if (!body?.today?.done || !(body.days > 0)) return null;
  return `Today counts. ${body.days === 1 ? '1 day in a row' : `${body.days} days in a row`}.`;
}

/** The chip's words: the number in figures, the label for a screen reader. */
export const chipLabel = (days, done) => `${STREAK_NAME}, ${daysWord(days)}${done ? ', today counted' : ''}. Opens your streak.`;

// ---------- 21 Nov 2026 (owner LK365: "make the streak way better and actually worth using"): what it did, and where it ends ----------

/** "What 12 days made" (the sheet's one section about the streak's work). */
export const madeTitle = (days) => `What ${daysWord(Math.max(1, Math.round(Number(days) || 1)))} made`;

/**
 * The figures under it, from the server's own counts for the current run (computeChain: run.answered, practised, rested, madeUp,
 * paused; each resets with the run). Questions first, always while there is a run; the others only when above zero.
 * [{ key, n, label }] — empty with no run.
 */
export function madeFigures(body) {
  if (!(body?.days >= 1)) return [];
  const n = (v) => Math.max(0, Math.round(Number(v) || 0));
  const out = [];
  const answered = n(body.run?.answered);
  out.push({ key: 'answered', n: answered, label: answered === 1 ? 'question answered' : 'questions answered' });
  const practised = n(body.practised);
  if (practised > 0) out.push({ key: 'practised', n: practised, label: practised === 1 ? 'day you practised' : 'days you practised' });
  const rested = n(body.rested);
  if (rested > 0) out.push({ key: 'rested', n: rested, label: rested === 1 ? 'day kept by a rest pass' : 'days kept by rest passes' });
  const madeUp = n(body.madeUp);
  if (madeUp > 0) out.push({ key: 'made_up', n: madeUp, label: madeUp === 1 ? 'day made up' : 'days made up' });
  const paused = n(body.paused);
  if (paused > 0) out.push({ key: 'paused', n: paused, label: paused === 1 ? 'exam pause day' : 'exam pause days' });
  return out;
}

/**
 * The finish line, one line with the week: "161 days to CUET. Keep it to exam day." With the expected window's first day
 * (the student set no date of their own, the same date Road to CUET shows), it says "About". Null with no exam day ahead.
 */
export function finishLine({ examDay = null, today = null, own = false } = {}) {
  if (!today || !examDay || !/^\d{4}-\d{2}-\d{2}$/.test(examDay) || !/^\d{4}-\d{2}-\d{2}$/.test(today) || examDay <= today) return null;
  const left = Math.round((Date.parse(`${examDay}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
  if (!(left > 0)) return null;
  return `${own ? '' : 'About '}${left === 1 ? '1 day' : `${fmt(left)} days`} to CUET. Keep it to exam day.`;
}

/** Today in the head pill's few words: "Today counts", "2 of 5 today", "4 of 10 today" (a make-up), "Pause day". */
export function todayShort(body) {
  if (!body) return null;
  if (body.today?.done) return 'Today counts';
  const bar = todayProgress(body);
  if (bar) return `${bar.answered} of ${bar.needed} today`;
  if (body.today?.paused) return 'Pause day';
  return null;
}

/**
 * The moment it grows: what this device last saw of the streak ({ d: days, t: today counted }), so the number steps up once
 * when it rises (at the end of a set, or the next visit after practice elsewhere). Stored per account.
 */
export const seenKey = (userId) => `mm:streak-seen:${userId}:v1`;
export const writeSeen = (days, done) => JSON.stringify({ d: Math.max(0, Math.round(Number(days) || 0)), t: Boolean(done) });
export function readSeen(raw) {
  try {
    const v = JSON.parse(raw || 'null');
    return v && Number.isFinite(v.d) && v.d >= 0 ? { d: Math.round(v.d), t: Boolean(v.t) } : null;
  } catch { return null; }
}
/** The number to step up from, or null: only when this device saw a smaller number before and the streak rose since. */
export function grewFrom(prev, now) {
  if (!prev || !now || !Number.isFinite(now.days)) return null;
  return now.days > prev.d ? prev.d : null;
}
