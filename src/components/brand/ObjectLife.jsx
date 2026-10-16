'use client';

// Life on a standing subject object (the app's MmObjectLife, MmObjectReact and EmblemSparkle on the web).
// SubjectObject renders the picture on the server; this island (an empty, hidden span inside the object)
// attaches the life to it after hydration, so a page that shows objects stays server rendered.
//
//   lean    toward the mouse or a finger resting on it (the touched side presses away), and with the scroll
//   light   one band of the lamp's light across the object's own pixels while it leans, never on its shadow
//   tap     a 420 ms give, overshoot and twist about the foot, one haptic tick, and a 560 ms sparkle
//   flight  with `flight`, a tap or click on the way to another page marks the flight, and the object that
//           lands there answers with the same tap spring and tick once the view transition has carried it
//
// The float itself is plain CSS (subject-object.css). At rest nothing runs: no frame loop, no transform.
// Reduced motion (the device or the student's switch): no lean, light, spring or sparkle; the tick stays,
// as in the app. Quiet or Off celebrations mute the sparkle; the spring stays.

import { useEffect, useRef } from 'react';
import { SUBJECT_RENDERS } from '@/../data/subject_art.mjs';
import { tick } from '@/lib/haptics';
import {
  LIFE,
  SPRINGS,
  aimAt,
  bloomAt,
  glintsAt,
  leanToward,
  objectStage,
  objectTilt,
  parallaxOffset,
  rgba,
  sheenAt,
  sparkleColours,
  stepSpring,
  tapKeyframes,
  tiltTransform,
} from './ObjectLifeModel.mjs';

// ---------- Page-wide state ----------

const root = () => document.documentElement;

function reducedMotion() {
  if (root().dataset.motion === 'reduced') return true;
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

const celebrationsMuted = () => ['quiet', 'off'].includes(root().dataset.celebrations);
const isDay = () => root().dataset.theme === 'light';

// The flight in progress: which object left, and when (a click on the way to another page).
let pendingFlight = null;
let flightTimer = 0;
function markFlight(direction) {
  root().dataset.objFlight = direction;
  window.clearTimeout(flightTimer);
  flightTimer = window.setTimeout(() => { delete root().dataset.objFlight; }, LIFE.flightMs + 480);
}

const loop = {
  lives: new Set(),
  raf: 0,
  last: 0,
  lean: { x: 0, v: 0 },
  scrollDelta: 0,
  scrolled: false,
  scrollers: new WeakMap(),
  listening: false,
  observer: null,
};

function kick() {
  if (!loop.raf) loop.raf = window.requestAnimationFrame(frame);
}

function frame(now) {
  loop.raf = 0;
  const dt = loop.last ? Math.min(64, now - loop.last) : 16;
  loop.last = now;
  const reduced = reducedMotion();
  let moving = false;
  if (reduced) {
    loop.lean.x = 0;
    loop.lean.v = 0;
    loop.scrolled = false;
    loop.scrollDelta = 0;
  } else if (loop.scrolled) {
    // As the app's MmScrollLean: half way to this frame's target, then spring home from there.
    loop.lean.x = leanToward(loop.lean.x, loop.scrollDelta);
    loop.lean.v = 0;
    loop.scrolled = false;
    loop.scrollDelta = 0;
    moving = true;
  } else if (!stepSpring(loop.lean, SPRINGS.smooth, 0, dt)) {
    moving = true;
  }
  for (const life of loop.lives) {
    if (life.update(dt, loop.lean.x, reduced)) moving = true;
  }
  if (moving) kick();
  else loop.last = 0;
}

function onScroll(event) {
  const target = event.target;
  const el = !target || target === document || target === document.documentElement || target === document.body ? null : target;
  const key = el || document;
  const pos = el ? el.scrollTop : window.scrollY;
  const last = loop.scrollers.has(key) ? loop.scrollers.get(key) : pos;
  loop.scrollers.set(key, pos);
  if (pos === last) return;
  loop.scrollDelta += pos - last;
  loop.scrolled = true;
  kick();
}

function onPopState() {
  markFlight('back');
}

// In the arena the float runs twice and rests (subject-object.css). Coming back into view, the pointer arriving
// or focus breathes it once more: a fresh animation name restarts it from the rest pose. Only once it is resting,
// so it never jumps out of a float that is still playing.
function breatheAgain(el) {
  if (!el?.classList.contains('subj-obj--alive') || reducedMotion()) return;
  const float = el.querySelector('.subj-obj__float');
  if (float?.getAnimations?.().some((a) => a.playState === 'running')) return;
  el.dataset.float = el.dataset.float === 'a' ? 'b' : 'a';
}

function register(life) {
  loop.lives.add(life);
  if (!loop.listening) {
    loop.listening = true;
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('popstate', onPopState);
  }
  if (!loop.observer && typeof IntersectionObserver === 'function') {
    loop.observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const found = entry.target.__mmLife;
        if (!found) continue;
        const back = entry.isIntersecting && entry.target.hasAttribute('data-offscreen');
        found.visible = entry.isIntersecting;
        entry.target.toggleAttribute('data-offscreen', !entry.isIntersecting);
        if (!entry.isIntersecting) found.rest();
        else if (back) breatheAgain(entry.target);
      }
    }, { rootMargin: '64px' });
  }
  if (loop.observer) loop.observer.observe(life.root);
  else life.visible = true;
}

