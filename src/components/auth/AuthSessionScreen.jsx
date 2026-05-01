"use client";

import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';

export function AuthSessionScreen({
  title = 'Securing your session',
  message = 'Checking your MockMob profile...',
  error = '',
  actionHref = '/login',
  actionLabel = 'Back to login',
}) {
  return (
    <div
      className="auth-session-bg flex min-h-screen items-center justify-center px-5 py-10"
      aria-busy={!error}
      role="status"
    >
      <div className="auth-session-card w-full max-w-sm text-center">
        <Logo className="mb-5 justify-center" />
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-volt/25 bg-volt/10">
          <div className={error ? 'auth-session-mark auth-session-mark--error' : 'auth-session-spinner'} />
        </div>
        <h1 className="font-display text-[30px] font-extrabold leading-tight text-white">{error ? 'Login needs attention' : title}</h1>
        <p className="mt-2 min-h-5 text-sm leading-6 text-zinc-400">
          {error || message}
        </p>
        {!error ? (
          <div className="mt-6 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
            <div className="auth-session-bar h-full w-1/3" />
          </div>
        ) : (
          <Link
            href={actionHref}
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl border border-volt/30 bg-volt px-5 font-display text-sm font-extrabold text-black no-underline transition hover:brightness-110"
          >
            {actionLabel}
          </Link>
        )}
      </div>
      <style jsx global>{`
        .auth-session-bg {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          background:
            radial-gradient(ellipse at 50% -22%, rgba(210, 240, 0, 0.18), rgba(210, 240, 0, 0.05) 34%, transparent 64%),
            linear-gradient(180deg, #090a08 0%, #050505 56%, #0a0a0a 100%);
        }
        .auth-session-bg::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -2;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 72px 72px;
          mask-image: linear-gradient(to bottom, rgba(0,0,0,0.95), transparent 78%);
        }
        .auth-session-bg::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.055), transparent 22%),
            repeating-linear-gradient(to bottom, rgba(255,255,255,0.035) 0, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 9px);
          opacity: 0.18;
        }
        .auth-session-card {
          position: relative;
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 16px;
          background:
            linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.016)),
            rgba(10,10,10,0.78);
          box-shadow: 0 24px 90px rgba(0,0,0,0.42);
          padding: 32px;
          backdrop-filter: blur(18px) saturate(130%);
          -webkit-backdrop-filter: blur(18px) saturate(130%);
        }
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
          background: linear-gradient(90deg, transparent, var(--volt), transparent);
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
