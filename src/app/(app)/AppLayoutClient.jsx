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

// ── Role switcher pill ────────────────────────────────────────────────────────
function RoleSwitcher() {
  const { role, setRole } = useRole();
  const next = role === 'student' ? 'moderator' : 'student';
  return (
    <button
      onClick={() => setRole(next)}
      title={`Switch to ${next}`}
      style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        padding: '4px 10px', borderRadius: '20px',
        background: role === 'moderator'
          ? 'rgba(210,240,0,.12)'
          : 'rgba(255,255,255,.05)',
        border: role === 'moderator'
          ? '1px solid rgba(210,240,0,.3)'
          : '1px solid rgba(255,255,255,.08)',
        color: role === 'moderator' ? 'var(--volt)' : '#71717a',
        cursor: 'pointer', fontSize: '9px',
        fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.15em',
        textTransform: 'uppercase', transition: 'all .2s ease',
      }}
    >
      {role === 'moderator' ? '⚡' : '👤'} {role}
    </button>
  );
}

// ── Main layout ───────────────────────────────────────────────────────────────
export default function AppLayoutClient({ children }) {
  const pathname   = usePathname();
  const router     = useRouter();
  const { user, status, signOut } = useAuth();
  const { role }   = useRole();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/signup');
  }, [status, router]);

  if (status !== 'authenticated') {
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

  // ── Nav tabs (role-aware) ──
  const studentTabs = [
    { id: 'dashboard',  label: 'Arena',    icon: 'zap' },
    { id: 'explore',    label: 'Explore',  icon: 'radar' },
    { id: 'analytics',  label: 'Radar',    icon: 'bar' },
    { id: 'leaderboard',label: 'Ranks',    icon: 'trophy' },
    { id: 'upload',     label: 'Contribute',icon: 'upload' },
    { id: 'my-uploads', label: 'My Uploads',icon: 'book' },
    { id: 'profile',    label: 'Profile',  icon: 'users' },
  ];
  const modTabs = [
    { id: 'moderation', label: 'Mod Queue', icon: 'shield' },
    { id: 'explore',    label: 'Explore',   icon: 'radar' },
    { id: 'dashboard',  label: 'Arena',     icon: 'zap' },
    { id: 'profile',    label: 'Profile',   icon: 'users' },
  ];
  const tabs = role === 'moderator' ? modTabs : studentTabs;

  const isActive = (id) => pathname.includes(id);

  return (
    <div className="view" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* ── Top Nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(10,10,10,.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,.06)',
      }}>
        <div className="container-std" style={{
          padding: '0 20px',
          display: 'flex', alignItems: 'center',
          height: '60px', gap: '8px',
        }}>
          {/* Logo */}
          <Logo />

          {/* Nav links — scrollable on mobile */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '2px',
            overflowX: 'auto', flex: 1, margin: '0 8px',
            scrollbarWidth: 'none',
          }}
            className="no-scrollbar"
          >
            {tabs.map(t => (
              <Link
                key={t.id}
                href={`/${t.id}`}
                className={`nav-link ${isActive(t.id) ? 'active' : ''}`}
                style={{ whiteSpace: 'nowrap' }}
              >
                <Icon name={t.icon} style={{ width: '13px', height: '13px' }} />
                {t.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <RoleSwitcher />
            
            {/* ── Credit Pill ── */}
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

            <Link href="/profile" style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '4px 10px 4px 6px', borderRadius: '24px',
              background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(255,255,255,.07)',
              textDecoration: 'none',
            }}>
              <Avatar name={user?.name} size="sm" />
              <span style={{
                fontSize: '12px', fontWeight: 600, color: '#d4d4d8',
                maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
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
              onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
              onMouseLeave={e => e.currentTarget.style.color = '#52525b'}
            >
              <Icon name="logout" style={{ width: '14px', height: '14px' }} />
            </button>
          </div>
        </div>

        {/* ── Role banner for moderators ── */}
        {role === 'moderator' && (
          <div style={{
            background: 'rgba(210,240,0,.06)',
            borderTop: '1px solid rgba(210,240,0,.15)',
            padding: '5px 20px',
            display: 'flex', alignItems: 'center', gap: '8px',
            fontSize: '10px', color: 'var(--volt)',
            fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.18em',
          }}>
            ⚡ MODERATOR MODE — actions are permanent
          </div>
        )}
      </nav>

      {/* ── Page content ── */}
      <main style={{ flex: 1, padding: '32px 20px', position: 'relative' }}>
        <DotPattern className="fixed inset-0 opacity-20 pointer-events-none" width={24} height={24} />
        <div className="container-std relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}
