"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { Icon } from '@/components/ui/Icons';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/lib/roleContext';
import { DotPattern } from '@/components/ui/dot-pattern';

const TOUR_STEPS = [
  { title: 'Arena', target: 'nav-dashboard', body: 'Start timed CUET mocks, choose subjects, chapters, question count, and difficulty controls.' },
  { title: 'Compass', target: 'nav-admission-compass', body: 'Turn your mock score band into college and course direction.' },
  { title: 'Explore', target: 'nav-explore', body: 'Practice from the live question feed with subject, unit, chapter, difficulty, and search filters.' },
  { title: 'Radar', target: 'nav-analytics', body: 'Track accuracy, weak areas, speed, streaks, and chapter priorities.' },
  { title: 'Saved', target: 'nav-saved', body: 'Keep important questions in one place for revision.' },
  { title: 'Ranks', target: 'nav-leaderboard', body: 'Compare XP and performance on the community leaderboard.' },
  { title: 'Contribute', target: 'nav-upload', body: 'Upload useful questions and grow the shared question bank.' },
  { title: 'My Uploads', target: 'nav-my-uploads', body: 'Watch your submitted questions move through moderation.' },
  { title: 'Profile', target: 'nav-profile', body: 'Manage account details, subjects, credits, and plan status.' },
  { title: 'Credits', target: 'credits-pill', body: 'Free users spend credits to generate mocks. Premium removes that friction.' },
  { title: 'Mobile menu', target: 'mobile-menu-toggle', body: 'Tap the three lines to show or hide navigation on phones.' },
  { title: 'Premium', target: 'guide-button', body: 'Use Premium for unlimited mocks, advanced Radar, Compass, fast-lane generation, and advanced filters.' },
];

