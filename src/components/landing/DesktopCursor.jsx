'use client';

// The desktop pointer's layer (19 Nov 2026, owner LK333: on desktop "you can easily go way more all out than on mobile
// when adding even the cursor animations, animating cursors, scrolls, and clicks").
//
// A fine pointer that hovers (a mouse, a trackpad) gets, and nothing else does:
//   ring     a soft ring that trails the arrow, opens over anything that can be pressed and sends one ring out from a click
//   snap     over a key, or as the arrow comes up to one, the ring lets go and the KEY ITSELF takes it: its own edge lights
//            (an outline that closes onto the key's own shape, drawn by the key, so it is exact on every radius, moves with
//            the key and needs no measuring), and it holds until the arrow is clearly away
//   tag      over a thing whose action has a name (data-cursor="Turn"), the ring closes to a dot and the name rides beside
//            the arrow
//   scroll   while the page scrolls the ring stretches along the way it is going and settles when it stops
//   lean     a primary key (MAGNET) leans a few pixels toward the arrow and comes back when it leaves
//   tilt     a picture marked data-tilt turns a few degrees to face the arrow
//   torch    a wide, faint light on the paper under the arrow
// The arrow itself stays: all of this is an addition, never a replacement, so nothing about pointing gets harder. A touch
// screen, a pen, and a reader who asked for less motion get nothing at all.
//
// 20 Nov 2026 (owner LK352: the snap "should feel like it is just getting snapped onto the existing button rather than
// putting a bubble over it"; and LK353: the site must run on a cheap Chromebook, measured, not on a fast laptop):
//  - The snap is no longer a separate box floated over the key. The key carries `data-snap` and draws its own edge
//    (r19-home-b.css). A text link is not outlined at all (its own hover is its answer; the ring opens over it as before).
//  - Cost. What is under the arrow is worked out only when the arrow crosses onto a different element, not on every frame.
//    "Near a key" is one hit test a short reach AHEAD of the arrow, at most about sixteen times a second and only while it is
//    travelling over open page (it was four hit tests on every frame). Nothing here reads the scroll position or a box per
//    frame: a key is measured once as it is taken. On a weak machine (html[data-lite], set before first paint from the
//    machine's own figures) the light, the lean, the tilt and the reach-ahead are off; the ring and the snap stay.
//
// Cost at rest: nothing. One passive pointermove listener records where the arrow is and what is under it (from the event's
// own target); one animation frame loop eases everything there and stops when it has arrived. Only transform, translate,
// scale and opacity change (the compositor's work).
import { useEffect, useRef } from 'react';

