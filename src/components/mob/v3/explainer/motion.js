// The explainer's motion engine on the web: the prototype's (tmp/design-1020/mob-explainer/src/template.html), ported.
// Every layer is a Web Animation created when the slide is built, with its own delay, paused at 0 and played together,
// so a slide is a function of time (seekable for the preview and the screenshots). Tokens are the app's
// (shared/motion-tokens.json); springs are SpringDescription.withDurationAndBounce sampled into CSS linear().
// Under reduced motion every move is a 120 ms fade at half the delay with the order kept; no squash, particles, sheen,
// loops or hops. Client only: nothing here touches the DOM at import time.
import RIG from './foldRig.json';

export const E = Object.freeze({
  glide: 'cubic-bezier(.15,.5,.5,1)', emph: 'cubic-bezier(.16,1,.3,1)', out: 'cubic-bezier(.23,1,.32,1)', leave: 'cubic-bezier(.5,0,.75,0)',
  sweep: 'cubic-bezier(.45,0,.55,1)', drawer: 'cubic-bezier(.32,.72,0,1)', inOut: 'cubic-bezier(.77,0,.175,1)', lin: 'linear',
});

export function spring(ms, bounce) {
  const T = ms / 1000; const w0 = (2 * Math.PI) / T; const z = 1 - bounce; const D = bounce > 0 ? T : T * 1.25; const N = 44; const pts = [];
  for (let i = 0; i <= N; i += 1) {
    const t = (D * i) / N; let x;
    if (z < 1) { const wd = w0 * Math.sqrt(1 - z * z); x = 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t)); } else x = 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    pts.push(i === N ? 1 : +x.toFixed(4));
  }
  return { e: `linear(${pts.join(',')})`, d: Math.round(D * 1000) };
}
export const SP = Object.freeze({ celebrate: spring(520, 0.22), iconPop: spring(420, 0.18), smooth: spring(360, 0.12) });

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** A seekable timeline. a(): one animation with its own delay. tick(): text that changes with time (counts, labels). */
export class TL {
  constructor() { this.list = []; this.ticks = []; this.end = 0; this.show = 0; this.raf = 0; this.t0 = 0; }
  a(el, kf, o = {}) {
    if (!el || typeof el.animate !== 'function') return null;
    const d = o.d ?? 360; const at = Math.max(0, o.at ?? 0); const it = o.it ?? 1;
    const an = el.animate(kf, { duration: d, delay: at, easing: o.e || E.out, fill: o.fill || 'both', iterations: it });
    an.pause(); an.currentTime = 0; this.list.push(an);
    this.end = Math.max(this.end, at + d * it); if (!o.loop) this.show = Math.max(this.show, at + d * it);
    return an;
  }
  tick(fn, until = 0) { this.ticks.push(fn); this.end = Math.max(this.end, until); this.show = Math.max(this.show, until); fn(0); }
  play() {
    this.t0 = performance.now(); this.list.forEach((a) => a.play()); cancelAnimationFrame(this.raf);
    if (!this.ticks.length) return;
    const f = () => { const t = performance.now() - this.t0; this.ticks.forEach((fn) => fn(t)); if (t < this.end + 100) this.raf = requestAnimationFrame(f); };
    this.raf = requestAnimationFrame(f);
  }
  seek(t) { cancelAnimationFrame(this.raf); this.list.forEach((a) => { a.pause(); a.currentTime = t; }); this.ticks.forEach((fn) => fn(t)); }
  /** The slide's end state: every layer at rest, the idle loops run out (no eye half closed, no breath held). */
  finish() { this.seek(this.end + 1); }
  kill() { cancelAnimationFrame(this.raf); this.list.forEach((a) => a.cancel()); this.list = []; this.ticks = []; }
}

// ---------------------------------------------------------------- DOM building blocks

export function h(tag, attrs = {}, kids = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'text') el.textContent = v; else if (k === 'html') el.innerHTML = v; else el.setAttribute(k, v);
  }
  for (const c of [].concat(kids)) if (c) el.append(c);
  return el;
}

