'use client';

// The home hero's Mobi on the desk (1104 "Desk Light"; LK67, decisions 2, 4, 5, 13): the real rigged Mobi (MobiReact,
// the app's rig) standing in his lamp-lit room (HeroRoom), handing you the real first question (DemoDrill, the card
// attached to the room's foot). One variant, the same at every width; only his size changes (hero-scene.css).
//
//   First frame   the open-eyed wave (decision 2): the server draws the wave's still pose from a generated SVG
//                 (MobiPoster, mobiPoster.generated.js). MobiReact loads on idle (or on the first press) and enters
//                 the wave part way through, from that same pose, so nothing jumps; then he stands at ease.
//   Rest          no frame loop (MobiReact idle="css"): a CSS breathe and a blink every 4.2 s.
//   Gaze          desktop with a fine pointer only: his eyes follow the pointer by at most 2.5 px (the hero's old
//                 pointer spotlight, converted; decision 4). Phones: nothing.
//   The headline  when a typed phrase completes (HeroTyped's window event mm:hero-typed), his eyes glance 2 px
//                 toward the h1 over 140 ms and back over 160 ms; on the final phrase he nods once (decision 5).
//   The sample    every answer sends its state (demoSignal.mjs): a right answer plays `correct`, a miss
//                 `encourage`, the end of the five cheers or encourages by the score, and only then does his bubble
//                 change (heroTaps.mjs deskLine). The subject list, a loaded subject and a "Try 5 questions first" tap
//                 with the card on screen each have a line too (R8 HERO-03, HERO-08).
//   Taps          one reaction act each (hop, tilt, startle; never the same twice; MobiReact's tap run). The
//                 bubble never changes on a tap (decision 13). On Android an act-playing tap buzzes 8 ms.
//
// The bubble never changes size: all the lines sit in one grid cell (the widest sets the box) and the shown one
// cross-fades in over 180 ms with a 4 px rise. A screen reader hears the current line once, from a polite live region.
// Reduce motion: no acts, no gaze, no glance, no breathe; the line still changes (a fade). No sound.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import { DEMO_STATE_EVENT } from './demoSignal.mjs';
import { DESK_LINES, DESK_STATES, deskAct, deskLine } from './heroTaps.mjs';
import { GLANCE as HERO_GLANCE, glanceOffset } from '@/components/brand/mobiGaze.mjs';

export const HERO_TYPED_EVENT = 'mm:hero-typed';
const LABEL = 'Mobi. Tap him.';
/** His drawn height in px at the desk's widest (hero-scene.css sets the real size per width). */
const SIZE = 180;
/** The first act and how far through it he enters (the poster is its still pose). */
export const HERO_FIRST_ACT = 'wave';
const ENTER_AT = 0.55;
/** A tap plays these, in turn (never the same twice), capped at 6 a visit; then only the squash. */
export const HERO_TAP_CYCLE = Object.freeze({ acts: ['hop', 'tilt', 'startle'], resetAfterMs: 8000, cap: 6 });

function loadRig() {
  return import('@/components/brand/MobiReact').then((m) => m.default);
}

