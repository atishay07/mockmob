'use client';

import { useEffect } from 'react';
import '@/app/landing-close.css';
import { instantTo } from './scrollBus.mjs';

// Every "Try a CUET question" link on the landing (the phone dock, the close band, the hero's pill and proof
// tile) points at the sample question, #try-practice. Left to the router, a second tap did nothing: the URL
// already ended in #try-practice, so the navigation was a no-op and the page stayed at the footer. This takes
// over any same-page link to the demo: it always brings the question card on screen just under the sticky
// nav, puts focus on its first answer (so the dock, which stays up while focus is inside it, steps aside),
// and settles a volt ring on the card so the eye lands on it. The move is one instant jump, declared to the
// page's scroll bus first (scrollBus.instantTo), so the held stories between the close band and the card neither
// race past under a smooth glide nor clamp the arrival (LK69: no programmatic glide anywhere on the landing).
// Without JavaScript the links still work as plain anchors (scroll-margin-top keeps the card clear of the nav).
const TARGET = 'try-practice';
const GAP = 12;

function navBottom() {
  const nav = document.querySelector('.mm-nav');
  if (!nav) return 0;
  const box = nav.getBoundingClientRect();
  return box.bottom > 0 ? box.bottom : 0;
}

function topFor(stage) {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const top = window.scrollY + stage.getBoundingClientRect().top - navBottom() - GAP;
  return Math.round(Math.max(0, Math.min(max, top)));
}

function isDemoLink(anchor) {
  if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return false;
  let url;
  try { url = new URL(anchor.href, window.location.href); } catch { return false; }
  return url.origin === window.location.origin && url.pathname === window.location.pathname && url.hash === `#${TARGET}`;
}

function firstControl(stage) {
  return stage.querySelector('.mm-drill__option:not(:disabled)')
    || stage.querySelector('.mm-drill__foot .mm-btn')
    || stage.querySelector('.mm-drill__result');
}

export function DemoJump() {
  useEffect(() => {
    let arriveTimer = 0;
    let frame = 0;

    const arrive = (stage) => {
      window.clearTimeout(arriveTimer);
      delete stage.dataset.arrive;
      void stage.offsetWidth; // restart the ring when the link is used twice in a row
      stage.dataset.arrive = 'true';
      arriveTimer = window.setTimeout(() => { delete stage.dataset.arrive; }, 1400);
    };

    const go = (stage) => {
      cancelAnimationFrame(frame);
      // Focus first, without scrolling: keyboard and screen-reader users land on the question, and the dock
      // (shown while focus is inside it) can leave as the card comes on.
      firstControl(stage)?.focus({ preventScroll: true });
      // One instant, declared jump (never a glide): the held stories on the way are passed, not walked.
      const top = topFor(stage);
      if (Math.abs(window.scrollY - top) >= 2) instantTo(top);
      arrive(stage);
      // Two frames on, once the page has laid itself out around the jump, a last correction if the card drifted.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          const settled = topFor(stage);
          if (Math.abs(window.scrollY - settled) > 6) instantTo(settled);
        });
      });
    };

    const onClick = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!isDemoLink(anchor)) return;
      const stage = document.getElementById(TARGET);
      if (!stage) return;
      // Ahead of the router's own click handling (capture on the document runs before React's root listener),
      // so next/link sees defaultPrevented and leaves this jump to us.
      event.preventDefault();
      go(stage);
    };

    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      cancelAnimationFrame(frame);
      window.clearTimeout(arriveTimer);
    };
  }, []);

  return null;
}

export default DemoJump;
