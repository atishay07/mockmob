"use client";
import dynamic from 'next/dynamic';
import LearningNextAction from '@/components/LearningNextAction';
import ArenaHead from '@/components/arena/ArenaHead';
import { useAuth } from '@/components/AuthProvider';

// The record line is secondary: its code loads separately, and it fetches only after the plan
// has settled. It sits last on the page, so when it appears nothing above it moves.
const RecordGlimpse = dynamic(() => import('@/components/ai/RecordGlimpse'), { ssr: false, loading: () => null });

export default function Today() {
  const { user } = useAuth();
  const first = user?.name ? user.name.split(' ')[0] : '';
  return (
    <div className="student-page student-page--today">
      <section className="pr ov">
        <ArenaHead eyebrow="Today" title={first ? `${first}, here is your next useful step.` : 'Your next useful step.'} lede="Choose how much time you have. The plan comes from your practice record and the content available right now." />
        <LearningNextAction />
        {/* D8 caption: stays here until the footer carries FOOTER_CAPTIONS.provisional2027 (W1.1).
            Above the record line, which loads last, so nothing moves when that appears. */}
        <p className="na__note">2027 exam specifications remain provisional until officially confirmed.</p>
        <RecordGlimpse />
      </section>
    </div>
  );
}
