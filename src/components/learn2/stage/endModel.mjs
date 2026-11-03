// The end screen's one formula (R2 ruling 5, LK31, R3-SPEC L5), shared by the run and the feed. Pure, so node --test holds it
// (run/runView.test.mjs). Top to bottom the screen draws:
//   the chapter name as a quiet line, a headline, one row of up to 3 numbers (every zero dropped), the chapter's progress
//   bar growing, one main key and at most one quiet text link. The X is the only other way out.
// Never a zero: a count that is 0 is dropped, and "0 of 2 right" becomes "2 questions tried" (R2 ruling 1).
import { FREE_END_LINE } from '../../../../data/learn/allowance.js';
import { WORDS, reviseDue, withMinutes } from '../../../../data/learn/words.js';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const num = (x) => (Number.isFinite(Number(x)) ? Math.max(0, Math.round(Number(x))) : 0);

/** The one quiet line of a Free end after the day's session (ruling F): FREE_DONE_HEADLINE + " Questions come back tomorrow." */
export { FREE_END_LINE };

/**
 * The headline (R3 L5): "18 done", with " in 12 min" only from 2 minutes; a stop part way reads "5 of 20 done". `stopped` or
 * reached < of reads as a stop. Nothing reached gives null (the screen leads with the chapter instead of a zero).
 */
export function endHeadline({ reached = 0, of = 0, minutes = null, stopped = false } = {}) {
  const r = num(reached);
  const o = num(of);
  if (!o || !r) return null;
  if (r >= o && !stopped) {
    const m = num(minutes);
    return m >= 2 ? `${o} done in ${m} min` : `${o} done`;
  }
  return `${Math.min(r, o)} of ${o} done`;
}

/** "in Revise, back Wed" from the server's return groups ([{ label: 'back on Wed', count }]): the soonest one. */
export function reviseLabel(groups) {
  const first = (groups || []).find((g) => num(g?.count) > 0);
  const when = first ? String(first.label || '').replace(/^back on /, 'back ').trim() : '';
  return when ? `in Revise, ${when}` : 'in Revise';
}

/**
 * The numbers row (R3 L5): up to 3 { value, n, label }, in this order, each only when it is more than 0, with the same labels
 * on run and feed ends:
 *   revise    cards sent to (or kept for) Revise: "14" / "in Revise, back Wed" (label from reviseLabel or given)
 *   answered  questions answered: "1 of 2" / "questions right"; none right: "2" / "questions tried" (never "0 of 2")
 *   fixed     open mistakes fixed: "2" / "open mistakes fixed" (none fixed: no number; never "mistakes tried")
 * No "cards seen" number: the chapter's bar carries it ("20 of 45 cards seen"). `seen` and `mistakes` are read and ignored.
 * `n` is the leading figure (the count-up animates it); `value` is the whole figure as drawn.
 */
export function endNumbers({ revise = 0, reviseText = 'in Revise', answered = 0, right = 0, mistakes = null, fixed = 0 } = {}) {
  const out = [];
  const rv = num(revise);
  if (rv) out.push({ value: String(rv), n: rv, label: reviseText });
  const a = num(answered);
  const r = Math.min(num(right), a);
  if (a) out.push(r ? { value: `${r} of ${a}`, n: r, label: a === 1 ? 'question right' : 'questions right' } : { value: String(a), n: a, label: a === 1 ? 'question tried' : 'questions tried' });
  const f = mistakes === null ? num(fixed) : Math.min(num(fixed), num(mistakes));
  if (f) out.push({ value: String(f), n: f, label: f === 1 ? 'open mistake fixed' : 'open mistakes fixed' });
  return out.slice(0, 3);
}

/**
 * The chapter's progress bar: { from, to, label } as shares of 1, or null when nothing is seen (no empty bar).
 * The bar grows from `before` to `seen` (600 ms, ease-out).
 */
export function endProgress(progress) {
  const of = num(progress?.of);
  const seen = Math.min(num(progress?.seen), of);
  if (!of || !seen) return null;
  const before = Math.min(num(progress?.before), seen);
  return { from: before / of, to: seen / of, label: progressLabel({ seen, of, open: progress?.open }) };
}

/** The Free bar's tail once every free card is seen (R4 first-timer#4): one line, no extra block. */
export const FREE_REST_PRO = 'The rest open with Pro.';

