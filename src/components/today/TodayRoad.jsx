"use client";
// Road to CUET on Today (owner, 18 Oct 3:30 am, D26: "respecting information like what's due today, what's due for the
// week, and showing the overall goal"; D27: unique and premium, never generic).
//
// One outlined block, read at a glance, top to bottom:
//   the goal's headline   "27 weeks to CUET UG", "Expected from Sat 1 May 2027. 94 study days at 4 a week."
//   the road              three stops side by side, each a count with its denominator drawn as its own stretch of road:
//                           Due today      1 of 2   one segment for each thing due today, filled when done
//                           This week      3 of 4   one segment for each planned study day (and this week's mock)
//                           Overall goal   2 of 14  one segment for each full mock of the target, filled when taken
//                         so the road runs near to far, and the student sees how much of each stretch is behind them.
//   the readout           the tapped stop's detail (today's by default), swapped in place under one sliding indicator,
//                         as the week does: today's items with their Start, the week's plan, the goal's pace, study
//                         days, next dated step and Change plan.
// Change plan stays one guided sentence (TodayPlanFlow), opened from the header and from the goal's readout; after a
// save a receipt line shows under the road.
// Reads: the exam date and mock target on the account (GET and PUT /api/me/road), the planned weekdays (the weekly goal,
// PUT /api/me/goal), the rhythm, today's Revise, the full mocks on the record. Unknown is never zero: a read that failed
// says so in words. Every date says "expected" until NTA publishes; nothing here predicts marks or chances, and a plan
// is never a debt.
import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Flag, SlidersHorizontal } from 'lucide-react';
import { api } from '@/lib/fetcher';
import { roadFigures, roadLayers, stripColumns, weekdayDay, shortDay } from '@/lib/today/road.mjs';
import { todayKeyIn } from '@/lib/today/week.mjs';
import { clock } from '@/lib/today/move.mjs';
import TodayPlanFlow from './TodayPlanFlow';

const JSON_HEADERS = { 'Content-Type': 'application/json' };
// 'Board exams ...' reads mid-sentence in lower case; an acronym ('CUET ...') keeps its capitals.
const lowerFirst = (t) => (/^[A-Z]{2}/.test(t) ? t : `${t.charAt(0).toLowerCase()}${t.slice(1)}`);
// Up to 16 things get a segment each; more (a target of 27 full mocks) are one continuous stretch filled to the share.
const MAX_SEGMENTS = 16;
const LONG_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** One stretch of road: `total` segments, the first `done` filled; `groups` splits it (study days, then a mock). */
function Stretch({ done, total, order, groups = null, flag = false }) {
  if (!(total > 0)) return <span className="trd__stretch" data-none aria-hidden="true"><i /></span>;
  const flagIcon = flag ? <Flag className="trd__flag" size={14} strokeWidth={2} /> : null;
  if (total > MAX_SEGMENTS) {
    const share = Math.min(1, Math.max(0, done) / total);
    return (
      <span className="trd__stretch" data-bar aria-hidden="true">
        <i>{share > 0 ? <b style={{ width: `${share * 100}%`, '--d': `${order * 90}ms` }} /> : null}</i>
        {flagIcon}
      </span>
    );
  }
  const n = total;
  const filled = Math.min(n, Math.max(0, done));
  const cut = groups ? new Set(groups) : null;
  return (
    <span className="trd__stretch" data-dense={n > 10 || undefined} aria-hidden="true">
      {Array.from({ length: n }, (_, k) => (
        <i key={k} data-on={k < filled || undefined} data-gap={cut?.has(k) || undefined} style={{ '--d': `${order * 90 + k * (n > 10 ? 16 : 30)}ms` }} />
      ))}
      {flagIcon}
    </span>
  );
}

function Stop({ id, index, selected, onSelect, label, figure, of, unit, stretch, aria }) {
  return (
    <li>
      <button type="button" className="trd__stop" id={`trd-stop-${id}`} aria-pressed={selected} aria-controls="trd-readout" onClick={() => onSelect(index)} aria-label={aria}>
        <span className="trd__label" aria-hidden="true">{label}</span>
        <span className="trd__fig" aria-hidden="true"><b>{figure}</b>{of ? <small>{of}</small> : null}</span>
        {stretch}
        <span className="trd__unit" aria-hidden="true">{unit}</span>
      </button>
    </li>
  );
}

