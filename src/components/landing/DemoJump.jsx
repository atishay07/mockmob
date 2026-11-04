'use client';

import { useEffect } from 'react';
import '@/app/landing-close.css';
import { instantTo } from './scrollBus.mjs';

// Every same-page link to the sample questions (#try-practice: the hero's "Try 5 questions first" key, the hero beat's
// "Five questions free") brings the question card itself on screen. Left to the router, a second tap did nothing: the
// URL already ended in #try-practice, so the navigation was a no-op and the page stayed where it was.
//
// What a tap does (5 Nov 2026, LK89):
//   - The question card (.lp-desk__card), not the whole desk, is what is placed: in the middle of the window under the
//     sticky nav, wholly on screen, with as much of the room above it as that leaves (Mobi answers each pick there).
//     The desk's top used to be put under the nav, so the room arrived first and the card sat low, under the dock on a
//     short phone; a card put at the very top left a 12 px sliver of painting under the nav and Mobi off screen
//     (tmp/night-1105/p4, variants A and B). A card already wholly on screen is not moved at all.
//   - The move is one instant jump, declared to the page's scroll bus first (scrollBus.instantTo), so the held stories
//     it crosses neither race past under a smooth glide nor hold the arrival on their edge (LK69: no programmatic glide
//     anywhere on the landing; the controller stands down for a declared jump).
//   - Focus goes to the card itself (DemoDrill's root, tabIndex -1, no ring for this programmatic focus), so keyboard
//     and screen-reader users land on the question and the next Tab reaches answer A.
//   - The card's own shell says it has arrived, quietly: its shadow lifts and its border brightens, then both settle
//     over about 600 ms (landing-close.css). No ring, no colour.
// Without JavaScript the links still work as plain anchors (scroll-margin-top keeps the card clear of the nav).
const TARGET = 'try-practice';
const CARD = '.lp-desk__card';
const GAP = 12;
const ARRIVE_MS = 700;

function navBottom() {
  const nav = document.querySelector('.mm-nav');
  if (!nav) return 0;
  const box = nav.getBoundingClientRect();
  return box.bottom > 0 ? box.bottom : 0;
}

/**
 * Where the page goes so the card sits in the middle of the window under the nav, its top at least GAP below the nav,
 * the room above it showing what that leaves (on a 390 x 720 phone, Mobi and his "Your first question" bubble; never
 * the 12 px sliver of painting a top-aligned card left). Null when the card is already wholly on screen: nothing moves.
 */
function topFor(stage, card, { always = false } = {}) {
  const box = card.getBoundingClientRect();
  const nav = navBottom();
  if (!always && box.top >= nav + GAP - 1 && box.bottom <= window.innerHeight) return null;
  const room = Math.max(0, box.top - stage.getBoundingClientRect().top);
  const above = Math.max(GAP, Math.min(room, (window.innerHeight - nav - box.height) / 2));
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return Math.round(Math.max(0, Math.min(max, window.scrollY + box.top - nav - above)));
}

function isDemoLink(anchor) {
  if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return false;
  let url;
  try { url = new URL(anchor.href, window.location.href); } catch { return false; }
  return url.origin === window.location.origin && url.pathname === window.location.pathname && url.hash === `#${TARGET}`;
}

function focusTarget(stage) {
  return stage.querySelector('.mm-drill[tabindex]')
    || stage.querySelector('.mm-drill__option:not(:disabled)')
    || stage.querySelector('.mm-drill__foot .mm-btn');
}

export function DemoJump() {
  useEffect(() => {
    let arriveTimer = 0;
    let frame = 0;

    const arrive = (stage) => {
      window.clearTimeout(arriveTimer);
      delete stage.dataset.arrive;
      void stage.offsetWidth; // restart the lift when the link is used twice in a row
      stage.dataset.arrive = 'true';
      arriveTimer = window.setTimeout(() => { delete stage.dataset.arrive; }, ARRIVE_MS);
    };

    const go = (stage) => {
      cancelAnimationFrame(frame);
      const card = stage.querySelector(CARD) || stage;
      // Focus first, without scrolling: the dock (shown while focus is inside it) can leave as the card comes on.
      focusTarget(stage)?.focus({ preventScroll: true });
      const top = topFor(stage, card);
      if (top !== null && Math.abs(window.scrollY - top) >= 2) instantTo(top);
      arrive(stage);
      // Two frames on, once the page has laid itself out around the jump, a last correction if the card drifted.
      if (top === null) return;
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          const settled = topFor(stage, card, { always: true });
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
