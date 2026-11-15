// W3-A (15 Nov 2026): the order of the sign-in card's ways in, worked out in one place. Pure, no React.
//
//   ordinary browser            Google first (quiet key), then the email code (the volt key)
//   in-app browser (F1)         the email code first (volt), then: Android, a quiet "Open in Chrome to use Google" link;
//                               iPhone and others, one line naming the menu item; and the line saying the session stays there
//   /login, remembered (O8)     the way this device used last time goes first; for Google it is also the volt key (until a
//                               code is on its way). Never on /signup, and Google is never remembered into an in-app browser.

/**
 * mode       'signup' | 'login'
 * inAppKind  inAppBrowserKind(ua): 'android' | 'ios' | 'other' | null
 * last       parseLastSignIn(...) or null
 * otpSent    a code is on its way (the volt key is the code's then)
 * Returns { order: ['google','email'] | ['email','google'], primary: 'email' | 'google', google: 'button' | 'chrome' | 'menu-line',
 *           remembered: last | null, staysHere: boolean }
 */
export function signInCardLayout({ mode = 'signup', inAppKind = null, last = null, otpSent = false } = {}) {
  const inApp = Boolean(inAppKind);
  const remembered = mode === 'login' && last && (last.method === 'email' || (last.method === 'google' && !inApp)) ? last : null;
  const emailFirst = inApp || remembered?.method === 'email';
  const googlePrimary = !inApp && remembered?.method === 'google' && !otpSent;
  return {
    order: emailFirst ? ['email', 'google'] : ['google', 'email'],
    primary: googlePrimary ? 'google' : 'email',
    google: !inApp ? 'button' : inAppKind === 'android' ? 'chrome' : 'menu-line',
    remembered,
    staysHere: inApp,
  };
}
