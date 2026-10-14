"use client";

// One line from the student's record, under the shared next step on Today. It never creates a
// second plan: it only explains why the step matters, and links to the full record.
// It asks for the record only after the plan request has settled, then waits for an idle
// moment, so it never competes with the plan. It renders nothing until it has a real finding.
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { AppIcon } from '@/components/ui/Glyph';
import { waitForPlanSettled } from '@/lib/learningPlanCache';
import { useInsights } from './useInsights';
import './prepos.css';

const idle = () => new Promise(resolve => {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) window.requestIdleCallback(() => resolve(), { timeout: 1500 });
  else setTimeout(resolve, 200);
});
const afterPlan = () => waitForPlanSettled().then(idle);

export default function RecordGlimpse() {
  const { user } = useAuth();
  const state = useInsights(user?.id, { after: afterPlan });
  if (state.status !== 'ready' || !state.findings[0]) return null;
  const f = state.findings[0];
  return (
    <aside className="rg" aria-label="From your record">
      <span className="rg__icon"><AppIcon name="prepos" size={16} /></span>
      <div>
        <b>{f.headline}</b>
        <p>{f.detail}</p>
        <Link href="/mentor?tab=record">See your full record</Link>
      </div>
    </aside>
  );
}
