// The Mob (docs/design-decisions/pass-1016e/SOCIAL-SPEC.md): the pure rules both the server and the website use.
// No I/O and no clock reads except through `now`. The server builds every member's view with buildView, so the rules
// that keep the Mob safe live in one place and are tested in data/tests/mob.test.mjs:
//   P5 never ranked: members in join order; another member's score only when that member opted in.
//   P6 never names a non-sitter: the view says who sat, never who did not.
//   P7 the shared trap is aggregate: 3 or more sitters, an option picked by 2 or more and by half or more, no names.
//   Together (the payoff a Mob of two can have): only between sitters who all show their score; a count, never a rank.
// Free and Pro (SOCIAL-SPEC section 15): the plan is decided on the server and arrives in the view as `plan`. Free:
// start or join a Mob, sit the weekly paper without credits, see the ring, your own result and a one-line teaser of where
// the Mob split. Pro: the full side-by-side, past weeks, extra papers on a chosen chapter and length, up to 3 Mobs.
// Nothing here grants, spends or rewards credits or money.
import { localDay, weekStart } from '../server/rhythm.js';

export const MAX_MEMBERS = 5;
// The plan caps STARTING Mobs (17 Oct CTO decision): free starts one, Pro up to 3. Joining a friend's Mob by invite is
// open to every plan, up to one safety ceiling on how many Mobs a student is in (the migration holds the same 12).
export const FREE_MAX_MOBS = 1;
export const PRO_MAX_MOBS = 3;
export const MAX_MEMBERSHIPS = 12;
export const EXTRA_MAX_PER_WEEK = 3;
export const EXTRA_LENGTHS = Object.freeze([5, 10, 15, 20]);
export const EXTRA_OPEN_DAYS = 7;
// A Mob paper is a quick practice paper: 60 seconds a question on the runner's clock (data/test_modes.js quick). The
// window rules keep 12 seconds a question of slack for opening and submitting, so a paper started in time still counts.
export const SECONDS_PER_QUESTION = 72;
export const RUNNER_SECONDS_PER_QUESTION = 60;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PAPER_COUNT = 10;
export const PAPER_SECONDS = PAPER_COUNT * RUNNER_SECONDS_PER_QUESTION; // 600: what the runner's timer shows
const START_WINDOW_SECONDS = PAPER_COUNT * SECONDS_PER_QUESTION; // 720: the paper plus slack, for the start cut-off
/** "10 questions, 10 minutes": the copy every surface uses for a paper of `count` questions. */
export const paperLine = (count = PAPER_COUNT) => `${count} questions, ${count * RUNNER_SECONDS_PER_QUESTION / 60} minutes`;
export const INVITE_DAYS = 7;
export const TRAP_MIN_SITTERS = 3;
export const TRAP_MIN_PICKS = 2;
export const COLOUR_COUNT = 8;
export const NAME_MAX = 18;
export const TIMEZONE = 'Asia/Kolkata';
export const SITE = 'https://www.mockmob.in';
// Crockford base32 without I, L, O and U. 8 characters is 40 bits.
export const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODE_RE = /^[0-9A-HJKMNP-TV-Z]{8}$/;
// SOCIAL-SPEC P3 reads ^[\p{L}][\p{L} .'-]{1,17}$; combining marks (\p{M}) are added after the first letter, because
// Devanagari and other Indian scripts write vowel signs and the virama as marks (अनन्या would otherwise be refused).
const NAME_RE = /^[\p{L}][\p{L}\p{M} .'-]{1,17}$/u;
const LETTERS = 'ABCDEFGH';
const DAY_MS = 86_400_000;
const IST_OFFSET = '+05:30';

// ---------- Errors: one code, one HTTP status, one plain sentence (G11 unified shape) ----------

export const ERRORS = Object.freeze({
  UNAUTHENTICATED: [401, 'Sign in to use your Mob.'],
  MOB_DISABLED: [404, 'This page is not available.'],
  NOT_IN_MOB: [404, 'You are not in a Mob.'],
  NOT_FOUND: [404, 'That member is not in your Mob.'],
  INVITE_INVALID: [404, 'This invite can\'t be used. Ask your friend for a new link.'],
  INVITE_EXPIRED: [410, 'This invite can\'t be used. Ask your friend for a new link.'],
  MOB_FULL: [409, 'This Mob is full: it has 5 members, the most a Mob can have. Ask your friend to tell you if a seat opens, or start a Mob of your own.'],
  ALREADY_IN_MOB: [409, 'You are already in this Mob.'],
  MOB_LIMIT: [409, 'You already started a Mob. Free lets you start one, and join as many as friends invite you to. Pro lets you start up to 3.'],
  MOB_LIMIT_PRO: [409, 'You already started 3 Mobs, the most Pro allows. You can still join any Mob a friend invites you to.'],
  MOB_CEILING: [409, 'You are in 12 Mobs, the most one account can be in. Leave one to start or join another.'],
  INVITES_PAUSED: [503, 'New invites are paused for now. Your Mob works as before.'],
  JOIN_PAUSED: [503, 'Joining a Mob by link is paused for now. Try this link again later.'],
  WEEK_INVALID: [404, 'There is no Mob paper for that week.'],
  EXTRA_NOT_FOUND: [404, 'That extra paper is not in your Mob.'],
  COMPARE_SIT_FIRST: [409, 'Sit this paper first, then you can compare it with your Mob.'],
  NOT_SAT_THAT_WEEK: [409, 'You did not sit that week\'s paper, so there is nothing of yours to compare.'],
  COMPARE_PAST_ALONE: [409, 'Only one member sat that week\'s paper, so there is nothing to compare.'],
  BANK_THIN: [409, 'There are not enough questions ready for that paper.'],
  MOB_REQUIRED: [422, 'Say which Mob this is for.'],
  PRO_REQUIRED: [402, 'This part of the Mob is included with Pro.'],
  COMPARE_UNAVAILABLE: [409, 'There is nothing to compare yet. It needs one more member to sit this paper.'],
  SHARE_FIRST: [409, 'Share your answers with your Mob to compare. Members who share see each other, never a ranking.'],
  COMPARE_WAITING: [409, 'No one else has shared their answers yet. Your first comparison stays free until someone does.'],
  FREE_PAPER_USED: [409, 'You already sat a Mob paper this week. Pro lets you sit one in every Mob.'],
  EXTRA_LIMIT: [409, 'Your Mob already has 3 extra papers this week. It can make more next week.'],
  EXTRA_CLOSED: [410, 'This extra paper has closed.'],
  CHAPTER_INVALID: [422, 'Choose a chapter of this subject.'],
  LENGTH_INVALID: [422, 'Choose 5, 10, 15 or 20 questions.'],
  NOT_OWNER: [403, 'Only the member who started the Mob can remove someone.'],
  NOT_SAT_YET: [409, 'Sit this week\'s paper first, then you can ask the others.'],
  ALREADY_NUDGED: [409, 'You already asked the others this week.'],
  PAPER_ALREADY_SAT: [409, 'You already sat this week\'s paper. The next one opens Monday.'],
  // An extra paper has no Monday: it stays open 7 days from when it was made, and each member sits it once.
  EXTRA_ALREADY_SAT: [409, 'You already sat this extra paper. Your answers are under See your answers.'],
  WEEK_CLOSED: [410, 'This week\'s paper closed. The next one opens Monday.'],
  PAPER_EXPIRED: [410, 'Your time on this week\'s paper ran out. The next one opens Monday.'],
  CREDITS: [402, 'You do not have enough credits for this paper.'],
  NAME_INVALID: [422, 'Use 2 to 18 letters for your name. Spaces, dots, apostrophes and hyphens are fine.'],
  NAME_REFUSED: [422, 'Choose a different name. Your Mob sees it.'],
  SUBJECT_INVALID: [422, 'Choose one of your subjects.'],
  // No subjects on the account: the way forward is to choose them (the web sends /onboarding?edit=true&back=/mob).
  NO_SUBJECTS: [422, 'Choose your CUET subjects first. A Mob sits one paper a week in one of them.'],
  COLOUR_INVALID: [422, 'Choose one of the 8 colours.'],
  REASON_INVALID: [422, 'Choose why you are reporting.'],
  BODY_INVALID: [422, 'Something in the request was not right. Try again.'],
  RATE_LIMITED: [429, 'Too many tries in a short time. Try again in a few minutes.'],
  PAPER_UNAVAILABLE: [503, 'This week\'s paper could not be built just now. Nothing was charged. Try again shortly.'],
  MIGRATION: [503, 'Your Mob is not available just now. Try again shortly.'],
  UNAVAILABLE: [503, 'Your Mob did not load. Try again shortly.'],
});

export class MobError extends Error {
  /** extra.message: a sentence that says more than the code's own (the real wait, the real count); extra.detail: data
   *  a screen can act on (the nearest paper the bank can build). Both are sent; the cause never is. */
  constructor(code, extra = {}) {
    super(code);
    this.code = ERRORS[code] ? code : 'UNAVAILABLE';
    this.status = ERRORS[this.code][0];
    this.extra = extra;
  }
}

/** The error body every route sends: { error: { code, message } }, plus `detail` when the screen can act on it. */
export function errorBody(code, { message = null, detail = null } = {}) {
  const known = ERRORS[code] ? code : 'UNAVAILABLE';
  return { error: { code: known, message: typeof message === 'string' && message ? message : ERRORS[known][1], ...(detail ? { detail } : {}) } };
}
export const errorStatus = (code) => (ERRORS[code] || ERRORS.UNAVAILABLE)[0];

// ---------- The week (Monday to Sunday, IST) ----------

const addDays = (key, d) => new Date(Date.parse(`${key}T00:00:00Z`) + d * DAY_MS).toISOString().slice(0, 10);
/** Monday (YYYY-MM-DD) of the IST week holding `now`. */
export const mobWeek = (now) => weekStart(localDay(now, TIMEZONE));
/** The instant the week's paper closes: Sunday 11:59:59 PM IST. */
export const closesAt = (week) => new Date(Date.parse(`${addDays(week, 6)}T23:59:59${IST_OFFSET}`)).toISOString();
/** The instant the next week's paper opens: Monday 12:00 AM IST. */
export const nextOpensAt = (week) => new Date(Date.parse(`${addDays(week, 7)}T00:00:00${IST_OFFSET}`)).toISOString();
/** A paper started now would run past the close (its time plus slack), so it could never count. */
export const tooLateToStart = (week, now) => now + START_WINDOW_SECONDS * 1000 > Date.parse(nextOpensAt(week));
/** A sitting counts only when it finished before the close. */
export const finishedInWindow = (week, finishedAt) => Number.isFinite(finishedAt) && finishedAt < Date.parse(nextOpensAt(week));

// ---------- Input rules ----------

/** Display name: NFC, spaces collapsed and trimmed. */
export const cleanName = (raw) => (typeof raw === 'string' ? raw.normalize('NFC').replace(/\s+/g, ' ').trim() : '');

/** { ok, name } or { ok: false, code } (NAME_INVALID or NAME_REFUSED). The blocklist is data/mob_name_blocklist.json. */
export function checkName(raw, blocklist = null) {
  const name = cleanName(raw);
  if (!name || [...name].length > NAME_MAX || !NAME_RE.test(name)) return { ok: false, code: 'NAME_INVALID' };
  if (blocklist && nameBlocked(name, blocklist)) return { ok: false, code: 'NAME_REFUSED' };
  return { ok: true, name };
}

export function nameBlocked(name, { contains = [], words = [] } = {}) {
  const lower = cleanName(name).toLowerCase();
  const folded = lower.replace(/[\s.'-]+/g, '');
  if (contains.some((t) => t && folded.includes(t))) return true;
  const parts = lower.split(/[\s.'-]+/).filter(Boolean);
  return parts.some((p) => words.includes(p));
}

export const checkColour = (v) => Number.isInteger(v) && v >= 0 && v < COLOUR_COUNT;

/** A code as typed or pasted: Crockford reading (O is 0, I and L are 1), upper case, no spaces or hyphens. */
export function normalizeCode(raw) {
  if (typeof raw !== 'string') return null;
  const code = raw.toUpperCase().replace(/[\s-]+/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return CODE_RE.test(code) ? code : null;
}

/** 8 Crockford characters from 5 random bytes (40 bits). */
export function codeFromBytes(bytes) {
  let bits = 0n;
  for (let i = 0; i < 5; i += 1) bits = (bits << 8n) | BigInt(bytes[i] & 255);
  let out = '';
  for (let i = 7; i >= 0; i -= 1) out += CODE_ALPHABET[Number((bits >> BigInt(i * 5)) & 31n)];
  return out;
}

export const inviteUrl = (code) => `${SITE}/join/${code}`;
export const REPORT_REASONS = Object.freeze(['name', 'nudge', 'safety']);

// ---------- The shared trap (P7) ----------

/**
 * sittings: [{ picks: number[] }] in paper order (-1 blank); keys: the key's option index per paper question.
 * Returns { questionNumber, questionIndex, optionIndex, count, of } or null. Never says who picked it.
 */
export function computeTrap(sittings, keys) {
  const list = Array.isArray(sittings) ? sittings : [];
  if (list.length < TRAP_MIN_SITTERS || !Array.isArray(keys)) return null;
  const of = list.length;
  let best = null;
  for (let q = 0; q < keys.length; q += 1) {
    const key = keys[q];
    if (!Number.isInteger(key) || key < 0) continue; // a question with no readable key names no trap
    const counts = new Map();
    for (const s of list) {
      const pick = Array.isArray(s?.picks) ? s.picks[q] : -1;
      if (Number.isInteger(pick) && pick >= 0 && pick !== key) counts.set(pick, (counts.get(pick) || 0) + 1);
    }
    for (const [optionIndex, count] of [...counts].sort((a, b) => a[0] - b[0])) {
      if (count < TRAP_MIN_PICKS || count * 2 < of) continue;
      if (!best || count > best.count) best = { questionNumber: q + 1, questionIndex: q, optionIndex, count, of };
    }
  }
  return best;
}

export const letterFor = (i) => LETTERS[i] || String(i + 1);

// ---------- Together: what a Mob of two can compare (P5, P7) ----------

/**
 * What you and the other sitters who show their score have in common on this week's paper, so two friends who both sat
 * see something about each other (the trap needs 3 sitters). Only when you sat AND chose to show your score, and only
 * over the other sitters who chose the same: each of them already shows "7 of 10" beside their name, so a shared count
 * adds no private detail. A count and one shared miss; never who did better, never anyone who kept their score private.
 * sittings: [{ user_id, picks }]; keys: the key's option index per paper question (-1 unreadable); optedIn: user ids.
 * Returns { with, sameRight, of, sharedMiss } or null.
 */
export function computeTogether(sittings, keys, { userId, optedIn } = {}) {
  const list = Array.isArray(sittings) ? sittings : [];
  const shows = optedIn instanceof Set ? optedIn : new Set(optedIn || []);
  const mine = list.find((s) => s?.user_id === userId);
  if (!mine || !shows.has(userId) || !Array.isArray(keys)) return null;
  const peers = list.filter((s) => s?.user_id !== userId && shows.has(s?.user_id));
  if (!peers.length) return null;
  const group = [mine, ...peers];
  const right = (s, q) => Array.isArray(s.picks) && s.picks[q] === keys[q];
  let sameRight = 0;
  let of = 0;
  let sharedMiss = null;
  for (let q = 0; q < keys.length; q += 1) {
    if (!Number.isInteger(keys[q]) || keys[q] < 0) continue; // a question with no readable key is left out of both
    of += 1;
    if (group.every((s) => right(s, q))) sameRight += 1;
    else if (sharedMiss === null && group.every((s) => !right(s, q))) sharedMiss = q + 1;
  }
  return of ? { with: peers.length, sameRight, of, sharedMiss } : null;
}

/** "You and 1 other member both got 6 of the same questions right. You both missed question 4." No rank, no names. */
export function togetherLine(t) {
  if (!t) return '';
  const two = t.with === 1;
  const you = two ? 'You and 1 other member' : `You and ${t.with} other members`;
  const first = t.sameRight === 0
    ? `${you} got no question right in common.`
    : `${you} ${two ? 'both' : 'all'} got ${t.sameRight === 1 ? 'the same question' : `the same ${t.sameRight} questions`} right.`;
  return t.sharedMiss ? `${first} ${two ? 'You both' : 'You all'} missed question ${t.sharedMiss}.` : first;
}

// ---------- The teaser (free): where the Mob split, in one line, never who was right ----------

/** t: { split, of, with: name | null }. */
export function teaserLine(t) {
  if (!t) return '';
  const q = (n) => `${n} ${n === 1 ? 'question' : 'questions'}`;
  if (t.with) return t.split === 0 ? `You and ${t.with} picked the same on every question.` : `You and ${t.with} split on ${q(t.split)}.`;
  return t.split === 0 ? 'Your Mob picked the same on every question.' : `Your Mob split on ${t.split} of ${t.of} questions.`;
}

// ---------- The cost line (D-S2 default: exactly what a quick 10 costs) ----------

/** cost: { type: 'included'|'allowance'|'credits', credits?, balance? }. Never a number the server did not supply. */
export function costLine(cost) {
  if (!cost || typeof cost !== 'object') return '';
  if (cost.type === 'free') return 'Free. No credits.';
  if (cost.type === 'included') return 'Included with Pro.';
  if (cost.type === 'allowance') return 'Free today.';
  if (cost.type === 'credits' && Number.isFinite(cost.credits)) {
    if (!Number.isFinite(cost.balance)) return `${cost.credits} credits.`;
    if (cost.balance < cost.credits) return `${cost.credits} credits. You have ${cost.balance}, so you need ${cost.credits - cost.balance} more.`;
    return `${cost.credits} credits. You have ${cost.balance}.`;
  }
  return '';
}
export const canAfford = (cost) => !cost || cost.type !== 'credits' || !Number.isFinite(cost.balance) || cost.balance >= cost.credits;

// ---------- Words and dates (12-hour IST, no arrows, no exclamation marks) ----------

export const ringLine = (sat, size) => `${sat} of ${size} sat this week`;
export const CLOSES_LINE = 'Closes Sunday 11:59 PM';
export const CLOSED_LINE = 'This week\'s paper closed. Next one opens Monday.';
export const seatsLine = (n) => (n === 1 ? '1 seat left' : `${n} seats left`);
export const initialOf = (name) => (cleanName(name)[0] || '?').toLocaleUpperCase('en-IN');
export const nudgeLine = (fromName) => `${fromName} sat it and asked you to sit it too.`;
export const trapLine = (trap) => trap ? `Your Mob's trap: ${trap.count} of ${trap.of} picked ${trap.option} on question ${trap.questionNumber}.` : '';

const partsIST = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
  return Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
};
/** "Fri 23 Oct, 9:40 PM" in IST. */
export function istDateTime(iso) {
  const p = partsIST(iso);
  if (!p) return '';
  return `${p.weekday} ${p.day} ${p.month}, ${p.hour}:${p.minute} ${String(p.dayPeriod || '').toUpperCase()}`;
}
export const inviteExpiryLine = (iso) => (istDateTime(iso) ? `Link works until ${istDateTime(iso)}` : '');

/**
 * The real wait, in plain words: "in a minute", "in 25 minutes", "in 3 hours", "on Fri 23 Oct, 9:40 PM" (12-hour IST).
 * seconds: how long until the limit lets the student through; now: the clock the wait is counted from.
 */
export function waitPhrase(seconds, now = Date.now()) {
  const s = Math.max(1, Math.ceil(Number(seconds) || 0));
  if (s <= 90) return 'in a minute';
  if (s < 3600) return `in ${Math.ceil(s / 60)} minutes`;
  if (s < 5400) return 'in about an hour';
  if (s < 86_400) return `in ${Math.round(s / 3600)} hours`;
  const at = istDateTime(new Date(now + s * 1000).toISOString());
  return at ? `on ${at}` : `in ${Math.ceil(s / 86_400)} days`;
}

// ---------- One member's view (the GET /api/mob shape) ----------

/**
 * state: what mob_state returns (snake_case rows). opts:
 *   userId, now, memberIdFor(userId) -> string, cost, trap (already enriched: { ...computeTrap, questionId, option,
 *   trapName, youPicked }), together (computeTogether's answer), subjectName,
 *   plan { pro }, mobs [{ id, subject, subjectName }] (all the student's Mobs), compare (the free teaser and the access
 *   the plan gives, from the service), extras (this week's Pro extra papers as the student sees them), freeBlocked
 * Returns { mob: null } or { mob: {...} }.
 */
export function buildView(state, { userId, now, memberIdFor, cost = null, trap = null, together = null, subjectName = null, plan = null, mobs = null, compare = null, extras = null, freeBlocked = false, started = null, invitesPaused = false } = {}) {
  if (!state || !state.mob) return { mob: null };
  const week = state.week;
  const members = Array.isArray(state.members) ? [...state.members] : [];
  // P5: join order, whatever order rows arrived in. Ties (same instant) break on the server's stable id order.
  members.sort((a, b) => Date.parse(a.joined_at) - Date.parse(b.joined_at) || String(a.user_id).localeCompare(String(b.user_id)));
  const ownerId = (members.find((m) => m.role === 'owner') || members[0])?.user_id;
  const sittings = new Map((state.sittings || []).map((s) => [s.user_id, s]));
  const me = members.find((m) => m.user_id === userId);
  if (!me) return { mob: null };
  const mine = sittings.get(userId) || null;
  // Closed: too late to start a paper that could still count (it would run past Sunday 11:59 PM).
  const closed = tooLateToStart(week, now);
  const memberOut = (m) => {
    const s = sittings.get(m.user_id);
    const out = { memberId: memberIdFor(m.user_id), name: m.display_name, colour: m.colour, you: m.user_id === userId, sat: Boolean(s) };
    // P5: another member's score only when that member chose to show it; your own is always yours.
    if (s && (m.show_score || m.user_id === userId)) out.score = { value: Number(s.score), of: Number(s.max_score) };
    if (m.user_id === ownerId) out.owner = true;
    return out;
  };
  const sat = members.filter((m) => sittings.has(m.user_id)).length;
  const size = members.length;
  const iSent = (state.nudges || []).some((n) => n.from_user === userId);
  const waiting = members.some((m) => m.user_id !== userId && !sittings.has(m.user_id));
  const unseen = (state.nudges || []).filter((n) => n.from_user !== userId && !n.seen && members.some((m) => m.user_id === n.from_user));
  const received = !mine && !me.nudges_muted && unseen.length ? { fromName: members.find((m) => m.user_id === unseen[0].from_user).display_name } : null;
  const nudgeReason = !mine ? 'not_sat' : iSent ? 'sent' : !waiting ? 'everyone_sat' : closed ? 'closed' : null;
  const inv = state.invite;
  const seatsLeft = MAX_MEMBERS - size;
  const usesLeft = inv ? Math.min(seatsLeft, Math.max(0, Number(inv.max_uses) - Number(inv.uses))) : 0;
  const inviteOut = inv && usesLeft > 0 && Date.parse(inv.expires_at) > now
    ? { code: inv.code, url: inviteUrl(inv.code), expiresAt: new Date(inv.expires_at).toISOString(), usesLeft } : null;
  const pro = plan?.pro === true;
  const mobList = Array.isArray(mobs) && mobs.length ? mobs : [{ id: state.mob.id, subject: state.mob.subject, subjectName: subjectName || state.mob.subject }];
  const maxMobs = pro ? PRO_MAX_MOBS : FREE_MAX_MOBS;
  // How many of these Mobs the student started (the plan caps starting; joining is open to every plan).
  const startedCount = Number.isInteger(started) ? started : mobList.length;
  return {
    mob: {
      id: state.mob.id,
      subject: state.mob.subject,
      subjectName: subjectName || state.mob.subject,
      plan: { pro, maxMobs, mobCount: mobList.length, started: startedCount, canMakeExtra: pro, canStartAnother: startedCount < maxMobs && mobList.length < MAX_MEMBERSHIPS },
      mobs: mobList.map((x) => ({ id: x.id, subject: x.subject, subjectName: x.subjectName || x.subject, active: x.id === state.mob.id })),
      you: { memberId: memberIdFor(userId), name: me.display_name, colour: me.colour, role: userId === ownerId ? 'owner' : 'member', showScore: Boolean(me.show_score), nudgesMuted: Boolean(me.nudges_muted) },
      members: members.map(memberOut),
      seatsLeft,
      week: {
        start: week,
        closesAt: closesAt(week),
        closed,
        paper: { count: PAPER_COUNT, durationSec: PAPER_SECONDS, cost, blocked: freeBlocked ? 'free_used' : null },
        sat, size, youSat: Boolean(mine),
        yourResultId: mine ? mine.session_id : null,
      },
      // P7: only to a member who sat; the server already returned null under 3 sitters.
      trap: mine && trap ? trap : null,
      // Only to a sitter who shows their score, when another sitter does too (computeTogether). Left out otherwise, so
      // the contract shape is unchanged for every member it does not apply to.
      ...(mine && together ? { together } : {}),
      // The free teaser and what this plan may open (src/lib/mob/compare.mjs). Null until you sat and 2 have sat.
      compare: mine && compare ? compare : null,
      // This week's extra papers (Pro makes them; any member sits them), and how many past weeks have a paper (Pro opens them).
      extras: Array.isArray(extras) ? extras : [],
      pastWeeks: Number(state.past_weeks) || 0,
      nudge: { canSend: nudgeReason === null, reason: nudgeReason, received },
      invite: invitesPaused ? null : inviteOut,
      // The stop rule's switch (MOB_INVITES_ENABLED=false): sent only while invites are paused, so the shape is unchanged
      // the rest of the time.
      ...(invitesPaused ? { invitesPaused: true } : {}),
    },
  };
}

/** The trap payload a member who sat receives (no member ids, no names). */
export function trapPayload(raw, { questionId, trapName = null, youPicked = null, key = null } = {}) {
  if (!raw) return null;
  return {
    questionNumber: raw.questionNumber,
    questionId,
    option: letterFor(raw.optionIndex),
    count: raw.count,
    of: raw.of,
    trapName: trapName || null,
    youPickedIt: Number.isInteger(youPicked) && youPicked === raw.optionIndex,
    youGotItRight: Number.isInteger(youPicked) && Number.isInteger(key) && youPicked === key,
  };
}

/** Sitting picks from a finished attempt, in the paper's order (-1 for blank or missing). */
export function picksFromAttempt(questionIds, attempt) {
  const given = new Map((attempt?.details || []).map((d) => [d?.qid, d?.givenIndex]));
  return (questionIds || []).map((id) => (Number.isInteger(given.get(id)) && given.get(id) >= 0 ? given.get(id) : -1));
}

/** The runner link for this week's Mob paper. The key only names this device's draft; the server derives its own. */
export const paperHref = (mob, extra = null) => `/test?${new URLSearchParams({
  subject: mob.subject, mode: 'quick', count: String(extra?.count || PAPER_COUNT), mob: '1', mobId: mob.id || '',
  generationKey: `mob-${extra?.id || mob.week.start}-${mob.you.memberId}`, ...(extra ? { extra: extra.id } : {}),
})}`;
/** A result link for "See your answers". */
export const resultHref = (id) => `/result/${encodeURIComponent(id)}`;
