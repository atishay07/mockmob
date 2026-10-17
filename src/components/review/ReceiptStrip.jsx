"use client";
// The receipt strip (LEARN-REVIEW-1017 5.4): Found, Repaired, Retested, Still right, hairline-divided, no card, and one
// generated line under it. Every number is receipt() from the shared Review input (data/review_input.mjs). No percentage,
// no claim of cause. A number that changed since the last look counts once from the old value to the new (700 ms,
// ease-out cubic); reduced motion shows the new number at once.
import { useEffect, useState } from 'react';

const SEEN_KEY = 'mm:review:receipt:v1';
const reduced = () => {
  try { return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; }
};

function Roll({ from, to }) {
  const [shown, setShown] = useState(() => (from === to || reduced() ? to : from));
  useEffect(() => {
    if (from === to || reduced()) return undefined;
    let raf; let start;
    const step = (t) => { start ??= t; const p = Math.min((t - start) / 700, 1); setShown(Math.round(from + (to - from) * (1 - (1 - p) ** 3))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [from, to]);
  return shown;
}

const FIELDS = [['found', 'Found'], ['repaired', 'Repaired'], ['retested', 'Retested'], ['stillRight', 'Still right']];

export default function ReceiptStrip({ receipt }) {
  // What the student saw last time, read once; the new numbers are stored for the next look.
  const [seen] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem(SEEN_KEY) || 'null'); } catch { return null; }
  });
  useEffect(() => {
    if (!receipt) return;
    try { window.localStorage.setItem(SEEN_KEY, JSON.stringify(Object.fromEntries(FIELDS.map(([k]) => [k, receipt[k]])))); } catch { /* fine without storage */ }
  }, [receipt]);
  if (!receipt) return null;
  const fields = receipt.onlyFound ? FIELDS.slice(0, 1) : FIELDS;
  const [first, ...rest] = String(receipt.line || '').split(/(?<=\.)\s/);
  const bold = /checks? held\.$/.test(first || '');
  return (
    <section className="rvw-strip" aria-label="What your repairs did" data-n={fields.length}>
      <dl className="rvw-strip__row">
        {fields.map(([k, label]) => (
          <div key={k} data-k={k}>
            <dt>{label}</dt>
            <dd><Roll from={Number.isFinite(seen?.[k]) ? seen[k] : receipt[k]} to={receipt[k]} /></dd>
          </div>
        ))}
      </dl>
      <p>{bold ? <><b>{first}</b>{rest.length ? ` ${rest.join(' ')}` : ''}</> : receipt.line}</p>
    </section>
  );
}
