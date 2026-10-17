"use client";
// Road to May on Today (TODAY-1017 4.4): the whole road as one strip, every week to the exam visible at once, and
// editable where it sits. The CUET flag drags (or opens the date sheet on a tap); a week opens the detailed rail in
// place; the two value tokens ("4 a week", "14 full mocks") open their tuners inline, one at a time.
// The exam date and mock target live on the account (GET and PUT /api/me/road, P0). Until that migration is applied
// the road counts to the expected window with a suggested target, and the date and target say "Set on the app for now".
// The study days a week are the account's weekly goal (PUT /api/me/goal), which the week above shares.
// Nothing here predicts marks or chances; every date says "expected" until NTA publishes.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronsUpDown, Minus, Plus } from 'lucide-react';
import { api } from '@/lib/fetcher';
import { WEEKDAY_SHORT } from '@/lib/studyWeekdays.mjs';
import {
  addDays, boardsSpan, cuetDates, daysBetween, roadFigures, shortDay, snapExamDay, stripColumns, weekdayDay,
  MOCK_TARGET_MAX, MOCK_TARGET_MIN,
} from '@/lib/today/road.mjs';
import { dayList, todayKeyIn } from '@/lib/today/week.mjs';
import TodaySheet from './TodaySheet';

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const pct = (n) => `${(n * 100).toFixed(3)}%`;

