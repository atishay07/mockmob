"use client";

import React, { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { readCheckoutStatus, readCheckoutStatusOnServer, subscribeCheckoutStatus } from '@/lib/payments/checkoutStatus';
import '@/app/nav-motion.css';

// Thumb-zone action bar. Mobile only — on desktop the nav CTA carries this
// job, so the bar is display:none rather than duplicated.
// On /pricing (checkoutAware) the dock follows the plan card: it never invites a payment while
// one is confirming, after money may have moved, or once Pro is active.
export function MobileDock({ note = 'Free to start. No card.', label, href, checkoutAware = false, isPremium = false }) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const checkout = useSyncExternalStore(subscribeCheckoutStatus, readCheckoutStatus, readCheckoutStatusOnServer);
  const stage = !checkoutAware ? 'open' : isPremium || checkout === 'active' ? 'active' : checkout;

  if (stage === 'confirming' || stage === 'hold') {
    return (
      <>
        <div className="mm-dockpad" aria-hidden="true" />
        <div className="mm-dock" data-motion-dock="true">
          <p className="mm-dock__note" role="status">
            {stage === 'confirming' ? 'Confirming your payment. Do not pay again.' : 'Payment not confirmed yet. Do not pay again; see the message on the plan.'}
          </p>
        </div>
      </>
    );
  }

  const resolvedHref = stage === 'active' ? '/dashboard' : href || (isAuthenticated ? '/dashboard' : '/signup');
  const resolvedLabel = stage === 'active' ? 'Go to Practice' : label || (isAuthenticated ? 'Go to Practice' : 'Start free');
  const resolvedNote = stage === 'active' ? 'Pro is active on this account.' : note;

  return (
    <>
      <div className="mm-dockpad" aria-hidden="true" />
      <div className="mm-dock" data-motion-dock="true">
        <p className="mm-dock__note">{resolvedNote}</p>
        {/* A jump within this page (the landing's "/#try-practice") never needs the route prefetched. */}
        <Link href={resolvedHref} prefetch={resolvedHref.split('#')[0] === pathname ? false : undefined} className="mm-btn mm-btn--primary">
          {resolvedLabel}
        </Link>
      </div>
    </>
  );
}
