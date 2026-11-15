// The signed-in shell while the session resolves (16 Nov 2026, lane "load"): the arena's own bars, rail and dock in their
// real places, with quiet skeleton shapes where the account, the places and the page will be. It replaced a centred
// "Securing your session" card with a spinner, which every signed-in page drew first (it is also the server's HTML for every
// arena page) and which then jumped to a completely different screen. Now the frame the student is about to see is already
// there and only its contents fill in.
//
// It uses the shell's own classes (arena.css), so it sits exactly where the bars and the dock will be, in Night and Day. The
// shapes are the shared .skeleton (globals.css: one calm sweep, still under Reduce motion). A focus route (the paper runner,
// a Learn run) has no chrome, so its skeleton has none either. Decorative apart from one status line for screen readers.

import { LogoMark } from '@/components/Logo';
import './arena-shell-skeleton.css';

const RAIL = [64, 78, 58, 70, 52, 66, 74, 56];

export default function ArenaShellSkeleton({ chromeless = false }) {
  if (chromeless) {
    return (
      <div className="view app-shell app-shell--focus ass" style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        <p className="sr-only" role="status">Loading your account</p>
        <main className="app-main app-main--focus ass-focus" aria-hidden="true" style={{ flex: 1, position: 'relative' }}>
          <span className="skeleton ass-focus__top" />
          <span className="skeleton ass-focus__card" />
        </main>
      </div>
    );
  }
  return (
    <div className="view app-shell ass" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <p className="sr-only" role="status">Loading your account</p>
      <aside className="arena-sidebar" aria-hidden="true">
        <span className="logo"><LogoMark /></span>
        <span className="skeleton ass-rail__key" />
        <span className="skeleton ass-rail__door" />
        <span className="ass-rail__places">
          {RAIL.map((w, i) => <span key={i} className="ass-rail__row"><span className="skeleton ass-rail__icon" /><span className="skeleton ass-rail__label" style={{ width: `${w}%` }} /></span>)}
        </span>
      </aside>
      <header className="arena-topbar" aria-hidden="true">
        <div className="arena-topbar__row">
          <span className="arena-topbar__logo"><span className="logo"><LogoMark /></span></span>
          <span className="arena-theme"><span className="skeleton ass-top__theme" /></span>
          <span className="arena-topbar__end ass-top__end">
            <span className="skeleton ass-top__ask" />
            <span className="skeleton ass-top__acct" />
          </span>
        </div>
      </header>
      <main className="app-main px-4 py-6 md:px-5 md:py-8" aria-hidden="true" style={{ flex: 1, position: 'relative' }}>
        <div className="arena-backdrop" />
        <div className="container-std relative z-10 ass-page">
          <span className="skeleton ass-page__kicker" />
          <span className="skeleton ass-page__title" />
          <span className="skeleton ass-page__strip" />
          <span className="ass-page__pair">
            <span className="skeleton ass-page__hero" />
            <span className="skeleton ass-page__card" />
          </span>
        </div>
      </main>
      <div className="arena-dock" aria-hidden="true">
        <div className="arena-bottomnav ass-dock" data-slots="5">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={i === 2 ? 'ass-dock__slot ass-dock__slot--start' : 'ass-dock__slot'}>
              <span className="skeleton ass-dock__icon" />
              {i === 2 ? null : <span className="skeleton ass-dock__label" />}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
