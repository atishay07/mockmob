// One lime (volt) key per viewport (AGENT_RULES 7, W-075). The function below runs inside a page (page.evaluate): it lists every
// link and button that is filled with the volt lime and is on screen right now, topmost at its centre (so a key hidden behind
// the dock or the top bar does not count). A page passes when the list has at most one entry. Used by the browser walk in
// data/tests/release9_nav_1018.test.mjs (when a preview server is named) and by tmp/r9-fixes/nav/*.mjs.
export function voltKeysInView() {
  const probe = document.createElement('i');
  probe.style.cssText = 'position:fixed;left:-9px;top:-9px;width:1px;height:1px;background:#d2f000';
  document.body.appendChild(probe);
  const volt = getComputedStyle(probe).backgroundColor;
  probe.remove();
  const near = (a, b) => {
    const x = a.match(/[\d.]+/g)?.slice(0, 3).map(Number);
    const y = b.match(/[\d.]+/g)?.slice(0, 3).map(Number);
    return x && y && x.every((v, i) => Math.abs(v - y[i]) <= 14);
  };
  const found = [];
  for (const el of document.querySelectorAll('a, button, [role="button"]')) {
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < 0.5) continue;
    const alpha = style.backgroundColor.match(/[\d.]+/g)?.[3];
    if (!near(style.backgroundColor, volt) || (alpha !== undefined && Number(alpha) < 0.9)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 28 || r.height < 28) continue;
    const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2));
    const y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
    if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
    const top = document.elementFromPoint(x, y);
    if (!top || !(top === el || el.contains(top) || top.contains(el))) continue;
    found.push({ text: (el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) });
  }
  return found;
}
