'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { recoveryReleased } from '@/../data/capabilities';
import '@/app/landing-close.css';

// Where sign-up leads, and the signed-in way back in: the same routes as the hero's buttons (LandingActions).
function useWayIn() {
  const { isAuthenticated } = useAuth();
  const released = recoveryReleased();
  return {
    isAuthenticated,
    signupHref: released ? '/signup?next=%2Frecovery' : '/signup',
    homeHref: released ? '/recovery' : '/dashboard',
    homeText: released ? 'Find my first gap' : 'Go to Practice',
  };
}

/**
 * The close band's actions: sign up (the way to keep a record), the sample question one tap away (DemoJump
 * brings it on screen), and the free line under them. A signed-in visitor gets the way back in instead.
 * While they are on screen the phone dock steps down (data-close-in on the page, landing-close.css), so the
 * screen shows one set of these actions, not two.
 */
export function CloseActions() {
  const { isAuthenticated, signupHref, homeHref, homeText } = useWayIn();
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    const page = node?.closest('.mm.lp');
    if (!node || !page || typeof IntersectionObserver === 'undefined') return undefined;
    // On screen: between the sticky nav (64px) and the dock's slot (96px).
    const watch = new IntersectionObserver((entries) => {
      if (entries[entries.length - 1].isIntersecting) page.dataset.closeIn = 'true';
      else delete page.dataset.closeIn;
    }, { rootMargin: '-64px 0px -96px 0px', threshold: 0 });
    watch.observe(node);
    return () => { watch.disconnect(); delete page.dataset.closeIn; };
  }, []);

  return (
    <div className="lp-close__go" ref={ref}>
      <div className="mm-actions lp-close__actions">
        <Link href={isAuthenticated ? homeHref : signupHref} className="mm-btn mm-btn--primary">
          {isAuthenticated ? homeText : 'Sign up free'}
        </Link>
        <a href="#try-practice" className="mm-btn mm-btn--secondary">Try a CUET question</a>
      </div>
      <p className="lp-close__free"><Check size={16} aria-hidden="true" />Free to start. No card needed.</p>
    </div>
  );
}

/** The phone dock's two lines beside Mobi: the free line over a sign-up link (the dock's button tries a question). */
export function DockLine() {
  const { isAuthenticated, signupHref, homeHref, homeText } = useWayIn();
  return isAuthenticated ? (
    <><b className="lp-dockfree">Welcome back.</b><Link href={homeHref} className="lp-docklink">{homeText}</Link></>
  ) : (
    <><b className="lp-dockfree">Free to start.</b><Link href={signupHref} className="lp-docklink">Sign up</Link></>
  );
}

export default CloseActions;
