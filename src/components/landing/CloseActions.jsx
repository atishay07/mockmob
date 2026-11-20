'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { recoveryReleased } from '@/../data/capabilities';
import { wayIn } from '@/components/landing/demoSignal.mjs';
import { INVITE_FIELD_HREF, REFERRAL_COPY } from '@/lib/referrals/friendInvite.mjs';
import '@/app/landing-close.css';

/**
 * The close band's actions (owner decision LK83/LK88, 5 Nov 2026): a guest gets "Sign up free" and "Log in" (the same
 * routes as the hero and the phone dock, wayIn), and the free line under them; a signed-in student gets one key back
 * in. The sample is not offered here: it is the hero's. While the actions are on screen the phone dock steps down
 * (data-close-in on the page, landing-close.css), so the screen shows one set of these actions, not two.
 * R3-D9 (owner LK110, 5 Nov 2026): while friend invites are on (`invites`, the server's referralsLive(), the switch /signup
 * reads), a guest also gets one line on where a friend's invite code goes, linking to the sign-up page's invite field. Never a
 * code on this page: codes are a signed-in student's own (/api/referrals).
 */
export function CloseActions({ invites = false }) {
  const { isAuthenticated } = useAuth();
  const way = wayIn({ signedIn: isAuthenticated, released: recoveryReleased() });
  const homeHref = way.home.href;
  const signupHref = way.signup.href;
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
          {isAuthenticated ? way.home.label : way.signup.label}
        </Link>
        {isAuthenticated ? null : <Link href={way.login.href} prefetch={false} className="mm-btn mm-btn--secondary">{way.login.label}</Link>}
      </div>
      <p className="lp-close__free"><Check size={16} aria-hidden="true" />Free to start. No card needed.</p>
      {invites && !isAuthenticated ? (
        <p className="lp-close__invite">
          {REFERRAL_COPY.homeInviteAsk} <Link href={INVITE_FIELD_HREF} prefetch={false}>{REFERRAL_COPY.homeInviteLink}</Link>. {REFERRAL_COPY.homeInviteReward()}
        </p>
      ) : null}
    </div>
  );
}

export default CloseActions;
