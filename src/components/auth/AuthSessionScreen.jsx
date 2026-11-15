"use client";

import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import '@/components/ui/wait.css';
import './auth-session.css';

export const AUTH_SESSION_PRIMARY_CLASS = 'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-volt/30 bg-volt px-5 font-display text-sm font-extrabold text-black no-underline transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt disabled:cursor-wait disabled:opacity-70';
export const AUTH_SESSION_QUIET_CLASS = 'auth-session-quiet inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/15 px-5 font-display text-sm font-bold text-zinc-200 no-underline transition hover:border-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt';

export function AuthSessionScreen({
  title = 'Securing your session',
  message = 'Checking your MockMob profile…',
  error = '',
  actionHref = '/login',
  actionLabel = 'Back to sign in',
  errorTitle = 'Sign-in needs attention',
  onAction = null,
  // A question for the student (for example "Continue to MockMob"): shown instead of the
  // progress bar, and the screen stops announcing itself as busy.
  children = null,
}) {
  const asking = Boolean(children) && !error;
  // A plain wait (no question, no error): the logo and one line with the small working mark beside it, on the page's own
  // ground (lane "load", 16 Nov 2026). It was a card with a 56 px spinner tile, a 30 px heading and a sweeping bar that
  // measured nothing, the first thing every visitor to Log in and Sign up saw while the page checked for a session.
  const waiting = !error && !asking;
  const actionClass = `mt-6 ${AUTH_SESSION_PRIMARY_CLASS}`;
  if (waiting) {
    return (
      <div className="auth-session-bg flex min-h-screen items-center justify-center px-5 py-10" aria-busy="true" role="status">
        <div className="auth-session-card auth-session-card--wait w-full max-w-sm text-center">
          <Logo className="mb-4 justify-center" />
          <h1 className="sr-only">{title}</h1>
          <p className="auth-session-wait"><span className="mm-wait" aria-hidden="true" /><span>{message}</span></p>
        </div>
        </div>
    );
  }
  return (
    <div
      className="auth-session-bg flex min-h-screen items-center justify-center px-5 py-10"
      aria-busy={false}
      role={asking ? undefined : 'status'}
    >
      <div className="auth-session-card w-full max-w-sm text-center">
        <Logo className="mb-5 justify-center" />
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-volt/25 bg-volt/10">
          <div className={error ? 'auth-session-mark auth-session-mark--error' : 'auth-session-mark auth-session-mark--ask'} />
        </div>
        <h1 className="font-display text-[30px] font-extrabold leading-tight text-white">{error ? errorTitle : title}</h1>
        <p className="mt-2 min-h-5 text-sm leading-6 text-zinc-400">
          {error || message}
        </p>
        {asking ? (
          <div className="mt-6 flex flex-col items-stretch gap-3">{children}</div>
        ) : onAction ? (
          <button type="button" onClick={onAction} className={actionClass}>
            {actionLabel}
          </button>
        ) : (
          <Link href={actionHref} className={actionClass}>
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
