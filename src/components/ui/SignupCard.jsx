"use client";

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { rememberNextPath } from '@/lib/auth-redirect';

const RESEND_WAIT_SECONDS = 60;
const MIN_CODE_LENGTH = 6;
const MAX_CODE_LENGTH = 10;
// Google refuses sign-in inside embedded browsers (Instagram, Facebook, WhatsApp, Android WebView).
const IN_APP_BROWSER_RE = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\/|WhatsApp|Snapchat|; wv\)/i;
const noSubscribe = () => () => {};
const readInAppBrowser = () => IN_APP_BROWSER_RE.test(window.navigator.userAgent || '');
const serverInAppBrowser = () => false;

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
  const inAppBrowser = useSyncExternalStore(noSubscribe, readInAppBrowser, serverInAppBrowser);
  const codeInputRef = useRef(null);
  const emailInputRef = useRef(null);
  // The primary key always looks ready (W-057: a dim key read as broken). Pressed with no email, it says why and
  // puts the cursor in the field instead.
  const [askEmail, setAskEmail] = useState(false);
  const isLogin = mode === 'login';

  useEffect(() => {
    // Remember where the student was going (validated; cleared when absent).
    rememberNextPath(new URLSearchParams(window.location.search).get('next'));
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
    try {
      const { error: sendError } = await signInWithEmail(cleanEmail);
      if (sendError) {
        if (sendError.retryAfterSeconds) setResendIn(Math.min(sendError.retryAfterSeconds, 3600));
        // A code may already be on its way: let the student type it.
        if (sendError.code === 'rate_limited') setOtpSent(true);
        setError(sendError.message || 'Could not send the code. Please try again.');
        return;
      }
      setOtp('');
      setOtpSent(true);
      setResendIn(RESEND_WAIT_SECONDS);
      setNotice(`We sent a code to ${cleanEmail}. It can take a minute; check Spam or Promotions too. You can also tap the button in that email.`);
    } catch {
      setError('Could not send the code. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim()) { setAskEmail(true); emailInputRef.current?.focus(); return; }
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

  const busy = googleLoading || emailLoading;
  const submitDisabled = emailLoading || (otpSent && otp.trim().length < MIN_CODE_LENGTH);

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

      {inAppBrowser ? (
        <p className="auth-card__status" data-kind="notice">
          Google sign-in does not work inside this app&apos;s browser. Open mockmob.in in Chrome, or use the email code below.
        </p>
      ) : null}

      <button type="button" className="mm-btn mm-btn--secondary" onClick={handleGoogleUi} disabled={busy}>
        <svg className="auth-card__google" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81z" />
          <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z" />
          <path fill="#FBBC05" d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.76l4.01-3.1z" />
          <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77z" />
        </svg>
        {googleLoading ? 'Opening Google…' : 'Continue with Google'}
      </button>

      <div className="auth-card__or">or use your email</div>

      <form className="auth-card__form" onSubmit={otpSent ? handleOtpVerify : handleEmailSubmit} noValidate={otpSent}>
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
            onChange={(event) => { setEmail(event.target.value); if (askEmail) setAskEmail(false); }}
            aria-invalid={askEmail || undefined}
            aria-describedby={askEmail ? 'auth-email-why' : undefined}
            placeholder="you@example.com"
            disabled={emailLoading}
            readOnly={otpSent}
          />
        </label>
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
        <button type="submit" className="mm-btn mm-btn--primary" disabled={submitDisabled}>
          {emailLoading ? (otpSent ? 'Checking the code…' : 'Sending…') : otpSent ? 'Verify code and continue' : 'Email me a sign-in code'}
        </button>
        {/* Pressed with no email: the reason, once, under the key. */}
        {askEmail && !otpSent ? <small className="auth-card__why" id="auth-email-why" role="alert">Enter your email first, and we send you a sign-in code.</small> : null}
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
      </form>

      <p
        className="auth-card__status"
        role={error ? 'alert' : 'status'}
        data-kind={error ? 'error' : notice ? 'notice' : undefined}
      >
        {error || notice}
      </p>

      <p className="auth-card__switch">
        {isLogin ? 'New here?' : 'Already have an account?'}{' '}
        <Link href={isLogin ? '/signup' : '/login'}>{isLogin ? 'Create an account' : 'Log in'}</Link>
      </p>
      <p className="auth-card__fine">{isLogin ? 'Your email is how you sign in.' : 'Your email is how you sign in, and you stay signed in on this device until you sign out.'}</p>
    </div>
  );
}