function unregister(life) {
  loop.lives.delete(life);
  loop.observer?.unobserve(life.root);
  if (!loop.lives.size && loop.listening) {
    loop.listening = false;
    document.removeEventListener('scroll', onScroll, { capture: true });
    window.removeEventListener('popstate', onPopState);
  }
}

// ---------- The sparkle (EmblemSparkle): a bloom behind, four glints in front ----------

function sparkle(life) {
  const { el, art } = life;
  const rect = el.getBoundingClientRect();
  const side = Math.min(rect.width, rect.height);
  if (!(side > 0)) return;
  const { glow, glint } = sparkleColours(art.light, isDay());
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const span = side * 1.5;
  const make = (cls) => {
    const c = document.createElement('canvas');
    c.className = `subj-obj__spark ${cls}`;
    c.setAttribute('aria-hidden', 'true');
    c.width = Math.round(span * dpr);
    c.height = Math.round(span * dpr);
    return c;
  };
  life.sparks?.forEach((c) => c.remove());
  const bloom = make('subj-obj__spark--bloom');
  const glints = make('subj-obj__spark--glints');
  el.insertBefore(bloom, el.querySelector('.subj-obj__shadow'));
  el.appendChild(glints);
  life.sparks = [bloom, glints];
  const bctx = bloom.getContext('2d');
  const gctx = glints.getContext('2d');
  if (!bctx || !gctx) return;
  const centre = span / 2;
  const half = side / 2;
  const start = performance.now();
  const draw = (now) => {
    const v = (now - start) / LIFE.sparkleMs;
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bctx.clearRect(0, 0, span, span);
    gctx.clearRect(0, 0, span, span);
    if (v >= 1 || !el.isConnected) {
      bloom.remove();
      glints.remove();
      if (life.sparks?.[0] === bloom) life.sparks = null;
      return;
    }
    const b = bloomAt(v);
    if (b.alpha > 0) {
      const r = side * b.radius;
      const g = bctx.createRadialGradient(centre, centre, 0, centre, centre, r);
      g.addColorStop(0, rgba(glow, b.alpha));
      g.addColorStop(1, rgba(glow, 0));
      bctx.fillStyle = g;
      bctx.beginPath();
      bctx.arc(centre, centre, r, 0, Math.PI * 2);
      bctx.fill();
    }
    for (const s of glintsAt(v)) {
      const arm = s.arm * half;
      if (arm <= 0.2) continue;
      const x = centre + s.x * half;
      const y = centre + s.y * half;
      const w = arm * 0.28;
      gctx.fillStyle = rgba(glint, s.alpha);
      gctx.beginPath();
      gctx.moveTo(x, y - arm);
      gctx.lineTo(x + w, y - w);
      gctx.lineTo(x + arm, y);
      gctx.lineTo(x + w, y + w);
      gctx.lineTo(x, y + arm);
      gctx.lineTo(x - w, y + w);
      gctx.lineTo(x - arm, y);
      gctx.lineTo(x - w, y - w);
      gctx.closePath();
      gctx.fill();
    }
    window.requestAnimationFrame(draw);
  };
  window.requestAnimationFrame(draw);
}

