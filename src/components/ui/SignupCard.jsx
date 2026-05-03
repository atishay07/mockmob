"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { LiquidGlassButton } from './LiquidGlassButton';
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

  return (
    <div
      className="glass w-full max-w-md overflow-hidden border border-white/10 bg-[rgba(255,255,255,0.02)] p-6 text-center md:p-7"
      style={{ maxWidth: 'min(28rem, calc(100vw - 40px))' }}
    >
      <h2 className="display-md mb-2">{isLogin ? 'Welcome back' : 'Create your account'}</h2>
      <p className="mb-7 break-words text-sm text-zinc-400">
        {isLogin
          ? 'Log in to continue your mocks, leaderboards, and weakness radar.'
          : 'Join the mob to unlock full access to community mocks, live leaderboards, and weakness radar.'}
      </p>

      <LiquidGlassButton variant="volt" size="lg" className="w-full min-w-0 justify-center px-4 text-[11px] sm:text-[13px]" onClick={handleGoogleUi} disabled={googleLoading || emailLoading}>
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z" />
        </svg>
        {googleLoading ? 'Redirecting...' : 'Continue with Google'}
      </LiquidGlassButton>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="mono-label !text-zinc-500">or</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <form className="flex flex-col gap-3 text-left" onSubmit={otpSent ? handleOtpVerify : handleEmailSubmit}>
        <label className="flex flex-col gap-2">
          <span className="mono-label">Email</span>
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
          <label className="flex flex-col gap-2">
            <span className="mono-label">Login code</span>
            <input
              className="input text-center !text-lg !tracking-[0.28em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="00000000"
              disabled={emailLoading}
            />
            <span className="text-xs leading-5 text-zinc-500">
              Open the email on any phone, read the 8-digit code, then type it here.
            </span>
          </label>
        )}
        <LiquidGlassButton
          variant="ghost"
          size="lg"
          className="w-full min-w-0 justify-center px-4 text-[11px] sm:text-[13px]"
          disabled={emailLoading || !email.trim() || (otpSent && otp.trim().length < 8)}
        >
          {emailLoading ? 'Working...' : otpSent ? 'Verify code and continue' : 'Send link and code'}
        </LiquidGlassButton>
      </form>

      <div className="mt-4 min-h-5 text-xs">
        {error ? <p className="text-red-400">{error}</p> : null}
        {!error && notice ? <p className="text-volt">{notice}</p> : null}
      </div>

      <p className="mt-6 text-sm text-zinc-500">
        {isLogin ? 'New here?' : 'Already have an account?'}{' '}
        <Link
          href={isLogin ? '/signup' : '/login'}
          className="inline-flex min-h-11 items-center text-volt transition-colors hover:text-[#e8ff4a]"
          style={{ minHeight: '44px', paddingInline: '4px' }}
        >
          {isLogin ? 'Create an account' : 'Log in'}
        </Link>
      </p>
    </div>
  );
}
