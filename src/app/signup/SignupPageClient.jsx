"use client";

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthSessionScreen } from '@/components/auth/AuthSessionScreen';
import { SignupCard } from '@/components/ui/SignupCard';
import { useAuth } from '@/components/AuthProvider';
import { postSignInPath } from '@/lib/auth-redirect';

export default function SignupPageClient() {
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
      title="Start your CUET 2027 practice."
      lead="Keep your recorded mocks, chapter mistakes and saved questions together."
      points={[
        'Quick Practice and Full Mock on free credits',
        'Radar shows the chapters behind recorded mistakes',
        'Choose Pro when unlimited practice fits your routine',
      ]}
    >
      <SignupCard />
    </AuthShell>
  );
}
