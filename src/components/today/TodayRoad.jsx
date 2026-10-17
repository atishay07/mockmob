"use client";
// Road to May on Today (TODAY-NIGHT-1017, replacing the 1017 strip after the owner's 17 Oct night review, N1).
// One plain readout a student reads top to bottom, no chart to decode:
//   29 weeks                      the countdown, with the date and the study days it leaves
//   This week   3 of 4            the week (TodayWeek, passed in as `week`), its marks and caption
//   Full mocks  7 of 14           one bar and the pace that gets there, in words
//   Coming up   in 15 weeks       the next dated step (registration, boards, the exam)
//   [Change plan]                 one sheet with three plain questions: the exam date, days a week, how many mocks
// Nothing was deleted: the drag flag became the date question, the pace tuner the days question, the mock slider three
// plain choices (and "Your own number" with a stepper), the boards and registration bands the Coming up line, and the
// week-by-week rail sits in the sheet under "See every week".
// The exam date and mock target live on the account (GET and PUT /api/me/road). Until that migration is applied the
// road counts to the expected window with a suggested target and says "set on the app for now".
// The study days a week are the account's weekly goal (PUT /api/me/goal), which the week shares.
// Nothing here predicts marks or chances; every date says "expected" until NTA publishes.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Minus, Plus, SlidersHorizontal } from 'lucide-react';
import { api } from '@/lib/fetcher';
import { WEEKDAY_SHORT } from '@/lib/studyWeekdays.mjs';
import {
  addDays, mockChoices, mockPace, nextMilestone, roadFigures, sessionsUntil, shortDay, stripColumns, weekdayDay,
  MOCK_TARGET_MAX, MOCK_TARGET_MIN,
} from '@/lib/today/road.mjs';
import { dayList, todayKeyIn } from '@/lib/today/week.mjs';
import TodaySheet from './TodaySheet';

const JSON_HEADERS = { 'Content-Type': 'application/json' };
// What each mock choice means, in a line (the count sits beside it).
const MOCK_WHY = {
  weekly: 'The most practice: a full paper every week.',
  fortnight: 'Suggested. Steady practice alongside your chapters.',
  monthly: 'Lighter: more of your time on chapters.',
};
const say = (status, { saving = 'Saving…', saved = 'Saved.', failed }) => (status === 'saving' ? saving : status === 'saved' ? saved : status === 'failed' ? failed : '');

function Pips({ n, counted = 0 }) {
  return (
    <span className="trd__pips" aria-hidden="true">
      {Array.from({ length: n }, (_, k) => <i key={k} data-on={k < counted || undefined} />)}
    </span>
  );
}

