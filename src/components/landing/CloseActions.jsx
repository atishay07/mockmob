'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useVisitor } from './useWayIn';
import '@/app/landing-close.css';

/**
 * The close band's actions: one primary key, the way to keep a record (sign up), with the sample one plain link
 * away for a visitor who has not tried it (DemoJump brings it on screen). "Free to start" is said in the hero and
 * the pricing, so it is not said again here. The keys follow the visitor: someone who has answered sample
 * questions is not asked to try them again, and a signed-in visitor gets the way back in instead of sign-up.
 * While they are on screen the phone dock steps down (data-close-in on the page, landing-close.css), so the
 * screen shows one set of these actions, not two.
 */
export function CloseActions() {
  const { kind, signupHref, homeHref, homeText } = useVisitor();
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
    <div className="lp-close__go" ref={ref} data-visitor={kind}>
      <div className="lp-close__actions">
        <Link href={kind === 'member' ? homeHref : signupHref} className="mm-btn mm-btn--primary">
          {kind === 'member' ? homeText : 'Start free'}
        </Link>
        {kind === 'new' ? <a href="#try-practice" className="lp-textlink">Try 5 questions</a> : null}
      </div>
    </div>
  );
}

export default CloseActions;
