"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Icon } from '@/components/ui/Icons';
import { recoveryReleased } from '@/../data/capabilities';
import '@/app/nav-motion.css';

// Thumb-zone action bar. Mobile only — on desktop the nav CTA carries this
// job, so the bar is display:none rather than duplicated.
//
// With `children` the caller owns what the bar holds (the landing's state-aware keys, HeroDockGate.jsx).
// Otherwise it is a note and one key. A signed-in visitor is never offered sign-up or a sample question
// here: the key becomes "Go to practice", whatever the page asked for.
const SIGNED_OUT_ASKS = (href) => !href || href === '/signup' || href.startsWith('/#try-practice');

export function MobileDock({ note = 'Free to start. No card.', label, href, children }) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();

  if (children) {
    return (
      <>
        <div className="mm-dockpad" aria-hidden="true" />
        <div className="mm-dock mm-dock--keys" data-motion-dock="true">{children}</div>
      </>
    );
  }

  const home = isAuthenticated && SIGNED_OUT_ASKS(href);
  const resolvedHref = home ? (recoveryReleased() ? '/recovery' : '/dashboard') : href || '/signup';
  const resolvedLabel = home ? 'Go to practice' : label || 'Start free';

  return (
    <>
      <div className="mm-dockpad" aria-hidden="true" />
      <div className="mm-dock" data-motion-dock="true">
        <p className="mm-dock__note">{note}</p>
        {/* A jump within this page (the landing's "/#try-practice") never needs the route prefetched. */}
        <Link href={resolvedHref} prefetch={resolvedHref.split('#')[0] === pathname ? false : undefined} className="mm-btn mm-btn--primary">
          {resolvedLabel}
          <Icon name="arrow" className="mm-btn__icon" aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}
