'use client';

import { MobileDock } from '@/components/MobileDock';
import { useAuth } from '@/components/AuthProvider';
import { recoveryReleased } from '@/../data/capabilities';
import { wayIn } from '@/components/landing/demoSignal.mjs';

// The landing's phone bar (owner decision LK83/LK88, 5 Nov 2026; re-made in round 4 for LK135): a guest gets two keys side
// by side, a ghost "Log in" and the volt "Start free" with its true line "No card needed" inside it (dock.css), the same
// from the hero to the footer and the same as every public page's bar (PublicDock); a signed-in student gets one key. It
// reads only who the visitor is, never the sample's state, so a reader who answers the five never sees it change its
// label. No note line. hideAtFooter: the bar leaves as the footer's top comes up to its own height above the screen's
// edge, so it never sits over the footer's links (ship gate, 4 Nov 2026); HeroDockGate keeps it down while the hero's
// own keys are on screen.
export function LandingDock() {
  const { isAuthenticated } = useAuth();
  const { dock } = wayIn({ signedIn: isAuthenticated, released: recoveryReleased() });
  return (
    <MobileDock
      note={null}
      label={dock.primary.label}
      href={dock.primary.href}
      secondary={dock.secondary}
      sub={dock.sub}
      hideAtFooter
    />
  );
}

export default LandingDock;
