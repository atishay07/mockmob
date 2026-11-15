import test from 'node:test';
import assert from 'node:assert/strict';
import { GSI_SRC, makeNonce, oneTapConfig, oneTapEnabled, sha256Hex } from './oneTap.mjs';

const CHROME = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const INSTAGRAM = 'Mozilla/5.0 (Linux; Android 13; SM-A515F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0 Mobile Safari/537.36 Instagram 309.0.0.40.113 Android';

test('O7: One Tap mounts only with a client id, outside in-app browsers, for a signed-out visitor', () => {
  assert.equal(oneTapEnabled({ clientId: '123.apps.googleusercontent.com', ua: CHROME, status: 'unauthenticated' }), true);
  assert.equal(oneTapEnabled({ clientId: '', ua: CHROME, status: 'unauthenticated' }), false, 'the switch is off today');
  assert.equal(oneTapEnabled({ clientId: '   ', ua: CHROME, status: 'unauthenticated' }), false);
  assert.equal(oneTapEnabled({ clientId: undefined, ua: CHROME, status: 'unauthenticated' }), false);
  assert.equal(oneTapEnabled({ clientId: '123', ua: INSTAGRAM, status: 'unauthenticated' }), false, 'Google refuses inside Instagram');
  for (const status of ['loading', 'authenticated', 'unavailable']) assert.equal(oneTapEnabled({ clientId: '123', ua: CHROME, status }), false, status);
  assert.equal(oneTapEnabled(), false);
});

test('O7: the nonce Google gets is the SHA-256 hex of the one Supabase gets, fresh every time', async () => {
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const a = await makeNonce();
  const b = await makeNonce();
  assert.match(a.raw, /^[A-Za-z0-9+/]{43}=$/, '32 random bytes in base64');
  assert.match(a.hashed, /^[0-9a-f]{64}$/);
  assert.equal(a.hashed, await sha256Hex(a.raw));
  assert.notEqual(a.raw, b.raw);
});

test('O7: Google Identity Services is started with FedCM, the hashed nonce and no automatic sign-in', () => {
  assert.equal(GSI_SRC, 'https://accounts.google.com/gsi/client');
  assert.deepEqual(oneTapConfig({ clientId: ' 123.apps ', hashedNonce: 'h', context: 'signup' }), {
    client_id: '123.apps', nonce: 'h', use_fedcm_for_prompt: true, itp_support: true, auto_select: false, cancel_on_tap_outside: true, context: 'signup',
  });
  assert.equal(oneTapConfig({ clientId: '1', hashedNonce: 'h' }).context, 'signin');
  assert.equal(oneTapConfig({ clientId: '1', hashedNonce: 'h', context: 'other' }).context, 'signin');
});
