// Progress, 19 Nov 2026 (lane arena-a): the week you are in as bubbles first, the finished weeks as one row of week marks,
// the record as one row of four figures. Pure: every figure here is one the page already reads (GET /api/me/rhythm,
// GET /api/me/streak, GET /api/recovery); nothing is estimated, and no percentage is drawn from fewer than five answers.

/** The fewest answers a percentage is drawn from. Fewer, and the figure is the plain count. */
export const MIN_ANSWERS_FOR_SHARE = 5;

/**
 * This week's seven days (rhythmView buildWeek: Monday to Sunday) as the streak's bubble looks. A counted study day is a
 * filled bubble, today (not counted yet) is ringed in ink, a day ahead is faint, a past day with nothing is a plain ring.
 * The streak's own read (its last seven days) adds only what the week cannot say: a rest pass kept the day, or the day was
 * paused for exams. It never adds a tick, so the bubbles and "2 of 4 study days" always agree.
 */
export function weekMarks(week, streakBody = null) {
  const days = Array.isArray(week) ? week : [];
  const streak = new Map();
  for (const d of Array.isArray(streakBody?.week) ? streakBody.week : []) if (d?.day) streak.set(d.day, d.state);
  return days.map((d) => {
    let look = d.state === 'counted' ? 'done' : d.isToday ? 'today' : 'none';
    let said = d.chip;
    if (d.state !== 'counted') {
      const s = streak.get(d.key);
      if (s === 'rested') { look = 'rested'; said = `${d.label}, a rest pass kept your streak`; }
      else if (s === 'paused' || (d.isToday && streakBody?.today?.paused)) { look = 'paused'; said = `${d.label}, paused for exams`; }
    }
    return { key: d.key, look, ahead: d.state === 'ahead', today: Boolean(d.isToday), name: d.isToday ? 'Today' : d.name.slice(0, 1), said };
  });
}

/** The goal line beside the bubbles: the existing figure ("2 of 4") and its words, split so the figure can be set large. */
export function weekGoal(rhythm) {
  if (!rhythm) return null;
  const days = Number(rhythm.studyDays) || 0;
  const goal = Number(rhythm.daysGoal) || 0;
  return { figure: `${days} of ${goal}`, words: goal === 1 ? 'study day this week' : 'study days this week', met: Boolean(rhythm.metThisWeek) };
}

/**
 * The finished weeks (rhythmView buildRibbon, oldest first, this week last) as one row of marks, newest right. This week is
 * left out: it is the bubbles above. Each mark is a shape and a word: met (a tick), paused (a bar) or not met (the days it
 * had); the word is the ribbon's own sentence. The heading carries the count over its denominator, as before.
 */
export function finishedWeeks(ribbon) {
  const all = Array.isArray(ribbon) ? ribbon : [];
  const closed = all.filter((w) => !w.current);
  const met = closed.filter((w) => w.met).length;
  const title = closed.length === 0 ? 'Your first week'
    : `Goal met in ${met} of ${all.length >= 12 ? `the last ${closed.length}` : `your ${closed.length}`} finished week${closed.length === 1 ? '' : 's'}`;
  return {
    title,
    marks: closed.map((w) => ({ key: w.key, kind: w.met ? 'met' : w.paused ? 'paused' : 'missed', days: w.days, words: w.words })),
  };
}

/** A figure's value and what it is out of. */
const fig = (label, value, note, extra = {}) => ({ label, value, note, ...extra });

/**
 * Your record so far as four figures, each with its denominator. "Answered right" is a percentage only from five answers
 * up; under that it is the plain count ("3 of 4"); with none recorded it says so (never a zero for unknown).
 */
export function recordFigures({ sessions = 0, answered = 0, correct = 0, checks = 0, playbook = 0 } = {}) {
  const right = answered >= MIN_ANSWERS_FOR_SHARE
    ? fig('Answered right', `${Math.round((correct / answered) * 100)}%`, `${correct} of ${answered} answers`, { share: Math.max(0, Math.min(1, correct / answered)) })
    : answered > 0 ? fig('Answered right', `${correct} of ${answered}`, `Too few answers for a percentage`)
      : fig('Answered right', 'None yet', 'No answers recorded');
  return [
    fig('Practice sessions', sessions, `${answered} questions answered`),
    right,
    fig('Concept checks', checks, checks ? 'with delayed checks' : 'None completed yet'),
    fig('Playbook entries', playbook, playbook ? 'saved from results' : 'None saved yet'),
  ];
}
