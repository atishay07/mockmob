'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { recoveryReleased } from '@/../data/capabilities';
import './footer-start.css';

// The footer's way in, on every marketing page: sign up or log in, or for a signed-in visitor the way back to
// practice. Quiet on purpose (an outlined key on the dark footer): the page above already carries the bright one.
// The sign-up and log-in pages leave it out, since they are that way in.
export function FooterStart() {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname() || '';
  if (/^\/(signup|login)(\/|$)/.test(pathname)) return null;
  const released = recoveryReleased();

  if (isAuthenticated) {
    return (
      <div className="mm-foot__start">
        <Link href={released ? '/recovery' : '/dashboard'} className="mm-foot__key">{released ? 'Find my first gap' : 'Go to Practice'}</Link>
      </div>
    );
  }
  return (
    <div className="mm-foot__start">
      <Link href={released ? '/signup?next=%2Frecovery' : '/signup'} className="mm-foot__key">Sign up free</Link>
      <Link href="/login" className="mm-foot__login">Log in</Link>
      <p className="mm-foot__free">Free to start. No card needed.</p>
    </div>
  );
}

export default FooterStart;