export const ART = Object.freeze({
  sceneNight: '/mob/art/scene-empty-nothing-night.webp',
  sceneDay: '/mob/art/scene-empty-nothing-day.webp',
  parcelSealed: '/mob/art/parcel-sealed.webp',
  parcelPop: '/mob/art/parcel-pop.webp',
  parcelOpen: '/mob/art/parcel-open.webp',
  stampSeal: '/mob/art/stamp-seal.webp',
  mobiGreet: '/mob/explainer/mobi-greet.webp',
  mobiThink: '/mob/explainer/mobi-think.webp',
});
export const ART_SIZE = Object.freeze({ mobiGreet: [375, 512], mobiThink: [346, 512] });
export const foldStill = (key, pose = 'idle', large = false) => `/mob/folds/fold-${key}-${pose}@${large ? 512 : 256}.webp`;
export const foldHead = (key) => `/mob/folds/fold-${key}-head@128.webp`;

/** Every file the slides draw, so the explainer can warm them before the first slide plays. */
export function explainerArt() {
  const out = new Set(Object.values(ART));
  for (const [k, poses] of Object.entries(RIG)) for (const p of Object.keys(poses)) out.add(foldStill(k, p));
  for (const k of ['dart', 'dogear', 'hexa', 'kandil']) out.add(foldHead(k));
  out.add(foldStill('hop', 'cheer', true));
  return [...out];
}

export function img(src, cls = '', style = '') { return h('img', { src, class: cls || null, style: style || null, alt: '', draggable: 'false', decoding: 'async' }); }

const ICONS = {
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
};
export function icon(name, size = 22, extra = '') {
  const s = h('span', { style: `display:inline-flex;${extra}` });
  s.innerHTML = `<svg class="mx-icon" viewBox="0 0 24 24" style="width:${size}px;height:${size}px" aria-hidden="true">${ICONS[name]}</svg>`;
  return s;
}
export const STAR = (fill) => `<svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M7 0C7.6 4.6 9.4 6.4 14 7 9.4 7.6 7.6 9.4 7 14 6.4 9.4 4.6 7.6 0 7 4.6 6.4 6.4 4.6 7 0Z" fill="${fill}"/></svg>`;
export const TICK = (stroke, w = 3) => `<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`;

/**
 * A Fold (FoldPuppet, spec 5.2): a still per pose, moved around its boots. Layers: hx (travel) > shadow, en (enter) >
 * hp (hops) > sq (squash) > br (breathe) > the poses and the eye covers (visor-coloured, over the eye boxes of folds.json).
 */
export function fold(key, o) {
  const rig = RIG[key] || RIG.dart;
  const poses = Array.from(new Set([o.pose || 'idle', ...(o.poses || [])])).filter((p) => rig[p]);
  const p0 = rig[poses[0]]; const piv = p0.pivot; const size = o.size;
  const root = h('div', { class: `mx-fold${o.ghost ? ' is-ghost' : ''}`, style: `left:${o.x - size * piv[0]}px;top:${o.base - size * piv[1]}px;width:${size}px;height:${size}px;z-index:${o.z ?? Math.round(o.base)}` });
  const hx = h('div', { class: 'mx-fold__l' });
  const sh = h('div', { class: 'mx-fold__shadow', style: `left:${size * piv[0] - size * 0.3}px;top:${size * piv[1] - size * 0.05}px;width:${size * 0.6}px;height:${size * 0.1}px` });
  const en = h('div', { class: 'mx-fold__l' }); const hp = h('div', { class: 'mx-fold__l' }); const sq = h('div', { class: 'mx-fold__l' }); const br = h('div', { class: 'mx-fold__l' });
  const origin = `${piv[0] * 100}% ${piv[1] * 100}%`; sq.style.transformOrigin = origin; br.style.transformOrigin = origin;
  const imgs = {}; const eyes = {};
  for (const p of poses) {
    imgs[p] = img(foldStill(key, p, Boolean(o.large) && (p === 'idle' || p === 'cheer')), `mx-fold__pose${p === poses[0] ? '' : ' is-off'}`);
    br.append(imgs[p]);
    eyes[p] = (rig[p].eyes || []).map(([x, y, w, hh]) => {
      const e = h('div', { class: 'mx-fold__eye', style: `left:${(x - w * 0.18) * 100}%;top:${(y - hh * 0.14) * 100}%;width:${w * 136}%;height:${hh * 128}%;background:${rig[p].visor}` });
      br.append(e); return e;
    });
  }
  sq.append(br); hp.append(sq); en.append(hp); if (!o.noShadow) hx.append(sh); hx.append(en); root.append(hx);
  return { key, root, hx, sh, en, hp, sq, br, imgs, eyes, size, piv, pose: poses[0], o };
}