/** Every week to the exam, 48 px each, scrolled to this week, with the picked week's readout (the 1016 rail). */
function Rail({ columns, thisWeekDone, goal }) {
  const [picked, setPicked] = useState(0);
  const listRef = useRef(null);
  useEffect(() => {
    // Scroll the rail only (scrollIntoView would also slide the sheet sideways): centre the picked week in it.
    const list = listRef.current;
    const el = list?.querySelector(`[data-i="${picked}"]`)?.parentElement;
    if (list && el) list.scrollLeft = Math.max(0, el.offsetLeft - (list.clientWidth - el.offsetWidth) / 2);
  }, [picked]);
  const c = columns[picked] || columns[0];
  if (!c) return null;
  const read = c.current
    ? `This week: ${thisWeekDone ?? 0} of ${goal ?? c.planned} study days done.`
    : `Week of ${shortDay(c.key)}: ${c.planned} study ${c.planned === 1 ? 'day' : 'days'} planned${c.boards ? ', a boards week' : ''}${c.registration ? ', registration expected to open' : ''}${c.exam ? ', your exam week' : ''}.`;
  return (
    <div className="trd__rail">
      <ol ref={listRef} className="trd__rail-list" aria-label="Weeks to your exam">
        {columns.map((col, i) => (
          <li key={col.key}>
            <button type="button" data-i={i} className="trd__rail-week" aria-pressed={i === picked} data-current={col.current || undefined} data-boards={col.boards || undefined} onClick={() => setPicked(i)} aria-label={`Week of ${shortDay(col.key)}, ${col.planned} study days planned`}>
              <Pips n={col.planned} counted={col.counted} />
              <span className="trd__rail-date">{col.current ? 'This week' : shortDay(col.key)}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="trd__readout" role="status">{read}</p>
    </div>
  );
}

/** One question in the sheet: a heading, its choices, and one status line. */
function Ask({ id, title, children, status }) {
  return (
    <section className="tpq" aria-labelledby={id}>
      <h3 id={id} className="tpq__h">{title}</h3>
      {children}
      {status ? <p className="tpq__status" role="status">{status}</p> : null}
    </section>
  );
}

function PlanSheet({ open, onClose, today, fig, plan, onAccount, goalNow, weekdays, taken, target, columns, thisWeekDone, onDate, dateStatus, onPace, paceStatus, onMocks, mockStatus }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const dates = fig.dates;
  const [dateMode, setDateMode] = useState(fig.own ? 'own' : 'expected');
  const [dateValue, setDateValue] = useState(fig.own ? fig.exam : addDays(dates.windowStart, 7));
  const choices = useMemo(() => mockChoices({ weeks: fig.weeks, taken: taken ?? 0 }), [fig.weeks, taken]);
  const preset = choices.find((c) => c.value === target);
  const [own, setOwn] = useState(!preset);
  const [ownValue, setOwnValue] = useState(target);
  // The tapped choice shows as chosen at once; a refused save puts the saved target back.
  const [picked, setPicked] = useState(target);
  const checked = mockStatus === 'failed' ? target : picked;
  const [rail, setRail] = useState(false);
  const locked = !onAccount;
  // What each choice of days a week leaves before the date: the consequence beside the choice, not a sum to do.
  const left = (n) => sessionsUntil(today, fig.exam, n);
  const daysNamed = Array.isArray(weekdays) && weekdays.length === goalNow ? `${dayList(weekdays.map((d) => WEEKDAY_SHORT[d]))}.` : '';
  const examWord = fig.own ? `your date, ${weekdayDay(fig.exam)}` : `${weekdayDay(fig.exam)}`;

  return (
    <TodaySheet open={open} onClose={onClose} id="trd-plan" title="Your plan to May" lede="Three choices shape the road. Each one saves when you tap it, and you can change it any time.">
      <div className="tpq__list">
        <Ask id={`${id}-date`} title="When is your exam?" status={dateStatus ? say(dateStatus.kind, { saving: 'Saving your date…', saved: 'Saved.', failed: 'Not saved. Your date is unchanged.' }) : locked ? 'Your date is set on the app for now.' : ''}>
          <div className="tsh__options" role="radiogroup" aria-labelledby={`${id}-date`}>
            <button type="button" role="radio" aria-checked={dateMode === 'expected'} className="tsh__option" disabled={locked} onClick={() => { setDateMode('expected'); if (fig.own) onDate(null); }}>
              <b>The expected date</b>
              <span>CUET UG is expected from {weekdayDay(dates.windowStart)}. NTA has not published the 2027 dates yet.</span>
            </button>
            <button type="button" role="radio" aria-checked={dateMode === 'own'} className="tsh__option" disabled={locked} onClick={() => setDateMode('own')}>
              <b>My own date</b>
              <span>{fig.own ? `Set to ${weekdayDay(fig.exam)}.` : 'Once your admit card shows it.'}</span>
            </button>
          </div>
          {dateMode === 'own' && !locked ? (
            <form className="tpq__date" onSubmit={(e) => { e.preventDefault(); onDate(dateValue); }}>
              <label className="trd__date-field"><span>Day</span><input type="date" value={dateValue} min={addDays(today, 1)} max={dates.latest} onChange={(e) => setDateValue(e.target.value)} required /></label>
              <button type="submit" className="tm__pill tm__pill--solid" disabled={dateStatus?.kind === 'saving'}>Save this date</button>
            </form>
          ) : null}
        </Ask>

        <Ask id={`${id}-days`} title="How many days a week can you study?" status={say(paceStatus, { failed: `Not saved. Still ${goalNow} a week.` })}>
          <div className="trd__stops" role="radiogroup" aria-labelledby={`${id}-days`}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button key={n} type="button" role="radio" data-days={n} aria-checked={n === goalNow} aria-label={`${n} ${n === 1 ? 'day' : 'days'} a week`} className="trd__stop" disabled={goalNow == null || paceStatus === 'saving'} onClick={() => onPace(n)}>{n}</button>
            ))}
          </div>
          {goalNow != null ? (
            <p className="tpq__note"><b>{left(goalNow)} study days</b> before {examWord}. Board weeks count as 2. {daysNamed} <Link className="tm__inline" href="/profile#goal">{daysNamed ? 'Change days' : 'Choose which days'}</Link></p>
          ) : null}
        </Ask>

        <Ask id={`${id}-mocks`} title="How many full mocks before your exam?" status={say(mockStatus, { failed: 'Not saved. Your target is unchanged.' }) || (locked ? 'Your mock target is set on the app for now.' : '')}>
          <div className="tsh__options" role="radiogroup" aria-labelledby={`${id}-mocks`}>
            {choices.map((c) => (
              <button key={c.id} type="button" role="radio" data-mocks={c.id} aria-checked={!own && c.value === checked} className="tsh__option tsh__option--row" disabled={locked || mockStatus === 'saving'} onClick={() => { setOwn(false); setPicked(c.value); onMocks(c.value); }}>
                <span className="tsh__option-text"><b>{c.title}</b><span>{MOCK_WHY[c.id]}</span></span>
                <span className="tsh__option-fig"><b>{c.value}</b><small>full mocks</small></span>
              </button>
            ))}
            <button type="button" role="radio" data-mocks="own" aria-checked={own} className="tsh__option tsh__option--row" disabled={locked} onClick={() => { setOwn(true); setOwnValue(checked); }}>
              <span className="tsh__option-text"><b>Your own number</b><span>Anything from {MOCK_TARGET_MIN} to {MOCK_TARGET_MAX}.</span></span>
              {own ? <span className="tsh__option-fig"><b>{ownValue}</b><small>full mocks</small></span> : null}
            </button>
          </div>
          {own ? (
            <div className="tsh__stepper">
              <button type="button" className="trd__step" aria-label="One fewer full mock" disabled={locked || ownValue <= MOCK_TARGET_MIN} onClick={() => { const v = ownValue - 1; setOwnValue(v); onMocks(v); }}><Minus size={18} strokeWidth={2} aria-hidden="true" /></button>
              <output className="tsh__step-value" aria-live="polite">{ownValue} full mocks</output>
              <button type="button" className="trd__step" aria-label="One more full mock" disabled={locked || ownValue >= MOCK_TARGET_MAX} onClick={() => { const v = ownValue + 1; setOwnValue(v); onMocks(v); }}><Plus size={18} strokeWidth={2} aria-hidden="true" /></button>
            </div>
          ) : null}
          <p className="tpq__note">{taken != null ? <><Link className="tm__inline" href="/review">{taken} taken</Link> so far. </> : null}Every one is a fresh paper from the bank, so there is no limit on how many you sit.</p>
        </Ask>

        {columns.length > 1 ? (
          <section className="tpq">
            <button type="button" className="tm__pill tpq__more" aria-expanded={rail} onClick={() => setRail((v) => !v)}>{rail ? 'Hide the weeks' : 'See every week to your exam'}</button>
            {rail ? <Rail columns={columns} thisWeekDone={thisWeekDone} goal={goalNow} /> : null}
          </section>
        ) : null}
        {plan.mockTarget == null && !locked ? <p className="tpq__note">Until you choose, the road uses the suggested {fig.suggested}.</p> : null}
      </div>
    </TodaySheet>
  );
}

