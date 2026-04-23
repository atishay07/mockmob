"use client";

import React from 'react';
import { Sparkles } from 'lucide-react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import { SignupCard } from '@/components/ui/SignupCard';
import { useAuth } from '@/components/AuthProvider';

export default function SignupPageClient() {
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
              <span className="mono-label !text-zinc-300">Join the MockMob arena</span>
            </div>
            <h1 className="display-lg mb-4">
              Build your next rank jump with the <span className="text-volt italic">mob</span>.
            </h1>
            <p className="max-w-lg text-zinc-400">
              Create your profile, sync your prep goals, and unlock curated mocks built by high performers.
            </p>
          </div>

          <div className="flex justify-center lg:justify-end">
            <SignupCard />
          </div>
        </section>
      </div>
      <MarketingFooter />
    </div>
  );
}
