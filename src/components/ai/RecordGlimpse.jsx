"use client";

// One line from the student's record, under the shared next step on Today. It never creates a
// second plan: it only explains why the step matters, and links to the full record.
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { AppIcon } from '@/components/ui/Glyph';
import { useInsights } from './useInsights';
import './prepos.css';

export default function RecordGlimpse() {
  const { user } = useAuth();
  const state = useInsights(user?.id);
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
