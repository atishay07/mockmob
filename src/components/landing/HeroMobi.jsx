'use client';

// The home hero's Mobi (LK32; hero.md items 2, 3, 5, 8, 9, 10, 14): the real rigged Mobi (MobiReact, the app's rig)
// that answers taps with a line in his bubble.
//
//   variant="room"  phones (up to 760 px): he stands in the painted room's pool of light (HeroRoom), his bubble over
//                   the window. 3.5 s after load, if nobody has tapped him, he looks down at the key once (curious).
//   variant="host"  tablets and desktop (761 px up): he is the sample's host, standing in the gutter at the stage's
//                   lower left, his feet on the stage's bottom line, facing the card; he points at it (nudge) and
//                   answers the sample (a right answer `correct`, a wrong one `encourage`, from DemoDrill's
//                   'pip:react' for the hero). His bubble sits above his head.
//
// Cost: no image bytes and no rig code before the page is idle. The server draws his first frame from a generated
// SVG (MobiPoster, mobiPoster.generated.js); MobiReact loads on idle (or on the first press of his button) and draws
// the same frame in the same commit, so nothing jumps. A tap before it has loaded changes the line at once and plays
// the act when it arrives. A Mobi that is not shown (the other variant at this width) never loads the rig.
//
// Taps: each tap shows the next of six lines (heroTaps.mjs); MobiReact plays the app's tap cycle (hello, tilt, hop,
// startle; never the same twice; reset after 8 s; 6 a visit, then only the squash). Tap 1 winks the site bar's Mobi
// once; tap 4 ("Try five questions?") lifts that key by 2 px once. On Android each act-playing tap buzzes 8 ms.
// Reduce motion: no acts, no wink, no lift, no buzz; the line still changes (a 120 ms fade). Celebrations follow
// MobiReact's rule (Quiet: the hop is a nod; Off: the hop is only the squash) and Off also drops the buzz. No sound.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import { loadBankSize } from './bankStats';
import { HERO_KEY_LIFT_STEP, heroTapLine, nextHeroStep } from './heroTaps.mjs';

export const HERO_TAP_EVENT = 'mm:mobi-tap';
const LABEL = 'Mobi. Tap for a tip.';
const SIZE = { room: 178, host: 140 };
// The sample's answers he takes (DemoDrill's pipReact('hero', ...)); anything else leaves him as he is.
const ANSWER_ACTS = new Set(['correct', 'encourage', 'cheer', 'celebrate', 'nod']);

function loadRig() {
  return import('@/components/brand/MobiReact').then((m) => m.default);
}

function useBubbleLine(line) {
  // Old line out in 90 ms, the new one in over 210 ms (fadeThroughOut / fadeThroughIn); CSS does the motion. While a
  // new line waits its 90 ms, the old one is marked out.
  const [shown, setShown] = useState({ text: line, n: 0 });
  useEffect(() => {
    if (line === shown.text) return undefined;
    const t = window.setTimeout(() => setShown((s) => ({ text: line, n: s.n + 1 })), 90);
    return () => window.clearTimeout(t);
  }, [line, shown.text]);
  return { ...shown, out: line !== shown.text };
}

