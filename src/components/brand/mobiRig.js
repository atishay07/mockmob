// Mobi's rig, evaluated. The website plays the same Mobi as the app from the same table:
// data/mobi_rig.v2.json is the byte for byte export of flutter_app/lib/core/mascot/mobi_rig_data.dart
// (mobiRigSpec). This file is the web twin of mobi_rig_eval.dart, mobi_mood.dart and the
// choreography half of mobi_acts.dart (MobiMoves): curves, expressions, channels, moods, stances,
// key poses and settled poses, by the rules written at the top of the Dart table.
//
// Pure: no browser, no React, no clock. A rig is a plain object (see `defaultRig`); every function
// returns a new one. Units are the table's: design units in a 140 by 168 box (soles on y 162, up is
// negative), radians, seconds. Tested without a browser (data/tests/mobi_rig.test.mjs).
//
// Use `createBook(spec)`; the page-side singleton is in mobiBook.js (it imports the JSON).

const lerp = (a, b, t) => a + (b - a) * t;
const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const SCALARS = ['x', 'y', 'tilt', 'squash', 'lookX', 'lookY', 'antenna', 'burst', 'zzz', 'sheet', 'glow', 'glint', 'sparkle', 'bubble'];
export const EYE_FIELDS = ['open', 'happy', 'lid', 'smile', 'slant'];
export const ARM_FIELDS = ['angle', 'bend', 'twist', 'front', 'point', 'reach'];
export const BOOT_FIELDS = ['dx', 'dy', 'rot'];
// Effect fields: progress 0 to 1, or -1 for none; between two rigs they switch at the halfway point.
const EFFECTS = new Set(['burst', 'zzz', 'glint', 'sparkle', 'bubble']);

const ARM_DEFAULTS = { angle: 0, bend: 0.25, twist: 0, front: 0, point: 0, reach: 1 };
const SCALAR_DEFAULTS = { x: 0, y: 0, tilt: 0, squash: 0, lookX: 0, lookY: 0, antenna: 0, burst: -1, zzz: -1, sheet: 0, glow: 0, glint: -1, sparkle: -1, bubble: -1 };

const num = (v, fallback = 0) => (v == null ? fallback : Number(v));

export const eyeOf = (m = {}) => ({ open: num(m.open, 1), happy: num(m.happy), lid: num(m.lid), smile: num(m.smile), slant: num(m.slant) });
export const bootOf = (m = {}) => ({ dx: num(m.dx), dy: num(m.dy), rot: num(m.rot) });
const armRaw = (m = {}) => ({
  angle: num(m.angle, ARM_DEFAULTS.angle), bend: num(m.bend, ARM_DEFAULTS.bend), twist: num(m.twist, ARM_DEFAULTS.twist),
  front: num(m.front, ARM_DEFAULTS.front), point: num(m.point, ARM_DEFAULTS.point), reach: num(m.reach, ARM_DEFAULTS.reach),
});

/** The rig at rest with the standing arms (the Dart `const MobiRig()`). */
export function defaultRig() {
  return {
    ...SCALAR_DEFAULTS,
    eyeL: eyeOf(), eyeR: eyeOf(),
    armL: armRaw({ angle: 0.3, bend: 0.3 }), armR: armRaw({ angle: 0.28, bend: 0.3 }),
    bootL: bootOf(), bootR: bootOf(),
  };
}

/** [r] with some fields replaced (shallow; pass whole eye, arm or boot objects). */
export const withRig = (r, patch) => ({ ...r, ...patch });

const lerpObj = (a, b, t, fields) => { const o = {}; for (const f of fields) o[f] = lerp(a[f], b[f], t); return o; };

