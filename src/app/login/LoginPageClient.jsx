"use client";

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthSessionScreen } from '@/components/auth/AuthSessionScreen';
import { SignupCard } from '@/components/ui/SignupCard';
import { useAuth } from '@/components/AuthProvider';
import { postSignInPath } from '@/lib/auth-redirect';

export default function LoginPageClient() {
  const router = useRouter();
  const { status, needsOnboarding } = useAuth();
  const destinationRef = useRef(null);

  useEffect(() => {
    if (status !== 'authenticated') return;
    // Read the saved return page once (it is cleared on read).
    destinationRef.current ??= postSignInPath({ needsOnboarding });
    router.replace(destinationRef.current);
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