// ---------- One object's life ----------

function attachLife(el, { art, framed, flight, amplitude, parallax }) {
  const stage = objectStage(art, { framed });
  const tiltEl = el.querySelector('.subj-obj__tilt');
  const sheenEl = el.querySelector('.subj-obj__sheen');
  const reactEl = el.querySelector('.subj-obj__react');
  const imgEl = el.querySelector('.subj-obj__img');
  const alive = Boolean(tiltEl && reactEl && stage);
  // The light band is masked by the very file the picture loaded (cached, so no second download). Until it
  // is, the band stays off.
  let masked = false;
  const applyMask = () => {
    const src = imgEl?.currentSrc || imgEl?.src;
    if (!src || !sheenEl) return;
    const url = `url("${src}")`;
    sheenEl.style.webkitMaskImage = url;
    sheenEl.style.maskImage = url;
    masked = true;
  };
  if (imgEl?.complete && imgEl.naturalWidth) applyMask();
  imgEl?.addEventListener('load', applyMask);
  const life = {
    el,
    root: el,
    art,
    visible: false,
    home: true,
    target: { x: 0, y: 0 },
    fx: { x: 0, v: 0 },
    fy: { x: 0, v: 0 },
    lastTransform: '',
    lastSheen: '',
    sparks: null,
    reactAnim: null,
    update(dt, lean, reduced) {
      if (!alive) return false;
      if (reduced || !life.visible) {
        life.rest();
        return false;
      }
      const goal = life.home ? { x: 0, y: 0 } : life.target;
      const spring = life.home ? SPRINGS.smooth : SPRINGS.snappy;
      const restX = stepSpring(life.fx, spring, goal.x, dt);
      const restY = stepSpring(life.fy, spring, goal.y, dt);
      const tilt = objectTilt({ x: life.fx.x, y: life.fy.x }, lean);
      let transform = tiltTransform(tilt);
      if (parallax > 0) {
        const r = el.getBoundingClientRect();
        const dy = parallaxOffset(parallax, r.height, r.top + r.height / 2, window.innerHeight);
        transform = `translate3d(0, ${Math.round(dy * 10) / 10}px, 0) ${transform}`.trim();
      }
      if (transform !== life.lastTransform) {
        tiltEl.style.transform = transform;
        life.lastTransform = transform;
      }
      if (sheenEl && masked) {
        const s = sheenAt(tilt);
        const key = s.strength > 0 ? `${s.strength.toFixed(3)}|${s.along.toFixed(3)}` : '';
        if (key !== life.lastSheen) {
          life.lastSheen = key;
          if (key) {
            sheenEl.style.setProperty('--sheen', s.strength.toFixed(3));
            sheenEl.style.setProperty('--along', s.along.toFixed(3));
          } else {
            sheenEl.style.removeProperty('--sheen');
          }
        }
      }
      return !(restX && restY);
    },
    rest() {
      life.fx.x = life.fx.v = life.fy.x = life.fy.v = 0;
      life.home = true;
      if (life.lastTransform && parallax <= 0) {
        tiltEl.style.transform = '';
        life.lastTransform = '';
      }
      if (sheenEl && life.lastSheen) {
        sheenEl.style.removeProperty('--sheen');
        life.lastSheen = '';
      }
    },
  };
  el.__mmLife = life;

  // The object's rectangle on screen (from the box, not the picture, so a lean in progress cannot move it).
  const objectRect = () => {
    const r = el.getBoundingClientRect();
    const b = stage.box;
    return { left: r.left + (r.width * b.x) / 100, top: r.top + (r.height * b.y) / 100, width: (r.width * b.width) / 100, height: (r.height * b.height) / 100 };
  };

  const react = (a = amplitude) => {
    tick();
    if (!alive || reducedMotion() || typeof reactEl.animate !== 'function') return;
    life.reactAnim?.cancel();
    life.reactAnim = reactEl.animate(tapKeyframes(a), { duration: LIFE.reactMs, easing: 'linear' });
  };

  const tap = () => {
    react();
    if (alive && !reducedMotion() && !celebrationsMuted()) sparkle(life);
    if (flight) claimFlight();
  };

  const claimFlight = () => {
    pendingFlight = { name: art.name, at: performance.now() };
    markFlight('fwd');
  };

  let down = null;
  const aimFrom = (e) => {
    life.target = aimAt(e.clientX, e.clientY, objectRect());
    life.home = false;
    kick();
  };
  const onEnter = (e) => {
    if (e.pointerType !== 'mouse' || reducedMotion()) return;
    breatheAgain(el);
    aimFrom(e);
  };
  const onFocus = () => breatheAgain(el);
  const onMove = (e) => {
    if (reducedMotion()) return;
    if (down && e.pointerId === down.id && Math.hypot(e.clientX - down.x, e.clientY - down.y) > LIFE.tapSlopPx) down.travelled = true;
    if (e.pointerType === 'mouse' || down) aimFrom(e);
  };
  const onLeave = (e) => {
    if (e.pointerType !== 'mouse') return;
    life.home = true;
    kick();
  };
  const onDown = (e) => {
    if (e.button > 0) return;
    down = { id: e.pointerId, x: e.clientX, y: e.clientY, at: performance.now(), travelled: false };
    if (!reducedMotion()) aimFrom(e);
  };
  const onUp = (e) => {
    const was = down;
    down = null;
    if (e.pointerType !== 'mouse') {
      life.home = true;
      kick();
    }
    if (was && was.id === e.pointerId && !was.travelled && performance.now() - was.at <= LIFE.tapTimeMs) tap();
  };
  const onCancel = () => {
    down = null;
    life.home = true;
    kick();
  };

  // Listeners only: nothing here calls preventDefault, so the link or button around the object keeps its click.
  el.addEventListener('pointerenter', onEnter);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', onLeave);
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onCancel);
  const focusHost = el.closest('a, button') || el;
  focusHost.addEventListener('focusin', onFocus);
  // A keyboard press on the link around the object also starts the flight.
  const host = flight ? el.closest('a, button') : null;
  const onHostClick = (e) => { if (e.detail === 0) claimFlight(); };
  host?.addEventListener('click', onHostClick);

  if (alive || parallax > 0) register(life);

  // The object that lands from a flight answers it: the tap spring at 0.4 and one tick, once it has landed.
  let landing = 0;
  if (flight && pendingFlight && pendingFlight.name === art.name && performance.now() - pendingFlight.at < 2500) {
    pendingFlight = null;
    landing = window.setTimeout(() => { if (el.isConnected) react(LIFE.tapAmplitude); }, LIFE.flightMs);
  }
  if (parallax > 0) kick();

  return () => {
    el.removeEventListener('pointerenter', onEnter);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerleave', onLeave);
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onCancel);
    focusHost.removeEventListener('focusin', onFocus);
    host?.removeEventListener('click', onHostClick);
    imgEl?.removeEventListener('load', applyMask);
    // A landing still due plays on the same element when React re-runs the effect in development.
    if (landing && !el.isConnected) window.clearTimeout(landing);
    unregister(life);
    life.reactAnim?.cancel();
    life.sparks?.forEach((c) => c.remove());
    if (tiltEl) tiltEl.style.transform = '';
    if (el.__mmLife === life) delete el.__mmLife;
  };
}

/**
 * The life island. Rendered by SubjectObject inside the object's box; it draws nothing itself.
 * `name` is the render (data/subject_art.mjs), `amplitude` the tap's (0.4 objects, 1 the Today hero),
 * `parallax` the hero's layer factor (0.05 for the object), `flight` the shared-element pairing.
 */
export function ObjectLife({ name, framed = true, flight = false, amplitude = LIFE.tapAmplitude, parallax = 0 }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current?.parentElement;
    const art = SUBJECT_RENDERS[name];
    if (!el || !art) return undefined;
    return attachLife(el, { art, framed, flight, amplitude, parallax });
  }, [name, framed, flight, amplitude, parallax]);
  return <span ref={ref} className="subj-obj__life" hidden />;
}

export default ObjectLife;