/** Rig a to rig b at t (0 to 1); effect fields switch at the halfway point. */
export function lerpRig(a, b, t) {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const r = {};
  for (const f of SCALARS) {
    r[f] = EFFECTS.has(f) && (a[f] < 0 || b[f] < 0) ? (t < 0.5 ? a[f] : b[f]) : lerp(a[f], b[f], t);
  }
  r.eyeL = lerpObj(a.eyeL, b.eyeL, t, EYE_FIELDS);
  r.eyeR = lerpObj(a.eyeR, b.eyeR, t, EYE_FIELDS);
  r.armL = lerpObj(a.armL, b.armL, t, ARM_FIELDS);
  r.armR = lerpObj(a.armR, b.armR, t, ARM_FIELDS);
  r.bootL = lerpObj(a.bootL, b.bootL, t, BOOT_FIELDS);
  r.bootR = lerpObj(a.bootR, b.bootR, t, BOOT_FIELDS);
  return r;
}

// ---- Curves -----------------------------------------------------------------------------------

/** Flutter's Cubic curve by the same bisection (stops when |x - t| < 0.001), so the numbers match. */
export class Cubic {
  constructor(list) {
    this.linear = list == null;
    [this.a, this.b, this.c, this.d] = list || [0, 0, 1, 1];
  }

  static cubic(a, b, m) { return 3 * a * (1 - m) * (1 - m) * m + 3 * b * (1 - m) * m * m + m * m * m; }

  transform(t) {
    if (t === 0 || t === 1 || this.linear) return t;
    let start = 0;
    let end = 1;
    for (let i = 0; i < 64; i += 1) {
      const mid = (start + end) / 2;
      const estimate = Cubic.cubic(this.a, this.c, mid);
      if (Math.abs(t - estimate) < 0.001) return Cubic.cubic(this.b, this.d, mid);
      if (estimate < t) start = mid; else end = mid;
    }
    return Cubic.cubic(this.b, this.d, (start + end) / 2);
  }
}

// ---- Expressions and programs -------------------------------------------------------------------

function easeFn(t, a, b, curve) {
  if (t <= a) return 0;
  if (t >= b) return 1;
  return curve.transform((t - a) / (b - a));
}

class Compiler {
  constructor(book, names) { this.book = book; this.names = names; }

  chan(v) {
    if (v == null || typeof v !== 'object' || Array.isArray(v)) return { add: this.expr(v) };
    if (('to' in v) !== ('w' in v)) throw new Error('Mobi rig: a channel needs both "to" and "w"');
    const f = (k) => (k in v ? this.expr(v[k]) : null);
    return { to: f('to'), w: f('w'), mul: f('mul'), add: f('add'), max: f('max'), set: f('set') };
  }

