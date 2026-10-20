"use client";

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthSessionScreen } from '@/components/auth/AuthSessionScreen';
import { SignupCard } from '@/components/ui/SignupCard';
import { useAuth } from '@/components/AuthProvider';
import { postSignInPath } from '@/lib/auth-redirect';

export default function LoginPageClient({ invite = false }) {
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
        message={status === 'authenticated' ? 'Opening MockMob…' : 'Checking your sign-in…'}
      />
    );
  }

  return (
    <AuthShell
      title={invite ? 'Sign in to take your seat.' : 'Your next chapter is waiting.'}
      lead={invite ? 'Your friend saved you a seat in a Mob. Sign in, and you come straight back to the invite to pick your Fold.' : 'Open your recorded mocks, saved questions and next practice step.'}
      points={invite ? [
        'Joining a Mob is free',
        'Only your Mob sees your name',
        'You can leave a Mob any time',
      ] : [
        'Today opens on your next step, worked out from your own papers',
        'Your mocks, mistakes and repairs stay with your account',
        'You stay signed in on this device until you sign out',
      ]}
    >
      <SignupCard mode="login" />
    </AuthShell>
  );
}
