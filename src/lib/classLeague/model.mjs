// Class leagues (16 Nov 2026): a whole class (a school section, a coaching batch) sits the Sunday Mock and, once its answers
// open, each member sees how many of the class sat it, the class average and their own marks beside it. Never a name, a
// rank, a list of members or the highest mark. This is the pure model the server and the website share: codes, the name
// rule, who counts in a week, the class figure and its floor, and every sentence a student reads. No I/O, no clock reads
// except through `now`, so node:test drives it (data/tests/class_league_model.test.mjs).
//
// How it rides on the Sunday Mock (src/lib/sundayMock.mjs), with no paper, timing or scoring of its own:
//   the paper    the week's Sunday Mock in each subject the class follows: the same fixed paper, the same window.
//   the sittings the Sunday Mock's own counted sittings (its store's membersSittings: the Sunday tag, late papers left out),
//                kept only when countsFor(week, completedAt) says so, marked by marksOf. Nothing here scores a paper.
//   the moment   a week's figure opens at that Sunday's answersAt (11:05 PM IST), when the last possible paper is in, so it
//                is never live: two readings during a Sunday could otherwise give away one classmate's marks.
//   who counts   the members of the class at that answersAt: joined by then and not left by then. A join or a leave
//                afterwards never moves a closed week's figure, so its average cannot be read twice to find one paper.
//   the floor    under 5 sitters nothing is said about the week, not even how many sat.
import { LAUNCH_WEEK, MARK_RIGHT, PAPER_COUNT, countsFor, dateLabel, isWeekKey, marksOf, sundayState, sundayWindow, timeLabel } from '../sundayMock.mjs';
import { CODE_ALPHABET, codeFromBytes, nameBlocked, waitPhrase } from '../mob/model.mjs';

export { waitPhrase };

