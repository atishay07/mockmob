"use client";

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { PUBLIC_DOCK, TODAY_HREF } from '@/lib/navigation';
import '@/app/nav-motion.css';

// The sticky public dock on phones (web IA plan 2.3). By default it says "Try 5 questions" and goes
// to the sample on the landing, from any page. A page may pass its own `label` and `href`. A
// signed-in student gets Open MockMob. On desktop the header carries this job, so the bar is
// display:none rather than duplicated.
export function MobileDock({ note = 'Free to start. No card.', label, href }) {
  const { isAuthenticated } = useAuth();

  const resolvedHref = isAuthenticated ? TODAY_HREF : href || PUBLIC_DOCK.href;
  const resolvedLabel = isAuthenticated ? 'Open MockMob' : label || PUBLIC_DOCK.label;

  return (
    <>
      <div className="mm-dockpad" aria-hidden="true" />
      <div className="mm-dock" data-motion-dock="true">
        <p className="mm-dock__note">{note}</p>
        <Link href={resolvedHref} className="mm-btn mm-btn--primary">{resolvedLabel}</Link>
      </div>
    </>
  );
}
