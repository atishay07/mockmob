// The first week on Today: a short chained path, one feature a day, led by the lead card (FEATURE-ADOPTION-2026-10-17
// item 7; owner W-064 and F18: students "did not use 90% of the features" because nothing led them to each one).
// PURE: no I/O, no clock (the caller passes `now`). Every state is a count from the student's own record; a read that did
// not load is unknown, and unknown is never a tick, never a zero and never a lead.
//
// The path (the doc's order: a check then Repair, Revise, smart practice, the first full mock; the Lab and the plan after):
//   day 1  start    Find, then fix: the starting set of 10, then one Repair.
//   day 2  revise   Revise brings back what the set got wrong.
//   day 3  aim      Practice aimed at the weakest chapter (smart practice on Pro).
//   day 4  spread   A first set in a second subject.
//   day 5  mock     The first full mock.
//   day 6  lab      Repair what that mock found.
//   day 7  plan     Change plan: the date, the study days, the mocks.
// Each step is a real action the product already has, and each says how it is known to be done:
//   start   a saved session, and a Repair made (or no open mistake left to repair)
//   revise  Revise used: a question asked there today, or an active card above box 1 (a right recall moved it up)
//   aim     a second saved session (a set after the starting one; the step leads with the aimed set, any set counts)
//   spread  papers in two different subjects
//   mock    a saved full or NTA mock
//   lab     a Repair saved on the newest mock
//   plan    a date, a mock target or study days saved on the account
//
// The clock is the first scored session (the rhythm's `first_scored_session`; the account's start date is not among the
// reads Today makes). A student with nothing saved is on day 1; after day 7 the path is gone.
//
// It leads with TODAY's step only: the lead card shows it while it is undone and the product can do it now; a step passed
// by stays quietly open on the rail and is never nagged. It never replaces a session waiting to be finished, a check, the
// finished-for-today card or a failed read (KEEPS_THE_LEAD). When every step that applies is done the path disappears.
import { openMistakes, firstWeekDay } from './move.mjs';
import { choiceMoves, leadOf } from './lead.mjs';
import { roadFigures } from './road.mjs';
import { todayKeyIn } from './week.mjs';
import { FIRST_TIMED_COPY, firstTimedMockHref, shortestTimedPaper } from '../../../data/first_timed_mock.js';

export const FIRST_WEEK_DAYS = 7;

/** The regular moves the path never replaces. */
export const KEEPS_THE_LEAD = Object.freeze(['resume', 'check', 'done', 'failed', 'returning']);

/** The steps in order, each due on its own day. `name` is what a screen reader hears. */
export const FIRST_WEEK_STEPS = Object.freeze([
  { id: 'start', day: 1, name: 'Find and fix' },
  { id: 'revise', day: 2, name: 'Revise' },
  { id: 'aim', day: 3, name: 'Weak chapters' },
  { id: 'spread', day: 4, name: 'A second subject' },
  { id: 'mock', day: 5, name: 'First full mock' },
  { id: 'lab', day: 6, name: 'Repair from your mock' },
  { id: 'plan', day: 7, name: 'Plan your weeks' },
]);

/** The id of the step due on a day of the first week (1 to 7), or null. */
export const stepOfDay = (day) => FIRST_WEEK_STEPS.find((s) => s.day === day)?.id ?? null;

const whole = (n) => Number.isInteger(n) && n >= 0;
const pills = () => ({ length: true, second: 'else' });
const newestMock = (papers) => (Array.isArray(papers) ? papers.find((p) => p && ['full', 'nta'].includes(p.mode)) || null : null);

/** The day of the first week (1 to 7) the student is on, or null (past it, or not known). `from` says where the clock came from. */
export function firstWeekClock({ firstAt = null, sessions = null, papers = null, now = Date.now() } = {}) {
  if (!whole(sessions)) return { day: null, from: null };
  if (sessions === 0) return { day: 1, from: 'none' };
  if (Number.isFinite(Date.parse(firstAt || ''))) return { day: firstWeekDay(firstAt, now), from: 'session' };
  // No scored-session mark (the rhythm counts a session from 5 answers): the oldest paper, when every session is in the list.
  if (Array.isArray(papers) && papers.length === sessions) {
    const oldest = papers.map((p) => Number(p?.completedAt)).filter(Number.isFinite).sort((a, b) => a - b)[0];
    if (Number.isFinite(oldest)) return { day: firstWeekDay(new Date(oldest).toISOString(), now), from: 'paper' };
  }
  return { day: null, from: null };
}

/**
 * Revise has been used, from GET /api/me/revise: a question asked today (`answeredToday`), or an active card above box 1 (`boxes`, the
 * counts for boxes 1 to 4: a right recall moves a card up, a wrong one drops it back). Unknown (null) when the body has no box counts and
 * nothing was asked today; false when the counts say every card is still in box 1.
 */
