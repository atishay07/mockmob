"use client";
// Today (TODAY-1017, owner sign-off 17 Oct: Q1 to Q4 yes; the road reworked by TODAY-NIGHT-1017 after his N1 review).
// One question at a glance, "what do I do now, and why": one Up next move with a one-line reason and one volt key, then
// Road to May as one plain readout (weeks left, this week, full mocks, the next milestone, one Change plan sheet) and
// two rows (Last paper, Your colleges). Every other block has a home one tap away (section 7): the record findings and the
// paper trend are on Review, the Compass count and the colleges ladder on Compass and Account, the week ring and the
// Mob on Progress and /mob, Add to home screen on Account. Nothing was deleted.
// The first week is the move itself (move.mjs), never a checklist. Mobi: at most one on screen, at a real moment.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useInsights } from '@/components/ai/useInsights';
import { useMob } from '@/components/mob/useMob';
import { useMobEnabled } from '@/components/mob/MobFlag';
import { api } from '@/lib/fetcher';
import { getSubjectById } from '@/../data/subjects';
import { alternatives as buildAlternatives, buildMove, clock, fitMove } from '@/lib/today/move.mjs';
import { firstTimedMockHref } from '@/../data/first_timed_mock';
import { greeting } from '@/lib/today/greeting.mjs';
import { useToday } from '@/components/today/useToday';
import TodayMove from '@/components/today/TodayMove';
import TodayWeek from '@/components/today/TodayWeek';
import TodayRoad from '@/components/today/TodayRoad';
import TodayRows from '@/components/today/TodayRows';
import TodayCue from '@/components/today/TodayCue';
import TodayMob from '@/components/today/TodayMob';
import { todayContext } from '@/components/ai/askContexts.mjs';
import '@/components/today/today.css';

