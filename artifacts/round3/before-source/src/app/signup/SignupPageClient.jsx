"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthSessionScreen } from '@/components/auth/AuthSessionScreen';
import { SignupCard } from '@/components/ui/SignupCard';
import { useAuth } from '@/components/AuthProvider';

export default function SignupPageClient() {
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
    <AuthShell
      title="Start your CUET 2027 practice."
      lead="Create a free account and keep every attempt, weak chapter and saved question in one place."
      points={[
        'Quick Practice and Full Mock on free credits',
        'Radar maps every miss back to a chapter',
        'Upgrade to Pro only if you want more room',
      ]}
    >
      <SignupCard />
    </AuthShell>
  );
}
