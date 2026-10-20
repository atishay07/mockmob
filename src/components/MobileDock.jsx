"use client";

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { readCheckoutStatus, readCheckoutStatusOnServer, subscribeCheckoutStatus } from '@/lib/payments/checkoutStatus';
import '@/app/nav-motion.css';

// Thumb-zone action bar. Mobile only — on desktop the nav CTA carries this
// job, so the bar is display:none rather than duplicated.
// On /pricing (checkoutAware) the dock follows the plan card: it never invites a payment while
// one is confirming, after money may have moved, or once Pro is active.
// hideAtFooter: the bar slides away as the page footer comes into view (96px early, its own height), so it never sits over the footer links.
export function MobileDock({ note = 'Free to start. No card.', label, href, checkoutAware = false, isPremium = false, hideAtFooter = false }) {
  const { isAuthenticated } = useAuth();
  const atFooter = useFooterInView(hideAtFooter);
  const yielding = useVoltOnScreen();
  const pathname = usePathname();
  const checkout = useSyncExternalStore(subscribeCheckoutStatus, readCheckoutStatus, readCheckoutStatusOnServer);
  const stage = !checkoutAware ? 'open' : isPremium || checkout === 'active' ? 'active' : checkout;

  if (stage === 'confirming' || stage === 'hold') {
    return (
      <>
        <div className="mm-dockpad" aria-hidden="true" data-commerce={checkoutAware ? '' : undefined} />
        <div className="mm-dock" data-motion-dock="true" data-commerce={checkoutAware ? '' : undefined}>
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
      {/* With hideAtFooter the bar leaves before the footer arrives, so no pad is needed below the footer. */}
      {hideAtFooter ? null : <div className="mm-dockpad" aria-hidden="true" data-commerce={checkoutAware ? '' : undefined} />}
      <div className="mm-dock" data-motion-dock="true" data-commerce={checkoutAware ? '' : undefined} data-hidden={atFooter || yielding ? 'true' : undefined} inert={atFooter || yielding ? true : undefined}>
        <p className="mm-dock__note">{resolvedNote}</p>
        {/* A jump within this page (the landing's "/#try-practice") never needs the route prefetched. */}
        <Link href={resolvedHref} prefetch={resolvedHref.split('#')[0] === pathname ? false : undefined} className="mm-btn mm-btn--primary">
          {resolvedLabel}
        </Link>
      </div>
    </>
  );
}

// One volt per screen (W-075): while the page's own volt button is on screen, the bar steps aside so that button is
// the only volt in view; it comes back when the button scrolls away. The nav's action is the quiet secondary button.
function useVoltOnScreen() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const buttons = [...document.querySelectorAll('main :is(.mm-btn--primary, .btn-volt)')].filter((el) => !el.closest('.mm-dock, .mm-nav, .lp-dockgate'));
    if (!buttons.length) return undefined;
    const seen = new Set();
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) { if (entry.isIntersecting) seen.add(entry.target); else seen.delete(entry.target); }
      setOn(seen.size > 0);
    }, { rootMargin: '-64px 0px 0px 0px', threshold: 0 });
    buttons.forEach((button) => io.observe(button));
    return () => io.disconnect();
  }, []);
  return on;
}

function useFooterInView(enabled) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === 'undefined') return undefined;
    const foot = document.querySelector('.mm-foot');
    if (!foot) return undefined;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0, rootMargin: '0px 0px 96px 0px' });
    io.observe(foot);
    return () => io.disconnect();
  }, [enabled]);
  return enabled && inView;
}
