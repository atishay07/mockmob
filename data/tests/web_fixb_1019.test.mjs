// Release 11 walk fixes (19 Oct 2026, web/1019-fixb): G26 Start sheet lead, G27 chevrons that never take a tap, G28 the lit
// build's surfaces on five pages, G29 one Sign out confirm everywhere, G31 the result count-up on the tokens and the stat
// strip stagger, and the walk's accessibility notes (focus rings, the 44 px cue).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startRows } from '../../src/components/start/startModel.mjs';
import { learningPlan } from '../learning_engine.js';
import { COUNT_UP_CURVE, COUNT_UP_SETTLE, settleStep } from '../../src/lib/motion/countUpPlan.js';
import { curves, durations } from '../../src/lib/motion/tokens.g.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const code = (js) => js.replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('G26: the Start sheet leads with the mode; the count and the subject are said once, on its key', () => {
  for (const subject of ['economics', 'accountancy']) {
    const { hero } = startRows({ plan: learningPlan({ minutes: 10 }), subjects: ['accountancy', 'economics'], subject, balance: 40 });
    assert.equal(hero.title, 'Quick practice');
    assert.doesNotMatch(hero.title, /\d/);
    assert.match(hero.cta, /^Start 10 questions in (Economics|Accountancy)$/);
    assert.doesNotMatch(hero.reason, /10 questions/, 'the line under the title does not repeat the count');
  }
  const sheet = read('src/components/start/StartSheet.jsx');
  assert.match(sheet, /<span key=\{hero\.cta\} className="st-words">\{hero\.cta\}<\/span>/, 'the key words cross-fade when a chip changes them');
});

test('G27: a chevron hint is a picture, never a target, on all four rows', () => {
  const rules = [
    ['src/app/(app)/nav-places.css', /\.arena-tabs\[data-overflow\]:not\(\[data-at-end\]\) \.arena-tabs__hint \{([^}]*)\}/],
    ['src/app/(app)/dashboard/practice.css', /\.pr-shelf\[data-overflow\]:not\(\[data-at-end\]\) \.pr-shelf__hint \{([^}]*)\}/],
    ['src/components/review/review-1018.css', /\.rv8-filter\[data-overflow\]:not\(\[data-at-end\]\) \.rv8-filter__hint \{([^}]*)\}/],
  ];
  for (const [file, re] of rules) {
    const m = strip(read(file)).match(re);
    assert.ok(m, `${file}: the shown chevron rule`);
    assert.match(m[1], /opacity: 1/, `${file}: the chevron still shows while items wait`);
    assert.match(m[1], /pointer-events: none/, `${file}: taps pass through to the cut item`);
  }
  // The Start sheet: touch gets the quiet hint, which taps pass through; the mouse keeps its two arrow discs over the clear strip.
  const start = strip(read('src/components/start/start.css'));
  const touch = start.slice(start.indexOf('@media (hover: none), (pointer: coarse) {'));
  assert.match(touch, /\.st-rail\[data-overflow\]:not\(\[data-at-end\]\) \.st-rail__arrow--next \{[^}]*pointer-events: none/);
  assert.doesNotMatch(touch.slice(0, touch.indexOf('.st-chip {')), /pointer-events: auto/);
  const tabs = read('src/components/nav/PlaceTabs.jsx');
  assert.match(tabs, /<span ref=\{hint\} className="arena-tabs__hint" aria-hidden="true">/);
  assert.doesNotMatch(tabs, /onClick=\{step\}/);
});

