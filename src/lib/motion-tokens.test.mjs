// One motion language for the app and the website (feature wave 1, M1 web half).
// Run: node --test src/lib/motion-tokens.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  CSS_PATH, END_MARK, ROOT, START_MARK, TOKENS_PATH, currentBlock, generate, kebab, readTokens, replaceBlock, transitionProperty,
} from './motion-tokens.mjs';
import { linearStops, pressLift, reverseCubic, springPosition, springSettleMs, springState } from './motion/spring.js';
import * as G from './motion/tokens.g.js';
import { SWAP, incomingOpacity, incomingTransform, outgoingDrift, outgoingKeyframes, outgoingOpacity, releaseMs, swapSpec } from './motion/swap.js';
import { PLACE_ORDER, VIEW_TRANSITION_PROPS, VT, isTestPath, transitionFor, transitionTypesFor } from './motion/placeTransition.js';
import { NUMBER_MEMORY_CAPACITY, clearNumberMemory, inkFor, numberDirection, numberMemorySize, recallNumber, rememberNumber } from './motion/numberMemory.js';
import { DRAG, claims, commits, follow, pressScaleFor, releaseVelocity, yields } from './motion/dragPolicy.js';
import { scrubIndex, scrubKeyIndex, scrubX } from './motion/scrub.js';

const lf = (text) => text.replace(/\r\n/g, '\n');
const tokens = readTokens();
const css = lf(readFileSync(CSS_PATH, 'utf8'));
const block = currentBlock(css);

/** Every custom property declared in the generated block's first :root (not the @supports fallback). */
function declared() {
  const main = block.slice(0, block.indexOf('@supports'));
  const out = new Map();
  for (const m of main.matchAll(/(--mm-[a-z0-9-]+):\s*([^;]+);/g)) out.set(m[1], m[2].trim());
  return out;
}
const vars = declared();

// The app's springs (Flutter SpringDescription.withDurationAndBounce, run until done at the 1e-3
// tolerance): the peak each reaches and how long the controller runs, as the M1 app builder measured.
const SPRING_TABLE = {
  smooth: [1.003, 662], snappy: [1.0, 449], dock: [1.0111, 609], settle: [1.0, 809], release: [1.0015, 566],
  edgeLead: [1.003, 488], edgeTrail: [1.0, 706], iconPop: [1.0111, 707], celebrate: [1.0199, 1047], toggle: [1.005, 440], lift: [1.0, 596],
};

test('the shared JSON is byte for byte the app\'s copy (LF), so app and web read one source', () => {
  const bytes = lf(readFileSync(TOKENS_PATH, 'utf8'));
  const sha = createHash('sha256').update(bytes, 'utf8').digest('hex');
  assert.equal(sha, '6aca08535cf448f711d09521a2bdc75013312776fede46763b45e32c4ac6a957',
    'shared/motion-tokens.json changed: change the app\'s copy in the same commit (they must stay identical), then update this hash');
  assert.equal(Buffer.byteLength(bytes), 4183);
  // When the app lives in the same checkout, its copy is this file.
  const appTokens = path.join(ROOT, 'flutter_app', '..', 'shared', 'motion-tokens.json');
  if (existsSync(path.join(ROOT, 'flutter_app'))) assert.equal(lf(readFileSync(appTokens, 'utf8')), bytes);
});

test('motion-kit.css and tokens.g.js are up to date with the JSON (the generator\'s --check)', () => {
  const { stale } = generate({ check: true });
  assert.deepEqual(stale, [], `run node scripts/gen-motion-tokens.mjs (stale: ${stale.join(', ')})`);
  assert.ok(block.startsWith(START_MARK) && block.endsWith(END_MARK));
  assert.ok(css.indexOf(START_MARK) < css.indexOf('.mk-press'), 'the token block sits at the top of motion-kit.css');
});

