"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '@/components/AuthProvider';
import { Icon } from '@/components/ui/Icons';
import { ThemeToggle } from './ThemeToggle';
import { useResumableTest } from '@/components/VisitorSync';
import { AccountMenu } from '@/components/shell/AccountMenu';
import { useDismiss } from '@/components/shell/useDismiss';
import { PUBLIC_NAV, audienceClass, renderedHeaderActions } from '@/lib/navigation';
import './nav/public-nav.css';

// The public header (plan section 5.2). Items, labels and who sees them come from
// src/lib/navigation.js. Every state's version is rendered and <html data-visitor> picks one
// before first paint, so the server HTML is the same for everyone and nothing flashes while the
// sign-in check runs.

const pathOf = (href) => String(href).split(/[?#]/)[0];

// A labelled group (DU cutoffs and eligibility, Resources): a button that opens a short list.
function NavDisclosure({ item, pathname }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const panelId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, { rootRef, triggerRef, panelRef });
  const holdsCurrent = item.items.some((link) => pathOf(link.href) === pathname);
  return (
    <div ref={rootRef} className={`mm-disc ${audienceClass(item.show)}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        className="mm-nav__link mm-disc__trigger"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        data-current={holdsCurrent ? 'true' : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {item.label}
        <ChevronDown className="mm-disc__chev" size={16} strokeWidth={2} aria-hidden="true" />
      </button>
      {open ? (
        <ul ref={panelRef} id={panelId} className="mm-disc__panel">
          {item.items.map((link) => (
            <li key={link.id}>
              <Link href={link.href} aria-current={pathOf(link.href) === pathname ? 'page' : undefined} onClick={close}>{link.label}</Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, status, signOut } = useAuth();
  const resume = useResumableTest();
  const [menuOpen, setMenuOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const navRef = useRef(null);
  const toggleRef = useRef(null);

  const closeMenu = () => setMenuOpen(false);
  const confirmed = status === 'authenticated';
  const handleSignOut = useCallback(async () => { await signOut(); router.refresh(); }, [signOut, router]);

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
    <nav ref={navRef} className="mm-nav" data-stuck={stuck ? 'true' : 'false'} aria-label="Main">
      <div className="mm-wrap mm-nav__row">
        <Logo />

        <div className="mm-nav__links">
          {PUBLIC_NAV.map((item) => (item.items ? (
            <NavDisclosure key={item.id} item={item} pathname={pathname} />
          ) : (
            <Link
              key={item.id}
              href={item.href}
              className={`mm-nav__link ${audienceClass(item.show)}`.trim()}
              aria-current={pathname === pathOf(item.href) && !item.href.includes('#') ? 'page' : undefined}
            >
              {item.label}
            </Link>
          )))}
        </div>

        <div className="mm-nav__end">
          <ThemeToggle hint />
          {renderedHeaderActions(resume).map((action) => {
            const className = action.variant === 'primary'
              ? `mm-btn mm-btn--primary mm-nav__cta ${audienceClass(action.show)}`
              : `mm-nav__link mm-nav__login ${audienceClass(action.show)}`;
            return (
              <Link key={action.id} href={action.href} className={className}>{action.label}</Link>
            );
          })}
          <AccountMenu user={user} confirmed={confirmed} onSignOut={handleSignOut} className="vs-member-only mm-nav__acct" />

          <button
            ref={toggleRef}
            type="button"
            className="mm-nav__toggle"
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
        <div className="mm-nav__sheet" id="mm-nav-sheet">
          {/* Shown only below 240px (high zoom), where the bar has no room for the switch. */}
          <div className="mm-nav__sheet-theme">
            <span>Theme</span>
            <ThemeToggle />
          </div>
          {/* The same items in the same order as the bar, with both groups open inline. */}
          {PUBLIC_NAV.map((item) => (item.items ? (
            <div key={item.id} className={`mm-nav__sheet-group ${audienceClass(item.show)}`.trim()} role="group" aria-labelledby={`mm-sheet-${item.id}`}>
              <p id={`mm-sheet-${item.id}`} className="mm-nav__sheet-label">{item.label}</p>
              {item.items.map((link) => (
                <Link key={link.id} href={link.href} onClick={closeMenu}>{link.label}</Link>
              ))}
            </div>
          ) : (
            <Link key={item.id} href={item.href} className={audienceClass(item.show) || undefined} onClick={closeMenu}>{item.label}</Link>
          )))}
          <Link href="/login" className="vs-guest-only" onClick={closeMenu}>Log in</Link>
        </div>
      ) : null}
    </nav>
  );
}