  expr(node) {
    if (typeof node === 'number') return () => node;
    if (!Array.isArray(node) || node.length === 0 || typeof node[0] !== 'string') throw new Error(`Mobi rig: bad expression ${JSON.stringify(node)}`);
    const [op, ...args] = node;
    const arg = (i) => this.expr(args[i]);
    const curveArg = (i, fallback = 'easeInOutCubic') => this.book.curve(i < args.length ? args[i] : fallback);
    const all = () => args.map((a) => this.expr(a));
    switch (op) {
      case 'ease': { const a = arg(0); const b = arg(1); const cv = curveArg(2); return (e) => easeFn(e.t, a(e), b(e), cv); }
      case 'win': {
        const a = arg(0); const b = arg(1); const c = arg(2); const d = arg(3);
        const cin = curveArg(4); const cout = curveArg(5);
        return (e) => easeFn(e.t, a(e), b(e), cin) * (1 - easeFn(e.t, c(e), d(e), cout));
      }
      case 'bump': {
        const a = arg(0); const b = arg(1);
        return (e) => { const lo = a(e); const hi = b(e); return e.t <= lo || e.t >= hi ? 0 : Math.sin((Math.PI * (e.t - lo)) / (hi - lo)); };
      }
      case 'hop': {
        const a = arg(0); const b = arg(1); const h = arg(2);
        return (e) => {
          const lo = a(e); const hi = b(e);
          if (e.t <= lo || e.t >= hi) return 0;
          const p = (e.t - lo) / (hi - lo);
          return -h(e) * 4 * p * (1 - p);
        };
      }
      case 'span': {
        const a = arg(0); const b = arg(1);
        return (e) => { const lo = a(e); const hi = b(e); return e.t < lo || e.t > hi ? -1 : (e.t - lo) / (hi - lo); };
      }
      case 'osc': { const hz = arg(0); const t0 = arg(1); return (e) => Math.sin(2 * Math.PI * hz(e) * (e.t - t0(e))); }
      case 'curve': { const cv = this.book.curve(args[0]); const x = arg(1); return (e) => cv.transform(clampN(x(e), 0, 1)); }
      case 'pow': {
        const x = arg(0); const p = arg(1);
        return (e) => { const v = x(e); return v === 0 ? 0 : Math.sign(v) * Math.abs(v) ** p(e); };
      }
      case 'abs': { const x = arg(0); return (e) => Math.abs(x(e)); }
      case 'pos': { const x = arg(0); return (e) => Math.max(0, x(e)); }
      case 'sign': { const x = arg(0); return (e) => Math.sign(x(e)); }
      case 'step': { const x = arg(0); const edge = arg(1); return (e) => (x(e) < edge(e) ? -1 : 1); }
      case 'dip': { const x = arg(0); return (e) => Math.sin(Math.PI * clampN(x(e), 0, 1)); }
      case '+': { const fs = all(); return (e) => { let s = 0; for (const f of fs) s += f(e); return s; }; }
      case '*': { const fs = all(); return (e) => { let s = 1; for (const f of fs) s *= f(e); return s; }; }
      case 'k': { const k = arg(0); const x = arg(1); return (e) => k(e) * x(e); }
      case '1-': { const x = arg(0); return (e) => 1 - x(e); }
      case 'min': { const fs = all(); return (e) => { let s = fs[0](e); for (let i = 1; i < fs.length; i += 1) s = Math.min(s, fs[i](e)); return s; }; }
      case 'max': { const fs = all(); return (e) => { let s = fs[0](e); for (let i = 1; i < fs.length; i += 1) s = Math.max(s, fs[i](e)); return s; }; }
      case 'clamp': { const x = arg(0); const lo = arg(1); const hi = arg(2); return (e) => clampN(x(e), lo(e), hi(e)); }
      case 'ref': {
        const name = args[0];
        if (name === 't') return (e) => e.t;
        if (name === 'len') return (e) => e.len;
        if (name === 'w' && !this.names.has('w')) return (e) => e.w;
        if (name === 'side' && !this.names.has('side')) return (e) => e.side;
        if (!this.names.has(name)) throw new Error(`Mobi rig: "${name}" is used before it is defined`);
        const slot = this.names.get(name);
        return (e) => e.vars[slot];
      }
      case 'base': {
        const field = args[0];
        if (!['x', 'y', 'tilt', 'squash', 'lookX', 'lookY', 'antenna', 'glow'].includes(field)) throw new Error(`Mobi rig: no base field "${field}"`);
        return (e) => e.base[field];
      }
      default: throw new Error(`Mobi rig: unknown operation "${op}"`);
    }
  }
}

function applyChan(c, v, e) {
  if (c.set) return c.set(e);
  if (c.to) v += (c.to(e) - v) * c.w(e);
  if (c.mul) v *= c.mul(e);
  if (c.add) v += c.add(e);
  if (c.max) v = Math.max(v, c.max(e));
  return v;
}

const fieldOps = (m, fields, c) => {
  if (!m) return null;
  const o = {};
  for (const f of fields) if (f in m) o[f] = c.chan(m[f]);
  return o;
};

function applyFields(base, ops, fields, e) {
  if (!ops) return base;
  const o = {};
  for (const f of fields) o[f] = ops[f] ? applyChan(ops[f], base[f], e) : base[f];
  return o;
}

function applyArm(ops, a, e) {
  if (ops.when === 'free' && !(a.front < 0.5 && a.point < 0.5)) return a;
  if (ops.when === 'pointing' && a.point < 0.5) return a;
  let r = a;
  if (ops.to) {
    const k = ops.w(e);
    r = {};
    for (const f of ARM_FIELDS) r[f] = ops.keep.has(f) ? a[f] : a[f] + (ops.to[f] - a[f]) * k;
  }
  return applyFields(r, ops.ch, ARM_FIELDS, e);
}

