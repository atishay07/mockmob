'use client';

// The Mistake Lab's next-look screens, loaded late (21 Nov 2026, load weight on /home-next). LabCinema look="next" loads
// this small file (next/dynamic) for each scene's screen box; the screens themselves (LabNextScreens.jsx, the result page's
// own parts) are drawn by the server as before, so the Lab is complete without script and its boxes keep their size. In the
// browser this file keeps that drawing as plain markup (its dangerouslySetInnerHTML: React leaves a server-drawn
// element's insides alone) and asks for the screens' code only when the Lab comes within about one and a half screens of
// the window; once it has arrived, the five screens go live in idle time, one per idle period, in the same boxes. The Lab is a held
// story, so it is never on screen before this has run unless a reader flings straight to it, and even then it shows the
// server's finished screens until they go live.
//
// The screens' sheets are imported here, in the order LabNextScreens' own imports bring them, so the server-drawn screens
// are styled from the start (a lazily loaded module's CSS would only arrive with its code). They load only with this file,
// that is only for the next look: the live home's Lab carries none of them.
import { lazy, useEffect, useRef, useState } from 'react';
import './demo/cursor-demo.css';
import '@/components/result/marks-ledger.css';
import '@/components/result/swot.css';
import '@/components/recovery/mistake-repair.css';
import './lab-next.css';

/** How near the window the Lab is when the screens' code is asked for: 150 % of the window's height. */
export const LAB_NEAR = '150% 0px 150% 0px';

// The server render: the screens as part of the page's own HTML. The module is asked for as soon as this file is evaluated on
// the server, and once it is there the lazy component resolves at once (a thenable that answers synchronously), so the
// server draws it in place rather than streaming it after the page. It has no Suspense boundary of its own (21 Nov 2026,
// round 4): each boundary is one more streamed part that React reveals later, and on a first visit the reveals that fall
// together made one 700 ms frame; were it ever still loading, the section's own boundary waits for it. In the browser this
// import never runs.
let serverModule = null;
export const SERVER_READY = typeof window === 'undefined' ? import('./LabNextScreens').then((m) => { serverModule = m; return m; }) : null;
const ServerScreens = lazy(() => (serverModule ? { then: (done) => done(serverModule) } : SERVER_READY));

// The server's drawing of each screen, by scene, read from the page before React can replace it. next/dynamic renders this
// file behind its own Suspense boundary, and React may build that boundary afresh instead of hydrating it (an update
// reached it first): the box then gets the same markup back from here, never an empty box. Read when this file is first
// evaluated (or on DOMContentLoaded), and again as a box is drawn if its screen had not been revealed yet then (React
// reveals a streamed part in a later frame).
const DRAWN = {};
function readDrawn() {
  document.querySelectorAll('.lc-scene__fit').forEach((box) => {
    const scene = box.querySelector('.lnx')?.className.match(/\blnx--([\w-]+)/)?.[1];
    if (scene && !DRAWN[scene]) DRAWN[scene] = box.innerHTML;
  });
  return DRAWN;
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', readDrawn, { once: true }); else readDrawn();
}

// One load for the five scenes.
let loaded = null;
let loading = null;
const loadScreens = () => {
  loading ||= import('./LabNextScreens').then((mod) => { loaded = mod.default; return loaded; });
  return loading;
};
const idle = (fn) => (typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(fn, { timeout: 900 }) : window.setTimeout(fn, 1));
// The screens go live one per idle period (each its own render), never five in one long task.
const turns = [];
let turning = false;
const nextTurn = () => {
  const fn = turns.shift();
  if (!fn) { turning = false; return; }
  fn();
  idle(nextTurn);
};
const inTurn = (fn) => { turns.push(fn); if (!turning) { turning = true; idle(nextTurn); } };

// `fit`: the box's ScrollStory fit floor (data-ss-fit). The other props go to the screen (LabNextScreens.jsx).
export default function LabNextGate({ fit, ...props }) {
  const box = useRef(null);
  const [Screen, setScreen] = useState(null);

  useEffect(() => {
    const node = box.current;
    if (!node) return undefined;
    let gone = false;
    let io = null;
    const go = () => {
      io?.disconnect();
      loadScreens().then((C) => { if (!gone) inTurn(() => { if (!gone) setScreen(() => C); }); });
    };
    // A client-side visit has no server drawing to keep; a second mount finds the code already here.
    if (loaded || !node.childElementCount || typeof IntersectionObserver === 'undefined') { window.setTimeout(go, 0); return () => { gone = true; }; }
    io = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) go(); }, { rootMargin: LAB_NEAR });
    io.observe(node.closest('.lc') || node);
    return () => { gone = true; io?.disconnect(); };
  }, []);

  if (typeof window === 'undefined') return <div className="lc-scene__fit" data-ss-fit={fit}><ServerScreens {...props} /></div>;
  if (!Screen) return <div ref={box} className="lc-scene__fit" data-ss-fit={fit} dangerouslySetInnerHTML={{ __html: DRAWN[props.scene] ?? readDrawn()[props.scene] ?? '' }} suppressHydrationWarning />;
  return <div ref={box} className="lc-scene__fit" data-ss-fit={fit}><Screen {...props} /></div>;
}
