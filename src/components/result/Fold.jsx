"use client";
// Layer 4 of the result (RESULT-1017 4.6): one named fold per deep read. A title, a teaser that states the finding (so the
// fold is never a mystery door) and a chevron. The body renders the first time it opens and stays mounted after, so a
// deep link (a Q chip, "See it in the replay") can open it and scroll inside. Open folds are remembered per viewer
// (localStorage, wrapped: private windows and blocked storage simply start closed).
import { useCallback, useEffect, useId, useState } from 'react';

const KEY = 'mm:result-folds:v1';

function readOpen() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) || '[]');
    return new Set(Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : []);
  } catch { return new Set(); }
}
function writeOpen(set) {
  try { window.localStorage.setItem(KEY, JSON.stringify([...set])); } catch { /* storage blocked: nothing is remembered */ }
}

/**
 * The open folds: [open, setFold(id, on, { remember })]. A fold the student opens or closes is remembered; one opened by
 * a deep link is not (remember: false), so a jump does not change what the next result opens with.
 */
export function useFolds() {
  const [open, setOpen] = useState(() => new Set());
  useEffect(() => { const saved = readOpen(); if (saved.size) queueMicrotask(() => setOpen(saved)); }, []);
  const setFold = useCallback((id, on, { remember = true } = {}) => {
    setOpen((prev) => {
      if (prev.has(id) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      if (remember) {
        const kept = readOpen();
        if (on) kept.add(id); else kept.delete(id);
        writeOpen(kept);
      }
      return next;
    });
  }, []);
  return [open, setFold];
}

export default function Fold({ id, title, teaser = null, open, onToggle, children, aside = null }) {
  const bodyId = useId();
  // The body mounts on first open and is kept, so its own state (a scrubbed replay, an opened row) survives a close.
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  return (
    <section className="rx-fold" id={`fold-${id}`} data-open={open || undefined} aria-labelledby={`${bodyId}-h`}>
      <h3 className="rx-fold__h" id={`${bodyId}-h`}>
        <button type="button" className="rx-fold__bar" aria-expanded={open} aria-controls={bodyId} onClick={() => onToggle(id, !open)}>
          <span className="rx-fold__text">
            <span className="rx-fold__title">{title}</span>
            {teaser ? <span className="rx-fold__teaser">{teaser}</span> : null}
          </span>
          {aside ? <span className="rx-fold__aside" aria-hidden="true">{aside}</span> : null}
          <span className="rx-chev" aria-hidden="true" />
        </button>
      </h3>
      <div className="rx-fold__wrap" id={bodyId} role="region" aria-labelledby={`${bodyId}-h`} inert={open ? undefined : true}>
        <div className="rx-fold__inner">
          {mounted ? <div className="rx-fold__body">{children}</div> : null}
        </div>
      </div>
    </section>
  );
}
