"use client";

import React, { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { recoveryReleased } from '@/../data/capabilities';
import { demoAnswered, heroKeyClass, subscribeDemoAnswered } from '@/components/landing/demoSignal.mjs';

// After the first sample answer, at every width, the hero's lime key steps down so the sample's own key is the one lime key
// in view. Server render keeps the lime key.
function useHeroKeyClass() {
  const answered = useSyncExternalStore(subscribeDemoAnswered, demoAnswered, () => false);
  return heroKeyClass({ answered });
}

export function LandingActions({ mode = 'hero' }) {
  const { isAuthenticated } = useAuth();
  const heroKey = useHeroKeyClass();
  const primaryHref = isAuthenticated ? recoveryReleased() ? '/recovery' : '/dashboard' : recoveryReleased() ? '/signup?next=%2Frecovery' : '/signup';
  const primaryText = recoveryReleased() ? 'Find my first gap' : 'Start free practice';

  if (mode === 'primary') {
    return (
      <div className="mm-actions">
        <Link href={primaryHref} className="mm-btn mm-btn--primary">
          {primaryText}
        </Link>
      </div>
    );
  }

  return (
    <div className="mm-actions">
      {/* The five questions are on this page: an in-page jump never needs the route prefetched. */}
      <Link href={isAuthenticated ? primaryHref : '/#try-practice'} prefetch={isAuthenticated ? undefined : false} className={heroKey}>
        {isAuthenticated ? primaryText : 'Try five questions'}
      </Link>
      <Link href={isAuthenticated ? '/#try-practice' : primaryHref} prefetch={isAuthenticated ? false : undefined} className="mm-btn mm-btn--secondary">
        {isAuthenticated ? 'Try five questions' : primaryText}
      </Link>
    </div>
  );
}
