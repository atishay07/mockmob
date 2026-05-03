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
  const desktopMenuRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const mobileMenuButtonRef = useRef(null);

  const links = [
    { label: 'CUET Mock Test', href: '/cuet-mock-test-free' },
    { label: 'CUET PYQs', href: '/cuet-previous-year-questions' },
    { label: 'Features', href: '/features' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Leaderboard', href: isAuthenticated ? '/leaderboard' : '/login' },
  ];

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        !desktopMenuRef.current?.contains(event.target) &&
        !mobileMenuRef.current?.contains(event.target) &&
        !mobileMenuButtonRef.current?.contains(event.target)
      ) {
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
          <button
            ref={mobileMenuButtonRef}
            type="button"
            className="md:hidden inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-volt/30 bg-volt text-black shadow-[0_0_28px_rgba(210,240,0,0.22)]"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
          >
            <span className="inline-flex flex-col gap-1.5">
              <span className="block h-0.5 w-5 rounded-full bg-current" />
              <span className="block h-0.5 w-5 rounded-full bg-current" />
              <span className="block h-0.5 w-5 rounded-full bg-current" />
            </span>
          </button>
          <Logo />
          <div className="hidden md:flex gap-6">
            {links.map((link) => (
              <Link 
                key={link.label}
                href={link.href}
                className="hover:text-white transition-colors"
                style={{ display: 'inline-flex', minHeight: '44px', alignItems: 'center', fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: '13px', color: '#a1a1aa' }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {status === 'loading' ? null : isAuthenticated ? (
            <>
              <Link href="/dashboard" className="btn-ghost hidden sm:inline-flex">Go to Arena</Link>
              <div className="relative hidden md:block" ref={desktopMenuRef}>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{
                    minHeight: '44px',
                    padding: '6px 10px',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.03)',
                    color: '#d4d4d8',
                  }}
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  <Avatar name="Profile" size="sm" />
                  <span className="hidden sm:inline">Profile</span>
                  <span className="sm:hidden mono-label !text-zinc-300 !tracking-[0.08em]">Menu</span>
                  <svg className="icon" viewBox="0 0 24 24" style={{ transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .15s ease' }}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {menuOpen && (
                  <div
                    className="glass desktop-menu-panel"
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 10px)',
                      minWidth: '220px',
                      padding: '10px',
                    }}
                  >
                    <div className="md:hidden">
                      {links.map((link) => (
                        <Link
                          key={link.label}
                          href={link.href}
                          className="btn-ghost"
                          style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 10px', borderRadius: '10px' }}
                          onClick={() => setMenuOpen(false)}
                        >
                          <Icon name="arrow" /> {link.label}
                        </Link>
                      ))}
                    </div>
                    <Link
                      href="/dashboard"
                      className="btn-ghost"
                      style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 12px', borderRadius: '10px' }}
                      onClick={() => setMenuOpen(false)}
                    >
                      <Icon name="zap" /> Arena
                    </Link>
                    <Link
                      href="/profile"
                      className="btn-ghost"
                      style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 12px', borderRadius: '10px' }}
                      onClick={() => setMenuOpen(false)}
                    >
                      <Icon name="users" /> Profile
                    </Link>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 12px', borderRadius: '10px' }}
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
              <div className="relative hidden md:block" ref={desktopMenuRef}>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{
                    minHeight: '44px',
                    padding: '8px 12px',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.03)',
                    color: '#d4d4d8',
                  }}
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-label="Open navigation menu"
                >
                  <span className="inline-flex flex-col gap-1">
                    <span className="block h-0.5 w-4 rounded-full bg-current" />
                    <span className="block h-0.5 w-4 rounded-full bg-current" />
                    <span className="block h-0.5 w-4 rounded-full bg-current" />
                  </span>
                  <span className="hidden sm:inline">Menu</span>
                </button>

                {menuOpen && (
                  <div
                    className="glass desktop-menu-panel"
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 10px)',
                      minWidth: '220px',
                      padding: '10px',
                    }}
                  >
                    {links.map((link) => (
                      <Link
                        key={link.label}
                        href={link.href}
                        className="btn-ghost"
                        style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 12px', borderRadius: '10px' }}
                        onClick={() => setMenuOpen(false)}
                      >
                        <Icon name="arrow" /> {link.label}
                      </Link>
                    ))}
                    <Link
                      href="/login"
                      className="btn-ghost"
                      style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 12px', borderRadius: '10px', color: 'var(--volt)' }}
                      onClick={() => setMenuOpen(false)}
                    >
                      <Icon name="users" /> Login / Signup
                    </Link>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {menuOpen && (
        <div
          ref={mobileMenuRef}
          className="md:hidden fixed left-3 right-3 top-[70px] z-[60] rounded-2xl border border-white/10 bg-[#090909] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.72)]"
        >
          <div className="mb-3 flex items-center justify-between border-b border-white/8 pb-3">
            <Logo />
            <button
              type="button"
              className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 text-zinc-300"
              onClick={() => setMenuOpen(false)}
              aria-label="Close navigation menu"
            >
              <span className="text-2xl leading-none">&times;</span>
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="flex min-h-14 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 font-display text-base font-bold text-white no-underline"
                onClick={() => setMenuOpen(false)}
              >
                <Icon name="arrow" /> {link.label}
              </Link>
            ))}
            {isAuthenticated ? (
              <>
                <Link
                  href="/dashboard"
                  className="flex min-h-14 items-center gap-3 rounded-xl border border-volt/30 bg-volt/10 px-4 font-display text-base font-bold text-volt no-underline"
                  onClick={() => setMenuOpen(false)}
                >
                  <Icon name="zap" /> Arena
                </Link>
                <Link
                  href="/profile"
                  className="flex min-h-14 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 font-display text-base font-bold text-white no-underline"
                  onClick={() => setMenuOpen(false)}
                >
                  <Icon name="users" /> Profile
                </Link>
                <button
                  type="button"
                  className="flex min-h-14 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-left font-display text-base font-bold text-zinc-300"
                  onClick={async () => {
                    setMenuOpen(false);
                    await signOut();
                    router.refresh();
                  }}
                >
                  <Icon name="logout" /> Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="flex min-h-14 items-center gap-3 rounded-xl border border-volt/30 bg-volt px-4 font-display text-base font-black text-black no-underline"
                onClick={() => setMenuOpen(false)}
              >
                <Icon name="users" /> Login / Signup
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
