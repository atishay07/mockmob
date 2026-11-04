// Idle predraw of the held stories (5 Nov 2026, LK81: the slow-phone stutter on the Lab and the tour).
//
// The sections below the statement are drawn only as they near the screen (content-visibility: auto, landing.css), so the
// page's first second stays light. The price was paid inside the reader's gesture: on a phone at 4x CPU the Mistake Lab's
// first style and layout took about 350 ms and the tour's about 290 ms, a visible freeze mid-swipe as each came near.
//
// Here each held story's section is drawn once ahead of time, while the reader is not touching the page: after the
// page has loaded and the hero has settled (its typed line done, or the reader's first scroll), in an idle period with
// no input for the last 400 ms. The section is switched to content-visibility: visible ([data-predraw='on']) for three
// frames (the draw, then any fit or slack the story measures from its ResizeObserver), then handed back to auto. The
// browser keeps a skipped section's layout, so when the reader arrives only what changed since is redrawn. One section
// per idle period, in page order; a section the reader has already reached is skipped. Any content-visibility section
// of `main` can ask: the DU eligibility section does too (EligibilityTeaser, LK93), after the three stories.
import { undrawn } from './undrawn';

const QUIET_MS = 400;
const LOAD_SETTLE_MS = 1500;
const HERO_WAIT_MS = 9000;

const queue = new Set();
let started = false;
let pumping = false;
let lastInput = 0;
let ready = false;

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function idle(fn, timeout = 2000) {
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(fn, { timeout });
  else window.setTimeout(fn, 120);
}

function frames(n, fn) {
  if (n <= 0) { fn(); return; }
  window.requestAnimationFrame(() => frames(n - 1, fn));
}

function next() {
  const list = [...queue].filter((node) => node.isConnected);
  queue.clear();
  // Page order: the Lab first, then the tour, then the Recovery Lab, then the DU section.
  list.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  const [head, ...rest] = list;
  for (const node of rest) queue.add(node);
  return head;
}

function pump() {
  if (!ready || pumping || queue.size === 0) return;
  pumping = true;
  idle(() => {
    pumping = false;
    if (now() - lastInput < QUIET_MS) { window.setTimeout(pump, QUIET_MS); return; }
    const section = next();
    // Reached already (drawn because it is near the screen), or gone: nothing to do.
    if (!section || !undrawn(section.firstElementChild || section)) { pump(); return; }
    section.dataset.predraw = 'on';
    frames(3, () => {
      delete section.dataset.predraw;
      window.setTimeout(pump, 250);
    });
  });
}

function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const mark = () => { lastInput = now(); if (!ready) go(); };
  for (const type of ['touchstart', 'touchmove', 'wheel', 'keydown', 'pointerdown', 'scroll']) window.addEventListener(type, mark, { passive: true, capture: true });
  let timer = 0;
  function go() {
    if (ready) return;
    window.clearTimeout(timer);
    window.removeEventListener('mm:hero-typed', onTyped);
    ready = true;
    pump();
  }
  function onTyped(event) { if (event.detail?.final) window.setTimeout(go, 300); }
  const afterLoad = () => window.setTimeout(() => {
    window.addEventListener('mm:hero-typed', onTyped);
    // No typed line on this visit (reduced motion, a signed-in hero, a variant without it): do not wait for one.
    timer = window.setTimeout(go, document.querySelector('.lp-typed__live') ? HERO_WAIT_MS : 0);
  }, LOAD_SETTLE_MS);
  if (document.readyState === 'complete') afterLoad();
  else window.addEventListener('load', afterLoad, { once: true });
}

/** Draw `section` (a content-visibility: auto section of the landing) once, ahead of the reader, when the page is idle. */
export function predraw(section) {
  if (!section || typeof window === 'undefined') return;
  queue.add(section);
  start();
  pump();
}
