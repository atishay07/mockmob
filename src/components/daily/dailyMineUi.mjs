// The page half of "Your five" (owner LK365, 21 Nov 2026; design tmp/1121-stories/DAILY-SPEC.md; the server's shapes
// tmp/1121-stories/daily/CONTRACT.md). Pure and browser-safe, so node --test holds it (data/tests/daily_mine_ui_1121.test.mjs):
//   the device's note of which five it plays today (personal or shared) and what each check fed (`fed`),
//   the line a guest or a signed-in student without a personal five reads, and the day's end: what today's five did and the
//   one next step. The rules and words of the five themselves are src/lib/dailyFiveMine.mjs (the server lane's); this file
//   does not copy them.
import { DAILY_FIVE_SIZE, isDateKey } from '../../lib/dailyFive.mjs';
import { MINE_COPY, fedCounts, fedLines } from '../../lib/dailyFiveMine.mjs';

/**
 * This device's note for today (localStorage): { v, date, user, personal, fed: { [n]: 'mistakes' | 'fixed' | null } }.
 * Written when the page is handed a personal five, so a reload mid-five never swaps the five under the student's answers:
 * a run begun on this device today with no personal note is the shared five, and stays it.
 */
export const DAILY_MINE_STORE = 'mm:daily-mine:v1';
const FED = new Set(['mistakes', 'fixed']);

/** The note for this date and student, or null (another day, another account, or anything unreadable). */
export function readMark(raw, { date, userId }) {
  let mark = raw;
  if (typeof raw === 'string') { try { mark = JSON.parse(raw); } catch { return null; } }
  if (!mark || typeof mark !== 'object' || mark.v !== 1 || !isDateKey(date) || mark.date !== date || !userId || mark.user !== userId) return null;
  const fed = {};
  for (let n = 1; n <= DAILY_FIVE_SIZE; n += 1) {
    if (!mark.fed || !Object.prototype.hasOwnProperty.call(mark.fed, n)) continue;
    fed[n] = FED.has(mark.fed[n]) ? mark.fed[n] : null;
  }
  return { v: 1, date, user: userId, personal: mark.personal === true, fed };
}

/** A fresh note (keeping the `fed` of one already held for the same day and student). */
export function markFor({ date, userId, personal }, held = null) {
  const same = held && held.date === date && held.user === userId;
  return { v: 1, date, user: userId, personal: personal === true, fed: same ? { ...held.fed } : {} };
}

/** The note with place n's `fed` kept. The first answer of a place stands: a retry (fed null from the server) changes nothing. */
export function keepFed(mark, n, fed) {
  if (!mark || !Number.isInteger(n) || n < 1 || n > DAILY_FIVE_SIZE) return mark;
  if (Object.prototype.hasOwnProperty.call(mark.fed || {}, n)) return mark;
  return { ...mark, fed: { ...(mark.fed || {}), [n]: FED.has(fed) ? fed : null } };
}

/** The `fed` of a check's raw body: 'mistakes', 'fixed' or null (absent on guests and the shared five). */
export const fedOf = (body) => (body && FED.has(body.fed) ? body.fed : null);

/**
 * What today's five did, from the note alone (the contract: count only what `fed` holds; a reload before a place's answer
 * came back loses that place's `fed`). { counts: { fixed, sent }, lines: [...], known: places with a `fed` }.
 * With every place known and nothing fed, one honest line says so.
 */
export function didLines(mark) {
  const fed = mark?.fed || {};
  const known = Object.keys(fed).length;
  const counts = fedCounts(Object.values(fed));
  const lines = fedLines(counts);
  if (!lines.length && known === DAILY_FIVE_SIZE) lines.push('Nothing sent back to your mistakes.');
  return { counts, lines, known };
}

/** Practice's address for ten on one chapter (the same shape Study and the Lab use: src/components/study/studyCopy.js). */
export const PRACTICE_COUNT = 10;
export function practiceHref(slug, chapter, count = PRACTICE_COUNT) {
  // The page slug ('business-studies') to the id Practice links with ('business_studies'): src/lib/subjectPages.mjs publicId.
  const subject = typeof slug === 'string' && /^[a-z][a-z-]{1,39}$/.test(slug) ? slug.replace(/-/g, '_') : null;
  if (!subject) return `/dashboard?mode=quick&count=${count}`;
  return `/dashboard?${new URLSearchParams({ subject, ...(chapter ? { chapter } : {}), mode: 'quick', count: String(count) })}`;
}

export const REVISE_HREF = '/review/revise';

/**
 * The one next step after a personal five. Something still open (an answer sent back to the mistakes, or a miss whose `fed`
 * was lost to a reload): Revise, where today's misses come back tomorrow (data/revise.js: a new card is due one day after the
 * wrong answer). Else ten more on the weak chapter (the first `weak` place's chapter; with none, the first place's).
 */
export function nextStep({ counts, marks, questions }) {
  const open = (counts?.sent || 0) > 0 || (Array.isArray(marks) && marks.some((m) => m === false));
  if (open) return { kind: 'revise', href: REVISE_HREF, label: 'Open Revise', note: 'Your misses come back in Revise or in a later five.' };
  const list = Array.isArray(questions) ? questions : [];
  const q = list.find((x) => x?.why?.kind === 'weak') || list[0] || null;
  if (!q) return { kind: 'practice', href: practiceHref(null, null), label: `Practise ${PRACTICE_COUNT} more`, note: '' };
  const chapter = q.why?.chapter || q.chapter || '';
  return {
    kind: 'practice',
    href: practiceHref(q.slug, chapter),
    label: chapter ? `Practise ${PRACTICE_COUNT} on ${chapter}` : `Practise ${PRACTICE_COUNT} more`,
    note: q.why?.kind === 'weak' ? 'Your weak chapter, in Practice.' : '',
  };
}

/**
 * The one line under the five's rules, by who is looking: a guest; a signed-in student with their own five (what a miss does);
 * a signed-in student on the shared five (why, where it helps). null only while it is not known which five they are.
 */
export function noteFor({ signedIn, mine }) {
  if (!signedIn) return MINE_COPY.guest;
  if (!mine) return null;
  if (mine.personal) return 'Get one wrong and it comes back in a later five.';
  switch (mine.reason) {
    case 'no_subjects': return 'Choose your subjects and your five come from them and your mistakes.';
    case 'shared_started': return 'You started today’s shared five, so you finish that one today.';
    case 'thin_bank': return 'Not enough new questions in your subjects today, so this is the shared five.';
    // 'off', 'unavailable', or no answer at all: the shared five, said plainly (never an error), and the line keeps its room.
    default: return 'Today it’s the shared five, the same for everyone.';
  }
}
