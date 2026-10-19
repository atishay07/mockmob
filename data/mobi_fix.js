// "Fix it for good" (C-dec 3 and 3b, 20 Oct 2026): Mistake Repair as Mobi's flagship job, 1 credit on every plan. One
// model call writes the repair (the trap, why the student's option looked right, why the key is right, one rule); what this
// file adds costs no call: the student's own history of that trap, the order the job is shown in, and when the fix is held.
// Pure, so data/tests/mobi_fix.test.mjs pins it; src/services/recovery/repairFlow.js and repairCheck.js use it.
import { trapPhrase } from './trap_atlas.js';

export const FIX_PRICE = 1;
export const FIX_CHECKS = 2;
export const FIX_STEPS = Object.freeze(['trap', 'why_your_option', 'why_key', 'rule', 'check_1', 'check_2']);

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The student's own history of one trap, from "Traps you meet" (data/trap_atlas.js buildTrapsMeet rows): how often an option
 * carrying this trap caught them, out of how many chances. Null when the trap is unnamed or has no row yet (3 chances).
 */
export function trapHistoryFrom(rows, trapType) {
  if (!trapType || trapType === 'other' || !Array.isArray(rows)) return null;
  const row = rows.find((r) => r?.trapType === trapType);
  if (!row || !Number.isInteger(row.caught) || !Number.isInteger(row.of) || row.of < 1) return null;
  const line = row.caught > 1
    ? `This trap has caught you ${plural(row.caught, 'time')} in ${plural(row.of, 'chance')}. This fix is aimed at it.`
    : `This trap has caught you once in ${plural(row.of, 'chance')}.`;
  return { caught: row.caught, chances: row.of, line };
}

const optionText = (question, index) => {
  const o = question?.options?.[index];
  return String(typeof o === 'string' ? o : o?.text ?? '').trim();
};

/** The `mobi` block on a repair response: what the job is, in the order it is shown. */
export function fixJob({ repair = null, question = null, chosenIndex = null, keyIndex = null, history = null } = {}) {
  const type = repair?.trap_type && repair.trap_type !== 'other' ? repair.trap_type : null;
  return {
    job: 'fix',
    price: FIX_PRICE,
    checks: FIX_CHECKS,
    yourPick: Number.isInteger(chosenIndex) ? { index: chosenIndex, text: optionText(question, chosenIndex) } : null,
    key: Number.isInteger(keyIndex) ? { index: keyIndex, text: optionText(question, keyIndex) } : null,
    trap: type ? { type, phrase: trapPhrase(type) } : null,
    history,
    crowd: null,
    steps: FIX_STEPS,
  };
}

/**
 * Held: every fresh check of the repair answered right. `receipt` is the repair's committed receipt (check = the first
 * check's answer, check2 = the second's, offered2 = the second's offer). `secondOffered: false` says no second question
 * could be offered, so the first decides alone. Returns { held: true | false | null, heldLine }.
 */
export function heldOf(receipt, { secondOffered = null } = {}) {
  const first = receipt?.check || null;
  const second = receipt?.check2 || null;
  if ((first && first.right === false) || (second && second.right === false)) {
    return { held: false, heldLine: 'One check was wrong, so this fix is not held yet. Revise brings the idea back to try again.' };
  }
  if (first?.right && second?.right) return { held: true, heldLine: 'Both checks right. This fix is held. Revise brings it back in a few days to make sure.' };
  if (first?.right && !second && secondOffered === false && !receipt?.offered2) return { held: true, heldLine: 'Right on the check. This fix is held. Revise brings it back in a few days to make sure.' };
  if (first?.right || second?.right) return { held: null, heldLine: 'One check right. Get the other one right to hold this fix.' };
  return { held: null, heldLine: null };
}
