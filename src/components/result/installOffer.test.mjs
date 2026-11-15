// O6 (15 Nov 2026): the install card's show rules on the result, as a pure model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { INSTALL_COPY, IN_APP_BROWSER_RE, installOffer, isInAppBrowser, isIosSafari, readRemembered, rememberDismissed, rememberOffered } from './installOffer.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36';
const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/151.0.0.0 Mobile/15E148 Safari/604.1';
const INSTAGRAM_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/151.0.0.0 Mobile Safari/537.36 Instagram 350.0.0.0 Android';
const INSTAGRAM_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0';
const FACEBOOK_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0]';
const DESKTOP_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

const fresh = { offeredOn: null, dismissedAt: null };
const phone = { attemptId: 'a1', desktop: false, standalone: false, installed: false, remembered: fresh };

test('the in-app test is the sign-up card\'s own', () => {
  // W3-A (15 Nov): the card keeps no copy; it reads this one through src/lib/auth/inAppBrowser.mjs.
  const card = readFileSync(`${root}src/components/ui/SignupCard.jsx`, 'utf8');
  const helper = readFileSync(`${root}src/lib/auth/inAppBrowser.mjs`, 'utf8');
  assert.doesNotMatch(card, /IN_APP_BROWSER_RE = /, 'no second copy in the card');
  assert.match(card, /from '@\/lib\/auth\/inAppBrowser\.mjs'/);
  assert.match(helper, /import \{ IN_APP_BROWSER_RE \} from '\.\.\/\.\.\/components\/result\/installOffer\.mjs';/);
  for (const ua of [INSTAGRAM_ANDROID, INSTAGRAM_IPHONE, FACEBOOK_IPHONE]) assert.equal(isInAppBrowser(ua), true, ua);
  for (const ua of [ANDROID_CHROME, IPHONE_SAFARI, IPHONE_CHROME, DESKTOP_CHROME]) assert.equal(isInAppBrowser(ua), false, ua);
});

test('Android Chrome with a captured install prompt: the card with the key', () => {
  assert.deepEqual(installOffer({ ...phone, ua: ANDROID_CHROME, hasPrompt: true }), { kind: 'prompt' });
  assert.equal(installOffer({ ...phone, ua: ANDROID_CHROME, hasPrompt: false }), null, 'no prompt captured: nothing to offer');
});

test('iPhone Safari: the two steps in words; Chrome on iPhone and in-app views get nothing', () => {
  assert.equal(isIosSafari(IPHONE_SAFARI), true);
  assert.equal(isIosSafari(IPHONE_CHROME), false);
  assert.equal(isIosSafari(INSTAGRAM_IPHONE), false);
  assert.deepEqual(installOffer({ ...phone, ua: IPHONE_SAFARI }), { kind: 'ios' });
  assert.equal(installOffer({ ...phone, ua: IPHONE_CHROME }), null);
  assert.match(INSTALL_COPY.ios, /Share, then Add to Home Screen/);
});

test('never inside Instagram or Facebook, never on a desktop, never once installed', () => {
  assert.equal(installOffer({ ...phone, ua: INSTAGRAM_ANDROID, hasPrompt: true }), null);
  assert.equal(installOffer({ ...phone, ua: FACEBOOK_IPHONE }), null);
  assert.equal(installOffer({ ...phone, ua: DESKTOP_CHROME, hasPrompt: true, desktop: true }), null);
  assert.equal(installOffer({ ...phone, ua: ANDROID_CHROME, hasPrompt: true, standalone: true }), null);
  assert.equal(installOffer({ ...phone, ua: ANDROID_CHROME, hasPrompt: true, installed: true }), null);
  assert.equal(installOffer({ ...phone, ua: ANDROID_CHROME, hasPrompt: true, attemptId: null }), null);
});

test('once: offered on the first result it was shown on, gone for good after Not now', () => {
  const shown = rememberOffered(fresh, 'a1');
  assert.deepEqual(shown, { offeredOn: 'a1', dismissedAt: null });
  assert.deepEqual(rememberOffered(shown, 'a2'), shown, 'a later result never takes the offer over');
  assert.deepEqual(installOffer({ ...phone, ua: ANDROID_CHROME, hasPrompt: true, remembered: shown }), { kind: 'prompt' }, 'the same result again (a reload) keeps it');
  assert.equal(installOffer({ ...phone, attemptId: 'a2', ua: ANDROID_CHROME, hasPrompt: true, remembered: shown }), null, 'another result: not offered again');
  const dismissed = rememberDismissed(shown, 1_700_000_000_000);
  assert.deepEqual(dismissed, { offeredOn: 'a1', dismissedAt: 1_700_000_000_000 });
  assert.equal(installOffer({ ...phone, ua: ANDROID_CHROME, hasPrompt: true, remembered: dismissed }), null);
  // Stored and read back, and anything unreadable is a fresh device.
  assert.deepEqual(readRemembered(JSON.stringify(dismissed)), dismissed);
  assert.deepEqual(readRemembered('{oops'), fresh);
  assert.deepEqual(readRemembered(null), fresh);
});

test('the words: sentence case, no exclamation, no arrows', () => {
  assert.equal(INSTALL_COPY.title, 'Keep MockMob on your home screen');
  assert.equal(INSTALL_COPY.line, 'Opens like an app. Your papers and mistakes are one tap away.');
  assert.equal(INSTALL_COPY.key, 'Add to home screen');
  assert.equal(INSTALL_COPY.later, 'Not now');
  for (const line of Object.values(INSTALL_COPY)) assert.doesNotMatch(line, /!|→|->/);
});