function Token({ children, onClick, open, disabled, label, controls }) {
  return (
    <button type="button" className="trd__token" onClick={onClick} aria-expanded={open} aria-controls={controls} disabled={disabled} aria-label={label}>
      <span>{children}</span><ChevronsUpDown size={15} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

function Pips({ n, counted = 0 }) {
  return (
    <span className="trd__pips" aria-hidden="true">
      {Array.from({ length: n }, (_, k) => <i key={k} data-on={k < counted || undefined} />)}
    </span>
  );
}

/** The detailed rail, opened in place: 48 px weeks to the exam, scrolled to the week tapped, with that week's readout. */
function Rail({ columns, picked, onPick, onDone, thisWeekDone, goal }) {
  const listRef = useRef(null);
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-i="${picked}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'auto' });
  }, [picked]);
  const c = columns[picked] || columns[0];
  const read = c.current
    ? `This week: ${thisWeekDone ?? 0} of ${goal ?? c.planned} study days done.`
    : `Week of ${shortDay(c.key)}: ${c.planned} study ${c.planned === 1 ? 'day' : 'days'} planned${c.boards ? ', a boards week' : ''}${c.registration ? ', registration expected to open' : ''}${c.exam ? ', your exam week' : ''}.`;
  return (
    <div className="trd__rail">
      <ol ref={listRef} className="trd__rail-list" aria-label="Weeks to your exam">
        {columns.map((col, i) => (
          <li key={col.key}>
            <button type="button" data-i={i} className="trd__rail-week" aria-pressed={i === picked} data-current={col.current || undefined} data-boards={col.boards || undefined} onClick={() => onPick(i)} aria-label={`Week of ${shortDay(col.key)}, ${col.planned} study days planned`}>
              <Pips n={col.planned} counted={col.counted} />
              <span className="trd__rail-date">{col.current ? 'This week' : shortDay(col.key)}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="trd__rail-foot">
        <p className="trd__readout" role="status">{read}</p>
        <button type="button" className="trd__done" onClick={onDone}>Done</button>
      </div>
    </div>
  );
}

function PaceTuner({ goal, weekdays, status, onPick }) {
  const days = Array.isArray(weekdays) && weekdays.length === goal ? `${dayList(weekdays.map((d) => WEEKDAY_SHORT[d]))}.` : 'Which days is yours to pick.';
  return (
    <div className="trd__tuner">
      <div className="trd__stops" role="radiogroup" aria-label="Study days a week">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={n === goal} className="trd__stop" disabled={status === 'saving'} onClick={() => onPick(n)}>{n}</button>
        ))}
      </div>
      <p className="trd__note" role="status">
        {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved.' : status === 'failed' ? `Not saved. Still ${goal} a week.` : <>{days} <Link className="tm__inline" href="/profile#goal">Change days</Link></>}
      </p>
    </div>
  );
}

function MockTuner({ value, taken, status, onChange, onCommit, disabled }) {
  return (
    <div className="trd__tuner">
      <div className="trd__ruler">
        <button type="button" className="trd__step" aria-label="One fewer full mock" disabled={disabled || value <= MOCK_TARGET_MIN} onClick={() => onCommit(value - 1)}><Minus size={18} strokeWidth={2} aria-hidden="true" /></button>
        <input type="range" className="trd__range" min={MOCK_TARGET_MIN} max={MOCK_TARGET_MAX} value={value} disabled={disabled}
          aria-label="Full mocks before your date" aria-valuetext={`${value} full mocks`}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerUp={(e) => onCommit(Number(e.currentTarget.value))}
          onKeyUp={(e) => onCommit(Number(e.currentTarget.value))} />
        <button type="button" className="trd__step" aria-label="One more full mock" disabled={disabled || value >= MOCK_TARGET_MAX} onClick={() => onCommit(value + 1)}><Plus size={18} strokeWidth={2} aria-hidden="true" /></button>
      </div>
      <p className="trd__note" role="status">
        {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved.' : status === 'failed' ? 'Not saved. Your target is unchanged.' : taken != null ? <><Link className="tm__inline" href="/review">{taken} taken</Link> so far, a fresh paper from the bank each time.</> : 'A fresh paper from the bank each time.'}
      </p>
    </div>
  );
}

function DateSheet({ open, onClose, today, exam, own, onSave }) {
  const dates = cuetDates(Number(exam.slice(0, 4)));
  const [value, setValue] = useState(exam);
  return (
    <TodaySheet open={open} onClose={onClose} id="trd-date" title="Your exam date" lede={`CUET UG is expected from ${shortDay(dates.windowStart)} ${dates.year}. Set your own day if you know it.`}>
      <form className="trd__date" onSubmit={(e) => { e.preventDefault(); onSave(value); onClose(); }}>
        <label className="trd__date-field"><span>Day</span><input type="date" value={value} min={addDays(today, 1)} max={dates.latest} onChange={(e) => setValue(e.target.value)} required /></label>
        <div className="trd__date-keys">
          <button type="submit" className="tm__pill tm__pill--solid">Save this date</button>
          {own ? <button type="button" className="tm__pill" onClick={() => { onSave(null); onClose(); }}>Use the expected date</button> : null}
        </div>
      </form>
    </TodaySheet>
  );
}

export default function TodayRoad({ road, goal, rhythm, facts, onGoalSaved }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const tz = rhythm.data?.timeZone || 'Asia/Kolkata';
  const today = useMemo(() => todayKeyIn(tz), [tz]);
  const onAccount = road.status === 'ready' && road.data?.onAccount === true;
  // What the account holds, then what the student set on this visit (kept after a confirmed save only).
  const [saved, setSaved] = useState(null);
  const plan = saved || (road.status === 'ready' ? road.data : null) || { examDate: null, mockTarget: null };
  const [draft, setDraft] = useState(null); // the exam day while the flag is dragged
  const goalDays = goal.status === 'ready' ? goal.data.daysPerWeek : null;
  const [goalOverride, setGoalOverride] = useState(null);
  const goalNow = goalOverride ?? goalDays;
  const taken = facts.status === 'ready' && Number.isInteger(facts.data?.mocks) ? facts.data.mocks : null;
  const fig = roadFigures({ today, plan: draft ? { ...plan, examDate: draft } : plan, goal: goalNow, taken });
  const dates = fig.dates;
  const columns = useMemo(() => stripColumns({ today, exam: fig.exam, end: fig.phase === 'weeks' ? dates.latest : fig.exam, goal: goalNow, counted: rhythm.data?.studyDays || 0, daysMode: fig.phase === 'days' }), [today, fig.exam, fig.phase, dates.latest, goalNow, rhythm.data?.studyDays]);
  const span = boardsSpan(columns);
  const N = columns.length;
  const unit = fig.phase === 'days' ? 1 : 7;
  const first = columns[0]?.key || today;
  const examAt = (daysBetween(first, fig.exam) + 0.5) / (N * unit);

  const [panel, setPanel] = useState(null); // 'pace' | 'mocks' | 'rail'
  const [picked, setPicked] = useState(0);
  const [dateStatus, setDateStatus] = useState(null); // { kind: 'saving'|'saved'|'failed', day }
  const [paceStatus, setPaceStatus] = useState('');
  const [mockStatus, setMockStatus] = useState('');
  const [mockDraft, setMockDraft] = useState(null);
  const [dateSheet, setDateSheet] = useState(false);
  const target = mockDraft ?? plan.mockTarget ?? fig.suggested;

  const saveRoad = useCallback(async (body) => {
    const next = await api('/api/me/road', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(body) });
    setSaved({ examDate: next.examDate, mockTarget: next.mockTarget, onAccount: true });
    return next;
  }, []);

  const saveDate = useCallback(async (day) => {
    setDateStatus({ kind: 'saving', day });
    try {
      await saveRoad({ examDate: day });
      setDateStatus({ kind: 'saved', day });
    } catch {
      setDateStatus({ kind: 'failed', day });
    } finally { setDraft(null); }
  }, [saveRoad]);

  // The flag: 1:1 with the pointer along a scale that does not change while it moves; a tap opens the date sheet.
  const stripRef = useRef(null);
  const drag = useRef(null);
  const canDrag = onAccount && fig.phase === 'weeks';
  // Relative to where the flag was picked up, so grabbing the pill off its stem never jumps the date to the pointer.
  const dayAt = (clientX) => {
    const rect = stripRef.current.getBoundingClientRect();
    const d = drag.current;
    const at = d ? d.at + (clientX - d.x) / rect.width : (clientX - rect.left) / rect.width;
    const frac = Math.min(1, Math.max(0, at));
    return snapExamDay(addDays(first, Math.floor(frac * N * unit)), today);
  };
  const onFlagDown = (e) => {
    if (e.button != null && e.button !== 0) return;
    drag.current = { x: e.clientX, at: examAt, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onFlagMove = (e) => {
    if (!drag.current || !canDrag) return;
    if (!drag.current.moved && Math.abs(e.clientX - drag.current.x) < 4) return;
    drag.current.moved = true;
    setDraft(dayAt(e.clientX));
  };
  const onFlagUp = (e) => {
    const d = drag.current;
    if (!d) return;
    const day = d.moved ? dayAt(e.clientX) : null; // read while the pickup point is still known
    drag.current = null;
    if (!d.moved) { if (onAccount) setDateSheet(true); return; }
    if (day === (plan.examDate || dates.windowStart)) { setDraft(null); return; }
    saveDate(day === dates.windowStart ? null : day);
  };
  const keyTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(keyTimer.current), []);
  const onFlagKey = (e) => {
    if (!canDrag) { if (onAccount && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setDateSheet(true); } return; }
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 7, PageDown: -7 }[e.key];
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDateSheet(true); return; }
    if (!step && e.key !== 'Home') return;
    e.preventDefault();
    const base = draft || fig.exam;
    const day = e.key === 'Home' ? dates.windowStart : snapExamDay(addDays(base, step), today);
    setDraft(day);
    window.clearTimeout(keyTimer.current);
    keyTimer.current = window.setTimeout(() => saveDate(day), 700);
  };

  const openRailAt = (clientX) => {
    const rect = stripRef.current.getBoundingClientRect();
    const i = Math.min(N - 1, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * N)));
    const lastExam = columns.findIndex((c) => c.exam);
    setPicked(Math.min(i, lastExam >= 0 ? lastExam : i));
    setPanel('rail');
  };

  const pickPace = async (n) => {
    if (n === goalNow) return;
    const prev = goalNow;
    setGoalOverride(n);
    setPaceStatus('saving');
    try {
      await api('/api/me/goal', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ daysPerWeek: n }) });
      setPaceStatus('saved');
      onGoalSaved?.();
    } catch {
      setGoalOverride(prev);
      setPaceStatus('failed');
    }
  };

  const commitMocks = async (n) => {
    const v = Math.min(MOCK_TARGET_MAX, Math.max(MOCK_TARGET_MIN, n));
    setMockDraft(v);
    if (v === plan.mockTarget) return;
    setMockStatus('saving');
    try { await saveRoad({ mockTarget: v }); setMockStatus('saved'); setMockDraft(null); }
    catch { setMockStatus('failed'); setMockDraft(null); }
  };

  const toggle = (name) => { setPanel((p) => (p === name ? null : name)); setPaceStatus(''); setMockStatus(''); };

  if (fig.phase === 'window') {
    return (
      <section className="trd" id="road" aria-labelledby={`${id}-h`}>
        <header className="tg__row"><h2 id={`${id}-h`} className="tg__h">Road to May</h2></header>
        <p className="trd__window">The CUET UG window is expected to run {shortDay(dates.windowStart)} to {shortDay(dates.windowEnd)}. Each paper you sit now is the last practice before yours.</p>
      </section>
    );
  }

  const examLabel = fig.own ? `Your date, ${shortDay(fig.exam)}` : `CUET UG, ${shortDay(fig.exam)}`;
  const examCol = columns.findIndex((c) => c.exam);
  const regCol = columns.findIndex((c) => c.registration);
  const flagSide = examAt > 0.72 ? 'end' : examAt < 0.2 ? 'start' : 'mid';
  const weeksWord = fig.phase === 'days' ? `${fig.days}` : `${fig.weeks}`;
  // "before your date, 7 taken" once there is a target; day one says "suggested" and leaves out "0 taken".
  const mockTail = `${plan.mockTarget == null ? ', suggested' : ''}${taken ? `, ${taken} taken` : ''}`;
  return (
    <section className="trd" id="road" aria-labelledby={`${id}-h`}>
      <header className="tg__row">
        <h2 id={`${id}-h`} className="tg__h">Road to May</h2>
        <p className="tg__fig"><b>{weeksWord}</b><span>{fig.phase === 'days' ? 'days' : fig.weeks === 1 ? 'week' : 'weeks'} to {fig.own ? 'your date' : 'CUET UG'}</span></p>
      </header>

      <div className="trd__strip" ref={stripRef} style={{ '--n': N }} data-dragging={draft ? 'true' : undefined}>
        <div className="trd__lane-flag">
          <span className="trd__stem" style={{ left: pct(examAt) }} aria-hidden="true" />
          <div
            className="trd__flag" data-side={flagSide} data-draggable={canDrag || undefined}
            style={{ left: pct(examAt) }}
            role="slider" tabIndex={0}
            aria-label="Your exam date"
            aria-valuemin={0} aria-valuemax={daysBetween(today, dates.latest)} aria-valuenow={fig.days}
            aria-valuetext={`${weekdayDay(fig.exam)} ${fig.exam.slice(0, 4)}, ${fig.weeks} weeks away${fig.own ? '' : ', expected'}`}
            aria-readonly={!onAccount || undefined}
            onPointerDown={onFlagDown} onPointerMove={onFlagMove} onPointerUp={onFlagUp} onPointerCancel={() => { drag.current = null; setDraft(null); }}
            onKeyDown={onFlagKey}
          >
            {canDrag ? <span className="trd__grip" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span> : null}
            <span>{examLabel}</span>
          </div>
        </div>
        <div className="trd__lane-bands" aria-hidden="true">
          {regCol >= 0 ? <span className="trd__reg" style={{ left: pct((regCol + 0.5) / N) }}><span>Registration</span></span> : null}
          {span ? <span className="trd__boards" style={{ left: pct(span.first / N), width: pct((span.last - span.first + 1) / N) }}><span>Boards</span></span> : null}
        </div>
        <button type="button" className="trd__weeks" onClick={(e) => openRailAt(e.clientX || (stripRef.current.getBoundingClientRect().left + 1))} aria-label={`${fig.phase === 'days' ? 'Days' : 'Weeks'} to your exam. Open them week by week.`} aria-expanded={panel === 'rail'}>
          {columns.map((c, k) => (
            <span key={c.key} className="trd__col" style={{ '--k': k }} data-current={c.current || undefined} data-after={c.after || undefined} data-exam={c.exam || undefined} data-boards={c.boards || undefined}>
              <Pips n={c.planned} counted={c.counted} />
            </span>
          ))}
        </button>
        <div className="trd__lane-months" aria-hidden="true">
          {columns.map((c, i) => (c.month ? <span key={c.key} style={{ left: pct(i / N) }}>{c.month}</span> : null))}
        </div>
      </div>

      {dateStatus ? (
        <p className="trd__receipt" role="status">
          {dateStatus.kind === 'saving' ? 'Saving your date…'
            : dateStatus.kind === 'failed' ? <>Your date was not saved, so the road still counts to {shortDay(fig.exam)}. <button type="button" className="tm__inline" onClick={() => saveDate(dateStatus.day)}>Try again</button></>
              : dateStatus.day ? <>Your date: {weekdayDay(dateStatus.day)}. Saved. <button type="button" className="tm__inline" onClick={() => saveDate(null)}>Use the expected date</button></>
                : <>Counting to the expected date, {weekdayDay(dates.windowStart)}. Saved.</>}
        </p>
      ) : null}

      <div className="trd__tokens">
        {goal.status === 'error' && goalNow == null ? (
          // A failed goal read is said once, with a way back; never a skeleton that waits forever.
          <p className="trd__line">Your study days a week did not load. <button type="button" className="tm__inline" onClick={onGoalSaved}>Try again</button></p>
        ) : (
          <p className="trd__line">
            {fig.studyDays != null ? <><b className="trd__num">{fig.studyDays}</b> study days at </> : <span className="trd__wait" aria-hidden="true" />}
            <Token onClick={() => toggle('pace')} open={panel === 'pace'} controls={`${id}-pace`} disabled={goalNow == null} label={`Study days a week, ${goalNow ?? 'loading'}`}>{goalNow ?? '…'} a week</Token>
          </p>
        )}
        <p className="trd__line">
          <Token onClick={() => toggle('mocks')} open={panel === 'mocks'} controls={`${id}-mocks`} disabled={!onAccount} label={`Full mocks before your date, ${target}${mockTail}`}>{target} full mocks</Token>
          {' '}before your date{mockTail}
        </p>
        {road.status === 'error' ? <p className="trd__note">Your saved date and mock target did not load, so the expected date is shown.</p>
          : !onAccount && road.status !== 'loading' ? <p className="trd__note">Your date and mock target are set on the app for now.</p> : null}
      </div>

      <div className="trd__panel" data-open={panel ? 'true' : 'false'}>
        <div className="trd__panel-in" id={panel === 'pace' ? `${id}-pace` : panel === 'mocks' ? `${id}-mocks` : undefined}>
          {panel === 'pace' && goalNow != null ? <PaceTuner goal={goalNow} weekdays={goalOverride == null ? goal.data?.weekdays : null} status={paceStatus} onPick={pickPace} /> : null}
          {panel === 'mocks' ? <MockTuner value={target} taken={taken} status={mockStatus} onChange={setMockDraft} onCommit={commitMocks} disabled={!onAccount || mockStatus === 'saving'} /> : null}
          {panel === 'rail' ? <Rail columns={columns.slice(0, examCol + 1)} picked={Math.min(picked, examCol)} onPick={setPicked} onDone={() => setPanel(null)} thisWeekDone={rhythm.data?.studyDays} goal={goalNow} /> : null}
        </div>
      </div>
      {onAccount ? <DateSheet key={`${fig.exam}-${dateSheet}`} open={dateSheet} onClose={() => setDateSheet(false)} today={today} exam={fig.exam} own={fig.own} onSave={saveDate} /> : null}
    </section>
  );
}
