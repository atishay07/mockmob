"use client";
// Road to CUET on Today, in three layers read at a glance (owner, 18 Oct 3:30 am, D26: "respecting information like
// what's due today, what's due for the week, and showing the overall goal"). One road, three stops on one line:
//   Due today       1 of 2      what is left today (the planned session and today's Revise), done over total
//   Due this week   4 of 5      the study days of the goal and this week's share of the mock target
//   Overall goal    27 weeks    full mocks over the target with the pace, and the next dated step
// Each stop opens in place to its detail (no new page). Change plan stays one guided sentence (TodayPlanFlow), opened
// from the header and from the goal's detail; after a save, a receipt line shows under the road.
// The exam date and mock target live on the account (GET and PUT /api/me/road, the study_goals columns); the planned
// weekdays are the weekly goal (PUT /api/me/goal), which the week shares. Every date says "expected" until NTA
// publishes; nothing here predicts marks or chances, and a plan is never a debt.
import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Plus, SlidersHorizontal } from 'lucide-react';
import { api } from '@/lib/fetcher';
import { roadFigures, roadLayers, stripColumns, weekdayDay, shortDay } from '@/lib/today/road.mjs';
import { todayKeyIn } from '@/lib/today/week.mjs';
import { clock } from '@/lib/today/move.mjs';
import TodayPlanFlow from './TodayPlanFlow';

const JSON_HEADERS = { 'Content-Type': 'application/json' };
// 'Board exams ...' reads mid-sentence in lower case; an acronym ('CUET ...') keeps its capitals.
const lowerFirst = (t) => (/^[A-Z]{2}/.test(t) ? t : `${t.charAt(0).toLowerCase()}${t.slice(1)}`);
const R = 17;
const C = 2 * Math.PI * R;

/** The stop's ring: the share done, drawn in ink on a quiet track; a full ring holds a tick. Never volt (one per view). */
function Ring({ done, total, kind }) {
  const share = total > 0 ? Math.min(1, done / total) : 0;
  const full = total > 0 && done >= total;
  return (
    <span className="trd__ring" data-kind={kind} data-full={full || undefined} data-none={!total || undefined} aria-hidden="true">
      <svg viewBox="0 0 40 40" focusable="false">
        <circle className="trd__track" cx="20" cy="20" r={R} />
        {total > 0 ? <circle className="trd__arc" cx="20" cy="20" r={R} style={{ '--len': C, '--off': C * (1 - share) }} /> : null}
      </svg>
      {full ? <Check className="trd__tick" size={16} strokeWidth={2.4} /> : null}
    </span>
  );
}

function Stop({ id, kind, open, onToggle, label, sub, figure, of, ring, children, aria }) {
  return (
    <li className="trd__stop" data-kind={kind} data-open={open || undefined}>
      <button type="button" className="trd__row" aria-expanded={open} aria-controls={`${id}-more`} onClick={onToggle} aria-label={aria}>
        {ring}
        <span className="trd__text" aria-hidden="true">
          <span className="trd__label">{label}</span>
          <span className="trd__sub">{sub}</span>
        </span>
        <span className="trd__fig" aria-hidden="true"><b>{figure}</b>{of ? <small>{of}</small> : null}</span>
        <Plus className="trd__plus" size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <div className="trd__more" id={`${id}-more`} data-open={open || undefined}>
        <div><div className="trd__detail">{children}</div></div>
      </div>
    </li>
  );
}

/**
 * Reads: `road`, `goal`, `rhythm`, `facts`, `revise`, `papers` ({ status, data }). `lead`: the move on the card (it names
 * today's session). `hold`: the move is still on its way; the road keeps its place and lands with the page (W-042).
 */