/**
 * Reads: `road`, `goal`, `rhythm`, `facts`, `revise`, `papers` ({ status, data }). `lead`: the move on the card (it names
 * today's session, live with a swap). `hold`: the move is still on its way; the road keeps its place and lands with the
 * page (W-042).
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
  const dayOne = facts.status === 'ready' && facts.data?.sessions === 0;
  const layers = roadLayers({
    today, rhythm: rhythmNow, weekdays: goalData?.weekdays || null,
    revise: revise.status === 'ready' ? revise.data : null, move: lead, fig, target, taken, lastMockDay, firstDay: dayOne,
  });
  const [sel, setSel] = useState(0);
  const [swapKey, setSwapKey] = useState(0);
  const select = (i) => { setSel(i); setSwapKey((k) => k + 1); };
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
        <div className="trd__box" aria-hidden="true">
          <div className="trd__goal"><span className="trd__skl trd__skl--big" /><span className="trd__skl" /></div>
          <ol className="trd__stops">{[0, 1, 2].map((i) => <li key={i}><span className="trd__stop"><span className="trd__skl trd__skl--s" /><span className="trd__skl trd__skl--fig" /><span className="trd__stretch" data-none><i /></span></span></li>)}</ol>
          <div className="trd__readout"><span className="trd__skl" /><span className="trd__skl trd__skl--s" /></div>
        </div>
      </section>
    );
  }

  const { today: day, week, goal: g } = layers;
  const inWindow = g.phase === 'window';
  const year = g.exam.slice(0, 4);
  const examLine = g.own ? `Your date, ${weekdayDay(g.exam)} ${year}` : `Expected from ${weekdayDay(g.exam)} ${year}`;
  const paceWords = g.pace ? (g.pace.left === 0 ? 'target reached' : g.pace.strong ? g.pace.strong.replace(/^about /, '').replace(/ gets you there\.$/, '') : `${g.pace.left} to go`) : '';
  const nextLine = g.next ? `Next, ${g.next.when}: ${lowerFirst(g.next.title)}, ${weekdayDay(g.next.day)}.` : '';
  const days = g.studyDays != null && g.goal ? `${g.studyDays} study ${g.studyDays === 1 ? 'day' : 'days'} at ${g.goal} a week` : '';
  const todayName = `${LONG_DAYS[new Date(`${today}T00:00:00Z`).getUTCDay()]} ${shortDay(today)}`;
  const daysItem = week.items.find((i) => i.id === 'days');
  const mocksItem = week.items.find((i) => i.id === 'mocks');
  const weekUnit = mocksItem ? (mocksItem.total === 1 ? 'days and a mock' : 'days and mocks') : 'study days';

  // The three stops, near to far.
  const stops = [
    {
      id: 'today', label: 'Due today',
      figure: day.rest ? 'Rest' : day.done, of: day.rest ? '' : `of ${day.total}`, unit: day.rest ? 'nothing due' : 'done',
      stretch: <Stretch done={day.done} total={day.rest ? 0 : day.total} order={0} />,
      aria: `Due today: ${day.rest ? 'nothing, a rest day' : `${day.done} of ${day.total} done`}. ${day.left}`,
    },
    {
      id: 'week', label: 'This week',
      figure: week.total ? week.done : '?', of: week.total ? `of ${week.total}` : '', unit: weekUnit,
      stretch: <Stretch done={week.done} total={week.total} order={1} groups={daysItem && mocksItem ? [daysItem.total] : null} />,
      aria: `This week: ${week.total ? `${week.done} of ${week.total} planned done` : 'your weekly goal did not load'}. ${week.line}`,
    },
    {
      id: 'goal', label: 'Overall goal',
      figure: inWindow ? 'Now' : taken == null ? target : taken, of: inWindow || taken == null ? '' : `of ${target}`, unit: inWindow ? 'the window is open' : taken == null ? 'full mocks planned' : 'full mocks',
      stretch: <Stretch done={taken ?? 0} total={inWindow ? 0 : target} order={2} flag />,
      aria: `Overall goal: ${taken == null ? `${target} full mocks planned; your full mocks did not load` : `${taken} of ${target} full mocks`}${plan.mockTarget == null ? ', suggested' : ''}. ${inWindow ? 'The CUET UG window is open.' : `${g.count} ${g.unit} to CUET UG. ${examLine}.`}`,
    },
  ];
  const stop = stops[sel];

  let readout;
  if (stop.id === 'today') {
    readout = (
      <>
        <h3>Today, {todayName}</h3>
        {day.items.length ? (
          <ul className="trd__items">
            {day.items.map((i) => (
              <li key={i.id} data-done={i.done || undefined}>
                <span className="trd__mark" aria-hidden="true">{i.done ? <Check size={13} strokeWidth={2.6} /> : null}</span>
                <span className="trd__item-t"><b>{i.title}</b><span>{i.done ? (i.id === 'revise' ? `${i.detail}, done` : i.detail) : i.detail}</span></span>
                {!i.done && i.href ? <Link className="tm__pill trd__go" href={i.href}>{i.id === 'revise' ? 'Revise now' : 'Start'}</Link> : null}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="trd__note">{day.items.some((i) => i.id === 'session' && i.done) ? 'Today already counts toward your week.' : day.rest ? 'Your plan rests today. A session still counts toward the week.' : 'Today counts once a session is saved. Any length counts.'}</p>
      </>
    );
  } else if (stop.id === 'week') {
    readout = (
      <>
        <h3>{week.end === today ? 'This week' : `This week, to ${weekdayDay(week.end)}`}</h3>
        {week.items.length ? (
          <ul className="trd__items">
            {week.items.map((i) => (
              <li key={i.id} data-done={i.done >= i.total || undefined}>
                <span className="trd__mark" aria-hidden="true">{i.done >= i.total ? <Check size={13} strokeWidth={2.6} /> : null}</span>
                <span className="trd__item-t"><b>{i.title}</b><span>{i.done} of {i.total}{i.id === 'days' ? ' this week' : ' planned this week'}</span></span>
              </li>
            ))}
          </ul>
        ) : <p className="trd__note">Your weekly goal did not load.</p>}
        <p className="trd__note">{week.line}</p>
        {week.nextMock ? <p className="trd__note">Your next full mock falls in the week of {shortDay(week.nextMock)}, at {paceWords || 'your pace'}.</p> : null}
        {week.extraMocks > 0 ? <p className="trd__note">{week.extraMocks} more full {week.extraMocks === 1 ? 'mock' : 'mocks'} than planned this week. Extra is extra.</p> : null}
        <p className="trd__note">Any day you practise counts, planned or not. <Link className="tm__inline trd__nowrap" href="/progress">Your weeks</Link></p>
      </>
    );
  } else {
    readout = (
      <>
        <h3>{inWindow ? 'The CUET UG window is open' : `To CUET UG, ${weekdayDay(g.exam)} ${year}${g.own ? '' : ', expected'}`}</h3>
        {inWindow ? <p className="trd__note">Each paper now is the last practice before yours.</p> : (
          <>
            <p className="trd__note">
              {taken == null ? 'Your full mocks did not load. ' : <><b>{taken} of {target} full mocks</b>{plan.mockTarget == null ? ', suggested' : ''}. </>}
              {g.pace && taken != null ? <>{g.pace.text} <b>{g.pace.strong}</b></> : null}
            </p>
            {days ? <p className="trd__note"><b>{days}.</b> Board weeks count as 2.</p> : null}
            {g.next ? <p className="trd__note"><b>{nextLine}</b> {g.next.note}</p> : null}
            {g.own ? null : <p className="trd__note">NTA has not published the {year} dates yet.</p>}
            {dayOne ? <p className="trd__note">Set your date and days. It takes three taps.</p> : null}
          </>
        )}
        <button type="button" className="tm__pill trd__plan" aria-haspopup="dialog" onClick={() => setFlow(1)}><SlidersHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />Change plan</button>
      </>
    );
  }

  return (
    <section className="trd" id="road" aria-labelledby="trd-h">
      {header}
      <div className="trd__box">
        <div className="trd__goal">
          {inWindow ? (
            <p className="trd__weeks"><b>Now</b><span>the CUET UG window is open</span></p>
          ) : (
            <p className="trd__weeks"><b>{g.count}</b><span>{g.unit} to {g.own ? 'your date' : 'CUET UG'}</span></p>
          )}
          <p className="trd__when">{examLine}.{days ? <> <span className="trd__nowrap">{days}.</span></> : null}</p>
        </div>
        <div className="trd__road" style={{ '--sel': sel }}>
          <span className="trd__sel" aria-hidden="true" />
          <ol className="trd__stops" aria-label="Your road, near to far">
            {stops.map((s, i) => <Stop key={s.id} {...s} index={i} selected={i === sel} onSelect={select} />)}
          </ol>
        </div>
        <div className="trd__readout" id="trd-readout" key={swapKey} data-swap={swapKey > 0 || undefined} aria-live="polite">
          {readout}
        </div>
      </div>
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