export function reviseRecalled(body) {
  if (Number.isInteger(body?.answeredToday) && body.answeredToday > 0) return true;
  const boxes = Array.isArray(body?.boxes) && body.boxes.length >= 2 && body.boxes.every((n) => Number.isInteger(n)) ? body.boxes : null;
  return boxes ? boxes.slice(1).some((n) => n > 0) : null;
}

/** Open mistakes across the papers read (a repaired one is never counted), or null when either read is unknown. */
function openTotal(papers, repaired) {
  if (!Array.isArray(papers) || !(repaired instanceof Map)) return null;
  let n = 0;
  for (const p of papers) {
    const open = openMistakes(p, repaired);
    if (open == null) return null;
    n += open;
  }
  return n;
}

// ---------- What each step needs and when it counts as done: { done, ready, na? } (null = unknown) ----------

function startState(c) {
  if (!whole(c.sessions)) return { done: null, ready: true };
  if (c.sessions === 0) return { done: false, ready: true };
  if (whole(c.repairs) && c.repairs >= 1) return { done: true, ready: true };
  const open = openTotal(c.papers, c.repaired);
  if (open === 0) return { done: true, ready: true }; // a clean first set: nothing to fix
  if (open == null) return { done: null, ready: true };
  return { done: false, ready: true };
}

function reviseState(c) {
  const r = c.revise && typeof c.revise === 'object' ? c.revise : null;
  if (!r) return { done: null, ready: null };
  return { done: r.recalled === true ? true : r.recalled === false ? false : null, ready: whole(r.due) ? r.due > 0 : null };
}

const aimState = (c) => ({ done: whole(c.sessions) ? c.sessions >= 2 : null, ready: true });

function spreadState(c) {
  const mine = Array.isArray(c.subjects) ? [...new Set(c.subjects.filter(Boolean))] : null;
  if (!mine) return { done: null, ready: null };
  if (mine.length < 2) return { done: false, ready: false, na: true }; // one subject: nothing to spread to
  if (!Array.isArray(c.papers)) return { done: null, ready: true };
  const seen = new Set(c.papers.map((p) => p?.subject).filter(Boolean));
  return { done: seen.size >= 2, ready: mine.some((s) => !seen.has(s)) };
}

const mockState = (c) => ({ done: whole(c.mocks) ? c.mocks >= 1 : null, ready: Boolean(shortestTimedPaper()) });

function labState(c) {
  if (!whole(c.mocks)) return { done: null, ready: null };
  if (c.mocks === 0) return { done: false, ready: false };
  if (!Array.isArray(c.papers) || !(c.repaired instanceof Map)) return { done: null, ready: null };
  const mock = newestMock(c.papers);
  if (!mock) return { done: null, ready: null }; // saved, but not among the newest papers read
  if ((c.repaired.get(mock.id) || 0) >= 1) return { done: true, ready: true };
  const open = openMistakes(mock, c.repaired);
  return { done: false, ready: whole(open) ? open > 0 : null };
}

function planState(c) {
  if (c.planSaved === true) return { done: true, ready: true };
  const road = c.road && typeof c.road === 'object' ? c.road : null;
  const days = Array.isArray(c.weekdays) && c.weekdays.length > 0;
  const set = Boolean(road && (road.examDate || Number.isInteger(road.mockTarget))) || days;
  // The road unread and no study days saved: it is not known whether a plan exists.
  if (!road && !days) return { done: null, ready: null };
  return { done: set, ready: true };
}

const STATE = { start: startState, revise: reviseState, aim: aimState, spread: spreadState, mock: mockState, lab: labState, plan: planState };

// ---------- The lead each step makes (a whole move, as the lead card draws it) ----------

const mark = (move, step, day) => (move ? { ...move, overline: `Day ${day} of your first week`, firstWeek: day, step: step.id } : null);
const pick = (moves, id) => (Array.isArray(moves) ? moves.find((m) => m && m.id === id) || null : null);

function reviseLead(c) {
  return pick(choiceMoves({ revise: c.revise, subjectName: c.subjectName, now: c.now }), 'revise');
}

