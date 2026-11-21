'use client';

// /home-next's one frame, loaded late (21 Nov 2026, the emulator check: /home-next ran 29 long tasks while loading against
// 10 on "/", because the frame's three real stages hydrated with the page). The server still draws the whole frame
// (OnePlace.jsx: its rows, its three stages and the volt key under them), so the page is complete without script and the
// frame's height is real from the first paint. In the browser this wrapper keeps that drawing as plain markup (its
// dangerouslySetInnerHTML below: React leaves a server-drawn element's insides alone) and asks for the frame's code only when
// the frame comes within about one and a half screens of the window, or a finger or the focus reaches it. When the code has
// arrived (in idle time), the drawn stages are kept as they are (OnePlace `drawn`) and only the row on show becomes live; the
// next row's stage is made live in idle time shortly before its turn (OnePlace.jsx).
//
// The frame's sheets are imported here, in the order OnePlace's own imports bring them, so the server-drawn frame is styled
// from the page's head exactly as before (a lazily loaded module's CSS would only arrive with its code).
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import './demo/cursor-demo.css';
import '@/components/doodle/doodle.css';
import '@/app/exam-device.css';
import '@/app/exam-screen.css';
import './loading-kit.css';
import './key-cards.css';
import '@/app/brand-stamp.css';
import './bring-mistake.css';
import './one-place.css';

/** How near the window the frame is when its code is asked for: 150 % of the window's height, above or below. */
export const ONE_PLACE_NEAR = '150% 0px 150% 0px';

// The server render: the frame as part of the page's own HTML. The module is asked for as soon as this file is evaluated on
// the server, and once it is there the lazy component resolves at once (a thenable that answers synchronously), so the
// server draws it in place rather than streaming it after the page. In the browser this import never runs.
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

const idle = (fn) => (typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(fn, { timeout: 900 }) : window.setTimeout(fn, 1));

export default function OnePlaceGate(props) {
  const hold = useRef(null);
  const [live, setLive] = useState(null);

  useEffect(() => {
    const node = hold.current;
    if (!node) return undefined;
    let gone = false;
    let started = false;
    let io = null;
    const go = () => {
      if (started) return;
      started = true;
      io?.disconnect();
      node.removeEventListener('pointerdown', go, true);
      node.removeEventListener('focusin', go, true);
      import('./OnePlace').then((mod) => {
        if (gone) return;
        idle(() => { if (!gone) setLive({ Frame: mod.default, drawn: drawnStages(node) }); });
      });
    };
    // A client-side visit has no server drawing to keep: the frame is made at once.
    io = node.childElementCount && typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) go(); }, { rootMargin: ONE_PLACE_NEAR })
      : null;
    if (io) io.observe(node); else window.setTimeout(go, 0);
    node.addEventListener('pointerdown', go, true);
    node.addEventListener('focusin', go, true);
    return () => {
      gone = true;
      io?.disconnect();
      node.removeEventListener('pointerdown', go, true);
      node.removeEventListener('focusin', go, true);
    };
  }, []);

  if (typeof window === 'undefined') return <div className="op-gate"><Suspense fallback={null}><ServerFrame {...props} /></Suspense></div>;
  if (!live) return <div ref={hold} className="op-gate" dangerouslySetInnerHTML={{ __html: readDrawn() }} suppressHydrationWarning />;
  const { Frame, drawn } = live;
  return <div ref={hold} className="op-gate"><Frame {...props} drawn={drawn} /></div>;
}
