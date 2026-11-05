// The home page's shortcuts (R3-D4, owner LK103/LK104, 5 Nov 2026): "the logo on the top should be working so that
// somebody can click it and go to the top, and there should be something for the bottom also"; "a clear way to skip".
//
//   the logo        a tap on the wordmark (a.logo, the site bar's and the footer's) while on the home page goes to the top.
//                   It is a Next Link to the page it is on, so before this it did nothing at all (measured: scrollY 6000
//                   before and 1.8 s after the tap).
//   [data-page-jump] a same-page link that is a shortcut, not a reading link: the bottom bar's Skip (to the next section)
//                   and the phone nav's Pricing pill (#pricing). They arrive with the section's heading under the site bar.
//   moveTo(y)       the bottom bar's Top button calls it straight.
//
// How the page moves (planJump):
//   within three screens  a glide: 850 ms, ease-in-out-cubic (Preparoo's own move), through the scroll bus (glideTo), so
//                         it is a declared jump for its whole length: no held story clamps it, no beat steps a story on
//                         the way, and any touch, wheel or key of the reader's stops it where it is.
//   further               a veil: the page's paper fades over the content in 120 ms (the site bar stays), the page jumps
//                         at once (bus.instantTo), and the arriving section rises 12 px into place as the veil lifts over
//                         240 ms. A held story is never painted mid-flight, and nothing races (LK47).
//   reduced motion        one instant jump, nothing else.
// Focus goes to where the reader arrives (the section's heading, or the page's main region for the top), so a keyboard
// or screen-reader user goes on reading from there; a bar that leaves never takes focus with it.
// Clicks are taken in the capture phase on the document, before the router's own handler (as DemoJump does), so a
// Link sees defaultPrevented and leaves the move to this. Without JavaScript the links are plain anchors.
import * as bus from './scrollBus.mjs';
import { undrawn } from './undrawn.js';

export const GLIDE_MS = 850;
export const GLIDE_SCREENS = 3;
export const VEIL_IN_MS = 120;
export const RISE_MS = 240;
export const RISE_PX = 12;
/** The air between the site bar and a heading the reader jumped to. */
export const HEAD_GAP = 20;

/** How a move from `from` to `to` (document px) is made in a window `vh` tall. */
export function planJump({ from, to, vh, reduced = false }) {
  if (!(Math.abs(to - from) >= 2)) return 'none';
  if (reduced) return 'instant';
  return Math.abs(to - from) <= GLIDE_SCREENS * vh ? 'glide' : 'veil';
}

const reducedNow = () => {
  if (document.documentElement.dataset.motion === 'reduced') return true;
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

function navBottom() {
  const nav = document.querySelector('.mm-nav');
  if (!nav) return 0;
  const box = nav.getBoundingClientRect();
  return box.bottom > 0 ? box.bottom : 0;
}

/** Focus `el` without scrolling; an element that cannot take focus gets tabindex -1 until it lets it go. */
function focusQuietly(el) {
  if (!el?.isConnected) return;
  if (!el.matches('a[href], button, input, select, textarea, [tabindex]')) {
    el.setAttribute('tabindex', '-1');
    el.addEventListener('blur', () => el.removeAttribute('tabindex'), { once: true });
  }
  el.focus({ preventScroll: true });
}

function riseIn(el) {
  if (!el?.isConnected || typeof el.animate !== 'function') return;
  el.animate([{ transform: `translate3d(0, ${RISE_PX}px, 0)` }, { transform: 'translate3d(0, 0, 0)' }], { duration: RISE_MS, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
}

let veilTimer = 0;
let veilFrame = 0;

/**
 * Take the page to `target` (a y, or a function giving it, read again as the page settles) the way planJump says.
 * `focus`: the element focused on arrival. `rise`: the element that rises into place after a veil.
 */
export function moveTo(target, { focus = null, rise = null } = {}) {
  const at = () => Math.max(0, Math.round(typeof target === 'function' ? target() : target));
  const plan = planJump({ from: window.scrollY, to: at(), vh: window.innerHeight, reduced: reducedNow() });
  const arrive = () => focusQuietly(focus);
  window.clearTimeout(veilTimer);
  window.cancelAnimationFrame(veilFrame);
  if (plan === 'none') { arrive(); return plan; }
  if (plan === 'glide') { bus.glideTo(at, { ms: GLIDE_MS, done: arrive }); return plan; }
  const veil = plan === 'veil' ? document.querySelector('.lp-veil') : null;
  const land = () => {
    bus.instantTo(at());
    // Two frames on, once the page has laid itself out around the jump (a section drawn on arrival), a last correction.
    veilFrame = window.requestAnimationFrame(() => {
      veilFrame = window.requestAnimationFrame(() => {
        veilFrame = 0;
        const settled = at();
        if (Math.abs(window.scrollY - settled) > 6) bus.instantTo(settled);
        if (veil) { veil.dataset.on = 'false'; riseIn(rise); }
        arrive();
      });
    });
  };
  if (!veil) { land(); return 'instant'; }
  // Declared at once: the tap that asked for this is not a fling, and nothing moves until the veil is up.
  bus.jump(at());
  veil.dataset.on = 'true';
  veilTimer = window.setTimeout(land, VEIL_IN_MS);
  return plan;
}

/** The top of the page, with the hero rising in after a veil and focus on the main region. */
export function toTop() {
  return moveTo(0, { focus: document.getElementById('main-content'), rise: document.querySelector('.lp-hero__grid') });
}

// An element's place in the page's layout: offsets, so a reveal's own transform (a heading still waiting to rise in) does
// not move the target.
function layoutTop(el) {
  let y = 0;
  for (let node = el; node; node = node.offsetParent) y += node.offsetTop;
  return y;
}

/** Where a section arrives: its heading HEAD_GAP under the site bar. Read again on arrival (the section is drawn then). */
export function headTarget(section) {
  const head = section.querySelector('.lp-head, h2') || section;
  return () => {
    // A section not drawn yet (content-visibility) is laid out at its reserved height only: its own top answers without
    // laying out its contents, and the correction after the jump reads the heading once it is drawn.
    const top = undrawn(section) ? section.getBoundingClientRect().top + window.scrollY : layoutTop(head);
    return top - navBottom() - HEAD_GAP;
  };
}

/** Go to the section a same-page hash names. */
export function toSection(hash) {
  let id = String(hash || '').replace(/^#/, '');
  try { id = decodeURIComponent(id); } catch { /* keep the raw id */ }
  const section = id ? document.getElementById(id) : null;
  if (!section) return null;
  const head = section.querySelector('.lp-head') || section;
  return moveTo(headTarget(section), { focus: section.querySelector('h2') || section, rise: head });
}

/** The capture-phase click listener for the logo and the shortcut links. Returns the uninstall. */
export function installPageJumps() {
  if (typeof document === 'undefined') return () => {};
  const onClick = (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;
    let url;
    try { url = new URL(anchor.href, window.location.href); } catch { return; }
    if (url.origin !== window.location.origin || url.pathname !== window.location.pathname) return;
    if (anchor.matches('.logo') && !url.hash) {
      event.preventDefault();
      toTop();
      return;
    }
    if (anchor.hasAttribute('data-page-jump') && url.hash && document.getElementById(url.hash.slice(1))) {
      event.preventDefault();
      toSection(url.hash);
    }
  };
  document.addEventListener('click', onClick, true);
  return () => {
    document.removeEventListener('click', onClick, true);
    window.clearTimeout(veilTimer);
    window.cancelAnimationFrame(veilFrame);
  };
}
