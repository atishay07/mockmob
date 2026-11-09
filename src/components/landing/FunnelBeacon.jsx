"use client";

import { useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { trackFunnel } from '@/lib/funnel';

// The home page's part of the aggregate funnel (10 Nov 2026; the calls docs/brain/FUNNEL-CALLS-1016.md listed for the
// landing and never got, because the landing was on another branch then). It counts steps, not people: the helper sends
// only the step's name, once per step per page load, with no cookie and no id, and does nothing under Do Not Track or
// Global Privacy Control (src/lib/funnel.js). The server adds 1 to today's count for that step and the visitor's kind of
// device, and only while FUNNEL_ENABLED is "true" (src/app/api/funnel/route.js); off, every call is an empty answer.
//
//   landing_view   a signed-out visitor's page load (a student already signed in is not a visitor to convert)
//   signup_click   the first press of any way in to /signup on this page: hero, phone bar, sample result, plan, close, site bar
//   login_click    the first press of any way in to /login (counted beside the funnel, not inside it)
// The sample's own steps (sample_started, sample_subject_chosen, sample_done) are sent by DemoDrill where they happen.
// One listener on the document reads the pressed link's own href, so no key on the page needed a handler of its own and a
// key added later is counted without another edit.
export function FunnelBeacon() {
  const { status } = useAuth();
  const guest = status === 'unauthenticated';

  useEffect(() => {
    if (!guest) return undefined;
    trackFunnel('landing_view');
    const onClick = (event) => {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      const href = link?.getAttribute('href') || '';
      if (/^\/signup(?:[/?#]|$)/.test(href)) trackFunnel('signup_click');
      else if (/^\/login(?:[/?#]|$)/.test(href)) trackFunnel('login_click');
    };
    // Capture: counted even when the link's own handler stops the event on its way up.
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [guest]);

  return null;
}

export default FunnelBeacon;
