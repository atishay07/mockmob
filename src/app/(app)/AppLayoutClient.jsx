"use client";

import { MobFlagProvider } from '@/components/mob/MobFlag';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { AppIcon, CreditAmount } from '@/components/ui/Glyph';
import { useWalletSummary } from '@/components/useWalletSummary';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/lib/roleContext';
import { AuthSessionScreen } from '@/components/auth/AuthSessionScreen';
import { loginPathFor } from '@/lib/auth-redirect';
import { ThemeToggle } from '@/components/ThemeToggle';
import AppearanceSwitch from '@/components/AppearanceSwitch';
import { PipActor } from '@/components/brand/PipActor';
import { StartKey, StartSheetHost } from '@/components/start';
import './arena.css';
import './student-pages.css';
import './explore/explore.css';
import './arena-support.css';
import '@/components/study/study.css';
import { arenaNavigation, MOBILE_STUDY_NAV } from '@/lib/arenaNavigation';
import { VIEW_TRANSITION_PROPS } from '@/lib/motion/placeTransition';

// React's <ViewTransition> (Next's experimental.viewTransition): the arena's page transitions. The type
// of each navigation (place, push, pop, rise, fade, or none on /test) is added by src/instrumentation-client.js
// from src/lib/motion/placeTransition.js; a React without it renders the page as before, with no transition.
const ViewTransition = React.ViewTransition;
function PageTransition({ children }) {
  return ViewTransition ? <ViewTransition {...VIEW_TRANSITION_PROPS}>{children}</ViewTransition> : children;
}

const TOUR_STEPS = [
  { title: 'Today', target: 'nav-today', body: 'Your next useful step: what to practise now and what is due for review.' },
  { title: 'Practice', target: 'nav-dashboard', body: 'Choose a subject, a mode and how many questions, then start a timed session. Every answer is scored on the server.' },
  { title: 'Review', target: 'nav-review', body: 'Go back over sessions that matter and check concepts again on fresh questions.' },
  { title: 'Progress', target: 'nav-progress', body: 'See which concepts have passed fresh, delayed checks, and which need more evidence.' },
];
// Pip guides the first-run tour only (rare, so it may have character); it nods on each step.
const TOUR_POSES = ['greeting', 'encouraging', 'thinking', 'celebrating'];