/** `week`: the This week block (TodayWeek), drawn as the readout's first row. */
export default function TodayRoad({ road, goal, rhythm, facts, onGoalSaved, week = null }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const tz = rhythm.data?.timeZone || 'Asia/Kolkata';
  const today = useMemo(() => todayKeyIn(tz), [tz]);
  const onAccount = road.status === 'ready' && road.data?.onAccount === true;
  // What the account holds, then what the student set on this visit (kept after a confirmed save only).
  const [saved, setSaved] = useState(null);
  const plan = saved || (road.status === 'ready' ? road.data : null) || { examDate: null, mockTarget: null };
  const goalDays = goal.status === 'ready' ? goal.data.daysPerWeek : null;
  const [goalOverride, setGoalOverride] = useState(null);
  const goalNow = goalOverride ?? goalDays;
  const taken = facts.status === 'ready' && Number.isInteger(facts.data?.mocks) ? facts.data.mocks : null;
  const fig = roadFigures({ today, plan, goal: goalNow, taken });
  const dates = fig.dates;
  const target = plan.mockTarget ?? fig.suggested;
  // Every week to the exam for the sheet's rail (at most about 40 entries, cheap to work out on each render).
  const columns = (() => {
    if (fig.phase === 'window') return [];
    const all = stripColumns({ today, exam: fig.exam, goal: goalNow, counted: rhythm.data?.studyDays || 0, daysMode: fig.phase === 'days' });
    const last = all.findIndex((c) => c.exam);
    return last >= 0 ? all.slice(0, last + 1) : all;
  })();

  const [sheet, setSheet] = useState(false);
  const [dateStatus, setDateStatus] = useState(null);
  const [paceStatus, setPaceStatus] = useState('');
  const [mockStatus, setMockStatus] = useState('');

  const saveRoad = useCallback(async (body) => {
    const next = await api('/api/me/road', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(body) });
    setSaved({ examDate: next.examDate, mockTarget: next.mockTarget, onAccount: true });
    return next;
  }, []);
  const saveDate = useCallback(async (day) => {
    setDateStatus({ kind: 'saving', day });
    try { await saveRoad({ examDate: day }); setDateStatus({ kind: 'saved', day }); } catch { setDateStatus({ kind: 'failed', day }); }
  }, [saveRoad]);
  const pickPace = async (n) => {
    if (n === goalNow) return;
    const prev = goalNow;
    setGoalOverride(n);
    setPaceStatus('saving');
    try {
      await api('/api/me/goal', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ daysPerWeek: n }) });
      setPaceStatus('saved');
      onGoalSaved?.();
    } catch { setGoalOverride(prev); setPaceStatus('failed'); }
  };
  // A rapid run of +/- taps saves once, after the last one: the number moves at once, the save follows it.
  const mockTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(mockTimer.current), []);
  const pickMocks = (n) => {
    const v = Math.min(MOCK_TARGET_MAX, Math.max(MOCK_TARGET_MIN, n));
    window.clearTimeout(mockTimer.current);
    mockTimer.current = window.setTimeout(async () => {
      if (v === plan.mockTarget) return;
      setMockStatus('saving');
      try { await saveRoad({ mockTarget: v }); setMockStatus('saved'); } catch { setMockStatus('failed'); }
    }, 350);
  };
  const openSheet = () => { setDateStatus(null); setPaceStatus(''); setMockStatus(''); setSheet(true); };

  if (fig.phase === 'window') {
    return (
      <section className="trd tp" aria-labelledby={`${id}-h`}>
        <header className="tg__row"><h2 id={`${id}-h`} className="tg__h">Road to May</h2></header>
        <p className="trd__window">The CUET UG window is expected to run {shortDay(dates.windowStart)} to {shortDay(dates.windowEnd)}. Each paper you sit now is the last practice before yours.</p>
        {week ? <div className="tp__row tp__row--week">{week}</div> : null}
      </section>
    );
  }

  const count = fig.phase === 'days' ? fig.days : fig.weeks;
  const unit = fig.phase === 'days' ? (fig.days === 1 ? 'day' : 'days') : (fig.weeks === 1 ? 'week' : 'weeks');
  const when = fig.own ? `to your exam, ${weekdayDay(fig.exam)}` : `to CUET UG, expected from ${weekdayDay(fig.exam)}`;
  const pace = mockPace({ target, taken, days: fig.days });
  const done = taken ?? 0;
  const fill = Math.min(1, target > 0 ? done / target : 0);
  const next = nextMilestone({ today, exam: fig.exam, own: fig.own, goal: goalNow });
  const savedNote = dateStatus?.kind === 'saved' && !sheet ? (dateStatus.day ? `Your date: ${weekdayDay(dateStatus.day)}. Saved.` : `Counting to the expected date, ${weekdayDay(dates.windowStart)}. Saved.`) : '';

  return (
    <section className="trd tp" aria-labelledby={`${id}-h`}>
      <header className="tg__row"><h2 id={`${id}-h`} className="tg__h">Road to May</h2></header>
      <p className="tp__count">
        <b>{count}</b><span className="tp__unit">{unit}</span>
        <span className="tp__when">{when}</span>
      </p>
      {goal.status === 'error' && goalNow == null ? (
        <p className="tp__sub">Your study days a week did not load. <button type="button" className="tm__inline" onClick={onGoalSaved}>Try again</button></p>
      ) : fig.studyDays != null ? (
        <p className="tp__sub"><b>{fig.studyDays} study days</b> left at {goalNow} a week.</p>
      ) : <p className="tp__sub"><span className="trd__wait" aria-hidden="true" /></p>}
      {savedNote ? <p className="tp__sub" role="status">{savedNote}</p> : null}

      <div className="tp__rows">
        {week ? <div className="tp__row tp__row--week">{week}</div> : null}

        <div className="tp__row">
          <div className="tp__line">
            <h3 className="tp__label">Full mocks</h3>
            <p className="tp__fig"><b>{done}</b><span>of {target}{plan.mockTarget == null ? ', suggested' : ''}</span></p>
          </div>
          <div className="tp__bar" role="img" aria-label={`${done} of ${target} full mocks taken`}><i style={{ transform: `scaleX(${fill})` }} /></div>
          <p className="tp__note">{pace.text}{pace.strong ? <> <b>{pace.strong}</b></> : null}</p>
        </div>

        {next ? (
          <div className="tp__row">
            <div className="tp__line">
              <h3 className="tp__label">Coming up</h3>
              <p className="tp__fig tp__fig--when"><span>{next.when}</span></p>
            </div>
            <p className="tp__title">{next.title}, {weekdayDay(next.day)}</p>
            <p className="tp__note">{next.note}</p>
          </div>
        ) : null}
      </div>

      {road.status === 'error' ? <p className="tp__note">Your saved date and mock target did not load, so the expected date is shown.</p> : null}
      <button type="button" className="tm__pill tp__change" aria-haspopup="dialog" onClick={openSheet}><SlidersHorizontal size={17} strokeWidth={1.75} aria-hidden="true" />Change plan</button>
      <PlanSheet
        key={sheet ? 'open' : 'closed'}
        open={sheet} onClose={() => setSheet(false)}
        today={today} fig={fig} plan={plan} onAccount={onAccount}
        goalNow={goalNow} weekdays={goalOverride == null ? goal.data?.weekdays : null}
        taken={taken} target={target} columns={columns} thisWeekDone={rhythm.data?.studyDays}
        onDate={saveDate} dateStatus={dateStatus} onPace={pickPace} paceStatus={paceStatus} onMocks={pickMocks} mockStatus={mockStatus}
      />
    </section>
  );
}

