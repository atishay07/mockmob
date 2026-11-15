// F1 (15 Nov 2026): sign-in inside an in-app browser (Instagram, Facebook, WhatsApp, an Android WebView). Pure, no React.
//
// Google refuses sign-in inside these embedded browsers (its "disallowed_useragent" page), and a session made there stays
// inside that app's browser. The sign-in card puts the email code first there and replaces the Google key:
//   android  one quiet key that opens this same page in Chrome (an intent:// link), where Google works
//   ios      no key (nothing reliably opens Safari from an in-app view), one line saying where the menu item is
// The detection is the one the install offer uses (src/components/result/installOffer.mjs), so the two never disagree.
import { IN_APP_BROWSER_RE } from '../../components/result/installOffer.mjs';

/** 'android' | 'ios' | 'other' for an in-app browser, null for an ordinary one. */
export function inAppBrowserKind(ua = '') {
  const s = String(ua || '');
  if (!IN_APP_BROWSER_RE.test(s)) return null;
  if (/iPhone|iPad|iPod/.test(s)) return 'ios';
  if (/Android/i.test(s)) return 'android';
  return 'other';
}

/**
 * The link that opens `href` in Chrome from an Android in-app browser, or null anywhere else.
 * intent://<host><path>?<query>#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=<same https URL>;end
 * The path and query are kept (an invite, a `next`), the fragment is not. Without Chrome the fallback reopens the same page.
 */
export function chromeIntentUrl(href, ua = '') {
  if (inAppBrowserKind(ua) !== 'android') return null;
  let url;
  try { url = new URL(String(href || '')); } catch { return null; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!url.host) return null;
  const rest = `${url.host}${url.pathname}${url.search}`;
  const fallback = encodeURIComponent(`https://${rest}`);
  return `intent://${rest}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
}

/**
 * The quiet line at the top of /signup: only in an Android in-app browser (Instagram, Facebook, WhatsApp, a WebView), where a
 * student lands from a link and Google sign-in would be refused. Anywhere else (iPhone, Chrome, desktop) it is null.
 */
export function signupChromeNote(href, ua = '') {
  const link = chromeIntentUrl(href, ua);
  return link ? { href: link, text: IN_APP_COPY.signupTop, action: IN_APP_COPY.signupTopAction } : null;
}

export const IN_APP_COPY = Object.freeze({
  signupTop: 'Want to sign up with Google?',
  signupTopAction: 'Open in Chrome',
  openInChrome: 'Open in Chrome to use Google',
  iosGoogle: 'Using Google? Tap the menu, then Open in browser.',
  staysHere: 'You will stay signed in inside this app’s browser only.',
});
