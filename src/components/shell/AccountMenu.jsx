"use client";

import React, { useCallback, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { accountMenu, planLine } from '@/lib/navigation';
import { useDismiss } from './useDismiss';
import { LogOut } from 'lucide-react';
import './shell.css';

// The account menu (plan section 5.2 and 5.3): the one place Account, plan, Start page, Theme,
// Guide, Help and Sign out live. Used by the signed-in top bar and the public header.
//
// Before the session is confirmed the trigger shows a blank avatar and no name, and the menu shows
// no plan line: nothing private is drawn from the stored hint.
export function AccountMenu({ user = null, confirmed = false, onGuide = null, onSignOut = null, showName = false, className = '' }) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState('free');
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const panelId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, { rootRef, triggerRef, panelRef });

  const name = confirmed ? String(user?.name || '').trim() : '';
  const initial = name ? name.charAt(0).toUpperCase() : '';
  const items = accountMenu({ plan, guide: Boolean(onGuide) });
  const line = confirmed ? planLine(user) : '';

  function toggle() {
    if (!open) {
      // The plan decides Go Pro versus Plan status. Read when the menu opens (never during render,
      // so the server and the first client render agree): the confirmed account first, else the hint.
      let next = 'free';
      if (confirmed && user) next = user.isPremium ? 'pro' : 'free';
      else if (typeof document !== 'undefined' && document.documentElement.dataset.visitorPlan === 'pro') next = 'pro';
      setPlan(next);
    }
    setOpen((value) => !value);
  }

  return (
    <div ref={rootRef} className={`acct ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        className="acct__trigger"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={name ? `Account menu for ${name}` : 'Account menu'}
        onClick={toggle}
      >
        <span className="acct__avatar" data-pending={initial ? undefined : 'true'} aria-hidden="true">{initial}</span>
        {showName && name ? <span className="acct__name">{name}</span> : null}
      </button>
      {open ? (
        <div ref={panelRef} id={panelId} className="acct__panel">
          {name || line ? (
            <div className="acct__who">
              {name ? <b>{name}</b> : null}
              {line ? <span>{line}</span> : null}
            </div>
          ) : null}
          <ul className="acct__list">
            {items.map((item) => (
              <li key={item.id}>
                {item.action === 'guide' ? (
                  <button type="button" className="acct__row" onClick={() => { close(); onGuide?.(); }}>{item.label}</button>
                ) : (
                  <Link href={item.href} className="acct__row" data-emphasis={item.id === 'upgrade' ? 'true' : undefined} onClick={close}>{item.label}</Link>
                )}
              </li>
            ))}
            <li className="acct__theme">
              <span>Theme</span>
              <ThemeToggle />
            </li>
            {confirmed && onSignOut ? (
              <li>
                <button type="button" className="acct__row acct__row--signout" onClick={async () => { close(); await onSignOut(); }}>
                  <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
                  Sign out
                </button>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