export default function AppLayoutClient({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status, signOut } = useAuth();
  const { role, isModerator } = useRole();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourTarget, setTourTarget] = useState(null);
  const tourSeenKey = user?.id ? `mockmob_app_tour_seen_${user.id}` : 'mockmob_app_tour_seen';
  const isTestRoute = pathname.startsWith('/test');

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
    if (status !== 'authenticated' || typeof window === 'undefined') return;
    if (isTestRoute) return;
    if (window.localStorage.getItem(tourSeenKey)) return;
    const id = window.setTimeout(() => setTourOpen(true), 250);
    return () => window.clearTimeout(id);
  }, [status, tourSeenKey, isTestRoute]);

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
      node.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
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
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexDirection: 'column', gap: '16px',
      }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          border: '2px solid rgba(210,240,0,.3)', borderTopColor: 'var(--volt)',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ color: '#52525b', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>LOADING SESSION…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const studentTabs = [
    { id: 'dashboard', label: 'Arena', icon: 'zap' },
    { id: 'admission-compass', label: 'Compass', icon: 'target' },
    { id: 'explore', label: 'Explore', icon: 'radar' },
    { id: 'analytics', label: 'Radar', icon: 'bar' },
    { id: 'saved', label: 'Saved', icon: 'book' },
    { id: 'leaderboard', label: 'Ranks', icon: 'trophy' },
    { id: 'upload', label: 'Contribute', icon: 'upload' },
    { id: 'my-uploads', label: 'My Uploads', icon: 'book' },
    { id: 'profile', label: 'Profile', icon: 'users' },
  ];

  const modTabs = [
    { id: 'dashboard', label: 'Arena', icon: 'zap' },
    { id: 'admission-compass', label: 'Compass', icon: 'target' },
    { id: 'moderation', label: 'Mod Queue', icon: 'shield' },
    { id: 'explore', label: 'Explore', icon: 'radar' },
    { id: 'saved', label: 'Saved', icon: 'book' },
    { id: 'profile', label: 'Profile', icon: 'users' },
  ];

  const tabs = role === 'moderator' ? modTabs : studentTabs;
  const isActive = (id) => pathname.includes(id);

  function closeTour() {
    setTourOpen(false);
    setTourStep(0);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(tourSeenKey, 'true');
    }
  }

  return (
    <div className={`view app-shell ${isTestRoute ? 'app-shell--test' : ''}`} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <aside className="desktop-sidebar">
        <Logo />
        <div className="sidebar-links">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={`/${tab.id}`}
              className={`sidebar-link ${isActive(tab.id) ? 'active' : ''}`}
              data-tour={`nav-${tab.id}`}
            >
              <Icon name={tab.icon} style={{ width: '15px', height: '15px' }} />
              {tab.label}
            </Link>
          ))}
        </div>
      </aside>

      {!isTestRoute && (
      <nav className="top-nav" style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(10,10,10,.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,.06)',
      }}>
        <div className="container-std px-4 py-3 md:py-0 flex flex-wrap md:flex-nowrap items-center gap-3 md:h-[60px]">
          <Logo />

          <button
            type="button"
            data-tour="mobile-menu-toggle"
            className="md:hidden ml-auto inline-flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-200"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            <span className="inline-flex flex-col gap-1">
              <span className="block h-0.5 w-5 rounded-full bg-current" />
              <span className="block h-0.5 w-5 rounded-full bg-current" />
              <span className="block h-0.5 w-5 rounded-full bg-current" />
            </span>
          </button>

          <div className="no-scrollbar order-3 md:order-none basis-full md:basis-auto md:flex-1 hidden md:flex items-center gap-2 overflow-x-auto md:mx-2">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                href={`/${tab.id}`}
                className={`nav-link ${isActive(tab.id) ? 'active' : ''}`}
                data-tour={`nav-${tab.id}`}
                style={{ whiteSpace: 'nowrap' }}
              >
                <Icon name={tab.icon} style={{ width: '13px', height: '13px' }} />
                {tab.label}
              </Link>
            ))}
          </div>

          <div className="ml-auto hidden md:flex w-full md:w-auto items-center justify-between md:justify-end gap-2 flex-wrap md:flex-nowrap">
            {isModerator && (
              <Link
                href="/moderation"
                className="btn-ghost"
                style={{
                  padding: '6px 10px',
                  borderRadius: '999px',
                  border: '1px solid rgba(210,240,0,.22)',
                  background: 'rgba(210,240,0,.08)',
                  color: 'var(--volt)',
                  fontSize: '10px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                }}
              >
                Moderator Mode
              </Link>
            )}

            <button
              type="button"
              className="btn-ghost"
              data-tour="guide-button"
              style={{ padding: '6px 10px', borderRadius: '999px', fontSize: '10px' }}
              onClick={() => {
                setTourStep(0);
                setTourOpen(true);
              }}
            >
              <Icon name="spark" style={{ width: '12px', height: '12px' }} />
              Guide
            </button>

            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '4px 10px', borderRadius: '24px',
              background: 'rgba(210,240,0,.1)',
              border: '1px solid rgba(210,240,0,.2)',
              color: 'var(--volt)', fontSize: '12px', fontWeight: 700,
              fontFamily: 'var(--font-mono)'
            }} data-tour="credits-pill">
              <Icon name="spark" style={{ width: '12px', height: '12px' }} />
              <span style={{ opacity: 0.75 }}>Credits</span>
              {user?.creditBalance || 0}
            </div>

            {user?.isPremium && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '4px 10px', borderRadius: '24px',
                background: 'var(--volt)',
                border: '1px solid var(--volt)',
                color: '#000', fontSize: '11px', fontWeight: 800,
                fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                <Icon name="zap" style={{ width: '12px', height: '12px' }} />
                Premium
              </div>
            )}

            <Link
              href="/profile"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px 4px 6px', borderRadius: '24px',
                background: 'rgba(255,255,255,.04)',
                border: '1px solid rgba(255,255,255,.07)',
                textDecoration: 'none',
                minWidth: 0,
              }}
            >
              <Avatar name={user?.name} size="sm" />
              <span style={{
                fontSize: '12px', fontWeight: 600, color: '#d4d4d8',
                maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{user?.name ?? 'User'}</span>
            </Link>

            <button
              onClick={async () => { await signOut(); router.push('/'); }}
              title="Sign out"
              style={{
                background: 'none', border: '1px solid rgba(255,255,255,.07)',
                borderRadius: '8px', padding: '6px 8px', cursor: 'pointer',
                color: '#52525b', transition: 'color .15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#52525b'; }}
            >
              <Icon name="logout" style={{ width: '14px', height: '14px' }} />
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/5 px-4 pb-4">
            <div className="grid grid-cols-2 gap-2 pt-3">
              {tabs.map((tab) => (
                <Link
                  key={tab.id}
                  href={`/${tab.id}`}
                  className={`nav-link ${isActive(tab.id) ? 'active' : ''}`}
                  data-tour={`nav-${tab.id}`}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    width: '100%',
                    justifyContent: 'flex-start',
                    borderBottomWidth: 0,
                    borderRadius: '10px',
                    background: isActive(tab.id) ? 'rgba(210,240,0,.08)' : 'rgba(255,255,255,.025)',
                    border: isActive(tab.id) ? '1px solid rgba(210,240,0,.18)' : '1px solid rgba(255,255,255,.06)',
                    padding: '12px',
                  }}
                >
                  <Icon name={tab.icon} style={{ width: '14px', height: '14px' }} />
                  {tab.label}
                </Link>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/[0.025] p-2">
              <Link href="/profile" className="flex min-w-0 items-center gap-2 text-decoration-none" onClick={() => setMobileMenuOpen(false)}>
                <Avatar name={user?.name} size="sm" />
                <span className="truncate text-sm font-semibold text-zinc-200">{user?.name ?? 'User'}</span>
              </Link>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-volt/20 bg-volt/10 px-2 py-1 text-[10px] font-bold text-volt">
                  {user?.creditBalance || 0} credits
                </span>
                <button
                  onClick={async () => { await signOut(); router.push('/'); }}
                  title="Sign out"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 text-zinc-300"
                >
                  <Icon name="logout" style={{ width: '14px', height: '14px' }} />
                </button>
              </div>
            </div>
            <button
              type="button"
              className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-volt/25 bg-volt/10 font-display text-sm font-bold text-volt"
              data-tour="guide-button"
              onClick={() => {
                setTourStep(0);
                setTourOpen(true);
              }}
            >
              <Icon name="spark" style={{ width: '14px', height: '14px' }} />
              Open guide
            </button>
          </div>
        )}

        {isModerator && (
          <div style={{
            background: 'rgba(210,240,0,.06)',
            borderTop: '1px solid rgba(210,240,0,.15)',
            padding: '5px 20px',
            display: 'flex', alignItems: 'center', gap: '8px',
            fontSize: '10px', color: 'var(--volt)',
            fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.18em',
          }}>
            Moderator access is active for this account.
          </div>
        )}
      </nav>
      )}

      <main className={`app-main ${isTestRoute ? 'app-main--test' : 'px-4 py-6 md:px-5 md:py-8'}`} style={{ flex: 1, position: 'relative' }}>
        <DotPattern className="fixed inset-0 opacity-20 pointer-events-none" width={24} height={24} />
        <div className={`${isTestRoute ? 'test-content-host' : 'container-std'} relative z-10`}>
          {children}
        </div>
      </main>
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
            className="pointer-events-auto fixed w-[min(380px,calc(100vw-32px))] rounded-2xl border border-volt/25 bg-[#0b0b0b]/95 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.75)]"
            style={tourTarget ? { left: tourTarget.cardLeft, top: tourTarget.cardTop } : { left: '16px', bottom: '16px' }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="mono-label text-volt">Step {tourStep + 1} of {TOUR_STEPS.length}</div>
                <h2 className="mt-1 font-display text-[22px] font-extrabold text-white">{TOUR_STEPS[tourStep].title}</h2>
              </div>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-zinc-400"
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
                className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-zinc-400 transition hover:border-white/20 hover:text-white disabled:opacity-35"
                disabled={tourStep === 0}
                onClick={() => setTourStep((step) => Math.max(0, step - 1))}
              >
                Back
              </button>
              {tourStep === TOUR_STEPS.length - 1 ? (
                <button type="button" className="rounded-full bg-volt px-5 py-2 text-sm font-extrabold text-black shadow-[0_0_22px_rgba(210,240,0,0.22)] transition hover:brightness-110" onClick={closeTour}>
                  Finish
                </button>
              ) : (
                <button
                  type="button"
                  className="rounded-full bg-volt px-5 py-2 text-sm font-extrabold text-black shadow-[0_0_22px_rgba(210,240,0,0.22)] transition hover:brightness-110"
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
        .desktop-sidebar { display: none; }
        @media (min-width: 1024px) {
          .desktop-sidebar {
            display: flex;
            position: fixed;
            inset: 0 auto 0 0;
            z-index: 45;
            width: 224px;
            padding: 22px 14px;
            border-right: 1px solid rgba(255,255,255,.07);
            background: rgba(10,10,10,.88);
            backdrop-filter: blur(20px);
            flex-direction: column;
            gap: 26px;
          }
          .sidebar-links { display: flex; flex-direction: column; gap: 6px; }
          .sidebar-link {
            display: flex;
            align-items: center;
            gap: 10px;
            min-height: 40px;
            border-radius: 10px;
            color: #71717a;
            font-family: var(--font-mono);
            font-size: 11px;
            font-weight: 800;
            letter-spacing: .14em;
            padding: 0 12px;
            text-decoration: none;
            text-transform: uppercase;
          }
          .sidebar-link:hover { color: #fff; background: rgba(255,255,255,.035); }
          .sidebar-link.active {
            color: var(--volt);
            background: rgba(210,240,0,.08);
            border: 1px solid rgba(210,240,0,.18);
          }
          .top-nav .nav-link { display: none; }
          .top-nav .container-std { padding-left: 244px; }
          .app-main { padding-left: 244px !important; }
          .app-shell--test .app-main {
            padding-left: 224px !important;
          }
        }
        .app-shell--test .app-main--test {
          padding: 0;
        }
        .app-shell--test .test-content-host {
          width: 100%;
          max-width: none;
          margin: 0;
        }
        @media (min-width: 1024px) {
          .app-shell--test .app-main--test {
            padding-left: 224px !important;
          }
        }
      `}</style>
    </div>
  );
}