const noSubscribe = () => () => {};
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dayLine = () => { const d = new Date(); return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const hourNow = () => new Date().getHours();
const subjectName = (id) => getSubjectById(id)?.name || (id ? id.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '');
const LENGTH_KEY = 'mm:today-length:v1';

export default function Today() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const day = useSyncExternalStore(noSubscribe, dayLine, () => '');
  const hour = useSyncExternalStore(noSubscribe, hourNow, () => 18);
  const data = useToday(userId);
  const insights = useInsights(userId);
  const mobOn = useMobEnabled();
  const mob = useMob(mobOn ? userId : null);

  // Loading: the skeleton holds the card's height; after 8 s the slow line offers Try again.
  const [slow, setSlow] = useState(false);
  const planLoading = data.plan.status === 'loading' && !data.plan.data;
  useEffect(() => {
    if (!planLoading) return undefined;
    const t = window.setTimeout(() => setSlow(true), 8000);
    return () => { window.clearTimeout(t); setSlow(false); };
  }, [planLoading]);
  const [triedAt, setTriedAt] = useState('');
  const [retried, setRetried] = useState(false);
  const retry = useCallback(() => { setRetried(true); data.retryAll(); }, [data]);
  useEffect(() => {
    if (data.plan.status !== 'error' || !retried) return undefined;
    const t = window.setTimeout(() => setTriedAt(clock(Date.now())), 0);
    return () => window.clearTimeout(t);
  }, [data.plan.status, retried]);

  // The chosen length: saved to the account when the study plan is on (PUT /api/study/preferences), else kept on this
  // device for tonight. "Saved." only after the server answers.
  const [chosen, setChosen] = useState(null);
  const [saving, setSaving] = useState('');
  useEffect(() => {
    const t = window.setTimeout(() => {
      try { const v = Number(window.localStorage.getItem(LENGTH_KEY)); if ([10, 20, 30].includes(v)) setChosen(v); } catch { /* none kept */ }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);
  const choose = useCallback(async (n) => {
    const prefs = data.plan.data?.study?.preferences;
    if (!prefs) {
      setChosen(n); data.setMinutes(n); setSaving('local');
      try { window.localStorage.setItem(LENGTH_KEY, String(n)); } catch { /* tonight only */ }
      return;
    }
    setSaving('saving');
    try {
      const input = { minutes: n, expectedRevision: prefs.revision };
      if (prefs.premium && prefs.weeklyPlan) input.weeklyPlan = prefs.weeklyPlan.map((d, i) => (i === data.plan.data.study.weekday ? { ...d, minutes: n } : d));
      await api('/api/study/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      setChosen(n); data.setMinutes(n); setSaving('saved');
    } catch { setSaving('failed'); }
  }, [data]);

  const top = insights.status === 'ready' ? insights.insights?.chapters?.ranked?.[0] || null : null;
  const facts = data.facts.status === 'ready' ? data.facts.data : null;
  const base = useMemo(() => buildMove({
    plan: data.plan.data,
    planFailed: data.plan.status === 'error',
    papers: data.papers.status === 'ready' ? data.papers.data : null,
    rhythm: data.rhythm.data,
    revise: data.revise.status === 'ready' ? data.revise.data : null,
    facts,
    repaired: data.repaired.status === 'ready' ? data.repaired.data : null,
    top,
    subjectName,
    firstSubject: Array.isArray(user?.subjects) ? user.subjects[0] || null : null,
    premium: Boolean(user?.isPremium),
    minutes: chosen,
  }), [data.plan.data, data.plan.status, data.papers.status, data.papers.data, data.rhythm.data, data.revise.status, data.revise.data, facts, data.repaired.status, data.repaired.data, top, user?.subjects, user?.isPremium, chosen]);
  const move = useMemo(() => {
    if (!base || base.id === 'failed') return base;
    const fitted = chosen ? fitMove(base, chosen) : base;
    return { ...fitted, base, subjectName: fitted.subject ? subjectName(fitted.subject) : '', mockHref: firstTimedMockHref(facts?.subject || fitted.subject || null) };
  }, [base, chosen, facts]);
  const askContext = useMemo(() => (move && move.id !== 'failed' ? todayContext({ move, plan: data.plan.data }) : null), [move, data.plan.data]);
  // Failed only once every read the move needs has settled without one; while any is still on its way it is loading.
  const settled = [data.plan, data.papers, data.rhythm, data.facts].every((r) => r.status !== 'loading');
  const phase = move && move.id !== 'failed' ? 'ready' : move?.id === 'failed' || settled ? 'failed' : 'loading';
  // The week, the road, the Mob row and the record rows land with the move, and wait for the Mob read when the Mob is on, so no
  // section arrives late and pushes the road down (W-042).
  const landing = phase === 'loading' || (mobOn && userId && (mob.status === 'idle' || mob.status === 'loading'));
  const mobUnsat = mob.status === 'ready' && mob.mob?.week && !mob.mob.week.youSat && !mob.mob.week.closed && mob.mob.week.size > 1;
  const alts = useMemo(() => (move && move.id !== 'failed' ? buildAlternatives({
    move, papers: data.papers.data, revise: data.revise.data, facts, repaired: data.repaired.data, mobUnsat, subjectName,
  }) : []), [move, data.papers.data, data.revise.data, facts, data.repaired.data, mobUnsat]);

  const away = data.rhythm.data?.daysSinceLastActivity;
  const hello = greeting({ hour, name: user?.name, email: user?.email, returning: Number.isInteger(away) && away >= 7 });
  const everSessions = facts && Number.isInteger(facts.sessions) ? facts.sessions : data.rhythm.data?.counts?.sessions ?? null;

  return (
    <div className="student-page student-page--today">
      <section className="pr ov today">
        <header className="today__head">
          <p className="today__date">{day ? <time>{day}</time> : ' '}</p>
          <h1 className="today__hello">{hello}</h1>
        </header>
        <div className="today-grid">
          <div className="today-grid__main">
            <TodayMove askContext={askContext} phase={phase} move={move} word={hour >= 17 || hour < 4 ? 'Tonight’s move' : 'Today’s move'} slow={slow} triedAt={triedAt} onRetry={retry} alternatives={alts} chosen={chosen} onChoose={choose} saving={saving} />
            {phase !== 'failed' ? <TodayCue target="road" ready={phase === 'ready'} /> : null}
            <TodayRows papers={data.papers} userId={userId} subjectName={subjectName} subjects={user?.subjects || []} hold={landing} />
          </div>
          <div className="today-grid__side">
            <TodayRoad
              hold={landing} road={data.road} goal={data.goal} rhythm={data.rhythm} facts={data.facts} onGoalSaved={data.retryWeek}
              week={<TodayWeek hold={landing} rhythm={data.rhythm} goal={data.goal} everSessions={everSessions} mobiFree={!(move?.art === 'mobi') && phase !== 'failed'} mob={mob} repairs={data.repairRows} onRetry={data.retryWeek} />}
            />
            <TodayMob enabled={mobOn && !landing} mob={mob} />
          </div>
        </div>
      </section>
    </div>
  );
}