export default function HeroMobi({ variant = 'room', poster = null }) {
  const prefs = useMobiPrefs();
  const rootRef = useRef(null);
  const [Rig, setRig] = useState(null);
  const [step, setStep] = useState(0);
  const [bank, setBank] = useState(null);
  const [act, setAct] = useState(variant === 'host' ? 'nudge' : 'idle');
  const pendingTap = useRef(false);
  const synthetic = useRef(false);
  const loading = useRef(false);
  const tappedAt = useRef(0);

  // The rig swaps in only between presses: a press that began on the poster's button ends on it, so its click lands.
  const pressing = useRef(false);
  const ready = useRef(null);
  const apply = useCallback(() => {
    if (!ready.current || pressing.current) return;
    const Component = ready.current;
    ready.current = null;
    setRig(() => Component);
  }, []);
  const load = useCallback(() => {
    if (loading.current) return;
    loading.current = true;
    loadRig().then((Component) => { ready.current = Component; apply(); }).catch(() => { loading.current = false; });
  }, [apply]);
  const pressStart = () => { pressing.current = true; load(); };
  const pressEnd = () => { window.setTimeout(() => { pressing.current = false; apply(); }, 0); };

  // The real bank count for the third line (the same /api/stats answer the bank line uses).
  useEffect(() => {
    let live = true;
    loadBankSize().then((size) => { if (live && size) setBank(size); });
    return () => { live = false; };
  }, []);

  // Load the rig on idle once he is actually on screen (the other variant is display: none and never intersects).
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

  // One Mobi in view (W-074): while the room's Mobi is mostly on screen, the sample's own small Mobi steps aside
  // (hero-scene.css reads data-hero-mobi on the root).
  useEffect(() => {
    const node = rootRef.current;
    if (variant !== 'room' || !node || typeof IntersectionObserver === 'undefined') return undefined;
    const root = document.documentElement;
    const watch = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) root.dataset.heroMobi = 'in';
      else delete root.dataset.heroMobi;
    }, { threshold: [0, 0.5, 1] });
    watch.observe(node);
    return () => { watch.disconnect(); delete root.dataset.heroMobi; };
  }, [variant]);

  // A tap that came before the rig: once it is drawn, play the act that tap asked for (MobiReact's own cycle).
  useEffect(() => {
    if (!Rig || !pendingTap.current) return;
    pendingTap.current = false;
    const hit = rootRef.current?.querySelector('.mobi-react__hit');
    if (!hit) return;
    synthetic.current = true;
    hit.click();
    synthetic.current = false;
  }, [Rig]);

  // Phones: if he has not been tapped 3.5 s after load, he looks down at the key once. Never repeated.
  useEffect(() => {
    if (variant !== 'room' || !Rig || prefs.reduced) return undefined;
    const t = window.setTimeout(() => { if (!tappedAt.current) setAct('curious'); }, Math.max(0, 3500 - performance.now()));
    return () => window.clearTimeout(t);
  }, [variant, Rig, prefs.reduced]);

  // The sample's answer: the host (and the room's Mobi, if he is still on screen) answers it.
  useEffect(() => {
    const onReact = (event) => {
      const { station, mood } = event.detail || {};
      if (station !== 'hero' || !ANSWER_ACTS.has(mood)) return;
      setAct((current) => {
        if (current !== mood) return mood;
        // The same act again: step through idle so MobiReact sees a change and plays it once more.
        window.requestAnimationFrame(() => setAct(mood));
        return 'idle';
      });
    };
    window.addEventListener('pip:react', onReact);
    return () => window.removeEventListener('pip:react', onReact);
  }, []);

  const onTapped = (event) => {
    if (synthetic.current) return;
    if (!event.target.closest?.('.mobi-react__hit')) return;
    tappedAt.current = performance.now();
    const next = nextHeroStep(step);
    setStep(next);
    window.dispatchEvent(new CustomEvent(HERO_TAP_EVENT, { detail: { step: next, variant } }));
    if (!prefs.reduced) {
      if (next === 1 && step === 0) wink();
      if (next === HERO_KEY_LIFT_STEP && step !== HERO_KEY_LIFT_STEP) liftKey();
    }
    if (!Rig) { pendingTap.current = true; load(); }
  };

  // MobiReact calls this only when a tap plays an act (never under Reduce motion, never for the squash alone).
  const onAct = () => {
    if (prefs.celebrations === 'off' || !prefs.touch) return;
    try { navigator.vibrate?.(8); } catch { /* no vibration */ }
  };

  const shown = useBubbleLine(heroTapLine(step, bank));
  const size = SIZE[variant] || SIZE.room;
  return (
    <div ref={rootRef} className={`lp-mobi lp-mobi--${variant}`} data-rig={Rig ? 'on' : 'off'} data-step={step} onClick={onTapped} onPointerDown={pressStart} onPointerUp={pressEnd} onPointerCancel={pressEnd} onKeyDown={load}>
      <p className="lp-mobi__bubble" aria-live="polite">
        <span key={shown.n} className="lp-mobi__line" data-out={shown.out ? 'true' : undefined}>{shown.text}</span>
      </p>
      <div className="lp-mobi__figure">
        {Rig ? (
          <Rig act={act} size={size} interactive follow={variant === 'host' || undefined} label={LABEL} onTap={onAct} />
        ) : (
          <span className="mobi-react lp-mobi__poster" data-act="idle" data-interactive="true" style={{ '--mobi-size': `${size}px`, '--mobi-ar': '0.8333' }}>
            {poster}
            <button type="button" className="mobi-react__hit" aria-label={LABEL} />
          </span>
        )}
      </div>
    </div>
  );
}

// Tap 1: the site bar's Mobi (Logo B, the second o) closes and opens his eyes once (hero-scene.css).
function wink() {
  const root = document.documentElement;
  root.dataset.mobiWink = 'true';
  window.setTimeout(() => { delete root.dataset.mobiWink; }, 220);
}

// Tap 4: "Try five questions?" and that key lifts 2 px and settles once (240 ms, transform only, no glow).
function liftKey() {
  const key = document.querySelector('.lp-hero .lp-cta a[href="/#try-practice"]');
  key?.animate?.([{ translate: '0 0' }, { translate: '0 -2px', offset: 0.45 }, { translate: '0 0' }], { duration: 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
}