function aimLead(c) {
  const last = c.papers?.[0] || null;
  const subject = last?.subject || c.firstSubject || null;
  if (c.premium) {
    const sessions = whole(c.sessions) ? c.sessions : 0;
    const name = subject && c.subjectName ? `${c.subjectName(subject)} ` : '';
    return leadOf({
      id: 'smart', overline: 'Up next', number: 15, label: 'questions from your weak chapters',
      why: `Smart practice picks questions from the chapters where your ${name}marks went, from ${sessions} saved ${sessions === 1 ? 'session' : 'sessions'}.`,
      key: { label: 'Start smart practice', href: `/dashboard?${subject ? `subject=${encodeURIComponent(subject)}&` : ''}mode=smart`, minutes: 15 },
      pills: pills(), art: 'object', subject,
    }, { now: c.now });
  }
  const weakest = pick(choiceMoves({ papers: c.papers, facts: c.facts, repaired: c.repaired, top: c.top, subjectName: c.subjectName, firstSubject: c.firstSubject, length: c.length || 10, now: c.now }), 'weakest');
  if (weakest) return weakest;
  return leadOf({
    id: 'practice', overline: 'Up next', number: 10, label: 'practice questions',
    why: 'Marked +5 and −1, the CUET way. Each miss waits in Review with its explanation.',
    key: { label: 'Start 10 questions', href: '/dashboard?mode=quick&count=10', minutes: 10 },
    pills: pills(), art: 'object', subject,
  }, { now: c.now });
}

function spreadLead(c) {
  const seen = new Set((c.papers || []).map((p) => p?.subject).filter(Boolean));
  const untouched = (c.subjects || []).filter((s) => s && !seen.has(s));
  if (!untouched.length) return null;
  const made = pick(choiceMoves({ papers: [], subjects: untouched, firstSubject: null, subjectName: c.subjectName, now: c.now }), 'another');
  if (!made) return null;
  const name = c.subjectName ? c.subjectName(untouched[0]) : untouched[0];
  // The label stays short (a catalogue name such as "Economics / Business Economics" would wrap to four lines beside the number); the subject is named in the reason.
  return { ...made, label: 'questions in a second subject', why: `${name} is one of your subjects. Ten questions show where it stands, marked +5 and −1, the CUET way.` };
}

function mockLead(c) {
  const paper = shortestTimedPaper();
  if (!paper) return null;
  const subject = c.facts?.subject || c.papers?.[0]?.subject || c.firstSubject || null;
  return leadOf({
    id: 'firstMock', overline: 'Up next', number: paper.questions, label: `questions in ${paper.minutes} minutes`,
    why: `Your first full mock, timed like the real paper. It ${FIRST_TIMED_COPY.unlocks}`,
    key: { label: 'Start a timed mock', href: firstTimedMockHref(subject, paper), minutes: paper.minutes },
    pills: pills(), art: 'object', subject,
  }, { now: c.now });
}

function labLead(c) {
  const mock = newestMock(c.papers);
  if (!mock) return null;
  const made = pick(choiceMoves({ papers: [mock], repaired: c.repaired, subjectName: c.subjectName, now: c.now }), 'repair');
  return made ? { ...made, title: 'Repair what your mock found' } : null;
}

function planLead(c) {
  const today = todayKeyIn(c.timeZone || 'Asia/Kolkata', c.now);
  const fig = roadFigures({ today, plan: c.road || {}, goal: Number(c.daysPerWeek) > 0 ? Number(c.daysPerWeek) : null, taken: whole(c.mocks) ? c.mocks : null });
  const count = fig.phase === 'window' ? null : fig.phase === 'days' ? fig.days : fig.weeks;
  const unit = fig.phase === 'days' ? (fig.days === 1 ? 'day' : 'days') : (fig.weeks === 1 ? 'week' : 'weeks');
  return leadOf({
    id: 'plan', overline: 'Up next', title: 'Plan your weeks to CUET', number: count, label: count == null ? '' : `${unit} to ${fig.own ? 'your date' : 'CUET UG'}`,
    why: 'Pick your exam date, the days you can study and how many full mocks to take. It takes three taps, and you can change it any day.',
    // The key opens Change plan on this page (the lead card draws a button for `action: 'plan'`); the href is only where a plain link would land.
    key: { label: 'Plan my weeks', href: '#road', action: 'plan', minutes: null },
    pills: { length: false, second: 'else' }, art: 'glyph', subject: null,
  }, { now: c.now });
}

const LEAD = { revise: reviseLead, aim: aimLead, spread: spreadLead, mock: mockLead, lab: labLead, plan: planLead }; // `start` leads with the regular move

const markState = (row, day) => (row.na ? 'na' : row.done === true ? 'done' : row.step.day === day ? 'today' : row.step.day < day ? 'open' : 'ahead');

