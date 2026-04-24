"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo } from './Logo';
import { useAuth } from '@/components/AuthProvider';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icons';

export function NavBar() {
  const router = useRouter();
  const { isAuthenticated, status, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const links = [
    { label: 'Features', href: '/features' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Leaderboard', href: isAuthenticated ? '/leaderboard' : '/login' },
  ];

  useEffect(() => {
    function handleClickOutside(event) {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5" style={{ background: 'rgba(10,10,10,0.75)', backdropFilter: 'blur(20px)' }}>
      <div className="container-wide px-5 flex items-center justify-between" style={{ height: '60px' }}>
        <div className="flex items-center gap-8">
          <Logo />
          <div className="hidden md:flex gap-6">
            {links.map((link) => (
              <Link 
                key={link.label}
                href={link.href}
                className="hover:text-white transition-colors"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: '13px', color: '#a1a1aa' }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {status === 'loading' ? null : isAuthenticated ? (
            <>
              <Link href="/dashboard" className="btn-ghost">Go to Arena</Link>
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{
                    padding: '6px 8px',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.03)',
                    color: '#d4d4d8',
                  }}
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  <Avatar name="Profile" size="sm" />
                  <span className="hidden sm:inline">Profile</span>
                  <svg className="icon" viewBox="0 0 24 24" style={{ transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .15s ease' }}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {menuOpen && (
                  <div
                    className="glass"
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 10px)',
                      minWidth: '220px',
                      padding: '10px',
                    }}
                  >
                    <Link
                      href="/profile"
                      className="btn-ghost"
                      style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 10px', borderRadius: '10px' }}
                      onClick={() => setMenuOpen(false)}
                    >
                      <Icon name="users" /> Profile
                    </Link>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 10px', borderRadius: '10px' }}
                      onClick={async () => {
                        setMenuOpen(false);
                        await signOut();
                        router.refresh();
                      }}
                    >
                      <Icon name="logout" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">Login / Signup</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
