"use client";

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { Icon } from '@/components/ui/Icons';

// Thumb-zone action bar. Mobile only — on desktop the nav CTA carries this
// job, so the bar is display:none rather than duplicated.
export function MobileDock({ note = 'Free to start. No card.', label, href }) {
  const { isAuthenticated } = useAuth();

  const resolvedHref = href || (isAuthenticated ? '/dashboard' : '/signup');
  const resolvedLabel = label || (isAuthenticated ? 'Go to Arena' : 'Start free');

  return (
    <>
      <div className="mm-dockpad" aria-hidden="true" />
      <div className="mm-dock">
        <p className="mm-dock__note">{note}</p>
        <Link href={resolvedHref} className="mm-btn mm-btn--primary">
          {resolvedLabel}
          <Icon name="arrow" className="mm-btn__icon" aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}