/** One compiled act or overlay: `run(t, base, {w, len, side})` returns the rig at t seconds in. */
class Program {
  constructor(book, spec) {
    const env = { t: 0, base: null, w: 1, len: 1, side: 0, vars: [] };
    const names = new Map();
    const c = new Compiler(book, names);
    this.lets = [];
    for (const [k, v] of Object.entries(spec.let || {})) {
      this.lets.push(c.expr(v));
      names.set(k, this.lets.length - 1);
    }
    this.env = env;
    this.scalars = SCALARS.map((f) => (f in spec ? c.chan(spec[f]) : null));
    this.eyes = ['eyes', 'eyeL', 'eyeR'].map((k) => fieldOps(spec[k], EYE_FIELDS, c));
    this.boots = ['boots', 'bootL', 'bootR'].map((k) => fieldOps(spec[k], BOOT_FIELDS, c));
    this.arms = ['arms', 'armL', 'armR'].map((k) => {
      const m = spec[k];
      if (!m) return null;
      return {
        to: 'to' in m ? book.armOf(m.to) : null,
        w: 'w' in m ? c.expr(m.w) : null,
        keep: new Set(m.keep || []),
        when: m.when || null,
        ch: fieldOps(m, ARM_FIELDS, c),
      };
    });
  }

  get isEmpty() {
    return this.scalars.every((s) => !s) && this.eyes.every((s) => !s) && this.boots.every((s) => !s) && this.arms.every((s) => !s);
  }

  run(t, base, { w = 1, len = 1, side = 0 } = {}) {
    const e = this.env;
    e.t = t; e.base = base; e.w = w; e.len = len; e.side = side;
    for (let i = 0; i < this.lets.length; i += 1) e.vars[i] = this.lets[i](e);
    const r = {};
    SCALARS.forEach((f, i) => { r[f] = this.scalars[i] ? applyChan(this.scalars[i], base[f], e) : base[f]; });
    const eye = (side0) => {
      let x = base[side0];
      if (this.eyes[0]) x = applyFields(x, this.eyes[0], EYE_FIELDS, e);
      const own = this.eyes[side0 === 'eyeL' ? 1 : 2];
      return own ? applyFields(x, own, EYE_FIELDS, e) : x;
    };
    r.eyeL = eye('eyeL');
    r.eyeR = eye('eyeR');
    const arm = (key, own) => {
      let x = base[key];
      if (this.arms[0]) x = applyArm(this.arms[0], x, e);
      return this.arms[own] ? applyArm(this.arms[own], x, e) : x;
    };
    r.armL = arm('armL', 1);
    r.armR = arm('armR', 2);
    const boot = (key, own) => {
      let x = base[key];
      if (this.boots[0]) x = applyFields(x, this.boots[0], BOOT_FIELDS, e);
      return this.boots[own] ? applyFields(x, this.boots[own], BOOT_FIELDS, e) : x;
    };
    r.bootL = boot('bootL', 1);
    r.bootR = boot('bootR', 2);
    return r;
  }
}

// ---- The book -----------------------------------------------------------------------------------

