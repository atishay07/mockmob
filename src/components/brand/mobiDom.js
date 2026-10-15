// Writing a frame onto the SVG: the numbers from mobiPaint.js become attributes on the elements
// MobiFigure.jsx and MobiMarks.jsx draw. The same code runs on real elements in the browser and on plain
// attribute bags on the server (`virtualPaint`), so Mobi is drawn before any script runs and the first
// client paint matches the server's. Pure: no React, no browser. Tested in data/tests/mobi_rig.test.mjs.

import { frameModel } from './mobiPaint.js';

/** Sets an attribute only when it changed (a held pose then costs nothing per frame). */
export function setA(el, name, value) {
  if (!el) return;
  const cache = el.__mb || (el.__mb = {});
  if (cache[name] === value) return;
  cache[name] = value;
  if (value === null) el.removeAttribute(name);
  else el.setAttribute(name, value);
}

/** Shows or hides an element. */
export const show = (el, on) => setA(el, 'display', on ? null : 'none');

/** Paints the effects of one frame (`m` is a mobiPaint frameModel). `els` maps data-m names to elements. */
export function paintMarks(els, m) {
  m.land.forEach((ring, i) => {
    const g = els[`ring${i}`];
    show(g, Boolean(ring));
    if (!ring) return;
    for (const [key, w, a] of [['d', ring.wDay, ring.aDay], ['n', ring.w, ring.a]]) {
      const e = els[`ring${i}${key}`];
      setA(e, 'cx', ring.cx); setA(e, 'cy', ring.cy); setA(e, 'rx', ring.rx); setA(e, 'ry', ring.ry);
      setA(e, 'stroke-width', w); setA(e, 'stroke-opacity', a);
    }
  });
  m.burst.forEach((piece, i) => {
    show(els[`piece${i}`], Boolean(piece));
    if (!piece) return;
    const bubble = piece.kind === 'bubble';
    show(els[`piece${i}b`], bubble);
    show(els[`piece${i}r`], !bubble);
    if (bubble) {
      for (const k of ['f', 'e']) { const e = els[`piece${i}${k}`]; setA(e, 'cx', piece.x); setA(e, 'cy', piece.y); setA(e, 'r', piece.r); }
      const h = els[`piece${i}h`];
      setA(h, 'cx', piece.hx); setA(h, 'cy', piece.hy); setA(h, 'r', piece.hr);
    } else {
      for (const [k, w, a] of [['rd', piece.wDay, piece.aDay], ['rn', piece.w, piece.a]]) {
        const e = els[`piece${i}${k}`];
        setA(e, 'cx', piece.x); setA(e, 'cy', piece.y); setA(e, 'r', piece.r); setA(e, 'stroke-width', w); setA(e, 'stroke-opacity', a);
      }
    }
  });
  m.sparkle.forEach((s, i) => {
    show(els[`spark${i}`], Boolean(s));
    if (!s) return;
    setA(els[`spark${i}`], 'transform', s.transform);
    setA(els[`spark${i}p`], 'd', s.d);
  });
  const b = m.bubble;
  show(els.bubble, Boolean(b));
  if (b) {
    setA(els.bubble, 'transform', b.transform);
    setA(els.bubbleg, 'opacity', b.a);
    show(els.tick, Boolean(b.tickD));
    setA(els.tick, 'd', b.tickD);
  }
  show(els.glint, Boolean(m.glint));
  if (m.glint) m.glint.forEach((band, i) => { setA(els[`glint${i}`], 'd', band.d); setA(els[`glint${i}`], 'opacity', band.a); });
  m.zzz.forEach((z, i) => {
    show(els[`zzz${i}`], Boolean(z));
    if (!z) return;
    setA(els[`zzz${i}`], 'd', z.d);
    setA(els[`zzz${i}`], 'stroke-opacity', z.a);
  });
}

// ---- Painting: numbers onto elements -------------------------------------------------------------------

const f2 = (n) => Math.round(n * 100) / 100;

/** Writes one frame onto the elements (real ones in the browser, attribute bags on the server). */
export function paintFigure(els, rig, { px = 1, lite = false, head = false, prefix = '' } = {}) {
  const m = frameModel(rig, { px, head });
  setA(els.bodyBack, 'transform', m.body);
  setA(els.bodyFront, 'transform', m.body);

  // Contact shadow: the pool and the tighter core under it.
  if (!head) {
    for (const [name, rx, ry] of [['pool', 52, 6], ['core', 33, 3.25]]) {
      const e = els[name];
      setA(e, 'cx', m.shadowCx); setA(e, 'rx', f2(rx * m.shadowK)); setA(e, 'ry', f2(ry * m.shadowK)); setA(e, 'opacity', m.shadowK);
    }
  }

  // Antenna.
  const a = m.antenna;
  setA(els.antStem, 'd', a.d);
  setA(els.antRim, 'd', a.d);
  setA(els.antBulbG, 'transform', `translate(${a.tip[0]} ${a.tip[1]})`);
  const lit = a.glow > 0;
  show(els.antHalo, lit);
  if (lit) { setA(els.antHalo, 'r', a.haloScale); setA(els.antHalo, 'opacity', f2(a.glow * 0.7)); }
  show(els.antGlow, lit);
  if (lit) setA(els.antGlow, 'opacity', f2(0.85 * a.glow));
  show(els.antLit, lit);
  if (lit) { setA(els.antLit, 'r', a.litR); setA(els.antLit, 'stroke-opacity', f2(a.glow)); }

  // Arms: each is drawn behind or in front of the body, never both.
  if (!head) {
    for (const s of ['L', 'R']) {
      const arm = m.arms[s];
      show(els[`arm${s}Back`], !arm.front);
      show(els[`arm${s}Front`], arm.front);
      paintArm(els, `arm${s}${arm.front ? 'Front' : 'Back'}`, arm, lite);
    }
    for (const s of ['L', 'R']) {
      const leg = m.legs[s];
      setA(els[`boot${s}`], 'transform', leg.frame);
      setA(els[`legc${s}`], 'transform', leg.frame);
      setA(els[`lip${s}`], 'transform', leg.frame);
      setA(els[`legu${s}`], 'transform', leg.unframe);
      for (let i = 0; i < (lite ? 1 : 3); i += 1) setA(els[`leg${s}_h${i}`], 'd', leg.d);
    }
    show(els.sheet, Boolean(m.sheet));
    if (m.sheet) setA(els.sheet, 'transform', m.sheet.transform);
  }

  for (const s of ['L', 'R']) paintEye(els, s, m.eyes[s], m.eyes[`glow${s}`], prefix);
  paintMarks(els, m);
}

