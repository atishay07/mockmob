"use client";

// Today: the next step of the loop, in the app's order (web IA plan 2.2).
//   1. Tonight's move: one hero, one primary, "Something else instead" for the rest
//   2. This week: study days against the weekly goal (/api/me/goal), "Set your goal" when none is chosen
//   3. From your record: one finding with "Show me", and how the real marks moved when there are enough papers
//   4. Finish your sheet: only while a part of the sheet the site can keep is missing
//   5. The road to May: the expected CUET window and the stops on the way
// The hero, the week and the record read their own facts; this page only arranges them and gives the hero
// the same box while it loads, so nothing moves when the answer arrives. One filled button on the page.
import { useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import RhythmCard from '@/components/RhythmCard';
import RecordGlimpse from '@/components/ai/RecordGlimpse';
import TonightMove from '@/components/today/TonightMove';
import TodayMobi from '@/components/today/TodayMobi';
import FinishSheetCard from '@/components/today/FinishSheetCard';
import RoadToMay from '@/components/today/RoadToMay';
import { useTodayFacts } from '@/components/today/useTodayFacts';
import { firstNameOf, goalState, greetingFor, sheetGaps, todayMove } from '@/components/today/todayModel.mjs';
import '@/components/today/today.css';

export default function Today() {
  const { user } = useAuth();
  const { status, facts, goal, wallet, practiceBalance, supported, retry } = useTodayFacts(user?.id);
  const move = useMemo(() => (status === 'ready' ? todayMove(facts, {
    user,
    supported,
    practiceCredits: practiceBalance ?? user?.creditBalance ?? null,
    aiCredits: wallet ? wallet.total : null,
  }) : null), [status, facts, user, supported, practiceBalance, wallet]);
  const gaps = useMemo(() => sheetGaps(user), [user]);
  // The greeting reads the device clock, so the server's first paint may differ by the hour.
  const title = greetingFor(new Date().getHours(), firstNameOf(user?.name));
  return (
    <div className="student-page student-page--today today">
      <header className="today__head">
        <h1 className="today__title" suppressHydrationWarning>{title}</h1>
        <p className="today__lede">Your next move, your week and the road to May.</p>
      </header>
      <TonightMove
        move={move}
        loading={status === 'loading'}
        error={status === 'error' || (status === 'ready' && !move)}
        onRetry={retry}
        aside={move ? <TodayMobi first={move.id === 'first'} /> : null}
      />
      <div className="today__grid">
        <div className="today__col">
          <RhythmCard compact goal={goalState(goal)} />
        </div>
        <div className="today__col">
          <RecordGlimpse />
          <FinishSheetCard gaps={gaps} />
        </div>
      </div>
      <RoadToMay />
    </div>
  );
}
