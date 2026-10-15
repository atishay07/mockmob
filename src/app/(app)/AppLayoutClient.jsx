"use client";

// The signed-in shell (web IA plan 2.1, IA1): the app's places in the app's order.
//
//   phone, under 768 px     the app's bottom bar: Today, Practice, Start, Review, You
//   tablet, 768 to 1023 px  a 76 px rail, Start key first, each label under its icon
//   desktop, 1024 px and up a 232 px sidebar: logo, Start key, the four places, credit lines, theme
//
// Start is an action: it opens the Start sheet. Focus mode: on /test the shell shows no chrome at
// all (the runner itself is not edited). A result opens with Review current.
//
// The shell paints at once, before the session is confirmed: the navigation holds nothing private,
// and the page area shows a quiet skeleton until the session is confirmed. Nothing private renders
// before then. A confirmed signed-out visitor goes to log in with ?next kept.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useWalletSummary } from '@/components/useWalletSummary';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/lib/roleContext';
import { loginPathFor } from '@/lib/auth-redirect';
import { brandFlags } from '@/../data/brand_flags.mjs';
import { PLAN_HREF, START_SHEET_FOOTER, TODAY_HREF, VISITOR_KEY, chromeFor, parseVisitorHint, placeForPath, shellGate, titleForPath } from '@/lib/navigation';
import Sidebar from '@/components/shell/Sidebar';
import Rail from '@/components/shell/Rail';
import Dock from '@/components/shell/Dock';
import CreditsChip from '@/components/shell/CreditsChip';
import StartSheet from '@/components/shell/StartSheet';
import GuideTour from '@/components/shell/GuideTour';
import { useStartSheet } from '@/components/shell/useStartSheet';
import { GUIDE_EVENT, START_SHEET_EVENT, useShellSignal } from '@/components/shell/shellSignals';
import {
  aiRemaining as aiRemainingOf, guideRequestFromSearch, guideSeenKey, guideShouldOpen, initialOf, initialRowFor, linkFor as previewLinkFor,
  memberHint, reviewBadge, startRequestFromLocation, visitorDataset,
} from '@/components/shell/shellModel.mjs';
import './arena.css';
import './student-pages.css';
import './explore/explore.css';
import './arena-support.css';
import '@/components/study/study.css';
import '@/components/shell/shell.css';

