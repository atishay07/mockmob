"use client";
import { useSyncExternalStore } from 'react';
import LearningNextAction from '@/components/LearningNextAction';
import RecordGlimpse from '@/components/ai/RecordGlimpse';
import RhythmCard from '@/components/RhythmCard';
import ArenaHead from '@/components/arena/ArenaHead';
import { useAuth } from '@/components/AuthProvider';

// Today opens on the date, the way the app's Today does. The server render says "Today".
const noSubscribe = () => () => {};
const dayLine = () => new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

export default function Today() {
  const { user } = useAuth();
  const day = useSyncExternalStore(noSubscribe, dayLine, () => 'Today');
  const first = user?.name ? user.name.split(' ')[0] : '';
  return (
    <div className="student-page student-page--today">
      <section className="pr ov">
        <ArenaHead eyebrow={day} title={first ? `${first}, here is your next step.` : 'Here is your next step.'} lede="Planned from your own practice record, one step at a time." />
        <LearningNextAction />
        <RhythmCard compact />
        <RecordGlimpse />
      </section>
    </div>
  );
}