/**
 * The bar's label: "20 of 45 cards seen". On Free (`open`, the cards Free opens in this chapter, is sent and is fewer than
 * the chapter's cards) once the seen cards reach the free count: "5 of 45 cards seen. The rest open with Pro." Pro never
 * sends `open` (or sends the whole chapter), so it never reads the tail.
 */
export function progressLabel({ seen = 0, of = 0, open = null } = {}) {
  const s = num(seen);
  const o = num(of);
  const base = `${s} of ${o} cards seen`;
  const free = open === null || open === undefined || open === '' ? null : num(open);
  return free !== null && free > 0 && free < o && s >= free ? `${base}. ${FREE_REST_PRO}` : base;
}

/**
 * A fan mini's front, cut at a word boundary (R4 owner-eye#14): at most `max` characters (about 3 lines of 18), ending on a
 * whole word with an ellipsis, never mid-word. A first word longer than `max` is kept whole (the CSS clamp is the backstop).
 */
export function miniFront(text, max = 54) {
  const s = String(text || '').replace(/_{3,}/g, '____').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max + 1);
  const at = cut.lastIndexOf(' ');
  const head = (at > 0 ? cut.slice(0, at) : s.split(' ')[0]).replace(/[\s,;:.–—-]+$/u, '');
  return `${head}…`;
}

/** The checkpoint (R2 screens 12): a headline that never leads with a zero, and one line. */
export function checkpointLines({ answered = 0, right = 0, seen = 0, kept = 0 } = {}, { done = 0, of = 0, left = null } = {}) {
  const a = num(answered);
  const r = Math.min(num(right), a);
  const k = num(kept);
  const s = num(seen);
  const big = a ? (r ? `${r} of ${a} right` : plural(a, 'question') + ' tried')
    : k ? `${k} for Revise` : s ? plural(s, 'card') + ' seen' : `${num(done)} done`;
  const line = `${num(done)} of ${num(of)} done${left ? `, ${String(left).charAt(0).toLowerCase()}${String(left).slice(1)}` : ''}.`;
  return { big, line };
}

/**
 * The one count of "done" (R5 LK45 fix 2), the server's rule: the end's "9 of 18 done" is the place of the last item the server
 * holds an event for (runDone().reached in src/lib/server/learn.js). The stop sheet and the feed's stopped end count the same way,
 * so one moment never reads two numbers. `base` is the items already done before this page's list (a resumed run's prefix);
 * `held(item, index)` says whether the server holds an event for the item: a rated or looked-at card, an answered question, a
 * lesson read or skipped, a feed card kept. A question skipped, and a feed card only turned over, hold none.
 */
export function reachedPlace(items, held, base = 0) {
  let last = -1;
  (Array.isArray(items) ? items : []).forEach((item, i) => { if (held(item, i)) last = i; });
  return num(base) + last + 1;
}

/** The stop sheet's line (R2 ruling 6): "5 of 20 done. It's all saved." */
export const stopSheetLine = (done, of) => (num(of) ? `${num(done)} of ${num(of)} done. It’s all saved.` : 'It’s all saved.');

/** A pile card's front size: 12 px when its longest word is over 11 characters, else 13 (R2 screens 11). */
export const pileFrontSize = (text) => (String(text || '').split(/\s+/).some((w) => w.replace(/[^\p{L}\p{N}]/gu, '').length > 11) ? 12 : 13);

/** The Or rows of ruling F, in order, at most 2: [{ id, label }] from the 402 body (pure; runView.test.mjs). */
export function freeUsedRows(data = {}) {
  const r = data?.resume || null;
  const options = Array.isArray(data?.options) ? data.options : [];
  const revise = options.find((o) => o?.run?.kind === 'cards') || null;
  const rows = [];
  if (r && Number(r.of) > Number(r.done)) rows.push({ id: 'continue', label: withMinutes(WORDS.continue, r.minutesLeft) });
  if (revise) {
    const n = Number(revise.run.cardIds?.length) || Number((String(revise.label || '').match(/(\d+) due card/) || [])[1]) || 0;
    rows.push({ id: 'revise', label: n ? reviseDue(n, revise.run.minutes) : revise.label });
  }
  rows.push({ id: 'singles', label: WORDS.singles });
  return rows.slice(0, 2);
}
