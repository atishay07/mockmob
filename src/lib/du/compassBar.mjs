// The signed-in Colleges list draws each course's 2026 Round 1 range as a thin bar on one shared scale (arena-c, 19 Nov 2026).
// The scale runs from 0 to the top of DU's 2026 lists, the same figure the page already prints under Target score
// (data.meta.scoreRange[1]); nothing here is typed in. Positions are fractions of that scale, clamped to 0..1, so a bar never
// runs off its track. A range that is missing or not two numbers draws no bar (null), and a missing score draws no tick.

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** The shared scale's top: the paper's maximum the page already uses, or null when the data does not give one. */
export function barScaleMax(meta) {
  const top = meta?.scoreRange?.[1];
  return finite(top) && top > 0 ? top : null;
}

const frac = (v, max) => Math.min(1, Math.max(0, v / max));

/** Where a course's Round 1 range sits on the scale: { from, to } as fractions, or null when there is nothing to draw. */
export function rangeOnScale(lo, hi, max) {
  if (!finite(lo) || !finite(hi) || !finite(max) || max <= 0) return null;
  const a = Math.min(lo, hi);
  const b = Math.max(lo, hi);
  return { from: frac(a, max), to: frac(b, max) };
}

/** Where the student's own score sits on the same scale, or null when there is no score. */
export function tickOnScale(score, max) {
  if (!finite(score) || !finite(max) || max <= 0) return null;
  return frac(score, max);
}
