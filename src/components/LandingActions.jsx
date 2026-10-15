"use client";

import React from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icons';
import { useWayIn } from '@/components/landing/useWayIn';

// The hero's two keys. A new visitor can try the five questions or sign up; a signed-in visitor is not offered
// either, only the way back to practice.
export function LandingActions({ mode = 'hero' }) {
  const { isAuthenticated, signupHref, homeHref, homeText } = useWayIn();
  const primaryHref = isAuthenticated ? homeHref : signupHref;
  const primaryText = isAuthenticated ? homeText : 'Start free';

  if (mode === 'primary' || isAuthenticated) {
    return (
      <div className="mm-actions">
        <Link href={primaryHref} className="mm-btn mm-btn--primary">
          {primaryText}
          <Icon name="arrow" className="mm-btn__icon" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <div className="mm-actions">
      {/* The five questions are on this page: an in-page jump never needs the route prefetched. */}
      <Link href="/#try-practice" prefetch={false} className="mm-btn mm-btn--primary">
        Try 5 questions
        <Icon name="arrow" className="mm-btn__icon" aria-hidden="true" />
      </Link>
      <Link href={signupHref} className="mm-btn mm-btn--secondary">Start free</Link>
    </div>
  );
}
