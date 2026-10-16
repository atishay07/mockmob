// Brings the chosen tab of a sideways-scrolling row wholly into view without moving the page. The row only moves
// as far as it must, and its left edge always lands in the gap before a tab (the row's edge fade is as wide as
// that gap), so no stray letters of a cut-off tab show at the left. A first tab scrolls the row to its start and a
// last tab to its end.
export function revealTab(row, index, { smooth = true, fade = 24 } = {}) {
  if (!row || row.scrollWidth <= row.clientWidth + 2) return;
  const tabs = [...row.children];
  const active = tabs[index];
  if (!active) return;
  const box = row.getBoundingClientRect();
  const at = (node) => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left - box.left + row.scrollLeft, right: rect.right - box.left + row.scrollLeft };
  };
  const max = row.scrollWidth - row.clientWidth;
  const view = row.clientWidth;
  const now = row.scrollLeft;
  const { left, right } = at(active);
  // Already whole and clear of both fades: leave the row where it is.
  if (left >= now + (now > 2 ? fade : 0) && right <= now + view - (now < max - 2 ? fade : 0)) return;
  // Where the row may start: its very start, or the gap just before any tab.
  const starts = tabs.map((tab, i) => (i === 0 ? 0 : Math.max(0, at(tab).left - fade)));
  let target;
  if (index === 0) target = 0;
  else if (index === tabs.length - 1) target = max;
  else if (left < now + fade) target = starts[index];
  else target = starts.slice(0, index + 1).find((s) => s + view - fade >= right) ?? starts[index];
  target = Math.max(0, Math.min(max, target));
  if (Math.abs(target - now) > 1) row.scrollTo({ left: target, behavior: smooth ? 'smooth' : 'auto' });
}

// Pads the row's end so that, scrolled all the way, its left edge also lands in a gap before a tab (never on a
// tab's last letters). Run on resize; it only writes when the padding has to change.
export function fitRowEnd(row, { fade = 24 } = {}) {
  if (!row) return;
  const extra = Number(row.dataset.endPad || 0);
  const view = row.clientWidth;
  const width = row.scrollWidth - extra;
  let pad = 0;
  if (width > view + 2) {
    const box = row.getBoundingClientRect();
    const starts = [...row.children].slice(1).map((tab) => tab.getBoundingClientRect().left - box.left + row.scrollLeft - fade);
    const fits = starts.map((s) => s - (width - view)).filter((p) => p >= 0);
    pad = fits.length ? Math.ceil(Math.min(...fits)) : 0;
  }
  if (pad === extra) return;
  row.dataset.endPad = String(pad);
  row.style.setProperty('--row-end-pad', `${pad}px`);
}
