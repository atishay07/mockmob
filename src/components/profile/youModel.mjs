// The You hub and the pages under it: pure rules (web IA plan 2.2 You, packet IA7).
//
// No React, no browser: unit tested in data/tests/you.test.mjs. The pages keep to markup and fetches,
// and every rule that decides what a student reads lives here, so a test can hold it.
//
//   goal      the weekly goal control: what the server says, what a save sends (a pause is kept), the
//             words for every outcome. "Saved" is said only after the server confirmed it.
//   startOn   the "Start on" setting (Today or Practice), kept on this device
//   bests     Personal bests from /api/me/bests: mocks only, observed marks with their denominators
//   board     the Leaderboard: real students first and ranked among themselves; simulated rivals apart
//   upload    Contribute questions: the two tabs and the status words
//   rows      the rows of the You hub, read from src/lib/navigation.js so the nav and the hub agree
//
// Copy rules: sentence case, no "!", no em dash, no middle dots, 12-hour times.
import { DEFAULT_START_ON, START_ON_KEY, START_ON_OPTIONS, placeContents } from '../../lib/navigation.js';
import { APPROVED, UPLOAD_STATUS } from '../../../data/glossary.mjs';
import { subjectName } from '../../../data/subject_art.mjs';
import { contributionState } from '../../../data/contribution_ui.js';
import { contributionRewardLine } from '../../../data/plan_facts.mjs';

// ---------------------------------------------------------------------------------------------
// Weekly goal (the app's Weekly goal screen: you/goal/goal_screen.dart, you/copy.dart)

export const GOAL_PATH = '/api/me/goal';
export const GOAL_DAYS = Object.freeze([1, 2, 3, 4, 5, 6, 7]);

export const GOAL_COPY = Object.freeze({
  title: 'Weekly goal',
  question: 'How many days a week do you want to study?',
  counts: 'A study day is a day you finish a practice, a mock or a repair.',
  save: 'Save goal',
  saving: 'Saving',
  loadFailedTitle: 'We could not load your goal',
  loadFailedBody: 'Check your connection and try again.',
  retry: 'Try again',
  notChosen: 'You have not chosen a goal yet. Today plans with 4 days until you do.',
  everyDay: 'Every day of the week. There are no rest days at this goal.',
});

/** "4 days a week" / "1 day a week". */
export function goalLine(days) {
  return `${days} ${days === 1 ? 'day' : 'days'} a week`;
}

/** The split under the picker: "4 study days and 3 rest days." Seven days has no rest days. */
export function goalSplitLine(days) {
  const study = Math.min(7, Math.max(1, Math.trunc(Number(days) || 0)));
  if (study >= 7) return GOAL_COPY.everyDay;
  const rest = 7 - study;
  return `${study} study ${study === 1 ? 'day' : 'days'} and ${rest} rest ${rest === 1 ? 'day' : 'days'}.`;
}

/**
 * What the server said about the goal, or null when it said nothing usable.
 * `set: false` is an explicit "no goal chosen yet" (an older server sends no `set`: the days in force are the goal).
 */
export function goalFromServer(body) {
  const days = body?.daysPerWeek;
  if (!Number.isInteger(days) || days < 1 || days > 7) return null;
  return { days, set: body.set !== false, pausedUntil: typeof body.pausedUntil === 'string' ? body.pausedUntil : null };
}

const dayKey = (now) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** The pause date while it is still ahead (today counts), else null. */
export function activePause(pausedUntil, now = Date.now()) {
  if (typeof pausedUntil !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(pausedUntil)) return null;
  return pausedUntil >= dayKey(now) ? pausedUntil : null;
}

/**
 * The body of a goal save. The server replaces the whole row, so a pause made in the app must be sent back
 * or saving would end it ("Changing the goal keeps the pause").
 */
export function goalSaveBody(days, pausedUntil, now = Date.now()) {
  return { daysPerWeek: days, pausedUntil: activePause(pausedUntil, now) };
}

/** "Rhythm is paused until 2 Nov. Changing the goal keeps the pause." or null. */
export function goalPauseLine(pausedUntil, now = Date.now()) {
  const until = activePause(pausedUntil, now);
  if (!until) return null;
  const [y, m, d] = until.split('-').map(Number);
  const text = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `Rhythm is paused until ${text}. Changing the goal keeps the pause.`;
}

/** "4:30 PM": 12-hour, with an ordinary space. */
export function formatTime12(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).format(date).replace(/[  ]/g, ' ');
}

