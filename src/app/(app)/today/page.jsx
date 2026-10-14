"use client";
import LearningNextAction from '@/components/LearningNextAction';
import RecordGlimpse from '@/components/ai/RecordGlimpse';
import ArenaHead from '@/components/arena/ArenaHead';
import { useAuth } from '@/components/AuthProvider';

export default function Today() {
  const { user } = useAuth();
  const first = user?.name ? user.name.split(' ')[0] : '';
  return (
    <div className="student-page student-page--today">
      <section className="pr ov">
        <ArenaHead eyebrow="Today" title={first ? `${first}, here is your next useful step.` : 'Your next useful step.'} lede="Choose how much time you have. The plan comes from your practice record and the content available right now." />
        <LearningNextAction />
        <RecordGlimpse />
        {/* D8 caption: stays here until the footer carries FOOTER_CAPTIONS.provisional2027 (W1.1). */}
        <p className="na__note">2027 exam specifications remain provisional until officially confirmed.</p>
      </section>
    </div>
  );
}
