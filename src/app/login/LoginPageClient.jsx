"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { SignupCard } from '@/components/ui/SignupCard';
import { Icon } from '@/components/ui/Icons';
import { useAuth } from '@/components/AuthProvider';

export default function LoginPageClient() {
  const router = useRouter();
  const { status, needsOnboarding } = useAuth();

  useEffect(() => {
    if (status !== 'authenticated') return;
    router.replace(needsOnboarding ? '/onboarding' : '/dashboard');
  }, [status, needsOnboarding, router]);

  return (
    <div className="view relative min-h-screen overflow-hidden">
      <NavBar />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,rgba(210,240,0,0.12),transparent_70%)]" />

      <div className="container-wide relative z-10 px-5 pb-10 pt-[108px]">
        <section className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1">
              <Sparkles className="h-3.5 w-3.5 text-volt" />
              <span className="mono-label !text-zinc-300">Back to the MockMob arena</span>
            </div>
            <h1 className="display-lg mb-4">
              Continue the next rank jump with the <span className="text-volt italic">mob</span>.
            </h1>
            <p className="max-w-lg text-zinc-400">
              Pick up your mocks, radar, credits, and subject plan exactly where you left them.
            </p>
            <div className="mt-8 max-w-xs text-xs text-zinc-500">
              <Icon name="shield" style={{ display: 'inline', width: '14px', height: '14px', marginRight: '4px' }} />
              We only store your display name for the leaderboard. No spam ever.
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <SignupCard mode="login" />
          </div>
        </section>
      </div>
      <MarketingFooter />
    </div>
  );
}
