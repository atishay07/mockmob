"use client";
// Mistake Repair, "Ask Mobi about Q3": the follow-up that belongs to the mistake being repaired, so it sits right after the
// explanation, before the check, and names the question by its number on the paper. The hand-off carries the ORIGINAL mistake
// (the ask-context route and the chat route only know attempt:question), so the check question is never what Mobi is asked about.
// Its price is shown here, before the student leaves, from the AI wallet; when written replies cannot be bought the link goes
// and the line says so and that nothing is charged.
import { useContext } from 'react';
import Link from 'next/link';
import { CHECK_COPY, askLabel, askSeesLine, askOffer, safeAskHref } from '@/../data/repair_check_client.mjs';
import { AuthContext } from '@/components/AuthProvider';
import { useWalletSummary } from '@/components/useWalletSummary';
import { usesLine } from '@/lib/creditCopy.mjs';
import { askRequestFromHref, isPlainClick, openAskMobi } from '@/components/ai/askMobi.mjs';
import './repair-check.css';

// `balance`: the AI credits the repair's own response says are left after its charge. It is newer than the wallet read
// (reused for five minutes), so the price line and the repair's "1 AI credit used. You have N." say the same N.
export default function RepairAsk({ attemptId, questionId, number = null, askHref = null, balance = null, style }) {
  const auth = useContext(AuthContext);
  const wallet = useWalletSummary(auth?.user?.id, { reuseFresh: true });
  const left = Number.isFinite(balance) ? balance : wallet.wallet?.known ? wallet.wallet.total : null;
  const price = usesLine({ what: CHECK_COPY.askCost, cost: 1, pool: 'ai', balance: left });
  const offer = askOffer(wallet.wallet, price);
  const href = safeAskHref(askHref, attemptId, questionId);
  if (offer.pending) return <div className="mr-block mr-askq" data-pending aria-hidden="true" style={style}><span className="mr-askq__hold" /></div>;
  return (
    <div className="mr-block mr-askq" data-stagger style={style}>
      {offer.ask ? (
        <>
          <Link className="mr-ask" href={href} onClick={(event) => {
            // In the arena, Mobi opens over this repair (N9), so the student keeps the mistake in view; elsewhere, the link.
            const asked = askRequestFromHref(href);
            if (asked && isPlainClick(event) && openAskMobi({ ...asked, from: event.currentTarget })) event.preventDefault();
          }}>{askLabel(number)}</Link>
          <p className="mr-chk__fine">{offer.line} {askSeesLine(number)}</p>
        </>
      ) : (
        <p className="mr-chk__fine mr-askq__off" role="status">{offer.line}</p>
      )}
    </div>
  );
}
