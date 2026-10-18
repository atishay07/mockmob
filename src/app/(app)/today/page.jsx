"use client";
// Today, pass 1018 (docs/design-decisions/pass-1018/TODAY-1018.md; the owner's yes, 18 Oct 3:30 am, with D25 to D27).
// The R3 Today's information and structure, refined and made to lead (D1 to D3); nothing R3 showed is lost.
// Top to bottom on a phone:
//   1. greeting and date
//   2. Up next: the recommended move with its reason, its stake and its minutes, and two other moves on the same card; in the first
//      7 days its overline says the day and a rail of seven marks draws the chained path, whose step for today leads (release 8)
//      a tap swaps the lead live (the pick is kept for the day in this tab, never written to the server)
//   3. This week: tappable days with a readout of what was done and what is planned
//   4. Road to CUET in three layers: due today, due this week, the overall goal (D26); Change plan is a guided sentence
//   5. Weak chapters, each opening to its own mistakes
//   6. Last paper with its bar and biggest leak, and one receipt line of what the repairs made before it did on it (release 8)
//   7. Repairs and Revise
//   8. Your colleges and Compass
// On a wide screen the doing (2, 5, 6) sits left and the glance (3, 4, 7, 8) right. The page lands in one piece (W-042).
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useInsights } from '@/components/ai/useInsights';
import { useMob } from '@/components/mob/useMob';
import { useMobEnabled } from '@/components/mob/MobFlag';
import { api } from '@/lib/fetcher';
import { getSubjectById } from '@/../data/subjects';
import { alternatives as buildAlternatives, buildMove, clock, fitMove } from '@/lib/today/move.mjs';
import { choiceMoves, keepLength, leadOf, pickChoices, pickKey, readLength, refit } from '@/lib/today/lead.mjs';
import { firstWeekClock, firstWeekPath, stepOfDay, withFirstWeek } from '@/lib/today/firstWeek.mjs';
import { firstTimedMockHref } from '@/../data/first_timed_mock';
import { TEST_MODES } from '@/../data/test_modes';
import { usesLine } from '@/lib/creditCopy.mjs';
import { greeting } from '@/lib/today/greeting.mjs';
import { freshPaper, reelSeen } from '@/lib/today/paperReel.mjs';
import { todayKeyIn } from '@/lib/today/week.mjs';
import { useToday } from '@/components/today/useToday';
import TodayMove from '@/components/today/TodayMove';
import TodayReel from '@/components/today/TodayReel';
import TodayWeek from '@/components/today/TodayWeek';
import TodayRoad from '@/components/today/TodayRoad';
import TodayWeak from '@/components/today/TodayWeak';
import TodayPaper from '@/components/today/TodayPaper';
import TodayQueue from '@/components/today/TodayQueue';
import TodayColleges from '@/components/today/TodayColleges';
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
const LENGTHS = [10, 20, 30];
// This device's own calendar day: the kept length is "for today" on this device.
const deviceDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const reducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced'; } catch { return false; } };
const readStorage = () => { try { return window.localStorage; } catch { return null; } };
const readPick = (key) => { try { return window.sessionStorage.getItem(key) || null; } catch { return null; } };
const keepPick = (key, id) => { try { if (id) window.sessionStorage.setItem(key, id); else window.sessionStorage.removeItem(key); } catch { /* this visit only */ } };

