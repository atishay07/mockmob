// Account (the live /profile page): the pure rules behind your sheet, plan and credits, the weekly
// goal and the community and help rows. No React and no browser, so data/tests/you_account.test.mjs
// can hold every rule that decides what a student reads.
//
// Ported from the restructure's You hub (web/ia-1015, youModel.mjs), kept self-contained so it runs
// inside the live navigation without the restructure's navigation or glossary modules.
//
// Copy rules: sentence case, no "!", no em dash, no middle dots, 12-hour times.
import { WEEKDAY_NAMES, WEEKDAY_SHORT, parseWeekdays, weekdaysLine } from '../../lib/studyWeekdays.mjs';

// ---------------------------------------------------------------------------------------------
// Your sheet: subjects (drawn with the shared SubjectObject, src/components/brand/SubjectObject.jsx)

export const SUBJECT_LIMIT = 5;
export const SUBJECTS_EDIT_HREF = '/onboarding?edit=true';
export const EXAM_LABEL = 'CUET UG 2027';

// The short names students read. data/subjects.js keeps the long syllabus names
// ("Economics / Business Economics"); a chip needs the one word they say.
const SUBJECT_NAMES = Object.freeze({
  english: 'English', hindi: 'Hindi', assamese: 'Assamese', bengali: 'Bengali', gujarati: 'Gujarati',
  kannada: 'Kannada', malayalam: 'Malayalam', marathi: 'Marathi', odia: 'Odia', punjabi: 'Punjabi',
  tamil: 'Tamil', telugu: 'Telugu', urdu: 'Urdu', sanskrit: 'Sanskrit',
  accountancy: 'Accountancy', business_studies: 'Business Studies', bst: 'Business Studies',
  economics: 'Economics', entrepreneurship: 'Entrepreneurship',
  mathematics: 'Mathematics', applied_mathematics: 'Applied Mathematics',
  physics: 'Physics', chemistry: 'Chemistry', biology: 'Biology', agriculture: 'Agriculture',
  environmental_studies: 'Environmental Studies', computer_science: 'Computer Science',
  engineering_graphics: 'Engineering Graphics', history: 'History', political_science: 'Political Science',
  geography: 'Geography', sociology: 'Sociology', psychology: 'Psychology', anthropology: 'Anthropology',
  legal_studies: 'Legal Studies', mass_media: 'Mass Media', teaching_aptitude: 'Teaching Aptitude',
  fine_arts: 'Fine Arts', performing_arts: 'Performing Arts', physical_education: 'Physical Education',
  home_science: 'Home Science', knowledge_tradition_india: 'Knowledge Tradition of India',
  gat: 'General Test', general_test: 'General Test', gt: 'General Test',
});

/** The name a student reads. An unknown id keeps a tidy name, never a raw id. */
export function subjectName(id) {
  const key = String(id || '').trim().toLowerCase();
  if (SUBJECT_NAMES[key]) return SUBJECT_NAMES[key];
  const words = key.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Subject';
}

/** The subjects on the sheet, in the student's order, without repeats. */
export function sheetSubjects(subjects) {
  const ids = Array.isArray(subjects) ? subjects.filter((id) => typeof id === 'string' && id.trim()) : [];
  return [...new Set(ids)].map((id) => ({ id, name: subjectName(id) }));
}

/** "4 of 5 picked", or the empty line. */
export function subjectCountLine(count) {
  const n = Math.max(0, Math.trunc(Number(count) || 0));
  return n ? `${n} of ${SUBJECT_LIMIT} picked` : `None picked yet. Pick up to ${SUBJECT_LIMIT}.`;
}

// ---------------------------------------------------------------------------------------------
// Mocks at a glance (the live Account tiles): a count and an average that never invents a zero.

/** { count, average } from /api/attempts. average is null when no attempt has a usable score. */
export function mocksSummary(attempts) {
  const list = Array.isArray(attempts) ? attempts.filter((a) => a && typeof a === 'object') : [];
  const usable = (v) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v));
  const scores = list.filter((a) => usable(a.score)).map((a) => Number(a.score));
  const average = scores.length ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length) : null;
  return { count: list.length, average };
}

// ---------------------------------------------------------------------------------------------
// Plan and credits: the AI credits line under the live plan card.
// Unknown is never shown as 0, and a paused or empty wallet says so in words.

export const PREPOS_HREF = '/mentor';

/**
 * What the wallet line says, from useWalletSummary's { status, wallet }.
 * Returns { state: 'loading' | 'unknown' | 'known', total, line }.
 */
export function walletLine(summary) {
  const status = summary?.status || 'idle';
  const wallet = summary?.wallet || null;
  if (wallet?.known && Number.isFinite(Number(wallet.total))) {
    const total = Math.max(0, Math.trunc(Number(wallet.total)));
    let line = 'AI credits left this month.';
    if (wallet.state === 'paused') line = 'AI features are paused right now. Your AI credits are kept.';
    else if (total === 0) line = 'No AI credits left this month.';
    return { state: 'known', total, line };
  }
  if (status === 'idle') return { state: 'loading', total: null, line: 'Checking your AI credits.' };
  return { state: 'unknown', total: null, line: 'Your AI credits did not load. Nothing was spent.' };
}

// ---------------------------------------------------------------------------------------------
// Weekly goal (the app's Weekly goal screen). "Saved" is said only after the server confirmed it.

