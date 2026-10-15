'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWayIn } from './landing/useWayIn';
import './footer-start.css';

// The footer's way in, on every marketing page: one clear primary key (sign up, or for a signed-in visitor the way
// back to practice), with log in beside it. The sign-up and log-in pages leave it out, since they are that way in.
export function FooterStart() {
  const { isAuthenticated, signupHref, homeHref, homeText } = useWayIn();
  const pathname = usePathname() || '';
  if (/^\/(signup|login)(\/|$)/.test(pathname)) return null;

  if (isAuthenticated) {
    return (
      <div className="mm-foot__start">
        <Link href={homeHref} className="mm-foot__key">{homeText}</Link>
      </div>
    );
  }
  return (
    <div className="mm-foot__start">
      <Link href={signupHref} className="mm-foot__key">Start free</Link>
      <Link href="/login" className="mm-foot__login">Log in</Link>
      <p className="mm-foot__free">Free to start. No card needed.</p>
    </div>
  );
}

export default FooterStart;
