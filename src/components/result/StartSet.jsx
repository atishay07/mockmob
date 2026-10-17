"use client";
// One-tap start for a chapter set recommended on the result (the next-move key and "Topic mocks to do next", W-029). The
// recommendation used to link to Practice's set-up with the chapter chosen, two taps from a start. Now the key itself
// starts the set: it reads the same read-only quote Practice reads (/api/practice/quote, never charges), names the price
// on the key before the press, and opens the runner with the quote's start token, exactly as Practice's Start does. When
// the quote says the set cannot start (credits, Pro, an unreadable bank) the key goes to Practice's set-up, which says why.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const quotes = new Map(); // subject|count -> Promise<quote | null>: one read per subject on the page, shared by every key

function readQuote(subject, count) {
  const key = `${subject}|${count}`;
  if (!quotes.has(key)) {
    const params = new URLSearchParams({ subject, mode: 'quick', count: String(count) });
    quotes.set(key, fetch(`/api/practice/quote?${params}`, { cache: 'no-store' })
      .then(async (res) => { const body = await res.json().catch(() => null); return body && typeof body.state === 'string' ? body : null; })
      .catch(() => null));
  }
  return quotes.get(key);
}

/** The set a recommendation points at, from its set-up href (/dashboard?subject=..&mode=quick&count=10&chapter=..). */
export function setFromHref(href) {
  try {
    const url = new URL(href, 'https://x.invalid');
    if (url.pathname !== '/dashboard') return null;
    const mode = url.searchParams.get('mode') || 'quick';
    const subject = url.searchParams.get('subject');
    if (mode !== 'quick' || !subject) return null;
    const count = Number(url.searchParams.get('count')) || 10;
    const chapters = [url.searchParams.get('chapter'), ...(url.searchParams.get('chapters') || '').split(',')].map((c) => (c || '').trim()).filter(Boolean);
    return { subject, count, chapters };
  } catch { return null; }
}

/** "10 credits", "Included", "Free today", or null while the quote is out (or failed). */
export function priceWord(quote) {
  if (!quote || quote.launchable !== true) return null;
  if (quote.entitlement?.kind === 'access') return 'Included';
  if (quote.creditCost === 0) return 'Free today';
  return Number.isFinite(quote.creditCost) ? `${quote.creditCost} ${quote.creditCost === 1 ? 'credit' : 'credits'}` : null;
}

/**
 * href       the set-up href the server or the next-move rules gave (kept as the fallback and for a new tab)
 * label      the key's words ("Practise 10 on Share Capital", or "Start" in a plan row)
 * isPremium  Pro covers the set, so the price says Included before the quote is in
 */
export default function StartSet({ href, label, className = '', isPremium = false, primary = false, ariaLabel = null }) {
  const router = useRouter();
  const set = setFromHref(href);
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!set) return undefined;
    let alive = true;
    readQuote(set.subject, set.count).then((q) => { if (alive) setQuote(q); });
    return () => { alive = false; };
  }, [set?.subject, set?.count]); // eslint-disable-line react-hooks/exhaustive-deps
  const price = isPremium && quote?.launchable !== false ? 'Included' : priceWord(quote);
  const props = primary ? { 'data-page-primary': '' } : {};
  if (!set) return <Link href={href} className={className} {...props}>{label}</Link>;
  const start = (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return; // a new tab gets the set-up
    event.preventDefault();
    if (busy) return;
    const fresh = quote && quote.launchable === true && quote.idempotencyToken && !(Date.parse(quote.expiresAt) <= Date.now());
    if (!fresh) { router.push(href); return; }
    setBusy(true);
    const p = new URLSearchParams({ subject: set.subject, count: String(set.count), mode: 'quick' });
    if (set.chapters.length) p.set('chapters', set.chapters.join(','));
    router.push(`/test?${p}&generationKey=${encodeURIComponent(quote.idempotencyToken)}`);
  };
  return (
    <a href={href} className={className} onClick={start} aria-busy={busy || undefined} aria-label={ariaLabel ? `${ariaLabel}${price ? `, ${price}` : ''}` : undefined} data-start-set="" {...props}>
      <span className="ss-label">{busy ? 'Starting…' : label}</span>
      {price && !busy ? <span className="ss-price">{price}</span> : null}
    </a>
  );
}
