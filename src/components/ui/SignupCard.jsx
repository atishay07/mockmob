"use client";

// The sign-in card for /signup and /login (web IA plan section 3, step 3). One primary per state:
//   choose  Continue with Google (primary), Use email instead
//   email   the email field, Email me a code (primary), Use Google instead
//   code    the 6-digit code, Verify and continue (primary), send a new code, use another email
// Inside an in-app browser (Instagram, WhatsApp) Google refuses sign-in, so the card opens on email.
// Auth calls are unchanged: useAuth() signs in; the page decides where the student goes next.
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { rememberNextPath, safeNextPath } from '@/lib/auth-redirect';

const RESEND_WAIT_SECONDS = 60;
const MIN_CODE_LENGTH = 6;
// The code length is a Supabase dashboard setting; the field shows 6 digits and accepts up to 10.
const MAX_CODE_LENGTH = 10;
// Google refuses sign-in inside embedded browsers (Instagram, Facebook, WhatsApp, Android WebView).
const IN_APP_BROWSER_RE = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\/|WhatsApp|Snapchat|; wv\)/i;
const noSubscribe = () => () => {};
const readInAppBrowser = () => IN_APP_BROWSER_RE.test(window.navigator.userAgent || '');
const serverInAppBrowser = () => false;

function GoogleMark() {
  return (
    <span className="auth-card__gmark" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81z" />
        <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z" />
        <path fill="#FBBC05" d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.76l4.01-3.1z" />
        <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77z" />
      </svg>
    </span>
  );
}

/**
 * @param {'signup'|'login'} mode
 * @param {string|null} nextPath  the page's ?next, carried to the other auth page so it survives
 * @param {'choose'|'email'|'code'|null} previewStage  development previews only: open on a stage
 */