test('the generated block equals the JSON: durations, curves, numbers, counts and transitions', () => {
  for (const [k, v] of Object.entries(tokens.durations)) assert.equal(vars.get(`--mm-dur-${kebab(k)}`), `${v}ms`, k);
  for (const [k, v] of Object.entries(tokens.curves)) assert.equal(vars.get(`--mm-ease-${kebab(k)}`), `cubic-bezier(${v.join(', ')})`, k);
  for (const [k, v] of Object.entries(tokens.curves)) assert.equal(vars.get(`--mm-ease-${kebab(k)}-reverse`), `cubic-bezier(${reverseCubic(v).join(', ')})`, k);
  const px = new Set(['enterRise', 'axisTravel']);
  for (const [k, v] of Object.entries(tokens.numbers)) assert.equal(vars.get(`--mm-${kebab(k)}`), px.has(k) ? `${v}px` : String(v), k);
  for (const [k, v] of Object.entries(tokens.counts)) assert.equal(vars.get(`--mm-${kebab(k)}`), String(v), k);
  let n = 0;
  for (const [group, values] of Object.entries(tokens.transitions)) {
    for (const [key, v] of Object.entries(values)) {
      const [prop, value] = transitionProperty(group, key, v);
      assert.equal(vars.get(prop), value, `${group}.${key}`);
      n += 1;
    }
  }
  assert.equal(n, Object.values(tokens.transitions).reduce((a, g) => a + Object.keys(g).length, 0));
  assert.ok(n >= 30);
  // The handoff's examples, spelled out.
  assert.equal(vars.get('--mm-dur-glide'), '300ms');
  assert.equal(vars.get('--mm-dur-reduced-fade'), '120ms');
  assert.equal(vars.get('--mm-ease-in-out'), 'cubic-bezier(0.77, 0, 0.175, 1)');
  assert.equal(vars.get('--mm-pressed-scale'), '0.96');
  assert.equal(vars.get('--mm-enter-rise'), '14px');
  assert.equal(vars.get('--mm-t-push-in-dur'), '300ms');
  assert.equal(vars.get('--mm-t-place-out-curve'), 'var(--mm-ease-exit)');
  assert.equal(vars.get('--mm-t-sheet-recede-drop'), '6px');
  assert.equal(vars.get('--mm-t-rise-from-scale'), '0.97');
});

test('the JS tokens equal the JSON', () => {
  assert.equal(G.MOTION_TOKENS_VERSION, tokens.version);
  assert.deepEqual({ ...G.durations }, tokens.durations);
  assert.deepEqual(Object.fromEntries(Object.entries(G.curves).map(([k, v]) => [k, [...v]])), tokens.curves);
  assert.deepEqual({ ...G.numbers }, tokens.numbers);
  assert.deepEqual({ ...G.counts }, tokens.counts);
  assert.deepEqual(Object.fromEntries(Object.entries(G.transitions).map(([k, v]) => [k, { ...v }])), tokens.transitions);
  for (const [k, v] of Object.entries(tokens.springs)) {
    assert.equal(G.springs[k].ms, v.ms);
    assert.equal(G.springs[k].bounce, v.bounce);
    assert.equal(G.springs[k].easing, vars.get(`--mm-spring-${kebab(k)}`));
    assert.equal(`${G.springs[k].settleMs}ms`, vars.get(`--mm-spring-${kebab(k)}-dur`));
  }
});

test('every spring is the app\'s physics: linear() from 0 to exactly 1, its peak and its settle time', () => {
  assert.deepEqual(Object.keys(SPRING_TABLE).sort(), Object.keys(tokens.springs).sort());
  for (const [name, [peak, settle]] of Object.entries(SPRING_TABLE)) {
    const stops = linearStops(vars.get(`--mm-spring-${kebab(name)}`));
    assert.ok(stops.length >= 40, `${name} has ${stops.length} stops`);
    assert.equal(stops[0], 0, name);
    assert.equal(stops[stops.length - 1], 1, `${name} ends at 1`);
    const top = Math.max(...stops);
    assert.ok(Math.abs(top - peak) <= 0.001, `${name} peaks at ${top}, the app at ${peak}`);
    assert.equal(vars.get(`--mm-spring-${kebab(name)}-dur`), `${settle}ms`, `${name} runs ${settle} ms`);
    assert.equal(springSettleMs(tokens.springs[name]), settle);
  }
  // The fallback for browsers without linear(): the out curve over the nominal time.
  const fallback = block.slice(block.indexOf('@supports not (transition-timing-function: linear(0, 1))'));
  for (const [name, s] of Object.entries(tokens.springs)) {
    assert.match(fallback, new RegExp(`--mm-spring-${kebab(name)}: var\\(--mm-ease-out\\);`));
    assert.match(fallback, new RegExp(`--mm-spring-${kebab(name)}-dur: ${s.ms}ms;`));
  }
});

