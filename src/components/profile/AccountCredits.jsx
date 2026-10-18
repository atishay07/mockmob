"use client";
// Account > the two balances at a glance (W-052: name, email, practice credits and AI credits on one screen). Two pressable
// figures under your name: Practice credits from your account and AI credits from the wallet (the same read the top bar
// uses, so the two never disagree; a reply in Ask Mobi updates both at once). Each opens the Credits history below.
// Unknown is never shown as zero: a wallet that has not been read yet holds its place with a bar.
import { CreditAmount } from '@/components/ui/Glyph';
import { useWalletSummary } from '@/components/useWalletSummary';

// One credits balance (owner, 18 Oct 2026, D78): one figure, the same live total the top bar shows.
export default function AccountCredits({ user }) {
  const wallet = useWalletSummary(user?.id);
  const total = wallet.wallet?.known ? wallet.wallet.total : null;
  const free = wallet.wallet?.known ? wallet.wallet.includedRemaining : null;
  return (
    <div className="acct-credits" aria-label="Your credits">
      <a className="acct-credits__item" href="#credits" aria-label={total != null ? `Credits: ${total}. See the history.` : 'Credits: reading. See the history.'}>
        {total != null || wallet.status === 'unavailable' ? <CreditAmount kind="practice" amount={total} unit={false} size={18} /> : <span className="acct-sk acct-sk--chip skeleton" aria-hidden="true" />}
        <span className="acct-credits__label">{wallet.status === 'unavailable' && total == null ? 'Credits did not load' : free != null && free > 0 ? `Credits, ${free} free this month` : 'Credits'}</span>
      </a>
    </div>
  );
}
