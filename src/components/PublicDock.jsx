'use client';

import { MobileDock } from '@/components/MobileDock';
import { useAuth } from '@/components/AuthProvider';
import { DOCK_GO } from '@/components/landing/demoSignal.mjs';

const LOG_IN = Object.freeze({ href: '/login', label: 'Log in' });

// The phone bar on the public pages (night 1105, R2-B): the home page's rule (owner LK83/LK88, 5 Nov 2026) on every page
// a first-time student reads, re-made in round 4 with the home page's bar (LK135, dock.css). A guest gets two keys side by
// side, a ghost "Log in" and the volt "Start free" with "No card needed" inside it (demoSignal.mjs DOCK_GO); a signed-in
// student gets one key back in ("Go to Practice", MobileDock's own). The page's note line (a fact about that page, such as
// "Your first Accountancy mock is free.") sits above the keys; note={null} leaves it out. hideAtFooter: the bar leaves as
// the footer comes up, as on the home page, so it never sits over the footer's links and needs no empty pad under them.
export function PublicDock({ note = null }) {
  const { isAuthenticated } = useAuth();
  return (
    <MobileDock
      note={note}
      label={isAuthenticated ? undefined : DOCK_GO.label}
      secondary={isAuthenticated ? null : LOG_IN}
      sub={isAuthenticated ? null : DOCK_GO.sub}
      hideAtFooter
    />
  );
}

export default PublicDock;
