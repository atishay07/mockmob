"use client";
// Account > the one credits balance at a glance (W-052; D78 one balance): one pressable figure under your name, from the
// same wallet read the top bar uses, so the two never disagree. It opens the Credits history below.
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
