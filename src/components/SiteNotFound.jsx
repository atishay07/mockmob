"use client";

// The page for a URL that matches no route at all (src/app/not-found.js). It carries the signed-in app's own not-found look
// (AppNotFound: the arena ground, the same headline, the same two actions), so a student on Night who follows an old link
// never meets a bare white page. It sits in the arena shell's scope (.app-shell) for its tokens: the Night palette by
// default, the Day palette when the visitor chose Day (the site's theme script has already set data-theme). "Go home"
// is "/": a signed-in student is sent on to Today by the front page, anyone else reads the front page.
import Link from 'next/link';
import ArenaHead from '@/components/arena/ArenaHead';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/components/AuthProvider';
import '@/app/(app)/arena.css';
import '@/app/(app)/student-pages.css';
import './site-not-found.css';

export default function SiteNotFound() {
  const { status } = useAuth();
  const signedIn = status === 'authenticated';
  return (
    <div className="view app-shell snf">
      <header className="snf__bar"><Logo /></header>
      <main id="app-main" className="snf__main" tabIndex={-1}>
        <div className="student-page">
          <ArenaHead
            title="That page is not here."
            lede={signedIn
              ? 'The link may be old, or the page may have moved. Your practice, your record and the question bank are all where you left them.'
              : 'The link may be old, or the page may have moved. The rest of MockMob is where it always was.'}
          />
          <p>
            <Link href="/" className="ui-state__action ui-state__action--primary mk-press">{signedIn ? 'Go to Today' : 'Go to the home page'}</Link>
            {signedIn ? <>{' '}<Link href="/dashboard" className="ui-state__action mk-press">Open Practice</Link></> : null}
          </p>
        </div>
      </main>
    </div>
  );
}
