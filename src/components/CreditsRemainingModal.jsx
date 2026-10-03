"use client";

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icons';

const QUICK_COST = 10;
const FULL_COST = 50;

const LOCKED = [
  'Radar: your weakest chapter from this mock',
  'Free sourced DU eligibility and historical cutoffs',
  'Chapter priority map for the next 7 days',
];

export function CreditsRemainingModal({ open, credits, onClose, offer = null }) {
  const router = useRouter();
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    closeRef.current?.focus();

    function onKey(event) {
      if (event.key === 'Escape') {
        onClose?.();
        return;
      }
      if (event.key !== 'Tab') return;
      // Keep focus inside the dialog while it is open.
      const focusables = panelRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    // Lock background scroll without the layout shift the disappearing
    // scrollbar would otherwise cause on desktop.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const safe = Math.max(0, Number.isFinite(credits) ? credits : 0);
  const quickRuns = Math.floor(safe / QUICK_COST);
  const fullRuns = Math.floor(safe / FULL_COST);
  const isEmpty = safe < QUICK_COST;

  return (
    <div
      className="mmx-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="credits-modal-title"
      onClick={onClose}
    >
      <div className="mmx-sheet" ref={panelRef} onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="mmx-sheet__close"
          onClick={onClose}
          ref={closeRef}
          aria-label="Close"
        >
          <Icon name="x" />
        </button>

        <h2 id="credits-modal-title" className="mmx-sheet__title">
          {isEmpty ? 'You are out of credits.' : 'Your score is just the headline.'}
        </h2>
        <p className="mmx-sheet__lede">
          {isEmpty
            ? 'Free credits gate how often you can generate a mock — not what you can see. Pro removes the gate entirely.'
            : 'Pro turns this attempt into a plan. Here is what stays locked on the free lane.'}
        </p>

        <ul className="mmx-locked">
          {LOCKED.map((line) => (
            <li key={line}>
              <Icon name="shield" aria-hidden="true" />
              <span>{line}</span>
              <em>Pro</em>
            </li>
          ))}
        </ul>

        <div className="mmx-credits">
          <p className="mmx-credits__head">
            Credits left <strong>{safe}</strong>
          </p>
          <div className="mmx-credits__bar" aria-hidden="true">
            <span style={{ transform: `scaleX(${Math.min(100, safe) / 100})` }} />
          </div>
          <div className="mmx-credits__runs">
            <div>
              <span>Quick Practice · {QUICK_COST} cr</span>
              <strong>
                {quickRuns} run{quickRuns === 1 ? '' : 's'}
              </strong>
            </div>
            <div>
              <span>Full Mock · {FULL_COST} cr</span>
              <strong>
                {fullRuns} run{fullRuns === 1 ? '' : 's'}
              </strong>
            </div>
          </div>
        </div>

        <p className="mmx-sheet__price">
          {offer?.purchasable === 'monthly'
            ? <>Pro is <strong>₹{offer.monthly.rupees} a month</strong>. Unlimited mocks, full Radar and NTA Mode. Cancel anytime.</>
            : offer
              ? <>Pro access is <strong>₹{offer.oneTime.rupees} once</strong>. Unlimited mocks, full Radar and NTA Mode through {offer.oneTime.expires}.</>
              : <>Pro removes the credit gate. See pricing for the current offer.</>}
        </p>

        <div className="mmx-sheet__actions">
          <button
            type="button"
            className="mmx-btn mmx-btn--primary"
            onClick={() => {
              onClose?.();
              router.push('/pricing');
            }}
          >
            See Pro
          </button>
          <button type="button" className="mmx-btn mmx-btn--quiet" onClick={onClose}>
            {isEmpty ? 'Not now' : 'Continue on free'}
          </button>
        </div>
      </div>
    </div>
  );
}
