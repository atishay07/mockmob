"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from './Logo';
import { useAuth } from '@/components/AuthProvider';
import { Icon } from '@/components/ui/Icons';
import { ThemeToggle } from './ThemeToggle';
import '@/app/nav-motion.css';

const LINKS = [
  { label: 'Free mock test', href: '/cuet-mock-test-free' },
  { label: 'Cutoff calculator', href: '/cuet-cutoff-calculator' },
  { label: 'Your prep tools', href: '/#your-prep' },
  { label: 'CUET PYQs', href: '/cuet-previous-year-questions' },
  { label: 'Pricing', href: '/pricing' },
];

export function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, status, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const navRef = useRef(null);
  const toggleRef = useRef(null);
  const linksRef = useRef(null);

  // One pill slides to the link you point at, and rests under the page you are on. It is moved by
  // custom properties on the container, so pointing around never re-renders the bar.
  const place = useCallback((el) => {
    const box = linksRef.current;
    if (!box) return;
    if (!el) { box.style.setProperty('--ni-on', '0'); return; }
    // The first aim places the pill where it belongs without sweeping in from the left.
    const first = box.style.getPropertyValue('--ni-on') !== '1';
    if (first) box.dataset.snap = 'true';
    box.style.setProperty('--ni-x', `${el.offsetLeft}px`);
    box.style.setProperty('--ni-w', `${el.offsetWidth}px`);
    box.style.setProperty('--ni-on', '1');
    if (first) { void box.offsetWidth; window.requestAnimationFrame(() => { delete box.dataset.snap; }); }
  }, []);
  const rest = useCallback(() => place(linksRef.current?.querySelector('[aria-current="page"]') || null), [place]);
  useEffect(() => {
    rest();
    const box = linksRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return undefined;
    const watcher = new ResizeObserver(rest);
    watcher.observe(box);
    return () => watcher.disconnect();
  }, [rest, pathname]);
  const aim = (event) => { const link = event.target.closest?.('a.mm-nav__link'); if (link) place(link); };

  const closeMenu = () => setMenuOpen(false);

  // Hairline only appears once the page has actually moved, so the top of the
  // page reads as one uninterrupted sheet of paper.
  useEffect(() => {
    function onScroll() {
      setStuck(window.scrollY > 4);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function onKey(event) {
      if (event.key !== 'Escape') return;
      // The sheet unmounts on close; keep keyboard focus on the control that reopens it.
      if (navRef.current?.contains(document.activeElement)) toggleRef.current?.focus();
      setMenuOpen(false);
    }
    function onPointerDown(event) {
      if (!navRef.current?.contains(event.target)) setMenuOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [menuOpen]);

  return (
    <nav ref={navRef} className="mm-nav" data-stuck={stuck ? 'true' : 'false'}>
      <div className="mm-wrap mm-nav__row">
        <Logo />

        <div ref={linksRef} className="mm-nav__links" onPointerOver={aim} onFocus={aim} onPointerLeave={rest} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) rest(); }}>
          <span className="mm-nav__pill" aria-hidden="true" />
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="mm-nav__link"
              aria-current={pathname === link.href ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="mm-nav__end">
          <ThemeToggle hint />
          {isAuthenticated ? (
            <Link href="/dashboard" className="mm-btn mm-btn--primary mm-nav__cta">
              My Arena
            </Link>
          ) : (
            <>
              <Link href="/login" className="mm-nav__link mm-nav__login">
                Log in
              </Link>
              <Link href="/signup" className="mm-btn mm-btn--primary mm-nav__cta">
                Start free
              </Link>
            </>
          )}

          <button
            ref={toggleRef}
            type="button"
            className="mm-nav__toggle mk-press"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? 'mm-nav-sheet' : undefined}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? (
              <Icon name="x" style={{ width: '22px', height: '22px' }} />
            ) : (
              <span className="mm-nav__bars" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            )}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div className="mm-nav__sheet mm-nav__sheet--in" id="mm-nav-sheet">
          {/* Shown only below 240px (high zoom), where the bar has no room for the switch. */}
          <div className="mm-nav__sheet-theme">
            <span>Theme</span>
            <ThemeToggle />
          </div>
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} onClick={closeMenu}>
              {link.label}
              <Icon name="chevR" style={{ width: '18px', height: '18px', marginLeft: 'auto' }} />
            </Link>
          ))}
          <Link href="/about" onClick={closeMenu}>
            About
            <Icon name="chevR" style={{ width: '18px', height: '18px', marginLeft: 'auto' }} />
          </Link>
          {isAuthenticated ? (
            <>
              <Link href="/profile" onClick={closeMenu}>
                Profile
                <Icon name="chevR" style={{ width: '18px', height: '18px', marginLeft: 'auto' }} />
              </Link>
              <button
                type="button"
                className="mm-nav__signout"
                onClick={async () => {
                  setMenuOpen(false);
                  await signOut();
                  router.refresh();
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" onClick={closeMenu}>
              Log in
              <Icon name="chevR" style={{ width: '18px', height: '18px', marginLeft: 'auto' }} />
            </Link>
          )}
        </div>
      ) : null}
    </nav>
  );
}