export const GOAL_PATH = '/api/me/goal';
export const GOAL_DAYS = Object.freeze([1, 2, 3, 4, 5, 6, 7]);
// The weekday chips, Monday first (0 = Monday, the number the server and the app share).
export const GOAL_WEEKDAYS = Object.freeze(WEEKDAY_NAMES.map((name, index) => Object.freeze({ index, name, short: WEEKDAY_SHORT[index] })));

export const GOAL_COPY = Object.freeze({
  title: 'Weekly goal',
  question: 'Which days do you want to study?',
  noDaysYet: 'Choose at least one day.',
  counts: 'A study day is a day you finish a practice, a mock or a repair. Today and Progress plan around this number.',
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
 * `set: false` is an explicit "no goal chosen yet"; a server that sends no `set` means the days in force are the goal.
 */
export function goalFromServer(body) {
  const days = body?.daysPerWeek;
  if (!Number.isInteger(days) || days < 1 || days > 7) return null;
  // `weekdays` (0 = Monday) is believed only while its count is the goal; a server that sends none means "not chosen".
  const parsed = parseWeekdays(body.weekdays);
  const weekdays = parsed.ok && parsed.weekdays.length === days ? parsed.weekdays : null;
  return { days, set: body.set !== false, pausedUntil: typeof body.pausedUntil === 'string' ? body.pausedUntil : null, weekdays };
}

/** The chip list after a tap: the day is added or removed, always sorted, never a repeat. */
export function toggleWeekday(list, day) {
  const base = Array.isArray(list) ? list.filter((d) => Number.isInteger(d) && d >= 0 && d < 7) : [];
  const next = base.includes(day) ? base.filter((d) => d !== day) : [...base, day];
  return [...new Set(next)].sort((a, b) => a - b);
}

/** True when two weekday lists hold the same days. */
export function sameWeekdays(a, b) {
  const x = Array.isArray(a) ? [...a].sort((p, q) => p - q) : null;
  const y = Array.isArray(b) ? [...b].sort((p, q) => p - q) : null;
  return x !== null && y !== null && x.length === y.length && x.every((d, i) => d === y[i]);
}

/** Under the chips when the server holds a goal but no days: the goal stays, the days are the student's to pick. */
export function goalDaysNotChosenLine(days) {
  return `Your goal is ${days} ${days === 1 ? 'day' : 'days'} a week. Choose which days.`;
}

/** "You study Mon, Tue, Thu and Sat." (nothing for an empty plan). */
export function goalWeekdaysLine(weekdays) {
  const line = weekdaysLine(weekdays);
  return line ? `You study ${line}.` : '';
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

/** The body of a goal save. The server replaces the whole row, so a pause made in the app is sent back. */
export function goalSaveBody(days, pausedUntil, now = Date.now(), weekdays = undefined) {
  const body = { daysPerWeek: days, pausedUntil: activePause(pausedUntil, now) };
  if (Array.isArray(weekdays)) body.weekdays = [...weekdays].sort((a, b) => a - b);
  return body;
}

/** "Study days are paused until 2 Nov. Changing the goal keeps the pause." or null. */
export function goalPauseLine(pausedUntil, now = Date.now()) {
  const until = activePause(pausedUntil, now);
  if (!until) return null;
  const [y, m, d] = until.split('-').map(Number);
  const text = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `Study days are paused until ${text}. Changing the goal keeps the pause.`;
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
  if (error?.status === 422) return 'That goal was not accepted. Pick from 1 to 7 days.';
  if (error?.status === 401) return 'Your session has ended. Sign in again, then set your goal.';
  return 'We could not save your goal. Nothing was changed. Try again.';
}

/** The server answered, but not with a goal we can read: say so, never "saved". */
export function goalUncertainLine() {
  return 'We could not confirm that your goal was saved. Reload this page to see your current goal.';
}

// ---------------------------------------------------------------------------------------------
// Community and help: the rows under the settings. Labels match the live navigation, so a row
// and the sidebar link it mirrors read the same.

export const GUIDE_EVENT = 'mockmob:open-guide';

export const COMMUNITY_ROWS = Object.freeze([
  Object.freeze({ id: 'leaderboard', label: 'Ranks', note: 'The practice points board. It is separate from your CUET exam rank.', href: '/leaderboard' }),
  Object.freeze({ id: 'upload', label: 'Contribute', note: 'Write an original question for other students', href: '/upload' }),
  Object.freeze({ id: 'my-uploads', label: 'My uploads', note: 'Where each of your questions stands', href: '/my-uploads' }),
]);

export const HELP_ROWS = Object.freeze([
  Object.freeze({ id: 'guide', label: 'Replay the guide', note: 'A short tour of the places you study', action: 'guide' }),
  Object.freeze({ id: 'contact', label: 'Contact us', note: 'A result that looks wrong, or anything else', href: '/contact' }),
  Object.freeze({ id: 'privacy-policy', label: 'Privacy policy', note: 'What we keep, and for how long', href: '/privacy' }),
]);

/** The theme's name as the Appearance card says it. */
export const THEME_NAME = Object.freeze({ dark: 'Night', light: 'Daylight', system: 'Match device' });

/** The anchors a link to /profile#... may land on. Anything else is ignored. */
export const ACCOUNT_ANCHORS = Object.freeze(['sheet', 'name', 'colleges', 'plan', 'credits', 'appearance', 'goal', 'community', 'help', 'privacy', 'sign-in', 'delete']);
export function anchorFromHash(hash) {
  const id = String(hash || '').replace(/^#/, '').trim().toLowerCase();
  return ACCOUNT_ANCHORS.includes(id) ? id : null;
}