export default function AppLayoutClient({ children, previewRoute = null, previewLinks = null, studyEnabled = false, mobEnabled = false }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status, signOut, refreshSession } = useAuth();
  const { isModerator } = useRole();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuOpener = useRef(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourTarget, setTourTarget] = useState(null);
  const tourSeenKey = user?.id ? `mockmob_app_tour_seen_${user.id}` : 'mockmob_app_tour_seen';
  const activePath = previewRoute || pathname;
  const isTestRoute = activePath.startsWith('/test');
  const wallet = useWalletSummary(user?.id);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const sheet = document.getElementById('arena-sheet');
    const opener = menuOpener.current;
    const header = document.querySelector('.app-shell .arena-topbar');
    const dock = document.querySelector('.arena-dock');
    // The More sheet rises from the dock (the tab capsule and the Start key): it sits on the dock's top edge and never
    // reaches under the header.
    const fitMenu = () => {
      const bottom = dock?.getBoundingClientRect();
      // 8 px of air between the sheet and the floating dock, as between the dock's capsule and its key.
      const dockTop = bottom?.height ? Math.min(innerHeight, bottom.top - 8) : innerHeight;
      const available = dockTop - (header?.getBoundingClientRect().bottom || 64) - 12;
      if (sheet) {
        sheet.style.maxHeight = `${Math.max(80, available)}px`;
        sheet.style.bottom = `${Math.max(0, innerHeight - dockTop)}px`;
      }
    };
    const resize = new ResizeObserver(fitMenu);
    if (header) resize.observe(header);
    if (dock) resize.observe(dock);
    fitMenu();
    window.addEventListener('resize', fitMenu);
    window.addEventListener('scroll', fitMenu, { passive: true });
    const frame = requestAnimationFrame(() => sheet?.querySelector('.arena-nav-link')?.focus({ preventScroll: true }));
    const closeOnEscape = (event) => { if (event.key === 'Escape') { setMobileMenuOpen(false); opener?.focus({ preventScroll: true }); } };
    // The scrim closes on its own click, so a tap on it never falls through to the page beneath.
    const inMenu = (target) => target.closest?.('.arena-topbar, .arena-dock, .arena-sheet, .arena-sheet-scrim');
    const closeOutside = (event) => { if (!inMenu(event.target)) setMobileMenuOpen(false); };
    const closeOnExit = (event) => { if (!inMenu(event.target)) setMobileMenuOpen(false); };
    const desktop = matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (desktop.matches) setMobileMenuOpen(false); };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOnExit);
    desktop.addEventListener('change', closeOnDesktop);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener('resize', fitMenu);
      window.removeEventListener('scroll', fitMenu);
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOnExit);
      desktop.removeEventListener('change', closeOnDesktop);
    };
  }, [mobileMenuOpen]);

  const toggleMenu = (event) => {
    menuOpener.current = event.currentTarget;
    setMobileMenuOpen(open => !open);
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      // A returning student lands on login (not signup) and comes back to this page after.
      router.replace(loginPathFor(`${window.location.pathname}${window.location.search}`));
    }
  }, [status, router]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  // The page transition draws the old page's picture where the student last saw it. A forward navigation
  // puts the new page at its top before the browser takes its picture (so the picture never jumps after);
  // the old picture is then offset by how far the student had scrolled. The back button keeps the scroll
  // the router restores.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const fromY = Number(root.dataset.mmVtFromY);
    const traverse = root.dataset.mmVtNav === 'traverse';
    delete root.dataset.mmVtFromY;
    delete root.dataset.mmVtNav;
    if (!Number.isFinite(fromY)) { root.style.setProperty('--mm-vt-from-y', '0px'); return; }
    if (!traverse && window.scrollY !== 0) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    root.style.setProperty('--mm-vt-from-y', `${Math.round(window.scrollY) - fromY}px`);
  }, [activePath]);

  // After a navigation, keyboard and screen reader users start at the new page's heading (S016), as the
  // app does. The first load keeps the browser's own start, and the runner manages its own focus.
  const landedPath = useRef(null);
  useEffect(() => {
    if (status !== 'authenticated') return undefined;
    const first = landedPath.current === null;
    const moved = landedPath.current !== activePath;
    landedPath.current = activePath;
    if (first || !moved || isTestRoute) return undefined;
    // A page whose h1 mounts after its first frame (Practice reads its subjects first) is waited for, briefly: the
    // heading is focused as soon as it exists, and <main> only if none arrives within about 400 ms.
    const main = document.getElementById('app-main');
    if (!main) return undefined;
    let done = false;
    let observer = null;
    let timer = 0;
    const finish = () => { done = true; observer?.disconnect(); clearTimeout(timer); };
    const land = (fallback) => {
      if (done) return;
      const active = document.activeElement;
      // A page that put focus on purpose (a search box, a sheet) keeps it.
      if (active && active !== document.body && active !== main && !active.closest('.arena-sidebar, .arena-dock, .arena-sheet, .arena-topbar')) { finish(); return; }
      const heading = main.querySelector('h1');
      if (!heading && !fallback) return;
      finish();
      const target = heading || main;
      if (target !== main && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    };
    const frame = requestAnimationFrame(() => land(false));
    observer = new MutationObserver(() => land(false));
    observer.observe(main, { childList: true, subtree: true });
    timer = setTimeout(() => land(true), 400);
    return () => { finish(); cancelAnimationFrame(frame); };
  }, [activePath, status, isTestRoute]);

  // One volt per viewport (AGENT_RULES 7, WB-05): a page that owns a volt action marks it data-page-primary (or marks its
  // root data-owns-start). While such a page is mounted, #app-main carries data-start-quiet and the sidebar's Start key (from
  // 1024 px) is outlined for the whole visit (start.css); the phone bar's key keeps its lime disc everywhere (nav A1). The key's look follows the route and what the page holds, never the
  // scroll position: a key that flips as the page scrolls is the bug the owner saw on Practice (F12, START-1017 section 5).
  useEffect(() => {
    // <main> exists only once the session is known, so this waits for it.
    const main = status === 'authenticated' ? document.getElementById('app-main') : null;
    if (!main) return undefined;
    let frame = 0;
    const sync = () => {
      frame = 0;
      if (main.querySelector('[data-page-primary], [data-owns-start]')) main.dataset.startQuiet = ''; else delete main.dataset.startQuiet;
    };
    const mo = new MutationObserver(() => { if (!frame) frame = requestAnimationFrame(sync); });
    mo.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-page-primary', 'data-owns-start'] });
    sync();
    return () => { mo.disconnect(); cancelAnimationFrame(frame); delete main.dataset.startQuiet; };
  }, [activePath, status]);

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

  // Account's "Replay the guide" asks the shell to open the tour (it falls back to pressing Guide).
  useEffect(() => {
    if (isTestRoute) return undefined;
    const openGuide = (event) => { event.preventDefault(); setMobileMenuOpen(false); setTourStep(0); setTourOpen(true); };
    window.addEventListener('mockmob:open-guide', openGuide);
    return () => window.removeEventListener('mockmob:open-guide', openGuide);
  }, [isTestRoute]);

  if (status === 'unavailable') {
    return (
      <AuthSessionScreen
        errorTitle="Can't reach MockMob"
        error="You are still signed in. We could not load your account just now. Check your connection, then try again."
        actionLabel="Try again"
        onAction={() => refreshSession({ silent: false })}
      />
    );
  }

  if (status !== 'authenticated' || (pathname.startsWith('/moderation') && !isModerator)) {
    return (
      <AuthSessionScreen
        message={status === 'authenticated' ? 'Checking your access…' : 'Loading your session…'}
      />
    );
  }

  const showStudy=studyEnabled || previewRoute==='/learn';
  const navGroups = arenaNavigation(isModerator, { mob: mobEnabled || Boolean(previewLinks?.mob) }).map((group) => ({ ...group, items: group.items.filter((tab) => !(isTestRoute && tab.id === 'mentor') && (showStudy || tab.id!=='learn')) }));
  // The phone dock's four places (NAV-1017 section 8). The More sheet lists every other place, so its Study group opens
  // on Learn, then Explore, Saved and Progress; the dock's places are one tap away right under it and are not repeated.
  // The desktop sidebar keeps the full groups.
  const mobileTabs = MOBILE_STUDY_NAV;
  const dockIds = new Set(mobileTabs.map((tab) => tab.id));
  const sheetGroups = navGroups.map((group) => ({ ...group, items: group.items.filter((tab) => !dockIds.has(tab.id)) })).filter((group) => group.items.length);
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
      <span className="arena-nav-link__label">{tab.label}{tab.hint ? <span className="arena-nav-link__hint">, {tab.hint}</span> : null}</span>
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
      {/* Keyboard users reach the page before the fourteen navigation stops; hidden until it has focus. */}
      <a href="#app-main" className="arena-skip">Skip to content</a>
      <aside className="arena-sidebar" aria-label="Main navigation">
        <Logo />
        {!isTestRoute && <StartKey variant="sidebar" />}
        {navGroups.map((group) => (
          <nav key={group.label} className="arena-nav-group" aria-label={group.label}>
            <p className="arena-nav-label">{group.label}</p>
            {group.items.map((tab) => renderNavLink(tab))}
          </nav>
        ))}
        {/* The foot is one compact row at the end of the list, not a sticky panel: at 1440 x 900 it never covers a row
            (W-069). Appearance keeps its three choices as icons with names; Guide sits under it. */}
        <div className="arena-sidebar__foot">
          <AppearanceSwitch compact />
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
              <Link href="/mentor" className="arena-chip arena-chip--prepos arena-sm-up" data-state={wallet.wallet?.state || 'unknown'} aria-label={wallet.wallet?.known ? `AI credits: ${wallet.wallet.total}${wallet.wallet.state === 'paused' ? ', paused' : ''}` : 'AI credits unavailable'}>
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
            {/* Phones: the account sits where the app puts You. The menu itself is More, on the dock. */}
            <Link
              href={previewLinks?.profile || '/profile'}
              className="arena-you arena-mobile-only"
              aria-label={`Account, ${user?.name ?? 'your profile'}`}
              aria-current={isActive('profile') ? 'page' : undefined}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Avatar name={user?.name} size="sm" />
            </Link>
          </div>
        </div>

        {isModerator && (
          <div className="arena-modbar">
            <AppIcon name="moderation" /> Moderator access is active for this account.
          </div>
        )}
      </header>
      )}

      <main id="app-main" tabIndex={-1} className={`app-main ${isTestRoute ? 'app-main--test' : 'px-4 py-6 md:px-5 md:py-8'}`} style={{ flex: 1, position: 'relative' }}>
        <div className="arena-backdrop" aria-hidden="true" />
        <PageTransition>
          <div className={`${isTestRoute ? 'test-content-host' : 'container-std'} relative z-10`}>
            <MobFlagProvider enabled={mobEnabled || Boolean(previewLinks?.mob)}>{children}</MobFlagProvider>
          </div>
        </PageTransition>
      </main>
      {!isTestRoute && mobileMenuOpen && (
        <>
          <div className="arena-sheet-scrim arena-mobile-only" aria-hidden="true" onClick={() => setMobileMenuOpen(false)} />
          <div className="arena-sheet arena-mobile-only" id="arena-sheet" role="region" aria-label="More places">
            <span className="arena-sheet__handle" aria-hidden="true" />
            <div className="arena-sheet__account">
              <Link href={previewLinks?.profile || '/profile'} className="arena-sheet__who" onClick={() => setMobileMenuOpen(false)}>
                <Avatar name={user?.name} size="sm" />
                <span>{user?.name ?? 'Account'}</span>
              </Link>
              <div className="arena-sheet__tools">
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
            <AppearanceSwitch />
            {sheetGroups.map((group) => (
              <nav key={group.label} className="arena-nav-group" aria-label={group.label}>
                <p className="arena-nav-label">{group.label}</p>
                {group.items.map((tab) => renderNavLink(tab, () => setMobileMenuOpen(false)))}
              </nav>
            ))}
          </div>
        </>
      )}
      {/* The phone and tablet dock (NAV-1017 section 8): a glass capsule of five places and, beside it, the Start key. The
          key is an action, so it sits outside the nav, which keeps five tabs. */}
      {!isTestRoute && <div className="arena-dock">
        <nav className="arena-bottomnav" aria-label="Quick study navigation">
          {mobileTabs.map((tab) => <Link key={tab.id} href={previewLinks?.[tab.id] || tab.href} onClick={() => setMobileMenuOpen(false)} aria-current={isActive(tab.id) ? 'page' : undefined} data-tour={`nav-${tab.id}`}><AppIcon name={tab.icon} size={24} /><span>{tab.label}</span></Link>)}
          <button type="button" aria-expanded={mobileMenuOpen} aria-controls={mobileMenuOpen ? 'arena-sheet' : undefined} onClick={toggleMenu}><AppIcon name="more" size={24} /><span>More</span></button>
        </nav>
        <StartKey variant="bar" onOpen={() => setMobileMenuOpen(false)} />
      </div>}
      {!isTestRoute && <StartSheetHost previewLinks={previewLinks} />}
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
                className="inline-flex min-h-11 items-center rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-zinc-400 transition hover:border-white/20 hover:text-white disabled:opacity-35"
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
