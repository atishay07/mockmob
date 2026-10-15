import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOBI_ACTS, SPEC, resolveAct } from '../../src/components/brand/mobiActs.js';
import { actAllowed, CELEBRATION_ACTS, CELEBRATION_LEVELS } from '../../src/lib/mobiPrefs.js';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const rigJson = JSON.parse(read('data/mobi_rig.v2.json'));
const css = read('src/components/brand/mobi-figure.css');
const globals = read('src/app/globals.css');

test('the published act list is exactly the app acts, each one a program in the rig table', () => {
  assert.equal(MOBI_ACTS.length, 31);
  assert.deepEqual([...MOBI_ACTS].sort(), ['appear', 'brace', 'celebrate', 'cheer', 'correct', 'curious', 'encourage', 'focus', 'hello', 'hop', 'idea', 'listen', 'loading', 'nod', 'nudge', 'oops', 'point', 'proud', 'read', 'relief', 'rest', 'sleep', 'sleepy', 'startle', 'sympathy', 'talk', 'think', 'tilt', 'wake', 'walk', 'wave']);
  for (const act of [...MOBI_ACTS, 'idle']) {
    assert.ok(SPEC[act], `${act} has a spec`);
    assert.ok(rigJson.acts[act], `${act} is in the rig table`);
    assert.ok(SPEC[act].held || SPEC[act].ms > 0, `${act} is held or has a duration`);
  }
});

test('Mobi is drawn by the rig: acts are not CSS animations, MobiReact draws no raster, and the old marks are gone', () => {
  const motionKit = read('src/app/motion-kit.css');
  assert.ok(!motionKit.includes('mobi-react__body') && !motionKit.includes('mr-cheer-body') && !motionKit.includes('.mm-tick'), 'the old raster animations are removed');
  assert.ok(!css.includes("[data-act="), 'acts are not CSS animations any more');
  const react = read('src/components/brand/MobiReact.jsx');
  assert.ok(!react.includes("from './Mascot'"), 'MobiReact no longer draws the raster art');
  assert.ok(react.includes("from './MobiFigure'"));
});

test('Celebrations: Full plays as authored, Quiet turns a celebration into a nod, Off plays nothing', () => {
  assert.deepEqual([...CELEBRATION_ACTS].sort(), ['celebrate', 'cheer', 'hop', 'proud']);
  assert.deepEqual(CELEBRATION_LEVELS, ['full', 'quiet', 'off']);
  for (const act of CELEBRATION_ACTS) {
    assert.equal(resolveAct(act, { celebrations: 'full' }).act, act);
    assert.deepEqual(resolveAct(act, { celebrations: 'quiet' }), { act: 'nod', live: true });
    assert.deepEqual(resolveAct(act, { celebrations: 'off' }), { act: 'idle', live: false });
    assert.equal(actAllowed(act, 'full'), true);
    assert.equal(actAllowed(act, 'quiet'), false);
    assert.equal(actAllowed(act, 'off'), false);
  }
  // Acts that are not celebrations are never held back by the setting.
  for (const act of MOBI_ACTS.filter((a) => !CELEBRATION_ACTS.includes(a))) {
    assert.equal(actAllowed(act, 'off'), true);
    assert.equal(resolveAct(act, { celebrations: 'off' }).act, act);
  }
});

test('Reduce motion and still hold the pose; the act is still the one asked for', () => {
  assert.deepEqual(resolveAct('correct', { reduced: true }), { act: 'correct', live: false });
  // An act that is only motion (a shrug) leaves him in his stance, as the app does.
  assert.deepEqual(resolveAct('oops', { reduced: true }), { act: 'idle', live: false });
  assert.deepEqual(resolveAct('think', { still: true }), { act: 'think', live: false });
  assert.deepEqual(resolveAct('think', {}), { act: 'think', live: true });
  // Quiet plus Reduce motion: a nod, held, nothing moving.
  assert.deepEqual(resolveAct('celebrate', { celebrations: 'quiet', reduced: true }), { act: 'nod', live: false });
  // An act the kit does not know stands at ease instead of throwing.
  assert.equal(resolveAct('dance').act, 'idle');
});

test('one data-motion=reduced block calms the site, and it keeps Mobi still and skeletons static', () => {
  assert.match(globals, /@import "\.\/motion-kit\.css";/);
  assert.match(globals, /:root\[data-motion='reduced'\] \*,/);
  assert.match(globals, /:root\[data-motion='reduced'\] \.skeleton::after \{ animation: none !important; \}/);
  // Mobi has no CSS animation to switch off: under Reduce motion MobiReact runs no frame loop and draws his still pose.
  const react = read('src/components/brand/MobiReact.jsx');
  assert.ok(react.includes('if (resolved.live) return;'), 'a still Mobi runs no sim');
  assert.ok(!css.includes('animation:'), 'mobi-figure.css animates nothing');
});

test('the Look and feel card uses the app words', () => {
  const card = read('src/app/(app)/profile/LookAndFeelCard.jsx');
  for (const text of ['Appearance and feel', 'Night', 'Warm charcoal', 'Daylight', 'Warm paper', 'Match device', 'Follows your device', 'Reduce motion',
    'Keeps screens still. It follows your device unless you turn it on here.', 'Celebrations', 'Full', 'Quiet', 'Off',
    'A short moment when a repair or a week is finished.', 'A small nod, and the words.', 'Nothing is shown.']) {
    assert.ok(card.includes(text), `card says: ${text}`);
  }
});

test('profile and onboarding copy', () => {
  // Account's sheet (your mocks at a glance, Open Today) lives in its own component since the You port.
  const profile = read('src/app/(app)/profile/ProfilePageClient.jsx') + read('src/components/profile/YourSheet.jsx');
  assert.ok(profile.includes('Saved. Your name is updated.'));
  assert.ok(profile.includes("'Saving'"));
  assert.ok(/Open Today<(svg|ChevronRight)/.test(profile), 'Open Today carries a real icon, not an arrow glyph');
  assert.ok(profile.includes('No mocks yet'));
  assert.ok(!profile.includes('Open Today ↗'));
  assert.ok(!profile.includes('Profile updated successfully.'));
  const onboarding = read('src/app/onboarding/OnboardingPageClient.jsx');
  assert.ok(onboarding.includes("That's five. Remove one to swap."));
});
