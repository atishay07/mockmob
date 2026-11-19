'use client';

// The desktop pointer's layer (19 Nov 2026, owner LK333: on desktop "you can easily go way more all out than on mobile
// when adding even the cursor animations, animating cursors, scrolls, and clicks").
//
// A fine pointer that hovers (a mouse, a trackpad) gets, and nothing else does:
//   ring     a soft ring that trails the arrow, opens over anything that can be pressed and sends one ring out from a click
//   tag      over a thing whose action has a name (data-cursor="Turn"), the ring closes to a dot and the name rides beside
//            the arrow
//   scroll   while the page scrolls the ring stretches along the way it is going and settles when it stops
//   lean     a primary key (MAGNET) leans a few pixels toward the arrow and comes back when it leaves
//   tilt     a picture marked data-tilt turns a few degrees to face the arrow
//   torch    a wide, faint light on the paper under the arrow
// The arrow itself stays: all of this is an addition, never a replacement, so nothing about pointing gets harder. A touch
// screen, a pen, and a reader who asked for less motion get nothing at all.
//
// Cost: nothing while the pointer rests. One passive pointermove listener records where the arrow is and what is under it
// (from the event's own target); one animation frame loop eases everything there and stops when it has arrived. Only
// transform, translate, scale and opacity change (the compositor's work). A leaning key or a tilting picture is measured
// once as the arrow enters it, and again only if the page has scrolled since.
import { useEffect, useRef } from 'react';

