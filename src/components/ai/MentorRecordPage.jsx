"use client";

// /mentor, after the redesign (ASK-MOBI-1018, P4): the page is "Your record" (the marks ledger, the chapters costing the most,
// pace) with Mobi's earlier questions under it, and no tabs. Mobi's composer is the panel, which this page opens beside the
// record. Deep links keep working: ?tab=record is this page, ?tab=ask&q=<attempt>:<question> opens the panel on that question,
// ?tab=plan goes to Today (where the next step lives) and ?tab=tools to the AI credits page (where the wallet and its rules live).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { isPaidUser } from '@/services/credits/aiWalletState';
import { AppIcon } from '@/components/ui/Glyph';
import ArenaHead from '@/components/arena/ArenaHead';
import RecordView from './RecordView';
import AskMobiLink from './AskMobiLink';
import { useInsights } from './useInsights';
import { openAskMobi } from './askMobi.mjs';
import { exchangesFrom } from './mentorHistory.mjs';
import './mentor-page.css';

function History() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/ai/mentor/history', { cache: 'no-store' })
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }) => { if (alive) setRows(res.ok && data?.ok ? exchangesFrom(data.messages) : []); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, []);
  if (!rows || !rows.length) return null;
  return (
    <section className="mrp-history" aria-labelledby="mrp-history-title">
      <h2 id="mrp-history-title">Earlier questions</h2>
      <ul>
        {rows.map((row) => (
          <li key={row.id}>
            <b>{row.ask}</b>
            {row.reply ? <p>{row.reply}</p> : null}
            {row.source ? <span>{row.source}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function MentorRecordPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const insightsState = useInsights(user?.id || null);
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
      <ArenaHead title="Your record" lede="Where your marks went, from your own saved sessions." />
      <AskMobiLink context={{ kind: 'page' }} variant="row" className="mrp-ask">
        <span className="ame__icon" aria-hidden="true"><AppIcon name="prepos" size={20} /></span>
        <b>Ask Mobi about your record</b>
        <span>Questions about your record are free. A written reply costs 1 AI credit.</span>
      </AskMobiLink>
      <RecordView state={insightsState} onNavigate={(route) => router.push(route)} pro={pro} />
      <History />
      <p className="mrp-foot"><Link href="/wallet" className="ame ame--text">Your AI credits and how they work</Link></p>
    </div>
  );
}
