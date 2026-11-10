"use client";
// Account > the one credits balance at a glance (W-052; D78 one balance), from the same wallet read as the top bar.
// Unknown is never shown as zero: a wallet that has not been read yet holds its place with a bar.
import Link from 'next/link';
import { CreditAmount } from '@/components/ui/Glyph';
import { useWalletSummary } from '@/components/useWalletSummary';

// One credits balance (owner, 18 Oct 2026, D78): one figure, the same live total the top bar shows.
export default function AccountCredits({ user }) {
  const wallet = useWalletSummary(user?.id);
  const total = wallet.wallet?.known ? wallet.wallet.total : null;
  const unavailable = wallet.status === 'unavailable' && total == null;
  return (
    <div className="acct-credits">
      <Link className="acct-credits__item" href="/wallet" aria-label={total != null ? `${total} credits. Open Wallet` : unavailable ? 'Credits did not load. Open Wallet' : 'Loading credits. Open Wallet'}>
        {total != null ? <CreditAmount kind="practice" amount={total} unit={false} size={18} /> : unavailable ? null : <span className="acct-sk acct-sk--chip skeleton" aria-hidden="true" />}
        <span className="acct-credits__label">{unavailable ? 'Credits did not load' : 'credits'}</span>
        <span className="acct-credits__door">Wallet</span>
      </Link>
    </div>
  );
}
