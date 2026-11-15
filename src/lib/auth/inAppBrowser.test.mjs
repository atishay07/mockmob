import test from 'node:test';
import assert from 'node:assert/strict';
import { chromeIntentUrl, inAppBrowserKind, IN_APP_COPY } from './inAppBrowser.mjs';
import { IN_APP_BROWSER_RE } from '../../components/result/installOffer.mjs';

const UA = {
  instagramAndroid: 'Mozilla/5.0 (Linux; Android 13; SM-A515F Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.163 Mobile Safari/537.36 Instagram 309.0.0.40.113 Android (33/13; 420dpi; 1080x2186; samsung; SM-A515F; a51; exynos9611; en_IN; 541635863)',
  facebookAndroid: 'Mozilla/5.0 (Linux; Android 12; RMX3085 Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/118.0.5993.111 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/440.0.0.33.116;]',
  whatsappAndroid: 'Mozilla/5.0 (Linux; Android 14; 2201117TI Build/UKQ1.230804.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.144 Mobile Safari/537.36 WhatsApp/2.23.25.83',
  instagramIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 307.0.0.34.111 (iPhone14,5; iOS 17_1; en_IN; en; scale=3.00; 1170x2532; 532277151)',
  instagramIpad: 'Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 307.0.0.34.111 (iPad13,1; iPadOS 17_1; en_IN; en; scale=2.00; 1640x2360; 532277151)',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  safariIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  chromeDesktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

test('F1: the sign-in card and the install offer share one in-app test', () => {
  assert.equal(inAppBrowserKind(UA.instagramAndroid), 'android');
  assert.equal(inAppBrowserKind(UA.facebookAndroid), 'android');
  assert.equal(inAppBrowserKind(UA.whatsappAndroid), 'android');
  assert.equal(inAppBrowserKind(UA.instagramIphone), 'ios');
  assert.equal(inAppBrowserKind(UA.instagramIpad), 'ios');
  for (const ua of [UA.chromeAndroid, UA.safariIphone, UA.chromeDesktop, '', undefined]) assert.equal(inAppBrowserKind(ua), null);
  for (const [name, ua] of Object.entries(UA)) assert.equal(Boolean(inAppBrowserKind(ua)), IN_APP_BROWSER_RE.test(ua), name);
});

test('F1: Android in-app browsers get an intent link that opens the same page in Chrome, path and query kept', () => {
  const href = 'https://www.mockmob.in/signup?next=%2Fmob%2Finvite%2Fab12&invite=K7Q2#top';
  const want = 'intent://www.mockmob.in/signup?next=%2Fmob%2Finvite%2Fab12&invite=K7Q2#Intent;scheme=https;package=com.android.chrome;'
    + `S.browser_fallback_url=${encodeURIComponent('https://www.mockmob.in/signup?next=%2Fmob%2Finvite%2Fab12&invite=K7Q2')};end`;
  for (const ua of [UA.instagramAndroid, UA.facebookAndroid, UA.whatsappAndroid]) assert.equal(chromeIntentUrl(href, ua), want);
  assert.equal(chromeIntentUrl('https://www.mockmob.in/login', UA.instagramAndroid),
    `intent://www.mockmob.in/login#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent('https://www.mockmob.in/login')};end`);
  assert.match(chromeIntentUrl('https://www.mockmob.in/signup', UA.instagramAndroid), /S\.browser_fallback_url=https%3A%2F%2Fwww\.mockmob\.in%2Fsignup;end$/);
});

test('F1: iPhone, iPad and ordinary browsers get no intent link; bad input gets none', () => {
  const href = 'https://www.mockmob.in/signup';
  for (const ua of [UA.instagramIphone, UA.instagramIpad, UA.chromeAndroid, UA.safariIphone, UA.chromeDesktop, '']) assert.equal(chromeIntentUrl(href, ua), null);
  assert.equal(chromeIntentUrl('not a url', UA.instagramAndroid), null);
  assert.equal(chromeIntentUrl('javascript:alert(1)', UA.instagramAndroid), null);
  assert.equal(chromeIntentUrl(undefined, UA.instagramAndroid), null);
});

test('F1: the in-app words are plain, with no exclamation marks or arrows', () => {
  assert.equal(IN_APP_COPY.openInChrome, 'Open in Chrome to use Google');
  assert.equal(IN_APP_COPY.iosGoogle, 'Using Google? Tap the menu, then Open in browser.');
  assert.equal(IN_APP_COPY.staysHere, 'You will stay signed in inside this app’s browser only.');
  for (const line of Object.values(IN_APP_COPY)) assert.doesNotMatch(line, /[!→]/);
});