/** The line after a save the server confirmed. Never used before the answer arrives. */
export function goalSavedLine(date = new Date()) {
  return `Goal saved at ${formatTime12(date)}.`;
}

/** The line for a save that did not happen. Nothing was changed in every case. */
export function goalErrorLine(error) {
  if (error?.kind === 'network') return 'We could not reach MockMob. Your goal was not changed. Check your connection and try again.';
  if (error?.status === 422) return 'That goal was not accepted. Pick a number from 1 to 7.';
  if (error?.status === 401) return 'Your session has ended. Sign in again, then set your goal.';
  return 'We could not save your goal. Nothing was changed. Try again.';
}

/** The server answered, but not with a goal we can read: say so, never "saved". */
export function goalUncertainLine() {
  return 'We could not confirm that your goal was saved. Reload this page to see your current goal.';
}

// ---------------------------------------------------------------------------------------------
// Start on: where mockmob.in opens for a signed-in student. Today unless they chose Practice.
// Kept on this device. The page writes the option id to localStorage (src/lib/auth-redirect.js reads it
// after sign-in) and mirrors it in a cookie, so the proxy can send a signed-in "/" to the same place (IA9).

export const START_ON_COOKIE = 'mm_start_on';
export const START_ON_COPY = Object.freeze({
  title: 'Start on',
  lead: 'Where MockMob opens when you sign in or open mockmob.in.',
  saved: 'Saved on this device.',
});

const startOnIds = START_ON_OPTIONS.map((option) => option.id);

/** A valid option id, or the default. Reads the bare id and the JSON forms the sign-in reader accepts. */
export function cleanStartOn(raw) {
  let id = raw;
  try {
    const parsed = JSON.parse(raw);
    id = typeof parsed === 'string' ? parsed : parsed?.id ?? raw;
  } catch { /* a bare id is not JSON */ }
  return startOnIds.includes(id) ? id : DEFAULT_START_ON;
}

export function readStartOn(store) {
  try { return cleanStartOn(store?.getItem(START_ON_KEY) ?? null); } catch { return DEFAULT_START_ON; }
}

