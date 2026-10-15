"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '@/components/AuthProvider';
import { Icon } from '@/components/ui/Icons';
import { ThemeToggle } from './ThemeToggle';
import { FREE_TOOLS, HEADER_ACTIONS, PUBLIC_NAV, TODAY_HREF, VISITOR_KEY, audienceClass, parseVisitorHint } from '@/lib/navigation';
import '@/app/nav-motion.css';

// The public header (web IA plan 2.3). Signed out: How it works, Subjects, Free tools, Pricing, then
// Log in and Start free (a returning visitor gets Log in as the button). Signed in: Free tools,
// Pricing (not for Pro) and Open MockMob. Every variant is rendered; <html data-visitor> picks one
// before first paint (marketing-theme.css), and this bar keeps the attribute true once the session
// check answers, so nobody sees the pitch for strangers after signing in.

/** The visitor attribute for a confirmed auth answer, or null while it is still unknown. */
export function visitorFor(status, user, storedHint) {
  if (status === 'authenticated') return { kind: 'member', plan: user?.isPremium ? 'pro' : 'free' };
  if (status === 'unauthenticated') return { kind: parseVisitorHint(storedHint).kind === 'new' ? 'new' : 'returning', plan: null };
  return null;
}

function readHint() {
  try { return window.localStorage.getItem(VISITOR_KEY); } catch { return null; }
}

const isToolPath = (pathname) => FREE_TOOLS.some((t) => t.href === pathname);

export function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, status, user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const navRef = useRef(null);
  const toggleRef = useRef(null);
  const linksRef = useRef(null);
  const toolsRef = useRef(null);
  const toolsButtonRef = useRef(null);
  const toolsId = useId();

  // Keep <html data-visitor> true to the confirmed session.
  useEffect(() => {
    const v = visitorFor(status, user, readHint());
    if (!v) return;
    const root = document.documentElement;
    if (root.dataset.visitor !== v.kind) root.dataset.visitor = v.kind;
    if (v.plan) root.dataset.visitorPlan = v.plan;
    else delete root.dataset.visitorPlan;
  }, [status, user]);

  // One pill slides to the link you point at, and rests under the page you are on. It is moved by
  // custom properties on the container, so pointing around never re-renders the bar.
  const place = useCallback((el) => {
    const box = linksRef.current;
    if (!box) return;
    if (!el || !el.offsetWidth) { box.style.setProperty('--ni-on', '0'); return; }
    const first = box.style.getPropertyValue('--ni-on') !== '1';
    if (first) box.dataset.snap = 'true';
    box.style.setProperty('--ni-x', `${el.offsetLeft}px`);
    box.style.setProperty('--ni-w', `${el.offsetWidth}px`);
    box.style.setProperty('--ni-on', '1');
    if (first) { void box.offsetWidth; window.requestAnimationFrame(() => { delete box.dataset.snap; }); }
  }, []);
  const rest = useCallback(() => place(linksRef.current?.querySelector('[aria-current="page"], [data-current="true"]') || null), [place]);
  useEffect(() => {
    rest();
    const box = linksRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return undefined;
    const watcher = new ResizeObserver(rest);
    watcher.observe(box);
    return () => watcher.disconnect();
  }, [rest, pathname]);
  const aim = (event) => { const link = event.target.closest?.('.mm-nav__link'); if (link && linksRef.current?.contains(link)) place(link); };

  const closeMenu = () => setMenuOpen(false);

  // The hairline appears once the page has moved, so the top of the page reads as one sheet.
  useEffect(() => {
    function onScroll() { setStuck(window.scrollY > 4); }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the open sheet or the Free tools list on Escape or a press outside, and give focus back
  // to the control that opened it.
  useEffect(() => {
    if (!menuOpen && !toolsOpen) return undefined;
    function onKey(event) {
      if (event.key !== 'Escape') return;
      if (toolsOpen) { setToolsOpen(false); toolsButtonRef.current?.focus(); return; }
      if (navRef.current?.contains(document.activeElement)) toggleRef.current?.focus();
      setMenuOpen(false);
    }
    function onPointerDown(event) {
      if (toolsOpen && !toolsRef.current?.contains(event.target)) setToolsOpen(false);
      if (menuOpen && !navRef.current?.contains(event.target)) setMenuOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [menuOpen, toolsOpen]);

  // Leaving the Free tools list by keyboard closes it.
  const onToolsBlur = (event) => { if (!event.currentTarget.contains(event.relatedTarget)) setToolsOpen(false); };

  const links = PUBLIC_NAV.filter((item) => item.href);
  const actions = HEADER_ACTIONS;

  return (
    <nav ref={navRef} className="mm-nav" data-stuck={stuck ? 'true' : 'false'} aria-label="Main">
      <div className="mm-wrap mm-nav__row">
        <Logo />

        <div ref={linksRef} className="mm-nav__links" onPointerOver={aim} onFocus={aim} onPointerLeave={rest} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) rest(); }}>
          <span className="mm-nav__pill" aria-hidden="true" />
          {PUBLIC_NAV.map((item) => (item.items ? (
            <div key={item.id} ref={toolsRef} className={`mm-nav__tools ${audienceClass(item.show)}`} onBlur={onToolsBlur}>
              <button
                ref={toolsButtonRef}
                type="button"
                className="mm-nav__link mm-nav__tools-btn"
                aria-expanded={toolsOpen}
                aria-controls={toolsId}
                data-current={isToolPath(pathname) ? 'true' : undefined}
                onClick={() => setToolsOpen((open) => !open)}
              >
                {item.label}
                <ChevronDown size={16} aria-hidden="true" className="mm-nav__caret" />
              </button>
              <ul id={toolsId} className="mm-nav__menu" hidden={!toolsOpen}>
                {item.items.map((tool) => (
                  <li key={tool.id}>
                    <Link href={tool.href} onClick={() => setToolsOpen(false)} aria-current={pathname === tool.href ? 'page' : undefined}>
                      <b>{tool.label}</b>
                      {tool.detail ? <span>{tool.detail}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Link key={item.id} href={item.href} className={`mm-nav__link ${audienceClass(item.show)}`} aria-current={pathname === item.href ? 'page' : undefined}>
              {item.label}
            </Link>
          )))}
        </div>

        <div className="mm-nav__end">
          <ThemeToggle hint />
          {actions.map((action) => (
            <Link
              key={action.id}
              href={action.href}
              className={`${action.variant === 'primary' ? 'mm-btn mm-btn--primary mm-nav__cta' : 'mm-nav__link mm-nav__login'} ${audienceClass(action.show)}`}
            >
              {action.label}
            </Link>
          ))}

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
              <span className="mm-nav__bars" aria-hidden="true"><span /><span /><span /></span>
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
          {links.map((item) => (
            <Link key={item.id} href={item.href} onClick={closeMenu} className={audienceClass(item.show)}>
              {item.label}
            </Link>
          ))}
          <p className="mm-nav__sheet-head">Free tools</p>
          {FREE_TOOLS.map((tool) => (
            <Link key={tool.id} href={tool.href} onClick={closeMenu}>{tool.label}</Link>
          ))}
          <Link href="/about" onClick={closeMenu}>About</Link>
          {isAuthenticated ? (
            <>
              <Link href={TODAY_HREF} onClick={closeMenu}>Open MockMob</Link>
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
              <Link href="/login" onClick={closeMenu}>Log in</Link>
              <Link href="/signup" onClick={closeMenu}>Start free</Link>
            </>
          )}
        </div>
      ) : null}
    </nav>
  );
}
