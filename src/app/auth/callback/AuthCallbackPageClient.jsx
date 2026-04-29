"use client";

import React, { useEffect, useState } from 'react';
import { Logo } from '@/components/Logo';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

const SESSION_RETRY_DELAYS = [0, 150, 300, 500];

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const PHASES = [
  'Verifying credentials…',
  'Loading your profile…',
  'Almost there…',
];

export default function AuthCallbackPageClient() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    let mounted = true;
    let phaseTimer = null;

    // Advance phase text every ~600ms so the user sees motion.
    phaseTimer = setInterval(() => {
      setPhase((p) => Math.min(PHASES.length - 1, p + 1));
    }, 600);

    async function finishAuth() {
      try {
        const supabase = getSupabaseBrowserClient();
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const authError = params.get('error_description') || params.get('error');

        if (authError) {
          throw new Error(authError);
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            throw error;
          }
        }

        for (const delay of SESSION_RETRY_DELAYS) {
          if (delay) {
            await sleep(delay);
          }

          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (!session) {
            continue;
          }

          const res = await fetch('/api/auth/me', {
            cache: 'no-store',
            credentials: 'same-origin',
          });
          if (!mounted) return;

          if (!res.ok) {
            if (res.status === 401) {
              continue;
            }
            break;
          }

          const data = await res.json();
          window.location.replace(data?.needsOnboarding ? '/onboarding' : '/dashboard');
          return;
        }

      } catch {
        // Ignore and fall through to the recovery redirect below.
      }

      if (mounted) {
        window.location.replace('/signup');
      }
    }

    finishAuth();
    return () => {
      mounted = false;
      if (phaseTimer) clearInterval(phaseTimer);
    };
  }, []);

  return (
    <div
      className="view min-h-screen flex items-center justify-center px-5"
      // Block any background interaction while we redirect.
      style={{ pointerEvents: 'none', userSelect: 'none' }}
      aria-busy="true"
      role="status"
    >
      <div className="glass p-8 text-center max-w-sm w-full" style={{ pointerEvents: 'auto' }}>
        <Logo className="mb-5 justify-center" />
        <div
          aria-hidden
          style={{
            width: 48, height: 48, margin: '0 auto 18px',
            border: '3px solid rgba(212,255,0,0.15)',
            borderTopColor: 'var(--volt)',
            borderRadius: '50%',
            animation: 'mm-auth-spin 800ms linear infinite',
          }}
        />
        <h1 className="display-md mb-1">Securing your session</h1>
        <p className="text-zinc-400 text-sm" style={{ minHeight: '20px' }}>
          {PHASES[phase]}
        </p>
        <div
          className="mt-5 h-1 rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.06)' }}
          aria-hidden
        >
          <div
            style={{
              height: '100%',
              width: '30%',
              background: 'linear-gradient(90deg, transparent, var(--volt), transparent)',
              animation: 'mm-auth-bar 1.2s ease-in-out infinite',
            }}
          />
        </div>
      </div>
      <style jsx global>{`
        @keyframes mm-auth-spin { to { transform: rotate(360deg) } }
        @keyframes mm-auth-bar {
          0%   { transform: translateX(-100%) }
          100% { transform: translateX(380%) }
        }
      `}</style>
    </div>
  );
}
