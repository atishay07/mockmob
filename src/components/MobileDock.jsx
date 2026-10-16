"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import '@/app/nav-motion.css';

// Thumb-zone action bar. Mobile only — on desktop the nav CTA carries this
// job, so the bar is display:none rather than duplicated.
export function MobileDock({ note = 'Free to start. No card.', label, href }) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();

  const resolvedHref = href || (isAuthenticated ? '/dashboard' : '/signup');
  const resolvedLabel = label || (isAuthenticated ? 'Go to Practice' : 'Start free');

  return (
    <>
      <div className="mm-dockpad" aria-hidden="true" />
      <div className="mm-dock" data-motion-dock="true">
        <p className="mm-dock__note">{note}</p>
        {/* A jump within this page (the landing's "/#try-practice") never needs the route prefetched. */}
        <Link href={resolvedHref} prefetch={resolvedHref.split('#')[0] === pathname ? false : undefined} className="mm-btn mm-btn--primary">
          {resolvedLabel}
        </Link>
      </div>
    </>
  );
}