export const CLASS_NAME_MIN = 3;
export const CLASS_NAME_MAX = 60;
// A class is a school section or a coaching batch: 20 to 60 students, with room for a teacher or two and a merged batch.
export const CLASS_MAX_MEMBERS = 80;
// Below this many sitters a week shows nothing but the floor's own sentence (owner decision, 16 Nov 2026).
export const CLASS_FLOOR = 5;
export const CLASS_MAX_SUBJECTS = 6;
export const CLASS_FULL_MARKS = PAPER_COUNT * MARK_RIGHT; // 250: a Sunday Mock paper's full marks
// Six characters from Crockford's alphabet without I, L, O and U (32 symbols): about a billion codes, read aloud in a class
// without a mix-up. Guessing is held back by the join limits (src/lib/classLeague/http.js), not by length alone.
export const CLASS_CODE_LENGTH = 6;
export const CLASS_CODE_RE = /^[0-9A-HJKMNP-TV-Z]{6}$/;
export const SITE = 'https://www.mockmob.in';
export const REPORT_REASONS = Object.freeze(['name', 'safety']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isLeagueId = (v) => typeof v === 'string' && UUID_RE.test(v);

// ---------- Errors: one code, one HTTP status, one plain sentence ----------

export const CLASS_ERRORS = Object.freeze({
  UNAUTHENTICATED: [401, 'Sign in to use your class.'],
  CLASS_OFF: [404, 'This page is not available.'],
  CLASS_NOT_FOUND: [404, 'No class has that code. Check it with whoever shared it.'],
  NOT_IN_CLASS: [404, 'You are not in a class.'],
  CODE_INVALID: [422, 'A class code is 6 letters and numbers, like K7P 2M9.'],
  CLASS_FULL: [409, `This class is full: it has ${CLASS_MAX_MEMBERS} members, the most a class can have.`],
  ALREADY_IN_CLASS: [409, 'You are already in a class. Leave it first to join or start another.'],
  ALREADY_IN_THIS: [409, 'You are already in this class.'],
  CREATOR_CLOSES: [409, 'You started this class, so you close it instead of leaving. Closing ends it for everyone.'],
  NOT_CREATOR: [403, 'Only the student who started the class can close it.'],
  NAME_INVALID: [422, `Use ${CLASS_NAME_MIN} to ${CLASS_NAME_MAX} letters and numbers for the class name.`],
  NAME_REFUSED: [422, 'Choose a different name. Everyone with the code sees it.'],
  SUBJECTS_INVALID: [422, 'Choose at least one of your subjects.'],
  NO_SUBJECTS: [422, 'Choose your CUET subjects first. A class follows the Sunday Mock in them.'],
  WEEK_INVALID: [404, 'There is no class figure for that Sunday.'],
  REASON_INVALID: [422, 'Choose why you are reporting.'],
  BODY_INVALID: [422, 'Something in the request was not right. Try again.'],
  RATE_LIMITED: [429, 'Too many tries in a short time. Try again in a few minutes.'],
  UNAVAILABLE: [503, 'Your class did not load. Try again shortly.'],
});

export class ClassError extends Error {
  /** extra.message: a sentence that says more than the code's own; extra.detail: data a screen can act on. */
  constructor(code, extra = {}) {
    super(code);
    this.code = CLASS_ERRORS[code] ? code : 'UNAVAILABLE';
    this.status = CLASS_ERRORS[this.code][0];
    this.extra = extra;
  }
}

/** The error body every class route sends: { error: { code, message } } (the Mob's shape). */
export function classErrorBody(code, { message = null, detail = null } = {}) {
  const known = CLASS_ERRORS[code] ? code : 'UNAVAILABLE';
  return { error: { code: known, message: typeof message === 'string' && message ? message : CLASS_ERRORS[known][1], ...(detail ? { detail } : {}) } };
}
export const classErrorStatus = (code) => (CLASS_ERRORS[code] || CLASS_ERRORS.UNAVAILABLE)[0];

// ---------- The code ----------

/** A code as typed, pasted or read from a link: Crockford reading (O is 0, I and L are 1), upper case, no spaces or hyphens. */
export function normalizeClassCode(raw) {
  if (typeof raw !== 'string' || raw.length > 32) return null;
  const code = raw.toUpperCase().replace(/[\s-]+/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return CLASS_CODE_RE.test(code) ? code : null;
}
/** A new code from 4 random bytes (the top 30 bits). */
export const classCodeFromBytes = (bytes) => codeFromBytes(bytes, CLASS_CODE_LENGTH);
/** "K7P 2M9": the code in two groups of three, as it is said and written on a board. */
export const displayClassCode = (code) => (typeof code === 'string' && code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : String(code || ''));
export const classUrl = (code) => `${SITE}/class/${code}`;
export const classPath = (code) => `/class/${code}`;
export { CODE_ALPHABET };

// ---------- The name ----------

/** NFC, spaces collapsed and trimmed. */
export const cleanClassName = (raw) => (typeof raw === 'string' ? raw.normalize('NFC').replace(/\s+/g, ' ').trim() : '');
// Letters, marks (Indian scripts write vowel signs as marks), digits, spaces and the punctuation a class name uses:
// "XII-C Commerce, DPS Rohini", "Batch 2027 (Morning)", "St. Mary's 12 B/Arts", "Commerce & Humanities".
const NAME_CHARS = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} .,'’()&/#-]*$/u;
// A public page shows the name to anyone with the code, so it cannot carry a phone number or a link.
const LONG_NUMBER = /\d{5,}/;
const LINK = /(?:www|https?|\.(?:com|in|net|org|co|io|me|xyz|app|ly|link|gg|info|site|online|shop)\b)/iu;

/** { ok, name } or { ok: false, code } (NAME_INVALID or NAME_REFUSED). `blocklist` is data/mob_name_blocklist.json. */
export function checkClassName(raw, blocklist = null) {
  const name = cleanClassName(raw);
  const n = [...name].length;
  if (n < CLASS_NAME_MIN || n > CLASS_NAME_MAX || !NAME_CHARS.test(name) || !/\p{L}/u.test(name)) return { ok: false, code: 'NAME_INVALID' };
  if (LONG_NUMBER.test(name.replace(/[\s.,-]/g, '')) || LINK.test(name)) return { ok: false, code: 'NAME_REFUSED' };
  // The Mob's own screen (look-alike letters, stretched spellings, the moderators' list), read word by word.
  if (blocklist && nameBlocked(name.replace(/[,()&/#’]/g, ' '), blocklist)) return { ok: false, code: 'NAME_REFUSED' };
  return { ok: true, name };
}

/** The class's subjects: the creator's own subject ids picked, once each, in the creator's order. Null when none is left. */
export function pickSubjects(asked, own) {
  const mine = Array.isArray(own) ? own : [];
  const want = new Set((Array.isArray(asked) ? asked : []).filter((s) => typeof s === 'string'));
  const out = mine.filter((s) => want.has(s));
  return out.length ? out.slice(0, CLASS_MAX_SUBJECTS) : null;
}

// ---------- Who counts in a week ----------

const ms = (v) => { const t = typeof v === 'number' ? v : Date.parse(v || ''); return Number.isFinite(t) ? t : null; };

/** The member rows open at instant `t` (joined by then, not left by then), as a Set of user ids. */
export function membersAt(rows, t) {
  const out = new Set();
  for (const r of Array.isArray(rows) ? rows : []) {
    const joined = ms(r?.joinedAt ?? r?.joined_at);
    const left = ms(r?.leftAt ?? r?.left_at);
    const user = r?.userId ?? r?.user_id;
    if (!user || joined === null || joined > t) continue;
    if (left !== null && left <= t) continue;
    out.add(user);
  }
  return out;
}

/**
 * The Sunday whose class figure a student sees now: the latest Sunday from the launch whose answers are open, and only if
 * the class existed before that moment (a class started on a Monday has no figure for the Sunday before). Null otherwise.
 */
export function figureWeek(now, createdAt) {
  const st = sundayState(now);
  const week = st.answersOpen ? st.week : st.previous;
  if (week < LAUNCH_WEEK) return null;
  const born = ms(createdAt);
  if (born !== null && born >= sundayWindow(week).answersAt) return null;
  return week;
}

/** The Sunday whose figure comes next, and when (its answersAt): { week, at }. */
export function nextFigure(now) {
  const st = sundayState(now);
  let week = st.answersOpen ? st.next : st.week;
  if (week < LAUNCH_WEEK) week = LAUNCH_WEEK;
  return { week, at: sundayWindow(week).answersAt };
}

/** May a member ask for `week`'s figure at `now`? A Sunday from the launch whose answers are open, the class already started. */
export function weekAllowed(week, now, createdAt) {
  if (!isWeekKey(week) || week < LAUNCH_WEEK) return false;
  const win = sundayWindow(week);
  if (now < win.answersAt) return false;
  const born = ms(createdAt);
  return born === null || born < win.answersAt;
}

/**
 * One subject's class figure for a closed week. `rows`: the class's member rows (any time); `sittings`: the Sunday Mock's
 * counted sittings of those members for that week and subject ([{ userId, correct, wrong, total, completedAt }], late
 * papers already left out by the store). Returns { enough: false } under the floor, else { enough: true, sat, average }
 * (the mean of the sitters' marks, rounded to a whole mark, of CLASS_FULL_MARKS). Never a name, a rank or a top mark.
 */
export function classFigure({ week, rows, sittings, floor = CLASS_FLOOR }) {
  if (!isWeekKey(week)) return { enough: false };
  const counted = membersAt(rows, sundayWindow(week).answersAt);
  const seen = new Set();
  let sum = 0;
  for (const s of Array.isArray(sittings) ? sittings : []) {
    if (!s || !counted.has(s.userId) || seen.has(s.userId) || !countsFor(week, ms(s.completedAt))) continue;
    seen.add(s.userId);
    sum += marksOf(s).scored;
  }
  const sat = seen.size;
  if (sat < floor) return { enough: false };
  return { enough: true, sat, average: Math.round(sum / sat) };
}

// ---------- Words (plain, sentence case, 12-hour IST) ----------

const plural = (n, one, many) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;

export const CLASS_COPY = Object.freeze({
  name: 'Class league',
  blockTitle: 'Your class',
  what: 'Your whole class sits the free Sunday Mock. On Monday you see how many of your class sat it and the class average beside your own marks. Never a name, never a rank.',
  rules: [
    'Every Sunday from 10:00 AM to 10:00 PM, everyone sits the same Sunday Mock paper in their subjects.',
    'At 11:05 PM, when the answers open, you see how many of your class sat it and the class average.',
    'Nobody sees a name, a rank or who sat. Under 5 sitters, the average stays hidden.',
  ],
  joinLabel: 'Class code',
  joinHint: '6 letters and numbers, from your teacher or the class group.',
  join: 'Join',
  joinThis: 'Join this class',
  joining: 'Joining',
  start: 'Start a class',
  starting: 'Starting',
  startTitle: 'Start a class',
  nameLabel: 'Class name',
  nameHint: 'Like XII-C Commerce, DPS Rohini. Everyone with the code sees it.',
  subjectsLabel: 'Subjects it follows',
  subjectsHint: 'Your class sees an average for each of these.',
  createKey: 'Start the class',
  shareKey: 'Share the code',
  copyKey: 'Copy link',
  copied: 'Copied',
  settings: 'Class settings',
  leave: 'Leave this class',
  leaveLine: 'You leave at once. A Sunday that has already closed keeps its figure.',
  close: 'Close this class',
  closeLine: 'The class ends for everyone and its code stops working. This cannot be undone.',
  report: 'Report this class',
  reportLine: 'What is wrong? MockMob support sees the class name and code, nothing about you.',
  reasons: { name: 'The class name is not okay', safety: 'Something here is not safe' },
  reported: 'Reported. MockMob support will look at it.',
  floorLine: `Fewer than ${CLASS_FLOOR} sat it, so the average stays hidden.`,
  loadFailed: 'Your class did not load.',
  tryAgain: 'Try again',
  noSubjects: 'Choose your CUET subjects first. A class follows the Sunday Mock in them.',
  addSubjects: 'Add your subjects',
  signUp: 'Sign up free to join',
  haveAccount: 'Already have an account?',
  signIn: 'Log in',
});

/** "38 members" */
export const membersLine = (n) => (Number.isInteger(n) && n >= 0 ? plural(n, 'member', 'members') : '');
/** "31 of your class sat it" */
export const satClassLine = (n) => `${n.toLocaleString('en-IN')} of your class sat it`;
/** "Class average 142 / 250" */
export const averageLine = (avg) => `Class average ${avg} / ${CLASS_FULL_MARKS}`;
/** "168 / 250" */
export const marksText = (m) => (m && Number.isFinite(m.scored) && Number.isFinite(m.max) ? `${m.scored} / ${m.max}` : '');

/** "Sunday 22 Nov at 11:05 PM": when a week's class figure opens. */
export function figureOpensLine(next) {
  if (!next || !isWeekKey(next.week)) return '';
  return `Your class's first figure comes on ${dateLabel(next.week)} at ${timeLabel(next.at)}, when the Sunday Mock's answers open.`;
}

/** "First figure: Sunday 22 Nov at 11:05 PM" (a class before its first closed Sunday). */
export const firstFigureTitle = (next) => (next && isWeekKey(next.week) ? `First figure: ${dateLabel(next.week)} at ${timeLabel(next.at)}` : "Your class's first figure");
export const FIRST_FIGURE_LINE = "That is when the Sunday Mock's answers open. Share the code now, so your class is in before Sunday.";

/** "The next figure: Sunday 29 Nov at 11:05 PM." */
export const nextFigureLine = (next) => (next && isWeekKey(next.week) ? `The next figure: ${dateLabel(next.week)} at ${timeLabel(next.at)}.` : '');

/** The figure's heading: "Sunday 22 Nov". */
export const figureHeading = (week) => dateLabel(week);

/**
 * One subject's figure as the block draws it, from the status read: { subject, name, enough, sat?, average?, you? }.
 * Returns { title, lines: [..], you } where every line is a sentence the code can back.
 */
export function figureWords(f) {
  if (!f) return null;
  const you = f.you ? `You: ${marksText(f.you)}` : 'You did not sit it.';
  if (!f.enough) return { title: f.name, lines: [CLASS_COPY.floorLine], you };
  return { title: f.name, lines: [satClassLine(f.sat), averageLine(f.average)], you };
}

/** Where a value sits on a 0 to 250 ruler, as a share from 0 to 1 (negative marks sit at 0). */
export const rulerAt = (marks) => Math.min(1, Math.max(0, Number(marks) / CLASS_FULL_MARKS)) || 0;

// ---------- The public page ----------

/** The three plain lines the join page says under the class's name. */
export const JOIN_LINES = Object.freeze([
  ['Every Sunday, one free paper', 'The Sunday Mock: 50 questions in 60 minutes, open from 10:00 AM to 10:00 PM, the same paper for everyone.'],
  ['On Monday, your class next to you', 'How many of your class sat it and the class average, beside your own marks.'],
  ['No names, no ranks', 'Nobody sees who sat or who scored what. Under 5 sitters the average stays hidden.'],
]);

/**
 * The pending code this tab keeps across sign-up and the first setup, in sessionStorage as the Mob keeps its invite
 * (src/components/mob/JoinMob.jsx): gone with the tab, and never older than a day.
 */
export const PENDING_CLASS_KEY = 'mockmob_class_join';
export const PENDING_CLASS_MS = 86_400_000;
export function readPendingCode(raw, now) {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : null;
    const code = v ? normalizeClassCode(v.code) : null;
    return code && Number.isFinite(Number(v.at)) && now - Number(v.at) < PENDING_CLASS_MS && now >= Number(v.at) - 60_000 ? code : null;
  } catch { return null; }
}

/** The 429 sentence for each class limit, with the real wait. */
export function classLimitMessage(name, wait) {
  switch (name) {
    case 'create': return `You started 3 classes in the last 7 days, the most a week allows. You can start another ${wait}.`;
    case 'joinMiss': return `That was a lot of codes that did not match. You can try again ${wait}.`;
    case 'joinNet': return `There were a lot of tries to join a class from your network. You can try again ${wait}.`;
    case 'lookup': return `This class link was checked too many times from your network. Try again ${wait}.`;
    case 'lookupUser': return `You checked a lot of class links in an hour. You can check again ${wait}.`;
    case 'report': return `You sent 5 reports today, the most a day allows. You can send another ${wait}.`;
    default: return `Too many tries in a short time. Try again ${wait}.`;
  }
}
