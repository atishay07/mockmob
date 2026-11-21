// node --test src/components/landing/androidNudge.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NUDGE_COPY, NUDGE_PLAY_URL, isAndroidPhone, nudgeDrawn, showAndroidNudge } from './androidNudge.mjs';
import { ANDROID_PACKAGE } from '../../lib/referrals/friendInvite.mjs';

const UA = {
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; SM-M065F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  androidWebView: 'Mozilla/5.0 (Linux; Android 14; SM-M065F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36',
  instagram: 'Mozilla/5.0 (Linux; Android 14; SM-M065F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 Instagram 350.0.0.0 Android',
  whatsapp: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 WhatsApp/2.24',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};
const live = { listed: true, dev: false };

test('an Android phone in its own browser sees it while the listing is public', () => {
  assert.equal(showAndroidNudge({ ...live, ua: UA.androidChrome }), true);
  assert.equal(isAndroidPhone(UA.androidChrome), true);
});

test('never on an iPhone, an iPad, an Android tablet or a desktop', () => {
  for (const ua of [UA.iphone, UA.ipad, UA.androidTablet, UA.desktop, '', undefined]) {
    assert.equal(showAndroidNudge({ ...live, ua }), false, String(ua));
  }
});

test('never inside an in-app browser or a WebView', () => {
  for (const ua of [UA.androidWebView, UA.instagram, UA.whatsapp]) assert.equal(showAndroidNudge({ ...live, ua }), false);
});

test('never from the app, never in an installed web app', () => {
  assert.equal(showAndroidNudge({ ...live, ua: UA.androidChrome, appView: true }), false);
  assert.equal(showAndroidNudge({ ...live, ua: UA.androidChrome, standalone: true }), false);
});

test('off while the switch is off; development shows it only with ?appnudge=1', () => {
  assert.equal(showAndroidNudge({ ua: UA.androidChrome, listed: false }), false);
  assert.equal(showAndroidNudge({ ua: UA.androidChrome, listed: false, dev: true }), false);
  assert.equal(showAndroidNudge({ ua: UA.androidChrome, listed: true, dev: true }), false, 'development needs the query');
  assert.equal(showAndroidNudge({ ua: UA.androidChrome, dev: true, preview: true }), true);
  assert.equal(showAndroidNudge({ ua: UA.iphone, dev: true, preview: true }), false);
  assert.equal(nudgeDrawn({ listed: false, dev: false }), false, 'production draws nothing while the listing is not public');
  assert.equal(nudgeDrawn({ listed: true, dev: false }), true);
  assert.equal(nudgeDrawn({ listed: false, dev: true }), true);
});

test('the key goes to the app\'s Play listing with a referrer that names only the source', () => {
  const url = new URL(NUDGE_PLAY_URL);
  assert.equal(url.origin + url.pathname, 'https://play.google.com/store/apps/details');
  assert.equal(url.searchParams.get('id'), ANDROID_PACKAGE);
  assert.equal(url.searchParams.get('referrer'), 'utm_source=web&utm_medium=home_nudge');
  assert.deepEqual([...url.searchParams.keys()], ['id', 'referrer']);
});

test('the words follow the copy rules', () => {
  for (const text of Object.values(NUDGE_COPY)) {
    assert.doesNotMatch(text, /[!—·]/);
    assert.equal(text[0], text[0].toUpperCase());
  }
  assert.equal(NUDGE_COPY.key, 'Get the app on Google Play');
  // fix-misc (21 Nov 2026): a first-time student's words, and no promise the app was never tested on.
  assert.doesNotMatch(NUDGE_COPY.line, /repair/i);
  assert.doesNotMatch(NUDGE_COPY.line, /back online|signal/i);
});

test('the component reads the rule, draws nothing in production while the switch is off, and never floats', () => {
  const src = readFileSync(fileURLToPath(new URL('./AndroidAppNudge.jsx', import.meta.url)), 'utf8');
  const css = readFileSync(fileURLToPath(new URL('./android-app-nudge.css', import.meta.url)), 'utf8');
  assert.match(src, /if \(!nudgeDrawn\(\{ listed, dev: DEV \}\)\) return null;/);
  assert.match(src, /const DEV = process\.env\.NODE_ENV !== 'production';/);
  assert.match(src, /<section[^>]*className="lp-app"[^>]*hidden/);
  assert.match(src, /loading="lazy"/);
  assert.doesNotMatch(css, /position:\s*(fixed|sticky)/);
});
