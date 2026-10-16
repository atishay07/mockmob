"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import LearningNextAction from '@/components/LearningNextAction';
import InstallPractice from '@/components/InstallPractice';
import RecordGlimpse from '@/components/ai/RecordGlimpse';
import RhythmCard from '@/components/RhythmCard';
import { TodayColleges } from '@/components/colleges/MyColleges';
import TodayCompass from '@/components/du/TodayCompass';
import { MobTodayCard } from '@/components/mob/MobTodayCard';
import { useMob } from '@/components/mob/useMob';
import { useMobEnabled } from '@/components/mob/MobFlag';
import ArenaHead from '@/components/arena/ArenaHead';
import { useAuth } from '@/components/AuthProvider';
import { useInsights } from '@/components/ai/useInsights';
import { apiGet } from '@/lib/fetcher';
import { mobCheerKey, mobRingAct, weekCheerKey, weekGoalAct } from '@/lib/mobiScreens';
import FirstTimedMock from '@/components/timed/FirstTimedMock';
import { useFirstTimedMock } from '@/components/timed/useFirstTimedMock';

// Today opens on the date, the way the app's Today does: it leads the lede, in the reading line,
// not as a kicker above the headline. The server render leaves it out.
const noSubscribe = () => () => {};
const dayLine = () => new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

// The week's study-day goal, met by the server's count, is a real moment: Today's companion is proud once per week on
// this device (the same key the Progress week card uses, so the week is never cheered twice). Nothing until the server
// has answered; a failed read just leaves the companion as it was.
function useWeekGoal(userId) {
  const [moment, setMoment] = useState(null);
  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    apiGet('/api/me/rhythm').then((r) => {
      if (!alive || !r?.weekStart) return;
      let cheered = false;
      try { cheered = window.localStorage.getItem(weekCheerKey(r.weekStart)) === '1'; } catch { cheered = false; }
      const act = weekGoalAct({ met: r.metThisWeek, cheered });
      if (!act) return;
      try { window.localStorage.setItem(weekCheerKey(r.weekStart), '1'); } catch { /* he may cheer again on this device */ }
      setMoment({ act, title: `Week goal met: ${r.studyDays} of ${r.daysGoal} study days.`, line: 'Every day you planned this week is a study day. Anything more tonight is extra.' });
    }).catch(() => {});
    return () => { alive = false; };
  }, [userId]);
  return moment;
}

// The Mob's ring completing (every member sat this week) is one real moment, once per Mob week on this device, said
// by the plan's one companion (SOCIAL-SPEC 7 and 9). Read from the same server view the Mob card draws.
function useMobMoment(mob) {
  const week = mob.status === 'ready' ? mob.mob?.week || null : null;
  const start = week?.start || null;
  const size = week?.size ?? 0;
  const sat = week?.sat ?? 0;
  // Read once per Mob week, so the moment stays for this visit after it is remembered.
  const cheered = useMemo(() => {
    if (!start) return true;
    try { return window.localStorage.getItem(mobCheerKey(start)) === '1'; } catch { return false; }
  }, [start]);
  return useMemo(() => {
    const act = start ? mobRingAct({ size, sat, cheered }) : null;
    return act ? { act, week: start, title: `Your Mob all sat this week: ${sat} of ${size}.`, line: 'Everyone sat the same 10 questions. The ring stays full until Monday.' } : null;
  }, [start, size, sat, cheered]);
}

export default function Today() {
  const { user } = useAuth();
  const day = useSyncExternalStore(noSubscribe, dayLine, () => '');
  const first = user?.name ? user.name.split(' ')[0] : '';
  // One read of the record: the plan's why (the chapter with the most marks open) and the glimpse below it.
  const insights = useInsights(user?.id);
  const weekGoal = useWeekGoal(user?.id);
  // Mob off: no read at all (the flag comes down from the (app) layout).
  const mobOn = useMobEnabled();
  const mob = useMob(mobOn ? user?.id : null);
  const mobMoment = useMobMoment(mob);
  // One Mobi on Today: the week's study goal first; the Mob's full ring otherwise. A moment is remembered only once it
  // has actually been the one shown.
  const moment = weekGoal || mobMoment;
  useEffect(() => {
    if (!moment || moment !== mobMoment) return;
    try { window.localStorage.setItem(mobCheerKey(mobMoment.week), '1'); } catch { /* it may cheer again on this device */ }
  }, [moment, mobMoment]);
  const top = insights.status === 'ready' ? insights.insights?.chapters?.ranked?.[0] || null : null;
  // A student with no saved session yet has no record to plan from, so the page says how the record starts.
  const fresh = insights.status === 'empty';
  // A student with sessions and no timed mock yet: one line on what a timed mock adds, and one key (data/first_timed_mock.js).
  const firstTimed = useFirstTimedMock('today');
  const lede = fresh ? 'Ten questions is enough to begin. After that, each step is planned from what you got right and wrong.' : 'Planned from your own practice record, one step at a time.';
  return (
    <div className="student-page student-page--today">
      <section className="pr ov">
        <ArenaHead
          title={fresh ? (first ? `${first}, your record starts with one session.` : 'Your record starts with one session.') : first ? `${first}, here is your next step.` : 'Here is your next step.'}
          lede={day ? <><time className="today-date">{day}.</time> {lede}</> : lede} />
        <LearningNextAction why={top} moment={moment} />
        <FirstTimedMock prompt={firstTimed} />
        <div className="today-record">
          {/* This week first; the Compass line names the first of My colleges, so it sits right above that list. */}
          <RhythmCard compact quietMet={Boolean(weekGoal)} />
          {/* The Mob: only when you are in one (and MOB_ENABLED is on); otherwise it draws nothing. */}
          <MobTodayCard userId={user?.id} mob={mob} />
          <TodayCompass />
          <TodayColleges userId={user?.id} />
          <RecordGlimpse state={insights} skip={top ? ['chapter'] : []} link={!top} />
        </div>
        {/* The browser offers install a few seconds after load; at the foot of the page it never pushes the plan down. */}
        <InstallPractice />
      </section>
    </div>
  );
}
