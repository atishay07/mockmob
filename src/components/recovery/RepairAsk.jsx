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
import './repair-check.css';

export default function RepairAsk({ attemptId, questionId, number = null, askHref = null, style }) {
  const auth = useContext(AuthContext);
  const wallet = useWalletSummary(auth?.user?.id, { reuseFresh: true });
  const price = usesLine({ what: CHECK_COPY.askCost, cost: 1, pool: 'ai', balance: wallet.wallet?.known ? wallet.wallet.total : null });
  const offer = askOffer(wallet.wallet, price);
  const href = safeAskHref(askHref, attemptId, questionId);
  return (
    <div className="mr-block mr-askq" data-stagger style={style}>
      {offer.ask ? (
        <>
          <Link className="mr-ask" href={href}>{askLabel(number)}</Link>
          <p className="mr-chk__fine">{offer.line} {askSeesLine(number)}</p>
        </>
      ) : (
        <p className="mr-chk__fine mr-askq__off" role="status">{offer.line}</p>
      )}
    </div>
  );
}
