// The home page's Android app nudge (owner, 21 Nov 2026: "only for Android phone web experiences ... add a feature graphic
// ... to nudge people to download the app"). There is no iPhone app, so the section is for an Android phone's browser and
// nobody else. Pure: no I/O, no React, so androidNudge.test.mjs can hold it.
//
// The switch: the Play listing for in.mockmob.app is not public yet (it answers 404), so the section exists only while
// PLAY_LISTING_PUBLIC is exactly 'true' (the same switch /r/<code> reads, src/lib/referrals/friendInvite.mjs).
// The preview (owner LK366, 22 Nov 2026: "I don't see anything related to that Android app ... even as a placeholder ... let
// me know how I can check that"): /?appnudge=1 shows it on an Android phone whatever the switch says, on the live site too,
// so he can judge it on his own phone. Nobody reaches that address by accident, and while the listing is not public the
// preview says so under the key.
// No funnel step is recorded for it: a new funnel step needs a database migration (the funnel's step list is in the database).
import { ANDROID_PACKAGE } from '../../lib/referrals/friendInvite.mjs';
import { IN_APP_BROWSER_RE } from '../result/installOffer.mjs';

/** The Play listing, with an Install Referrer that says only where the tap came from (no personal data). */
export const NUDGE_PLAY_URL = `https://play.google.com/store/apps/details?${new URLSearchParams({
  id: ANDROID_PACKAGE,
  referrer: 'utm_source=web&utm_medium=home_nudge',
}).toString()}`;

/** The query that previews the section, in development and on the live site: /?appnudge=1 */
export const NUDGE_PREVIEW_PARAM = 'appnudge';

/**
 * Words a student reads. Every claim is one the app's own Play listing makes (MockMob-store-listing, LISTING v11b).
 * fix-misc (21 Nov 2026, evening): "repairs" is our word, not a student's, so the line says "mistake fixes". The offline
 * sentence is gone: the app keeps a paper's answers on the phone (flutter_app core/sync, the session draft and outbox), but a
 * timed mock's answers are sent only until 2 minutes after its end, it was never tested in airplane mode (listing CHECK.md),
 * and the newer listing (v13) dropped it too, so "your answers wait until you are back online" was more than we can promise.
 */
export const NUDGE_COPY = Object.freeze({
  eyebrow: 'MockMob for Android',
  title: 'Practise in the MockMob app',
  line: 'Mocks, your results, mistake fixes and Ask Mobi on your phone.',
  // The same four things as the line, one a row (owner LK367, 22 Nov 2026: the section was "very boring").
  pointMocks: 'Mocks and practice, sized for a phone',
  pointResults: 'Your results and mistake fixes',
  pointMobi: 'Ask Mobi, any time',
  // The Google Play key's two lines, and its name for a screen reader.
  badgeSmall: 'Get it on',
  badgeBig: 'Google Play',
  key: 'Get the app on Google Play',
  alt: 'The MockMob app: unlimited mocks, every one new',
  // Shown only in the preview while the listing is not public (the key then leads to a page Google Play does not have yet).
  previewNote: 'Preview. This appears once the app is public on Google Play.',
});

/** An Android phone: the user agent says Android AND Mobile (an Android tablet leaves out Mobile). Never an iPhone. */
export function isAndroidPhone(ua = '') {
  const s = String(ua || '').slice(0, 512);
  return /Android/i.test(s) && /Mobile/i.test(s) && !/iPhone|iPad|iPod/i.test(s);
}

/**
 * May the server draw the section at all? Always, and always hidden: the browser rule below shows it. (Until 22 Nov 2026
 * production drew nothing while the listing was not public; the owner then had no way to see it on his phone.) Hidden, its
 * lazy picture is never fetched.
 */
export function nudgeDrawn() {
  return true;
}

/**
 * The browser's rule, after hydration. True only when every one holds:
 *   allowed:    ?appnudge=1 anywhere (the preview), or production with the switch on (development shows it only as a preview);
 *   an Android phone (not an iPhone, a tablet or a desktop);
 *   not an in-app browser or a WebView (Instagram, Facebook, WhatsApp, "; wv)"): installing fails there;
 *   not opened from the app (html[data-app-view], src/app/app-view.css);
 *   not an installed web app (display-mode: standalone).
 */
export function showAndroidNudge({ ua = '', listed = false, dev = false, preview = false, appView = false, standalone = false } = {}) {
  const allowed = preview === true || (dev !== true && listed === true);
  if (!allowed) return false;
  if (appView === true || standalone === true) return false;
  const s = String(ua || '');
  if (IN_APP_BROWSER_RE.test(s)) return false;
  return isAndroidPhone(s);
}
