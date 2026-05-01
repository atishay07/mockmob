"use client";

import React, { useEffect, useState } from 'react';
import { AuthSessionScreen } from '@/components/auth/AuthSessionScreen';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

const SESSION_RETRY_DELAYS = [0, 250, 600, 1000, 1600, 2400, 3200, 4500];
const RETRYABLE_PROFILE_STATUSES = [401, 404, 429, 500, 502, 503, 504];

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const PHASES = [
  'Verifying credentials...',
  'Loading your profile...',
  'Preparing your arena...',
];

export default function AuthCallbackPageClient() {
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const phaseTimer = setInterval(() => {
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
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            throw exchangeError;
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

          let res = null;
          try {
            res = await fetch('/api/auth/me', {
              cache: 'no-store',
              credentials: 'same-origin',
            });
          } catch {
            continue;
          }
          if (!mounted) return;

          if (!res.ok) {
            if (RETRYABLE_PROFILE_STATUSES.includes(res.status)) {
              continue;
            }
            throw new Error('MockMob could not load your profile after login.');
          }

          const data = await res.json();
          window.location.replace(data?.needsOnboarding ? '/onboarding' : '/dashboard');
          return;
        }

        throw new Error('Your session was created, but the profile check did not finish yet. Please try again.');
      } catch (authError) {
        if (mounted) {
          setError(authError?.message || 'We could not complete the login handshake. Please try again.');
        }
      }
    }

    finishAuth();
    return () => {
      mounted = false;
      clearInterval(phaseTimer);
    };
  }, []);

  return (
    <AuthSessionScreen
      message={PHASES[phase]}
      error={error}
      actionHref="/login"
      actionLabel="Try login again"
    />
  );
}
