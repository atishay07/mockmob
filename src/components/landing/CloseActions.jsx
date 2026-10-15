'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Icon } from '@/components/ui/Icons';
import { useVisitor } from './useWayIn';
import '@/app/landing-close.css';

/**
 * The close band's actions: one clear primary key, the way to keep a record (sign up), with the sample one tap
 * away for a visitor who has not tried it (DemoJump brings it on screen), and the free line under them. The keys
 * follow the visitor: someone who has answered sample questions is not asked to try them again, and a signed-in
 * visitor gets the way back in instead of sign-up. While they are on screen the phone dock steps down
 * (data-close-in on the page, landing-close.css), so the screen shows one set of these actions, not two.
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
      <div className="mm-actions lp-close__actions">
        <Link href={kind === 'member' ? homeHref : signupHref} className="mm-btn mm-btn--primary">
          {kind === 'member' ? homeText : 'Start free'}
          <Icon name="arrow" className="mm-btn__icon" aria-hidden="true" />
        </Link>
        {kind === 'new' ? <a href="#try-practice" className="mm-btn mm-btn--secondary">Try 5 questions</a> : null}
      </div>
      {kind === 'member' ? null : <p className="lp-close__free"><Check size={16} aria-hidden="true" />Free to start. No card needed.</p>}
    </div>
  );
}

export default CloseActions;
