// /home-next's late parts load in quiet time (21 Nov 2026, critic round 5: the frame's and the Lab's code arrived "on
// approach", so their fetch, evaluation and mount landed inside a reader's swipes and the sections around them lost frames).
// Now: once the page has loaded and the opening has handed over, each late part is fetched and then made live one step per
// idle period, never two in one task. The approach watch stays only as a fallback for a reader who scrolls faster.
//
// afterOpening(): resolves once the load event has fired and the opening is done (window.__mmOpening, openingGate.mjs), or
//   OPENING_WAIT_MAX_MS after load at the latest.
// inIdle(fn, { first }): runs fn in an idle period (requestIdleCallback, IDLE_TIMEOUT_MS at the latest), one queued step per
//   idle period, in order; `first` puts it at the front (a step the reader is already looking at).

/** The longest wait for the opening after the load event, ms. */
export const OPENING_WAIT_MAX_MS = 6000;
/** An idle step runs within this long even on a busy page, ms. */
export const IDLE_TIMEOUT_MS = 1500;

let settled = null;
export function afterOpening() {
  if (typeof window === 'undefined') return Promise.resolve();
  settled ||= new Promise((resolve) => {
    const opened = () => {
      const st = window.__mmOpening;
      if (!st || st.phase === 'done') { resolve(); return; }
      const timer = window.setTimeout(resolve, OPENING_WAIT_MAX_MS);
      const on = (event) => {
        if (event.detail?.phase !== 'done') return;
        window.removeEventListener('mm:opening', on);
        window.clearTimeout(timer);
        resolve();
      };
      window.addEventListener('mm:opening', on);
    };
    if (document.readyState === 'complete') opened(); else window.addEventListener('load', opened, { once: true });
  });
  return settled;
}

const steps = [];
let running = false;
const idle = (fn) => (typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(fn, { timeout: IDLE_TIMEOUT_MS }) : window.setTimeout(fn, 50));
function next() {
  const fn = steps.shift();
  if (!fn) { running = false; return; }
  try { fn(); } finally { idle(next); }
}
export function inIdle(fn, { first = false } = {}) {
  if (first) steps.unshift(fn); else steps.push(fn);
  if (!running) { running = true; idle(next); }
}
