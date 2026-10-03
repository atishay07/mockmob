"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

export function SignupCard({ mode = 'signup' }) {
  const { signInWithGoogle, signInWithEmail, verifyEmailOtp } = useAuth();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const isLogin = mode === 'login';

  const handleGoogleUi = async () => {
    setError('');
    setNotice('');
    setGoogleLoading(true);
    try {
      const { error: oauthError } = await signInWithGoogle();
      if (oauthError) {
        setError(oauthError.message || 'Google sign-in failed.');
      }
    } catch {
      setError('Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) return;

    setError('');
    setNotice('');
    setEmailLoading(true);
    try {
      const { error: otpError } = await signInWithEmail(cleanEmail);
      if (otpError) {
        setError(otpError.message || 'Email sign-in failed.');
        return;
      }
      setOtpSent(true);
      setNotice('Check your email for the login button or 8-digit code. The code works on any device with this email address.');
    } catch {
      setError('Email sign-in failed. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleOtpVerify = async (event) => {
    event.preventDefault();
    const cleanEmail = email.trim();
    const cleanOtp = otp.trim();
    if (!cleanEmail || cleanOtp.length < 8) return;

    setError('');
    setNotice('');
    setEmailLoading(true);
    try {
      const { error: verifyError } = await verifyEmailOtp(cleanEmail, cleanOtp);
      if (verifyError) {
        setError(verifyError.message || 'That code did not work.');
      }
    } catch {
      setError('Could not verify the code. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  const busy = googleLoading || emailLoading;
  const submitDisabled = emailLoading || !email.trim() || (otpSent && otp.trim().length < 8);

  return (
    <div className="auth-card">
      <div className="auth-card__head">
        <h2>{isLogin ? 'Welcome back' : 'Create your account'}</h2>
        <p>
          {isLogin
            ? 'Open your recorded mocks, saved questions and chapter review.'
            : 'Free to start. No card needed. Your practice, Radar and saved questions stay with your account.'}
        </p>
      </div>

      <button type="button" className="mm-btn mm-btn--secondary" onClick={handleGoogleUi} disabled={busy}>
        <svg className="auth-card__google" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81z" />
          <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z" />
          <path fill="#FBBC05" d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.76l4.01-3.1z" />
          <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77z" />
        </svg>
        {googleLoading ? 'Redirecting...' : 'Continue with Google'}
      </button>

      <div className="auth-card__or">or use your email</div>

      <form className="auth-card__form" onSubmit={otpSent ? handleOtpVerify : handleEmailSubmit}>
        <label className="auth-field">
          <span>Email</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            disabled={emailLoading}
          />
        </label>
        {otpSent && (
          <label className="auth-field auth-field--code">
            <span>Login code</span>
            <input
              className="input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="00000000"
              disabled={emailLoading}
            />
            <small>Open the email on any phone, read the 8-digit code, then type it here.</small>
          </label>
        )}
        <button type="submit" className="mm-btn mm-btn--primary" disabled={submitDisabled}>
          {emailLoading ? 'Working...' : otpSent ? 'Verify code and continue' : 'Email me a login link'}
        </button>
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
      <p className="auth-card__fine">Your display name appears on the practice board. Your email is used for sign-in.</p>
    </div>
  );
}
