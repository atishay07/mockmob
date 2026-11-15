"use client";
import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { rememberAuthStart, rememberNextPath, takeFailedAuthEmail } from '@/lib/auth-redirect';
import { IN_APP_COPY, chromeIntentUrl, inAppBrowserKind } from '@/lib/auth/inAppBrowser.mjs';
import { TYPO_COPY, suggestEmail } from '@/lib/auth/emailTypo.mjs';
import { signInCardLayout } from '@/lib/auth/signInCard.mjs';
import {
  LAST_SIGN_IN_COPY, LAST_SIGN_IN_KEY, forgetLastSignIn, lastSignInParts, notePendingSignIn, parseLastSignIn,
} from '@/lib/auth/lastSignIn.mjs';

const RESEND_WAIT_SECONDS = 60;
const MIN_CODE_LENGTH = 6;
const MAX_CODE_LENGTH = 10;
// R8 PUB-07: the form checks the address itself (noValidate), so every phone shows the same in-card reason, never a browser bubble
// over the key. A plain shape check only: something, an @, something, a dot, something.
const EMAIL_SHAPE = /^\S+@\S+\.\S+$/;
const EMAIL_WHY = Object.freeze({
  // "sign-in" never breaks at its hyphen.
  empty: <>Enter your email first, and we send you a <span style={{ whiteSpace: 'nowrap' }}>sign-in</span> code.</>,
  incomplete: 'That email looks incomplete. Check the @ and what comes after it.',
});

// F1: Google refuses sign-in inside embedded browsers (Instagram, Facebook, WhatsApp, Android WebView). The test is the install
// offer's (src/lib/auth/inAppBrowser.mjs): 'android' | 'ios' | 'other', or null in an ordinary browser.
const noSubscribe = () => () => {};
const readInAppKind = () => inAppBrowserKind(window.navigator.userAgent || '');
const readChromeLink = () => chromeIntentUrl(window.location.href, window.navigator.userAgent || '');
const serverNull = () => null;

// O8: how this device last signed in, kept as text so the store compares snapshots by value. "Not you?" tells listeners here
// (a removal in this tab fires no storage event); another tab's sign-in arrives through the storage event.
const lastListeners = new Set();
const subscribeLast = (notify) => {
  lastListeners.add(notify);
  window.addEventListener('storage', notify);
  return () => { lastListeners.delete(notify); window.removeEventListener('storage', notify); };
};
function deviceStorage() {
  try { return window.localStorage; } catch { return null; }
}
const readLastRaw = () => {
  try { return window.localStorage.getItem(LAST_SIGN_IN_KEY); } catch { return null; }
};

function GoogleMark() {
  return (
    <svg className="auth-card__google" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.76l4.01-3.1z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77z" />
    </svg>
  );
}

