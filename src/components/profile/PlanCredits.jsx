"use client";

// Account > Plan and credits: the live plan card (Free with practice credits, or Pro), joined to one
// line for the AI credits wallet, so both currencies sit together the way the top bar shows them.
// The wallet is read once per account by useWalletSummary; unknown is never shown as 0.
import Link from 'next/link';
import { PlanCard } from '@/components/billing/PlanCard';
import { CreditAmount } from '@/components/ui/Glyph';
import { useWalletSummary } from '@/components/useWalletSummary';
import { PREPOS_HREF, walletLine } from './accountModel.mjs';
import './account.css';

export default function PlanCredits({ userId }) {
  const summary = useWalletSummary(userId);
  const line = walletLine(summary);

  return (
    <section className="acct-plan" id="plan" aria-label="Plan and credits">
      <PlanCard />
      <div className="acct-wallet" data-state={line.state} aria-busy={line.state === 'loading' || undefined}>
        <div className="acct-wallet__amount">
          {line.state === 'loading' ? <span className="acct-sk acct-sk--figure skeleton" aria-hidden="true" /> : null}
          {line.state === 'known' ? <CreditAmount kind="prepos" amount={line.total} size={18} /> : null}
          <span className="acct-wallet__line" role="status">{line.state === 'known' ? line.line.replace(/^AI credits /, '') : line.line}</span>
        </div>
        <span className="acct-wallet__links"><Link href="#credits" className="acct-link">See history</Link><Link href={PREPOS_HREF} className="acct-link">Ask Mobi</Link></span>
      </div>
    </section>
  );
}
