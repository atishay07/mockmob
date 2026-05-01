"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { AuthSessionScreen } from '@/components/auth/AuthSessionScreen';
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

  if (status === 'loading' || status === 'authenticated') {
    return (
      <AuthSessionScreen
        message={status === 'authenticated' ? 'Opening your dashboard...' : 'Checking existing session...'}
      />
    );
  }

  return (
    <div className="view relative min-h-screen overflow-hidden bg-[#070807]">
      <NavBar />
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse at 50% -18%, rgba(210,240,0,0.18), rgba(210,240,0,0.05) 34%, transparent 64%), linear-gradient(180deg, #090a08 0%, #050505 55%, #0a0a0a 100%)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />

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
