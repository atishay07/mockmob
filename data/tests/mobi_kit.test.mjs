import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOBI_ACTS, SPEC, resolveAct } from '../../src/components/brand/mobiActs.js';
import { actAllowed, CELEBRATION_ACTS, CELEBRATION_LEVELS } from '../../src/lib/mobiPrefs.js';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('public/brand/mascot/manifest.json'));
const css = read('src/app/motion-kit.css');
const globals = read('src/app/globals.css');

test('the published act list is exactly the app acts, each with a pose that exists', () => {
  assert.equal(MOBI_ACTS.length, 26);
  assert.deepEqual([...MOBI_ACTS].sort(), ['appear', 'brace', 'celebrate', 'cheer', 'correct', 'encourage', 'hello', 'listen', 'loading', 'nod', 'nudge', 'oops', 'point', 'proud', 'read', 'relief', 'rest', 'sleep', 'sleepy', 'startle', 'talk', 'think', 'tilt', 'wake', 'walk', 'wave']);
  for (const act of [...MOBI_ACTS, 'idle']) {
    assert.ok(SPEC[act], `${act} has a spec`);
    assert.ok(manifest[SPEC[act].pose], `${act} wears an existing pose (${SPEC[act].pose})`);
    assert.ok(SPEC[act].held || SPEC[act].ms > 0, `${act} is held or has a duration`);
  }
});

test('every act except idle has its own motion in motion-kit.css', () => {
  for (const act of MOBI_ACTS.filter((a) => !['think', 'point', 'rest'].includes(a))) assert.ok(css.includes(`[data-act='${act}']`), `${act} has CSS`);
});

test('Celebrations: Full plays as authored, Quiet turns a celebration into a nod, Off plays nothing', () => {
  assert.deepEqual([...CELEBRATION_ACTS].sort(), ['celebrate', 'cheer', 'proud']);
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
  assert.match(css, /\.mobi-react\[data-live='false'\] :is\(\.mm-spark/);
  // The held pose still shows the marks that carry information.
  assert.ok(!/\.mobi-react\[data-live='false'\][^{]*\.mm-tick/.test(css), 'the tick stays in the held pose');
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
  const profile = read('src/app/(app)/profile/ProfilePageClient.jsx');
  assert.ok(profile.includes('Saved. Your name is updated.'));
  assert.ok(profile.includes("'Saving'"));
  assert.ok(profile.includes('Open Today<svg'));
  assert.ok(profile.includes('No mocks yet'));
  assert.ok(!profile.includes('Open Today ↗'));
  assert.ok(!profile.includes('Profile updated successfully.'));
  const onboarding = read('src/app/onboarding/OnboardingPageClient.jsx');
  assert.ok(onboarding.includes("That's five. Remove one to swap."));
});
