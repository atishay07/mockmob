"use client";
// Change plan: a guided sentence, never a form (TODAY-1018 section 6.4, owner D3: "it should never look like just a basic
// form ... always leading and interactive UI which leads you to the next thing").
// One sentence with three answers as underlined tokens:
//   "I sit CUET UG on [Sat 1 May, expected], study [4 days] a week, and take [14 full mocks] before it."
// The current step's token is underlined in the accent; tapping any token jumps to its step. Under the sentence one
// question at a time slides in, and a live preview (weeks, study days, mocks to go and the pace) bumps each number that
// changes. Each answer saves when tapped ("Saving…", then "Saved." only after the server answers); a saved date leads
// to the next question 520 ms later. Back and Next stay. Step 3 ends on the volt Done.
// Saves: the date and the mock target to PUT /api/me/road (study_goals.exam_date, mock_target); the days to
// PUT /api/me/goal { weekdays, daysPerWeek }. Before the road columns exist (onAccount false) the date and target are
// read-only ("Set on the app for now") and the days still save.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Minus, Plus } from 'lucide-react';
import { WEEKDAY_SHORT } from '@/lib/studyWeekdays.mjs';
import {
  addDays, cuetDates, cuetYear, mockChoices, mockPace, sessionsUntil, shortDay, weekdayDay, roadFigures,
  MOCK_TARGET_MAX,
} from '@/lib/today/road.mjs';
import TodaySheet from './TodaySheet';

const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MOCK_WHY = {
  fortnight: 'Suggested. Steady practice alongside your chapters.',
  weekly: 'The most practice: a full paper every week.',
  monthly: 'Lighter: more of your time on chapters.',
};
const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced'; } catch { return false; } };

/** A number in the preview: keyed by its value, so a change remounts it and the bump plays once. */
function Bump({ value }) {
  return <b key={value} className="tpf__bump">{value}</b>;
}

function Calendar({ year, month, chosen, expected, min, max, onPick, onMonth }) {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const n = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const key = (d) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return (
    <div className="tpf__cal">
      <div className="tpf__cal-h">
        <span>{MONTHS_LONG[month]} {year}</span>
        <span className="tpf__cal-m" role="group" aria-label="Month">
          {[4, 5].map((m) => <button key={m} type="button" aria-pressed={m === month} onClick={() => onMonth(m)}>{MONTHS_LONG[m].slice(0, m === 5 ? 4 : 3)}</button>)}
        </span>
      </div>
      <div className="tpf__cal-g">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={`${d}${i}`} aria-hidden="true">{d}</span>)}
        {Array.from({ length: offset }, (_, i) => <span key={`o${i}`} />)}
        {Array.from({ length: n }, (_, i) => {
          const k = key(i + 1);
          const off = k < min || k > max;
          return (
            <button key={k} type="button" aria-pressed={chosen === k} data-expected={k === expected || undefined} disabled={off} aria-label={`${weekdayDay(k)}${k === expected ? ', the expected start' : ''}`} onClick={() => onPick(k)}>{i + 1}</button>
          );
        })}
      </div>
    </div>
  );
}