function reducedMotion() {
  try {
    return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
}

/** Stores the visitor hint and mirrors it on <html> (the public header reads both). No personal data. */
function storeHint(hint) {
  try { window.localStorage.setItem(VISITOR_KEY, JSON.stringify(hint)); } catch { /* the hint is a convenience */ }
  const data = visitorDataset(hint);
  const root = document.documentElement;
  root.dataset.visitor = data.visitor;
  if (data.plan) root.dataset.plan = data.plan; else delete root.dataset.plan;
  if (data.started) root.dataset.started = data.started; else delete root.dataset.started;
}

function readHint() {
  try { return window.localStorage.getItem(VISITOR_KEY); } catch { return null; }
}

const visibleStartKey = () => [...document.querySelectorAll('.sh-start')].find((node) => node.getBoundingClientRect().width > 0) || null;

// The page area before the session is confirmed: the page's shape, no data, no motion loop.
function ShellSkeleton() {
  return (
    <div className="sh-skeleton" aria-busy="true">
      <span className="sr-only" role="status">Checking your sign-in</span>
      <span className="sh-skeleton__title" />
      <span className="sh-skeleton__line" />
      <span className="sh-skeleton__block" />
      <span className="sh-skeleton__block sh-skeleton__block--short" />
    </div>
  );
}

function ShellUnavailable({ onRetry }) {
  const [trying, setTrying] = useState(false);
  return (
    <section className="sh-unavailable" role="alert">
      <h1>Can&apos;t reach MockMob</h1>
      <p>You are still signed in. We could not load your account just now. Check your connection, then try again.</p>
      <button type="button" disabled={trying} onClick={async () => { setTrying(true); try { await onRetry(); } finally { setTrying(false); } }}>
        {trying ? 'Trying again' : 'Try again'}
      </button>
    </section>
  );
}

export default function AppLayoutClient({ children, previewRoute = null, previewLinks = null }) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { user, status, refreshSession } = useAuth();
  const { isModerator } = useRole();
  const activePath = previewRoute || pathname;
  const focus = chromeFor(activePath) === 'focus';
  const gate = shellGate({ status, path: pathname, moderator: isModerator });
  const ready = gate === 'ready';
  const userId = ready ? user?.id || null : null;
  const wallet = useWalletSummary(userId);
  const tonight = useShellSignal('tonight', userId);
  const place = placeForPath(activePath);
  const title = titleForPath(activePath);
  const linkFor = useCallback((href) => previewLinkFor(href, previewLinks), [previewLinks]);
  const pro = ready && Boolean(user?.isPremium);
  const practiceBalance = ready && !pro && user?.creditBalance !== undefined && user?.creditBalance !== null ? user.creditBalance : null;
  const ai = ready ? aiRemainingOf(wallet.wallet) : null;
  const badgeCount = ready && tonight ? tonight.count : null;
  const badge = reviewBadge(badgeCount);
  const initial = ready ? initialOf(user?.name) : '';
  const content = useRef(null);
  const opener = useRef(null);
  const painted = useRef(false);
  const [sheet, setSheet] = useState({ open: false, n: 0, row: null });
  const [guide, setGuide] = useState({ open: false, n: 0, stop: 0 });
  const [sheetPath, setSheetPath] = useState(pathname);
  const start = useStartSheet({ open: sheet.open, userId, user: ready ? user : null, aiBalance: ai });

  // A new page closes the sheet (links in the sheet close it themselves; this covers back and forward).
  if (sheetPath !== pathname) {
    setSheetPath(pathname);
    if (sheet.open) setSheet((s) => ({ ...s, open: false }));
  }

  const openSheet = useCallback((key = null, row = null) => {
    opener.current = key || visibleStartKey();
    setSheet((s) => ({ open: true, n: s.n + 1, row }));
  }, []);
  const closeSheet = useCallback(() => setSheet((s) => ({ ...s, open: false })), []);

  const requestGuide = useCallback((mode = 'replay', stop = 0) => {
    let seen = true; // without storage the guide cannot remember, so it never opens by itself
    try { seen = window.localStorage.getItem(guideSeenKey(userId)) === '1'; } catch { /* keep seen */ }
    if (!guideShouldOpen({ mode, seen })) return;
    setGuide((g) => ({ open: true, n: g.n + 1, stop: Number(stop) || 0 }));
  }, [userId]);
  const closeGuide = useCallback(() => {
    setGuide((g) => ({ ...g, open: false }));
    try { window.localStorage.setItem(guideSeenKey(userId), '1'); } catch { /* it may open once more */ }
  }, [userId]);

  // Confirmed signed out: a returning student lands on login (not signup) and comes back here after.
  useEffect(() => {
    if (gate !== 'signedOut') return;
    if (parseVisitorHint(readHint()).kind === 'member') storeHint({ kind: 'returning' });
    router.replace(loginPathFor(`${window.location.pathname}${window.location.search}`));
  }, [gate, router]);

  // Signed in, but this page needs a role the account lacks.
  useEffect(() => {
    if (gate === 'checking') router.replace(TODAY_HREF);
  }, [gate, router]);

  // Confirmed member: remember it, so the next visit paints the right header before any check.
  useEffect(() => {
    if (ready && user?.id) storeHint(memberHint(user, readHint()));
  }, [ready, user]);

  // A new page starts at the top and fades in (180 ms); the first paint does not animate.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (!painted.current) { painted.current = true; return; }
    const el = content.current;
    if (el && typeof el.animate === 'function' && !reducedMotion()) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
  }, [pathname]);

  // /start?row=… (the app's /start) opens the sheet; ?guide=first|replay asks for the guide.
  useEffect(() => {
    if (!ready || focus) return undefined;
    const frame = requestAnimationFrame(() => {
      const startRequest = startRequestFromLocation(window.location.pathname, window.location.search);
      if (startRequest) openSheet(null, startRequest.row);
      const guideRequest = guideRequestFromSearch(window.location.search);
      if (guideRequest) {
        requestGuide(guideRequest);
        const url = new URL(window.location.href);
        url.searchParams.delete('guide');
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, focus, pathname, openSheet, requestGuide]);

  // Development preview only: ?brand=font shows the display face switch (data/brand_flags.mjs) for Gate A.
  useEffect(() => {
    if (!previewRoute) return undefined;
    const root = document.documentElement;
    if (brandFlags(new URLSearchParams(window.location.search).get('brand')).displayFont !== 'bricolage') return undefined;
    root.style.setProperty('--font-gabarito', 'var(--font-bricolage)');
    return () => root.style.removeProperty('--font-gabarito');
  }, [previewRoute]);

  // Requests from pages: Today's "Start", You > Help "Replay the guide", the first repair's ending.
  useEffect(() => {
    if (focus) return undefined;
    const onStart = (event) => openSheet(null, event.detail?.row ?? null);
    const onGuide = (event) => requestGuide(event.detail?.mode || 'replay', event.detail?.stop || 0);
    window.addEventListener(START_SHEET_EVENT, onStart);
    window.addEventListener(GUIDE_EVENT, onGuide);
    return () => { window.removeEventListener(START_SHEET_EVENT, onStart); window.removeEventListener(GUIDE_EVENT, onGuide); };
  }, [focus, openSheet, requestGuide]);

  const body = ready ? children
    : gate === 'unavailable' ? <ShellUnavailable onRetry={() => refreshSession({ silent: false })} />
      : <ShellSkeleton />;

  if (focus) {
    return (
      <div className="view app-shell app-shell--test" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <main className="app-main app-main--test" style={{ flex: 1, position: 'relative' }}>
          <div className="arena-backdrop" aria-hidden="true" />
          <div className="test-content-host relative z-10">{body}</div>
        </main>
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

  const nav = { activePlace: place, linkFor, badge, badgeCount, initial, sheetOpen: sheet.open, onStart: openSheet };
  const credits = { practiceBalance, aiRemaining: ai, pro };
  return (
    <div className="view app-shell sh-shell" data-gate={gate}>
      <a className="sh-skip" href="#main-content">Skip to content</a>
      <Sidebar {...nav} homeHref={linkFor(TODAY_HREF)} credits={credits} planHref={linkFor(PLAN_HREF)} />
      <Rail {...nav} />
      <header className="sh-header">
        <p className="sh-header__title">{title}</p>
        <CreditsChip {...credits} wallet={ready ? wallet.wallet : null} href={linkFor(PLAN_HREF)} />
      </header>
      <main id="main-content" className="app-main sh-main px-4 py-6 md:px-5 md:py-8" tabIndex={-1}>
        <div className="arena-backdrop" aria-hidden="true" />
        <div ref={content} className="container-std relative z-10">{body}</div>
      </main>
      <Dock {...nav} />
      {sheet.open ? (
        <StartSheet key={sheet.n} open onClose={closeSheet} rows={start.rows} footer={START_SHEET_FOOTER} heroLoading={start.heroLoading}
          initialRow={sheet.row ? initialRowFor(sheet.row, start.rows) : null} returnFocusRef={opener} onSelectSubject={start.selectSubject} linkFor={linkFor} />
      ) : null}
      {guide.open ? <GuideTour key={guide.n} open startAt={guide.stop} onClose={closeGuide} /> : null}
    </div>
  );
}
