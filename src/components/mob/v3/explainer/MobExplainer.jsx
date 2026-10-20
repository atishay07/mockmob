"use client";
// The Mob explainer: seven slides with motion (MOB-EXPLAINER.md, K9), drawn inside ExplainerFrame's 360 x 780 canvas.
//   Next key; a tap on the right two thirds goes on, the left third goes back; a swipe follows the finger (a third of the
//   pull at either end) and goes on past 70 px or a 0.45 px/ms flick, else snaps back in 300 ms; ArrowLeft and ArrowRight.
//   Skip (slides 1 to 6, top right) goes where the student was heading; slide 7 ends in the keys for the mode.
//   Changing slide mid-motion finishes the outgoing slide at its end state and starts the new one.
//   A11y (S016): the carousel and slide roles, slide labels, a polite live region that reads each slide, visible focus.
//   Reduced motion: the track does not slide (a 120 ms fade), and every move is a 120 ms fade at half its delay.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LogoMark } from '@/components/Logo';
import { BUILDERS } from './slides';
import { E, TL, explainerArt, motionKit } from './motion';
import { EXPLAINER_COPY, PLAY_CARDS, SLIDE_COUNT, TEXT_BEATS, buildTimes, endKeys, liveLine, skipTo, slidesFor } from './explainerModel.mjs';
import { useFrameScale } from './ExplainerFrame';

const W = 360;
const TEXT_TOP = [430, 430, 412, 424, 430, 424, 400];

/** Warm every file the slides draw (once per page), so a slide never builds over a half-loaded still. */
let warmed = null;
export function warmExplainerArt() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (!warmed) warmed = Promise.all(explainerArt().map((src) => { const i = new Image(); i.src = src; return i.decode().catch(() => null); }));
  return warmed;
}

/**
 * mode: start | join | invite | replay. mobName: the invite's Mob name, when the join preview has it. billingOn: the
 * server's flag (slide 3's body). onLeave(destination, how): how is 'skip' or 'key'. onLast(): slide 7 reached.
 * reduced: reduced motion. onApi(api): the preview's seek hooks (never set in the product).
 */
