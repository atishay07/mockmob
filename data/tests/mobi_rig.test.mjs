// The web's Mobi plays the app's rig table (data/mobi_rig.v2.json). These tests hold the web twin of the
// evaluator (mobiRig.js), the sim (mobiSim.js), the drawing numbers (mobiPaint.js) and the first-frame
// attributes (mobiDom.js) to the rules written at the top of the app's mobi_rig_data.dart.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBook, createMoves, Cubic, applyMood, moodBetween, lerpRig, defaultRig } from '../../src/components/brand/mobiRig.js';
import { createSim } from '../../src/components/brand/mobiSim.js';
import { frameModel, legibility, BODY_PATH, bodyXf } from '../../src/components/brand/mobiPaint.js';
import { virtualPaint } from '../../src/components/brand/mobiDom.js';
import { poseRig } from '../../src/components/brand/mobiPose.js';
import { MOBI_ACTS, SPEC, STILL_ACTS, REACTION_ACTS } from '../../src/components/brand/mobiActs.js';

const spec = JSON.parse(readFileSync(new URL('../mobi_rig.v2.json', import.meta.url), 'utf8'));
const book = createBook(spec);
const moves = createMoves(book);
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not ${b}`);
const finite = (r, where) => {
  for (const [k, v] of Object.entries(r)) {
    if (typeof v === 'number') assert.ok(Number.isFinite(v), `${where}: ${k} is ${v}`);
    else for (const [k2, v2] of Object.entries(v)) assert.ok(Number.isFinite(v2), `${where}: ${k}.${k2} is ${v2}`);
  }
};

test('the act table the page reads matches the rig table: seconds, stance, held, still and reaction', () => {
  assert.deepEqual([...MOBI_ACTS, 'idle'].sort(), Object.keys(spec.acts).sort());
  for (const [name, row] of Object.entries(spec.acts)) {
    const web = SPEC[name];
    assert.equal(web.stance, row.stance, `${name} stance`);
    assert.equal(Boolean(web.held), Boolean(row.held), `${name} held`);
    if (!row.held || name === 'nudge') assert.equal(web.ms, Math.round(row.seconds * 1000), `${name} ms`);
  }
  const still = Object.entries(spec.acts).filter(([, r]) => r.still || r.reaction).map(([n]) => n).sort();
  assert.deepEqual([...STILL_ACTS].sort(), still);
  const reactions = Object.entries(spec.acts).filter(([, r]) => r.reaction).map(([n]) => n).sort();
  assert.deepEqual([...REACTION_ACTS].sort(), reactions);
});

test('Cubic curves follow Flutter: identity at the ends, linear is the identity, easeOutBack overshoots', () => {
  const inOut = new Cubic(spec.curves.easeInOutCubic);
  assert.equal(inOut.transform(0), 0);
  assert.equal(inOut.transform(1), 1);
  near(inOut.transform(0.5), 0.5, 0.03);
  assert.ok(inOut.transform(0.25) < 0.25 && inOut.transform(0.75) > 0.75);
  assert.equal(new Cubic(null).transform(0.37), 0.37);
  const back = new Cubic(spec.curves.easeOutBack);
  assert.ok(Math.max(...Array.from({ length: 99 }, (_, i) => back.transform((i + 1) / 100))) > 1.05, 'easeOutBack overshoots');
});

function withAct(row) {
  const s = structuredClone(spec);
  s.acts.probe = { seconds: 1, stance: null, ...row };
  return createBook(s);
}
const probe = (row, t, base = defaultRig(), params = {}) => withAct(row).act('probe').run(t, base, params);

test('expressions: ease, win, bump, hop, span, osc, curve, pow, abs, pos, sign, step, dip and the arithmetic', () => {
  const y = (e, t) => probe({ y: e }, t).y;
  assert.equal(y(['ease', 0.2, 0.6, 'linear'], 0.1), 0);
  near(y(['ease', 0.2, 0.6, 'linear'], 0.4), 0.5);
  assert.equal(y(['ease', 0.2, 0.6, 'linear'], 0.9), 1);
  near(y(['win', 0, 0.2, 0.6, 0.8, 'linear', 'linear'], 0.1), 0.5);
  near(y(['win', 0, 0.2, 0.6, 0.8, 'linear', 'linear'], 0.7), 0.5);
  near(y(['bump', 0, 1], 0.5), 1);
  assert.equal(y(['bump', 0.2, 0.4], 0.5), 0);
  near(y(['hop', 0, 1, 10], 0.5), -10);
  assert.equal(y(['hop', 0.5, 1, 10], 0.2), 0);
  assert.equal(y(['span', 0.2, 0.6], 0.1), -1);
  near(y(['span', 0.2, 0.6], 0.4), 0.5);
  near(y(['osc', 1, 0], 0.25), 1);
  near(y(['curve', 'linear', ['k', 2, ['ref', 't']]], 0.8), 1);
  near(y(['pow', -4, 0.5], 0), -2);
  assert.equal(y(['pow', 0, 2], 0), 0);
  near(y(['abs', -3], 0), 3);
  assert.equal(y(['pos', -3], 0), 0);
  assert.equal(y(['sign', -3], 0), -1);
  assert.equal(y(['sign', 0], 0), 0);
  assert.equal(y(['step', 0.1, 0.5], 0), -1);
  assert.equal(y(['step', 0.9, 0.5], 0), 1);
  near(y(['dip', 0.5], 0), 1);
  near(y(['+', 1, ['k', 2, 3], ['1-', 0.25]], 0), 7.75);
  near(y(['*', 2, 3, 4], 0), 24);
  assert.equal(y(['min', 3, 1, 2], 0), 1);
  assert.equal(y(['max', 3, 1, 2], 0), 3);
  near(y(['clamp', 9, 0, 4], 0), 4);
});

test('lets, parameters and base fields: a let reads the lets before it, w, len and side are parameters', () => {
  const run = (row, base, params) => probe(row, 0.5, base, params);
  near(run({ let: { a: 2, b: ['k', 3, ['ref', 'a']] }, y: ['ref', 'b'] }).y, 6);
  near(run({ y: ['ref', 'w'] }, defaultRig(), { w: 0.4 }).y, 0.4);
  near(run({ y: ['ref', 'len'] }, defaultRig(), { len: 7 }).y, 7);
  near(run({ y: ['ref', 'side'] }, defaultRig(), { side: -1 }).y, -1);
  near(run({ y: ['*', 2, ['base', 'lookX']] }, { ...defaultRig(), lookX: 0.25 }).y, 0.5 + 0);
  assert.throws(() => withAct({ y: ['ref', 'nope'] }), /used before it is defined/);
  assert.throws(() => withAct({ y: ['wobble', 1] }), /unknown operation/);
});

test('channels apply to + w, mul, add, max, set in that order on the base value; eyes, arms and boots too', () => {
  const base = { ...defaultRig(), y: 10 };
  near(probe({ y: { to: 0, w: 0.5, mul: 2, add: 1, max: 3 } }, 0, base).y, 11); // 10 -> 5 -> 10 -> 11 -> max(11, 3)
  near(probe({ y: { set: 4, add: 100 } }, 0, base).y, 4);
  const eyes = probe({ eyes: { open: { mul: 0.5 }, smile: 0.3 }, eyeR: { slant: 0.2 } }, 0);
  near(eyes.eyeL.open, 0.5); near(eyes.eyeR.open, 0.5);
  near(eyes.eyeL.smile, 0.3); near(eyes.eyeL.slant, 0); near(eyes.eyeR.slant, 0.2);
  const arms = probe({ arms: { to: 'up', w: 1, keep: ['reach'] }, armL: { angle: 0.1 } }, 0);
  near(arms.armR.angle, 2.45); near(arms.armL.angle, 2.55);
  near(arms.armR.reach, 1, 1e-9); // kept: not lerped to the up arm's reach
  const free = probe({ armL: { when: 'free', angle: 1 } }, 0, { ...defaultRig(), armL: { ...defaultRig().armL, front: 1 } });
  near(free.armL.angle, defaultRig().armL.angle); // a front arm is skipped
  const boots = probe({ boots: { dx: 2 }, bootL: { dx: 1 } }, 0);
  near(boots.bootR.dx, 2); near(boots.bootL.dx, 3);
});

test('every act and overlay runs to its end with finite numbers and sane effect fields', () => {
  for (const name of Object.keys(spec.acts)) {
    const dur = spec.acts[name].seconds;
    for (let t = 0; t <= dur + 0.001; t += 1 / 60) {
      const r = moves.act(name, Math.min(t, dur), moves.stance(spec.acts[name].stance || 'stand'));
      finite(r, `${name} at ${t.toFixed(2)}`);
      for (const f of ['burst', 'zzz', 'glint', 'sparkle', 'bubble']) assert.ok(r[f] === -1 || (r[f] >= 0 && r[f] <= 1), `${name} ${f} ${r[f]}`);
      for (const e of [r.eyeL, r.eyeR]) assert.ok(e.open >= -0.001 && e.open <= 1.5, `${name} eye open ${e.open}`);
    }
  }
  for (const name of Object.keys(spec.overlays)) finite(book.overlay(name).run(0.3, defaultRig(), { w: 1, len: 2 }), name);
});

test('key poses and settled poses exist for every act; a still pose has no travel and no effect in flight', () => {
  for (const name of Object.keys(spec.acts)) {
    const k = moves.keyPose(name);
    finite(k, `${name} key`);
    const s = moves.settledPose(name);
    finite(s, `${name} settled`);
    if (moves.showsStillPose(name)) {
      const base = moves.stance(moves.stanceAfter(name) ?? 'stand');
      assert.equal(s.y, base.y, `${name} does not hop in its still pose`);
      assert.equal(s.burst, -1);
      assert.equal(s.sparkle, -1);
    }
  }
});

test('stances: pointing is aimed, the weight shifts away from the finger, held stances differ from standing', () => {
  const right = moves.stance('point', { pointAngle: 1.5, pointSide: 1 });
  const left = moves.stance('point', { pointAngle: 1.5, pointSide: -1 });
  assert.equal(right.armR.point, 1);
  assert.equal(left.armL.point, 1);
  assert.ok(right.x < 0 && left.x > 0);
  near(right.armR.angle, 1.5);
  assert.ok(right.tilt > 0 && left.tilt < 0);
  for (const s of ['think', 'sleepy', 'rest', 'read', 'loading', 'sleep', 'listen']) assert.notDeepEqual(moves.stance(s), moves.stance('stand'), s);
  assert.equal(moves.stance('read').sheet, 1);
});

test('moods: calm changes nothing; each mood does what the table says; a blend sits between', () => {
  const r = moves.stance('stand');
  assert.deepEqual(applyMood(book, 'calm', r), r);
  near(applyMood(book, 'happy', r).eyeL.smile, 0.38);
  near(applyMood(book, 'concerned', r).eyeL.slant, 0.42);
  near(applyMood(book, 'focused', r).eyeR.lid, 0.26);
  near(applyMood(book, 'focused', r).glow, 0.14);
  assert.ok(applyMood(book, 'curious', r).eyeR.open > applyMood(book, 'curious', r).eyeL.open);
  near(applyMood(book, 'sleepy', r).eyeL.lid, 0.34);
  const half = moodBetween(book, 'calm', 'happy', r, 0.5);
  near(half.eyeL.smile, 0.19);
  assert.equal(moodBetween(book, 'calm', 'happy', r, 1).eyeL.smile, 0.38);
  assert.equal(lerpRig(r, r, 0), r);
});

test('the sim is deterministic per seed, differs between seeds, and comes to rest between idle beats', () => {
  const play = (seed) => { const s = createSim(book, { seed }); const out = []; for (let i = 0; i < 600; i += 1) { s.step(1 / 60); out.push(s.rig.eyeL.open.toFixed(3) + s.rig.lookX.toFixed(3)); } return out.join('|'); };
  assert.equal(play(3), play(3));
  assert.notEqual(play(3), play(4));
  const sim = createSim(book, { seed: 9 });
  let rested = 0;
  for (let i = 0; i < 60 * 30; i += 1) {
    sim.step(1 / 60);
    if (!sim.busy) { rested += 1; assert.ok(sim.idleWait >= 0); }
  }
  assert.ok(rested > 30, 'a Mobi standing at ease rests between beats, so the frame loop can stop');
});

test('a once act plays for its length, leaves the stance the table names, and never throws a rig out of range', () => {
  for (const name of MOBI_ACTS) {
    const sim = createSim(book, { seed: 5 });
    sim.play(name);
    if (name === 'talk') { sim.run(2); continue; }
    sim.run(spec.acts[name].seconds + 0.05);
    assert.equal(sim.act, null, `${name} ended`);
    assert.equal(sim.stance, spec.acts[name].stance || 'stand', `${name} stance`);
    finite(sim.rig, name);
  }
  const sim = createSim(book, { seed: 1 });
  sim.play('sleep');
  sim.run(4);
  assert.ok(sim.rig.y > 8, 'asleep he sits low');
  assert.ok(sim.rig.zzz >= -1);
});

test('mood changes blend over the table time; an instant change does not', () => {
  const a = createSim(book, { seed: 2 });
  a.setMood('happy');
  a.step(0.05);
  assert.ok(a.rig.eyeL.smile > 0 && a.rig.eyeL.smile < 0.38);
  a.run(0.5);
  near(a.rig.eyeL.smile, 0.38, 0.02);
  const b = createSim(book, { seed: 2 });
  b.setMood('happy', { instant: true });
  b.step(1 / 120);
  near(b.rig.eyeL.smile, 0.38, 0.02);
});

test('the right eye trails the left in a blink by 12 ms', () => {
  const sim = createSim(book, { seed: 11 });
  let seen = false;
  for (let i = 0; i < 60 * 12 && !seen; i += 1) {
    sim.step(1 / 240);
    if (sim.rig.eyeL.open < 0.5 && sim.rig.eyeR.open > sim.rig.eyeL.open + 0.02) seen = true;
  }
  assert.ok(seen, 'the left eye closes a moment before the right');
});

test('drawing: the face grows below 0.42 px per design unit and reads at 32 px', () => {
  assert.equal(legibility(1), 0);
  assert.equal(legibility(0.1), 1);
  assert.ok(legibility(0.3) > 0 && legibility(0.3) < 1);
  const rig = moves.stance('stand');
  const big = frameModel(rig, { px: 1 }).eyes.L.body;
  const small = frameModel(rig, { px: 32 / 168 }).eyes.L.body;
  assert.ok(small.w > big.w && small.h > big.h, 'the eye grows at small sizes');
});

test('drawing: the body outline, the body transform and the limbs have finite geometry for every key pose', () => {
  assert.ok(BODY_PATH.startsWith('M') && BODY_PATH.endsWith('Z'));
  assert.ok(!BODY_PATH.includes('NaN'));
  const xf = bodyXf(defaultRig());
  near(xf.map([71, 136])[0], 71);
  for (const name of Object.keys(spec.acts)) {
    const m = frameModel(moves.keyPose(name), { px: 1 });
    const text = JSON.stringify(m);
    assert.ok(!text.includes('NaN') && !text.includes('Infinity'), `${name} model is finite`);
    assert.equal(m.legs.L.d.startsWith('M'), true);
  }
  const sad = frameModel(applyMood(book, 'concerned', moves.stance('stand')), { px: 1 });
  assert.ok(sad.eyes.L.body.clipLid, 'a sloped lid clips the eye');
  const shut = frameModel({ ...moves.stance('stand'), eyeL: { open: 0, happy: 0, lid: 0, smile: 0, slant: 0 } }, { px: 1 });
  assert.ok(shut.eyes.L.lid, 'a shut eye is a lid line');
  const happy = frameModel({ ...moves.stance('stand'), eyeL: { open: 1, happy: 1, lid: 0, smile: 0, slant: 0 } }, { px: 1 });
  assert.ok(happy.eyes.L.arc, 'a happy eye is a smiling arc');
});

test('drawing: effects appear only inside their progress', () => {
  const base = moves.stance('stand');
  assert.ok(frameModel(base).burst.every((p) => p === null));
  const party = frameModel({ ...base, burst: 0.55, sparkle: 0.3, bubble: 0.5, glint: 0.5, zzz: 0.3 });
  assert.ok(party.burst.some(Boolean) && party.sparkle.some(Boolean) && party.bubble && party.glint && party.zzz[0]);
  assert.ok(party.land.some(Boolean), 'celebrate sends rings along the floor');
  assert.equal(frameModel({ ...base, bubble: 1.2 }).bubble, null);
});

test('server render: the first frame is real attributes, and Night and Day share one markup', () => {
  const bags = virtualPaint(poseRig(moves, book, 'hello', 'happy', { live: false }), { px: 1, prefix: 'x-' });
  assert.ok(bags.bodyFront.transform.startsWith('translate('));
  assert.ok(bags.arcL.d && bags.armLBack_h0.d, 'smiling eyes and an arm are placed');
  assert.equal(bags.piece0.display, 'none', 'no confetti in a still pose');
  assert.equal(bags.sheet.display, 'none');
  const reading = virtualPaint(poseRig(moves, book, 'read', 'calm', { live: false }), { px: 1, prefix: 'x-' });
  assert.ok(!reading.sheet.display, 'the answer sheet shows while reading');
  assert.ok(reading.sheet.transform);
  const css = readFileSync(new URL('../../src/components/brand/mobi-figure.css', import.meta.url), 'utf8');
  for (const v of ['--mb-limb', '--mb-rim', '--mb-shadow', '--mb-zzz', '--mb-bubble-edge']) assert.ok(css.split(v).length >= 3, `${v} is set for Night and Day`);
});

test('poseRig: a held act starts from its stance, a once act from standing; a still pose is the settled pose', () => {
  near(poseRig(moves, book, 'think', 'calm', { live: true }).lookY, moves.stance('think').lookY);
  near(poseRig(moves, book, 'cheer', 'calm', { live: true }).y, moves.stance('stand').y);
  near(poseRig(moves, book, 'cheer', 'calm', { live: false }).armL.angle, moves.settledPose('cheer').armL.angle);
  assert.equal(poseRig(moves, book, 'nonsense', 'calm', { live: false }).burst, -1);
});
