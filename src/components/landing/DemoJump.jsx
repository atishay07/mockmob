'use client';

import { useEffect } from 'react';
import '@/app/landing-close.css';
import { glideTo, topFor } from './pageGlide';

// The landing's own links, kept working however far down the page they are used (the page is long, its sections
// draw in as they near, and a plain anchor or the router's scroll can stall on it).
//
// 1. Every "Try 5 questions" link (the phone dock, the close band, the hero's pill and proof tile) points at the
//    sample question, #try-practice. Left to the router, a second tap did nothing: the URL already ended in
//    #try-practice, so the navigation was a no-op and the page stayed at the footer. This takes over any
//    same-page link to the demo: it always brings the question card on screen just under the sticky nav, puts
//    focus on its first control (the first subject chip while the picker shows, the first answer once playing; so
//    the dock, which stays up while focus is inside it, steps aside), and settles a volt ring on the card so the
//    eye lands on it.
// 2. Every other same-page link (#your-prep, #exam-experience, "/#your-prep" in the top bar) glides to its
//    section the same way and moves focus there.
// 3. The MockMob logo, in the top bar and the footer, points at this very page: it takes the reader to the top
//    (and clears the hash), instead of a navigation to the page they are already on.
// From far down the page each cuts most of the way at once and glides the last screen (pageGlide.js). Reduce
// motion jumps. Without JavaScript the links still work as plain anchors (scroll-margin-top keeps a section clear
// of the nav).
const TARGET = 'try-practice';

function ownLink(anchor) {
  if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return null;
  let url;
  try { url = new URL(anchor.href, window.location.href); } catch { return null; }
  if (url.origin !== window.location.origin || url.pathname !== window.location.pathname) return null;
  return url;
}

// The first thing to act on in the card: the first subject chip while the picker shows, else the open question's
// first answer, the forward key, or the finished result.
function firstControl(stage) {
  return stage.querySelector('.lp-pick__chip')
    || stage.querySelector('.mm-drill__option:not(:disabled)')
    || stage.querySelector('.mm-drill__foot .mm-btn')
    || stage.querySelector('.mm-drill__result');
}

// Room above the card for Mobi when he stands on its top edge (desktop, hero-v3.css), so the glide never parks
// him under the site bar with only his feet showing.
function headroom(stage) {
  const seat = stage.querySelector('.lp-stage__card > .pip-seat');
  const tall = seat ? seat.getBoundingClientRect().height : 0;
  return 12 + (tall > 0 ? Math.round(tall) : 0);
}

// A link that names a scene of a held story (data-ss-step on the anchor, as the feature tour's link to the Lab's
// Repair does) lands on that scene's resting place, not on the story's first scene. The stage is one window tall
// (read from the window while the story is still undrawn); glideTo reads this again as the page settles.
function storyRest(node, step) {
  const track = node.querySelector('.ss[data-pinned="true"] .ss__track');
  const stage = track?.querySelector('.ss__stage');
  const steps = Number(track?.parentElement?.style.getPropertyValue('--ss-steps'));
  if (!track || !stage || !(steps > 1) || !Number.isFinite(step)) return null;
  const hold = Math.max(0, track.offsetHeight - (stage.offsetHeight || window.innerHeight));
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return Math.round(Math.max(0, Math.min(max, window.scrollY + track.getBoundingClientRect().top + (hold * Math.min(step, steps - 1)) / (steps - 1))));
}
// Keyboard and screen-reader users land where the page went: a section without its own tab stop takes one
// for the moment, and gives it back when focus leaves.
function focusSection(node) {
  const native = node.matches('a[href], button, input, select, textarea, summary, [tabindex]');
  if (!native) {
    node.setAttribute('tabindex', '-1');
    node.addEventListener('blur', () => node.removeAttribute('tabindex'), { once: true });
  }
  node.focus({ preventScroll: true });
}

export function DemoJump() {
  useEffect(() => {
    let arriveTimer = 0;
    let cancel = () => {};

    const arrive = (stage) => {
      window.clearTimeout(arriveTimer);
      delete stage.dataset.arrive;
      void stage.offsetWidth; // restart the ring when the link is used twice in a row
      stage.dataset.arrive = 'true';
      arriveTimer = window.setTimeout(() => { delete stage.dataset.arrive; }, 1400);
    };

    const toDemo = (stage) => {
      cancel();
      // Focus first, without scrolling: keyboard and screen-reader users land on the question, and the dock
      // (shown while focus is inside it) can leave as the card comes on.
      firstControl(stage)?.focus({ preventScroll: true });
      cancel = glideTo(() => topFor(stage, headroom(stage)), () => arrive(stage));
    };

    const toSection = (node, url, step) => {
      cancel();
      const scene = Number.isFinite(step) && storyRest(node, step) !== null;
      cancel = glideTo(() => (scene ? storyRest(node, step) ?? topFor(node) : topFor(node)), () => focusSection(node));
      try { window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash); } catch { /* the page still moved */ }
    };

    const toTop = (url) => {
      cancel();
      cancel = glideTo(() => 0);
      try { window.history.replaceState(window.history.state, '', url.pathname + url.search); } catch { /* the page still moved */ }
    };

    const onClick = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      const url = ownLink(anchor);
      if (!url) return;
      // Ahead of the router's own click handling (capture on the document runs before React's root listener),
      // so next/link sees defaultPrevented and leaves the jump to us.
      if (url.hash === `#${TARGET}`) {
        const stage = document.getElementById(TARGET);
        if (!stage) return;
        event.preventDefault();
        toDemo(stage);
        return;
      }
      if (url.hash.length > 1) {
        let id = url.hash.slice(1);
        try { id = decodeURIComponent(id); } catch { /* use it as written */ }
        const node = document.getElementById(id);
        if (!node) return;
        event.preventDefault();
        toSection(node, url, anchor.dataset.ssStep === undefined ? NaN : Number(anchor.dataset.ssStep));
        return;
      }
      // A link to this very page with no hash (the logo): the top of the page. Only the page's own links to
      // itself, with the same query, so a link to "/?ref=ad" from elsewhere on the page is left alone.
      if (url.search === window.location.search) {
        event.preventDefault();
        toTop(url);
      }
    };

    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      cancel();
      window.clearTimeout(arriveTimer);
    };
  }, []);

  return null;
}

export default DemoJump;
