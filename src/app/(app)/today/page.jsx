"use client";
import { useSyncExternalStore } from 'react';
import LearningNextAction from '@/components/LearningNextAction';
import RecordGlimpse from '@/components/ai/RecordGlimpse';
import RhythmCard from '@/components/RhythmCard';
import { TodayColleges } from '@/components/colleges/MyColleges';
import ArenaHead from '@/components/arena/ArenaHead';
import { useAuth } from '@/components/AuthProvider';
import { useInsights } from '@/components/ai/useInsights';

// Today opens on the date, the way the app's Today does: it leads the lede, in the reading line,
// not as a kicker above the headline. The server render leaves it out.
const noSubscribe = () => () => {};
const dayLine = () => new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

export default function Today() {
  const { user } = useAuth();
  const day = useSyncExternalStore(noSubscribe, dayLine, () => '');
  const first = user?.name ? user.name.split(' ')[0] : '';
  // One read of the record: the plan's why (the chapter with the most marks open) and the glimpse below it.
  const insights = useInsights(user?.id);
  const top = insights.status === 'ready' ? insights.insights?.chapters?.ranked?.[0] || null : null;
  // A student with no saved session yet has no record to plan from, so the page says how the record starts.
  const fresh = insights.status === 'empty';
  const lede = fresh ? 'Ten questions is enough to begin. After that, each step is planned from what you got right and wrong.' : 'Planned from your own practice record, one step at a time.';
  return (
    <div className="student-page student-page--today">
      <section className="pr ov">
        <ArenaHead
          title={fresh ? (first ? `${first}, your record starts with one session.` : 'Your record starts with one session.') : first ? `${first}, here is your next step.` : 'Here is your next step.'}
          lede={day ? <><time className="today-date">{day}.</time> {lede}</> : lede} />
        <LearningNextAction why={top} />
        <div className="today-record">
          <RhythmCard compact />
          <TodayColleges userId={user?.id} />
          <RecordGlimpse state={insights} skip={top ? ['chapter'] : []} link={!top} />
        </div>
      </section>
    </div>
  );
}
