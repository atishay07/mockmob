"use client";

// /mentor, Ask Mobi's front door (ASK-MOBI-1019, option B; the owner's D114): Mobi's greeting above two big doors, "Ask now" and
// "Ask your record", with the true credit line and "Your recent questions" under them (AskMobiDoors). Nothing the page showed
// before is gone (R3): the record view (the marks ledger, what stands out, the chapters costing the most, changed answers, pace and
// the two weeks) is "Your record in full", under the doors, one tap from the record door; the earlier questions are "Your recent
// questions", each opening to its saved reply. Deep links keep working: ?tab=record is this page, ?tab=ask&q=<attempt>:<question>
// opens the docked panel on that question (the panel stays for asks about one question or one mock), ?tab=plan goes to Today and
// ?tab=tools to the credits page.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { isPaidUser } from '@/services/credits/aiWalletState';
import RecordView from './RecordView';
import AskMobiDoors from './AskMobiDoors';
import { useInsights } from './useInsights';
import { openAskMobi } from './askMobi.mjs';
import { DOOR_COPY } from './askDoors.mjs';
import './mentor-page.css';

export default function MentorRecordPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const [recordTry, setRecordTry] = useState(0);
  const insightsState = useInsights(user?.id || null, recordTry);
  const pro = isPaidUser(user);
  const tab = params.get('tab');
  const q = params.get('q');

  useEffect(() => {
    if (tab === 'plan') { router.replace('/today'); return undefined; }
    if (tab === 'tools') { router.replace('/wallet'); return undefined; }
    if (tab !== 'ask') return undefined;
    // The panel's host mounts after this page does, so the request waits one beat for its listener.
    const timer = window.setTimeout(() => openAskMobi({ context: q ? { kind: 'question', ref: q } : { kind: 'page' } }), 120);
    return () => window.clearTimeout(timer);
  }, [tab, q, router]);

  if (tab === 'plan' || tab === 'tools') return <p className="mrp-note" role="status">Taking you there.</p>;
  return (
    // pp-arena maps the record view's own tokens (--pp-ink and the rest) onto the Arena's Night and Day colours (arena.css).
    // Without it the view falls back to the dark defaults in prepos.css and reads near-white on near-white in Day (W-078).
    <div className="mrp pp-arena">
      <AskMobiDoors user={user} insightsState={insightsState} pro={pro} onRetry={() => setRecordTry((n) => n + 1)} />
      {/* A new account has no record to show, and the record door already says so with its one key: the empty view would say it twice. */}
      {insightsState.status === 'empty' ? null : (
        <section id="record" className="mrp-record" aria-labelledby="mrp-record-title">
          <h2 id="mrp-record-title">{DOOR_COPY.recordInFull}</h2>
          <p>{DOOR_COPY.recordInFullLede}</p>
          <RecordView state={insightsState} onNavigate={(route) => router.push(route)} pro={pro} />
        </section>
      )}
      <p className="mrp-foot"><Link href="/wallet" className="ame ame--text">Your credits and how they work</Link></p>
    </div>
  );
}
