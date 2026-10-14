"use client";

import React, { useCallback, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { CreditAmount } from '@/components/ui/Glyph';
import { fullLabel, isActivePath } from '@/lib/navigation';
import { AccountMenu } from './AccountMenu';
import { StartSheet } from './StartSheet';
import { NavIcon } from './NavIcon';
import { useDismiss } from './useDismiss';
import './shell.css';

// The signed-in navigation (plan section 5.3), out of AppLayoutClient. One list for every member:
// Practice, Today, Review (and Learn while study content is on) up front; Plan; Study tools and
// More behind labelled disclosures; account things in the account menu. Labels and order come from
// src/lib/navigation.js.

const hrefFor = (item, previewLinks) => previewLinks?.[item.id] || item.href;

function NavLink({ item, activePath, previewLinks, index, onNavigate, primary = false }) {
  const active = isActivePath(activePath, item);
  return (
    <Link
      href={hrefFor(item, previewLinks)}
      className={`arena-nav-link shell-link${primary ? ' shell-link--primary' : ''}`}
      style={index === undefined ? undefined : { '--i': index }}
      aria-current={active ? 'page' : undefined}
      aria-label={item.descriptor ? fullLabel(item) : undefined}
      data-tour={`nav-${item.id}`}
      onClick={onNavigate}
    >
      <NavIcon name={item.icon} />
      <span className="shell-link__text">
        {item.label}
        {item.descriptor ? <small aria-hidden="true">{item.descriptor}</small> : null}
      </span>
    </Link>
  );
}

// A sidebar group behind a disclosure. Opens by itself while one of its pages is open; once the
// student opens or closes it, their choice wins.
function SidebarDisclosure({ group, activePath, previewLinks, startIndex }) {
  const holdsActive = group.items.some((item) => isActivePath(activePath, item));
  const [choice, setChoice] = useState(null);
  const open = choice ?? holdsActive;
  return (
    <details className="shell-group shell-group--fold" open={open} onToggle={(event) => setChoice(event.currentTarget.open)}>
      <summary className="shell-group__summary" data-tour={`nav-${group.id}`}>
        <span>{group.label}</span>
        <NavIcon name="chevron" size={16} className="shell-group__chev" />
      </summary>
      <div className="shell-group__items">
        {group.items.map((item, i) => (
          <NavLink key={item.id} item={item} activePath={activePath} previewLinks={previewLinks} index={startIndex + i} />
        ))}
      </div>
    </details>
  );
}

export function AppSidebar({ nav, activePath, previewLinks }) {
  // Where each group's links start in the rail's fill-in order (--i).
  const starts = nav.groups.map((_, g) => nav.primary.length + nav.groups.slice(0, g).reduce((sum, group) => sum + group.items.length, 0));
  return (
    <aside className="arena-sidebar shell-sidebar" aria-label="Main menu">
      <Logo />
      <nav className="arena-nav-group shell-primary" aria-label="Main">
        {nav.primary.map((item, i) => (
          <NavLink key={item.id} item={item} activePath={activePath} previewLinks={previewLinks} index={i} primary />
        ))}
      </nav>
      {nav.groups.map((group, g) => {
        const start = starts[g];
        if (group.collapsed) {
          return <SidebarDisclosure key={group.id} group={group} activePath={activePath} previewLinks={previewLinks} startIndex={start} />;
        }
        return (
          <nav key={group.id} className="arena-nav-group shell-group" aria-label={group.label}>
            <p className="shell-group__label">{group.label}</p>
            {group.items.map((item, i) => (
              <NavLink key={item.id} item={item} activePath={activePath} previewLinks={previewLinks} index={start + i} />
            ))}
          </nav>
        );
      })}
    </aside>
  );
}

// Practice credits. Before the session is confirmed the chip keeps its size and shows no number:
// a hint never says how many credits someone has.
function CreditsChip({ user, confirmed }) {
  if (!confirmed) {
    return <span className="arena-chip arena-chip--credits shell-chip-pending" aria-hidden="true"><span /></span>;
  }
  const pro = Boolean(user?.isPremium);
  const amount = pro ? 'unlimited' : (user?.creditBalance || 0);
  return (
    <Link
      href="/profile#plan"
      className="arena-chip arena-chip--credits"
      data-tour="credits-pill"
      aria-label={pro ? 'Practice credits: unlimited with Pro. Plan and credits' : `Practice credits: ${amount}. Plan and credits`}
    >
      <CreditAmount kind="practice" amount={amount} unit={false} />
    </Link>
  );
}

export function AppTopbar({ title, user, confirmed, isModerator, wallet, resume, onGuide, onSignOut }) {
  return (
    <header className="arena-topbar">
      <div className="arena-topbar__row">
        <span className="arena-topbar__logo"><Logo /></span>
        {title ? <span className="arena-topbar__title">{title}</span> : null}
        <div className="arena-topbar__end">
          {isModerator ? (
            <Link href="/moderation" className="arena-chip arena-chip--mod arena-md-up">
              <NavIcon name="moderation" /> Moderator
            </Link>
          ) : null}
          <span className="arena-desktop-only"><StartSheet resume={resume} isPremium={confirmed ? Boolean(user?.isPremium) : null} variant="header" /></span>
          <CreditsChip user={user} confirmed={confirmed} />
          {confirmed && wallet?.status !== 'idle' ? (
            <Link
              href="/mentor"
              className="arena-chip arena-chip--prepos arena-sm-up"
              data-state={wallet.wallet?.state || 'unknown'}
              aria-label={wallet.wallet?.known ? `Ask credits: ${wallet.wallet.total}${wallet.wallet.state === 'paused' ? ', paused' : ''}` : 'Ask credits unavailable'}
            >
              <CreditAmount kind="prepos" amount={wallet.wallet?.known ? wallet.wallet.total : null} unit={false} />
            </Link>
          ) : null}
          <AccountMenu user={user} confirmed={confirmed} onGuide={onGuide} onSignOut={onSignOut} showName className="shell-acct" />
        </div>
      </div>
      {isModerator ? (
        <div className="arena-modbar">
          <NavIcon name="moderation" /> Moderator access is active for this account.
        </div>
      ) : null}
    </header>
  );
}

// Phones and tablets: the primary tabs, More, and Start beside them.
export function AppBottomBar({ nav, activePath, previewLinks, resume, isPremium }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const panelId = useId();
  const close = useCallback(() => setMoreOpen(false), []);
  useDismiss(moreOpen, close, { rootRef, triggerRef, panelRef });
  const moreActive = !moreOpen && nav.groups.some((group) => group.items.some((item) => isActivePath(activePath, item)));
  const cols = nav.primary.length + 2;

  return (
    <div ref={rootRef} className="shell-dock-root">
      {moreOpen ? (
        <div ref={panelRef} id={panelId} className="shell-more" role="region" aria-label="More">
          {nav.groups.map((group) => (
            <nav key={group.id} className="shell-more__group" aria-label={group.label}>
              <p className="shell-group__label">{group.label}</p>
              <div className="shell-more__items">
                {group.items.map((item) => (
                  <NavLink key={item.id} item={item} activePath={activePath} previewLinks={previewLinks} onNavigate={close} />
                ))}
              </div>
            </nav>
          ))}
        </div>
      ) : null}
      <nav className="arena-bottomnav shell-dock" aria-label="Main" style={{ '--cols': cols }}>
        {nav.primary.map((item) => (
          <Link
            key={item.id}
            href={hrefFor(item, previewLinks)}
            onClick={close}
            aria-current={isActivePath(activePath, item) ? 'page' : undefined}
            data-tour={`nav-${item.id}`}
          >
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        ))}
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={moreOpen}
          aria-controls={moreOpen ? panelId : undefined}
          data-active={moreActive ? 'true' : undefined}
          data-tour="nav-more"
          onClick={() => setMoreOpen((open) => !open)}
        >
          <NavIcon name="more" />
          <span>More</span>
        </button>
        <StartSheet resume={resume} isPremium={isPremium} variant="dock" />
      </nav>
    </div>
  );
}
