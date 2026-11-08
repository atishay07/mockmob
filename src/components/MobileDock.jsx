"use client";
import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { readCheckoutStatus, readCheckoutStatusOnServer, subscribeCheckoutStatus } from '@/lib/payments/checkoutStatus';
import '@/app/nav-motion.css';
import '@/app/dock.css';

// Thumb-zone action bar. Mobile only — on desktop the nav CTA carries this
// job, so the bar is display:none rather than duplicated.
// On /pricing (checkoutAware) the dock follows the plan card: it never invites a payment while
// one is confirming, after money may have moved, or once Pro is active.
// hideAtFooter: the bar slides away as the page footer comes into view (96px early, its own height), so it never sits over the footer links.
// secondary ({ href, label }): a quiet ghost key before the volt one (the landing's guest "Log in", LK83). note={null}: no note line.
// sub: a short true line set inside the volt key under its label (round 4, owner LK135: "the CTA is a bit weak"), as the
// guest docks' "Sign up free" / "No card needed" (dock.css). Never shown on the signed-in, active or checkout keys.
export function MobileDock({ note = 'Free to start. No card.', label, href, secondary = null, sub = null, checkoutAware = false, isPremium = false, hideAtFooter = false }) {
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
  const resolvedLabel = stage === 'active' ? 'Go to Practice' : label || (isAuthenticated ? 'Go to Practice' : 'Sign up free');
  const resolvedNote = stage === 'active' ? 'Pro is active on this account.' : note;
  const showSecondary = stage !== 'active' && Boolean(secondary?.href && secondary?.label);
  const showSub = stage !== 'active' && !isAuthenticated && Boolean(sub);

  return (
    <>
      {/* With hideAtFooter the bar leaves before the footer arrives, so no pad is needed below the footer. */}
      {hideAtFooter ? null : <div className="mm-dockpad" aria-hidden="true" data-commerce={checkoutAware ? '' : undefined} />}
      <div className="mm-dock" data-motion-dock="true" data-commerce={checkoutAware ? '' : undefined} data-keys={showSecondary ? '2' : undefined} data-hidden={atFooter || yielding ? 'true' : undefined} inert={atFooter || yielding ? true : undefined}>
        {resolvedNote ? <p className="mm-dock__note">{resolvedNote}</p> : null}
        {showSecondary ? (
          <Link href={secondary.href} className="mm-btn mm-dock__ghost">
            {secondary.label}
          </Link>
        ) : null}
        {/* A jump within this page (the landing's "/#try-practice") never needs the route prefetched. */}
        <Link href={resolvedHref} prefetch={resolvedHref.split('#')[0] === pathname ? false : undefined} className={showSub ? 'mm-btn mm-btn--primary mm-dock__go' : 'mm-btn mm-btn--primary'}>
          {showSub ? (
            <>
              <span className="mm-dock__go-label">{resolvedLabel}</span>
              {/* Read as one name: "Sign up free, no card needed". */}
              <span className="mm-dock__go-sub"><span className="sr-only">, </span>{sub}</span>
            </>
          ) : resolvedLabel}
        </Link>
      </div>
    </>
  );
}

// One volt per screen (W-075): while the page's own volt button is on screen, the bar steps aside so that button is
// the only volt in view; it comes back when the button scrolls away. The nav's action is the quiet secondary button.
// A section marked data-dock-yield (/pricing's "Free or Pro") counts as the page's own action too: while the choice is on screen
// it carries both keys, so the bar never covers Free's card with a competing Get Pro (R4 pricing review, 6 Nov 2026).
// R8 PUB-11: a page's own action can mount after the bar does (the combo planner's sticky summary waits for the DU data), so new
// volt keys and yield sections inside main are picked up as they arrive (one re-scan a frame at most), and removed ones let go.
// Every <main> counts (a page can have two: AppViewNotice draws its own), as the selector always read 'main :is(...)'.
const VOLT_SELECTOR = 'main :is(.mm-btn--primary, .btn-volt, [data-dock-yield])';
function useVoltOnScreen() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const seen = new Set();
    const watched = new Set();
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) { if (entry.isIntersecting) seen.add(entry.target); else seen.delete(entry.target); }
      setOn(seen.size > 0);
    }, { rootMargin: '-64px 0px 0px 0px', threshold: 0 });
    const scan = () => {
      for (const el of watched) {
        if (!el.isConnected) { io.unobserve(el); watched.delete(el); seen.delete(el); }
      }
      for (const el of document.querySelectorAll(VOLT_SELECTOR)) {
        if (!watched.has(el) && !el.closest('.mm-dock, .mm-nav, .lp-dockgate')) { watched.add(el); io.observe(el); }
      }
      setOn(seen.size > 0);
    };
    scan();
    let frame = 0;
    const mo = typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; scan(); });
    });
    mo?.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo?.disconnect(); cancelAnimationFrame(frame); };
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