const QUERY = '(hover: hover) and (pointer: fine)';
const PRESSABLE = 'a, button, [role="button"], summary, label, input, select, textarea, [data-press]';
const TAGGED = '[data-cursor]';
const TILTED = '[data-tilt]';
const MAGNET = '.mm-btn--primary, [data-magnet]';
// What the ring snaps onto: a real key. A text link is not one, and neither is a whole card or a row the width of the page
// (SNAP_MAX).
const SNAP = '.mm-btn, button, [role="button"], summary, [data-snap-key]';
export const SNAP_MAX = Object.freeze({ width: 460, height: 110 });
/** How far ahead of the arrow a key is looked for, and how far outside a held key the arrow may go before it is let go, px. */
export const SNAP_REACH = 14;
export const SNAP_HOLD = 18;
/** The reach-ahead hit test: at most one in this many ms, and only after the arrow has travelled this far, px. */
export const PROBE_EVERY_MS = 60;
export const PROBE_TRAVEL = 6;
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
    // A weak machine gets none of this: every frame a moving mouse asks of the page is one it cannot spare.
    if (document.documentElement.hasAttribute('data-lite')) return undefined;
    const lite = false;
    let x = 0; let y = 0; let tx = 0; let ty = 0;         // the ring, and where the arrow is
    let lx = 0; let ly = 0;                               // the torch (slower)
    let frame = 0; let shown = false; let wave = 0;
    let stretch = 0; let lastY = window.scrollY; let way = 1; let reaim = 0;
    let scrolls = 0;                                       // how many times the page has scrolled (so nothing reads scrollY per frame)
    let lean = null;                                       // { el, cx, cy, at, mx, my }
    let tilt = null;                                       // { el, rect, at, ax, ay }
    const leaving = new Set();                             // keys and pictures on their way back to rest
    let snap = null;                                       // { el, x, y, w, h }: the key that holds the ring
    let refused = null;                                    // the last thing found too big to be a key
    let pending = null; let asked = false;                 // what the last move event was over, read once a frame
    let under = null; let seen = null;                     // the element the arrow is on, and what was worked out for it
    let px = -99; let py = -99; let probedAt = 0; let near = null; // the last reach-ahead: where, when and what it found
    let ox = 0; let oy = 0;                                // where the arrow was a frame ago (its direction of travel)
    const allowed = () => fine.matches && !calm.matches && document.documentElement.getAttribute('data-motion') !== 'reduced';

    const measureLean = (hold) => {
      const box = hold.el.getBoundingClientRect();
      hold.cx = box.left + box.width / 2 - hold.mx; hold.cy = box.top + box.height / 2 - hold.my; hold.at = scrolls;
    };
    const measureTilt = (hold) => { hold.rect = hold.el.getBoundingClientRect(); hold.at = scrolls; };
    // A key's box, read once as it is taken, and whether it is a key at all: a line that wraps, a whole card and a row as
    // wide as the page are not.
    const measureSnap = (el) => {
      if (el.getClientRects().length !== 1) return null;
      const r = el.getBoundingClientRect();
      if (r.width < 20 || r.height < 16 || r.width > SNAP_MAX.width || r.height > SNAP_MAX.height) return null;
      return { el, x: r.left, y: r.top, w: r.width, h: r.height };
    };
    const snapOf = (el) => {
      const key = el ? el.closest(SNAP) : null;
      return key && !key.disabled && key.getAttribute('aria-disabled') !== 'true' && !key.closest('[data-nosnap]') ? key : null;
    };
    const dropSnap = () => { if (snap) { snap.el.removeAttribute('data-snap'); snap = null; } };
    // The key takes the ring in two states a frame apart ("in": its outline a little way out and clear; "on": closed onto its
    // edge), so the catch is a short movement onto the key and not a box that appears.
    const arrive = (key) => {
      key.setAttribute('data-snap', 'in');
      window.requestAnimationFrame(() => { if (snap && snap.el === key) key.setAttribute('data-snap', 'on'); });
    };
    // A key the arrow is coming up to: one hit test a short reach ahead of it, in the direction it is travelling.
    const probe = (now) => {
      const dx = tx - px; const dy = ty - py;
      if (now - probedAt < PROBE_EVERY_MS || dx * dx + dy * dy < PROBE_TRAVEL * PROBE_TRAVEL) return near;
      const vx = tx - ox; const vy = ty - oy; const speed = Math.hypot(vx, vy);
      px = tx; py = ty; probedAt = now; near = null;
      if (speed < 0.5) return null;
      const el = snapOf(document.elementFromPoint(tx + (vx / speed) * SNAP_REACH, ty + (vy / speed) * SNAP_REACH));
      near = el && el !== refused ? el : null;
      return near;
    };

    // Everything that depends only on WHICH element the arrow is on, worked out once per element.
    const classify = (el) => ({
      pressable: Boolean(el && el.closest(PRESSABLE)),
      key: snapOf(el),
      named: el ? el.closest(TAGGED) : null,
      dark: Boolean(el && el.closest(PICTURE)),
      magnet: el && !lite ? el.closest(MAGNET) : null,
      picture: el && !lite ? el.closest(TILTED) : null,
    });

    const release = () => {
      if (lean) { leaving.add({ kind: 'lean', el: lean.el, mx: lean.mx, my: lean.my }); lean = null; }
      if (tilt) { leaving.add({ kind: 'tilt', el: tilt.el, ax: tilt.ax, ay: tilt.ay }); tilt = null; }
    };
    const take = (kind, el) => {
      // A thing the arrow comes back to before it has reached rest carries on from where it is.
      for (const hold of leaving) if (hold.kind === kind && hold.el === el) { leaving.delete(hold); return hold; }
      return null;
    };

    // What is under the arrow decides the ring's state, the name beside it, the torch, the leaning key and the tilting picture.
    const aim = (el, now) => {
      if (el !== under || !seen) { under = el; seen = classify(el); }
      // The key that holds the ring: the one under the arrow, else the one it already holds while the arrow is still close,
      // else one it is coming up to. A thing too big to be a key is remembered, so it is measured once.
      let key = seen.key && seen.key !== refused ? seen.key : null;
      if (!key && snap && tx > snap.x - SNAP_HOLD && tx < snap.x + snap.w + SNAP_HOLD && ty > snap.y - SNAP_HOLD && ty < snap.y + snap.h + SNAP_HOLD) key = snap.el;
      if (!key && !seen.pressable && !lite) key = probe(now);
      if (!key) dropSnap();
      else if (!snap || snap.el !== key) {
        const fresh = measureSnap(key);
        dropSnap();
        if (!fresh) refused = key; else { snap = fresh; arrive(key); }
      }
      const magnet = lite ? null : snap && snap.el.matches(MAGNET) ? snap.el : seen.magnet;
      if (magnet !== (lean ? lean.el : null)) {
        if (lean) { leaving.add({ kind: 'lean', el: lean.el, mx: lean.mx, my: lean.my }); lean = null; }
        if (magnet && !magnet.disabled) { const was = take('lean', magnet); lean = { el: magnet, mx: was ? was.mx : 0, my: was ? was.my : 0, cx: 0, cy: 0, at: 0 }; measureLean(lean); }
      }
      const over = snap ? 'snap' : seen.pressable ? 'key' : 'page';
      if (node.getAttribute('data-on') !== over) node.setAttribute('data-on', over);
      const word = !snap && seen.named ? seen.named.getAttribute('data-cursor') : '';
      if (word) { if (tag.textContent !== word) tag.textContent = word; if (!node.hasAttribute('data-tag')) node.setAttribute('data-tag', ''); } else if (node.hasAttribute('data-tag')) node.removeAttribute('data-tag');
      if (seen.dark !== torch.hasAttribute('data-off')) torch.toggleAttribute('data-off', seen.dark);
      if (seen.picture !== (tilt ? tilt.el : null)) {
        if (tilt) { leaving.add({ kind: 'tilt', el: tilt.el, ax: tilt.ax, ay: tilt.ay }); tilt = null; }
        if (seen.picture) { const was = take('tilt', seen.picture); tilt = { el: seen.picture, ax: was ? was.ax : 0, ay: was ? was.ay : 0, rect: null, at: 0 }; measureTilt(tilt); }
      }
    };

    const step = (now) => {
      frame = 0;
      let moving = false;
      if (asked) { asked = false; aim(pending, now); }
      ox = tx; oy = ty;
      x += (tx - x) * EASE; y += (ty - y) * EASE;
      if (Math.abs(tx - x) < 0.1 && Math.abs(ty - y) < 0.1) { x = tx; y = ty; } else moving = true;
      node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      if (!lite) {
        lx += (tx - lx) * 0.1; ly += (ty - ly) * 0.1;
        if (Math.abs(tx - lx) < 0.3 && Math.abs(ty - ly) < 0.3) { lx = tx; ly = ty; } else moving = true;
        torch.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;
      }

      // The ring along the scroll: it stretches the way the page is going and settles.
      if (stretch > 0.004) {
        stretch *= 0.86; moving = true;
        ring.style.scale = `${(1 - stretch * 0.22).toFixed(3)} ${(1 + stretch * 0.55).toFixed(3)}`;
        ring.style.translate = `0 ${(way * stretch * 5).toFixed(1)}px`;
      } else if (stretch !== 0) { stretch = 0; ring.style.scale = ''; ring.style.translate = ''; }

      // A key leaning toward the arrow.
      if (lean) {
        if (lean.at !== scrolls) measureLean(lean);
        const wx = clamp((tx - lean.cx) * LEAN_SHARE, -LEAN_MAX, LEAN_MAX); const wy = clamp((ty - lean.cy) * LEAN_SHARE, -LEAN_MAX, LEAN_MAX);
        lean.mx += (wx - lean.mx) * 0.2; lean.my += (wy - lean.my) * 0.2;
        if (Math.abs(wx - lean.mx) > 0.05 || Math.abs(wy - lean.my) > 0.05) moving = true;
        lean.el.style.translate = `${lean.mx.toFixed(2)}px ${lean.my.toFixed(2)}px`;
      }
      // A picture turning to face the arrow.
      if (tilt) {
        if (tilt.at !== scrolls) measureTilt(tilt);
        const r = tilt.rect;
        const sx = clamp((tx - r.left) / Math.max(1, r.width), 0, 1) - 0.5; const sy = clamp((ty - r.top) / Math.max(1, r.height), 0, 1) - 0.5;
        const wantY = sx * 2 * TILT_MAX; const wantX = -sy * 2 * TILT_MAX;
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

    const hide = () => {
      if (shown) { shown = false; node.removeAttribute('data-on'); node.removeAttribute('data-tag'); torch.removeAttribute('data-on'); torch.removeAttribute('data-off'); }
      asked = false; under = null; seen = null; near = null; dropSnap(); release(); run();
    };
    const onMove = (event) => {
      if (event.pointerType !== 'mouse' || !allowed()) { hide(); return; }
      tx = event.clientX; ty = event.clientY;
      if (!shown) { shown = true; x = tx; y = ty; lx = tx; ly = ty; ox = tx; oy = ty; if (!lite) torch.setAttribute('data-on', ''); }
      pending = event.target instanceof Element ? event.target : null; asked = true;
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
      scrolls += 1;
      way = moved > 0 ? 1 : -1;
      stretch = Math.max(stretch, clamp(Math.abs(moved) / 90, 0, 1));
      // The page is moving under the arrow: the key lets the ring go at once, and what is there when it stops takes it.
      dropSnap(); px = -99; near = null; under = null; seen = null;
      // The page has moved under a resting arrow: once it has been still for a moment, look again at what is under it (one
      // hit test after the scroll, never one per scroll event), so the ring never keeps the state of a thing that has gone.
      window.clearTimeout(reaim);
      reaim = window.setTimeout(() => { if (shown) { asked = false; aim(document.elementFromPoint(tx, ty), performance.now()); run(); } }, 140);
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
      dropSnap();
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