/** What each length does to a move ("10 min, 3 mistakes"), or null when a length changes nothing. */
function lengthsFor(move) {
  if (!move || !move.key?.minutes) return null;
  const fits = LENGTHS.map((n) => ({ n, f: fitMove(move, n) }));
  if (new Set(fits.map(({ f }) => `${f?.number}|${f?.key?.minutes}`)).size < 2) return null;
  const unit = (f) => (['repair', 'firstRepair', 'returning'].includes(move.id) && move.open > 0 ? `${f.number} ${f.number === 1 ? 'mistake' : 'mistakes'}` : move.id === 'revise' ? `${f.number} questions` : `${f.number} questions${f.review ? ' and a review' : ''}`);
  return fits.map(({ n, f }) => ({ n, line: unit(f) }));
}

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
      try { const v = readLength(window.localStorage.getItem(LENGTH_KEY), deviceDay(), LENGTHS); if (v) setChosen(v); } catch { /* none kept */ }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);
  const choose = useCallback(async (n) => {
    const prefs = data.plan.data?.study?.preferences;
    if (!prefs) {
      setChosen(n); data.setMinutes(n); setSaving('local');
      try { window.localStorage.setItem(LENGTH_KEY, keepLength(deviceDay(), n)); } catch { /* tonight only */ }
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
  const papersData = data.papers.status === 'ready' ? data.papers.data : null;
  const reviseData = data.revise.status === 'ready' ? data.revise.data : null;
  const repairedData = data.repaired.status === 'ready' ? data.repaired.data : null;
  const everSessions = facts && Number.isInteger(facts.sessions) ? facts.sessions : data.rhythm.data?.counts?.sessions ?? null;
  const base = useMemo(() => buildMove({
    plan: data.plan.data,
    planFailed: data.plan.status === 'error',
    papers: papersData,
    rhythm: data.rhythm.data,
    revise: reviseData,
    facts,
    repaired: repairedData,
    top,
    subjectName,
    firstSubject: Array.isArray(user?.subjects) ? user.subjects[0] || null : null,
    premium: Boolean(user?.isPremium),
    minutes: chosen,
  }), [data.plan.data, data.plan.status, papersData, data.rhythm.data, reviseData, facts, repairedData, top, user?.subjects, user?.isPremium, chosen]);
  // The price before the press (W-060): a repair names its AI credit; Revise is free; a practice set or a full mock on a
  // free account names its practice credits and the balance (Pro includes both, so nothing is printed).
  const premium = Boolean(user?.isPremium);
  const balance = Number.isFinite(Number(user?.creditBalance)) ? Number(user.creditBalance) : null;
  const priceOf = useCallback((m) => {
    if (m.id === 'revise') return 'Free. No credits.';
    if (premium || m.aiEach || ['resume', 'check', 'done', 'plan'].includes(m.id) || (m.id === 'returning' && m.open > 0)) return null;
    const mock = m.kind === 'mock' || m.id === 'firstMock';
    const cost = (mock ? TEST_MODES.full : TEST_MODES.quick)?.creditCost;
    return cost > 0 ? usesLine({ what: mock ? 'This mock' : 'This set', cost, pool: 'practice', balance }) : null;
  }, [premium, balance]);
  const reviseSubjects = reviseData?.subjects;
  const finish = useCallback((m) => {
    if (!m || m.id === 'failed') return m;
    const fitted = refit(chosen ? fitMove(m, chosen) : m);
    // Revise names no one subject; the lead card shows the objects of the subjects whose questions come back today.
    const extra = fitted.id === 'revise' ? { subjects: (reviseSubjects || []).slice(0, 3), free: true } : {};
    const out = { ...fitted, ...extra, base: m, subjectName: fitted.subject ? subjectName(fitted.subject) : '', mockHref: firstTimedMockHref(facts?.subject || fitted.subject || null) };
    return { ...out, priceLine: priceOf(out) };
  }, [chosen, facts, reviseSubjects, priceOf]);
  const regular = useMemo(() => (base && base.id !== 'failed' ? finish(leadOf(base)) : base), [base, finish]);
  // The first week (release 8, FEATURE-ADOPTION item 7): a chained path, one feature a day, drawn as a rail on the lead card. Today's step
  // leads while it is undone and the product can do it now; the regular move waits among the choices. It never replaces a session waiting, a
  // check, "Done for tonight" or a failed read, and it is gone after day 7 or once every step is done (src/lib/today/firstWeek.mjs).
  const [nowMs] = useState(() => Date.now());
  const [planSaved, setPlanSaved] = useState(false); // Change plan finished on this page: the day 7 step is done at once
  const [planAsk, setPlanAsk] = useState(0); // the day 7 key asks Road to CUET to open Change plan
  const firstAt = data.rhythm.data?.milestones?.find?.((m) => m.id === 'first_scored_session')?.achievedAt ?? null;
  const repairsMade = Number.isInteger(data.rhythm.data?.counts?.repairs) ? data.rhythm.data.counts.repairs : Array.isArray(data.repairRows) ? data.repairRows.length : null;
  const weekdaysRead = data.goal.status === 'ready' ? data.goal.data?.weekdays ?? null : undefined;
  const roadRead = data.road.data ?? null;
  const daysRead = data.goal.data?.daysPerWeek ?? data.rhythm.data?.daysGoal ?? null;
  const path = useMemo(() => firstWeekPath({
    now: nowMs, firstAt, sessions: everSessions, papers: papersData, repaired: repairedData, repairs: repairsMade,
    mocks: facts && Number.isInteger(facts.mocks) ? facts.mocks : null, revise: reviseData, road: roadRead, weekdays: weekdaysRead, planSaved,
    subjects: Array.isArray(user?.subjects) ? user.subjects : null, top, facts, firstSubject: Array.isArray(user?.subjects) ? user.subjects[0] || null : null,
    premium: Boolean(user?.isPremium), length: chosen || 10, subjectName, daysPerWeek: daysRead, timeZone: data.rhythm.data?.timeZone || undefined,
  }), [nowMs, firstAt, everSessions, papersData, repairedData, repairsMade, facts, reviseData, roadRead, weekdaysRead, planSaved, user?.subjects, user?.isPremium, top, chosen, daysRead, data.rhythm.data?.timeZone]);
  const stepped = useMemo(() => (path?.move ? finish(path.move) : null), [path, finish]);
  const rec = useMemo(() => withFirstWeek(regular, stepped), [regular, stepped]);
  // The card lands once, not twice: while the reads that decide today's step are still on their way (Revise for day 2, the record for day 3, the
  // repairs for day 6, the road and the study days for day 7), the lead holds as loading, for at most 1.5 s; after that it shows what it can.
  const weekDay = firstWeekClock({ firstAt, sessions: everSessions, papers: papersData, now: nowMs }).day;
  const stepReads = { revise: [data.revise], aim: [insights], lab: [data.repaired], plan: [data.road, data.goal] }[stepOfDay(weekDay)] || [];
  const [waitedOut, setWaitedOut] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setWaitedOut(true), 1500);
    return () => window.clearTimeout(t);
  }, []);
  const holdForStep = !waitedOut && stepReads.some((r) => r.status === 'loading');
  // The other moves, each a whole move (Repair, Revise, the weakest chapter, a full mock, another subject).
  const subjects = user?.subjects;
  const pool = useMemo(() => (rec && rec.id !== 'failed' ? choiceMoves({
    papers: papersData, revise: reviseData, facts, repaired: repairedData, top, subjectName,
    subjects: Array.isArray(subjects) ? subjects : [], firstSubject: Array.isArray(subjects) ? subjects[0] || null : null, length: chosen || 10,
  }).map(finish) : []), [rec, papersData, reviseData, facts, repairedData, top, subjects, chosen, finish]);

  // The student's pick for today: kept in this tab for the day (a back navigation keeps it), written nowhere else.
  const tz = data.rhythm.data?.timeZone || 'Asia/Kolkata';
  const storeKey = useMemo(() => pickKey(todayKeyIn(tz)), [tz]);
  const [pickId, setPickId] = useState(null);
  const [out, setOut] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setPickId(readPick(storeKey)), 0);
    return () => window.clearTimeout(t);
  }, [storeKey]);
  const picked = rec && rec.id !== 'failed' && pickId && pickId !== rec.id ? pool.find((m) => m.id === pickId) || null : null;
  const lead = picked || rec;
  // "Why this?" on the lead card (ASK-MOBI-1018, owner D36): Mobi opens already on the card's own reason, with the plan's record
  // facts answered free. It follows the lead, so a swapped card asks about the swapped move.
  const askContext = useMemo(() => (lead && lead.id !== 'failed' ? todayContext({ move: lead, plan: data.plan.data }) : null), [lead, data.plan.data]);
  const choices = useMemo(() => {
    if (!lead || lead.id === 'failed') return [];
    return pickChoices(lead, picked ? [{ ...rec, suggested: true }, ...pool] : pool);
  }, [lead, picked, rec, pool]);
  const onPick = useCallback((id) => {
    const next = rec && id === rec.id ? null : id;
    const put = () => { setPickId(next); keepPick(storeKey, next); setOut(false); };
    if (reducedMotion()) { put(); return; }
    setOut(true);
    window.setTimeout(put, 150);
  }, [rec, storeKey]);

  // Failed only once every read the move needs has settled without one; while any is still on its way it is loading.
  const settled = [data.plan, data.papers, data.rhythm, data.facts].every((r) => r.status !== 'loading');
  const phase = holdForStep ? 'loading' : rec && rec.id !== 'failed' ? 'ready' : rec?.id === 'failed' || settled ? 'failed' : 'loading';
  // D29: after a fresh submission the paper's reel takes the lead's place once ("Play your paper back"), then Up next returns. The
  // paper is latched when the lead is ready, so the card stays for the visit (its own seen mark is written once it is on screen).
  const [reelId, setReelId] = useState(null);
  const [reelOver, setReelOver] = useState(false);
  const freshId = phase === 'ready' && !reelId ? freshPaper(papersData, nowMs)?.id || null : null;
  if (freshId && !reelSeen(readStorage(), freshId)) setReelId(freshId);
  const reelPaper = reelId && !reelOver ? (papersData || []).find((p) => p.id === reelId) || null : null;
  // The week, the road, the Mob row and the record rows land with the move, and wait for the Mob read when the Mob is on,
  // so no section arrives late and pushes another down (W-042).
  const landing = phase === 'loading' || (mobOn && userId && (mob.status === 'idle' || mob.status === 'loading'));
  const mobUnsat = mob.status === 'ready' && mob.mob?.week && !mob.mob.week.youSat && !mob.mob.week.closed && mob.mob.week.size > 1;
  const alts = useMemo(() => (lead && lead.id !== 'failed' ? buildAlternatives({
    move: lead, papers: papersData, revise: reviseData, facts, repaired: repairedData, mobUnsat, subjectName,
  }) : []), [lead, papersData, reviseData, facts, repairedData, mobUnsat]);

  const away = data.rhythm.data?.daysSinceLastActivity;
  const hello = greeting({ hour, name: user?.name, email: user?.email, returning: Number.isInteger(away) && away >= 7 });
  const dayOne = everSessions === 0;
  const word = hour >= 17 || hour < 4 ? 'Tonight’s move' : 'Today’s move';

  return (
    <div className="student-page student-page--today">
      <section className="pr ov today">
        <header className="today__head">
          <p className="today__date">{day ? <time>{day}</time> : ' '}</p>
          <h1 className="today__hello">{hello}</h1>
        </header>
        <div className="today-grid">
          <div className="today-grid__main">
            {reelPaper ? (
              <TodayReel paper={reelPaper} loadAttempt={data.loadAttempt} subjectName={subjectName} user={user} onDone={() => setReelOver(true)} />
            ) : (
              <TodayMove
                phase={phase} lead={lead} choices={choices} picked={Boolean(picked)} out={out} onPick={onPick}
                lengths={lengthsFor(lead?.base || lead)} chosen={chosen} onChoose={choose} saving={saving}
                alternatives={alts} word={word} slow={slow} triedAt={triedAt} onRetry={retry} askContext={askContext}
                path={phase === 'ready' ? path : null} onPlan={() => setPlanAsk((n) => n + 1)}
              />
            )}
            {phase !== 'failed' ? <TodayCue target="week" ready={phase === 'ready'} /> : null}
            <TodayWeak insights={insights} loadAttempt={data.loadAttempt} repairRows={data.repairRows} subjectName={subjectName} hold={landing} />
            {dayOne ? null : <TodayPaper papers={data.papers} loadAttempt={data.loadAttempt} subjectName={subjectName} repairRows={data.repairRows} hold={landing} />}
          </div>
          <div className="today-grid__side">
            <TodayWeek
              hold={landing} rhythm={data.rhythm} goal={data.goal} everSessions={everSessions}
              mobiFree={!(lead?.art === 'mobi') && phase !== 'failed'} mob={mob} repairs={data.repairRows} papers={data.papers}
              lead={phase === 'ready' ? lead : null} failed={phase === 'failed'} subjectName={subjectName} onRetry={data.retryWeek}
            />
            <TodayMob enabled={mobOn && !landing} mob={mob} />
            <TodayRoad
              hold={landing} road={data.road} goal={data.goal} rhythm={data.rhythm} facts={data.facts} revise={data.revise} papers={data.papers}
              lead={phase === 'ready' ? lead : null} onGoalSaved={data.retryWeek} planAsk={planAsk} onPlanSaved={() => setPlanSaved(true)}
            />
            <TodayQueue papers={data.papers} repaired={data.repaired} repairRows={data.repairRows} revise={data.revise} dayOne={dayOne} hold={landing} />
            <TodayColleges userId={userId} subjects={user?.subjects || []} hold={landing} />
          </div>
        </div>
      </section>
    </div>
  );
}
