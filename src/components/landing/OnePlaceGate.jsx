'use client';

// /home-next's one frame, loaded late (21 Nov 2026, the emulator check: /home-next ran 29 long tasks while loading against
// 10 on "/", because the frame's three real stages hydrated with the page). The server still draws the whole frame
// (OnePlace.jsx: its rows, its three stages and the volt key under them), so the page is complete without script and the
// frame's height is real from the first paint. In the browser this wrapper keeps that drawing as plain markup (its
// dangerouslySetInnerHTML below: React leaves a server-drawn element's insides alone). It asks for the frame's code in quiet
// time once the page has loaded and the opening has handed over (idleQueue.mjs: critic round 5, 21 Nov 2026, the code used
// to arrive as the frame neared the window, inside a reader's swipes), or sooner if the frame comes within about one and a
// half screens of the window or a finger or the focus reaches it. When the code has arrived, in the next idle period, the
// drawn stages are kept as they are (OnePlace `drawn`) and only the row on show becomes live; the next row's stage is made
// live in idle time shortly before its turn (OnePlace.jsx).
//
// The frame's sheets are imported here, in the order OnePlace's own imports bring them, so the server-drawn frame is styled
// from the page's head exactly as before (a lazily loaded module's CSS would only arrive with its code).
import { lazy, useEffect, useRef, useState } from 'react';
import { afterOpening, inIdle } from './idleQueue.mjs';
import './demo/cursor-demo.css';
import '@/components/doodle/doodle.css';
import '@/app/exam-device.css';
import '@/app/exam-screen.css';
import './loading-kit.css';
import './key-cards.css';
import '@/app/brand-stamp.css';
// The row stories' own sheets (21 Nov 2026), in the frame's registry order, before the frame's sheet: one-place.css places
// the stories on their cards and stays last, as it was.
import './stories/mobi-story.css';
import './stories/learn-story.css';
import './stories/rival-story.css';
import './stories/mob-story.css';
import './one-place.css';

/** How near the window the frame is when its code is asked for: 150 % of the window's height, above or below. */
export const ONE_PLACE_NEAR = '150% 0px 150% 0px';

// The server render: the frame as part of the page's own HTML. The module is asked for as soon as this file is evaluated on
// the server, and once it is there the lazy component resolves at once (a thenable that answers synchronously), so the
// server draws it in place rather than streaming it after the page. It has no Suspense boundary of its own (21 Nov 2026,
// round 4): each boundary is one more streamed part that React reveals later, and on a first visit the reveals that fall
// together made one 700 ms frame; were it ever still loading, the section's own boundary waits for it. In the browser this
// import never runs.
let serverModule = null;
export const SERVER_READY = typeof window === 'undefined' ? import('./OnePlace').then((m) => { serverModule = m; return m; }) : null;
const ServerFrame = lazy(() => (serverModule ? { then: (done) => done(serverModule) } : SERVER_READY));

// The drawn stages, by row id: each slot's inner markup as the server drew it, read once just before the frame goes live.
function drawnStages(node) {
  const out = {};
  node?.querySelectorAll('.op-slot[data-tool]').forEach((slot) => { out[slot.dataset.tool] = slot.innerHTML; });
  return out;
}

// The server's drawing of the whole frame, read from the page before React can replace it: if React builds the section
// afresh instead of hydrating it (an update reached its boundary first), the frame gets the same markup back, never an
// empty box. Read when this file is first evaluated (or on DOMContentLoaded), and again as the hold is drawn if the frame had
// not been revealed yet then (React reveals a streamed section in a later frame).
let DRAWN = '';
function readDrawn() { if (!DRAWN.includes('op-slot')) DRAWN = document.querySelector('.op-gate')?.innerHTML || DRAWN; return DRAWN; }
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', readDrawn, { once: true }); else readDrawn();
}

export default function OnePlaceGate(props) {
  const hold = useRef(null);
  const [live, setLive] = useState(null);

  useEffect(() => {
    const node = hold.current;
    if (!node) return undefined;
    let gone = false;
    let started = false;
    let io = null;
    // `near`: the reader is at the frame (the approach watch, a touch, the focus): its steps go to the front of the queue.
    const go = (near = false) => {
      if (started || gone) return;
      started = true;
      io?.disconnect();
      node.removeEventListener('pointerdown', onTouch, true);
      node.removeEventListener('focusin', onTouch, true);
      import('./OnePlace').then((mod) => {
        if (gone) return;
        inIdle(() => { if (!gone) setLive({ Frame: mod.default, drawn: drawnStages(node) }); }, { first: near });
      });
    };
    const onTouch = () => go(true);
    // A client-side visit has no server drawing to keep: the frame is made at once.
    io = node.childElementCount && typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) go(true); }, { rootMargin: ONE_PLACE_NEAR })
      : null;
    if (io) io.observe(node); else window.setTimeout(() => go(true), 0);
    node.addEventListener('pointerdown', onTouch, true);
    node.addEventListener('focusin', onTouch, true);
    // Quiet time after the opening: the code is asked for in an idle period of its own.
    afterOpening().then(() => inIdle(() => go(false)));
    return () => {
      gone = true;
      io?.disconnect();
      node.removeEventListener('pointerdown', onTouch, true);
      node.removeEventListener('focusin', onTouch, true);
    };
  }, []);

  if (typeof window === 'undefined') return <div className="op-gate"><ServerFrame {...props} /></div>;
  if (!live) return <div ref={hold} className="op-gate" dangerouslySetInnerHTML={{ __html: readDrawn() }} suppressHydrationWarning />;
  const { Frame, drawn } = live;
  return <div ref={hold} className="op-gate"><Frame {...props} drawn={drawn} /></div>;
}