test('the spring solver matches Flutter at the edges: start, speed, critical damping', () => {
  const smooth = tokens.springs.smooth;
  const a = springState(smooth, 0, 100, 900, 0);
  assert.ok(Math.abs(a.x) < 1e-9 && Math.abs(a.v - 900) < 1e-6);
  assert.ok(Math.abs(springPosition(tokens.springs.snappy, 2) - 1) < 1e-6);
  // Critically damped (bounce 0) never overshoots.
  for (let t = 0; t <= 1; t += 0.005) assert.ok(springPosition(tokens.springs.lift, t) <= 1 + 1e-12);
});

test('a committed press lets go with the app\'s lift: up past rest to about 1.03, then home', () => {
  const lift = pressLift({ pressedScale: 0.96, snappy: tokens.springs.snappy, release: tokens.springs.release });
  assert.equal(lift.peak, 1.03);
  assert.ok(lift.turnMs > 0 && lift.turnMs <= 180);
  const stops = linearStops(vars.get('--mm-press-lift'));
  assert.equal(stops[0], 0);
  assert.equal(stops[stops.length - 1], 1);
  const peakScale = 0.96 + 0.04 * Math.max(...stops);
  assert.ok(peakScale > 1.029 && peakScale < 1.035, `peaks at ${peakScale}`);
  assert.equal(vars.get('--mm-press-lift-dur'), `${G.pressLift.durationMs}ms`);
  assert.ok(Math.abs(pressScaleFor(56) - 0.96) < 1e-9 && Math.abs(pressScaleFor(340) - (1 - 8 / 340)) < 1e-9);
});

