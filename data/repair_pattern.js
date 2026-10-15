// Mistake Repair v3: the trap pattern line (build spec 15 Oct 2026, section A.7). Pure, free, no model.
//
// "2 of your 3 repaired mistakes in Correct Word Usage had the same trap: a look-alike term."
// Counted only from the student's own committed v3 repairs (the trap type stored on each receipt), with the current
// repair counted once. v1 and v2 repairs carry no trap type, so they count in neither the numerator nor the
// denominator. A trap of `other` names nothing, so it never makes a line. No forecast, no cause.

import { TRAP_LABELS } from './repair_presentation.mjs';

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

const clean = (v) => (typeof v === 'string' ? v.trim() : '');
const mappedChapter = (c) => { const v = clean(c); return v && v.toLowerCase() !== UNMAPPED ? v : ''; };

/**
 * @param {{ rows: Array<{operation_key:string, trap?:string|null, subject?:string|null, chapter?:string|null}>,
 *           current: { mistakeKey:string, trapType:string, subject:string, chapter?:string|null },
 *           subjectName?: string }} input
 * @returns {{ line:string, scope:'chapter'|'subject', k:number, n:number, trapType:string } | null}
 */
export function buildRepairPattern({ rows, current, subjectName } = {}) {
  const trapType = clean(current?.trapType);
  const subject = clean(current?.subject);
  if (!TYPED.has(trapType) || !subject) return null;
  const currentKey = clean(current?.mistakeKey);
  const chapter = mappedChapter(current?.chapter);

  // One row per mistake (the newest, rows arrive newest first), the current mistake left out and counted from memory.
  const seen = new Set(currentKey ? [currentKey] : []);
  const typed = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = mistakeKeyOf(row?.operation_key);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const trap = clean(row?.trap);
    if (!Object.hasOwn(TRAP_LABELS, trap)) continue; // v1 and v2 repairs have no trap type
    typed.push({ trap, subject: clean(row?.subject), chapter: clean(row?.chapter) });
  }

  const phrase = trapPhrase(trapType);
  const inSubject = typed.filter((r) => r.subject === subject);
  if (chapter) {
    const inChapter = inSubject.filter((r) => r.chapter === chapter);
    const n = inChapter.length + 1;
    const k = inChapter.filter((r) => r.trap === trapType).length + 1;
    if (n >= PATTERN_RULES.chapter.minRepairs && k >= PATTERN_RULES.chapter.minSame) {
      return { line: `${k} of your ${n} repaired mistakes in ${chapter} had the same trap: ${phrase}.`, scope: 'chapter', k, n, trapType };
    }
  }
  const n = inSubject.length + 1;
  const k = inSubject.filter((r) => r.trap === trapType).length + 1;
  const name = clean(subjectName) || subject;
  if (n >= PATTERN_RULES.subject.minRepairs && k >= PATTERN_RULES.subject.minSame && k / n >= PATTERN_RULES.subject.minShare) {
    return { line: `${k} of your ${n} repaired ${name} mistakes had the same trap: ${phrase}.`, scope: 'subject', k, n, trapType };
  }
  return null;
}
