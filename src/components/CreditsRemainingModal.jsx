"use client";

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icons';
import { TEST_MODES } from '@/../data/test_modes';
import { quickQuestionsFor } from '@/lib/creditCopy.mjs';

const QUICK_MIN_SET = Math.min(...TEST_MODES.quick.countOptions);  // the smallest Quick set, in questions: 1 credit a question
const FULL_COST = TEST_MODES.full.creditCost;

// Only what is Pro-only on /pricing today. DU eligibility, published cutoffs and the top three
// chapters are free there, so they are never listed here.
const PRO_ADDS = [
  'Full chapter review: every ranked chapter, pace and changed answers',
  'Compass Pro: your practice projected against your DU shortlist',
  'Smart practice, aimed at your weak chapters',
  'NTA mode, the exam-day screen',
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

  // Rendered into <body> so the app's top bar and bottom navigation can never sit above it.
  // It only opens after a client action, so document always exists when it renders.
  if (!open || typeof document === 'undefined') return null;

  const safe = Math.max(0, Number.isFinite(credits) ? credits : 0);
  // Quick sets come in 5, 10, 15 or 20 questions, so a balance buys a whole number of 5s at most: 37 credits buy 35 questions, never 37.
  const quickQuestions = quickQuestionsFor(safe);
  const fullRuns = Math.floor(safe / FULL_COST);
  const isEmpty = safe < QUICK_MIN_SET;

  return createPortal(
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
          {isEmpty ? (safe === 0 ? 'You are out of credits' : 'Not enough credits') : 'What Pro adds'}
        </h2>
        <p className="mmx-sheet__lede">
          {isEmpty
            ? 'Credits set how many new sets you can start. Your results, explanations and DU eligibility stay open on Free. Pro removes the credit limit and adds:'
            : 'Your results, explanations, DU eligibility and top three chapters stay open on Free. Pro adds:'}
        </p>

        <ul className="mmx-locked">
          {PRO_ADDS.map((line) => (
            <li key={line}>
              <Icon name="check" aria-hidden="true" />
              <span>{line}</span>
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
              <span>Quick practice, 1 credit a question</span>
              <strong>
                {quickQuestions > 0 ? `${quickQuestions} questions` : `Not enough for a ${QUICK_MIN_SET}-question set`}
              </strong>
            </div>
            <div>
              <span>Full mock, {FULL_COST} credits</span>
              <strong>
                {fullRuns} run{fullRuns === 1 ? '' : 's'}
              </strong>
            </div>
          </div>
        </div>

        <p className="mmx-sheet__price">
          {offer?.purchasable === 'monthly'
            ? <>Pro is <strong>₹{offer.monthly.rupees} a month</strong>, with unlimited Quick practice and Full mock. Renews monthly. Cancel anytime in Account.</>
            : offer?.oneTime
              ? <>Pro access is <strong>₹{offer.oneTime.rupees} once</strong>, through {offer.oneTime.expires}, with unlimited Quick practice and Full mock. No renewal.</>
              : <>The price could not be read just now. See Pro shows the current price before any payment.</>}
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
          <button
            type="button"
            className="mmx-btn mmx-btn--quiet"
            onClick={() => {
              onClose?.();
              router.push('/wallet');
            }}
          >
            Open your wallet
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