test('motion-kit.css adopts the app\'s values and drops the 1.56 overshoot', () => {
  assert.ok(!css.includes('1.56'), 'no cubic-bezier(0.34, 1.56, 0.64, 1) left in motion-kit.css');
  const rule = (selector) => {
    const at = css.indexOf(`${selector} {`);
    assert.ok(at >= 0, `${selector} is styled`);
    return css.slice(at, css.indexOf('}', at));
  };
  assert.match(rule('.mk-press'), /transform var\(--mm-press-lift-dur\) var\(--mm-press-lift\)/);
  assert.match(rule('.mk-press:active:not(:disabled):not([aria-disabled=\'true\'])'), /scale\(var\(--mk-press-scale, var\(--mm-pressed-scale\)\)\)/);
  assert.match(css, /--mk-spring: var\(--mm-spring-release\);/);
  assert.match(css, /--mk-settle: var\(--mm-ease-out\);/);
  assert.match(css, /@keyframes mk-pop \{ from \{ transform: scale\(var\(--mm-enter-scale\)\); opacity: 0; \}/);
  assert.match(css, /@keyframes mk-rise \{ from \{ transform: translate3d\(0, var\(--mm-enter-rise\), 0\); opacity: 0; \}/);
  assert.match(css, /\.mk-pop \{ animation: mk-pop var\(--mm-dur-enter\) var\(--mm-ease-emphasized\)/);
  assert.match(css, /calc\(min\(var\(--i, 0\), var\(--mm-stagger-cap\)\) \* var\(--mm-dur-stagger-step\)\)/);
  assert.match(css, /\.mk-swipe\[data-swipe='settle'\] \{ transition: transform var\(--mm-spring-smooth-dur\) var\(--mm-spring-smooth\); \}/);
  assert.match(css, /\.mk-swipe\[data-swipe='commit'\] \{ transition: transform var\(--mm-dur-leave\) var\(--mm-ease-leave\)/);
  assert.match(css, /transform var\(--mm-spring-toggle-dur\) var\(--mm-spring-toggle\)/);
  // Mobi keeps his life on the celebrate spring; nothing else of his uses the kit's press spring.
  assert.match(css, /--mr-spring: var\(--mm-spring-celebrate\);/);
  const mobi = css.slice(css.indexOf('MOBI REACT'), css.indexOf('Theme tiles'));
  assert.ok(!mobi.includes('var(--mk-spring)'));
  // Remembered numbers: rise and fall tints for Night and Day.
  assert.match(css, /--mk-ink-rise: #d2f000;/);
  assert.match(css, /--mk-ink-fall: #a09989;/);
  assert.match(css, /html\[data-theme='light'\] \{\n {2}--mk-ink-rise: #526700;\n {2}--mk-ink-fall: #655f53;/);
});

test('nav-motion.css drops its 1.56 fallbacks too', () => {
  const nav = readFileSync(path.join(ROOT, 'src', 'app', 'nav-motion.css'), 'utf8');
  assert.ok(!nav.includes('1.56'));
});

test('reduced motion: the kit\'s arrivals become a 120 ms fade, and page transitions a 120 ms cross-fade', () => {
  assert.match(css, /:root\[data-motion='reduced'\] :is\(\.mk-pop, \.mk-rise, \.mk-stagger > \*\) \{\n {2}animation: mk-fade var\(--mm-dur-reduced-fade\) linear backwards !important;/);
  for (const name of Object.values(VT)) {
    assert.ok(css.includes(`:root[data-motion='reduced']::view-transition-old(.${name})`), name);
    assert.ok(css.includes(`:root[data-motion='reduced']::view-transition-new(.${name})`), name);
  }
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\n {2}:is\(\.mk-pop, \.mk-rise, \.mk-stagger > \*\)/);
});

test('page transitions: every class is drawn, with the app\'s place, push and rise values', () => {
  for (const name of Object.values(VT)) {
    assert.ok(css.includes(`::view-transition-old(.${name})`), `${name} old`);
    assert.ok(css.includes(`::view-transition-new(.${name})`), `${name} new`);
  }
  // Place switch: 90 + 200 ms; the old page goes over (90/290 + 0.1) of it, the new starts at 0.22.
  const t = tokens.transitions.place;
  const total = t.outMs + t.inMs;
  assert.equal(total, 290);
  assert.equal(Math.round(t.outMs + t.outTail * total), 119);
  assert.equal(Math.round(t.overlapStart * total), 64);
  assert.match(css, /calc\(var\(--mm-t-place-out-dur\) \+ var\(--mm-t-place-out-tail\) \* \(var\(--mm-t-place-out-dur\) \+ var\(--mm-t-place-in-dur\)\)\)/);
  assert.match(css, /calc\(var\(--mm-t-place-overlap-start\) \* \(var\(--mm-t-place-out-dur\) \+ var\(--mm-t-place-in-dur\)\)\) both/);
  // The page under a push recedes 22 percent of the travel and dims to 0.55.
  assert.match(css, /@keyframes mm-vt-recede \{ to \{ translate: calc\(var\(--mm-t-push-travel\) \* var\(--mm-t-push-recede-share\) \* -1\) 0; opacity: calc\(1 - var\(--mm-t-push-recede-scrim\)\); \} \}/);
  assert.equal(VIEW_TRANSITION_PROPS.default, 'none');
  for (const key of ['enter', 'exit', 'update']) {
    assert.equal(VIEW_TRANSITION_PROPS[key].default, 'none');
    for (const name of Object.values(VT)) assert.equal(VIEW_TRANSITION_PROPS[key][name], name);
  }
});

test('no view transition is ever applied under /test (the NTA runner)', () => {
  for (const [from, to] of [['/today', '/test/abc'], ['/test/abc', '/result/abc'], ['/test', '/today'], ['/review', '/test/abc?mode=nta'], ['https://mockmob.in/test/x', '/today']]) {
    assert.equal(transitionFor(from, to), null, `${from} to ${to}`);
    assert.deepEqual(transitionTypesFor(from, to), []);
  }
  assert.ok(isTestPath('/test') && isTestPath('/test/123#q4') && !isTestPath('/tests') && !isTestPath('/testing'));
});

test('places fade through toward the side they lie; drill-ins push and pop; results rise', () => {
  assert.deepEqual(Object.keys(PLACE_ORDER), ['today', 'dashboard', 'learn', 'review', 'profile']);
  assert.equal(transitionFor('/today', '/dashboard'), VT.placeFwd);
  assert.equal(transitionFor('/review', '/today'), VT.placeBack);
  assert.equal(transitionFor('/profile', '/review'), VT.placeBack);
  assert.equal(transitionFor('/dashboard', '/learn'), VT.placeFwd);
  assert.equal(transitionFor('/review/mistakes/42', '/today'), VT.placeBack);
  assert.equal(transitionFor('/review', '/review/mistakes'), VT.push);
  assert.equal(transitionFor('/review/mistakes', '/review'), VT.pop);
  assert.equal(transitionFor('/today', '/result/9'), VT.rise);
  assert.equal(transitionFor('/result/9', '/review'), VT.riseBack);
  assert.equal(transitionFor('/analytics', '/leaderboard'), VT.fade);
  assert.equal(transitionFor('/today', '/today?tab=2'), null);
});

test('the swap overlap: the old layer holds until the new is half there, and the two never sum under 0.7', () => {
  assert.equal(SWAP.release, 0.5);
  assert.equal(SWAP.floor, 0.7);
  for (const variant of ['fade', 'rise', 'axis']) {
    for (const held of [1, 0.8, 0.4]) {
      const spec = swapSpec(variant);
      const at = releaseMs(spec);
      assert.ok(Math.abs(incomingOpacity(at / spec.inMs) - 0.5) < 1e-3);
      const { keyframes, durationMs } = outgoingKeyframes(spec, { opacity: held });
      for (const k of keyframes) {
        const ms = k.offset * durationMs;
        const incoming = incomingOpacity(ms / spec.inMs);
        assert.ok(k.opacity <= held + 1e-9, 'never above where it held');
        if (held === 1) assert.ok(k.opacity + incoming >= 0.7 - 1e-3, `${variant}: sum ${k.opacity + incoming} at ${ms} ms`);
        if (ms < at - 1e-6) assert.equal(k.opacity, held);
      }
      assert.equal(keyframes[keyframes.length - 1].opacity, 0);
    }
  }
  assert.ok(Math.abs(outgoingOpacity(0, 0.5, 1) - 0.2) < 1e-9);
  assert.equal(outgoingOpacity(0.9, 0.5, 1), 0.9);
  const fade = swapSpec('fade');
  assert.deepEqual([fade.inMs, fade.outMs], [210, 90]);
  const rise = swapSpec('rise');
  assert.equal(rise.inMs, 360);
  assert.deepEqual(incomingTransform(rise, 0), { x: 0, y: 14, scale: 0.97 });
  assert.deepEqual(incomingTransform(rise, 1), { x: 0, y: 0, scale: 1 });
  const axis = swapSpec('axis', { dir: -1 });
  assert.equal(axis.inMs, 300);
  assert.equal(incomingTransform(axis, 0).x, -28);
  assert.ok(Math.abs(outgoingDrift(axis, 1) - 6.16) < 1e-9);
  assert.equal(swapSpec('axis', { travel: 24 }).travel, 24);
  const reduced = swapSpec('axis', { reduced: true });
  assert.deepEqual([reduced.kind, reduced.inMs, reduced.travel], ['fade', 120, 0]);
});

test('number memory: in memory only, 256 keys, oldest first out, direction from the digits', () => {
  clearNumberMemory();
  for (let i = 0; i < NUMBER_MEMORY_CAPACITY + 10; i += 1) rememberNumber(`k${i}`, i);
  assert.equal(numberMemorySize(), NUMBER_MEMORY_CAPACITY);
  assert.equal(recallNumber('k0'), undefined);
  assert.equal(recallNumber('k265'), 265);
  rememberNumber('k10', 99); // touching a key makes it the newest
  rememberNumber('extra', 1);
  assert.equal(recallNumber('k10'), 99);
  assert.equal(recallNumber('k11'), undefined);
  assert.equal(numberDirection(36, 41), 1);
  assert.equal(numberDirection('4 min 30 s', '4 min 12 s'), -1);
  assert.equal(numberDirection('1,240', '1,240'), 0);
  assert.equal(numberDirection(undefined, 3), 0);
  assert.equal(numberDirection('-', '5'), 0);
  assert.deepEqual([inkFor(1), inkFor(-1), inkFor(0)], ['rise', 'fall', null]);
  clearNumberMemory();
  assert.equal(numberMemorySize(), 0);
});

test('the drag policy is the app\'s: claim, yield, follow, commit and release speed', () => {
  assert.equal(DRAG.claimRatio, 2.2);
  assert.ok(claims(30, 10) && !claims(30, 14) && !claims(10, 0) && claims(3, 0, { slop: 2 }));
  assert.ok(yields(10, 30) && !yields(30, 5));
  assert.equal(follow(100, { maxTravel: 300 }), 100);
  assert.equal(follow(-100, { left: false, maxTravel: 300 }), -35);
  assert.equal(follow(400, { maxTravel: 300 }), 300 + 100 * 0.35);
  assert.equal(commits(120, 0, { distance: 100 }), 'right');
  assert.equal(commits(60, 0, { distance: 100 }), null);
  assert.equal(commits(20, 800, { distance: 100 }), 'right');
  assert.equal(commits(120, -800, { distance: 100 }), null, 'a fling against the offset never commits');
  assert.equal(commits(-120, 0, { distance: 100, left: false }), null);
  const samples = Array.from({ length: 6 }, (_, i) => ({ t: i * 16, x: i * 16 }));
  assert.ok(Math.abs(releaseVelocity(samples) - 1000) < 1e-6);
  assert.equal(releaseVelocity(samples, 80 + 41), 0, 'a pointer that stopped before letting go has no speed');
});

test('scrub arithmetic is the app\'s', () => {
  assert.equal(scrubIndex(0, 300, 5), 0);
  assert.equal(scrubIndex(300, 300, 5), 4);
  assert.equal(scrubIndex(110, 300, 5), 1);
  assert.equal(scrubIndex(-20, 300, 5), 0);
  assert.equal(scrubIndex(50, 300, 0), -1);
  assert.equal(scrubIndex(50, 300, 1), 0);
  assert.equal(scrubX(2, 300, 5), 150);
  assert.equal(scrubX(0, 300, 1), 150);
  assert.equal(scrubKeyIndex('ArrowRight', 3, 5), 4);
  assert.equal(scrubKeyIndex('ArrowRight', 4, 5), 4);
  assert.equal(scrubKeyIndex('Home', 3, 5), 0);
  assert.equal(scrubKeyIndex('End', -1, 5), 4);
  assert.equal(scrubKeyIndex('ArrowLeft', -1, 5), 3, 'with nothing picked, the arrows start from the latest point');
  assert.equal(scrubKeyIndex('a', 1, 5), null);
});

test('replaceBlock keeps the file\'s line endings and touches nothing outside the markers', () => {
  const crlf = 'a {\r\n}\r\n/* motion-tokens:start (x) */\r\nold\r\n/* motion-tokens:end */\r\nb {}\r\n';
  const next = replaceBlock(crlf, `${START_MARK}\nnew\n${END_MARK}`);
  assert.equal(next, `a {\r\n}\r\n${START_MARK}\r\nnew\r\n${END_MARK}\r\nb {}\r\n`);
  const fresh = replaceBlock('/* head */\n:root { --x: 1; }\n', `${START_MARK}\n${END_MARK}`);
  assert.ok(fresh.startsWith(`/* head */\n${START_MARK}\n${END_MARK}\n\n:root`));
});
