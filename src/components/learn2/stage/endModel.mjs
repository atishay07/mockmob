// The end screen's one formula (R2 ruling 5, LK31), shared by the run and the feed. Pure, so node --test holds it
// (run/runView.test.mjs). Top to bottom the screen draws:
//   the chapter name as a quiet line, a headline, one row of up to 3 numbers (every zero dropped), the chapter's progress
//   bar growing, one main key and at most one quiet text link. The X is the only other way out.
// Never a zero: a count that is 0 is dropped, and "0 of 2 right" becomes "2 questions tried" (R2 ruling 1).

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const num = (x) => (Number.isFinite(Number(x)) ? Math.max(0, Math.round(Number(x))) : 0);

/** The free line of an end after the day's session (R2 ruling 1's Free row). See Pro is its inline text key. */
export const FREE_END_LINE = 'That was today’s free session. Pro has no daily limit.';

/**
 * The headline: "20 done in 9 min", "20 done", or "Stopped at 7 of 20". `stopped` or reached < of reads as a stop.
 * Nothing reached gives null (the screen leads with the chapter instead of a zero).
 */
export function endHeadline({ reached = 0, of = 0, minutes = null, stopped = false } = {}) {
  const r = num(reached);
  const o = num(of);
  if (!o || !r) return null;
  if (r >= o && !stopped) {
    const m = num(minutes);
    return m ? `${o} done in ${m} min` : `${o} done`;
  }
  return `Stopped at ${Math.min(r, o)} of ${o}`;
}

/** "in Revise, back Wed" from the server's return groups ([{ label: 'back on Wed', count }]): the soonest one. */
export function reviseLabel(groups) {
  const first = (groups || []).find((g) => num(g?.count) > 0);
  const when = first ? String(first.label || '').replace(/^back on /, 'back ').trim() : '';
  return when ? `in Revise, ${when}` : 'in Revise';
}

/**
 * The numbers row: up to 3 { value, n, label }, in this order, each only when it is more than 0.
 *   revise    cards sent to (or kept for) Revise; label from reviseLabel or given
 *   seen      cards seen, shown only when nothing went to Revise (a feed with nothing kept)
 *   answered  questions answered; right of answered, or "N questions tried" when none was right
 *   mistakes  old mistakes tried; fixed of tried, or "N mistakes tried" when none was fixed
 * `n` is the leading figure (the count-up animates it); `value` is the whole figure as drawn.
 */
export function endNumbers({ revise = 0, reviseText = 'in Revise', seen = 0, answered = 0, right = 0, mistakes = 0, fixed = 0 } = {}) {
  const out = [];
  const rv = num(revise);
  const sn = num(seen);
  if (rv) out.push({ value: String(rv), n: rv, label: reviseText });
  else if (sn) out.push({ value: String(sn), n: sn, label: sn === 1 ? 'card seen' : 'cards seen' });
  const a = num(answered);
  const r = Math.min(num(right), a);
  if (a) out.push(r ? { value: `${r} of ${a}`, n: r, label: a === 1 ? 'question right' : 'questions right' } : { value: String(a), n: a, label: a === 1 ? 'question tried' : 'questions tried' });
  const m = num(mistakes);
  const f = Math.min(num(fixed), m);
  if (m) out.push(f ? { value: `${f} of ${m}`, n: f, label: m === 1 ? 'mistake fixed' : 'mistakes fixed' } : { value: String(m), n: m, label: m === 1 ? 'mistake tried' : 'mistakes tried' });
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
  return { from: before / of, to: seen / of, label: `${seen} of ${of} cards seen` };
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

/** The stop sheet's line (R2 ruling 6): "5 of 20 done. It's all saved." */
export const stopSheetLine = (done, of) => (num(of) ? `${num(done)} of ${num(of)} done. It’s all saved.` : 'It’s all saved.');

/** A pile card's front size: 12 px when its longest word is over 11 characters, else 13 (R2 screens 11). */
export const pileFrontSize = (text) => (String(text || '').split(/\s+/).some((w) => w.replace(/[^\p{L}\p{N}]/gu, '').length > 11) ? 12 : 13);
