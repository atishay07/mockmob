import test from 'node:test';
import assert from 'node:assert/strict';
import { signInCardLayout } from './signInCard.mjs';
import { inAppBrowserKind } from './inAppBrowser.mjs';

const ANDROID_IG = 'Mozilla/5.0 (Linux; Android 13; SM-A515F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0 Mobile Safari/537.36 Instagram 309.0.0.40.113 Android';
const IPHONE_IG = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 307.0.0.34.111 (iPhone14,5; iOS 17_1)';
const CHROME = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const GOOGLE = { method: 'google', email: null, at: 1 };
const EMAIL = { method: 'email', email: 'a***@gmail.com', at: 1 };

test('F1: an ordinary browser keeps Google first and the email key volt', () => {
  for (const mode of ['signup', 'login']) {
    assert.deepEqual(signInCardLayout({ mode, inAppKind: inAppBrowserKind(CHROME) }),
      { order: ['google', 'email'], primary: 'email', google: 'button', remembered: null, staysHere: false });
  }
});

test('F1: Instagram on Android: the email first and volt, Google replaced by the Chrome link, the stay-here line', () => {
  for (const mode of ['signup', 'login']) {
    assert.deepEqual(signInCardLayout({ mode, inAppKind: inAppBrowserKind(ANDROID_IG) }),
      { order: ['email', 'google'], primary: 'email', google: 'chrome', remembered: null, staysHere: true });
  }
});

test('F1: Instagram on iPhone: the email first and volt, no Google key, one line naming the menu', () => {
  assert.deepEqual(signInCardLayout({ mode: 'signup', inAppKind: inAppBrowserKind(IPHONE_IG) }),
    { order: ['email', 'google'], primary: 'email', google: 'menu-line', remembered: null, staysHere: true });
});

test('O8: on /login the remembered way goes first; Google is the volt key until a code is on its way', () => {
  assert.deepEqual(signInCardLayout({ mode: 'login', last: GOOGLE }),
    { order: ['google', 'email'], primary: 'google', google: 'button', remembered: GOOGLE, staysHere: false });
  assert.equal(signInCardLayout({ mode: 'login', last: GOOGLE, otpSent: true }).primary, 'email');
  assert.deepEqual(signInCardLayout({ mode: 'login', last: EMAIL }),
    { order: ['email', 'google'], primary: 'email', google: 'button', remembered: EMAIL, staysHere: false });
});

test('O8: never on /signup; Google is not offered as the remembered way inside an in-app browser', () => {
  assert.equal(signInCardLayout({ mode: 'signup', last: GOOGLE }).remembered, null);
  assert.equal(signInCardLayout({ mode: 'signup', last: EMAIL }).remembered, null);
  assert.deepEqual(signInCardLayout({ mode: 'signup', last: EMAIL }).order, ['google', 'email']);
  const inApp = signInCardLayout({ mode: 'login', inAppKind: 'android', last: GOOGLE });
  assert.equal(inApp.remembered, null);
  assert.equal(inApp.primary, 'email');
  assert.equal(signInCardLayout({ mode: 'login', inAppKind: 'ios', last: EMAIL }).remembered, EMAIL);
});
