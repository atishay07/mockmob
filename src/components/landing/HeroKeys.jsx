"use client";

import Link from 'next/link';
import { Icon } from '@/components/ui/Icons';
import { useVisitor } from './useWayIn';

// The hero's two keys. One primary, sign-up: "Start free". One secondary, the five-question sample on this page,
// which first asks for the visitor's subject. Both are in the server HTML, so they are on screen and working as
// links at first paint. They follow the visitor (useWayIn): a student who has answered sample questions is
// offered the way back to them, or another subject once finished; a signed-in student gets the way back to
// practice. The secondary key wears a slow light that runs round its edge (transform only; still under reduced
// motion).
export function HeroKeys() {
  const { kind, signupHref, homeHref, homeText, sample } = useVisitor();

  if (kind === 'member') {
    return (
      <div className="mm-actions lp-keys" data-visitor="member">
        <Link href={homeHref} className="mm-btn mm-btn--primary lp-key lp-key--go">
          {homeText}
          <Icon name="arrow" className="mm-btn__icon" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  const tryText = sample.done ? 'Try another subject' : sample.answered > 0 ? 'Back to your questions' : 'Try 5 questions';
  return (
    <div className="mm-actions lp-keys" data-visitor={kind}>
      <Link href={signupHref} className="mm-btn mm-btn--primary lp-key lp-key--go">
        Start free
        <Icon name="arrow" className="mm-btn__icon" aria-hidden="true" />
      </Link>
      {/* The sample is on this page: an in-page jump (DemoJump glides to it) never needs the route prefetched. */}
      <Link href="/#try-practice" prefetch={false} className="mm-btn mm-btn--secondary lp-key lp-key--try">
        <span className="lp-key__beam" aria-hidden="true" />
        <span className="lp-key__label">{tryText}</span>
      </Link>
    </div>
  );
}
