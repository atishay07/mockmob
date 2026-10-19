// "Fix it for good": Mistake Repair as Mobi's flagship job (C-dec 3 and 3b, D157; contract MOBI-CONTRACT section 4). PURE.
//
// Reached from "Ask Mobi about Q7" on a paper's answers. The price is said before the tap: "Fix it for good, 1 credit", on
// every plan (Pro does not make it free). The job, in order: your option, why it looked right (with your own history of that
// trap), why the key is right, one rule to keep, check 1 then check 2 (2 new, unseen, verified questions on the same idea),
// then held. A stored fix reopens free; a key dispute and a failed fix cost nothing.
import { askLabel, checkHref } from '../../../data/repair_check_client.mjs';

export const FIX_PRICE = 1;

export const FIX_COPY = Object.freeze({
  askTitle: (number) => askLabel(number).replace('this mistake', 'this question'),
  start: 'Fix it for good',
  price: '1 credit',
  startLabel: 'Fix it for good, 1 credit',
  // The accessible name starts with the visible words, then names the question.
  startAria: (number) => (Number.isInteger(number) && number > 0 ? `Fix it for good, 1 credit, for Q${number}` : 'Fix it for good, 1 credit'),
  startLine: (pick) => `Why ${pick ? `option ${pick}` : 'your answer'} looked right, why the key is right and one rule to keep. Then 2 new questions to check the fix held.`,
  noCredits: (pick) => `Fixing it for good shows why ${pick || 'your pick'} looked right, the trap, one rule and 2 new questions to check it held, for 1 credit.`,
  yourOption: 'Your option',
  theKey: 'The key',
  check: (slot) => `Check ${slot} of 2`,
  secondLead: 'A second new question on the same idea. It comes with this fix, so there is no extra credit.',
  heldTitle: 'Held',
  slippedTitle: 'Not held yet',
  writing: (number) => (Number.isInteger(number) ? `Mobi is fixing Q${number} for good.` : 'Mobi is fixing this for good.'),
});

const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const LETTERS = 'ABCD';

/** The repair response carries Mobi's job (v13 server): only then is the screen laid out as "Fix it for good". */
export const isFixJob = (state) => state?.mobi?.job === 'fix';

/** "You picked B: <text>" and "The key is D: <text>", from the job's own fields. null when either is missing. */
export function pickLines(mobi) {
  const pick = mobi?.yourPick; const key = mobi?.key;
  if (!Number.isInteger(pick?.index) || !Number.isInteger(key?.index)) return null;
  const pickText = text(pick.text); const keyText = text(key.text);
  if (!pickText || !keyText) return null;
  return {
    pick: { letter: LETTERS[pick.index] || String(pick.index + 1), text: pickText },
    key: { letter: LETTERS[key.index] || String(key.index + 1), text: keyText },
  };
}

/**
 * The student's own history of the trap this option set ("This trap has caught you 4 times in 6 chances."), as the server
 * wrote it. Shown only with real counts behind it: at least one chance, and caught never more than chances.
 */
export function historyLine(mobi) {
  const h = mobi?.history;
  const line = text(h?.line);
  if (!line || !Number.isInteger(h?.caught) || !Number.isInteger(h?.chances) || h.chances < 1 || h.caught > h.chances || h.caught < 0) return null;
  return line;
}

/** The GET link of a check slot: slot 1 is the existing check, slot 2 the second fresh question. */
export const slotHref = (attemptId, questionId, slot = 1) => (slot === 2 ? `${checkHref(attemptId, questionId)}&slot=2` : checkHref(attemptId, questionId));

/** The POST body of a check answer, with the slot only for the second one (slot 1 stays the existing request). */
export const slotPayload = (payload, slot = 1) => (slot === 2 ? { ...payload, slot: 2 } : payload);

/** held / heldLine from a check response (top level, or inside `result`). Unknown stays null, never false. */
export function heldFrom(body) {
  const src = body && typeof body === 'object' ? body : {};
  const held = typeof src.held === 'boolean' ? src.held : typeof src.result?.held === 'boolean' ? src.result.held : null;
  const line = text(src.heldLine) ?? text(src.result?.heldLine);
  return { held, line };
}

/** What the end of the fix says: null while a check is still open, else { held, title, line } in the server's words. */
export function heldView(h) {
  if (!h || typeof h.held !== 'boolean') return null;
  const line = text(h.line) || (h.held ? 'Both checks right. This fix is held.' : 'A check slipped, so this fix is not held yet.');
  return { held: h.held, title: h.held ? FIX_COPY.heldTitle : FIX_COPY.slippedTitle, line };
}

/** The second check opens once the first is marked (right or wrong): check 1, then check 2. */
export const showSecondCheck = ({ fix, first }) => Boolean(fix && first && typeof first.right === 'boolean');