export function SignupCard({ mode = 'signup', nextPath = null, previewStage = null }) {
  const { signInWithGoogle, signInWithEmail, verifyEmailOtp } = useAuth();
  const inAppBrowser = useSyncExternalStore(noSubscribe, readInAppBrowser, serverInAppBrowser);
  const [stage, setStage] = useState(previewStage === 'code' ? 'code' : previewStage === 'email' ? 'email' : 'choose');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState(previewStage === 'code' ? 'student@example.com' : '');
  const [otp, setOtp] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [askedGoogle, setAskedGoogle] = useState(false);
  const googleRef = useRef(null);
  const emailRef = useRef(null);
  const codeInputRef = useRef(null);
  const moved = useRef(false);
  const isLogin = mode === 'login';
  // In an in-app browser the email path is the useful one, so it is open from the start (the
  // student can still ask for Google: the browser check is a guess from the user agent).
  const shown = stage === 'choose' && inAppBrowser && !askedGoogle ? 'email' : stage;

  useEffect(() => {
    // Remember where the student was going (validated; cleared when absent).
    rememberNextPath(new URLSearchParams(window.location.search).get('next'));
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  // Focus follows the stage the student chose (never on first paint).
  useEffect(() => {
    if (!moved.current) return;
    if (shown === 'code') codeInputRef.current?.focus();
    else if (shown === 'email') emailRef.current?.focus();
    else googleRef.current?.focus();
  }, [shown]);

  const go = (next) => {
    moved.current = true;
    if (next === 'choose') setAskedGoogle(true);
    setError('');
    setNotice('');
    setStage(next);
  };

  const handleGoogle = async () => {
    setError('');
    setNotice('');
    setGoogleLoading(true);
    try {
      const { error: oauthError } = await signInWithGoogle();
      if (oauthError) {
        setError('Google sign-in did not start. Try again, or use your email.');
        setGoogleLoading(false);
      }
      // On success the browser leaves for Google; keep the button busy until it does.
    } catch {
      setError('Google sign-in did not start. Try again, or use your email.');
      setGoogleLoading(false);
    }
  };

  const sendCode = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) return;
    setError('');
    setNotice('');
    setEmailLoading(true);
    try {
      const { error: sendError } = await signInWithEmail(cleanEmail);
      if (sendError) {
        if (sendError.retryAfterSeconds) setResendIn(Math.min(sendError.retryAfterSeconds, 3600));
        // A code may already be on its way: let the student type it.
        if (sendError.code === 'rate_limited') { moved.current = true; setStage('code'); }
        setError(sendError.message || 'The code did not send. Try again.');
        return;
      }
      setOtp('');
      moved.current = true;
      setStage('code');
      setResendIn(RESEND_WAIT_SECONDS);
      setNotice(`We sent a code to ${cleanEmail}. It can take a minute, so check Spam and Promotions too. You can also tap the button in that email.`);
    } catch {
      setError('The code did not send. Try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
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
      if (verifyError) setError(verifyError.message || 'That code did not work. Use the newest email, or send a new code.');
    } catch {
      setError('The code could not be checked. Check your connection and try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  const switchEmail = () => {
    setOtp('');
    setResendIn(0);
    go('email');
  };

  const busy = googleLoading || emailLoading;
  const safeNext = safeNextPath(nextPath);
  const otherHref = `${isLogin ? '/signup' : '/login'}${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ''}`;

  return (
    <div className="auth-card">
      {inAppBrowser ? (
        <p className="auth-card__status" data-kind="notice">
          Google sign-in does not work inside this app&apos;s browser. Open mockmob.in in Chrome, or use your email below.
        </p>
      ) : null}

      <div className="auth-card__panel" key={shown}>
        {shown === 'choose' ? (
          <>
            <button ref={googleRef} type="button" className="mm-btn mm-btn--primary auth-card__google-btn" onClick={handleGoogle} disabled={busy}>
              <GoogleMark />
              {googleLoading ? 'Opening Google…' : 'Continue with Google'}
            </button>
            <button type="button" className="mm-btn mm-btn--secondary" onClick={() => go('email')} disabled={busy}>
              Use email instead
            </button>
          </>
        ) : (
          <form className="auth-card__form" onSubmit={shown === 'code' ? handleOtpVerify : handleEmailSubmit} noValidate={shown === 'code'}>
            <label className="auth-field">
              <span>Email</span>
              <input
                ref={emailRef}
                className="input"
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                disabled={emailLoading}
                readOnly={shown === 'code'}
              />
            </label>
            {shown === 'code' && (
              <label className="auth-field auth-field--code">
                <span>Code from the email</span>
                <input
                  ref={codeInputRef}
                  className="input"
                  name="one-time-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={MAX_CODE_LENGTH}
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, MAX_CODE_LENGTH))}
                  placeholder="000000"
                  disabled={emailLoading}
                />
                <small>The code works on any device, so you can read the email on another phone.</small>
              </label>
            )}
            <button
              type="submit"
              className="mm-btn mm-btn--primary"
              disabled={emailLoading || !email.trim() || (shown === 'code' && otp.trim().length < MIN_CODE_LENGTH)}
            >
              {emailLoading ? (shown === 'code' ? 'Checking the code…' : 'Sending…') : shown === 'code' ? 'Verify and continue' : 'Email me a code'}
            </button>
            {shown === 'code' ? (
              <div className="auth-card__actions">
                <button type="button" className="auth-card__textbtn" onClick={sendCode} disabled={busy || resendIn > 0}>
                  {resendIn > 0 ? `Send a new code in ${resendIn}s` : 'Send a new code'}
                </button>
                <button type="button" className="auth-card__textbtn" onClick={switchEmail} disabled={emailLoading}>
                  Use a different email
                </button>
              </div>
            ) : (
              <div className="auth-card__actions auth-card__actions--center">
                <button type="button" className="auth-card__textbtn" onClick={() => go('choose')} disabled={busy}>
                  Use Google instead
                </button>
              </div>
            )}
          </form>
        )}
      </div>

      <p
        className="auth-card__status"
        role={error ? 'alert' : 'status'}
        data-kind={error ? 'error' : notice ? 'notice' : undefined}
      >
        {error || notice}
      </p>

      <p className="auth-card__switch">
        {isLogin ? 'New here?' : 'Already have an account?'}{' '}
        <Link href={otherHref}>{isLogin ? 'Create an account' : 'Log in'}</Link>
      </p>
      <p className="auth-card__fine">Your display name can appear on the Leaderboard. Your email is used for sign-in. You stay signed in on this device until you sign out.</p>
    </div>
  );
}
