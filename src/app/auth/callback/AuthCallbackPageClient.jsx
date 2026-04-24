"use client";

import React, { useEffect } from 'react';
import { Logo } from '@/components/Logo';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

const SESSION_RETRY_DELAYS = [0, 150, 300, 500];

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function AuthCallbackPageClient() {
  useEffect(() => {
    let mounted = true;

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
    };
  }, []);

  return (
    <div className="view min-h-screen flex items-center justify-center px-5">
      <div className="glass p-8 text-center max-w-sm w-full">
        <Logo className="mb-4 justify-center" />
        <h1 className="display-md mb-2">Securing your session…</h1>
        <p className="text-zinc-400 text-sm">Taking you to your workspace.</p>
      </div>
    </div>
  );
}