/** The table compiled once. `createBook(JSON.parse(...))`. */
export function createBook(spec) {
  const curves = {};
  for (const [k, v] of Object.entries(spec.curves)) curves[k] = new Cubic(v);
  const book = {
    spec,
    curve(name) { const c = curves[name]; if (!c) throw new Error(`Mobi rig: no curve "${name}"`); return c; },
    namedArm(name) { const a = namedArms[name]; if (!a) throw new Error(`Mobi rig: no arm "${name}"`); return a; },
    armOf(v) { return typeof v === 'string' ? book.namedArm(v) : armRaw(v); },
  };
  const namedArms = {};
  for (const [k, v] of Object.entries(spec.arms)) namedArms[k] = armRaw(v);
  const programs = {};
  for (const [k, v] of Object.entries(spec.acts)) programs[`act:${k}`] = new Program(book, v);
  for (const [k, v] of Object.entries(spec.overlays)) programs[`overlay:${k}`] = new Program(book, v);
  book.act = (name) => programs[`act:${name}`] || null;
  book.overlay = (name) => { const p = programs[`overlay:${name}`]; if (!p) throw new Error(`Mobi rig: no overlay "${name}"`); return p; };
  book.actSpec = (name) => spec.acts[name];
  book.section = (name) => spec[name];

  /** A rig from a stance-style map; arms default to the standing arms. */
  book.rigOf = (m) => {
    const d = defaultRig();
    const r = {};
    for (const f of SCALARS) r[f] = num(m[f], SCALAR_DEFAULTS[f]);
    r.eyeL = eyeOf(m.eyeL); r.eyeR = eyeOf(m.eyeR);
    r.armL = 'armL' in m ? book.armOf(m.armL) : d.armL;
    r.armR = 'armR' in m ? book.armOf(m.armR) : d.armR;
    r.bootL = bootOf(m.bootL); r.bootR = bootOf(m.bootR);
    return r;
  };
  /** [r] with a `set` map laid over it (scalars, or whole eyes, arms and boots). */
  book.setOver = (r, m) => {
    const o = { ...r };
    for (const f of SCALARS) if (f in m) o[f] = num(m[f]);
    if ('eyeL' in m) o.eyeL = eyeOf(m.eyeL);
    if ('eyeR' in m) o.eyeR = eyeOf(m.eyeR);
    if ('armL' in m) o.armL = book.armOf(m.armL);
    if ('armR' in m) o.armR = book.armOf(m.armR);
    if ('bootL' in m) o.bootL = bootOf(m.bootL);
    if ('bootR' in m) o.bootR = bootOf(m.bootR);
    return o;
  };
  return book;
}

// ---- Moods ----------------------------------------------------------------------------------------

export const MOBI_MOOD_NAMES = ['calm', 'happy', 'proud', 'curious', 'sleepy', 'concerned', 'focused'];

function moodEye(e, m, w) {
  if (!m || Object.keys(m).length === 0) return e;
  return {
    ...e,
    open: e.open * (1 + (m.open || 0) * w),
    lid: Math.max(e.lid, (m.lid || 0) * w),
    smile: Math.max(e.smile, (m.smile || 0) * w),
    slant: e.slant + (m.slant || 0) * w,
  };
}

/** What a mood does to a rig: the mood laid over [r] at strength [w] (calm changes nothing). */
export function applyMood(book, mood, r, w = 1) {
  if (mood === 'calm' || w <= 0) return r;
  const m = book.spec.moods[mood];
  if (!m) return r;
  const add = m.add || {};
  const a = (k, v) => v + (add[k] || 0) * w;
  return {
    ...r,
    eyeL: moodEye(moodEye(r.eyeL, m.eyes, w), m.eyeL, w),
    eyeR: moodEye(moodEye(r.eyeR, m.eyes, w), m.eyeR, w),
    x: a('x', r.x), y: a('y', r.y), tilt: a('tilt', r.tilt), squash: a('squash', r.squash),
    lookX: a('lookX', r.lookX), lookY: a('lookY', r.lookY), antenna: a('antenna', r.antenna), glow: a('glow', r.glow),
  };
}

/** Blending from mood [from] to [to] at progress [k] (0 to 1, already eased). */
export function moodBetween(book, from, to, r, k) {
  if (k >= 1 || from === to) return applyMood(book, to, r);
  if (k <= 0) return applyMood(book, from, r);
  return lerpRig(applyMood(book, from, r), applyMood(book, to, r), k);
}

// ---- Moves: stances, acts, key poses ---------------------------------------------------------------

export const STANCE_NAMES = ['stand', 'point', 'think', 'sleepy', 'rest', 'read', 'loading', 'sleep', 'listen'];

