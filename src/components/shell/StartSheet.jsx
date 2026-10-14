"use client";

import React, { useCallback, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { startActions } from '@/lib/navigation';
import { useDismiss } from './useDismiss';
import { NavIcon } from './NavIcon';
import './shell.css';

// Start (plan section 5.3 and 8.2): the quick ways into a session, from the bottom bar on phones and
// the top bar on desktop. Every row opens Practice set up for that session, where the cost and the
// time are shown before anything is spent. Resume leads while a saved test exists.
export function StartSheet({ resume = null, isPremium = null, variant = 'header' }) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState('free');
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const panelId = useId();
  const headingId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, { rootRef, triggerRef, panelRef });

  function toggle() {
    if (!open) {
      // Pro hides the Pro tag. The confirmed account decides; before that, the stored hint.
      let next = 'free';
      if (isPremium !== null) next = isPremium ? 'pro' : 'free';
      else if (typeof document !== 'undefined' && document.documentElement.dataset.visitorPlan === 'pro') next = 'pro';
      setPlan(next);
    }
    setOpen((value) => !value);
  }

  const actions = startActions({ resume, plan });

  return (
    <div ref={rootRef} className={`start start--${variant}`}>
      <button
        ref={triggerRef}
        type="button"
        className="start__trigger"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        data-tour="start-button"
        onClick={toggle}
      >
        <span className="start__glyph" aria-hidden="true"><NavIcon name="start" size={variant === 'dock' ? 20 : 16} /></span>
        <span className="start__label">Start</span>
      </button>
      {open ? (
        <div ref={panelRef} id={panelId} className="start__panel" role="region" aria-labelledby={headingId}>
          <h2 id={headingId} className="start__title">Start a session</h2>
          <ul className="start__list">
            {actions.map((action) => (
              <li key={action.id}>
                <Link href={action.href} className="start__row" data-lead={action.id === 'resume' ? 'true' : undefined} onClick={close}>
                  <span className="start__text">
                    <b>{action.label}</b>
                    <small>{action.detail}</small>
                  </span>
                  {action.tag ? <span className="start__tag">{action.tag}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