test('G28: the lit build surfaces are back on Today, Colleges, the result and Features; the landing light stays out (L-019)', () => {
  const today = strip(read('src/components/today/today.css')).match(/\.app-shell \.tm \{([^}]*)\}/)[1];
  assert.match(today, /border: 1px solid var\(--a-volt-line\)/);
  assert.match(today, /linear-gradient\(180deg, var\(--a-volt-wash\), transparent 70%\)/, 'the next-step card wash (deploy/1016-batch .na)');
  const compass = strip(read('src/app/(app)/admission-compass/compass.css'));
  assert.doesNotMatch(compass, /\.cmp-bridge \{[^}]*background: none/, 'the practice bridge keeps its volt wash (arena.css)');
  assert.match(compass, /section\.cpro:not\(\.cpro-quiet\)::before \{[^}]*radial-gradient\(closest-side, var\(--a-volt-wash\), transparent\)/);
  assert.match(compass, /\.cpro \.cpro-card \{[^}]*background: none/, 'no cards inside the Compass Pro card (W-076)');
  const flat = strip(read('src/components/du/du-flat.css'));
  assert.doesNotMatch(flat, /\.du-side \{/, 'the subjects pane keeps its top light and shadow (du.css)');
  assert.doesNotMatch(flat, /\.du-cta \{/, 'the closing step keeps its volt card (du.css)');
  assert.match(read('src/components/du/du.css'), /\.du-cta \{[^}]*linear-gradient\(180deg, rgba\(210, 240, 0, 0\.08\), transparent 60%\)/);
  const slots = strip(read('src/components/result/replay-slots.css'));
  assert.match(slots, /\.rs-q\[data-v='blank'\] \.rs-col i \{ background: repeating-linear-gradient\(135deg, var\(--rs-hatch\)/, 'a blank is hatched');
  assert.match(slots, /\.rs-q\[data-v='held'\] \.rs-col i \{ background: radial-gradient\(circle, var\(--rs-held-dot\)/, 'a held key is dotted');
  const features = read('src/app/features/page.js');
  assert.match(features, /className="ft-card" data-lead=/);
  assert.match(features, /\.ft-card::after \{[^}]*radial-gradient\(var\(--ft-dot\) 1px, transparent 1\.25px\)/, 'the dot texture');
  assert.doesNotMatch(code(features), /PrepOSOrb|DotPattern|glow|drop-shadow|background-clip: text/i, 'no orb, no glow, no gradient text (W-076)');
  // Kept out on purpose: the landing proof light, the Lab Cinema glow and the aurora are glows the owner rejected (L-019).
  assert.doesNotMatch(strip(read('src/app/hero-depth.css')), /\.lp-proof::before/);
  assert.doesNotMatch(strip(read('src/app/landing.css')), /lp-bg__aurora/);
});

test('G29: one Sign out confirm everywhere, a plain Sign out under the Account title, matching words, a mounted live region', () => {
  const confirm = read('src/components/profile/SignOutConfirm.jsx');
  assert.match(confirm, /<dialog ref=\{dialog\} className="so-dialog"/);
  const keys = confirm.slice(confirm.indexOf('so-dialog__keys'));
  assert.ok(keys.indexOf('SIGN_OUT_COPY.stay') < keys.indexOf('SIGN_OUT_COPY.go'), 'Stay signed in comes first');
  assert.match(confirm, /stay\.current\?\.focus\(\)/, 'and takes the focus');
  assert.match(confirm, /<p className="so-dialog__note" role="status" aria-live="polite"[^>]*>\{note\.text\}<\/p>/, 'the message line is always mounted');
  const shell = read('src/app/(app)/AppLayoutClient.jsx');
  assert.equal((shell.match(/<SignOutButton className="arena-signout/g) || []).length, 2, 'the top bar and the You sheet ask first');
  assert.doesNotMatch(shell, /await signOut\(\)/, 'nothing in the shell signs out on the first tap');
  const page = read('src/app/(app)/profile/ProfilePageClient.jsx');
  assert.ok(page.indexOf('<SignedInLine') > 0 && page.indexOf('<SignedInLine') < page.indexOf('id="account-actions"'), 'a plain Sign out near the top');
  assert.ok(page.indexOf('<SignedInLine') < page.indexOf('<YourSheet'), 'above the first card');
  const other = read('src/components/auth/SignOutOtherDevices.jsx');
  assert.match(other, />Sign out of other devices<\/h3>/);
  assert.match(other, /'Sign out of other devices'\}/, 'the key says what the heading says');
  assert.doesNotMatch(other, /\{result && \(/, 'the result line is not mounted late');
  assert.match(other, /role="status" aria-live="polite"/);
});

test('G31: the result score rolls on the countUp token and a token curve, after the page settles, and never skips', () => {
  assert.equal(durations.countUp, 720);
  assert.ok(curves[COUNT_UP_CURVE], 'the curve is a token');
  assert.equal(COUNT_UP_CURVE, 'glide');
  const hero = read('src/components/result/ResultHero.jsx');
  assert.match(hero, /useCountUp\(value, \{ from: run \? 0 : undefined, enabled: run, curve: COUNT_UP_CURVE, settle: true \}\)/);
  assert.doesNotMatch(code(hero), /requestAnimationFrame|\/ 700/, 'no private roll left');
  // The settle rule: two smooth frames in a row, or 900 ms at most.
  let s = settleStep(undefined, 0);
  assert.equal(s.ready, false);
  s = settleStep(s, 120); assert.equal(s.ready, false, 'a 120 ms frame is not smooth');
  s = settleStep(s, 136); assert.equal(s.calm, 1);
  s = settleStep(s, 152); assert.equal(s.ready, true);
  let slow = settleStep(undefined, 0);
  for (const t of [100, 300, 600, 950]) slow = settleStep(slow, t);
  assert.equal(slow.ready, true, `gives up waiting after ${COUNT_UP_SETTLE.maxWaitMs} ms`);
  const hook = read('src/lib/motion/useCountUp.js');
  assert.match(hook, /elapsed \+= settle \? Math\.min\(now - last, COUNT_UP_SETTLE\.smoothMs\) : now - last;/);
  // The stagger class is used: the stat strips rise in order, 45 ms apart, as the lit build's did.
  assert.match(read('src/components/review/ReviewChapters.jsx'), /<dl className="rv8-stats__row mk-stagger">/);
  assert.match(read('src/components/RecoveryOverview.jsx'), /<dl className="rv-figs mk-stagger"/);
  assert.match(read('src/app/motion-kit.css'), /\.mk-stagger > \* \{ animation: mk-rise var\(--mm-dur-enter\)/);
});

test('A11Y: the theme toggle and the Mob switches draw the focus ring on what is seen; the Today cue is a 44 px key', () => {
  assert.match(read('src/app/marketing-theme.css'), /\.mm-theme-toggle:focus-visible \.mm-theme-toggle__sky \{ outline: 2px solid var\(--focus-ring, #d2f000\); outline-offset: 3px; \}/);
  assert.match(read('src/components/mob/mob.css'), /\.mob-page \.ctl-toggle \.mk-switch:focus-visible::before \{ outline: 2px solid var\(--ctl-focus\); outline-offset: 3px; \}/);
  assert.match(read('src/components/ui/controls/controls.css'), /\.ctl-toggle \.mk-switch:focus-visible::before \{ outline: 2px solid/);
  const key = strip(read('src/components/today/today.css')).match(/\.app-shell \.tcue__key \{([^}]*)\}/)[1];
  assert.match(key, /min-width: 44px/);
  assert.match(key, /min-height: 44px/);
});
