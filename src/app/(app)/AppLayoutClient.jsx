"use client";

import React, { useCallback, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useWalletSummary } from '@/components/useWalletSummary';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/lib/roleContext';
import { AuthSessionScreen } from '@/components/auth/AuthSessionScreen';
import { loginPathFor } from '@/lib/auth-redirect';
import { useResumableTest } from '@/components/VisitorSync';
import { appNavigation, shellGate, titleForPath } from '@/lib/navigation';
import { AppBottomBar, AppSidebar, AppTopbar } from '@/components/shell/AppNav';
import { GuideTour, useGuideTour } from '@/components/shell/GuideTour';
import { ShellPageSkeleton, ShellUnavailable } from '@/components/shell/ShellStates';
import './arena.css';
import './student-pages.css';
import './explore/explore.css';
import './arena-support.css';
import '@/components/study/study.css';

// The signed-in shell. It no longer waits for the sign-in check before drawing anything
// (plan section 6, fix 1): while the first check runs, a member (by the stored hint, through
// <html data-visitor>) sees the real shell with a page skeleton, and the page itself mounts once the
// session is confirmed, so nothing private is ever drawn from the hint. Anyone the hint does not know
// as a member sees the session screen instead; CSS picks between the two, so the server HTML is
// the same for everyone. Only a confirmed signed-out check sends the visitor to log in, and a check
// that could not reach MockMob keeps the shell with a "Can't reach MockMob" state (members only;
// anyone else gets the same state without the claim that they are signed in).
export default function AppLayoutClient({ children, previewRoute = null, previewLinks = null, studyEnabled = false }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status, signOut, refreshSession } = useAuth();
  const { isModerator } = useRole();
  const activePath = previewRoute || pathname;
  const isTestRoute = activePath.startsWith('/test');
  const wallet = useWalletSummary(user?.id);
  const resume = useResumableTest();
  const gate = shellGate({ status, path: pathname, moderator: isModerator });
  const confirmed = gate === 'ready' || gate === 'checking';
  const tour = useGuideTour({ userId: user?.id, ready: gate === 'ready' && !isTestRoute });

  useEffect(() => {
    if (gate === 'signedOut') {
      // A returning student lands on login (not signup) and comes back to this page after.
      router.replace(loginPathFor(`${window.location.pathname}${window.location.search}`));
    }
  }, [gate, router]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  useEffect(() => {
    if (gate === 'checking') router.replace('/dashboard');
  }, [gate, router]);

  const handleSignOut = useCallback(async () => { await signOut(); router.push('/'); }, [signOut, router]);
  const retry = useCallback(() => refreshSession({ silent: false }), [refreshSession]);

  // Confirmed signed out: no shell, no page. The redirect above is already on its way.
  if (gate === 'signedOut') {
    return <AuthSessionScreen title="Taking you to log in" message="You are signed out on this device." />;
  }

  const showStudy = studyEnabled || previewRoute === '/learn';
  const nav = appNavigation({ studyEnabled: showStudy, moderator: isModerator, testRoute: isTestRoute });
  const title = titleForPath(activePath, nav);
  const page = gate === 'ready' ? children
    : gate === 'unavailable' ? <ShellUnavailable onRetry={retry} signedIn />
    : <ShellPageSkeleton label={gate === 'checking' ? 'Checking your access' : 'Loading your page'} />;

  return (
    <>
      {/* While the first check runs only a hinted member sees the shell (vs-member-only). */}
      <div className={gate === 'pending' || gate === 'unavailable' ? 'vs-member-only' : undefined}>
        <div className={`view app-shell ${isTestRoute ? 'app-shell--test' : ''}`} data-shell-gate={gate} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <AppSidebar nav={nav} activePath={activePath} previewLinks={previewLinks} />

          {!isTestRoute && (
            <AppTopbar
              title={title}
              user={user}
              confirmed={confirmed}
              isModerator={isModerator}
              wallet={wallet}
              resume={resume}
              onGuide={tour.start}
              onSignOut={handleSignOut}
            />
          )}

          <main className={`app-main ${isTestRoute ? 'app-main--test' : 'px-4 py-6 md:px-5 md:py-8'}`} style={{ flex: 1, position: 'relative' }}>
            <div className="arena-backdrop" aria-hidden="true" />
            <div className={`${isTestRoute ? 'test-content-host' : 'container-std'} relative z-10`}>
              {page}
            </div>
          </main>
          {!isTestRoute && (
            <AppBottomBar nav={nav} activePath={activePath} previewLinks={previewLinks} resume={resume} isPremium={confirmed ? Boolean(user?.isPremium) : null} />
          )}
          {!isTestRoute ? <GuideTour tour={tour} /> : null}
          <style>{`
            .app-shell--test .app-main--test {
              padding: 0;
            }
            .app-shell--test .test-content-host {
              width: 100%;
              max-width: none;
              margin: 0;
            }
          `}</style>
        </div>
      </div>
      {gate === 'pending' ? (
        <div className="vs-guest-only">
          <AuthSessionScreen message="Loading your session..." />
        </div>
      ) : null}
      {/* The check could not reach MockMob and nothing says this browser held a member: no claim
          about their sign-in, just the way to try again. */}
      {gate === 'unavailable' ? (
        <div className="vs-guest-only shell-unavail-host">
          <ShellUnavailable onRetry={retry} signedIn={false} />
        </div>
      ) : null}
    </>
  );
}