export default function HeroMobi({ poster = null }) {
  const prefs = useMobiPrefs();
  const rootRef = useRef(null);
  const [Rig, setRig] = useState(null);
  const [state, setState] = useState('load');
  const [subject, setSubject] = useState(null);
  const [act, setAct] = useState(HERO_FIRST_ACT);
  const loading = useRef(false);

  // The rig swaps in only between presses: a press that began on the poster's button ends on it, so its click lands.
  const pressing = useRef(false);
  const ready = useRef(null);
  const applyRef = useRef(null);
  const apply = useCallback(() => {
    if (!ready.current || pressing.current) return;
    // While the opening (OpeningMo) still covers the page, he waits for its hand-off, so the wave is seen.
    if (openingRunning()) { waitForHandoff(() => applyRef.current?.()); return; }
    const Component = ready.current;
    ready.current = null;
    setRig(() => Component);
  }, []);
  useEffect(() => { applyRef.current = apply; }, [apply]);
  const load = useCallback(() => {
    if (loading.current) return;
    loading.current = true;
    loadRig().then((Component) => { ready.current = Component; apply(); }).catch(() => { loading.current = false; });
  }, [apply]);
  const pressStart = () => { pressing.current = true; load(); };
  const pressEnd = () => { window.setTimeout(() => { pressing.current = false; apply(); }, 0); };

  // Load the rig on idle once he is on screen.
  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    let idle = 0;
    const seen = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      seen.disconnect();
      idle = window.requestIdleCallback ? window.requestIdleCallback(load, { timeout: 2000 }) : window.setTimeout(load, 1200);
    });
    seen.observe(node);
    return () => {
      seen.disconnect();
      if (idle && window.cancelIdleCallback) window.cancelIdleCallback(idle); else window.clearTimeout(idle);
    };
  }, [load]);

  // When he waves, the site bar's Mobi (Logo B, the second o) blinks once: they are the same character.
  useEffect(() => {
    if (!Rig || prefs.reduced) return;
    wink();
  }, [Rig, prefs.reduced]);

  // The sample's state: his act and his bubble (the only thing that changes the bubble).
  useEffect(() => {
    const onState = (event) => {
      const next = event.detail?.state;
      if (!DESK_STATES.includes(next)) return;
      setState(next);
      if (next === 'live') setSubject(event.detail?.subject || null);
      // The subject list closed and the card put its line back: nothing new happened, so no act (R8 revision).
      if (event.detail?.restore) return;
      const mood = deskAct(next);
      if (!mood) return;
      if (!Rig) load();
      setAct((current) => {
        if (current !== mood) return mood;
        // The same act again: step through idle so MobiReact sees a change and plays it once more.
        window.requestAnimationFrame(() => setAct(mood));
        return 'idle';
      });
    };
    window.addEventListener(DEMO_STATE_EVENT, onState);
    return () => window.removeEventListener(DEMO_STATE_EVENT, onState);
  }, [Rig, load]);

  // The headline: a glance toward the h1 when a typed phrase completes, and one nod on the final one.
  useEffect(() => {
    if (prefs.reduced) return undefined;
    const node = rootRef.current;
    let back = 0;
    let done = 0;
    const onTyped = (event) => {
      if (!node) return;
      const h1 = document.querySelector('.lp-hero .lp-title');
      const fig = node.querySelector('.lp-desk__figure');
      if (!h1 || !fig) return;
      const [x, y] = glanceOffset(h1.getBoundingClientRect(), fig.getBoundingClientRect());
      window.clearTimeout(back);
      window.clearTimeout(done);
      node.style.setProperty('--glance-ms', `${HERO_GLANCE.inMs}ms`);
      node.style.setProperty('--glx', `${x}px`);
      node.style.setProperty('--gly', `${y}px`);
      node.dataset.glance = 'on';
      back = window.setTimeout(() => {
        node.style.setProperty('--glance-ms', `${HERO_GLANCE.outMs}ms`);
        node.style.setProperty('--glx', '0px');
        node.style.setProperty('--gly', '0px');
        done = window.setTimeout(() => { delete node.dataset.glance; }, HERO_GLANCE.outMs);
      }, HERO_GLANCE.inMs + HERO_GLANCE.holdMs);
      if (event.detail?.final) setAct((current) => (current === 'nod' ? current : 'nod'));
    };
    window.addEventListener(HERO_TYPED_EVENT, onTyped);
    return () => { window.removeEventListener(HERO_TYPED_EVENT, onTyped); window.clearTimeout(back); window.clearTimeout(done); };
  }, [prefs.reduced]);

  // MobiReact calls this only when a tap plays an act (never under Reduce motion, never for the squash alone).
  const onAct = () => {
    if (prefs.celebrations === 'off' || !prefs.touch) return;
    try { navigator.vibrate?.(8); } catch { /* no vibration */ }
  };
  // A tap before the rig has loaded loads it (the act plays on the next tap; the line never changes on a tap).
  const onTapped = (event) => {
    if (!Rig && event.target.closest?.('.mobi-react__hit')) load();
  };

  const line = deskLine(state, { subject });
  return (
    <div ref={rootRef} className="lp-mobi lp-desk__mobi" data-rig={Rig ? 'on' : 'off'} data-state={state} onClick={onTapped} onPointerDown={pressStart} onPointerUp={pressEnd} onPointerCancel={pressEnd} onKeyDown={load}>
      <p className="lp-desk__bubble" aria-hidden="true">
        {DESK_STATES.map((key) => (
          <span key={key} className="lp-desk__line" data-on={key === state ? 'true' : undefined}>{key === 'live' ? deskLine(key, { subject }) : DESK_LINES[key]}</span>
        ))}
      </p>
      <span className="sr-only" aria-live="polite">{line}</span>
      <div className="lp-desk__figure">
        {Rig ? (
          <Rig act={act} size={SIZE} interactive idle="css" gaze tapCycle={HERO_TAP_CYCLE} enterAt={ENTER_AT} label={LABEL} onTap={onAct} />
        ) : (
          <span className="mobi-react lp-mobi__poster" data-act={HERO_FIRST_ACT} data-interactive="true" style={{ '--mobi-size': `${SIZE}px`, '--mobi-ar': '0.8333' }}>
            {poster}
            <button type="button" className="mobi-react__hit" aria-label={LABEL} />
          </span>
        )}
      </div>
    </div>
  );
}

// The opening (openingGate.mjs) publishes its phase on window.__mmOpening and says 'handoff' and 'done' with the window
// event mm:opening. A page without it, or one that skipped it, never waits.
function openingRunning() {
  return typeof window !== 'undefined' && window.__mmOpening?.phase === 'run';
}
let handoffWaiters = null;
function waitForHandoff(fn) {
  if (!handoffWaiters) {
    handoffWaiters = new Set();
    const go = () => {
      window.removeEventListener('mm:opening', go);
      const list = handoffWaiters;
      handoffWaiters = null;
      list.forEach((f) => f());
    };
    window.addEventListener('mm:opening', go);
  }
  handoffWaiters.add(fn);
}

// The site bar's Mobi (Logo B, the second o) closes and opens his eyes once (hero-scene.css).
function wink() {
  const root = document.documentElement;
  root.dataset.mobiWink = 'true';
  window.setTimeout(() => { delete root.dataset.mobiWink; }, 220);
}