/**
 * The path for today, or null (not in the first week, not known, or every step that applies is done).
 *   now, firstAt, sessions, papers, repaired, repairs, mocks, revise, road, weekdays, subjects, planSaved    the reads
 *   top, facts, firstSubject, premium, length, subjectName, daysPerWeek, timeZone                              for the moves
 *   firstAt    the first scored session (ISO), from the rhythm's milestones
 *   sessions   saved sessions; repairs  Repairs made; mocks  saved full or NTA mocks
 *   revise     { due, dueTotal, recalled, ... } (Today's Revise read, `recalled` true or false or null)
 *   road       { examDate, mockTarget }; weekdays  the chosen study days, null when none, undefined when unread
 * Returns { day, steps: [{ id, day, name, state, done }], done, total, today, step, move }: the rail's marks (`state` is
 * done, today, open, ahead or na), the counts, today's step, and the lead it makes (null when it should not lead).
 */
export function firstWeekPath(c = {}) {
  const { day } = firstWeekClock(c);
  if (!day) return null;
  const rows = FIRST_WEEK_STEPS.map((step) => ({ step, ...STATE[step.id](c) }));
  const live = rows.filter((r) => !r.na);
  if (live.length && live.every((r) => r.done === true)) return null;
  const today = rows.find((r) => r.step.day === day);
  const lead = today && today.done === false && today.ready === true && LEAD[today.step.id] ? mark(LEAD[today.step.id](c), today.step, day) : null;
  return {
    day,
    steps: rows.map((r) => ({ id: r.step.id, day: r.step.day, name: r.step.name, state: markState(r, day), done: r.done === true, ready: r.ready === true })),
    done: live.filter((r) => r.done === true).length,
    total: live.length,
    today: today?.step.id || null,
    step: lead ? today.step.id : null,
    move: lead,
  };
}

/** The lead on the card: the path's move, except where the regular move keeps the lead. `regular` null (still loading) stays null. */
export function withFirstWeek(regular, stepped) {
  if (!regular || !stepped) return regular ?? null;
  return KEEPS_THE_LEAD.includes(regular.id) ? regular : stepped;
}

/** One sentence for a screen reader: "Your first week, day 3. 2 of 7 steps done: Find and fix, Revise. Today: Weak chapters." */
export function railLine(path) {
  if (!path?.day) return '';
  const names = path.steps.filter((s) => s.state === 'done').map((s) => s.name);
  const todays = path.steps.find((s) => s.state === 'today');
  return `Your first week, day ${path.day}. ${path.done} of ${path.total} steps done${names.length ? `: ${names.join(', ')}` : ''}.${todays ? ` Today: ${todays.name}.` : ''}`;
}

/**
 * Whether the move on the lead card is today's step of the path (F18, release 9). Only then does the card's overline say the day
 * ("Day 3 of your first week"); a check, a session waiting, a returning card, the student's own pick, or a regular move that leads
 * because today's step is done or cannot run now, says "Up next" and the rail names today's step instead. Day 1's step (find, then
 * fix) is led by the regular move itself (the starting set or the first Repair), so it counts while that step is undone.
 */
export function pathLeads(path, move, { picked = false } = {}) {
  if (!path?.day || !move || picked || KEEPS_THE_LEAD.includes(move.id) || move.id === 'done') return false;
  if (path.step) return move.step === path.step;
  const today = path.steps?.find((s) => s.day === path.day);
  return path.day === 1 && today?.id === 'start' && today.state !== 'done';
}

/**
 * The one line under the rail that makes it read as a path (F18): it always names today's step, and what comes next.
 *   leads   the card shows today's step: "Tomorrow: A second subject." (the overline already says the day and the title the step)
 *   else    "Day 3 of 7: Weak chapters next." when the step is ready behind another move (a check, a pick); ", done." when it is
 *           done; the step's name alone when it cannot run yet; the day alone when it does not apply
 * The last day says so instead of a tomorrow. '' with no path.
 */
export function railCaption(path, leads = false) {
  if (!path?.day) return '';
  const steps = Array.isArray(path.steps) ? path.steps : [];
  const today = steps.find((s) => s.day === path.day) || null;
  const ahead = steps.find((s) => s.day > path.day && s.state !== 'na' && !s.done) || null;
  const next = ahead ? (ahead.day === path.day + 1 ? `Tomorrow: ${ahead.name}.` : `Day ${ahead.day}: ${ahead.name}.`) : path.day >= FIRST_WEEK_DAYS ? 'The last step of your first week.' : '';
  if (leads) return next || 'The last step of your first week.';
  const of = `Day ${path.day} of ${FIRST_WEEK_DAYS}`;
  if (!today || today.state === 'na') return `${of}.${next ? ` ${next}` : ''}`;
  if (today.done) return `${of}: ${today.name}, done.${next ? ` ${next}` : ''}`;
  return today.ready ? `${of}: ${today.name} next.` : `${of}: ${today.name}.${next ? ` ${next}` : ''}`;
}
