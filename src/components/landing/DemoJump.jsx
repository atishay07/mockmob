'use client';

import { useEffect } from 'react';
import '@/app/landing-close.css';

// Every "Try a CUET question" link on the landing (the phone dock, the close band, the hero's pill and proof
// tile) points at the sample question, #try-practice. Left to the router, a second tap did nothing: the URL
// already ended in #try-practice, so the navigation was a no-op and the page stayed at the footer. This takes
// over any same-page link to the demo: it always brings the question card on screen just under the sticky
// nav, puts focus on its first answer (so the dock, which stays up while focus is inside it, steps aside),
// and settles a volt ring on the card so the eye lands on it. From far down the page it cuts most of the way
// at once and glides the last screen, rather than whirling through every section. Reduce motion jumps.
// Without JavaScript the links still work as plain anchors (scroll-margin-top keeps the card clear of the nav).
const TARGET = 'try-practice';
const GAP = 12;

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
    let settleTimer = 0;
    let arriveTimer = 0;
    let frame = 0;
    let stopSettle = () => {};

    const arrive = (stage) => {
      window.clearTimeout(arriveTimer);
      delete stage.dataset.arrive;
      void stage.offsetWidth; // restart the ring when the link is used twice in a row
      stage.dataset.arrive = 'true';
      arriveTimer = window.setTimeout(() => { delete stage.dataset.arrive; }, 1400);
    };

    const go = (stage) => {
      stopSettle();
      cancelAnimationFrame(frame);
      const calm = reducedNow();
      // Focus first, without scrolling: keyboard and screen-reader users land on the question, and the dock
      // (shown while focus is inside it) can leave as the card comes on.
      firstControl(stage)?.focus({ preventScroll: true });

      const settle = () => {
        stopSettle();
        const top = topFor(stage);
        if (Math.abs(window.scrollY - top) > 6) window.scrollTo({ top, behavior: 'instant' });
        arrive(stage);
      };
      const watchEnd = () => {
        const onEnd = () => settle();
        window.addEventListener('scrollend', onEnd, { once: true });
        settleTimer = window.setTimeout(settle, 1200);
        stopSettle = () => { window.removeEventListener('scrollend', onEnd); window.clearTimeout(settleTimer); stopSettle = () => {}; };
      };

      const top = topFor(stage);
      if (calm || Math.abs(window.scrollY - top) < 2) { window.scrollTo({ top, behavior: 'instant' }); arrive(stage); return; }
      const far = Math.abs(window.scrollY - top) > window.innerHeight * 2;
      if (far) {
        const lead = Math.round(window.innerHeight * 0.85);
        window.scrollTo({ top: window.scrollY > top ? top + lead : Math.max(0, top - lead), behavior: 'instant' });
        // A frame for the sections around the card to draw, then the glide to its final place.
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => {
            watchEnd();
            window.scrollTo({ top: topFor(stage), behavior: 'smooth' });
          });
        });
        return;
      }
      watchEnd();
      window.scrollTo({ top, behavior: 'smooth' });
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
      stopSettle();
      cancelAnimationFrame(frame);
      window.clearTimeout(arriveTimer);
    };
  }, []);

  return null;
}

export default DemoJump;
