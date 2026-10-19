"use client";

import { MobFlagProvider } from '@/components/mob/MobFlag';
import { ContributeFlagProvider } from '@/components/contribute/ContributeFlag';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { watchPagePrimary } from '@/components/start/pagePrimary.mjs';
import { setStartQuiet } from '@/components/start/startQuietStore';
import AskMobiHost from '@/components/ai/AskMobiHost';
import { ProNudgeHost } from '@/components/pro';
import './arena.css';
import './student-pages.css';
import './explore/explore.css';
import './arena-support.css';
import './nav-badge.css';
import './signout.css';
import '@/components/study/study.css';
import { arenaNavigation, ASK_MOBI_NAV, dockPlaceOf, mobileNavigation, placeTabs, youSheetGroups } from '@/lib/arenaNavigation';
import './nav-places.css';
import Image from 'next/image';
import mascot from '@/../public/brand/mascot/manifest.json';
import PlaceTabs from '@/components/nav/PlaceTabs';
import { useReviseBadge } from '@/lib/reviewRead';
import { dueBadge, dueLabel } from '@/lib/nav/dueCount.mjs';
import { VIEW_TRANSITION_PROPS } from '@/lib/motion/placeTransition';
import { tourSteps } from '@/lib/appTour.mjs';
import { HELP_DOOR, TOUR_LABEL } from '@/lib/helpDoor.mjs';
import { TourStopsProvider } from '@/components/help/TourStops';

// React's <ViewTransition> (Next's experimental.viewTransition): the arena's page transitions. The type
// of each navigation (place, push, pop, rise, fade, or none on /test) is added by src/instrumentation-client.js
// from src/lib/motion/placeTransition.js; a React without it renders the page as before, with no transition.
const ViewTransition = React.ViewTransition;
function PageTransition({ children }) {
  return ViewTransition ? <ViewTransition {...VIEW_TRANSITION_PROPS}>{children}</ViewTransition> : children;
}

// Mobi's face on his door (the sidebar's foot and the phone's You sheet): the real mascot art, static, as on the logo.
const MOBI_FACE = mascot.greeting;
// The two lines under "Ask Mobi" (R6, read aloud): the sidebar's is short enough for one line at 232 px. One voice for both (copy
// pass, 19 Oct): what he does, so the line under "Ask Mobi" never starts with "Ask" again.
const ASK_MOBI_NOTE = { rail: 'He explains any answer.', sheet: 'He explains questions, results and your plan.' };

// The Guide's stops live in src/lib/appTour.mjs (W-093), so the Guide page counts the tour that will run.
// Pip guides the tour only (rare, so it may have character); it nods on each step.
const TOUR_POSES = ['greeting', 'encouraging', 'thinking', 'encouraging', 'celebrating', 'encouraging', 'thinking', 'celebrating', 'greeting'];