/** Every week to the exam, 48 px each, scrolled to this week, with the picked week's readout (the R4 rail, kept). */
function Rail({ columns, thisWeekDone, goal }) {
  const [picked, setPicked] = useState(0);
  const listRef = useRef(null);
  useEffect(() => {
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
              <span className="trd__pips" aria-hidden="true">{Array.from({ length: col.planned }, (_, k) => <i key={k} data-on={k < col.counted || undefined} />)}</span>
              <span className="trd__rail-date">{col.current ? 'This week' : shortDay(col.key)}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="trd__readout" role="status">{read}</p>
    </div>
  );
}

/**
 * `plan`: { examDate, mockTarget } on the account. `weekdays`: the planned days (0 = Monday) or null; `daysPerWeek` the
 * goal. `taken`: full mocks taken (null while unknown). `onAccount`: the road columns exist. `columns`: the rail.
 * `saveRoad(body)` and `saveDays(weekdays)` return promises that resolve only once the server has answered.
 * `onDone(summary)`: closed with Done after at least one save.
 */
export default function TodayPlanFlow({ open, onClose, startStep = 1, today, plan, weekdays, daysPerWeek, taken, onAccount, columns = [], thisWeekDone = null, saveRoad, saveDays, onDone }) {
  const dates = cuetDates(cuetYear(today));
  const [step, setStep] = useState(startStep);
  const [exam, setExam] = useState(plan.examDate || null); // null = the expected start
  const [days, setDays] = useState(() => (Array.isArray(weekdays) && weekdays.length ? [...weekdays] : defaultDays(daysPerWeek)));
  const savedDays = useRef(days);
  const fig = roadFigures({ today, plan: { examDate: exam }, goal: days.length, taken });
  const [target, setTarget] = useState(plan.mockTarget ?? fig.suggested);
  const savedTarget = useRef(target);
  const [ownOpen, setOwnOpen] = useState(Boolean(plan.examDate));
  const [month, setMonth] = useState(plan.examDate ? Number(plan.examDate.slice(5, 7)) - 1 : 4);
  const [status, setStatus] = useState('');
  const [anySaved, setAnySaved] = useState(false);
  const timers = useRef({});
  useEffect(() => () => Object.values(timers.current).forEach((t) => window.clearTimeout(t)), []);
  const locked = !onAccount;
  const floor = (Number(taken) || 0) + 1;
  const choices = useMemo(() => {
    const all = mockChoices({ weeks: fig.weeks, taken: taken ?? 0 });
    const order = ['fortnight', 'weekly', 'monthly'];
    return [...all].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  }, [fig.weeks, taken]);
  const isChoice = choices.some((c) => c.value === target);
  const pace = mockPace({ target, taken: taken ?? 0, days: fig.days });
  const paceWords = pace.left === 0 ? 'target reached' : pace.strong ? pace.strong.replace(/^about /, '').replace(/ gets you there\.$/, '') : `${pace.left} to go`;

  const lead = (to) => {
    window.clearTimeout(timers.current.lead);
    timers.current.lead = window.setTimeout(() => { setStep(to); setStatus(''); }, reduced() ? 0 : 520);
  };
  const go = (n) => { window.clearTimeout(timers.current.lead); setStep(n); setStatus(''); };

  const pickExam = async (day, { advance = true } = {}) => {
    if (locked) return;
    const before = exam;
    setExam(day);
    if ((day || null) === (plan.examDate || null) && !anySaved) { if (advance) lead(2); return; }
    setStatus('Saving…');
    try {
      await saveRoad({ examDate: day });
      setStatus('Saved.'); setAnySaved(true);
      if (advance) lead(2);
    } catch {
      setExam(before);
      setStatus('Not saved. Your date is unchanged.');
    }
  };

  const toggleDay = (i) => {
    const has = days.includes(i);
    if (has && days.length === 1) { setStatus('Keep at least one day.'); return; }
    const next = has ? days.filter((d) => d !== i) : [...days, i].sort((a, b) => a - b);
    setDays(next);
    setStatus('Saving…');
    // A quick run of taps saves once, after the last one; "Saved." waits for the server.
    window.clearTimeout(timers.current.days);
    timers.current.days = window.setTimeout(async () => {
      try {
        await saveDays(next);
        savedDays.current = next;
        setStatus('Saved.'); setAnySaved(true);
      } catch {
        setDays(savedDays.current);
        setStatus(`Not saved. Still ${savedDays.current.length} ${savedDays.current.length === 1 ? 'day' : 'days'} a week.`);
      }
    }, 450);
  };

  const pickTarget = (n) => {
    if (locked) return;
    const v = Math.min(MOCK_TARGET_MAX, Math.max(floor, n));
    setTarget(v);
    setStatus('Saving…');
    window.clearTimeout(timers.current.target);
    timers.current.target = window.setTimeout(async () => {
      try { await saveRoad({ mockTarget: v }); savedTarget.current = v; setStatus('Saved.'); setAnySaved(true); } catch { setTarget(savedTarget.current); setStatus('Not saved. Your target is unchanged.'); }
    }, 350);
  };

  const done = () => {
    onClose();
    if (anySaved) onDone?.({ weeks: fig.weeks, days: days.length, target });
  };

  const examWords = exam ? weekdayDay(exam) : `${weekdayDay(dates.windowStart)}, expected`;
  const token = (n, text) => (
    <button type="button" className="tpf__tok" aria-current={step === n ? 'step' : undefined} onClick={() => go(n)}>{text}</button>
  );

  return (
    <TodaySheet open={open} onClose={onClose} id="trd-plan" title="Change plan">
      <p className="tpf__sentence">
        I sit CUET UG on {token(1, examWords)}, study {token(2, `${days.length} ${days.length === 1 ? 'day' : 'days'}`)} a week, and take {token(3, `${target} full ${target === 1 ? 'mock' : 'mocks'}`)} before it.
      </p>

      <div className="tpf__step" key={step}>
        {step === 1 ? (
          <>
            <p className="tpf__q" id="tpf-q1">When do you sit CUET UG?</p>
            <div className="tpf__opts" role="radiogroup" aria-labelledby="tpf-q1">
              <button type="button" role="radio" className="tpf__opt" aria-checked={!exam && !ownOpen} disabled={locked} onClick={() => { setOwnOpen(false); pickExam(null); }}>
                <span className="tpf__radio" aria-hidden="true" />
                <span className="tpf__opt-t"><b>The expected start</b><span>{weekdayDay(dates.windowStart)} {dates.year}. NTA has not published the {dates.year} dates yet.</span></span>
              </button>
              <button type="button" role="radio" className="tpf__opt" aria-checked={Boolean(exam) || ownOpen} disabled={locked} onClick={() => setOwnOpen(true)}>
                <span className="tpf__radio" aria-hidden="true" />
                <span className="tpf__opt-t"><b>My own date</b><span>{exam ? `Set to ${weekdayDay(exam)} ${dates.year}.` : 'Once your admit card shows it.'}</span></span>
              </button>
            </div>
            {ownOpen && !locked ? (
              <Calendar year={dates.year} month={month} chosen={exam} expected={dates.windowStart} min={addDays(today, 1)} max={dates.latest} onMonth={setMonth} onPick={(k) => pickExam(k)} />
            ) : null}
            {locked ? <p className="tpf__hint">Your date is set on the app for now.</p> : null}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <p className="tpf__q" id="tpf-q2">Which days can you study?</p>
            <div className="tpf__days" role="group" aria-labelledby="tpf-q2">
              {WEEKDAY_SHORT.map((n, i) => (
                <button key={n} type="button" className="tpf__day" aria-pressed={days.includes(i)} onClick={() => toggleDay(i)}>
                  <i aria-hidden="true">{days.includes(i) ? <Check size={14} strokeWidth={2.6} /> : null}</i>
                  <span>{n}</span>
                </button>
              ))}
            </div>
            <p className="tpf__hint">Board weeks, {shortDay(dates.boardsStart)} to {shortDay(dates.boardsEnd)}, ease to 2 days. Any day you practise counts, planned or not.</p>
            {columns.length > 1 ? <RailToggle columns={columns} thisWeekDone={thisWeekDone} goal={days.length} /> : null}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <p className="tpf__q" id="tpf-q3">How many full mocks before your exam?</p>
            <div className="tpf__opts" role="radiogroup" aria-labelledby="tpf-q3">
              {choices.map((c) => (
                <button key={c.id} type="button" role="radio" className="tpf__opt" data-mocks={c.id} aria-checked={c.value === target} disabled={locked} onClick={() => pickTarget(c.value)}>
                  <span className="tpf__radio" aria-hidden="true" />
                  <span className="tpf__opt-t"><b>{c.title}</b><span>{MOCK_WHY[c.id]}</span></span>
                  <span className="tpf__opt-n">{c.value}</span>
                </button>
              ))}
              <div className="tpf__opt tpf__opt--own" role="radio" aria-checked={!isChoice} aria-label={`Your own number: ${target}`}>
                <span className="tpf__radio" aria-hidden="true" />
                <span className="tpf__opt-t"><b>Your own number</b><span>{taken != null ? <><Link className="tm__inline" href="/review">{taken} taken</Link> so far. </> : null}A fresh paper from the bank each time.</span></span>
                <span className="tpf__stepper">
                  <button type="button" aria-label="One fewer full mock" disabled={locked || target <= floor} onClick={() => pickTarget(target - 1)}><Minus size={16} strokeWidth={2} aria-hidden="true" /></button>
                  <output aria-live="polite">{target}</output>
                  <button type="button" aria-label="One more full mock" disabled={locked || target >= MOCK_TARGET_MAX} onClick={() => pickTarget(target + 1)}><Plus size={16} strokeWidth={2} aria-hidden="true" /></button>
                </span>
              </div>
            </div>
            {locked ? <p className="tpf__hint">Your mock target is set on the app for now.</p> : null}
          </>
        ) : null}
      </div>

      <div className="tpf__preview" aria-live="polite">
        <div><Bump value={fig.phase === 'days' ? fig.days : fig.weeks} /><span>{fig.phase === 'days' ? 'days' : 'weeks'} to {exam ? 'your date' : 'CUET UG'}</span></div>
        <div><Bump value={sessionsUntil(today, fig.exam, days.length)} /><span>study days at {days.length} a week</span></div>
        <div><Bump value={pace.left} /><span>mocks to go, {paceWords}</span></div>
      </div>
      <p className="tpf__status" role="status">{status}</p>
      <div className="tpf__foot">
        {step > 1 ? <button type="button" className="tpf__back" onClick={() => go(step - 1)}>Back</button> : <span />}
        {step < 3 ? <button type="button" className="tm__pill" onClick={() => go(step + 1)}>Next</button> : <button type="button" className="tm__key tpf__done" onClick={done}>Done</button>}
      </div>
    </TodaySheet>
  );
}

function RailToggle({ columns, thisWeekDone, goal }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="tpf__rail">
      <button type="button" className="tm__inline" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? 'Hide the weeks' : 'See every week'}</button>
      {open ? <Rail columns={columns} thisWeekDone={thisWeekDone} goal={goal} /> : null}
    </div>
  );
}

/** Days to start from when none are held: the goal's count, spread Mon, Wed, Sat, Sun first (the mock's own plan). */
function defaultDays(n) {
  const order = [0, 2, 5, 6, 3, 1, 4];
  const k = Math.min(7, Math.max(1, Number(n) || 4));
  return order.slice(0, k).sort((a, b) => a - b);
}

