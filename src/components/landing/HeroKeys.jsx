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

  // Once the sample is finished its card offers another subject itself, so this key only leads back to it. Each label
  // stays on one line in a half-width key at 360 to 390 px, and Start free stays volt in every state. On wide
  // screens the finished card sits right beside the keys, so the key steps aside there (hero-v3.css, data-sample).
  const tryText = sample.done ? 'Back to the sample' : sample.answered > 0 ? 'Your questions' : 'Try 5 questions';
  return (
    <div className="mm-actions lp-keys" data-visitor={kind} data-sample={sample.done ? 'done' : undefined}>
      {/* After the sample, wide screens name its one next move on the key (the card beside it hides its own key);
          phones keep the short label, since the card's own key names the chapter there. */}
      <Link href={signupHref} className="mm-btn mm-btn--primary lp-key lp-key--go">
        {/* One inline run of text: the key is a flex box with a gap, so a second flex item would open a double space. */}
        <span>Start free{sample.done && sample.focus ? <span className="lp-key__move"> and practise {sample.focus}</span> : null}</span>
      </Link>
      {/* The sample is on this page: an in-page jump (DemoJump glides to it) never needs the route prefetched. */}
      <Link href="/#try-practice" prefetch={false} className="mm-btn mm-btn--secondary lp-key lp-key--try">{tryText}</Link>
    </div>
  );
}
