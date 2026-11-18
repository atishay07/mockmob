// Where your marks go (Marks trend, lane insight 18 Nov 2026): the marks not earned across the papers on record, split by
// what the record really says caused them. PURE.
//
// Where each figure comes from:
//   wrong, blank   the attempts' own counts (attempts.wrong, attempts.unattempted), the same counts the page's header and
//                  totals read (GET /api/analytics totals)
//   marks          CUET's marking (data/test_modes.js nta.marking): a wrong answer misses the 5 a right one gives and loses
//                  the 1 penalty, a blank misses the 5. So wrong x 6 + blank x 5 is every mark a paper did not earn:
//                  5 x questions - (5 x right - 1 x wrong).
//   changes        the device records the server matched (selectionMeta.recovery.telemetry 'self_reported'), each change's
//                  markEffect, as Your record's Changed answers counts them; only when such a record exists
import { LOST } from './words.mjs';

/** -> null with no paper, else { papers, wrong: { count, marks }, blank: { count, marks }, total }. */
export function marksSplit({ papers = 0, wrong = 0, blank = 0 } = {}) {
  const n = Math.max(0, Math.trunc(Number(papers) || 0));
  if (n < 1) return null;
  const w = Math.max(0, Math.trunc(Number(wrong) || 0));
  const b = Math.max(0, Math.trunc(Number(blank) || 0));
  const out = { papers: n, wrong: { count: w, marks: w * LOST.wrong }, blank: { count: b, marks: b * LOST.blank } };
  out.total = out.wrong.marks + out.blank.marks;
  return out;
}

/** -> null when no paper has a matched device record, else { papers, count, net, gained, lost }. */
export function changesOf(attempts = []) {
  const replayed = (attempts || []).filter((a) => a?.selectionMeta?.recovery?.telemetry === 'self_reported');
  if (!replayed.length) return null;
  const list = replayed.flatMap((a) => (Array.isArray(a.selectionMeta.recovery.observed?.answerChanges) ? a.selectionMeta.recovery.observed.answerChanges : []))
    .filter((c) => c && Number.isFinite(Number(c.markEffect)));
  const effect = (c) => Number(c.markEffect);
  return {
    papers: replayed.length,
    count: list.length,
    net: list.reduce((s, c) => s + effect(c), 0),
    gained: list.filter((c) => effect(c) > 0).reduce((s, c) => s + effect(c), 0),
    lost: -list.filter((c) => effect(c) < 0).reduce((s, c) => s + effect(c), 0),
  };
}
