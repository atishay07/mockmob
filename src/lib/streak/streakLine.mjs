// The streak's line (19 Nov 2026): the geometry StreakLine draws, as plain numbers so node --test holds it (streakLine.test.mjs).
// One volt highlighter band runs behind every run of kept days; a rest pass keeps the band going, lighter and striped; an exam
// pause day keeps the line as a thin dashed rule (the streak holds, nothing was done); a day with no practice is a gap; today,
// not yet counted, is the band's tip reaching into its cell by today's answers over the rule's number.

/** Looks that carry the band itself. A pause day carries the dashed rule instead. */
export const BAND_LOOKS = Object.freeze(['done', 'made_up', 'rested']);
const SOLID = new Set(['done', 'made_up']);

/** Today's reach, 0 to 1: today's answers over what today needs (the same figures as todayProgress). */
export function tipShare(progress) {
  if (!progress || !(progress.needed > 0)) return 0;
  return Math.max(0, Math.min(1, (Number(progress.answered) || 0) / progress.needed));
}

/**
 * cells: [{ key, look, x, y, w, h, nameX?, nameW? }] in the row's own pixels, in reading order (rows wrap in a month).
 * tip: today's reach (tipShare) when today has not counted.
 * Returns { bands: [{ key, x, y, w, h, fills: [{ x, w, kind, today }] }], rules: [{ x1, x2, y }] }, every x relative to the row.
 * A band's fills are relative to the band (its own x is 0) and reach a little past its ends, so the drawn outline (the
 * highlighter's slanted ends) decides where the colour stops.
 */
export function lineRuns(cells, { tip = 0 } = {}) {
  const bands = [];
  const rules = [];
  let open = null;
  const sameRow = (a, b) => a && b && Math.abs(a.y - b.y) < 2;
  const close = () => {
    if (!open) return;
    const first = open.cells[0];
    const last = open.cells[open.cells.length - 1];
    const end = last.tip ? last.x + last.w * last.tip : last.x + last.w;
    const x = first.x;
    const w = Math.max(0, end - x);
    if (w >= 2) {
      const fills = open.cells.map((c, i) => {
        const from = i === 0 ? -12 : c.x - x;
        const next = open.cells[i + 1];
        const to = next ? next.x - x : w + 12;
        return { x: from, w: to - from, kind: c.tip ? 'tip' : SOLID.has(c.look) ? 'solid' : 'rest', today: Boolean(c.today) };
      });
      bands.push({ key: first.key, x, y: first.y, w, h: first.h, fills });
    }
    open = null;
  };
  for (const c of cells || []) {
    const reach = c.look === 'today' && tip > 0 ? tip : 0;
    const carries = BAND_LOOKS.includes(c.look) || reach > 0;
    if (open && (!carries || !sameRow(open.cells[open.cells.length - 1], c))) close();
    if (carries) {
      if (!open) open = { cells: [] };
      open.cells.push({ ...c, tip: reach || 0 });
      if (reach) close();
    }
    if (c.look === 'paused') {
      const y = c.y + c.h * 0.52;
      if (c.nameW > 0) {
        if (c.nameX - 4 > c.x) rules.push({ x1: c.x, x2: c.nameX - 4, y });
        if (c.nameX + c.nameW + 4 < c.x + c.w) rules.push({ x1: c.nameX + c.nameW + 4, x2: c.x + c.w, y });
      } else rules.push({ x1: c.x, x2: c.x + c.w, y });
    }
  }
  close();
  // Pause days side by side draw one rule (their pieces meet at the cell edge), so the dashes run on evenly.
  const merged = [];
  for (const r of rules) {
    const last = merged[merged.length - 1];
    if (last && Math.abs(last.y - r.y) < 0.5 && Math.abs(last.x2 - r.x1) < 0.5) last.x2 = r.x2;
    else merged.push({ ...r });
  }
  return { bands, rules: merged };
}