/** The cookie string for an option: first-party, no personal data, a year. */
export function startOnCookie(id) {
  return `${START_ON_COOKIE}=${cleanStartOn(id)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/** Stores the choice. Returns true when it was kept somewhere; storage may be blocked. */
export function writeStartOn(id, { store = null, setCookie = null } = {}) {
  const value = cleanStartOn(id);
  let kept = false;
  try { store?.setItem(START_ON_KEY, value); kept = Boolean(store); } catch { /* blocked */ }
  try { if (setCookie) { setCookie(startOnCookie(value)); kept = true; } } catch { /* blocked */ }
  return kept;
}

// ---------------------------------------------------------------------------------------------
// Personal bests (the app's you/bests: rhythm/screens/bests_screen.dart). Mocks only; observed marks with
// their denominators; no percentile, no rank, no comparison with other students.

export const BESTS_PATH = '/api/me/bests';
export const BESTS_COPY = Object.freeze({
  title: 'Personal bests',
  other: 'Other mock types',
  emptyTitle: 'Nothing to compare yet',
  emptyBody: 'Once a full mock is saved on the server, its marks show here. A second one of the same type shows your change.',
  failedTitle: 'We could not load your marks',
  failedBody: 'Check your connection and try again.',
  footnote: 'These are marks from your own mocks of the same type. A retake of a paper you have seen does not count.',
});

export const MODE_LABEL = Object.freeze({ full: 'Full mock', nta: 'NTA mode' });
const MODE_NOUN = Object.freeze({ full: 'full mock', nta: 'NTA mode mock' });

const whole = (value) => (Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : null);
/** Marks can be negative (-1 per wrong answer): a plain hyphen-minus, as on the marking line. */
export const marksNumber = (marks) => String(whole(marks));
export const marksText = (mark) => `${marksNumber(mark.marks)} of ${mark.max} marks`;

function markOf(raw) {
  const marks = whole(raw?.marks);
  const max = whole(raw?.max);
  if (marks === null || max === null || max <= 0) return null;
  const at = Number(raw?.completedAt);
  return { marks, max, attemptId: raw?.attemptId ? String(raw.attemptId) : null, completedAt: Number.isFinite(at) && at > 0 ? at : null };
}

/** Rows for Personal bests: comparable mocks only, the strongest share of its own paper first. */
export function bestsFromServer(body) {
  const list = Array.isArray(body?.bests) ? body.bests : [];
  const rows = [];
  for (const raw of list) {
    if (!MODE_LABEL[raw?.mode]) continue; // a quick practice is not a mock
    const best = markOf(raw.best);
    const latest = markOf(raw.latest);
    if (!best || !latest) continue;
    const questions = Math.round(best.max / 5);
    const attempts = Math.max(1, whole(raw.attempts) || 1);
    rows.push({
      key: String(raw.formatId || `${raw.mode}:${raw.subject}:${questions}`),
      mode: raw.mode,
      subject: String(raw.subject || ''),
      title: `${MODE_LABEL[raw.mode]}, ${subjectName(raw.subject) || 'one subject'}, ${questions} ${questions === 1 ? 'question' : 'questions'}`,
      questions,
      attempts,
      best,
      latest,
      share: best.marks / best.max,
    });
  }
  return rows.sort((a, b) => b.share - a.share);
}

/** The words under a format: one attempt, or best and latest. */
export function bestBody(row) {
  return row.attempts < 2
    ? `First ${MODE_NOUN[row.mode]} saved. A second one will show your change.`
    : `Best on this mock type: ${marksText(row.best)}. Latest: ${marksText(row.latest)}.`;
}

/** "Best on 9 Oct. Latest on 14 Oct." or "Saved on 9 Oct." (India time unless told otherwise). */
export function bestDatesLine(row, { timeZone = 'Asia/Kolkata' } = {}) {
  const day = (ms) => (ms ? new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone }) : null);
  if (row.attempts < 2) {
    const saved = day(row.latest.completedAt);
    return saved ? `Saved on ${saved}.` : null;
  }
  const best = day(row.best.completedAt);
  const latest = day(row.latest.completedAt);
  return best && latest ? `Best on ${best}. Latest on ${latest}.` : null;
}

// ---------------------------------------------------------------------------------------------
// Leaderboard (web only, N4): real students are ranked among themselves. The simulated practice rivals
// that /api/leaderboard adds are not students: they never take a place above a real student, and they
// are labelled apart.

export const BOARD_COPY = Object.freeze({
  title: 'Leaderboard',
  lead: 'Practice points from recorded mocks. This board is separate from your CUET exam rank.',
  rivalsTitle: 'Simulated practice rivals',
  rivalsNote: 'These rows are benchmarks made by MockMob. They are not students and not exam results.',
  emptyTitle: 'The board is waiting for a score',
  emptyBody: 'Complete a timed mock to begin your practice record.',
  failedTitle: 'We could not load the board',
  failedBody: 'Check your connection and try again.',
  notOnBoard: 'You are not on this board yet. Finish a timed mock to join it.',
  studentsLabel: 'Students ranked by practice points',
  mocksColumn: 'Mocks',
  pointsColumn: 'Points',
  positionColumn: 'Position',
  nameColumn: 'Student',
});

export function splitLeaderboard(entries, userId = null) {
  const list = Array.isArray(entries) ? entries.filter((e) => e && typeof e === 'object') : [];
  const byScore = (a, b) => (Number(b.totalScore) || 0) - (Number(a.totalScore) || 0);
  const students = list.filter((e) => !e.isSynthetic).sort(byScore);
  const rivals = list.filter((e) => e.isSynthetic).sort(byScore);
  const at = userId ? students.findIndex((e) => e.userId === userId) : -1;
  return { students, rivals, yourPlace: at >= 0 ? at + 1 : null };
}

/** "3 of 12 on this board", or null when the student is not on it. */
export function yourPlaceLine({ yourPlace, students }) {
  return yourPlace ? `You are ${yourPlace} of ${students.length} on this board.` : null;
}

/** The label under a name. A student's own row says "You". */
export function boardTag(entry, userId) {
  if (entry.isSynthetic) return 'Simulated rival';
  return entry.userId && entry.userId === userId ? 'You' : 'Student';
}

// ---------------------------------------------------------------------------------------------
// Contribute questions (web only, N4): two tabs, Submit and Your submissions.

export const UPLOAD_TABS = Object.freeze([
  Object.freeze({ id: 'submit', label: 'Submit' }),
  Object.freeze({ id: 'mine', label: APPROVED.submissions }),
]);

/** /upload?tab=mine is the old /my-uploads. Anything else is Submit. */
export function uploadTab(value) {
  return value === 'mine' ? 'mine' : 'submit';
}

export const CONTRIBUTE_COPY = Object.freeze({
  title: APPROVED.contribute,
  lead: 'Write an original question with a clear answer and the reasoning behind it. It stays out of practice until its checks pass.',
  mineLead: 'Your latest 20 submissions and where each one stands.',
  rewardLine: contributionRewardLine(),
});

/** The status words, one set (data/glossary.mjs UPLOAD_STATUS), for an API status. */
export function statusKey(status) {
  return contributionState(status);
}
export function statusLabel(status) {
  return UPLOAD_STATUS[contributionState(status)];
}
export const STATUS_DETAIL = Object.freeze({
  pending: 'The required checks are running. It is not in practice yet.',
  live: 'It passed its checks and is live in practice.',
  held: 'It did not pass its checks, so it is not in practice.',
});

// ---------------------------------------------------------------------------------------------
// Your submissions (the old My uploads page, now the second tab of Contribute questions).

export const SUBMISSIONS_PATH = '/api/questions/mine';
export const SUBMISSIONS_COPY = Object.freeze({
  loadingLabel: 'Loading your submissions',
  failedTitle: 'We could not load your submissions',
  failedBody: 'Check your connection and try again.',
  emptyTitle: 'No submissions yet',
  emptyBody: 'Write one original question with the reasoning behind it. Its status shows here once it is sent.',
  emptyKey: 'Write a question',
  groupEmptyTitle: 'Nothing in this group',
  groupEmptyBody: 'Try All to see your other submissions.',
  showAll: 'Show all',
  refresh: 'Refresh',
  refreshing: 'Refreshing',
});

export const SUBMISSION_FILTERS = Object.freeze([
  Object.freeze({ id: 'all', label: 'All' }),
  Object.freeze({ id: 'pending', label: UPLOAD_STATUS.pending }),
  Object.freeze({ id: 'live', label: UPLOAD_STATUS.live }),
  Object.freeze({ id: 'held', label: UPLOAD_STATUS.held }),
]);

/** "9 Oct 2026" in India time, or null when the server sent no usable date. */
export function submissionDate(value, { timeZone = 'Asia/Kolkata' } = {}) {
  const at = Date.parse(value);
  return Number.isFinite(at) ? new Date(at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone }) : null;
}

/**
 * The rows for Your submissions, or null when the server did not send a list (never "empty" for a failure).
 * Each row: { id, text, meta, state, statusLabel, detail, submitted }. The question text is never shortened.
 */
export function submissionsFromServer(body) {
  if (!Array.isArray(body)) return null;
  return body.filter((q) => q && typeof q === 'object').map((q, index) => {
    const state = statusKey(q.status);
    const subject = subjectName(q.subject);
    const chapter = typeof q.chapter === 'string' && q.chapter.trim() ? q.chapter.trim() : null;
    const text = String(q.question || q.body || '').trim();
    return {
      id: String(q.id ?? `row-${index}`),
      text: text && text !== '—' ? text : 'The question text did not load',
      meta: [subject, chapter].filter(Boolean).join(', ') || 'Subject not recorded',
      state,
      statusLabel: UPLOAD_STATUS[state],
      detail: STATUS_DETAIL[state],
      submitted: submissionDate(q.createdAt),
    };
  });
}

/** Counts per filter, for the chips: { all, pending, live, held }. */
export function submissionCounts(rows) {
  const counts = { all: rows.length, pending: 0, live: 0, held: 0 };
  for (const row of rows) counts[row.state] += 1;
  return counts;
}

export function filterSubmissions(rows, filter) {
  return filter === 'all' || !filter ? rows : rows.filter((row) => row.state === filter);
}

// ---------------------------------------------------------------------------------------------
// Many questions at once (a JSON array): checks that run before anything is sent.

export const BULK_FIELDS = Object.freeze(['subject', 'chapter', 'body', 'options', 'correct_answer']);

/** Splits a parsed JSON value into the questions that can be sent and a plain line for each one that cannot. */
export function validateBulk(parsed) {
  if (!Array.isArray(parsed)) return { ok: [], errors: ['The top level must be a list of questions, written as [ ... ].'] };
  const ok = [];
  const errors = [];
  parsed.forEach((q, index) => {
    const row = q && typeof q === 'object' ? q : {};
    const missing = [];
    if (typeof row.subject !== 'string' || !row.subject.trim()) missing.push('subject');
    if (typeof row.chapter !== 'string' || !row.chapter.trim()) missing.push('chapter');
    if (typeof row.body !== 'string' && typeof row.question !== 'string') missing.push('body');
    if (!Array.isArray(row.options) || row.options.length < 2) missing.push('at least 2 options');
    if (!row.correct_answer && !Number.isInteger(row.correctIndex)) missing.push('correct_answer');
    if (missing.length) errors.push(`Question ${index + 1} is missing ${missing.join(', ')}.`);
    else ok.push(row);
  });
  return { ok, errors };
}

/** The body the upload route takes for one validated question. */
export function bulkPayload(q) {
  return {
    subject: q.subject,
    chapter: q.chapter,
    body: q.body ?? q.question,
    options: q.options,
    correct_answer: q.correct_answer ?? (q.options?.[q.correctIndex]?.key ?? String(q.correctIndex)),
    explanation: q.explanation ?? null,
    difficulty: q.difficulty ?? 'medium',
    tags: q.tags ?? [],
  };
}

/** "3 questions were sent for checks." Said only for questions the server accepted. */
export function bulkSentLine(count) {
  return `${count} ${count === 1 ? 'question was' : 'questions were'} sent for checks. ${count === 1 ? 'It is' : 'They are'} not live in practice yet.`;
}

// ---------------------------------------------------------------------------------------------
// The rows of the You hub, read from the navigation so the nav and the hub always agree.

export const GROUP_ORDER = Object.freeze([APPROVED.toolsGroup, 'Settings', 'Community', 'Help']);

// One line under a row where the plan gives one. The words are the glossary's.
export const ROW_NOTES = Object.freeze({
  'admission-compass': APPROVED.cutoffToolLine,
  combinations: APPROVED.comboToolLine,
  'guide-2027': 'What the CUET UG 2027 exam looks like and when to expect it',
  'start-on': 'Today or Practice',
  appearance: 'Theme, reduced motion and celebrations',
  privacy: 'Usage data and your age answer',
  account: 'Your name, plan and sign-in',
  leaderboard: 'Practice points from recorded mocks',
  upload: 'Write an original question for other students',
  'my-uploads': 'Where each of your submissions stands',
  guide: 'The four-stop tour of Today, Start, Practice and Review',
  contact: 'A result that looks wrong, or anything else',
  delete: 'Ask us to delete your account and study records',
});

// The delete control is on the Account page. The hub goes straight to it.
const HREF_OVERRIDE = Object.freeze({ delete: '/profile#delete' });

/**
 * The grouped rows below the sheet. Each row: { id, label, href|null, action|null, note|null }.
 * Moderation is its own group and only for moderators.
 */
export function youGroups({ moderator = false } = {}) {
  const items = placeContents('you', { moderator }).filter((item) => item.group || item.show === 'moderator');
  const groups = GROUP_ORDER.map((label) => ({
    id: label.toLowerCase().replace(/\s+/g, '-'),
    label,
    rows: items.filter((item) => item.group === label).map((item) => ({
      id: item.id,
      label: item.label,
      href: item.action ? null : HREF_OVERRIDE[item.id] || item.href,
      action: item.action || null,
      note: ROW_NOTES[item.id] || null,
    })),
  })).filter((group) => group.rows.length > 0);
  const mod = items.find((item) => item.show === 'moderator');
  if (mod) groups.push({ id: 'moderation', label: 'Moderation', rows: [{ id: mod.id, label: mod.label, href: mod.href, action: null, note: null }] });
  return groups;
}

/** The Plan and credits summary under the hub: the plan, then one labelled line per wallet. */
export function planSummary({ pro = false, practiceBalance = null, aiRemaining = null } = {}) {
  const whole = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.trunc(Number(v))));
  const lines = [];
  const p = whole(practiceBalance);
  const a = whole(aiRemaining);
  if (!pro && p !== null) lines.push(`${p} ${p === 1 ? 'practice credit' : 'practice credits'}`);
  if (pro) lines.push('Practice without credits');
  if (a !== null) lines.push(`${a} ${a === 1 ? 'AI credit' : 'AI credits'}`);
  return { plan: pro ? 'Pro' : 'Free', lines };
}

/** The subject names on the sheet, in the student's order. Unknown ids keep a tidy name, never a raw id. */
export function sheetSubjects(subjects) {
  const ids = Array.isArray(subjects) ? subjects.filter((id) => typeof id === 'string' && id) : [];
  return [...new Set(ids)].map((id) => ({ id, name: subjectName(id) }));
}
