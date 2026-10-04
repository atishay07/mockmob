"use client";

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { Icon } from '@/components/ui/Icons';
import { recoveryReleased } from '@/../data/capabilities';

export function LandingActions({ mode = 'hero' }) {
  const { isAuthenticated } = useAuth();
  const primaryHref = isAuthenticated ? recoveryReleased() ? '/recovery' : '/dashboard' : recoveryReleased() ? '/signup?next=%2Frecovery' : '/signup';
  const primaryText = recoveryReleased() ? 'Find my first gap' : 'Start free practice';

  if (mode === 'primary') {
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
      <Link href={isAuthenticated ? primaryHref : '/#try-practice'} className="mm-btn mm-btn--primary">
        {isAuthenticated ? primaryText : 'Try five questions'}
        <Icon name="arrow" className="mm-btn__icon" aria-hidden="true" />
      </Link>
      <Link href={isAuthenticated ? '/#try-practice' : primaryHref} className="mm-btn mm-btn--secondary">
        {isAuthenticated ? 'Try five questions' : primaryText}
      </Link>
    </div>
  );
}