function paintArm(els, k, arm, lite) {
  for (let i = 0; i < (lite ? 1 : 3); i += 1) setA(els[`${k}_h${i}`], 'd', arm.d);
  setA(els[`${k}_hand`], 'transform', arm.hand);
  const palm = els[`${k}_palm`];
  setA(palm, 'cx', arm.palm.cx); setA(palm, 'cy', arm.palm.cy); setA(palm, 'rx', arm.palm.rx); setA(palm, 'ry', arm.palm.ry);
  setA(els[`${k}_thumb`], 'transform', arm.thumb.transform);
  setA(els[`${k}_thumbE`], 'ry', arm.thumb.ry);
  show(els[`${k}_finger`], Boolean(arm.finger));
  if (arm.finger) {
    setA(els[`${k}_fingerR`], 'height', arm.finger.h);
    setA(els[`${k}_fingerRim`], 'height', arm.finger.rimH);
    if (!lite) {
      const c = els[`${k}_crease`];
      setA(c, 'y1', arm.finger.creaseY); setA(c, 'y2', arm.finger.creaseY); setA(c, 'stroke-opacity', arm.finger.creaseA);
    }
  }
  if (!lite) setA(els[`${k}_palmRim`], 'd', arm.palmRim);
}

function paintEye(els, s, e, glow, prefix) {
  const gl = els[`glow${s}`];
  show(gl, Boolean(glow));
  if (glow) { setA(gl, 'cx', glow.cx); setA(gl, 'cy', glow.cy); setA(gl, 'rx', glow.rx); setA(gl, 'ry', glow.ry); setA(gl, 'opacity', glow.a); }
  const lid = els[`lid${s}`];
  show(lid, Boolean(e.lid));
  if (e.lid) { setA(lid, 'd', e.lid.d); setA(lid, 'stroke-opacity', e.lid.a); setA(lid, 'stroke-width', e.lid.sw); }
  const rect = els[`eye${s}`];
  const cat = els[`catch${s}`];
  show(rect, Boolean(e.body));
  if (e.body) {
    const b = e.body;
    setA(rect, 'x', b.x); setA(rect, 'y', b.y); setA(rect, 'width', b.w); setA(rect, 'height', b.h);
    setA(rect, 'rx', b.rx); setA(rect, 'ry', b.ry); setA(rect, 'opacity', b.a);
    setA(els[`ecl${s}`], 'd', b.clipLift || 'M0 0Z');
    setA(els[`ecd${s}`], 'd', b.clipLid || 'M0 0Z');
    setA(els[`eg1${s}`], 'clip-path', b.clipLift ? `url(#${prefix}ecl${s})` : null);
    setA(els[`eg2${s}`], 'clip-path', b.clipLid ? `url(#${prefix}ecd${s})` : null);
    show(cat, Boolean(b.catchlight));
    if (b.catchlight) { const c = b.catchlight; setA(cat, 'cx', c.cx); setA(cat, 'cy', c.cy); setA(cat, 'rx', c.rx); setA(cat, 'ry', c.ry); setA(cat, 'opacity', c.a); }
  } else show(cat, false);
  const arc = els[`arc${s}`];
  show(arc, Boolean(e.arc));
  if (e.arc) { setA(arc, 'd', e.arc.d); setA(arc, 'stroke-opacity', e.arc.a); setA(arc, 'stroke-width', e.arc.sw); }
}

// ---- Server render: first frame as attributes ----------------------------------------------------------

const reactName = (n) => n.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/**
 * The first frame as attribute bags: `paintFigure` run on plain objects instead of elements. The
 * result maps each data-m name to the React props that draw it. Pure; used for server render and
 * tested without a browser.
 */
export function virtualPaint(rig, opts = {}) {
  const bags = {};
  const els = new Proxy({}, {
    get(target, name) {
      if (typeof name !== 'string') return undefined;
      if (!target[name]) {
        const attrs = {};
        target[name] = { attrs, setAttribute(k, v) { attrs[k] = v; }, removeAttribute(k) { delete attrs[k]; } };
        bags[name] = attrs;
      }
      return target[name];
    },
  });
  paintFigure(els, rig, opts);
  const out = {};
  for (const [name, attrs] of Object.entries(bags)) {
    const props = {};
    for (const [k, v] of Object.entries(attrs)) props[reactName(k)] = v;
    out[name] = props;
  }
  return out;
}

