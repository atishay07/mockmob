import React from 'react';
import Link from 'next/link';
import { AUDIENCE_CLASS, PUBLIC_DOCK, TODAY_HREF } from '@/lib/navigation';

// The landing's closing action (web IA plan 4.2, section 7). A guest is sent to the sample; a
// signed-in student goes to Today. Both are rendered and <html data-visitor> shows one before first
// paint (marketing-theme.css), so nobody sees the wrong button flash.
export function LandingActions() {
  return (
    <div className="mm-actions lp-close__actions">
      <Link href={PUBLIC_DOCK.href} className={`mm-btn mm-btn--primary ${AUDIENCE_CLASS.guest}`}>{PUBLIC_DOCK.label}</Link>
      <Link href={TODAY_HREF} className={`mm-btn mm-btn--primary ${AUDIENCE_CLASS.member}`}>Open MockMob</Link>
    </div>
  );
}
