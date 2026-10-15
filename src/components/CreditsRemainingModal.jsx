"use client";

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icons';
import { PLAN_FACTS, proPlanLines } from '@/../data/plan_facts.mjs';

// Every number and every Pro item comes from data/plan_facts.mjs and the offer; nothing is typed here.
const QUICK_COST = PLAN_FACTS.practiceCredits.quickCost.value;
const FULL_COST = PLAN_FACTS.practiceCredits.fullMockCost.value;
const PRO_ITEMS = proPlanLines();
const sessions = (n) => `${n} ${n === 1 ? 'session' : 'sessions'}`;

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
          {isEmpty ? 'You are out of practice credits.' : `You have ${safe} practice credits.`}
        </h2>
        <p className="mmx-sheet__lede">
          {`A quick practice uses ${QUICK_COST} and a full mock uses ${FULL_COST}. This is what comes with Pro.`}
        </p>

        <ul className="mmx-locked">
          {PRO_ITEMS.map((line) => (
            <li key={line}>
              <Icon name="shield" aria-hidden="true" />
              <span>{line}</span>
              <em>Pro</em>
            </li>
          ))}
        </ul>

        <div className="mmx-credits">
          <p className="mmx-credits__head">
            Practice credits left <strong>{safe}</strong>
          </p>
          <div className="mmx-credits__runs">
            <div>
              <span>{`Quick practice, ${QUICK_COST} credits`}</span>
              <strong>{sessions(quickRuns)}</strong>
            </div>
            <div>
              <span>{`Full mock, ${FULL_COST} credits`}</span>
              <strong>{sessions(fullRuns)}</strong>
            </div>
          </div>
        </div>

        <p className="mmx-sheet__price">
          {offer?.purchasable === 'monthly'
            ? <>Pro is <strong>₹{offer.monthly.rupees} a month</strong>.</>
            : offer
              ? <>Pro is <strong>₹{offer.oneTime.rupees} once</strong>, through {offer.oneTime.expires}.</>
              : <>See pricing for the current Pro offer.</>}
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