export function SignupCard({ mode = 'signup' }) {
  const { signInWithGoogle, signInWithEmail, verifyEmailOtp } = useAuth();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const inAppKind = useSyncExternalStore(noSubscribe, readInAppKind, serverNull);
  const chromeLink = useSyncExternalStore(noSubscribe, readChromeLink, serverNull);
  const lastRaw = useSyncExternalStore(subscribeLast, readLastRaw, serverNull);
  const codeInputRef = useRef(null);
  const emailInputRef = useRef(null);
  const submitRef = useRef(null);
  // The primary key always looks ready (W-057: a dim key read as broken). Pressed with no email, it says why and
  // puts the cursor in the field instead.
  // R8 PUB-07: why the email cannot be sent yet ('' when it can), said in the card instead of the browser's own bubble.
  const [emailWhy, setEmailWhy] = useState('');
  // O9: the address the student probably meant ('' when none), and the typed address they said is right ("No, send it").
  const [typoFix, setTypoFix] = useState('');
  const [typoKept, setTypoKept] = useState('');
  const isLogin = mode === 'login';
  const inApp = Boolean(inAppKind);

  useEffect(() => {
    // Remember where the student was going (validated; cleared when absent).
    rememberNextPath(new URLSearchParams(window.location.search).get('next'));
    // F10: back from a sign-in that failed at /auth/callback, the email typed here before is filled back in (once).
    const kept = takeFailedAuthEmail(mode);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the kept address is read on the client only
    if (kept) setEmail(kept);
  }, [mode]);

  useEffect(() => {
    // F9: Back from Google can restore this page from the back-forward cache with the Google key still busy.
    const reset = (event) => { if (event.persisted) setGoogleLoading(false); };
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    if (otpSent) codeInputRef.current?.focus();
  }, [otpSent]);

  const handleGoogleUi = async () => {
    setError('');
    setNotice('');
    setGoogleLoading(true);
    rememberAuthStart(mode, email); // F10: a failed callback comes back to this card
    notePendingSignIn(deviceStorage(), 'google'); // O8: remembered once the session is confirmed
    try {
      const { error: oauthError } = await signInWithGoogle();
      if (oauthError) {
        setError('Google sign-in did not start. Try again, or use the email code below.');
        setGoogleLoading(false);
      }
      // On success the browser leaves for Google; keep the button busy until it does.
    } catch {
      setError('Google sign-in did not start. Try again, or use the email code below.');
      setGoogleLoading(false);
    }
  };

  const sendCode = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) return;

    setError('');
    setNotice('');
    setEmailLoading(true);
    rememberAuthStart(mode, cleanEmail); // F10: the emailed link's callback comes back to this card if it fails
    notePendingSignIn(deviceStorage(), 'email', cleanEmail); // O8: the emailed link signs in here too; masked before it is kept
    try {
      const { error: sendError } = await signInWithEmail(cleanEmail);
      if (sendError) {
        if (sendError.retryAfterSeconds) setResendIn(Math.min(sendError.retryAfterSeconds, 3600));
        // A code is already on its way only when this inbox's limit refused (F5): open the field for it. The network limit
        // ('rate_limited_network') and the site's daily ceiling ('email_busy') sent nothing, so the field stays as it was.
        if (sendError.code === 'rate_limited') setOtpSent(true);
        setError(sendError.message || 'Could not send the code. Please try again.');
        return;
      }
      setOtp('');
      setOtpSent(true);
      setResendIn(RESEND_WAIT_SECONDS);
      // In an in-app browser the email's button opens Chrome, where this session is not: the code is the way back here.
      setNotice(inApp
        ? `We sent a code to ${cleanEmail}. It can take a minute; check Spam or Promotions too. Type the code here.`
        : `We sent a code to ${cleanEmail}. It can take a minute; check Spam or Promotions too. You can also tap the button in that email.`);
    } catch {
      setError('Could not send the code. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
    const typed = email.trim();
    // O9: the question was on screen and the key was pressed again: that is "No, send it", never a key that does nothing.
    if (typoFix) { await keepTyped(); return; }
    // O9: a known slip of a big mail service (gmial.com, gmail.con) is asked about once, before any code is sent.
    const meant = typed && typed !== typoKept ? suggestEmail(typed) : null;
    if (meant) { setEmailWhy(''); setTypoFix(meant); return; }
    const why = !typed ? EMAIL_WHY.empty : EMAIL_SHAPE.test(typed) ? '' : EMAIL_WHY.incomplete;
    if (why) { setEmailWhy(why); emailInputRef.current?.focus(); return; }
    await sendCode();
  };

  const applyTypoFix = () => {
    setEmail(typoFix);
    setTypoFix('');
    submitRef.current?.focus();
  };

  const keepTyped = async () => {
    setTypoKept(email.trim());
    setTypoFix('');
    const typed = email.trim();
    if (!EMAIL_SHAPE.test(typed)) { setEmailWhy(EMAIL_WHY.incomplete); emailInputRef.current?.focus(); return; }
    await sendCode();
  };

  const handleOtpVerify = async (event) => {
    event.preventDefault();
    const cleanEmail = email.trim();
    const cleanOtp = otp.trim();
    if (!cleanEmail || cleanOtp.length < MIN_CODE_LENGTH) return;

    setError('');
    setNotice('');
    setEmailLoading(true);
    try {
      const { error: verifyError } = await verifyEmailOtp(cleanEmail, cleanOtp);
      if (verifyError) {
        setError(verifyError.message || 'That code did not work. Use the newest email, or send a new code.');
      }
    } catch {
      setError('Could not check the code. Check your connection and try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  const switchEmail = () => {
    setOtpSent(false);
    setOtp('');
    setError('');
    setNotice('');
    setResendIn(0);
  };

  const notYou = () => {
    forgetLastSignIn(deviceStorage());
    lastListeners.forEach((notify) => notify());
  };

  // The order of the ways in (src/lib/auth/signInCard.mjs): in-app browsers put the email first (F1); on /login the way this
  // device used last time goes first (O8). One volt key per view: the email key, or Google's for a returning Google user.
  const layout = signInCardLayout({ mode, inAppKind, last: isLogin ? parseLastSignIn(lastRaw) : null, otpSent });
  const lastParts = lastSignInParts(layout.remembered);
  const emailFirst = layout.order[0] === 'email';
  const googlePrimary = layout.primary === 'google';

  const busy = googleLoading || emailLoading;
  const submitDisabled = emailLoading || (otpSent && otp.trim().length < MIN_CODE_LENGTH);
  const showTypo = Boolean(typoFix) && !otpSent;

  const googleWay = layout.google !== 'button' ? (
    // F1: the Google key is replaced, not explained. Android opens this same page in Chrome; iPhone has no reliable way.
    layout.google === 'chrome' && chromeLink ? (
      <a className="mm-btn mm-btn--secondary auth-card__chrome" href={chromeLink}>
        <GoogleMark />
        {IN_APP_COPY.openInChrome}
      </a>
    ) : (
      <p className="auth-card__inapp">{IN_APP_COPY.iosGoogle}</p>
    )
  ) : (
    <button
      type="button"
      className={`mm-btn ${googlePrimary ? 'mm-btn--primary auth-card__google-key--primary' : 'mm-btn--secondary'}`}
      onClick={handleGoogleUi}
      disabled={busy}
    >
      <GoogleMark />
      {googleLoading ? 'Opening Google…' : 'Continue with Google'}
    </button>
  );

  const emailForm = (
    <form className="auth-card__form" onSubmit={otpSent ? handleOtpVerify : handleEmailSubmit} noValidate>
      <label className="auth-field">
        <span>Email</span>
        <input
          className="input"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          ref={emailInputRef}
          value={email}
          onChange={(event) => { setEmail(event.target.value); if (emailWhy) setEmailWhy(''); if (typoFix) setTypoFix(''); }}
          aria-invalid={emailWhy && !otpSent ? true : undefined}
          aria-describedby={emailWhy && !otpSent ? 'auth-email-why' : showTypo ? 'auth-email-typo' : undefined}
          placeholder="you@example.com"
          disabled={emailLoading}
          readOnly={otpSent}
        />
      </label>
      {/* The reason, once, right under the field it is about. */}
      {emailWhy && !otpSent ? <small className="auth-card__why" id="auth-email-why" role="alert">{emailWhy}</small> : null}
      {/* O9: a likely slip in the domain, asked once; it never blocks. */}
      {showTypo ? (
        <div className="auth-card__typo" id="auth-email-typo" role="alert">
          <span>{TYPO_COPY.line(typoFix)}</span>
          <span className="auth-card__typo-keys">
            <button type="button" className="auth-card__textbtn" onClick={applyTypoFix}>{TYPO_COPY.use}</button>
            <button type="button" className="auth-card__textbtn" onClick={keepTyped} disabled={emailLoading}>{TYPO_COPY.keep}</button>
          </span>
        </div>
      ) : null}
      {otpSent && (
        <label className="auth-field auth-field--code">
          <span>Sign-in code</span>
          <input
            ref={codeInputRef}
            className="input"
            name="one-time-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={MAX_CODE_LENGTH}
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, MAX_CODE_LENGTH))}
            placeholder="00000000"
            disabled={emailLoading}
          />
          <small>The email has the code. It works on any device, so you can read it on another phone.</small>
        </label>
      )}
      <button
        ref={submitRef}
        type="submit"
        className={`mm-btn ${googlePrimary ? 'mm-btn--secondary' : 'mm-btn--primary'}`}
        disabled={submitDisabled}
      >
        {emailLoading ? (otpSent ? 'Checking the code…' : 'Sending…') : otpSent ? 'Verify code and continue' : 'Email me a sign-in code'}
      </button>
      {otpSent ? (
        <div className="auth-card__actions">
          <button type="button" className="auth-card__textbtn" onClick={sendCode} disabled={busy || resendIn > 0}>
            {resendIn > 0 ? `Send a new code in ${resendIn}s` : 'Send a new code'}
          </button>
          <button type="button" className="auth-card__textbtn" onClick={switchEmail} disabled={emailLoading}>
            Use a different email
          </button>
        </div>
      ) : null}
      {/* F1: a session made here lives in this app's browser, not in Chrome; said before the student relies on it. */}
      {layout.staysHere ? <p className="auth-card__inapp">{IN_APP_COPY.staysHere}</p> : null}
    </form>
  );

  return (
    <div className="auth-card">
      <div className="auth-card__head">
        <h2>{isLogin ? 'Welcome back' : 'Create your account'}</h2>
        <p>
          {/* Each thing is said once on the page (release 9): the headline's lead names what you open or keep, the
              ruled facts beside the desk say you stay signed in, so the card says how you get in. */}
          {isLogin
            ? 'Use Google, or get a one-time code by email. No password to remember.'
            : 'Free to start. No card needed.'}
        </p>
      </div>

      {lastParts ? (
        <p className="auth-card__last">
          {lastParts.lead}
          {lastParts.who ? <>{' '}<span className="auth-card__last-who">{lastParts.who}</span></> : null}.{' '}
          <button type="button" className="auth-card__textbtn" onClick={notYou}>{LAST_SIGN_IN_COPY.notYou}</button>
        </p>
      ) : null}

      {emailFirst ? (
        <>
          {emailForm}
          <div className="auth-card__or">or</div>
          {googleWay}
        </>
      ) : (
        <>
          {googleWay}
          <div className="auth-card__or">or use your email</div>
          {emailForm}
        </>
      )}

      <p
        className="auth-card__status"
        role={error ? 'alert' : 'status'}
        data-kind={error ? 'error' : notice ? 'notice' : undefined}
      >
        {error || notice}
      </p>

      <p className="auth-card__switch">
        {isLogin ? 'New here?' : 'Already have an account?'}{' '}
        <Link href={isLogin ? '/signup' : '/login'}>{isLogin ? 'Sign up free' : 'Log in'}</Link>
      </p>
      {/* In an in-app browser the line under the form says where the student stays signed in, so this one does not repeat it. */}
      {inApp
        ? <p className="auth-card__fine">Your email is how you sign in.</p>
        : <p className="auth-card__fine">{isLogin ? 'Your email is how you sign in.' : 'Your email is how you sign in, and you stay signed in on this device until you sign out.'}</p>}
    </div>
  );
}
