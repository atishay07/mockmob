"use client";

// One quiet line with one action (owner D79): "Get unlimited mocks". It stands at a natural moment (credits low, a set's
// cost, a scored result, Review's chapter practice, the Start sheet), never for Pro, never on a paper, at most one per
// screen, a dismissed one stays quiet for 7 days, and all of them rest for a day after a "Not now" on the Upgrade sheet
// (src/lib/proNudge.mjs). The action opens the Upgrade sheet; it is outlined text,
// never lime, so the page's own key stays the one lime in view.
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { claimScreen, inlineAllowed, inlineCopy, releaseScreen } from '@/lib/proNudge.mjs';
import { loadRecord, openUpgrade, quietNudge, shareProFacts, useUpgradeState } from './proNudgeStore';

// Which placement holds each screen (a route, or 'start-sheet' for the sheet over it).
const claims = new Map();

export default function InlineNudge({ placement, facts = {}, screen = null, className = '' }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const key = screen || pathname || 'screen';
  const [shown, setShown] = useState(false);
  const copy = inlineCopy(placement, facts);
  const userId = user?.id || null;
  const factsKey = JSON.stringify(facts);
  // Re-read when the Upgrade sheet closes, so a "Not now" there quiets this line at once.
  const sheetOpen = useUpgradeState().open;

  useEffect(() => {
    const ok = Boolean(copy) && inlineAllowed(loadRecord(userId), { placement, now: Date.now(), user, route: pathname }) && claimScreen(claims, key, placement);
    if (ok) shareProFacts(JSON.parse(factsKey));
    // Read on the client after mount (storage and the screen claim are client-only), then shown.
    let alive = true;
    queueMicrotask(() => { if (alive) setShown(ok); });
    return () => { alive = false; if (ok) releaseScreen(claims, key, placement); };
    // copy follows facts; factsKey stands in for them.
  }, [placement, key, userId, user, factsKey, Boolean(copy), sheetOpen, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!shown || !copy) return null;
  return (
    <div className={`pn-inline ${className}`} data-placement={placement} role="note">
      <p className="pn-inline__text">{copy.text}</p>
      <button type="button" className="pn-inline__go mk-press" onClick={(event) => openUpgrade({ trigger: copy.trigger, facts, opener: event.currentTarget })}>{copy.action}</button>
      <button type="button" className="pn-inline__x mk-press" aria-label="Hide this for a week" onClick={() => { quietNudge(userId, placement); setShown(false); }}>
        <X size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}
