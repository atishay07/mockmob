"use client";

// "Invite a friend, you both get 100 credits" (owner D165, 20 Oct 2026), on the Wallet and on You. The link to share, one
// Copy key (and Share where the phone offers it), and what has happened so far in counts only: never a friend's name.
// Nothing renders while invites are off (REFERRALS_ENABLED) or for a signed-out visitor. All words: friendInvite.mjs.
// Design notes: one section on the page's own surface (no nested card), one primary key (Copy link), the link in a quiet
// read-only field so it can be selected by hand, tabular numerals, 44 px targets, the status line announced politely.
import { useState } from 'react';
import { REFERRAL_COPY, referralView } from '@/lib/referrals/friendInvite.mjs';
import { useReferralStatus } from './useReferralStatus';
import './invite.css';

export default function InviteFriendCard({ id = 'invite', compact = false, className = '' }) {
  const { status, body, retry } = useReferralStatus();
  const [note, setNote] = useState('');
  if (status === 'off') return null;
  if (status === 'loading') {
    return <div className={`rf rf--loading ${className}`.trim()} role="status" aria-label={REFERRAL_COPY.loading}><span className="rf-sk skeleton" aria-hidden="true" /></div>;
  }
  if (status === 'failed') {
    return (
      <section className={`rf ${className}`.trim()} aria-labelledby={`${id}-h`}>
        <h2 className="rf-h" id={`${id}-h`}>{REFERRAL_COPY.title()}</h2>
        <p className="rf-note">{REFERRAL_COPY.failed}</p>
        <div><button type="button" className="rf-key" onClick={retry}>Try again</button></div>
      </section>
    );
  }
  const view = referralView(body);
  if (!view) return null;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(view.link);
      setNote(REFERRAL_COPY.copied);
    } catch {
      setNote('');
    }
  };
  const share = async () => {
    try { await navigator.share({ title: view.title, text: view.shareText, url: view.link }); } catch { /* closed: the link is still on the page */ }
  };

  return (
    <section className={`rf ${className}`.trim()} data-compact={compact || undefined} aria-labelledby={`${id}-h`}>
      <div className="rf-head">
        <h2 className="rf-h" id={`${id}-h`}>{view.title}</h2>
        <p className="rf-lead">{view.how}</p>
      </div>
      <div className="rf-row">
        <label className="sr-only" htmlFor={`${id}-link`}>Your invite link</label>
        <input id={`${id}-link`} className="rf-link" type="text" readOnly value={view.link} onFocus={(e) => e.currentTarget.select()} />
        <div className="rf-keys">
          <button type="button" className="rf-key" data-solid="" onClick={copy}>{REFERRAL_COPY.copy}</button>
          {canShare ? <button type="button" className="rf-key" onClick={share}>{REFERRAL_COPY.share}</button> : null}
        </div>
      </div>
      <p className="rf-copied" role="status" aria-live="polite">{note}</p>
      <div className="rf-status">
        <p className="rf-summary">{view.summary}</p>
        {view.lines.map((line) => <p className="rf-note" key={line}>{line}</p>)}
        {view.invited ? <p className="rf-note">{view.invited}</p> : null}
      </div>
      {compact ? null : <p className="rf-fine">{view.cap} {view.rules}</p>}
    </section>
  );
}

/** One line under a Mob invite: the Mob link is also a friend invite (D165). Nothing while invites are off. */
export function InviteRewardLine({ className = 'mob-hint' }) {
  const { status, body } = useReferralStatus();
  if (status !== 'ready') return null;
  const view = referralView(body);
  return view ? <p className={className}>{REFERRAL_COPY.mobLine(view.reward)}</p> : null;
}
