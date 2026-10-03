"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { AppIcon, CreditAmount, StatusIcon } from '@/components/ui/Glyph';
import { useWalletSummary } from '@/components/useWalletSummary';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/lib/roleContext';
import { AuthSessionScreen } from '@/components/auth/AuthSessionScreen';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PipActor } from '@/components/brand/PipActor';
import './arena.css';
import './student-pages.css';
import './explore/explore.css';
import './arena-support.css';
import { arenaNavigation, MOBILE_STUDY_NAV } from '@/lib/arenaNavigation';

const TOUR_STEPS = [
  { title: 'Today', target: 'nav-today', body: 'Your next useful step: what to practise now and what is due for review.' },
  { title: 'Practice', target: 'nav-dashboard', body: 'Choose a subject, a mode and how many questions, then start a timed session. Every answer is scored on the server.' },
  { title: 'Review', target: 'nav-review', body: 'Go back over sessions that matter and check concepts again on fresh questions.' },
  { title: 'Progress', target: 'nav-progress', body: 'See which concepts have passed fresh, delayed checks, and which need more evidence.' },
];
// Pip guides the first-run tour only (rare, so it may have character); it nods on each step.
const TOUR_POSES = ['greeting', 'encouraging', 'thinking', 'celebrating'];

export default function AppLayoutClient({ children, previewRoute = null, previewLinks = null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status, signOut } = useAuth();
  const { isModerator } = useRole();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourTarget, setTourTarget] = useState(null);
  const tourSeenKey = user?.id ? `mockmob_app_tour_seen_${user.id}` : 'mockmob_app_tour_seen';
  const activePath = previewRoute || pathname;
  const isTestRoute = activePath.startsWith('/test');
  const wallet = useWalletSummary(user?.id);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const closeOnEscape = (event) => { if (event.key === 'Escape') setMobileMenuOpen(false); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/signup');
    }
  }, [status, router]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (pathname.startsWith('/moderation') && !isModerator) {
      router.replace('/dashboard');
    }
  }, [status, pathname, isModerator, router]);


  useEffect(() => {
    if (!tourOpen || typeof window === 'undefined') {
      return;
    }

    const updateTarget = () => {
      const current = TOUR_STEPS[tourStep];
      const node = [...document.querySelectorAll(`[data-tour="${current.target}"]`)]
        .find((candidate) => {
          const rect = candidate.getBoundingClientRect();
          const style = window.getComputedStyle(candidate);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        });
      if (!node) {
        setTourTarget(null);
        return;
      }
      node.scrollIntoView({ block: 'center', inline: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      window.setTimeout(() => {
        const rect = node.getBoundingClientRect();
        const padding = 8;
        const cardWidth = Math.min(380, window.innerWidth - 32);
        const cardHeight = 260;
        const left = Math.min(
          Math.max(16, rect.left),
          Math.max(16, window.innerWidth - cardWidth - 16),
        );
        const placeBelow = rect.bottom + 18 + cardHeight < window.innerHeight;
        const top = placeBelow
          ? rect.bottom + 18
          : Math.max(16, rect.top - cardHeight - 18);

        setTourTarget({
          left: Math.max(8, rect.left - padding),
          top: Math.max(8, rect.top - padding),
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
          cardLeft: left,
          cardTop: top,
        });
      }, 220);
    };

    updateTarget();
    window.addEventListener('resize', updateTarget);
    window.addEventListener('scroll', updateTarget, { passive: true });
    return () => {
      window.removeEventListener('resize', updateTarget);
      window.removeEventListener('scroll', updateTarget);
    };
  }, [tourOpen, tourStep]);

  if (status !== 'authenticated' || (pathname.startsWith('/moderation') && !isModerator)) {
    return (
      <AuthSessionScreen
        message={status === 'authenticated' ? 'Checking your access...' : 'Loading your session...'}
      />
    );
  }

  const navGroups = arenaNavigation(isModerator).map((group) => ({ ...group, items: group.items.filter((tab) => !(isTestRoute && tab.id === 'mentor')) }));
  const allTabs = navGroups.flatMap((group) => group.items);
  const isActive = (id) => activePath === `/${id}` || activePath.startsWith(`/${id}/`);
  const renderNavLink = (tab, onNavigate) => (
    <Link
      key={tab.id}
      href={previewLinks?.[tab.id] || tab.href || `/${tab.id}`}
      className="arena-nav-link"
      style={{ '--i': allTabs.indexOf(tab) }}
      aria-current={isActive(tab.id) ? 'page' : undefined}
      data-tour={`nav-${tab.id}`}
      onClick={onNavigate}
    >
      <AppIcon name={tab.icon} />
      {tab.label}
    </Link>
  );
  const currentTitle = allTabs.find((tab) => isActive(tab.id))?.label
    || (activePath.startsWith('/result') ? 'Result' : '');

  function closeTour() {
    setTourOpen(false);
    setTourStep(0);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(tourSeenKey, 'true');
    }
  }

  return (
    <div className={`view app-shell ${isTestRoute ? 'app-shell--test' : ''}`} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <aside className="arena-sidebar" aria-label="Arena navigation">
        <Logo />
        {navGroups.map((group) => (
          <nav key={group.label} className="arena-nav-group" aria-label={group.label}>
            <p className="arena-nav-label">{group.label}</p>
            {group.items.map((tab) => renderNavLink(tab))}
          </nav>
        ))}
        <div className="arena-sidebar__foot">
          <button
            type="button"
            className="arena-chip"
            data-tour="guide-button"
            onClick={() => { setTourStep(0); setTourOpen(true); }}
          >
            <AppIcon name="guide" /> Guide
          </button>
        </div>
      </aside>

      {!isTestRoute && (
      <header className="arena-topbar">
        <div className="arena-topbar__row">
          <span className="arena-topbar__logo"><Logo /></span>
          {currentTitle ? <span className="arena-topbar__title">{currentTitle}</span> : null}

          <div className="arena-topbar__end">
            {isModerator && (
              <Link href="/moderation" className="arena-chip arena-chip--mod arena-md-up">
                <AppIcon name="moderation" /> Moderator
              </Link>
            )}
            <Link href="/pricing" className="arena-chip arena-chip--credits" data-tour="credits-pill" aria-label={user?.isPremium ? 'Practice credits: unlimited with Pro' : `Practice credits: ${user?.creditBalance || 0}`}>
              <CreditAmount kind="practice" amount={user?.isPremium ? 'unlimited' : (user?.creditBalance || 0)} unit={false} />
            </Link>
            {wallet.status !== 'idle' && (
              <Link href="/mentor" className="arena-chip arena-chip--prepos arena-sm-up" data-state={wallet.wallet?.state || 'unknown'} aria-label={wallet.wallet?.known ? `PrepOS credits: ${wallet.wallet.total}${wallet.wallet.state === 'paused' ? ', paused' : ''}` : 'PrepOS credits unavailable'}>
                <CreditAmount kind="prepos" amount={wallet.wallet?.known ? wallet.wallet.total : null} unit={false} />
              </Link>
            )}
            {user?.isPremium && (
              <span className="arena-chip arena-chip--pro arena-sm-up">Pro</span>
            )}
            <span className="arena-theme arena-sm-up"><ThemeToggle /></span>
            <Link href="/profile" className="arena-profile arena-desktop-only">
              <Avatar name={user?.name} size="sm" />
              <span>{user?.name ?? 'Account'}</span>
            </Link>
            <button
              type="button"
              onClick={async () => { await signOut(); router.push('/'); }}
              title="Sign out"
              aria-label="Sign out"
              className="arena-iconbtn arena-iconbtn--danger arena-desktop-only"
            >
              <AppIcon name="signout" />
            </button>
            <button
              type="button"
              data-tour="mobile-menu-toggle"
              className="arena-iconbtn arena-mobile-only"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="arena-sheet"
            >
              {mobileMenuOpen ? <StatusIcon kind="close" /> : (
                <span className="inline-flex flex-col gap-1" aria-hidden="true">
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                </span>
              )}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="arena-sheet arena-mobile-only" id="arena-sheet">
            {navGroups.map((group) => (
              <nav key={group.label} className="arena-nav-group" aria-label={group.label}>
                <p className="arena-nav-label">{group.label}</p>
                {group.items.map((tab) => renderNavLink(tab, () => setMobileMenuOpen(false)))}
              </nav>
            ))}
            <div className="arena-sheet__account">
              <Link href="/profile" className="flex min-w-0 items-center gap-2 no-underline" onClick={() => setMobileMenuOpen(false)}>
                <Avatar name={user?.name} size="sm" />
                <span className="truncate text-sm font-semibold text-zinc-200">{user?.name ?? 'Account'}</span>
              </Link>
              <div className="flex items-center gap-2">
                <span className="arena-theme"><ThemeToggle /></span>
                <button
                  type="button"
                  className="arena-chip"
                  data-tour="guide-button"
                  onClick={() => { setMobileMenuOpen(false); setTourStep(0); setTourOpen(true); }}
                >
                  <AppIcon name="guide" /> Guide
                </button>
                <button
                  type="button"
                  onClick={async () => { await signOut(); router.push('/'); }}
                  title="Sign out"
                  aria-label="Sign out"
                  className="arena-iconbtn arena-iconbtn--danger"
                >
                  <AppIcon name="signout" />
                </button>
              </div>
            </div>
          </div>
        )}

        {isModerator && (
          <div className="arena-modbar">
            <AppIcon name="moderation" /> Moderator access is active for this account.
          </div>
        )}
      </header>
      )}

      <main className={`app-main ${isTestRoute ? 'app-main--test' : 'px-4 py-6 md:px-5 md:py-8'}`} style={{ flex: 1, position: 'relative' }}>
        <div className="arena-backdrop" aria-hidden="true" />
        <div className={`${isTestRoute ? 'test-content-host' : 'container-std'} relative z-10`}>
          {children}
        </div>
      </main>
      {!isTestRoute && <nav className="arena-bottomnav" aria-label="Quick study navigation">
        {MOBILE_STUDY_NAV.map((tab) => <Link key={tab.id} href={previewLinks?.[tab.id] || tab.href} onClick={() => setMobileMenuOpen(false)} aria-current={isActive(tab.id) ? 'page' : undefined} data-tour={`nav-${tab.id}`}><AppIcon name={tab.icon} /><span>{tab.label}</span></Link>)}
        <button type="button" aria-expanded={mobileMenuOpen} aria-controls="arena-sheet" onClick={() => { setMobileMenuOpen((open) => !open); requestAnimationFrame(() => document.getElementById('arena-sheet')?.scrollIntoView({ block: 'start', behavior: 'instant' })); }}><AppIcon name="expand" /><span>More</span></button>
      </nav>}
      {!isTestRoute && tourOpen && (
        <div className="pointer-events-none fixed inset-0 z-[80]">
          {tourTarget ? (
            <>
              <div className="fixed left-0 right-0 top-0 bg-black/62 backdrop-blur-[2px]" style={{ height: tourTarget.top }} />
              <div className="fixed left-0 bg-black/62 backdrop-blur-[2px]" style={{ top: tourTarget.top, width: tourTarget.left, height: tourTarget.height }} />
              <div className="fixed bg-black/62 backdrop-blur-[2px]" style={{ left: tourTarget.left + tourTarget.width, right: 0, top: tourTarget.top, height: tourTarget.height }} />
              <div className="fixed bottom-0 left-0 right-0 bg-black/62 backdrop-blur-[2px]" style={{ top: tourTarget.top + tourTarget.height }} />
            </>
          ) : (
            <div className="fixed inset-0 bg-black/62 backdrop-blur-[2px]" />
          )}
          {tourTarget && (
            <div
              className="pointer-events-none fixed rounded-2xl border-2 border-volt shadow-[0_0_34px_rgba(210,240,0,0.42)]"
              style={{
                left: tourTarget.left,
                top: tourTarget.top,
                width: tourTarget.width,
                height: tourTarget.height,
              }}
            />
          )}
          <div
            className="pointer-events-auto fixed w-[min(380px,calc(100vw-32px))] rounded-2xl border border-volt/25 bg-[var(--a-raised)] p-5 shadow-[var(--a-shadow-2)]"
            style={tourTarget ? { left: tourTarget.cardLeft, top: tourTarget.cardTop } : { left: '16px', bottom: '16px' }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="arena-tour-pip"><PipActor pose={TOUR_POSES[tourStep] || 'greeting'} blink={tourStep + 1} motion={tourStep ? `nod-${tourStep % 2}` : 'land-0'} /></span>
              <div className="flex-1">
                <div className="mono-label text-volt">Step {tourStep + 1} of {TOUR_STEPS.length}</div>
                <h2 className="mt-1 font-display text-[22px] font-extrabold text-white">{TOUR_STEPS[tourStep].title}</h2>
              </div>
              <button
                type="button"
                className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-xl border border-white/10 text-zinc-400"
                onClick={closeTour}
                aria-label="Close guide"
              >
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            <p className="text-sm leading-6 text-zinc-300">{TOUR_STEPS[tourStep].body}</p>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-volt" style={{ width: `${((tourStep + 1) / TOUR_STEPS.length) * 100}%` }} />
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                className="inline-flex min-h-11 items-center rounded-full border border-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-zinc-400 transition hover:border-white/20 hover:text-white disabled:opacity-35"
                disabled={tourStep === 0}
                onClick={() => setTourStep((step) => Math.max(0, step - 1))}
              >
                Back
              </button>
              {tourStep === TOUR_STEPS.length - 1 ? (
                <button type="button" className="inline-flex min-h-11 items-center rounded-full bg-volt px-5 py-2 text-sm font-extrabold text-black shadow-[0_0_22px_rgba(210,240,0,0.22)] transition hover:brightness-110" onClick={closeTour}>
                  Finish
                </button>
              ) : (
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center rounded-full bg-volt px-5 py-2 text-sm font-extrabold text-black shadow-[0_0_22px_rgba(210,240,0,0.22)] transition hover:brightness-110"
                  onClick={() => setTourStep((step) => Math.min(TOUR_STEPS.length - 1, step + 1))}
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      )}
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
  );
}
