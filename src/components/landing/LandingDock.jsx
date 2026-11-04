'use client';

import { useSyncExternalStore } from 'react';
import { MobileDock } from '@/components/MobileDock';
import { useAuth } from '@/components/AuthProvider';
import { recoveryReleased } from '@/../data/capabilities';
import { demoFinished, subscribeDemoState, wayIn } from '@/components/landing/demoSignal.mjs';

// The landing's phone bar is one real button whose label follows the visitor (L-008, L-009): a guest tries a CUET
// question, a guest who has answered all five signs up, a signed-in student goes back to Practice. The line beside it
// is words only, never a second link.
export function LandingDock() {
  const { isAuthenticated } = useAuth();
  const finished = useSyncExternalStore(subscribeDemoState, demoFinished, () => false);
  const way = wayIn({ signedIn: isAuthenticated, finished, released: recoveryReleased() });
  return (
    <MobileDock
      note={<span className="lp-dockmobi__line"><b className="lp-dockfree">{way.note}</b></span>}
      label={way.dock.label}
      href={way.dock.href}
    />
  );
}

export default LandingDock;