/** A true silhouette (a still masked in the silhouette ink): Folds still to earn. */
export function silFold(key, o) {
  const piv = (RIG[key] || RIG.dart).idle.pivot;
  const src = foldStill(key, 'idle');
  return h('div', { class: 'mx-sil', style: `left:${o.x - o.size * piv[0]}px;top:${o.base - o.size * piv[1]}px;width:${o.size}px;height:${o.size}px;-webkit-mask-image:url(${src});mask-image:url(${src})` });
}

export function tag(parent, text, x, y, cls = '') { const t = h('div', { class: `mx-tag ${cls}`.trim(), style: `left:${x}px;top:${y}px`, text }); parent.append(t); return t; }

export function headDisc(key, size, extra = '') {
  return h('div', { class: 'mx-head', style: `width:${size}px;height:${size}px;${extra}` }, [img(foldHead(key), '', 'width:100%;height:100%;object-fit:cover')]);
}

let lampIds = 0;
export function lamp(parent, o) {
  const l = h('div', { class: 'mx-lamp', style: `left:${o.x - 160}px;top:${o.top || 0}px;width:320px;height:${o.h}px` });
  const cone = h('div', { class: 'mx-lamp__cone', style: `width:${o.w}px;height:${o.h - 26}px` });
  const id = `mxlg${(lampIds += 1)}`;
  const shade = h('div', { class: 'mx-lamp__shade', html: `<svg viewBox="0 0 64 34" width="64" height="34" aria-hidden="true"><rect x="30.5" y="-40" width="3" height="46" fill="#5B4A2E"/><path d="M14 30 L22 6 Q32 2 42 6 L50 30 Z" fill="#B8893F"/><path d="M14 30 L22 6 Q32 2 42 6 L50 30 Z" fill="url(#${id})"/><defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset=".45" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></linearGradient></defs><ellipse cx="32" cy="30" rx="18" ry="3.2" fill="#FFE2A8"/></svg>` });
  l.append(cone, shade); parent.append(l);
  return { el: l, cone, shade };
}

/** The Mob's pennant: paper on a rod, the name, the weeks figure (rolling to `next`), a felt band with one stitch a week. */
export function pennant(parent, o) {
  const w = o.w; const hh = Math.round(w * 1.3);
  const p = h('div', { class: 'mx-pennant', style: `left:${o.x - w / 2}px;top:${o.y}px;width:${w}px;height:${hh}px` });
  const cloth = h('div', { class: 'mx-pennant__cloth mx-grain' });
  const name = o.name ? h('div', { class: 'mx-pennant__name', text: o.name, style: `top:${w * 0.1}px;font-size:${Math.max(10, w * 0.095)}px;line-height:1.2` }) : null;
  const top = o.name ? w * 0.25 : w * 0.12;
  const numWrap = h('div', { class: 'mx-pennant__num', style: `top:${top}px;height:${w * 0.5}px;font-size:${w * 0.5}px;overflow:hidden` });
  const nOld = h('div', { text: String(o.weeks), style: 'position:absolute;left:0;right:0;top:0' });
  const nNew = o.next != null ? h('div', { text: String(o.next), style: 'position:absolute;left:0;right:0;top:0' }) : null;
  numWrap.append(nOld); if (nNew) { numWrap.append(nNew); nNew.style.opacity = 0; }
  const word = h('div', { class: 'mx-pennant__word', text: o.word || 'weeks', style: `top:${top + w * 0.52}px;font-size:${Math.max(10, w * 0.095)}px` });
  const bandW = w * 0.8; const slots = o.slots || 4;
  const band = h('div', { class: 'mx-pennant__band', style: `left:${w * 0.1}px;top:${hh * 0.72}px;width:${bandW}px;height:${w * 0.2}px` });
  const stitches = []; const ss = Math.max(14, Math.round(w * 0.14));
  for (let i = 0; i < slots; i += 1) {
    const sx = (bandW / slots) * (i + 0.5) - ss / 2;
    const s = h('div', { class: 'mx-pennant__stitch', style: `left:${sx}px;top:${w * 0.1 - ss / 2}px;width:${ss}px;height:${ss}px` });
    const sewing = i === o.weeks && o.next != null;
    const col = sewing ? '#D2F000' : '#E9DFC7';
    s.innerHTML = `<svg viewBox="-1 -1 16 16" width="${ss}" height="${ss}" aria-hidden="true"><path d="M1 1 L13 13 M13 1 L1 13" stroke="${col}" stroke-width="2.2" stroke-linecap="round" fill="none" ${i < o.weeks || sewing ? '' : 'opacity="0"'}/></svg>`;
    band.append(s); stitches.push(s);
  }
  cloth.append(...[name, numWrap, word, band].filter(Boolean));
  p.append(h('div', { class: 'mx-pennant__rod' }), cloth); parent.append(p);
  return { el: p, nOld, nNew, band, stitches, cloth, ss, bandW };
}

