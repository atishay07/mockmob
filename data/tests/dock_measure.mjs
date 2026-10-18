// In-page measurement of the phone dock (NAV-1017 section 10, website check 1; WEB-NAV-1019 option A: Today, Practice, the
// Start key in the centre, Mob, You). Evaluated in the page by data/tests/dock_alignment.test.mjs; returns plain numbers so
// the test can assert on them.
export const MEASURE_DOCK = String.raw`(() => {
  const dock = document.querySelector('.arena-dock');
  if (!dock || getComputedStyle(dock).display === 'none') return { shown: false };
  const nav = dock.querySelector('nav.arena-bottomnav');
  const key = nav.querySelector('[data-start-key="bar"]');
  const box = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  const mid = (r) => (r.top + r.bottom) / 2;
  // A label's baseline: a zero-height inline-block at the end of its text sits on the baseline.
  const baseline = (span) => { const probe = document.createElement('i'); probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'; span.appendChild(probe); const y = probe.getBoundingClientRect().top; probe.remove(); return y; };
  const textBox = (span) => { const range = document.createRange(); range.selectNodeContents(span); return box(range); };
  // The Start key is the capsule's centre child: it is measured on its own, and it is never the current place. A place is current
  // when it is the page, when its sheet is open (You), or when the page lives inside it (Your papers inside Practice: data-within).
  const places = [...nav.children].filter((el) => el !== key);
  const slots = places.map((el) => {
    const icon = el.querySelector('svg');
    const label = el.querySelector('span');
    return { name: label.textContent.trim(), current: el.getAttribute('aria-current') === 'page' || el.getAttribute('aria-expanded') === 'true' || el.getAttribute('data-within') === 'true', slot: box(el), icon: box(icon), label: textBox(label), baseline: baseline(label) };
  });
  const keyIcon = key.querySelector('.stk__disc');
  const keyWord = key.querySelector('.stk__word');
  const keyM = { slot: box(key), icon: box(keyIcon), label: textBox(keyWord), baseline: baseline(keyWord), name: keyWord.textContent.trim(), index: [...nav.children].indexOf(key) };
  // The lens is nav::before: its rect from its computed box and its translate.
  const ls = getComputedStyle(nav, '::before');
  const navR = box(nav);
  const m = new DOMMatrixReadOnly(ls.transform === 'none' ? undefined : ls.transform);
  const lensLeft = navR.left + parseFloat(ls.left) + m.m41;
  const lensTop = navR.top + parseFloat(ls.top) + m.m42;
  const lens = { left: lensLeft, top: lensTop, right: lensLeft + parseFloat(ls.width), bottom: lensTop + parseFloat(ls.height), opacity: Number(ls.opacity) };
  // Everything drawn by the dock, to prove nothing stands above the capsule's top edge.
  const highest = Math.min(...[...dock.querySelectorAll('*')].map((el) => el.getBoundingClientRect()).filter((r) => r.width && r.height).map((r) => r.top));
  // Hit-test each place and the key at its centre: the element under the pointer must be inside it.
  const hits = [...nav.children].map((el) => { const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return el.contains(top); });
  const ks = getComputedStyle(key);
  return {
    shown: true,
    viewport: { width: innerWidth, height: innerHeight },
    nav: navR, key: keyM, slots, lens, highest, hits,
    keyLook: { background: ks.backgroundColor, color: ks.color, shadow: ks.boxShadow },
    iconCentres: [...nav.children].map((el) => mid(box(el === key ? keyIcon : el.querySelector('svg')))),
    baselines: [...nav.children].map((el) => (el === key ? keyM.baseline : baseline(el.querySelector('span')))),
  };
})()`;

// The page's content must clear the dock: scrolled to the end, <main>'s content box (its bottom less its padding, which
// is the dock clearance) ends above the dock's top edge.
export const MEASURE_CLEARANCE = String.raw`(async () => {
  const root = document.scrollingElement;
  // Pages keep growing as their sections load and reveal, so scroll to the end until the height holds still.
  for (let i = 0, last = -1; i < 12 && root.scrollHeight !== last; i += 1) {
    last = root.scrollHeight;
    root.scrollTo({ top: root.scrollHeight, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 400));
  }
  const dock = document.querySelector('.arena-dock');
  const main = document.getElementById('app-main');
  const r = main.getBoundingClientRect();
  const contentEnd = r.bottom - parseFloat(getComputedStyle(main).paddingBottom);
  return { contentEnd, mainBottom: r.bottom, dockTop: dock.getBoundingClientRect().top, atEnd: root.scrollTop + innerHeight >= root.scrollHeight - 2, innerHeight };
})()`;

// Volt-filled action keys inside the viewport: every button and link whose own fill is volt (the Start keys, .btn-volt,
// a page's data-page-primary key, or any key styled volt some other way). Selected chips and segments that use volt as a
// state are radios, checkboxes or aria-pressed/aria-selected toggles, not action keys, and are not counted.
export const COUNT_VOLT_FILLS = String.raw`(() => {
  const volt = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return false; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return a > 0.9 && r > 190 && g > 225 && b < 60; };
  const isState = (el) => el.matches('[aria-pressed], [aria-selected], [aria-checked], [role="radio"], [role="tab"], [role="option"], label, input');
  return [...document.querySelectorAll('button, a[href], [role="button"], [data-start-key], .btn-volt, [data-page-primary]')].filter((el) => {
    if (isState(el)) return false;
    const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    if (!r.width || !r.height || s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) < 0.5) return false;
    if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return false;
    return volt(s.backgroundColor);
  }).map((el) => (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40));
})()`;
