'use client';

import { MobileDock } from '@/components/MobileDock';
import { useAuth } from '@/components/AuthProvider';

const LOG_IN = Object.freeze({ href: '/login', label: 'Log in' });

// The phone bar on the public pages (night 1105, R2-B): the home page's rule (owner LK83/LK88, 5 Nov 2026) on every page
// a first-time student reads. A guest gets two keys side by side, a ghost "Log in" and the volt "Sign up free"; a signed-in
// student gets one key back in ("Go to Practice", MobileDock's own). The page's note line (a fact about that page, such as
// "Your first Accountancy mock is free.") sits above the keys; note={null} leaves it out. hideAtFooter: the bar leaves as
// the footer comes up, as on the home page, so it never sits over the footer's links and needs no empty pad under them.
export function PublicDock({ note = null }) {
  const { isAuthenticated } = useAuth();
  return (
    <MobileDock
      note={note}
      label={isAuthenticated ? undefined : 'Sign up free'}
      secondary={isAuthenticated ? null : LOG_IN}
      hideAtFooter
    />
  );
}

export default PublicDock;