/** Paper bits under gravity and drag, floored; seeded (brand kit 6). */
function bitsInto(tl, parent, o) {
  const r = rng(o.seed || 7); const cols = o.colors || ['#ECE3CF', '#F2A93B', '#D2F000', '#FF7A8A', '#56B8F0'];
  for (let i = 0; i < Math.min(26, o.n); i += 1) {
    const w = 4 + r() * 4; const hh = 3 + r() * 3; const c = cols[i % cols.length];
    const el = h('div', { class: 'mx-bit', style: `width:${w}px;height:${hh}px;background:linear-gradient(90deg,${c} 52%,color-mix(in srgb,${c} 72%,#000) 52%)` });
    parent.append(el);
    const vx = (r() - 0.5) * 260 * (o.spread || 1); const vy = -(o.up || 160) - r() * 200; const life = 700 + r() * 700; const rot0 = r() * 360; const vr = (r() - 0.5) * 900;
    const kf = []; let x = o.x; let y = o.y; let vxx = vx; let vyy = vy;
    for (let k = 0; k <= 10; k += 1) {
      const tt = (life * k) / 10 / 1000;
      if (k > 0) { const dt = life / 10 / 1000; vyy += 900 * dt; vxx *= 1 - 0.12 * dt * 6; vyy *= 1 - 0.12 * dt * 2; x += vxx * dt; y += vyy * dt; if (o.floor && y > o.floor) { y = o.floor; vyy = 0; vxx *= 0.4; } }
      kf.push({ transform: `translate(${x}px,${y}px) rotate(${rot0 + vr * tt}deg) scaleX(${Math.cos((rot0 + vr * tt) / 40) * 0.5 + 0.7})`, opacity: k < 8 ? 1 : (10 - k) / 3 });
    }
    kf[0].opacity = 0; kf[1].opacity = 1;
    tl.a(el, kf, { d: life, at: o.at + r() * 60, e: E.lin });
  }
}

