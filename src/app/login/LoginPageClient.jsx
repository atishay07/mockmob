"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthSessionScreen } from '@/components/auth/AuthSessionScreen';
import { SignupCard } from '@/components/ui/SignupCard';
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
    <AuthShell
      title="Your next chapter is waiting."
      lead="Open your recorded mocks, saved questions and next practice step."
    >
      <SignupCard mode="login" />
    </AuthShell>
  );
}
