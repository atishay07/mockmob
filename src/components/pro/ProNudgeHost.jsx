"use client";

// Mounted once in the signed-in shell. For a Free student it:
//   - opens the Upgrade sheet when any page asks (openUpgrade) or when a plain click lands on a link to /pricing anywhere
//     in the app (every "See Pro" on a Pro-gated control), with the trigger the link names (data-pro-feature) or its
//     ?reason=;
//   - opens the first-session sheet once ever, after the student's first real action in the first usage session after
//     onboarding (src/lib/proNudge.mjs firstActionOpens), a short beat after the result is on screen. It is marked as
//     shown only when it really opens: if the student has already moved on to a paper, or another sheet is open, it waits
//     for the next real action in that session instead;
//   - remembers a "Not now" (any close without Get Pro), so inline nudges rest for a day after it.
// For a Pro student it renders nothing and listens to nothing.
import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { CURRENT_OFFER } from '@/../data/capabilities';
import { FIRST_ACTION_DELAY_MS, firstActionOpens, firstSheetMayOpen, markDeclined, markFirstShown, nudgesAllowed, triggerForReason } from '@/lib/proNudge.mjs';
import UpgradeSheet from './UpgradeSheet';
import { FIRST_ACTION_EVENT, browserSession, closeUpgrade, loadRecord, openUpgrade, saveRecord, setUpgradeHost, shareProFacts, useUpgradeState } from './proNudgeStore';
import './pro-nudge.css';

// What is on sale when the server did not pass the offer (the preview): the one-time access, as offer.js frames it.
const FALLBACK_OFFER = { purchasable: 'one_time', oneTime: { planId: CURRENT_OFFER.planId, rupees: CURRENT_OFFER.rupees, expires: CURRENT_OFFER.expires, onSale: true }, monthly: { rupees: 99, ready: false } };

function pricingLink(target) {
  const a = target?.closest?.('a[href]');
  if (!a || a.closest('[data-pro-checkout], [data-pro-direct]') || a.target === '_blank' || a.hasAttribute('download')) return null;
  let url;
  try { url = new URL(a.getAttribute('href'), window.location.origin); } catch { return null; }
  if (url.origin !== window.location.origin || url.pathname !== '/pricing' || url.hash === '#plans') return null;
  const named = a.closest('[data-pro-feature]')?.getAttribute('data-pro-feature');
  return { anchor: a, trigger: named || triggerForReason(url.searchParams.get('reason')) || 'generic' };
}

export default function ProNudgeHost({ offer = null, previewLinks = null }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const state = useUpgradeState();
  const allowed = nudgesAllowed(user);
  const userId = user?.id || null;
  const timer = useRef(0);

  // What the shell already knows about the student, for the sheet's personal lines.
  useEffect(() => {
    if (!allowed) return;
    // One credits balance (D78): user.credits.total when the session serves it, else creditBalance (the one total once
    // track C serves it; the practice pool before). Unknown is null, never 0.
    const total = Number.isFinite(user?.credits?.total) ? user.credits.total : Number.isFinite(user?.creditBalance) ? user.creditBalance : null;
    shareProFacts({ subjects: user?.subjects || [], balance: total });
  }, [allowed, user?.subjects, user?.creditBalance, user?.credits?.total]);

  // Callers that open the sheet in code (openUpgrade) learn whether it will show; without a host they go to /pricing.
  useEffect(() => {
    if (!allowed) return undefined;
    setUpgradeHost(true);
    return () => setUpgradeHost(false);
  }, [allowed]);

  // Every link to /pricing in the app opens the sheet for a Free student (plain clicks only: a new tab still goes there).
  useEffect(() => {
    if (!allowed) return undefined;
    const onClick = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const hit = pricingLink(event.target);
      if (!hit) return;
      event.preventDefault();
      event.stopPropagation();
      openUpgrade({ trigger: hit.trigger, opener: hit.anchor });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [allowed]);

  // The first-session sheet: once ever, after the first real action.
  useEffect(() => {
    if (!allowed || !userId) return undefined;
    const onAction = (event) => {
      const now = Date.now();
      const record = loadRecord(userId);
      const session = browserSession();
      if (!firstActionOpens(record, { now, session, user, route: window.location.pathname, action: event.detail })) return;
      const from = window.location.pathname;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        const latest = loadRecord(userId);
        const otherSheetOpen = Boolean(document.querySelector('dialog[open]'));
        // Still on the page that reported it, nothing else open, never on a paper, and still not shown.
        if (window.location.pathname !== from || !firstSheetMayOpen(latest, { user, route: window.location.pathname, otherSheetOpen })) return;
        // Marked as it opens, so a reload or a second result never shows it twice.
        if (!saveRecord(userId, markFirstShown(latest, Date.now()))) return;
        openUpgrade({ trigger: 'first_session' });
      }, FIRST_ACTION_DELAY_MS);
    };
    window.addEventListener(FIRST_ACTION_EVENT, onAction);
    return () => { window.removeEventListener(FIRST_ACTION_EVENT, onAction); window.clearTimeout(timer.current); };
  }, [allowed, userId, user]);

  // A route change closes it, and a first-session sheet still waiting never follows the student to the next page.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    window.clearTimeout(timer.current);
    closeUpgrade();
  }, [pathname]);

  // Any close without Get Pro is a "Not now": inline nudges rest for a day (src/lib/proNudge.mjs DECLINE_QUIET_MS).
  const tookPro = useRef(false);
  const onGetPro = useCallback(() => { tookPro.current = true; }, []);
  const onClose = useCallback(() => {
    if (!tookPro.current && userId) saveRecord(userId, markDeclined(loadRecord(userId), Date.now()));
    tookPro.current = false;
    closeUpgrade();
  }, [userId]);

  const linkFor = useCallback((href) => previewLinks?.pricing || href, [previewLinks]);
  if (!allowed || !state.open) return null;
  return <UpgradeSheet key={state.at} open trigger={state.trigger} facts={state.facts} offer={offer || FALLBACK_OFFER} onClose={onClose} onGetPro={onGetPro} returnFocus={state.opener} linkFor={linkFor} />;
}
