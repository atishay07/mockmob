"use client";

// Account > Plan: the live plan card (Free, Pro monthly or Pro access) and its one money action.
import { PlanCard } from '@/components/billing/PlanCard';
import './account.css';

// Each balance is shown once on Account: both pools, with their history, are in Credits right under this card.
export default function PlanCredits() {
  return (
    <section className="acct-plan" id="plan" aria-label="Plan and credits">
      <PlanCard />
    </section>
  );
}
