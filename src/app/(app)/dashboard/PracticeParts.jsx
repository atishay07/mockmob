"use client";

// Small pieces of the Practice page (web IA, IA5): the single-choice control, a subject's object, the
// loading boxes and the recommended-move hook. The page itself is DashboardPageClient.jsx.
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { SubjectIcon } from '@/components/ui/Glyph';
import { apiGet } from '@/lib/fetcher';
import { todayMove } from '@/components/today/todayModel.mjs';
import { subjectArt } from '@/../data/subject_art.mjs';
import { BRAND_FLAGS, brandFlags } from '@/../data/brand_flags.mjs';

/** A single-choice control: one tab stop per option, arrow keys move and choose, state exposed with aria-checked. */
export function Segmented({ label, value, options, onChange, disabledValues = [] }) {
  const enabledOptions = options.filter((option) => !disabledValues.includes(option.value));
  const tabStop = enabledOptions.find((option) => option.value === value) || enabledOptions[0];

  return (
    <div
      className="pt-seg"
      role="radiogroup"
      aria-label={label}
      onKeyDown={(event) => {
        const keyDirection = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1
          : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
        if (!keyDirection && event.key !== 'Home' && event.key !== 'End') return;
        if (!enabledOptions.length) return;
        event.preventDefault();
        const currentIndex = enabledOptions.findIndex((option) => option.value === value);
        const nextIndex = event.key === 'Home' ? 0
          : event.key === 'End' ? enabledOptions.length - 1
            : (Math.max(0, currentIndex) + keyDirection + enabledOptions.length) % enabledOptions.length;
        const next = enabledOptions[nextIndex];
        event.currentTarget.querySelector(`[data-radio-value="${String(next.value)}"]`)?.focus();
        onChange(next.value);
      }}
    >
      {options.map((option) => {
        const disabled = disabledValues.includes(option.value);
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            data-radio-value={String(option.value)}
            aria-checked={value === option.value}
            tabIndex={!disabled && tabStop?.value === option.value ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// Development only: ?brand=art shows the objects for the Gate A look without flipping the flag.
const noSubscribe = () => () => {};
const previewParam = () => (process.env.NODE_ENV === 'production' ? null : new URLSearchParams(window.location.search).get('brand'));

/** The brand flags in force: the shipped flags, or a development preview's ?brand= switches. */
export function usePracticeBrand() {
  const param = useSyncExternalStore(noSubscribe, previewParam, () => null);
  return param ? brandFlags(param) : BRAND_FLAGS;
}

/** A subject's mark: the app's photo-real object (never cropped, with its contact shadow) when the flag is on, else the line icon. */
export function SubjectMark({ id, showArt }) {
  const art = showArt ? subjectArt(id) : null;
  if (!art) return <span className="pt-tile__glyph" aria-hidden="true"><SubjectIcon id={id} size={20} /></span>;
  return (
    <span className="pt-tile__art" aria-hidden="true" style={{ '--foot-x': `${art.footX * 100}%`, '--foot-w': `${art.footWidth * 100}%` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={art.src} alt="" width={art.width} height={art.height} loading="lazy" decoding="async" />
    </span>
  );
}

/** The page's own boxes while subjects load: the same shapes, no shimmer, so nothing moves when the answer arrives. */
export function PracticeSkeleton() {
  return (
    <div className="student-page student-page--practice pt" aria-busy="true" aria-label="Loading Practice">
      <header className="pt-head">
        <div>
          <i className="pt-sk pt-sk--title" />
          <i className="pt-sk pt-sk--line" />
        </div>
        <span className="pt-head__mobi" aria-hidden="true" />
      </header>
      <div className="pt-layout">
        <div className="pt-subjects" aria-hidden="true">
          {[1, 2, 3, 4].map((n) => <i key={n} className="pt-sk pt-sk--tile" />)}
        </div>
        <div className="pt-sessions" aria-hidden="true">
          {[1, 2, 3, 4].map((n) => <i key={n} className="pt-sk pt-sk--row" />)}
        </div>
        <i className="pt-sk pt-sk--aside pt-aside" aria-hidden="true" />
      </div>
    </div>
  );
}

/**
 * Tonight's move for the recommended start: the same rules as Today and the Start sheet
 * (data/next_step_rules.mjs), read from the same plan route. It never holds the page: a slow or failed
 * read just leaves the card out. `ready` is false until the student's subjects are known.
 */
export function useRecommendedMove({ user, supported, ready }) {
  const userId = user?.id || null;
  const [facts, setFacts] = useState({ userId: null, value: null });

  useEffect(() => {
    if (!ready || !userId) return undefined;
    let alive = true;
    apiGet('/api/learning/plan')
      .then((plan) => { if (alive) setFacts({ userId, value: plan?.moveFacts && typeof plan.moveFacts === 'object' ? plan.moveFacts : null }); })
      .catch(() => { if (alive) setFacts({ userId, value: null }); });
    return () => { alive = false; };
  }, [ready, userId]);

  // Never show another account's move while this account's read is in flight.
  const mine = facts.userId === userId ? facts.value : null;
  return useMemo(
    () => (mine ? todayMove(mine, { user, supported, practiceCredits: Number.isFinite(user?.creditBalance) ? user.creditBalance : null, aiCredits: null }) : null),
    [mine, user, supported],
  );
}