export default function AppLayoutClient({ children, previewRoute = null, previewLinks = null, studyEnabled = false, mobEnabled = false, contributeEnabled = false, offer = null }) {
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
  const mobOn = mobEnabled || Boolean(previewLinks?.mob);
  const studyOn = studyEnabled || previewRoute === '/learn';
  const TOUR_STEPS = useMemo(() => tourSteps({ mob: mobOn, study: studyOn }), [mobOn, studyOn]);
  // The Revise count is what Revise has due today (LEARN-REVIEW-1017 5.12), absent when nothing is due or the count is unknown.
  // It sits on Practice in the phone dock and on Your papers in the sidebar and in Practice's row of tabs.
  const reviseBadge = useReviseBadge({ enabled: status === 'authenticated' && !isTestRoute });

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const sheet = document.getElementById('arena-sheet');
    const opener = menuOpener.current;
    const header = document.querySelector('.app-shell .arena-topbar');
    const dock = document.querySelector('.arena-dock');
    // The You sheet rises from the dock: it sits on the dock's top edge and never reaches under the header.
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
    // Focus starts at the top of the sheet, on the account row, and reads down from there.
    const frame = requestAnimationFrame(() => sheet?.querySelector('a[href], button')?.focus({ preventScroll: true }));
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
  // 1024 px) is outlined for the whole visit (start.css). The sidebar key follows the route and what the page holds, never the
  // scroll position: a key that flips as the page scrolls is the bug the owner saw on Practice (F12, START-1017 section 5).
  // The phone dock's key is handled by the effect below this one, which follows whether the page's key is on screen (W-075).
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

  // The phone dock's Start key (W-075, release 8): while the page's own volt key is on screen it steps back to its quiet look,
  // so a phone never holds two lime fills, and when that key has scrolled away it is lime again. It follows one thing, whether
  // that key is in view (pagePrimary.mjs: the band between the top bar and the dock, a dead band at its edges and a short
  // settle, so a fast scroll never flickers it), not the route and not the scroll position itself. Keys that exist only on a
  // phone mark data-phone-primary, so they never quiet the desktop sidebar. The timed runner has no dock and no watch.
  useEffect(() => {
    const main = status === 'authenticated' && !isTestRoute ? document.getElementById('app-main') : null;
    if (!main) return undefined;
    const stop = watchPagePrimary(main, { onChange: setStartQuiet });
    return () => { stop(); setStartQuiet(false); };
  }, [activePath, status, isTestRoute]);

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
      const node = [].concat(current.target).flatMap((target) => [...document.querySelectorAll(`[data-tour="${target}"]`)])
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
          via: node.dataset.tour,
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
  }, [tourOpen, tourStep, TOUR_STEPS]);

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
  const contributeOn = Boolean(contributeEnabled);
  const keepLearn = (tab) => showStudy || tab.id !== 'learn';
  // The five places (WEB-NAV-1019 option A, owner D114): the sidebar draws Today, Practice, Mob and You as bold rows with their
  // pages indented under them (no group headers); the phone dock draws Today, Practice, the Start key, Mob and You; You opens
  // the You sheet; Practice's and the Mob's pages are a row of tabs on those pages. Every page keeps its link and route.
  const navGroups = arenaNavigation(isModerator, { mob: mobOn, contribute: contributeOn }).map((group) => ({ ...group, items: group.items.filter(keepLearn) }));
  const sheetGroups = youSheetGroups(isModerator, { mob: mobOn, contribute: contributeOn });
  const dockTabs = mobileNavigation({ mob: mobOn });
  const dockPlace = isTestRoute ? null : dockPlaceOf(activePath, { mob: mobOn });
  const tabRow = isTestRoute ? null : placeTabs(activePath, { mob: mobOn, study: showStudy });
  const allTabs = [...navGroups.flatMap((group) => group.items), ...sheetGroups.flatMap((group) => group.items), ASK_MOBI_NAV];
  // The rail fills top to bottom once on entering the Arena, and the You sheet's rows rise one after another: each row's place in
  // its own list is its --i (the stagger the release 10 rail had, kept across the places).
  const railIndex = new Map(navGroups.flatMap((group) => group.items).map((tab, i) => [tab.id, i]));
  const sheetIndex = new Map(sheetGroups.flatMap((group) => group.items).map((tab, i) => [tab.id, i]));
  // A lesson or recall run lives at /study/<id> but belongs to Learn (D20), so Learn stays the current place while you are in one.
  const isActive = (id) => activePath === `/${id}` || activePath.startsWith(`/${id}/`) || (id === 'learn' && activePath.startsWith('/study/'));
  // The Revise count is drawn as "8 due", never a bare number that reads as a paper count (verifier M1), and said in words.
  const countLabel = (tab) => (reviseBadge && (tab.id === 'review' || tab.id === 'dashboard') ? dueLabel(tab.label, reviseBadge) : undefined);
  const hrefOf = (tab) => previewLinks?.[tab.id] || tab.href || `/${tab.id}`;
  const linkClass = (tab) => ['arena-nav-link', tab.place ? 'arena-nav-link--place' : '', tab.sub ? 'arena-nav-link--sub' : ''].filter(Boolean).join(' ');
  const renderNavLink = (tab, onNavigate, index = 0) => (
    <React.Fragment key={tab.id}>
      {tab.ruleAbove ? <span className="arena-nav-rule" aria-hidden="true" /> : null}
      <Link
        href={hrefOf(tab)}
        className={linkClass(tab)}
        style={{ '--i': index }}
        aria-current={isActive(tab.id) ? 'page' : undefined}
        aria-label={tab.id === 'review' ? countLabel(tab) : undefined}
        data-tour={`nav-${tab.id}`}
        onClick={onNavigate}
      >
        <AppIcon name={tab.icon} />
        <span className="arena-nav-link__label">{tab.label}{tab.hint ? <span className="arena-nav-link__hint">, {tab.hint}</span> : null}</span>
        {tab.id === 'review' && reviseBadge ? <i className="arena-nav-link__count" aria-hidden="true">{dueBadge(reviseBadge)}</i> : null}
      </Link>
    </React.Fragment>
  );
  // The top bar names the page: a tab's own name inside a row of tabs ("Your papers", "Your Mob"), else the place's page name.
  const currentTitle = tabRow?.tabs.find((tab) => isActive(tab.id))?.label
    || allTabs.find((tab) => isActive(tab.id))?.title
    || allTabs.find((tab) => isActive(tab.id))?.label
    || (activePath.startsWith('/result') ? 'Result' : '');

  // The tour, from any row that offers it ("Show me around": the You sheet's account card, the sidebar's You group).
  function startTour() {
    setMobileMenuOpen(false);
    setTourStep(0);
    setTourOpen(true);
  }

  function closeTour() {
    setTourOpen(false);
    setTourStep(0);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(tourSeenKey, 'true');
    }
  }

  return (
    <div className={`view app-shell ${isTestRoute ? 'app-shell--test' : ''}`} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Keyboard users reach the page before the navigation's stops; hidden until it has focus. */}
      <a href="#app-main" className="arena-skip">Skip to content</a>
      <aside className="arena-sidebar" aria-label="Main navigation">
        <Logo />
        {!isTestRoute && <StartKey variant="sidebar" />}
        {navGroups.map((group) => (
          <nav key={group.id} className={group.place ? 'arena-nav-group arena-nav-group--place' : 'arena-nav-group'} aria-label={group.label}>
            {group.place ? null : <p className="arena-nav-label">{group.label}</p>}
            {group.items.map((tab) => renderNavLink(tab, undefined, railIndex.get(tab.id)))}
            {/* The tour, under You's Guide row (N17): a student who is lost finds it without knowing to open Guide. */}
            {group.id === 'you' && !isTestRoute ? (
              <button type="button" className="arena-nav-link arena-nav-link--sub arena-nav-link--tour" style={{ '--i': railIndex.size }} onClick={startTour}>
                <AppIcon name="guide" />
                <span className="arena-nav-link__label">{TOUR_LABEL}</span>
              </button>
            ) : null}
          </nav>
        ))}
        {/* Mobi's own door, at the foot above Night and Day (D6): the one place in the navigation where a student talks to him.
            A plain /mentor link, which AskMobiHost opens in place beside the page (a modifier-click still opens /mentor). */}
        {!isTestRoute && (
          <Link href={previewLinks?.mentor || '/mentor'} className="arena-mobi-door" data-tour="nav-mentor" aria-current={isActive('mentor') ? 'page' : undefined}>
            <Image className="arena-mobi-door__face" src={MOBI_FACE.src} width={30} height={41} sizes="30px" alt="" />
            <span className="arena-sheet__lead-text"><span className="arena-sheet__lead-name">Ask Mobi</span><span className="arena-sheet__lead-note">{ASK_MOBI_NOTE.rail}</span></span>
          </Link>
        )}
        {/* The foot is the appearance row alone (D11). */}
        <div className="arena-sidebar__foot">
          <AppearanceSwitch compact />
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
            {/* One credits balance (owner, 18 Oct 2026, D78): one chip. The wallet read is the live total (free this month +
                bought/held); until it answers, the account's own total from /api/auth/me stands in. */}
            <Link href={previewLinks?.wallet || '/wallet'} className="arena-chip arena-chip--credits" data-tour="credits-pill" data-state={wallet.wallet?.state || 'unknown'} aria-label={`Credits: ${wallet.wallet?.known ? wallet.wallet.total : (user?.creditBalance ?? 0)}`}>
              <CreditAmount kind="practice" amount={wallet.wallet?.known ? wallet.wallet.total : (user?.creditBalance ?? 0)} unit={false} />
            </Link>
            {user?.isPremium && (
              <span className="arena-chip arena-chip--pro arena-sm-up">Pro</span>
            )}
            <span className="arena-theme arena-sm-up"><ThemeToggle /></span>
            <Link href="/profile" className="arena-profile arena-desktop-only">
              <Avatar name={user?.name} size="sm" />
              <span>{user?.name ?? 'Account'}</span>
            </Link>
            {/* Sign out in words, beside the account (owner G29, 19 Oct): an unlabelled glyph was missed. */}
            <button
              type="button"
              onClick={async () => { await signOut(); router.push('/'); }}
              className="arena-signout arena-desktop-only"
            >
              <AppIcon name="signout" />
              <span>Sign out</span>
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
        {/* Phones: the pages inside Practice (or the Mob) as a row of tabs on each of those pages. It stays put while the
            page under it changes, so moving between the tabs never moves the row. */}
        {tabRow ? <PlaceTabs key={tabRow.id} group={tabRow} hrefOf={hrefOf} isActive={isActive} count={reviseBadge || 0} countLabel={countLabel} /> : null}
        <PageTransition>
          <div className={`${isTestRoute ? 'test-content-host' : 'container-std'} relative z-10`}>
            <MobFlagProvider enabled={mobEnabled || Boolean(previewLinks?.mob)}><ContributeFlagProvider enabled={contributeOn}><TourStopsProvider count={TOUR_STEPS.length}>{children}</TourStopsProvider></ContributeFlagProvider></MobFlagProvider>
          </div>
        </PageTransition>
      </main>
      {!isTestRoute && mobileMenuOpen && (
        <>
          <div className="arena-sheet-scrim arena-mobile-only" aria-hidden="true" onClick={() => setMobileMenuOpen(false)} />
          <div className="arena-sheet arena-mobile-only" id="arena-sheet" role="region" aria-label="You: your account, progress and plan">
            <span className="arena-sheet__handle" aria-hidden="true" />
            <div className="arena-sheet__account">
              <Link href={previewLinks?.profile || '/profile'} className="arena-sheet__who" onClick={() => setMobileMenuOpen(false)}>
                <Avatar name={user?.name} size="sm" />
                <span>{user?.name ?? 'Account'}</span>
              </Link>
              <div className="arena-sheet__tools">
                {/* The phone's account menu says Sign out in words (owner G29). */}
                <button
                  type="button"
                  onClick={async () => { await signOut(); router.push('/'); }}
                  className="arena-signout"
                >
                  <AppIcon name="signout" />
                  <span>Sign out</span>
                </button>
              </div>
              <button type="button" className="arena-sheet__help arena-sheet__tour" onClick={startTour}>
                <AppIcon name="guide" /> {TOUR_LABEL}
              </button>
              <Link href={previewLinks?.help || '/help'} className="arena-sheet__help" aria-current={isActive('help') ? 'page' : undefined} onClick={() => setMobileMenuOpen(false)}>
                <AppIcon name="help" /> {HELP_DOOR.label}
              </Link>
            </div>
            {/* Ask Mobi, with Mobi's face, above the places and the theme control (D6). */}
            <Link href={previewLinks?.mentor || '/mentor'} className="arena-sheet__lead arena-sheet__lead--ask" data-tour="nav-mentor" aria-current={isActive('mentor') ? 'page' : undefined} onClick={() => setMobileMenuOpen(false)}>
              <Image className="arena-sheet__mobi" src={MOBI_FACE.src} width={30} height={41} sizes="30px" alt="" />
              <span className="arena-sheet__lead-text"><span className="arena-sheet__lead-name">Ask Mobi</span><span className="arena-sheet__lead-note">{ASK_MOBI_NOTE.sheet}</span></span>
            </Link>
            {sheetGroups.map((group) => (
              <nav key={group.id} className="arena-nav-group" aria-label={group.label}>
                <p className="arena-nav-label">{group.label}</p>
                {group.items.map((tab) => renderNavLink(tab, () => setMobileMenuOpen(false), sheetIndex.get(tab.id)))}
              </nav>
            ))}
            {/* Night and Day comes last, so the places come first; it is still below Ask Mobi (D6). */}
            <AppearanceSwitch />
          </div>
        </>
      )}
      {/* The phone and tablet dock: one glass capsule of the same five places as the app (D105, D114): Today, Practice, the
          Start key in the centre, Mob and You. Start is an action: it opens the Start sheet, it is never a current place.
          You opens the You sheet (its data-tour is the sheet opener's, which the tour and Ask Mobi's focus return use). */}
      {!isTestRoute && <div className="arena-dock">
        <nav className="arena-bottomnav" aria-label="Quick study navigation" data-slots={dockTabs.length + 2}>
          {dockTabs.map((tab, index) => (
            <React.Fragment key={tab.id}>
              {index === 2 ? <StartKey variant="bar" onOpen={() => setMobileMenuOpen(false)} /> : null}
              <Link
                href={hrefOf(tab)}
                onClick={() => setMobileMenuOpen(false)}
                aria-current={isActive(tab.id) ? 'page' : undefined}
                data-within={!isActive(tab.id) && dockPlace === tab.dock && !mobileMenuOpen ? 'true' : undefined}
                aria-label={tab.id === 'dashboard' ? countLabel(tab) : undefined}
                data-tour={`nav-${tab.id}`}
              >
                <AppIcon name={tab.icon} size={24} /><span>{tab.label}</span>
                {tab.id === 'dashboard' && reviseBadge ? <i className="arena-badge" aria-hidden="true">{dueBadge(reviseBadge)}</i> : null}
              </Link>
            </React.Fragment>
          ))}
          {dockTabs.length < 3 ? <StartKey variant="bar" onOpen={() => setMobileMenuOpen(false)} /> : null}
          <button type="button" data-tour="nav-more" data-within={dockPlace === 'you' && !mobileMenuOpen ? 'true' : undefined} aria-expanded={mobileMenuOpen} aria-controls={mobileMenuOpen ? 'arena-sheet' : undefined} onClick={toggleMenu}><AppIcon name="account" size={24} /><span>You</span></button>
        </nav>
      </div>}
      {!isTestRoute && <StartSheetHost previewLinks={previewLinks} />}
      {!isTestRoute && <AskMobiHost />}
      {/* Pro nudges (D79 to D81): the Upgrade sheet for a Free student's Pro taps and the one first-session sheet. Nothing for Pro. */}
      {!isTestRoute && <ProNudgeHost offer={offer} previewLinks={previewLinks} />}
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
              className="arena-tour-ring pointer-events-none fixed rounded-2xl border-2 border-volt"
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
            <p className="text-sm leading-6 text-zinc-300">{TOUR_STEPS[tourStep].bodies?.[tourTarget?.via] || TOUR_STEPS[tourStep].body}</p>
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
                <button type="button" className="inline-flex min-h-11 items-center rounded-full bg-volt px-5 py-2 text-sm font-extrabold text-black transition hover:brightness-105" onClick={closeTour}>
                  Finish
                </button>
              ) : (
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center rounded-full bg-volt px-5 py-2 text-sm font-extrabold text-black transition hover:brightness-105"
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
