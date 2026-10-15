"use client";

import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';

export const AUTH_SESSION_PRIMARY_CLASS = 'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-volt/30 bg-volt px-5 font-display text-sm font-extrabold text-black no-underline transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt disabled:cursor-wait disabled:opacity-70';
export const AUTH_SESSION_QUIET_CLASS = 'auth-session-quiet inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/15 px-5 font-display text-sm font-bold text-zinc-200 no-underline transition hover:border-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt';

export function AuthSessionScreen({
  title = 'Securing your session',
  message = 'Checking your MockMob profile...',
  error = '',
  actionHref = '/login',
  actionLabel = 'Back to login',
  errorTitle = 'Login needs attention',
  onAction = null,
  // A question for the student (for example "Continue to MockMob"): shown instead of the
  // progress bar, and the screen stops announcing itself as busy.
  children = null,
}) {
  const asking = Boolean(children) && !error;
  const actionClass = `mt-6 ${AUTH_SESSION_PRIMARY_CLASS}`;
  return (
    <div
      className="auth-session-bg flex min-h-screen items-center justify-center px-5 py-10"
      aria-busy={!error && !asking}
      role={asking ? undefined : 'status'}
    >
      <div className="auth-session-card w-full max-w-sm text-center">
        <Logo className="mb-5 justify-center" />
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-volt/25 bg-volt/10">
          <div className={error ? 'auth-session-mark auth-session-mark--error' : asking ? 'auth-session-mark auth-session-mark--ask' : 'auth-session-spinner'} />
        </div>
        <h1 className="font-display text-[30px] font-extrabold leading-tight text-white">{error ? errorTitle : title}</h1>
        <p className="mt-2 min-h-5 text-sm leading-6 text-zinc-400">
          {error || message}
        </p>
        {asking ? (
          <div className="mt-6 flex flex-col items-stretch gap-3">{children}</div>
        ) : !error ? (
          <div className="mt-6 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
            <div className="auth-session-bar h-full w-1/3" />
          </div>
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
      <style jsx global>{`
        /* Plain ground and a solid card: no glow, grid or scanlines behind a wait (web IA plan 7). */
        .auth-session-bg {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          background: #0b100e;
        }
        .auth-session-card {
          position: relative;
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 16px;
          background: #131a16;
          box-shadow: 0 24px 60px -30px rgba(0,0,0,0.6);
          padding: 32px;
        }
        /* Daylight variant: this screen precedes the Arena shell, so it must not flash dark. */
        html[data-theme='light'] .auth-session-bg { background: #f4f5f0; }
        html[data-theme='light'] .auth-session-card { border-color: #dce1d4; background: #fff; box-shadow: 0 24px 60px -30px rgba(20,32,14,0.25); }
        html[data-theme='light'] .auth-session-card :is(h1, .logo) { color: #172016; }
        html[data-theme='light'] .auth-session-card .logo .dot { color: #4f6400; }
        html[data-theme='light'] .auth-session-card p { color: #56624f; }
        html[data-theme='light'] .auth-session-card .bg-white\\/10 { background: #e6eadc; }
        .auth-session-spinner {
          width: 28px;
          height: 28px;
          border: 3px solid rgba(210, 240, 0, 0.18);
          border-top-color: var(--volt);
          border-radius: 999px;
          animation: mm-auth-spin 780ms linear infinite;
        }
        .auth-session-mark {
          width: 24px;
          height: 24px;
          border-radius: 999px;
          position: relative;
        }
        .auth-session-mark--error {
          background: rgba(248, 113, 113, 0.16);
          border: 1px solid rgba(248, 113, 113, 0.55);
        }
        .auth-session-mark--ask {
          background: rgba(210, 240, 0, 0.14);
          border: 1px solid rgba(210, 240, 0, 0.55);
        }
        .auth-session-mark--ask::before {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: var(--volt);
          transform: translate(-50%, -50%);
        }
        html[data-theme='light'] .auth-session-mark--ask::before { background: #4f6400; }
        html[data-theme='light'] .auth-session-quiet { border-color: #cfd6c4; color: #172016; }
        .auth-session-mark--error::before,
        .auth-session-mark--error::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          width: 12px;
          height: 2px;
          border-radius: 999px;
          background: #f87171;
        }
        .auth-session-mark--error::before { transform: translate(-50%, -50%) rotate(45deg); }
        .auth-session-mark--error::after { transform: translate(-50%, -50%) rotate(-45deg); }
        .auth-session-bar {
          background: var(--volt);
          animation: mm-auth-bar 1.15s ease-in-out infinite;
        }
        @keyframes mm-auth-spin { to { transform: rotate(360deg); } }
        @keyframes mm-auth-bar {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(360%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .auth-session-spinner,
          .auth-session-bar {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
