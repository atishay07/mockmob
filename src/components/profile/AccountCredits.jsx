"use client";
// Account > the two balances at a glance (W-052: name, email, practice credits and AI credits on one screen). Two pressable
// figures under your name: Practice credits from your account and AI credits from the wallet (the same read the top bar
// uses, so the two never disagree; a reply in Ask Mobi updates both at once). Each opens the Credits history below.
// Unknown is never shown as zero: a wallet that has not been read yet holds its place with a bar.
import { CreditAmount } from '@/components/ui/Glyph';
import { useWalletSummary } from '@/components/useWalletSummary';

export default function AccountCredits({ user }) {
  const wallet = useWalletSummary(user?.id);
  const ai = wallet.wallet?.known ? wallet.wallet.total : null;
  const practice = user?.isPremium ? 'unlimited' : (Number.isFinite(Number(user?.creditBalance)) ? Number(user.creditBalance) : null);
  return (
    <div className="acct-credits" aria-label="Your credits">
      <a className="acct-credits__item" href="#credits" aria-label={practice === 'unlimited' ? 'Practice credits: unlimited with Pro. See the history.' : `Practice credits: ${practice ?? 'unknown'}. See the history.`}>
        <CreditAmount kind="practice" amount={practice} unit={false} size={18} />
        <span className="acct-credits__label">{practice === 'unlimited' ? 'Practice, with Pro' : 'Practice credits'}</span>
      </a>
      <a className="acct-credits__item" href="#credits" aria-label={ai != null ? `AI credits: ${ai}. See the history.` : 'AI credits: reading. See the history.'}>
        {ai != null || wallet.status === 'unavailable' ? <CreditAmount kind="prepos" amount={ai} unit={false} size={18} /> : <span className="acct-sk acct-sk--chip skeleton" aria-hidden="true" />}
        <span className="acct-credits__label">{wallet.status === 'unavailable' && ai == null ? 'AI credits did not load' : 'AI credits'}</span>
      </a>
    </div>
  );
}
