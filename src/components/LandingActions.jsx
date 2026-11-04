"use client";
import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn

import React, { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { recoveryReleased } from '@/../data/capabilities';
import { SAMPLE, demoAnswered, heroKeyClass, subscribeDemoAnswered, wayIn } from '@/components/landing/demoSignal.mjs';

// After the first sample answer, at every width, the hero's lime key steps down so the sample's own key is the one lime key
// in view. Server render keeps the lime key. Its words never change.
function useHeroKeyClass() {
  const answered = useSyncExternalStore(subscribeDemoAnswered, demoAnswered, () => false);
  return heroKeyClass({ answered });
}

/**
 * The hero's ways in (owner decision LK83/LK88, 5 Nov 2026). A guest: "Sign up free" is the volt key, "Try 5 questions
 * first" under it brings the sample card on screen (DemoJump), and one quiet line offers "Log in". A signed-in student
 * gets one key back in (never "Sign up free" or the guest's sample key, L-006).
 */
export function LandingActions({ mode = 'hero' }) {
  const { isAuthenticated } = useAuth();
  const heroKey = useHeroKeyClass();
  const way = wayIn({ signedIn: isAuthenticated, released: recoveryReleased() });
  const primary = isAuthenticated ? way.home : way.signup;

  if (mode === 'primary' || isAuthenticated) {
    return (
      <div className="mm-actions">
        <Link href={primary.href} className={mode === 'primary' ? 'mm-btn mm-btn--primary' : heroKey}>
          {primary.label}
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mm-actions">
        <Link href={primary.href} className={heroKey}>
          {primary.label}
        </Link>
        {/* The five questions are on this page: an in-page jump never needs the route prefetched. */}
        <Link href={SAMPLE.href} prefetch={false} className="mm-btn mm-btn--secondary">
          {SAMPLE.label}
        </Link>
      </div>
      <p className="lp-cta__login">
        Have an account? <Link href={way.login.href}>{way.login.label}</Link>
      </p>
    </>
  );
}