export default function TodayRoad({ road, goal, rhythm, facts, revise, papers, lead = null, onGoalSaved, hold = false }) {
  const tz = rhythm.data?.timeZone || 'Asia/Kolkata';
  const today = useMemo(() => todayKeyIn(tz), [tz]);
  const onAccount = road.status === 'ready' && road.data?.onAccount === true;
  const [saved, setSaved] = useState(null);
  const plan = saved || (road.status === 'ready' ? road.data : null) || { examDate: null, mockTarget: null };
  const [goalSaved, setGoalSaved] = useState(null);
  const goalData = goalSaved || (goal.status === 'ready' ? goal.data : null);
  const goalNow = goalData?.daysPerWeek ?? rhythm.data?.daysGoal ?? null;
  const taken = facts.status === 'ready' && Number.isInteger(facts.data?.mocks) ? facts.data.mocks : null;
  const fig = roadFigures({ today, plan, goal: goalNow, taken });
  const target = plan.mockTarget ?? fig.suggested;
  const lastMock = papers.status === 'ready' ? (papers.data || []).find((p) => ['full', 'nta'].includes(p?.mode)) : null;
  const lastMockDay = lastMock ? todayKeyIn(tz, Number(lastMock.completedAt)) : null;
  const rhythmNow = rhythm.data && goalSaved ? { ...rhythm.data, daysGoal: goalSaved.daysPerWeek } : rhythm.data;
  const layers = roadLayers({
    today, rhythm: rhythmNow, weekdays: goalData?.weekdays || null,
    revise: revise.status === 'ready' ? revise.data : null, move: lead, fig, target, taken, lastMockDay,
  });
  const [openStop, setOpenStop] = useState(null);
  const toggle = (k) => setOpenStop((v) => (v === k ? null : k));
  const [flow, setFlow] = useState(null); // the step Change plan opens on, or null
  const [receipt, setReceipt] = useState('');

  const saveRoad = useCallback(async (body) => {
    const next = await api('/api/me/road', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(body) });
    setSaved({ examDate: next.examDate, mockTarget: next.mockTarget, onAccount: true });
    return next;
  }, []);
  const saveDays = useCallback(async (weekdays) => {
    const next = await api('/api/me/goal', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ weekdays, daysPerWeek: weekdays.length }) });
    setGoalSaved({ ...(goal.data || {}), ...next, weekdays: next?.weekdays ?? weekdays, daysPerWeek: next?.daysPerWeek ?? weekdays.length });
    onGoalSaved?.();
    return next;
  }, [goal.data, onGoalSaved]);
  // The rail for "See every week" (at most about 40 entries, cheap on each render).
  const columns = (() => {
    if (fig.phase === 'window') return [];
    const all = stripColumns({ today, exam: fig.exam, goal: goalNow, counted: rhythm.data?.studyDays || 0, daysMode: fig.phase === 'days' });
    const last = all.findIndex((c) => c.exam);
    return last >= 0 ? all.slice(0, last + 1) : all;
  })();

  const header = (
    <header className="tg__row trd__head">
      <h2 id="trd-h" className="tg__h">Road to CUET</h2>
      <button type="button" className="tm__pill trd__change" aria-haspopup="dialog" onClick={() => setFlow(1)} disabled={hold || !layers}><SlidersHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />Change plan</button>
    </header>
  );

  if (hold || !layers) {
    if (rhythm.status === 'error' && !hold) {
      return (
        <section className="trd" id="road" aria-labelledby="trd-h">
          {header}
          <p className="trd__empty" role="status">Your road did not load. <button type="button" className="tm__inline" onClick={onGoalSaved}>Try again</button></p>
        </section>
      );
    }
    return (
      <section className="trd trd--wait" id="road" aria-labelledby="trd-h" aria-busy="true">
        {header}
        <ol className="trd__stops" aria-hidden="true">{[0, 1, 2].map((i) => <li key={i} className="trd__stop"><span className="trd__row"><span className="trd__ring" data-none /><span className="trd__text"><span className="trd__skl" /><span className="trd__skl trd__skl--s" /></span><span className="trd__skf" /></span></li>)}</ol>
      </section>
    );
  }

  const { today: day, week, goal: g } = layers;
  const dayOne = taken === 0 && (facts.data?.sessions ?? null) === 0;
  const examLine = g.own ? `Your date, ${weekdayDay(g.exam)} ${g.exam.slice(0, 4)}` : `Expected from ${weekdayDay(g.exam)} ${g.exam.slice(0, 4)}`;
  const paceWords = g.pace ? (g.pace.left === 0 ? 'target reached' : g.pace.strong ? g.pace.strong.replace(/ gets you there\.$/, '') : `${g.pace.left} to go`) : '';
  const mocksLine = taken == null ? 'Full mocks did not load' : `${taken} of ${target} full mocks${plan.mockTarget == null ? ', suggested' : `, ${paceWords}`}`;
  const nextLine = g.next ? `Next, ${g.next.when}: ${lowerFirst(g.next.title)}, ${weekdayDay(g.next.day)}.` : '';
  const weekSub = week.items.length ? week.items.map((i) => `${i.title.toLowerCase()} ${i.done} of ${i.total}`).join(', ') : 'Your weekly goal did not load';
  const weekSubCap = weekSub.charAt(0).toUpperCase() + weekSub.slice(1);

  return (
    <section className="trd" id="road" aria-labelledby="trd-h">
      {header}
      <ol className="trd__stops">
        <Stop
          id="trd-today" kind="today" open={openStop === 'today'} onToggle={() => toggle('today')}
          label="Due today" sub={day.left}
          figure={day.rest ? 'Rest' : day.done} of={day.rest ? 'day' : `of ${day.total}`}
          ring={<Ring done={day.done} total={day.total} kind="today" />}
          aria={`Due today: ${day.rest ? 'nothing, a rest day' : `${day.done} of ${day.total} done`}. ${day.left} Show the detail.`}
        >
          {day.items.length ? (
            <ul className="trd__items">
              {day.items.map((i) => (
                <li key={i.id} data-done={i.done || undefined}>
                  <span className="trd__mark" aria-hidden="true">{i.done ? <Check size={13} strokeWidth={2.6} /> : null}</span>
                  <span className="trd__item-t"><b>{i.title}</b><span>{i.done ? (i.id === 'revise' ? `${i.detail}, done` : i.detail) : i.detail}</span></span>
                  {!i.done && i.href ? <Link className="tm__inline trd__go" href={i.href}>{i.id === 'revise' ? 'Revise now' : 'Start'}</Link> : null}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="trd__note">{day.rest ? 'Your plan rests today. A session still counts toward the week.' : 'Today counts once a session is saved. Any length counts.'}</p>
        </Stop>

        <Stop
          id="trd-week" kind="week" open={openStop === 'week'} onToggle={() => toggle('week')}
          label="Due this week" sub={`${weekSubCap}. ${week.line}`}
          figure={week.done} of={`of ${week.total}`}
          ring={<Ring done={week.done} total={week.total} kind="week" />}
          aria={`Due this week: ${week.done} of ${week.total} planned done. ${weekSubCap}. ${week.line} Show the detail.`}
        >
          <ul className="trd__items">
            {week.items.map((i) => (
              <li key={i.id} data-done={i.done >= i.total || undefined}>
                <span className="trd__pips" aria-hidden="true">{Array.from({ length: Math.min(i.total, 7) }, (_, k) => <i key={k} data-on={k < i.done || undefined} />)}</span>
                <span className="trd__item-t"><b>{i.title}</b><span>{i.done} of {i.total}{i.id === 'days' ? ' this week' : ' planned this week'}</span></span>
              </li>
            ))}
          </ul>
          {week.nextMock ? <p className="trd__note">Your next full mock falls in the week of {shortDay(week.nextMock)}, at {paceWords || 'your pace'}.</p> : null}
          {week.extraMocks > 0 ? <p className="trd__note">{week.extraMocks} more full {week.extraMocks === 1 ? 'mock' : 'mocks'} than planned this week. Extra is extra.</p> : null}
          <p className="trd__note">Any day you practise counts, planned or not. <Link className="tm__inline" href="/progress">Your weeks</Link></p>
        </Stop>

        <Stop
          id="trd-goal" kind="goal" open={openStop === 'goal'} onToggle={() => toggle('goal')}
          label="Overall goal"
          sub={g.phase === 'window' ? 'The CUET UG window is open. Each paper now is the last practice before yours.' : <>{mocksLine}.{nextLine ? <span className="trd__next">{nextLine}</span> : null}</>}
          figure={g.phase === 'window' ? 'Now' : g.count} of={g.phase === 'window' ? '' : `${g.unit} to go`}
          ring={<Ring done={taken ?? 0} total={target} kind="goal" />}
          aria={`Overall goal: ${g.phase === 'window' ? 'the window is open' : `${g.count} ${g.unit} to CUET UG`}. ${mocksLine}. ${nextLine} Show the detail.`}
        >
          <p className="trd__date">{examLine}{g.own ? '' : `. NTA has not published the ${g.exam.slice(0, 4)} dates yet`}.</p>
          {taken != null ? (
            <div className="trd__mocks">
              <span className="trd__bar" aria-hidden="true">{Array.from({ length: Math.min(target, 30) }, (_, k) => <i key={k} data-on={k < taken || undefined} />)}</span>
              <p className="trd__note">{g.pace ? <>{g.pace.text} <b>{g.pace.strong}</b></> : null}{dayOne ? ' Set your date and days. It takes three taps.' : ''}</p>
            </div>
          ) : null}
          {g.studyDays != null ? <p className="trd__note"><b>{g.studyDays} study days</b> left at {g.goal} a week. Board weeks count as 2.</p> : null}
          {g.next ? <p className="trd__note"><b>{g.next.title}, {weekdayDay(g.next.day)}.</b> {g.next.note}</p> : null}
          <button type="button" className="tm__pill trd__plan" aria-haspopup="dialog" onClick={() => setFlow(1)}><SlidersHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />Change plan</button>
        </Stop>
      </ol>
      {road.status === 'error' ? <p className="trd__note trd__warn">Your saved date and mock target did not load, so the expected date is shown.</p> : null}
      {receipt ? <p className="trd__receipt" role="status">{receipt}</p> : null}
      <TodayPlanFlow
        key={flow ? `open-${flow}` : 'closed'}
        open={Boolean(flow)} onClose={() => setFlow(null)} startStep={flow || 1}
        today={today} plan={plan} weekdays={goalData?.weekdays || null} daysPerWeek={goalNow} taken={taken} onAccount={onAccount}
        columns={columns} thisWeekDone={rhythm.data?.studyDays ?? null}
        saveRoad={saveRoad} saveDays={saveDays}
        onDone={(s) => setReceipt(`Plan saved at ${clock(Date.now())}: ${s.weeks} ${s.weeks === 1 ? 'week' : 'weeks'}, ${s.days} ${s.days === 1 ? 'day' : 'days'} a week, ${s.target} full ${s.target === 1 ? 'mock' : 'mocks'}.`)}
      />
    </section>
  );
}
