// Mistake Repair v3: the trap pattern line (build spec 15 Oct 2026, section A.7). Pure, free, no model.
//
// "Since 9 Oct, 2 of your 3 repairs in Correct Word Usage had this trap."
// Counted only from the student's own committed v3 repairs (the trap type stored on each receipt), with the current
// repair counted once. v1 and v2 repairs carry no trap type, so they count in neither the numerator nor the
// denominator. The line is therefore dated from the earliest repair it counts ("Since 9 Oct", India time): from that
// day on, every repair in its scope is a typed one, so "k of your n repairs" is the whole count for that period, not a
// part of it. When an untyped repair that could belong to the scope falls inside that period (a rollback to the v1
// prompt), or a counted repair has no date, the count would not be the whole count, so there is no line.
// A trap of `other` names nothing, so it never makes a line. No forecast, no cause.

import { TRAP_LABELS } from './repair_presentation.mjs';
import { istDayMonth } from './attempt_ledger.js';

export const PATTERN_RULES = Object.freeze({
  chapter: Object.freeze({ minRepairs: 3, minSame: 2 }),
  subject: Object.freeze({ minRepairs: 5, minSame: 3, minShare: 0.3 }),
});
const UNMAPPED = 'unmapped chapter';
const TYPED = new Set(Object.keys(TRAP_LABELS).filter((t) => t !== 'other'));

/** The mistake a reservation belongs to: its operation key without the trailing `:{requestId}`. */
export function mistakeKeyOf(operationKey) {
  const key = String(operationKey ?? '');
  const cut = key.lastIndexOf(':');
  return cut > 0 ? key.slice(0, cut) : key;
}

/** "A look-alike term" -> "a look-alike term". */
export function trapPhrase(trapType) {
  const label = TRAP_LABELS[trapType];
  return label ? label.charAt(0).toLowerCase() + label.slice(1) : null;
}

export const PATTERN_COPY = Object.freeze({
  chapter: (date, k, n, chapter) => `Since ${date}, ${k} of your ${n} repairs in ${chapter} had this trap.`,
  subject: (date, k, n, subject) => `Since ${date}, ${k} of your ${n} repairs in ${subject} had this trap.`,
});

const clean = (v) => (typeof v === 'string' ? v.trim() : '');
const mappedChapter = (c) => { const v = clean(c); return v && v.toLowerCase() !== UNMAPPED ? v : ''; };
const timeOf = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const ms = Date.parse(clean(v));
  return Number.isFinite(ms) ? ms : NaN;
};

/**
 * @param {{ rows: Array<{operation_key:string, trap?:string|null, subject?:string|null, chapter?:string|null, created_at?:string}>,
 *           current: { mistakeKey:string, trapType:string, subject:string, chapter?:string|null, at?:number|string },
 *           subjectName?: string }} input
 *   `current.at` is when this repair was made (now for a fresh one, its generatedAt for a saved one).
 * @returns {{ line:string, scope:'chapter'|'subject', k:number, n:number, trapType:string, since:number } | null}
 */
export function buildRepairPattern({ rows, current, subjectName } = {}) {
  const trapType = clean(current?.trapType);
  const subject = clean(current?.subject);
  if (!TYPED.has(trapType) || !subject) return null;
  const currentKey = clean(current?.mistakeKey);
  const chapter = mappedChapter(current?.chapter);
  const list = Array.isArray(rows) ? rows : [];

  // When this repair was made: the earliest of its own date and any stored row of the same mistake.
  let currentAt = timeOf(current?.at);
  for (const row of list) {
    if (!currentKey || mistakeKeyOf(row?.operation_key) !== currentKey) continue;
    const at = timeOf(row?.created_at);
    if (Number.isFinite(at) && !(at >= currentAt)) currentAt = at;
  }
  if (!Number.isFinite(currentAt)) return null;

  // One row per mistake (the newest, rows arrive newest first), the current mistake left out and counted from memory.
  const seen = new Set(currentKey ? [currentKey] : []);
  const typed = [];
  const untyped = [];
  for (const row of list) {
    const key = mistakeKeyOf(row?.operation_key);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const entry = { subject: clean(row?.subject), chapter: clean(row?.chapter), at: timeOf(row?.created_at) };
    const trap = clean(row?.trap);
    if (Object.hasOwn(TRAP_LABELS, trap)) typed.push({ ...entry, trap });
    else untyped.push(entry); // v1 and v2 repairs have no trap type
  }

  // One scope: k of n typed repairs in it, dated from the earliest. `typedIn` says a typed row is in the scope; a row
  // that is not fully known (no trap type, or no subject or chapter stored) is checked with `mayBeIn`. If such a row
  // falls on or after the start date, the count for the period would not be whole, so the scope gives nothing.
  const count = (typedIn, mayBeIn, byChapter) => {
    const counted = typed.filter(typedIn);
    if (counted.some((r) => !Number.isFinite(r.at))) return null;
    const since = Math.min(currentAt, ...counted.map((r) => r.at));
    const unknown = [...untyped, ...typed.filter((r) => !r.subject || (byChapter && !r.chapter))];
    if (unknown.some((r) => mayBeIn(r) && !(r.at < since))) return null;
    return { n: counted.length + 1, k: counted.filter((r) => r.trap === trapType).length + 1, since };
  };

  if (chapter) {
    const c = count(
      (r) => r.subject === subject && r.chapter === chapter,
      (r) => !r.subject || (r.subject === subject && (!r.chapter || r.chapter === chapter)),
      true,
    );
    if (c && c.n >= PATTERN_RULES.chapter.minRepairs && c.k >= PATTERN_RULES.chapter.minSame) {
      return { line: PATTERN_COPY.chapter(istDayMonth(c.since), c.k, c.n, chapter), scope: 'chapter', k: c.k, n: c.n, trapType, since: c.since };
    }
  }
  const s = count((r) => r.subject === subject, (r) => !r.subject || r.subject === subject, false);
  const name = clean(subjectName) || subject;
  if (s && s.n >= PATTERN_RULES.subject.minRepairs && s.k >= PATTERN_RULES.subject.minSame && s.k / s.n >= PATTERN_RULES.subject.minShare) {
    return { line: PATTERN_COPY.subject(istDayMonth(s.since), s.k, s.n, name), scope: 'subject', k: s.k, n: s.n, trapType, since: s.since };
  }
  return null;
}