const QUERY = '(hover: hover) and (pointer: fine)';
const PRESSABLE = 'a, button, [role="button"], summary, label, input, select, textarea, [data-press]';
const TAGGED = '[data-cursor]';
const TILTED = '[data-tilt]';
const MAGNET = '.mm-btn--primary, [data-magnet]';
// The torch is a light on paper: over a film, a photograph or a screen it goes out, so it never tints a picture.
const PICTURE = '[data-tilt], video, picture, img, canvas';
const EASE = 0.22;
/** The most a picture turns to face the arrow, degrees. */
export const TILT_MAX = 4.5;
/** How far a key leans, as a share of the arrow's distance from its middle, and the most it moves, px. */
export const LEAN_SHARE = 0.2;
export const LEAN_MAX = 7;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export default function DesktopCursor() {
  const ref = useRef(null);
  const tagRef = useRef(null);
  const ringRef = useRef(null);
  const torchRef = useRef(null);

  useEffect(() => {
    const node = ref.current; const tag = tagRef.current; const ring = ringRef.current; const torch = torchRef.current;
    if (!node || !tag || !ring || !torch || typeof window === 'undefined') return undefined;
    let fine = null; let calm = null;
    try { fine = window.matchMedia(QUERY); calm = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch { return undefined; }
    let x = 0; let y = 0; let tx = 0; let ty = 0;         // the ring, and where the arrow is
    let lx = 0; let ly = 0;                               // the torch (slower)
    let frame = 0; let shown = false; let wave = 0;
    let stretch = 0; let lastY = window.scrollY; let way = 1; let reaim = 0;
    let lean = null;                                       // { el, cx, cy, sy, mx, my }
    let tilt = null;                                       // { el, rect, sy, ax, ay }
    const leaving = new Set();                             // keys and pictures on their way back to rest
    const allowed = () => fine.matches && !calm.matches && document.documentElement.getAttribute('data-motion') !== 'reduced';

    const measureLean = (hold) => {
      const box = hold.el.getBoundingClientRect();
      hold.cx = box.left + box.width / 2 - hold.mx; hold.cy = box.top + box.height / 2 - hold.my; hold.sy = window.scrollY;
    };
    const measureTilt = (hold) => { hold.rect = hold.el.getBoundingClientRect(); hold.sy = window.scrollY; };

    const step = () => {
      frame = 0;
      let moving = false;
      x += (tx - x) * EASE; y += (ty - y) * EASE;
      lx += (tx - lx) * 0.1; ly += (ty - ly) * 0.1;
      if (Math.abs(tx - x) < 0.1 && Math.abs(ty - y) < 0.1) { x = tx; y = ty; } else moving = true;
      if (Math.abs(tx - lx) < 0.3 && Math.abs(ty - ly) < 0.3) { lx = tx; ly = ty; } else moving = true;
      node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      torch.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;

      // The ring along the scroll: it stretches the way the page is going and settles.
      if (stretch > 0.004) {
        stretch *= 0.86; moving = true;
        ring.style.scale = `${(1 - stretch * 0.22).toFixed(3)} ${(1 + stretch * 0.55).toFixed(3)}`;
        ring.style.translate = `0 ${(way * stretch * 5).toFixed(1)}px`;
      } else if (stretch !== 0) { stretch = 0; ring.style.scale = ''; ring.style.translate = ''; }

      // A key leaning toward the arrow.
      if (lean) {
        if (lean.sy !== window.scrollY) measureLean(lean);
        const wx = clamp((tx - lean.cx) * LEAN_SHARE, -LEAN_MAX, LEAN_MAX); const wy = clamp((ty - lean.cy) * LEAN_SHARE, -LEAN_MAX, LEAN_MAX);
        lean.mx += (wx - lean.mx) * 0.2; lean.my += (wy - lean.my) * 0.2;
        if (Math.abs(wx - lean.mx) > 0.05 || Math.abs(wy - lean.my) > 0.05) moving = true;
        lean.el.style.translate = `${lean.mx.toFixed(2)}px ${lean.my.toFixed(2)}px`;
      }
      // A picture turning to face the arrow.
      if (tilt) {
        if (tilt.sy !== window.scrollY) measureTilt(tilt);
        const r = tilt.rect;
        const px = clamp((tx - r.left) / Math.max(1, r.width), 0, 1) - 0.5; const py = clamp((ty - r.top) / Math.max(1, r.height), 0, 1) - 0.5;
        const wantY = px * 2 * TILT_MAX; const wantX = -py * 2 * TILT_MAX;
        tilt.ax += (wantX - tilt.ax) * 0.14; tilt.ay += (wantY - tilt.ay) * 0.14;
        if (Math.abs(wantX - tilt.ax) > 0.01 || Math.abs(wantY - tilt.ay) > 0.01) moving = true;
        tilt.el.style.setProperty('--tilt-x', `${tilt.ax.toFixed(2)}deg`); tilt.el.style.setProperty('--tilt-y', `${tilt.ay.toFixed(2)}deg`);
      }
      // Whatever the arrow has left comes back to rest and is then let go (no style of ours stays on it).
      for (const hold of leaving) {
        if (hold.kind === 'lean') {
          hold.mx *= 0.8; hold.my *= 0.8;
          if (Math.abs(hold.mx) < 0.05 && Math.abs(hold.my) < 0.05) { hold.el.style.translate = ''; leaving.delete(hold); } else { hold.el.style.translate = `${hold.mx.toFixed(2)}px ${hold.my.toFixed(2)}px`; moving = true; }
        } else {
          hold.ax *= 0.84; hold.ay *= 0.84;
          if (Math.abs(hold.ax) < 0.02 && Math.abs(hold.ay) < 0.02) { hold.el.style.removeProperty('--tilt-x'); hold.el.style.removeProperty('--tilt-y'); leaving.delete(hold); } else { hold.el.style.setProperty('--tilt-x', `${hold.ax.toFixed(2)}deg`); hold.el.style.setProperty('--tilt-y', `${hold.ay.toFixed(2)}deg`); moving = true; }
        }
      }
      if (moving) frame = window.requestAnimationFrame(step);
    };
    const run = () => { if (!frame) frame = window.requestAnimationFrame(step); };

    const release = () => {
      if (lean) { leaving.add({ kind: 'lean', el: lean.el, mx: lean.mx, my: lean.my }); lean = null; }
      if (tilt) { leaving.add({ kind: 'tilt', el: tilt.el, ax: tilt.ax, ay: tilt.ay }); tilt = null; }
    };
    const take = (kind, el) => {
      // A thing the arrow comes back to before it has reached rest carries on from where it is.
      for (const hold of leaving) if (hold.kind === kind && hold.el === el) { leaving.delete(hold); return hold; }
      return null;
    };
    const hide = () => {
      if (shown) { shown = false; node.removeAttribute('data-on'); node.removeAttribute('data-tag'); torch.removeAttribute('data-on'); torch.removeAttribute('data-off'); }
      release(); run();
    };

    // What is under the arrow decides the ring's state, the name beside it, the torch, the leaning key and the tilting picture.
    const aim = (under) => {
      const over = under && under.closest(PRESSABLE) ? 'key' : 'page';
      if (node.getAttribute('data-on') !== over) node.setAttribute('data-on', over);
      const named = under ? under.closest(TAGGED) : null;
      const word = named ? named.getAttribute('data-cursor') : '';
      if (word) { if (tag.textContent !== word) tag.textContent = word; if (!node.hasAttribute('data-tag')) node.setAttribute('data-tag', ''); } else if (node.hasAttribute('data-tag')) node.removeAttribute('data-tag');

      const dark = Boolean(under && under.closest(PICTURE));
      if (dark !== torch.hasAttribute('data-off')) torch.toggleAttribute('data-off', dark);

      const key = under ? under.closest(MAGNET) : null;
      if (key !== (lean ? lean.el : null)) {
        if (lean) { leaving.add({ kind: 'lean', el: lean.el, mx: lean.mx, my: lean.my }); lean = null; }
        if (key && !key.disabled) { const was = take('lean', key); lean = { el: key, mx: was ? was.mx : 0, my: was ? was.my : 0, cx: 0, cy: 0, sy: 0 }; measureLean(lean); }
      }
      const picture = under ? under.closest(TILTED) : null;
      if (picture !== (tilt ? tilt.el : null)) {
        if (tilt) { leaving.add({ kind: 'tilt', el: tilt.el, ax: tilt.ax, ay: tilt.ay }); tilt = null; }
        if (picture) { const was = take('tilt', picture); tilt = { el: picture, ax: was ? was.ax : 0, ay: was ? was.ay : 0, rect: null, sy: 0 }; measureTilt(tilt); }
      }
    };
    const onMove = (event) => {
      if (event.pointerType !== 'mouse' || !allowed()) { hide(); return; }
      tx = event.clientX; ty = event.clientY;
      if (!shown) { shown = true; x = tx; y = ty; lx = tx; ly = ty; torch.setAttribute('data-on', ''); }
      aim(event.target instanceof Element ? event.target : null);
      run();
    };
    const onDown = (event) => {
      if (event.pointerType !== 'mouse' || !shown) return;
      node.removeAttribute('data-wave');
      window.clearTimeout(wave);
      // The next frame, so the attribute's removal and return are two style states and the ring runs again.
      window.requestAnimationFrame(() => { node.setAttribute('data-wave', ''); wave = window.setTimeout(() => node.removeAttribute('data-wave'), 520); });
    };
    const onScroll = () => {
      const now = window.scrollY; const moved = now - lastY; lastY = now;
      if (!shown || !moved) return;
      way = moved > 0 ? 1 : -1;
      stretch = Math.max(stretch, clamp(Math.abs(moved) / 90, 0, 1));
      // The page has moved under a resting arrow: once it has been still for a moment, look again at what is under it (one
      // hit test after the scroll, never one per scroll event), so the ring never keeps the state of a thing that has gone.
      window.clearTimeout(reaim);
      reaim = window.setTimeout(() => { if (shown) { aim(document.elementFromPoint(tx, ty)); run(); } }, 140);
      run();
    };
    const onLeave = () => hide();
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('scroll', onScroll);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(wave);
      window.clearTimeout(reaim);
      if (lean) lean.el.style.translate = '';
      if (tilt) { tilt.el.style.removeProperty('--tilt-x'); tilt.el.style.removeProperty('--tilt-y'); }
      for (const hold of leaving) { if (hold.kind === 'lean') hold.el.style.translate = ''; else { hold.el.style.removeProperty('--tilt-x'); hold.el.style.removeProperty('--tilt-y'); } }
    };
  }, []);

  return (
    <>
      <div ref={torchRef} className="lp-torch" aria-hidden="true" />
      <div ref={ref} className="lp-cursor" aria-hidden="true">
        <span ref={ringRef} className="lp-cursor__ring" />
        <span className="lp-cursor__wave" />
        <span ref={tagRef} className="lp-cursor__tag" />
      </div>
    </>
  );
}