/** The motion helpers, each knowing its reduced form. */
export function motionKit({ rm = false } = {}) {
  const at = (t) => (rm ? t * 0.5 : t);
  const fade = (tl, el, t, d = 120) => tl.a(el, [{ opacity: 0 }, { opacity: 1 }], { d: rm ? 120 : d, at: at(t), e: E.lin });
  const K = {
    rm, at,
    fadeIn: (tl, el, t, d = 200) => fade(tl, el, t, d),
    rise(tl, el, t, o = {}) {
      if (rm) return fade(tl, el, t);
      return tl.a(el, [{ opacity: 0, transform: `translateY(${o.dy ?? 14}px)` }, { opacity: 1, transform: 'none' }], { d: o.d ?? 360, at: t, e: o.e || E.emph });
    },
    pop(tl, el, t, from = 0.92) {
      if (rm) return fade(tl, el, t);
      tl.a(el, [{ opacity: 0 }, { opacity: 1 }], { d: 120, at: t, e: E.lin });
      return tl.a(el, [{ transform: `scale(${from})` }, { transform: 'scale(1)' }], { d: SP.iconPop.d, at: t, e: SP.iconPop.e });
    },
    engrave(tl, el, t) {
      if (rm) return fade(tl, el, t);
      return tl.a(el, [{ clipPath: 'inset(0 100% 0 0)', opacity: 1 }, { clipPath: 'inset(0 0% 0 0)', opacity: 1 }], { d: 280, at: t, e: E.out });
    },
    draw(tl, path, t, d = 450) {
      const L = path.getTotalLength ? path.getTotalLength() : 100; path.style.strokeDasharray = `${L} ${L}`;
      if (rm) { path.style.strokeDashoffset = 0; return fade(tl, path, t); }
      return tl.a(path, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { d, at: t, e: E.inOut });
    },
    squash(tl, f, t) {
      if (rm) return;
      tl.a(f.sq, [{ transform: 'scale(1,1)' }, { transform: 'scale(1.08,.88)', offset: 0.16 }, { transform: 'scale(1.08,.88)', offset: 0.34 }, { transform: 'scale(.97,1.035)', offset: 0.62 }, { transform: 'scale(1,1)' }], { d: 520, at: t, e: E.lin, fill: 'none' });
    },
    hopIn(tl, f, t, rise = 36) {
      if (rm) { fade(tl, f.en, t); fade(tl, f.sh, t); return; }
      tl.a(f.en, [{ opacity: 0, transform: `translateY(${rise}px)`, easing: E.out }, { opacity: 1, transform: `translateY(${-rise / 2}px)`, offset: 0.55, easing: E.leave }, { opacity: 1, transform: 'translateY(0)' }], { d: 440, at: t, e: E.lin });
      tl.a(f.sh, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 0.5, transform: 'scale(.6)', offset: 0.55 }, { opacity: 1, transform: 'scale(1)' }], { d: 440, at: t, e: E.lin });
      K.squash(tl, f, t + 430);
    },
    drop(tl, f, t, from = 60) {
      if (rm) { fade(tl, f.en, t); return; }
      tl.a(f.en, [{ opacity: 0, transform: `translateY(${-from}px)` }, { opacity: 1, transform: `translateY(${-from}px)`, offset: 0.05 }, { opacity: 1, transform: 'translateY(0)' }], { d: 240, at: t, e: E.leave });
      tl.a(f.sh, [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1)' }], { d: 240, at: t, e: E.leave });
      K.squash(tl, f, t + 230);
    },
    poseTo(tl, f, pose, t) {
      const from = f.pose; if (!f.imgs[pose] || from === pose) return;
      tl.a(f.imgs[pose], [{ opacity: 0 }, { opacity: 1 }], { d: 120, at: at(t), e: E.lin, fill: 'forwards' });
      tl.a(f.imgs[from], [{ opacity: 1 }, { opacity: 0 }], { d: 120, at: at(t), e: E.lin, fill: 'forwards' });
      (f.poseLog ||= [[0, from]]).push([t, pose]); f.pose = pose;
    },
    /** Breathe 1 to 1.028 on the 3600 ms sweep, three times, and seeded blinks every 4 to 7 s, never in sync; then still. */
    idle(tl, f, t, seed) {
      if (rm) return;
      tl.a(f.br, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(1.028)' }, { transform: 'scaleY(1)' }], { d: 3600, at: t + (seed % 5) * 120, it: 3, e: E.sweep, loop: true, fill: 'none' });
      const r = rng(seed * 977 + 13); let b = t + 600 + r() * 1800;
      while (b < t + 11000) {
        const log = f.poseLog || [[0, f.pose]]; let p = log[0][1]; for (const [tt, pp] of log) if (tt <= b) p = pp;
        for (const e of f.eyes[p] || []) tl.a(e, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)', offset: 0.45 }, { transform: 'scaleY(1)', offset: 0.55 }, { transform: 'scaleY(0)' }], { d: 150, at: b, e: E.lin, fill: 'none', loop: true });
        b += 4000 + r() * 3000;
      }
    },
    bits(tl, parent, o) { if (!rm) bitsInto(tl, parent, o); },
    glints(tl, parent, o) {
      if (rm) return;
      for (let i = 0; i < o.n; i += 1) {
        const ang = (i / o.n) * Math.PI * 2 + (o.rot || 0); const x = o.x + Math.cos(ang) * o.r - 7; const y = o.y + Math.sin(ang) * o.r - 7;
        const g = h('div', { class: 'mx-glint', html: STAR(o.color || '#F2D9A0'), style: `transform:translate(${x}px,${y}px);opacity:0` }); parent.append(g);
        tl.a(g, [{ opacity: 0, transform: `translate(${x}px,${y}px) scale(0.2) rotate(0deg)` }, { opacity: 1, transform: `translate(${x}px,${y}px) scale(1) rotate(30deg)`, offset: 0.4 }, { opacity: 0, transform: `translate(${x + Math.cos(ang) * 8}px,${y + Math.sin(ang) * 8}px) scale(.3) rotate(60deg)` }], { d: 520, at: o.at + i * 30, e: E.out });
      }
    },
    swingIn(tl, el, t) {
      if (rm) return fade(tl, el, t);
      return tl.a(el, [{ opacity: 0, transform: 'translateY(-16px) rotate(-9deg)' }, { opacity: 1, transform: 'translateY(0) rotate(2.4deg)', offset: 0.32 }, { transform: 'rotate(-1.2deg)', offset: 0.56 }, { transform: 'rotate(.4deg)', offset: 0.8 }, { opacity: 1, transform: 'rotate(0deg)' }], { d: 900, at: t, e: E.out });
    },
  };
  return K;
}

/** Reduced motion: the system setting, or the site's own motion switch (html[data-motion='reduced']). */
export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced');
}
