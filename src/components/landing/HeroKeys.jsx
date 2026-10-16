"use client";

import Link from 'next/link';
import { useVisitor } from './useWayIn';

// The hero's two keys. One primary, sign-up: "Start free". One secondary, the five-question sample on this page,
// which first asks for the visitor's subject. Both are in the server HTML, so they are on screen and working as
// links at first paint. They follow the visitor (useWayIn): a student who has answered sample questions is
// offered the way back to them, or another subject once finished; a signed-in student gets the way back to
// practice. They are the system's keys (a face over a hard bottom edge): solid volt and a quiet dark key, a lift
// under a fine pointer and a 100 ms press. Nothing moves on its own; the words say where each one goes.
export function HeroKeys() {
  const { kind, signupHref, homeHref, homeText, sample } = useVisitor();

  if (kind === 'member') {
    return (
      <div className="mm-actions lp-keys" data-visitor="member">
        <Link href={homeHref} className="mm-btn mm-btn--primary lp-key lp-key--go">{homeText}</Link>
      </div>
    );
  }

  // Once the sample is finished its card offers another subject itself, so this key only leads back to it.
  const tryText = sample.done ? 'Back to the sample' : sample.answered > 0 ? 'Back to your questions' : 'Try 5 questions';
  return (
    <div className="mm-actions lp-keys" data-visitor={kind}>
      <Link href={signupHref} className="mm-btn mm-btn--primary lp-key lp-key--go">Start free</Link>
      {/* The sample is on this page: an in-page jump (DemoJump glides to it) never needs the route prefetched. */}
      <Link href="/#try-practice" prefetch={false} className="mm-btn mm-btn--secondary lp-key lp-key--try">{tryText}</Link>
    </div>
  );
}
