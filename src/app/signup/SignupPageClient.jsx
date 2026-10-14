"use client";

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SignupCard } from '@/components/ui/SignupCard';
import { useAuth } from '@/components/AuthProvider';
import { postSignInPath } from '@/lib/auth-redirect';
import { AuthStage } from '@/app/login/AuthStage';

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

  return (
    <AuthStage mode="signup" status={status}>
      <SignupCard />
    </AuthStage>
  );
}
