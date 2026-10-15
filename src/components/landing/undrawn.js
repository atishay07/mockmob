// The landing draws each section below the statement only as it nears the screen (content-visibility: auto,
// landing.css). Until then, reading a node's geometry inside it (a rect, scrollWidth, offsetHeight) makes the
// browser lay that whole section out on the spot, during the page's first second. Callers that also measure
// from a ResizeObserver skip the read while the node is undrawn: the observer fires once the section is drawn.
// Browsers without checkVisibility's contentVisibilityAuto option answer false here and measure as before.
export function undrawn(node) {
  if (!node || typeof node.checkVisibility !== 'function') return false;
  try {
    return !node.checkVisibility({ contentVisibilityAuto: true });
  } catch {
    return false;
  }
}

// The nearest node at or above `node` that is drawn: a section held back by content-visibility is itself laid
// out (at its reserved height), only its contents wait, so its box answers "above or below the screen?" cheaply.
export function drawnAncestor(node) {
  let current = node;
  while (current && undrawn(current)) current = current.parentElement;
  return current || node;
}

// Settling the page's height. A section held back by content-visibility reserves an estimate until it is first
// drawn, then keeps its real height (the `auto` in contain-intrinsic-size). Drawn for the first time as a fast
// scroll or a fling reaches it, it would grow or shrink under the reader: the page jumps, a held story stops a
// little off its step and reveals start mid-flight. So, once the reader first moves (or the page has been
// quiet for a while after load), each such section is drawn once off screen, nearest first, one per idle moment,
// for three frames (its own observers measure and fit it, the browser remembers its size), then handed back to
// content-visibility. Nothing is removed and the first paint still lays out only the hero. A width change
// (rotation, a resized window) makes every remembered height stale, so the pass runs again.
const SETTLE_AFTER_LOAD_MS = 6000;
let settleStarted = false;

function frames(count, done) {
  if (count <= 0) { done(); return; }
  requestAnimationFrame(() => frames(count - 1, done));
}

const idle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 500 }) : setTimeout(fn, 40));

export function settleUndrawn() {
  if (settleStarted || typeof window === 'undefined' || typeof document.body?.checkVisibility !== 'function') return;
  settleStarted = true;
  let settled = new WeakSet();
  let running = false;
  let again = false;
  const sections = () => [...document.querySelectorAll('main > *')].filter((node) => getComputedStyle(node).contentVisibility === 'auto');
  // A section's own box is laid out even while its contents wait, so its first drawn child answers "drawn yet?"
  // (a <noscript> or <style> is never drawn, so it cannot answer).
  const waiting = (node) => {
    const child = [...node.children].find((item) => !/^(NOSCRIPT|SCRIPT|STYLE|TEMPLATE)$/.test(item.tagName));
    return !!child && undrawn(child);
  };
  const pass = () => {
    if (running) { again = true; return; }
    running = true;
    const queue = sections();
    const next = () => {
      const node = queue.shift();
      if (!node) {
        running = false;
        if (again) { again = false; pass(); }
        return;
      }
      if (settled.has(node)) { next(); return; }
      settled.add(node);
      // Already drawn (near the screen): the browser records its size by itself. Above the screen (passed by a
      // jump): left to the browser, which keeps the reader's place by scroll anchoring when it draws it.
      if (!waiting(node) || node.getBoundingClientRect().bottom < 0) { next(); return; }
      node.style.contentVisibility = 'visible';
      frames(3, () => {
        node.style.removeProperty('content-visibility');
        idle(next);
      });
    };
    idle(next);
  };

  const events = ['scroll', 'wheel', 'touchstart', 'keydown', 'pointerdown'];
  let timer = 0;
  const begin = () => {
    events.forEach((type) => window.removeEventListener(type, begin, { capture: true }));
    clearTimeout(timer);
    pass();
  };
  events.forEach((type) => window.addEventListener(type, begin, { capture: true, passive: true }));
  const afterLoad = () => { timer = setTimeout(() => idle(begin), SETTLE_AFTER_LOAD_MS); };
  if (document.readyState === 'complete') afterLoad();
  else window.addEventListener('load', afterLoad, { once: true });

  let width = window.innerWidth;
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    if (window.innerWidth === width) return; // a phone's address bar showing or hiding changes only the height
    width = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { settled = new WeakSet(); pass(); }, 400);
  }, { passive: true });
}
