// Mobi's body in time: the web twin of mobi_sim.dart. The stance, the act playing, idle beats (a
// breath, a blink with the right eye trailing by 12 ms, a glance, micro-saccades, fidgets) and the
// springs (antenna, eyes, arm follow-through, the paper body's jiggle), all read from the rig table
// (data/mobi_rig.v2.json) and integrated at 1/120 s steps, as the app does.
//
// Random idle draws use their own seeded streams. The app's are Dart `Random`s; the web cannot
// reproduce that sequence and does not need to: it matches the distributions (the table's
// [base, spread] pairs), and stays deterministic per seed. Pure: no browser, no clock.
//
// Idle life comes in beats with rests between them: when nothing is moving (`busy` is false) the
// caller can stop its frame loop until `idleWait` seconds have passed, then call `elapse()`.

import { lerpRig, moodBetween, createMoves } from './mobiRig.js';

const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** A small seeded generator (mulberry32) with the three draws the sim needs. */
export function createRandom(seed) {
  let s = (seed >>> 0) || 1;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, bool: () => next() < 0.5, int: (n) => Math.floor(next() * n) };
}

const draw = (r, p) => p[0] + r.next() * p[1];

export function createSim(book, { seed = 7, stance = 'stand' } = {}) {
  const moves = createMoves(book);
  const idle = book.spec.idle;
  const sp = book.spec.springs;
  const ease = (name, t) => book.curve(name).transform(t);
  const easeT = (t, a, b, curve = 'easeInOutCubic') => (t <= a ? 0 : t >= b ? 1 : ease(curve, (t - a) / (b - a)));

  const rand = createRandom(seed);
  const fidgetRand = createRandom(seed * 31 + 5);
  const microRand = createRandom(seed * 53 + 11);
  const saccRand = createRandom(seed * 71 + 3);

  const breathSpec = idle.breath;
  const blinkSpec = idle.blink;
  const glanceSpec = idle.glance;
  const saccSpec = idle.saccade;
  const loadingScanFor = idle.loadingScanSeconds;
  const moodBlend = book.spec.moodBlend;

  let st = stance; // the stance name
  let stanceRig = moves.stance(st);
  let stanceFrom = null;
  let stanceT = 0;
  let holdT = 0;
  let pointAngle = 1.5;
  let pointSide = 1;
  let rig = stanceRig;

  let act = null;
  let actT = 0;
  let actDur = 0;
  let carry = null;
  let carryT = 0;
  let talkLeft = 0;
  let talkT = 0;
  let talkW = 0;
  let breathT = -1;
  let breathDur = 3;
  let breathWait = draw(rand, breathSpec.firstWait);
  let blinkT = -1;
  let blinkWait = draw(rand, blinkSpec.firstWait);
  let doubleBlink = false;
  let glanceT = -1;
  let glanceDur = 1;
  let glanceWait = draw(rand, glanceSpec.firstWait);
  let glance = [0, 0];
  let glanceLean = 0;
  let beatT = -1;
  let beatWait = draw(rand, idle.listenFirstWait);
  let fidgetT = -1;
  let fidgetWait = draw(fidgetRand, idle.fidgetFirstWait);
  let fidget = 0;
  let microT = -1;
  let microWait = draw(microRand, idle.microFirstWait);
  let micro = 0;
  let saccWait = saccSpec.firstWait[0] + saccRand.next() * saccSpec.firstWait[1];
  let saccDX = 0;
  let saccDY = 0;
  let mood = 'calm';
  let moodFrom = 'calm';
  let moodT = 1;
  let boopT = -1;
  let boopSide = 1;
  let attend = null;
  let attendLeft = 0;
  let lookTarget = null;
  let lookX = stanceRig.lookX;
  let lookY = stanceRig.lookY;
  let lookVX = 0;
  let lookVY = 0;
  let ant = stanceRig.antenna;
  let antV = 0;
  let antTarget = ant;
  let lookGoal = [lookX, lookY];
  let px = stanceRig.x;
  let py = stanceRig.y;
  let pt = stanceRig.tilt;
  let vx = 0;
  let vy = 0;
  let vt = 0;
  let armPrevL = stanceRig.armL.angle;
  let armPrevR = stanceRig.armR.angle;
  let armVelL = 0; let armVelR = 0;
  let armOffL = 0; let armOffR = 0; let armOffVL = 0; let armOffVR = 0;
  let twOffL = 0; let twOffR = 0; let twOffVL = 0; let twOffVR = 0;
  let jig = 0;
  let jigV = 0;

  const asleep = () => st === 'sleep';
  const glances = () => ['stand', 'think', 'rest', 'sleepy', 'listen'].includes(st);
  const beats = () => st === 'listen';
  const fidgets = () => st === 'stand';
  const saccades = () => glances() || st === 'read';
  const scanning = () => st === 'loading' && holdT < loadingScanFor + 0.6;

  const springMoving = () => Math.abs(antV) > 0.004 || Math.abs(ant - antTarget) > 0.002 || Math.abs(lookVX) > 0.004 || Math.abs(lookVY) > 0.004
    || Math.abs(lookX - lookGoal[0]) > 0.002 || Math.abs(lookY - lookGoal[1]) > 0.002;
  const secondaryMoving = () => Math.abs(armOffL) > 0.002 || Math.abs(armOffR) > 0.002 || Math.abs(armOffVL) > 0.01 || Math.abs(armOffVR) > 0.01
    || Math.abs(twOffL) > 0.003 || Math.abs(twOffR) > 0.003 || Math.abs(twOffVL) > 0.015 || Math.abs(twOffVR) > 0.015
    || Math.abs(jig) > 0.0008 || Math.abs(jigV) > 0.004;

  function currentStanceRig() {
    if (!stanceFrom) return stanceRig;
    const [dur, curve] = moves.stanceBlend(st);
    const f = clampN(stanceT / dur, 0, 1);
    const r = lerpRig(stanceFrom, stanceRig, curve.transform(f));
    // An arm that swings a long way bends at the elbow on the way: its reach dips halfway.
    const el = book.spec.elbow;
    const bent = (a, start, end) => {
      const sweep = Math.abs(end.angle - start.angle);
      if (sweep < el.from) return a;
      const depth = el.depth * Math.min(1, (sweep - el.from) / el.ramp);
      return { ...a, reach: a.reach - depth * Math.sin(Math.PI * f) };
    };
    return { ...r, armL: bent(r.armL, stanceFrom.armL, stanceRig.armL), armR: bent(r.armR, stanceFrom.armR, stanceRig.armR) };
  }

  function setStance(s, force = false) {
    if (s === st && !force) return;
    stanceFrom = currentStanceRig();
    stanceT = 0;
    if (s !== st) holdT = 0;
    st = s;
    stanceRig = moves.stance(s, { pointAngle, pointSide });
  }

  function saccade(next) {
    const to = next || [stanceRig.lookX, stanceRig.lookY];
    if (Math.hypot(to[0] - lookX, to[1] - lookY) > blinkSpec.withGazeShiftOver && blinkT < 0 && !asleep()) {
      blinkT = 0;
      doubleBlink = false;
    }
  }

  function blinkShut(t) {
    if (t <= 0) return 0;
    if (t < blinkSpec.close) return ease('easeIn', t / blinkSpec.close);
    if (t < blinkSpec.close + blinkSpec.shut) return 1;
    if (t < blinkSpec.close + blinkSpec.shut + blinkSpec.open) return 1 - ease('easeOut', (t - blinkSpec.close - blinkSpec.shut) / blinkSpec.open);
    return 0;
  }

  function doIdle(h, r, quiet) {
    // Breath.
    if (breathT < 0) {
      breathWait -= h;
      if (breathWait <= 0 && !quiet && talkW === 0) {
        breathT = 0;
        const s = breathSpec.seconds;
        breathDur = st === 'sleep' ? draw(rand, s.sleep) : st === 'sleepy' ? s.sleepy[0] : st === 'rest' ? s.rest[0] : draw(rand, s.other);
      }
    }
    if (breathT >= 0) {
      breathT += h;
      const p = clampN(breathT / breathDur, 0, 1);
      const b = (1 - Math.cos(p * 2 * Math.PI)) / 2;
      const d = breathSpec.deep;
      const deep = st === 'sleep' ? d.sleep : st === 'sleepy' ? d.sleepy : d.other;
      const dozing = st === 'sleepy' || asleep();
      const sw = breathSpec.swell;
      r = {
        ...r,
        squash: r.squash + sw.squash * b * deep,
        y: r.y + sw.y * b * deep,
        armL: { ...r.armL, angle: r.armL.angle + sw.armAngle * b },
        armR: { ...r.armR, angle: r.armR.angle + sw.armAngle * b },
        antenna: asleep() ? r.antenna + sw.antennaAsleep * b : r.antenna,
        zzz: dozing ? p : r.zzz,
      };
      if (p >= 1) {
        breathT = -1;
        const rs = breathSpec.rest;
        breathWait = st === 'sleepy' || st === 'sleep' ? draw(rand, rs.sleep) : draw(rand, rs.other);
      }
    }

    // Glance: the eyes flick somewhere, hold, flick back; sometimes the weight shifts with them.
    if (glances()) {
      if (glanceT < 0) {
        glanceWait -= h;
        if (glanceWait <= 0 && !quiet && attendLeft <= 0 && lookTarget == null && talkW === 0 && fidgetT < 0) {
          glanceT = 0;
          glanceDur = draw(rand, glanceSpec.hold);
          const side = rand.bool() ? 1 : -1;
          glance = [side * draw(rand, glanceSpec.x), draw(rand, glanceSpec.y)];
          glanceLean = rand.next() < glanceSpec.leanChance ? side * glanceSpec.lean : 0;
          if (rand.next() < glanceSpec.blinkChance && blinkT < 0) { blinkT = 0; doubleBlink = false; }
          glanceWait = draw(rand, glanceSpec.gap);
        }
      }
      if (glanceT >= 0) {
        glanceT += h;
        const w = easeT(glanceT, 0, glanceSpec.in, 'easeOut') * (1 - easeT(glanceT, glanceDur, glanceDur + glanceSpec.out, 'easeOut'));
        const lean = easeT(glanceT, 0, glanceSpec.leanIn) * (1 - easeT(glanceT, glanceDur, glanceDur + glanceSpec.leanOut));
        r = { ...r, lookX: r.lookX + (glance[0] - r.lookX) * w, lookY: r.lookY + (glance[1] - r.lookY) * w, tilt: r.tilt + glanceLean * lean };
        if (glanceT >= glanceDur + glanceSpec.leanOut) glanceT = -1;
      }
    } else glanceT = -1;

    // Micro-saccades: now and then the eyes dart a hair aside (or back home).
    if (saccades() && !asleep()) {
      saccWait -= h;
      if (saccWait <= 0) {
        saccWait = saccSpec.gap[0] + saccRand.next() * saccSpec.gap[1];
        const home = saccRand.next() < saccSpec.homeChance;
        const dx = (saccRand.next() * 2 - 1) * saccSpec.x;
        const dy = (saccRand.next() * 2 - 1) * saccSpec.y;
        const free = !quiet && attendLeft <= 0 && lookTarget == null && glanceT < 0 && talkW === 0;
        saccDX = free && !home ? dx : 0;
        saccDY = free && !home ? dy : 0;
      }
    } else { saccDX = 0; saccDY = 0; }

    // Stance beats: a slow nod while listening.
    if (beats()) {
      if (beatT < 0) {
        beatWait -= h;
        if (beatWait <= 0 && !quiet && talkW === 0) beatT = 0;
      }
      if (beatT >= 0) {
        beatT += h;
        r = moves.listenNod(beatT, r);
        if (beatT >= idle.listenNodSeconds) { beatT = -1; beatWait = draw(rand, idle.listenNodGap); }
      }
    } else beatT = -1;

    // Fidgets, standing at ease only, never over an act, a line, a look or a glance.
    if (fidgets()) {
      if (fidgetT < 0) {
        fidgetWait -= h;
        if (fidgetWait <= 0) {
          if (!quiet && talkW === 0 && attendLeft <= 0 && lookTarget == null && glanceT < 0) {
            fidgetT = 0;
            fidget = fidgetRand.int(3);
            fidgetWait = draw(fidgetRand, idle.fidgetGap);
          } else fidgetWait = idle.fidgetRetry;
        }
      }
      if (fidgetT >= 0) {
        fidgetT += h;
        r = moves.fidget(fidget, fidgetT, r);
        if (fidgetT >= idle.fidgetSeconds) fidgetT = -1;
      }
    } else fidgetT = -1;

    // Micro-fidgets, under the same rules, never over a fidget.
    if (fidgets()) {
      if (microT < 0) {
        microWait -= h;
        if (microWait <= 0) {
          if (!quiet && talkW === 0 && attendLeft <= 0 && lookTarget == null && glanceT < 0 && fidgetT < 0) {
            microT = 0;
            micro = microRand.int(2);
          }
          microWait = draw(microRand, idle.microGap);
        }
      }
      if (microT >= 0) {
        microT += h;
        r = moves.micro(micro, microT, r);
        if (microT >= idle.microSeconds) microT = -1;
      }
    } else microT = -1;

    // Blink: a fast close, a short hold and a slower open; sometimes two. Never while asleep.
    if (asleep()) blinkT = -1;
    else {
      if (blinkT < 0) {
        blinkWait -= h;
        if (blinkWait <= 0) {
          blinkT = 0;
          doubleBlink = rand.next() < blinkSpec.doubleChance;
          const g = blinkSpec.gap;
          const u = rand.next();
          blinkWait = g.base + g.squaredSpread * u * u + (rand.next() < g.longStareChance ? g.longStare : 0);
        }
      }
      if (blinkT >= 0) {
        blinkT += h;
        const one = blinkSpec.close + blinkSpec.shut + blinkSpec.open;
        const gap = blinkSpec.gapBetweenDouble;
        const len = doubleBlink ? 2 * one + gap : one;
        const shutAt = (bt) => (bt <= 0 || bt >= len ? 0 : blinkShut(bt < one + gap ? bt : bt - one - gap));
        // The right eye trails the left by a few milliseconds: two eyes never move as one.
        const kL = 1 - (1 - blinkSpec.shutTo) * shutAt(blinkT);
        const kR = 1 - (1 - blinkSpec.shutTo) * shutAt(blinkT - blinkSpec.trail);
        r = { ...r, eyeL: { ...r.eyeL, open: r.eyeL.open * kL }, eyeR: { ...r.eyeR, open: r.eyeR.open * kR } };
        if (blinkT >= len + blinkSpec.trail) blinkT = -1;
      }
    }

    // Attention.
    if (attendLeft > 0) {
      attendLeft -= h;
      if (attendLeft <= 0) { attend = null; saccade(lookTarget); }
    }
    return r;
  }

  function springs(h, r) {
    // Body motion drives the antenna like a weight on a whip.
    const nvx = (r.x - px) / h;
    const nvy = (r.y - py) / h;
    const nvt = (r.tilt - pt) / h;
    const ax = (nvx - vx) / h;
    const ay = (nvy - vy) / h;
    const at = (nvt - vt) / h;
    px = r.x; py = r.y; pt = r.tilt; vx = nvx; vy = nvy; vt = nvt;

    const a = sp.antenna;
    antTarget = r.antenna;
    const torque = ax * a.fromAx + ay * a.fromAy + at * a.fromTilt;
    const acc = -a.k * (ant - antTarget) - a.c * antV + clampN(torque, -a.torqueClamp, a.torqueClamp);
    antV += acc * h;
    ant = clampN(ant + antV * h, -a.clamp, a.clamp);

    // Eyes glide to where they look: an attention look, then a held target, then the pose's gaze.
    const target = attend || lookTarget;
    lookGoal = target || [r.lookX + saccDX, r.lookY + saccDY];
    const e = sp.eyes;
    lookVX += (-e.k * (lookX - lookGoal[0]) - e.c * lookVX) * h;
    lookVY += (-e.k * (lookY - lookGoal[1]) - e.c * lookVY) * h;
    lookX += lookVX * h;
    lookY += lookVY * h;

    // Follow-through: an arm that swings and stops overshoots a little; the mitten flops behind.
    const ar = sp.arms;
    const aL = r.armL.angle;
    const aR = r.armR.angle;
    const vL = (aL - armPrevL) / h;
    const vR = (aR - armPrevR) / h;
    const accL = clampN((vL - armVelL) / h, -ar.accelClamp, ar.accelClamp);
    const accR = clampN((vR - armVelR) / h, -ar.accelClamp, ar.accelClamp);
    armPrevL = aL; armPrevR = aR; armVelL = vL; armVelR = vR;
    armOffVL += (-ar.k * armOffL - ar.c * armOffVL - ar.gain * accL) * h;
    armOffVR += (-ar.k * armOffR - ar.c * armOffVR - ar.gain * accR) * h;
    armOffL = clampN(armOffL + armOffVL * h, -ar.clamp, ar.clamp);
    armOffR = clampN(armOffR + armOffVR * h, -ar.clamp, ar.clamp);
    twOffVL += (-ar.k * twOffL - ar.c * twOffVL + ar.twistGain * accL) * h;
    twOffVR += (-ar.k * twOffR - ar.c * twOffVR + ar.twistGain * accR) * h;
    twOffL = clampN(twOffL + twOffVL * h, -ar.twistClamp, ar.twistClamp);
    twOffR = clampN(twOffR + twOffVR * h, -ar.twistClamp, ar.twistClamp);

    // The paper body jiggles after a push or a landing.
    const j = sp.jiggle;
    jigV += (-j.k * jig - j.c * jigV + j.gain * clampN(ay, -j.accelClamp, j.accelClamp)) * h;
    jig = clampN(jig + jigV * h, -j.clamp, j.clamp);

    const lean = target ? target[0] * e.leanToTarget : 0;
    return {
      ...r,
      antenna: ant,
      lookX,
      lookY,
      tilt: r.tilt + lean,
      squash: r.squash + jig,
      armL: { ...r.armL, angle: aL + armOffL, twist: r.armL.twist + twOffL },
      armR: { ...r.armR, angle: aR + armOffR, twist: r.armR.twist + twOffR },
    };
  }

  function advance(h) {
    holdT += h;
    if (stanceFrom) {
      stanceT += h;
      if (stanceT >= moves.stanceBlend(st)[0]) stanceFrom = null;
    }
    let r = currentStanceRig();

    // The mood, under everything that follows.
    if (moodT < 1) moodT = Math.min(1, moodT + h / moodBlend);
    r = moodBetween(book, moodFrom, mood, r, ease('easeInOutCubic', moodT));

    // Held stance motion: the loading scan fades in, runs, then settles.
    if (st === 'loading') {
      const w = easeT(holdT, 0.1, 0.6) * (1 - easeT(holdT, loadingScanFor, loadingScanFor + 0.6));
      if (w > 0) r = moves.loadingLoop(holdT, r, w);
    }

    // Act.
    if (act != null) {
      actT += h;
      const at = Math.min(actT, actDur);
      r = act === 'walk' ? moves.walk(at, r, actDur) : moves.act(act, at, r);
      if (actT >= actDur) act = null;
    }

    // Talk overlay, faded in and out.
    if (talkLeft > 0) talkLeft -= h;
    const talkGoal = talkLeft > 0 ? 1 : 0;
    talkW += (talkGoal - talkW) * Math.min(1, h * 9);
    if (talkW < 0.001 && talkGoal === 0) talkW = 0;
    if (talkW > 0) { talkT += h; r = moves.talk(talkT, r, talkW); }

    const quiet = act != null && !['think', 'read', 'listen', 'loading'].includes(act);
    r = doIdle(h, r, quiet);

    // A tap.
    if (boopT >= 0) {
      boopT += h;
      r = moves.boop(boopT, r, boopSide);
      if (boopT >= idle.boopSeconds) boopT = -1;
    }

    // Hand-off from an interrupted act.
    if (carry) {
      carryT += h;
      const k = ease('easeOut', clampN(carryT / idle.carrySeconds, 0, 1));
      r = lerpRig(carry, r, k);
      if (carryT >= idle.carrySeconds) carry = null;
    }
    rig = springs(h, r);
  }

  const sim = {
    moves,
    get rig() { return rig; },
    get stance() { return st; },
    get act() { return act; },
    get mood() { return mood; },
    get pointAngle() { return pointAngle; },
    get pointSide() { return pointSide; },

    /** Whether anything is moving. When false, nothing changes until `idleWait` has passed. */
    get busy() {
      return act != null || talkLeft > 0 || talkW > 0.001 || breathT >= 0 || blinkT >= 0 || glanceT >= 0 || beatT >= 0 || fidgetT >= 0
        || microT >= 0 || moodT < 1 || boopT >= 0 || attendLeft > 0 || scanning() || stanceFrom != null || carry != null
        || springMoving() || secondaryMoving();
    },

    /** Seconds until the next idle beat. */
    get idleWait() {
      let w = Math.min(breathWait, blinkWait);
      if (glances()) w = Math.min(w, glanceWait);
      if (beats()) w = Math.min(w, beatWait);
      if (fidgets()) w = Math.min(w, fidgetWait, microWait);
      if (saccades()) w = Math.min(w, saccWait);
      return Math.max(0, w);
    },

    /** Lets seconds pass while nothing is moving. */
    elapse(seconds) {
      breathWait -= seconds; blinkWait -= seconds; glanceWait -= seconds; beatWait -= seconds;
      fidgetWait -= seconds; microWait -= seconds; saccWait -= seconds; holdT += seconds;
    },

    /** Plays an act. Held acts change the stance. */
    play(name, seconds) {
      if (name === 'talk') { sim.talk(seconds ?? moves.duration('talk')); return; }
      carry = rig;
      carryT = 0;
      const next = moves.stanceAfter(name);
      if (next != null) setStance(next);
      act = name;
      actT = 0;
      actDur = seconds ?? moves.duration(name);
      breathT = -1; glanceT = -1; beatT = -1; fidgetT = -1; microT = -1;
      saccDX = 0; saccDY = 0;
    },

    /** Changes the face; it blends over the table's moodBlend (0.3 s), or at once with `instant`. */
    setMood(next, { instant = false } = {}) {
      if (instant) { mood = next; moodFrom = next; moodT = 1; return; }
      if (next === mood && moodT >= 1) return;
      moodFrom = moodT >= 0.5 ? mood : moodFrom;
      mood = next;
      moodT = 0;
    },

    talk(seconds) { talkLeft = seconds; if (talkW < 0.01) talkT = 0; },

    /** Aims the pointing arm: angle from straight down toward side (-1 left, 1 right). */
    aim(angle, side) {
      pointAngle = clampN(angle, 0.35, 2.9);
      pointSide = side < 0 ? -1 : 1;
      if (st === 'point') setStance('point', true);
    },

    /** Looks toward a target ([x, y], each -1 to 1), or back to the stance's gaze when null. */
    lookAt(target) {
      const next = target ? [clampN(target[0], -1, 1), clampN(target[1], -1, 1)] : null;
      saccade(next);
      lookTarget = next;
    },

    /** Looks at a target for a while, then back to whatever it was doing. */
    glance(target, seconds = 1.1) {
      if (asleep()) return;
      const next = [clampN(target[0], -1, 1), clampN(target[1], -1, 1)];
      saccade(next);
      attend = next;
      attendLeft = seconds;
      glanceT = -1;
    },

    /** A tap on Mobi from a side (-1 left, 1 right): a quick squash and a happy blink. */
    boop(side = 0) { boopT = 0; boopSide = clampN(side, -1, 1); blinkT = -1; },

    step(dt) {
      let left = clampN(dt, 0, 0.25);
      while (left > 1e-9) {
        const h = Math.min(left, 1 / 120);
        advance(h);
        left -= h;
      }
      return rig;
    },

    run(seconds, fps = 60) {
      let left = seconds;
      while (left > 1e-9) {
        const dt = Math.min(left, 1 / fps);
        sim.step(dt);
        left -= dt;
      }
      return rig;
    },
  };
  return sim;
}
