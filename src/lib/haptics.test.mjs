import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { haptic, hapticPattern, mayVibrate, TOUCH_KEY } from './haptics.js';

const tokens = JSON.parse(readFileSync(new URL('../../shared/motion-tokens.json', import.meta.url), 'utf8'));

const android = { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126' };
function env({ ua = android.userAgent, visible = 'visible', touch, stored } = {}) {
  const calls = [];
  return {
    calls,
    navigator: { userAgent: ua, vibrate: (p) => { calls.push(p); return true; } },
    document: { visibilityState: visible, documentElement: { dataset: touch ? { touch } : {} } },
    storage: { getItem: (k) => (k === TOUCH_KEY ? stored ?? null : null) },
  };
}

test('every web pattern comes from the shared JSON (base haptics and verbs)', () => {
  const all = { ...tokens.haptics.base, ...tokens.haptics.verbs };
  for (const [name, entry] of Object.entries(all)) assert.deepEqual(hapticPattern(name), entry.web, name);
  assert.deepEqual(hapticPattern('tick'), [8]);
  assert.deepEqual(hapticPattern('settle'), [14]);
  assert.deepEqual(hapticPattern('open'), [22]);
  assert.deepEqual(hapticPattern('warn'), [12, 80, 12]);
  assert.deepEqual(hapticPattern('confirm'), [18]);
  assert.deepEqual(hapticPattern('segmentTick'), [8]);
  assert.deepEqual(hapticPattern('toggleOn'), [12]);
  assert.deepEqual(hapticPattern('toggleOff'), [8]);
  assert.deepEqual(hapticPattern('nope'), []);
});

test('it vibrates on Android Chrome with Touch feedback on and the page visible', () => {
  const e = env();
  assert.equal(haptic('tick', e), true);
  assert.deepEqual(e.calls, [[8]]);
});

test('it stays quiet off Android, without vibrate, hidden, or with Touch feedback off', () => {
  const ios = env({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
  assert.equal(haptic('tick', ios), false);
  assert.equal(haptic('tick', { ...env(), navigator: { userAgent: android.userAgent } }), false);
  assert.equal(haptic('tick', env({ visible: 'hidden' })), false);
  assert.equal(haptic('tick', env({ touch: 'off' })), false);
  assert.equal(haptic('tick', env({ stored: 'off' })), false);
  assert.equal(mayVibrate({}), false);
});

test('gestureStart and gestureEnd are empty patterns and never vibrate', () => {
  const e = env();
  assert.equal(haptic('gestureStart', e), false);
  assert.equal(haptic('gestureEnd', e), false);
  assert.equal(e.calls.length, 0);
});

test('a device that throws is fine', () => {
  const e = env();
  e.navigator.vibrate = () => { throw new Error('refused'); };
  assert.equal(haptic('tick', e), false);
});
