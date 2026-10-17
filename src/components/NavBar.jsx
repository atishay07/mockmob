"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from './Logo';
import { useAuth } from '@/components/AuthProvider';
import { Icon } from '@/components/ui/Icons';
import { ThemeToggle } from './ThemeToggle';
import { useWayIn } from './landing/useWayIn';
import '@/app/nav-motion.css';

const LINKS = [
  { label: 'Free mock test', href: '/cuet-mock-test-free' },
  { label: 'Cutoff calculator', href: '/cuet-cutoff-calculator' },
  { label: 'Your prep tools', href: '/#your-prep' },
  { label: 'PYQ guide', href: '/cuet-previous-year-questions' },
  { label: 'Pricing', href: '/pricing' },
];

export function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, status, signOut } = useAuth();
  const { signupHref, homeHref, homeText } = useWayIn();
  const [menuOpen, setMenuOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  // On the landing the bar's key waits for the hero's own buttons to scroll away (it would repeat them), then
  // rises into place. Elsewhere it is always there.
  const onLanding = pathname === '/';
  const [heroGone, setHeroGone] = useState(false);
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
    if (!onLanding) return undefined;
    // The hero's buttons, else the hero, else a screen of scrolling. Not intersecting means it is above us
    // (the landing's hero is the first thing on the page), or the visitor arrived part way down by a link.
    const mark = document.querySelector('.lp-hero .lp-cta') || document.querySelector('.lp-hero');
    if (!mark || typeof IntersectionObserver === 'undefined') {
      const onScroll = () => setHeroGone(window.scrollY > window.innerHeight * 0.7);
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      return () => window.removeEventListener('scroll', onScroll);
    }
    const watch = new IntersectionObserver((entries) => {
      setHeroGone(!entries[entries.length - 1].isIntersecting);
    }, { rootMargin: '-64px 0px 0px 0px', threshold: 0 });
    watch.observe(mark);
    return () => watch.disconnect();
  }, [onLanding]);

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
    <nav ref={navRef} className="mm-nav" data-stuck={stuck ? 'true' : 'false'} data-start={onLanding ? (heroGone ? 'in' : 'out') : undefined} data-member={isAuthenticated ? 'true' : undefined}>
      <div className="mm-wrap mm-nav__row">
        <Logo prefetch={pathname === '/' ? false : undefined} />

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
          {/* No first-visit hint on the landing: it would sit over the headline while the visitor reads it. */}
          <ThemeToggle hint={!onLanding} />
          {isAuthenticated ? (
            <Link href={homeHref} className="mm-btn mm-btn--primary mm-nav__cta">
              {homeText}
            </Link>
          ) : (
            <>
              <Link href="/login" className="mm-nav__link mm-nav__login">
                Log in
              </Link>
              <Link href={signupHref} className="mm-btn mm-btn--primary mm-nav__cta">
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
          {isAuthenticated ? (
            <Link href={homeHref} onClick={closeMenu} className="mm-btn mm-btn--primary mm-nav__sheet-key">
              {homeText}
            </Link>
          ) : null}
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} onClick={closeMenu}>
              {link.label}
            </Link>
          ))}
          <Link href="/about" onClick={closeMenu}>
            About
          </Link>
          {isAuthenticated ? (
            <>
              <Link href="/profile" onClick={closeMenu}>
                Profile
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
            <>
              <Link href="/login" onClick={closeMenu}>
                Log in
              </Link>
              <Link href={signupHref} onClick={closeMenu} className="mm-btn mm-btn--primary mm-nav__sheet-key">
                Start free
              </Link>
            </>
          )}
        </div>
      ) : null}
    </nav>
  );
}
