"use client";

import { useEffect, useRef, useState } from 'react';

// Honest proof band. Real counts from /api/stats when reachable, a truthful
// static floor when not — never a fabricated headcount or testimonial.
// The count-up is hand-rolled so the landing page does not pull in an
// animation runtime for three numbers on a budget Android.
function useCountUp(target, enabled) {
  // null means "not animating" — the real target renders straight through, so
  // reduced motion and no-JS both land on the true number with no extra state.
  const [displayed, setDisplayed] = useState(null);
  const frameRef = useRef(0);

  useEffect(() => {
    if (!enabled || typeof target !== 'number') return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const duration = 900;
    const start = performance.now();

    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      // Exponential ease-out: fast commit, quiet settle.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(target * eased));
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, enabled]);

  return typeof displayed === 'number' ? displayed : target;
}

function Figure({ value, fallback, label, note, animate, failed = false }) {
  const counted = useCountUp(value, animate);
  const isLive = typeof value === 'number' && value >= 0;
  // A marketing page never prints "Unavailable": a figure that could not load simply is not shown.
  if (failed) return null;

  return (
    <div className="mm-figure">
      <div className="mm-figure__value">
        {isLive ? counted.toLocaleString('en-IN') : fallback}
      </div>
      <div className="mm-figure__label">{label}</div>
      <p className="mm-figure__note">{note}</p>
    </div>
  );
}

export function LiveStatsBand({ offer = null } = {}) {
  const [bankSize, setBankSize] = useState(null);
  const [subjectCount, setSubjectCount] = useState(null);
  const [failed, setFailed] = useState(false);
  const [seen, setSeen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/stats', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || data.state === 'unavailable') { setFailed(true); return; }
        if (Number.isFinite(data.bankSize) && data.bankSize >= 0) setBankSize(data.bankSize);
        const counts = data.subjectCounts || {};
        const covered = Object.values(counts).filter((n) => Number(n) > 0).length;
        setSubjectCount(covered);
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') setFailed(true);
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="mm-figures" ref={ref}>
      <Figure
        value={bankSize}
        fallback="…"
        failed={failed}
        label="questions in the live bank"
        note="Counts use practice eligibility. Legacy library content is still being audited; bank size does not establish recovery coverage."
        animate={seen}
      />
      <Figure
        value={subjectCount}
        fallback="…"
        failed={failed}
        label="CUET subjects covered"
        note="Subjects with available ordinary practice questions. Question counts may be temporarily unavailable."
        animate={seen}
      />
      <Figure
        value={null}
        fallback={offer ? `₹${offer.purchasable === 'monthly' ? offer.monthly.rupees : offer.oneTime.rupees}` : 'Free'}
        label={offer ? (offer.purchasable === 'monthly' ? 'a month for Pro' : 'once for Pro access') : 'to start'}
        note={offer ? (offer.purchasable === 'monthly' ? 'Renews monthly. Cancel anytime in Account.' : `Access ends ${offer.oneTime.expires}. This payment does not renew.`) : 'Practice free. See pricing for Pro.'}
        animate={seen}
      />
    </div>
  );
}
