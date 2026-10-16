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
 * From the moment they enter the window, and through the footer below them, the phone dock steps down
 * (data-close-in on the page, landing-close.css), so the screen shows one set of these actions, not two.
 */
// The close's words follow the same visitor as its keys, so the heading and the volt key point at one thing: a new
// visitor is told what the free account keeps, someone who has answered the sample is told the next move is one
// sign-up away, and a signed-in student is sent back to their record. The server HTML carries the new visitor's.
const CLOSE_COPY = {
  new: { name: 'Start free.', rest: 'Your record and your next move, kept.', sub: 'Free keeps every mock, the chapters behind your misses and the next move. Try five questions first if you like.' },
  sampled: { name: 'Five questions.', rest: 'Then your next move.', sub: 'Start free to keep these answers and get the next move from your own record.' },
  member: { name: 'Your record is kept.', rest: 'Pick up the next move.', sub: 'Every mock and every chapter is where you left it.' },
};

export function CloseCopy() {
  const { kind } = useVisitor();
  const copy = CLOSE_COPY[kind] || CLOSE_COPY.new;
  return (
    <div className="lp-close__copy">
      <h2 className="lp-h2 lp-h2--xl" id="close-title"><span className="lp-h2__name">{copy.name}</span> <span className="lp-h2__rest">{copy.rest}</span></h2>
      <p className="lp-sub">{copy.sub}</p>
    </div>
  );
}

export function CloseActions() {
  const { kind, signupHref, homeHref, homeText } = useVisitor();
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    const page = node?.closest('.mm.lp');
    if (!node || !page || typeof IntersectionObserver === 'undefined') return undefined;
    // The dock retires as soon as this row enters the window (it would otherwise sit over these very keys), and
    // stays retired through the footer below it. Scrolling back above the close brings it back. The footer is
    // watched too because the close section is drawn lazily (content-visibility): once the reader is past it, its
    // inner boxes may not be laid out, so this row alone cannot say "the reader is below me".
    const footer = document.querySelector('footer');
    const seen = { row: false, footer: false };
    const apply = () => {
      if (seen.row || seen.footer) page.dataset.closeIn = 'true';
      else delete page.dataset.closeIn;
    };
    const watch = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const key = entry.target === node ? 'row' : 'footer';
        seen[key] = entry.isIntersecting && entry.boundingClientRect.height > 0;
      }
      apply();
    }, { threshold: 0 });
    watch.observe(node);
    if (footer) watch.observe(footer);
    return () => { watch.disconnect(); delete page.dataset.closeIn; };
  }, []);

  return (
    <div className="lp-close__go" ref={ref} data-visitor={kind}>
      <div className="lp-close__actions">
        <Link href={kind === 'member' ? homeHref : signupHref} className="mm-btn mm-btn--primary">
          {kind === 'member' ? homeText : kind === 'sampled' ? 'Start free and see your next move' : 'Start free'}
        </Link>
        {kind === 'new' ? <a href="#try-practice" className="lp-textlink">Try 5 questions</a> : null}
      </div>
    </div>
  );
}

export default CloseActions;
