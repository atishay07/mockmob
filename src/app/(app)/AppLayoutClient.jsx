"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { Icon } from '@/components/ui/Icons';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/lib/roleContext';
import { DotPattern } from '@/components/ui/dot-pattern';

export default function AppLayoutClient({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status, signOut } = useAuth();
  const { role, isModerator } = useRole();

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

  return (
    <div className="view" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <aside className="desktop-sidebar">
        <Logo />
        <div className="sidebar-links">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={`/${tab.id}`}
              className={`sidebar-link ${isActive(tab.id) ? 'active' : ''}`}
            >
              <Icon name={tab.icon} style={{ width: '15px', height: '15px' }} />
              {tab.label}
            </Link>
          ))}
        </div>
      </aside>

      <nav className="top-nav" style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(10,10,10,.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,.06)',
      }}>
        <div className="container-std px-4 py-3 md:py-0 flex flex-wrap md:flex-nowrap items-center gap-3 md:h-[60px]">
          <Logo />

          <div className="no-scrollbar order-3 md:order-none basis-full md:basis-auto md:flex-1 flex items-center gap-2 overflow-x-auto md:mx-2">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                href={`/${tab.id}`}
                className={`nav-link ${isActive(tab.id) ? 'active' : ''}`}
                style={{ whiteSpace: 'nowrap' }}
              >
                <Icon name={tab.icon} style={{ width: '13px', height: '13px' }} />
                {tab.label}
              </Link>
            ))}
          </div>

          <div className="ml-auto flex w-full md:w-auto items-center justify-between md:justify-end gap-2 flex-wrap md:flex-nowrap">
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

            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '4px 10px', borderRadius: '24px',
              background: 'rgba(210,240,0,.1)',
              border: '1px solid rgba(210,240,0,.2)',
              color: 'var(--volt)', fontSize: '12px', fontWeight: 700,
              fontFamily: 'var(--font-mono)'
            }}>
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

      <main className="app-main px-4 py-6 md:px-5 md:py-8" style={{ flex: 1, position: 'relative' }}>
        <DotPattern className="fixed inset-0 opacity-20 pointer-events-none" width={24} height={24} />
        <div className="container-std relative z-10">
          {children}
        </div>
      </main>
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
        }
      `}</style>
    </div>
  );
}
