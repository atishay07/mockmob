"use client";

import React, { useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '@/components/AuthProvider';
import { creditsZeroNotice, proEndingNotice } from '@/../data/notice_rules.mjs';
import { useNoticeForget, useNoticeSource } from './NoticeProvider';

const EVALUATED = ['credits-zero', 'pro-ending'];

/**
 * Offers the notices a signed-in student's own account can justify: no credits left (free), Pro
 * ending within a few days. Nothing is offered until the session is confirmed, and nothing from a
 * remembered hint. Mount it once inside the app shell's NoticeProvider, next to
 * <NoticeSlot surface="app" />. Other sources (maintenance, a feature that cannot run) publish
 * through useNoticeSource in the same way.
 */
export default function ShellNotices() {
  const auth = useContext(AuthContext);
  const forget = useNoticeForget();
  // Read once per mount: the Pro window is counted in days, so a page-visit-old value is fine.
  const [now] = useState(() => Date.now());
  const confirmed = auth?.status === 'authenticated' && auth.user;
  const isPremium = Boolean(auth?.user?.isPremium);
  const creditBalance = auth?.user?.creditBalance;
  const premiumUntil = auth?.user?.premiumUntil;

  const candidates = useMemo(() => {
    if (!confirmed) return [];
    return [
      creditsZeroNotice({ isPremium, creditBalance: Number.isFinite(creditBalance) ? creditBalance : null }),
      proEndingNotice({ isPremium, premiumUntil, now }),
    ].filter(Boolean);
  }, [confirmed, isPremium, creditBalance, premiumUntil, now]);

  useNoticeSource('shell', candidates);

  // The state a notice described has ended (credits are back, Pro was extended): forget the
  // dismissal so the notice can return if the state does.
  useEffect(() => {
    if (!confirmed || !forget) return;
    // Only evaluate what the account can actually answer: with no numeric balance the credits-zero
    // notice has not been judged, so its dismissal is left alone.
    const evaluated = Number.isFinite(creditBalance) ? EVALUATED : EVALUATED.filter((id) => id !== 'credits-zero');
    forget(evaluated, candidates.map((notice) => notice.id));
  }, [confirmed, forget, candidates, creditBalance]);

  return null;
}