export function MobExplainer({ mode = 'start', mobName = null, billingOn = false, onLeave, onLast, startSlide = 0, reduced = false, onApi = null }) {
  const slides = useMemo(() => slidesFor({ billingOn }), [billingOn]);
  const keys = useMemo(() => endKeys(mode, { mobName }), [mode, mobName]);
  const [slide, setSlide] = useState(startSlide);
  const [instant, setInstant] = useState(true);
  const scale = useFrameScale();
  const scaleRef = useRef(scale);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  const track = useRef(null);
  const vp = useRef(null);
  const stageEls = useRef([]);
  const sectionEls = useRef([]);
  const cur = useRef({ slide: startSlide, tl: null, tls: {}, trackAnim: null });
  const onLastRef = useRef(onLast);
  useEffect(() => { onLastRef.current = onLast; }, [onLast]);
  const last = SLIDE_COUNT - 1;

  const build = useCallback((i, play = true) => {
    const c = cur.current;
    if (c.tl && c.tl !== c.tls[i]) c.tl.finish();
    if (c.tls[i]) c.tls[i].kill();
    const st = stageEls.current[i];
    const sec = sectionEls.current[i];
    if (!st || !sec) return null;
    st.innerHTML = ''; st.className = 'mx-stage';
    const tl = new TL();
    const K = motionKit({ rm: reduced });
    BUILDERS[i](st, tl, { K, T: buildTimes(i, { reduced }) });
    const t = sec.querySelector('.mx-t-title'); const b = sec.querySelector('.mx-t-body'); const x = sec.querySelector('.mx-soon');
    K.rise(tl, t, TEXT_BEATS.title); K.rise(tl, b, TEXT_BEATS.body); if (x) K.rise(tl, x, TEXT_BEATS.soon);
    c.tl = tl; c.tls[i] = tl;
    if (play) tl.play();
    return tl;
  }, [reduced]);

  const go = useCallback((target, { instant: now = false, play = true } = {}) => {
    const i = Math.max(0, Math.min(last, target));
    const c = cur.current; const prev = c.slide; c.slide = i;
    const el = track.current;
    if (c.trackAnim) { c.trackAnim.cancel(); c.trackAnim = null; }
    const x = -i * W;
    if (el) {
      if (now || reduced) {
        el.style.transform = `translateX(${x}px)`;
        if (!now && reduced) sectionEls.current[i]?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120 });
      } else {
        const from = getComputedStyle(el).transform;
        c.trackAnim = el.animate([{ transform: from === 'none' ? `translateX(${-prev * W}px)` : from }, { transform: `translateX(${x}px)` }], { duration: 420, easing: E.emph });
        el.style.transform = `translateX(${x}px)`;
      }
    }
    setInstant(now);
    setSlide(i);
    build(i, play);
    if (i === last) onLastRef.current?.();
  }, [build, last, reduced]);

  // first slide, and the art warmed for the rest
  useEffect(() => {
    warmExplainerArt();
    // The first slide: state already says so (no setState here); build it and play.
    const c = cur.current; c.slide = startSlide;
    build(startSlide);
    if (startSlide === last) onLastRef.current?.();
    return () => { for (const k of Object.keys(c.tls)) c.tls[k].kill(); c.tls = {}; c.tl = null; if (c.trackAnim) c.trackAnim.cancel(); };
  }, [build, startSlide, last]);

  // the preview's seek hooks
  useEffect(() => {
    if (!onApi) return undefined;
    onApi({
      ready: () => warmExplainerArt(),
      slide(i) { go(i, { instant: true, play: false }); return cur.current.tl?.show ?? 0; },
      seek(t) { cur.current.tl?.seek(t); },
      dur() { return cur.current.tl?.show ?? 0; },
      play() { cur.current.tl?.play(); },
      state: () => ({ slide: cur.current.slide }),
    });
    return () => onApi(null);
  }, [onApi, go]);

  // swipe and tap (in design px: the canvas is scaled by `scale`)
  useEffect(() => {
    const v = vp.current; const el = track.current;
    if (!v || !el) return undefined;
    let d = null;
    const snapBack = () => {
      const c = cur.current; const from = getComputedStyle(el).transform; const x = -c.slide * W;
      c.trackAnim = el.animate([{ transform: from }, { transform: `translateX(${x}px)` }], { duration: reduced ? 1 : 300, easing: E.out });
      el.style.transform = `translateX(${x}px)`;
    };
    const down = (e) => { if (e.button) return; d = { x: e.clientX, y: e.clientY, t: performance.now(), drag: false, id: e.pointerId }; };
    const move = (e) => {
      if (!d || e.pointerId !== d.id) return;
      const s = scaleRef.current || 1; const dx = (e.clientX - d.x) / s; const dy = (e.clientY - d.y) / s;
      if (!d.drag && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        d.drag = true; try { v.setPointerCapture(e.pointerId); } catch { /* the pointer left */ }
        const c = cur.current; if (c.trackAnim) { c.trackAnim.cancel(); c.trackAnim = null; }
      }
      if (d.drag) {
        const c = cur.current; let o = dx;
        if ((c.slide === 0 && dx > 0) || (c.slide === last && dx < 0)) o = dx / 3;
        el.style.transform = `translateX(${-c.slide * W + o}px)`;
      }
    };
    const up = (e) => {
      if (!d || e.pointerId !== d.id) return;
      const s = scaleRef.current || 1; const dx = (e.clientX - d.x) / s; const dt = Math.max(1, performance.now() - d.t);
      const c = cur.current;
      if (d.drag) {
        const vel = Math.abs(dx) / dt;
        if ((dx < -70 || (dx < -20 && vel > 0.45)) && c.slide < last) go(c.slide + 1);
        else if ((dx > 70 || (dx > 20 && vel > 0.45)) && c.slide > 0) go(c.slide - 1);
        else snapBack();
      } else if (dt < 500 && Math.abs(dx) < 8) {
        const r = v.getBoundingClientRect();
        if (e.clientX - r.left < r.width / 3) { if (c.slide > 0) go(c.slide - 1); } else if (c.slide < last) go(c.slide + 1);
      }
      d = null;
    };
    const cancel = () => { if (d?.drag) snapBack(); d = null; };
    v.addEventListener('pointerdown', down); v.addEventListener('pointermove', move); v.addEventListener('pointerup', up); v.addEventListener('pointercancel', cancel);
    return () => { v.removeEventListener('pointerdown', down); v.removeEventListener('pointermove', move); v.removeEventListener('pointerup', up); v.removeEventListener('pointercancel', cancel); };
  }, [go, last, reduced]);

  // arrow keys
  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.tagName === 'INPUT' || e.altKey || e.metaKey || e.ctrlKey) return;
      const c = cur.current;
      if (e.key === 'ArrowRight') { e.preventDefault(); if (c.slide < last) go(c.slide + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); if (c.slide > 0) go(c.slide - 1); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [go, last]);

  const final = slide === last;
  // Next hides on slide 7: focus that was on it moves to the first end key, and back to Next when leaving slide 7.
  const bottom = useRef(null);
  useEffect(() => {
    const el = bottom.current; const a = document.activeElement;
    if (!el || !a || !el.contains(a)) return;
    if (final && a.matches('[data-explainer-next]')) el.querySelector('[data-end-key]')?.focus({ preventScroll: true });
    if (!final && a.matches('[data-end-key]')) el.querySelector('[data-explainer-next]')?.focus({ preventScroll: true });
  }, [final]);
  const sliding = 'mx-bottom' + (final ? ' is-final' : '') + (keys.length === 1 ? ' is-one' : '') + (instant ? ' is-instant' : '');
  return (
    <>
      <div className="mx-top">
        <LogoMark height={17} title="mockmob" />
        <button type="button" className="mx-skip" data-hidden={final || undefined} aria-hidden={final || undefined} tabIndex={final ? -1 : 0}
          onClick={() => onLeave?.(skipTo(mode), 'skip')}>{EXPLAINER_COPY.skip}</button>
      </div>
      <div ref={vp} className="mx-vp" role="region" aria-roledescription="carousel" aria-label={EXPLAINER_COPY.label}>
        <div ref={track} className="mx-track" style={{ transform: `translateX(${-startSlide * W}px)` }}>
          {slides.map((s, i) => (
            <section key={s.id} ref={(n) => { sectionEls.current[i] = n; }} className="mx-slide" style={{ left: i * W }}
              aria-roledescription="slide" aria-label={`${i + 1} of ${slides.length}: ${s.title}`} aria-hidden={i !== slide || undefined}>
              <div ref={(n) => { stageEls.current[i] = n; }} className="mx-stage" aria-hidden="true" />
              <div className="mx-text" style={{ top: TEXT_TOP[i] }}>
                <h2 className="mx-t-title">{s.title}</h2>
                <p className="mx-t-body">{s.body}</p>
                {s.soon ? <p className="mx-soon"><b>{s.soon}</b> {s.soonLine}</p> : null}
                {s.id === 's3' ? (
                  <ul className="mx-sr">
                    {PLAY_CARDS.map((c) => <li key={c.id}>{`${c.label}: ${c.figure ? `${c.figure} ${c.line}` : c.chips ? `${c.chips.join(', ')} questions. ${c.line}` : c.line}. ${c.foot}.`}</li>)}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </div>
      <div ref={bottom} className={sliding}>
        <div className="mx-dots" aria-hidden="true">{slides.map((s, i) => <span key={s.id} className={`mx-dot${i === slide ? ' is-on' : ''}`} />)}</div>
        <button type="button" className="mx-key is-sec mx-next" data-explainer-next="" tabIndex={final ? -1 : 0} aria-hidden={final || undefined} onClick={() => go(cur.current.slide + 1)}>{EXPLAINER_COPY.next}</button>
        <div className="mx-ctas">
          {keys.map((k) => (
            <button key={k.id} type="button" className={`mx-key${k.primary ? '' : ' is-sec'}`} data-end-key={k.id} tabIndex={final ? 0 : -1} aria-hidden={!final || undefined}
              onClick={() => onLeave?.(k.id, 'key')}>{k.label}</button>
          ))}
        </div>
      </div>
      <p className="mx-sr" aria-live="polite">{liveLine(slides, slide)}</p>
    </>
  );
}

export default MobExplainer;