/** The choreography over a book (the web's MobiMoves). */
export function createMoves(book) {
  const stances = {};
  for (const s of STANCE_NAMES) if (s !== 'point') stances[s] = book.rigOf(book.spec.stances[s]);
  const idle = book.spec.idle;
  const num0 = (v) => Number(v);

  const moves = {
    book,
    stepLength: num0(idle.stepSeconds),
    microLength: num0(idle.microSeconds),
    fidgetLength: num0(idle.fidgetSeconds),
    pointReach: book.spec.stances.point.pointing.reach,

    stanceAfter(act) { const s = book.actSpec(act)?.stance; return s == null ? null : s; },
    isHeld(act) { return book.actSpec(act)?.held === true; },
    showsStillPose(act) { const s = book.actSpec(act) || {}; return s.still === true || s.reaction === true; },
    duration(act) { return num0(book.actSpec(act).seconds); },
    stanceBlend(s) { const [dur, curve] = book.spec.stanceBlends[s]; return [num0(dur), book.curve(curve)]; },

    /** The resting rig of a stance; the pointing stance is aimed at run time. */
    stance(s, { pointAngle = 1.5, pointSide = 1 } = {}) {
      if (s !== 'point') return stances[s];
      const p = book.spec.stances.point;
      const pointing = book.armOf({ ...p.pointing, angle: pointAngle });
      const free = book.armOf(p.free);
      const r = defaultRig();
      return {
        ...r,
        armR: pointSide > 0 ? pointing : free,
        armL: pointSide > 0 ? free : pointing,
        x: pointSide > 0 ? p.x.right : p.x.left,
        tilt: p.tilt * pointSide,
        lookX: p.lookX * pointSide,
        lookY: clampN(Math.cos(pointAngle) * p.lookYFromAim, -1, 1),
      };
    },

    /** An act at t seconds, starting from and returning to base. */
    act(act, t, base) {
      if (act === 'talk') return moves.talk(t, base, 1);
      if (act === 'walk') return moves.walk(t, base, moves.duration('walk'));
      const p = book.act(act);
      return p ? p.run(t, base) : base;
    },
    talk(t, b, w) { return book.overlay('talk').run(t, b, { w }); },
    walk(t, b, length) { return book.overlay('walk').run(t, b, { len: length }); },
    micro(kind, t, b) { const k = idle.microKinds; return book.overlay(k[clampN(kind, 0, k.length - 1)]).run(t, b); },
    fidget(kind, t, b) { const k = idle.fidgetKinds; return book.overlay(k[clampN(kind, 0, k.length - 1)]).run(t, b); },
    loadingLoop(t, b, w) { return book.overlay('loading').run(t, b, { w }); },
    listenNod(t, b) { return book.overlay('listenNod').run(t, b); },
    boop(t, b, side) { return book.overlay('boop').run(t, b, { side }); },

    /** A representative still frame of an act for previews and reduced motion. */
    keyPose(act, { pointAngle = 1.5, pointSide = 1, from = 'stand' } = {}) {
      const after = moves.stanceAfter(act) ?? from;
      const base = moves.stance(after, { pointAngle, pointSide });
      const key = book.actSpec(act)?.key;
      if (!key) return base;
      let r;
      if (key.overlay) r = book.overlay(key.overlay).run(key.at ?? 0, base, { w: key.w ?? 1, len: key.len ?? 1 });
      else if (key.at != null) r = moves.act(act, key.at, base);
      else r = base;
      return key.set ? book.setOver(r, key.set) : r;
    },

    /** The still pose for an act under reduced motion: its key pose with no travel and no effects in flight. */
    settledPose(act, { from = 'stand', pointAngle = 1.5, pointSide = 1 } = {}) {
      const k = moves.keyPose(act, { pointAngle, pointSide, from });
      if (!moves.showsStillPose(act)) return k;
      const base = moves.stance(moves.stanceAfter(act) ?? from, { pointAngle, pointSide });
      return { ...k, x: base.x, y: base.y, squash: base.squash, bootL: base.bootL, bootR: base.bootR, burst: -1, sparkle: -1, glint: -1 };
    },
  };
  return moves;
}
