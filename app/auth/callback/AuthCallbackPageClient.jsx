"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function AuthCallbackPageClient() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    async function finishAuth() {
      try {
        const supabase = getSupabaseBrowserClient();
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');

        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }

        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!mounted) return;

        if (!res.ok) {
          router.replace('/signup');
          return;
        }

        const data = await res.json();
        router.replace(data?.needsOnboarding ? '/onboarding' : '/dashboard');
      } catch {
        if (mounted) router.replace('/signup');
      }
    }

    finishAuth();
    return () => {
      mounted = false;
    };
  }, [router]);

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

