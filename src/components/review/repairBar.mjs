// Your papers, 19 Nov 2026 (lane arena-a): one line of work left. "To repair" and "Repaired" are the two ends of ONE bar,
// with their figures on it; papers sat and the latest marks stand beside it. Pure; the figures are statsOf()'s
// (reviewScope.mjs), so the bar, the chapters below and Saved repairs agree. No number is shown twice.

/**
 * The bar's ends: { open, repaired, total, share, openNote, repairedNote }. `share` is the repaired part of the line
 * (0 to 1). With nothing found yet there is no bar (`total` 0): the line under it says why, never a zero-length bar.
 */
export function repairBar(stats) {
  const open = Math.max(0, Number(stats?.toRepair) || 0);
  const repaired = Math.max(0, Number(stats?.repaired) || 0);
  const total = open + repaired;
  return {
    open,
    repaired,
    total,
    share: total > 0 ? repaired / total : 0,
    openNote: stats?.toRepairNote || '',
    repairedNote: repaired ? stats?.repairedNote || '' : '',
  };
}
