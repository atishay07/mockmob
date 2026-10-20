"use client";

// Account > Study days: which weekdays the student plans to study, and so how many a week (the app's
// Weekly goal screen, ported from the restructure's You page), and how long the student wants to study on each of
// those days (the daily time, 5 to 999 minutes: the same goal the app keeps, now on the account so both show it).
// It reads and writes /api/me/goal, the
// same goal Today's ring and the week read, and the same weekdays the app keeps on the account: the goal
// is the number of days picked, never a second number to keep in step. "Saved" is said only after the
// server answered with the goal AND the same days; until then the chips show what the server last
// confirmed. A pause made in the app is sent back with the new days, so changing the days never ends it.
// A goal held without chosen days (set in the app before this) shows its number and asks which days.
// Rules in accountModel.mjs, tested in data/tests/you_account.test.mjs.
import { useCallback, useEffect, useRef, useState } from 'react';
import { DrawnCheck } from '@/components/ui/DrawnCheck';
import { api } from '@/lib/fetcher';
import {
  GOAL_COPY, GOAL_MINUTES_CHIPS, GOAL_PATH, GOAL_WEEKDAYS, goalDaysNotChosenLine, goalErrorLine, goalFromServer, goalMinutesLabel, goalMinutesLine,
  goalPauseLine, goalSaveBody, goalSavedLine, goalSplitLine, goalUncertainLine, goalWeekdaysLine, parseMinutesInput, sameWeekdays, toggleWeekday,
} from './accountModel.mjs';
import './account.css';

export default function GoalControl({ onSaved = null }) {
  const [load, setLoad] = useState({ status: 'loading', goal: null });
  const [picked, setPicked] = useState([]);
  // The daily time: a chip or a typed number. `mins` is the minutes picked (null while nothing valid is picked), `custom` the typed text.
  const [mins, setMins] = useState(null);
  const [custom, setCustom] = useState('');
  const [save, setSave] = useState({ phase: 'idle', message: '' });
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;
    api(GOAL_PATH)
      .then((body) => {
        if (!alive) return;
        const goal = goalFromServer(body);
        if (!goal) { setLoad({ status: 'error', goal: null }); return; }
        setLoad({ status: 'ready', goal });
        setPicked(goal.weekdays || []);
        setMins(goal.dailyMinutes);
        setCustom('');
      })
      .catch(() => { if (alive) setLoad({ status: 'error', goal: null }); });
    return () => { alive = false; };
  }, [attempt]);

  const goal = load.goal;
  const dirtyDays = picked.length > 0 && !sameWeekdays(picked, goal?.weekdays);
  const dirtyMinutes = mins !== null && mins !== (goal?.dailyMinutes ?? null);
  const customInvalid = custom.trim() !== '' && parseMinutesInput(custom) === null;
  const dirty = (dirtyDays || dirtyMinutes) && !customInvalid;

  const toggle = useCallback((day) => {
    if (busy.current) return;
    setPicked((list) => toggleWeekday(list, day));
    setSave((s) => (s.phase === 'idle' ? s : { phase: 'idle', message: '' }));
  }, []);

  const pickMinutes = useCallback((n) => {
    if (busy.current) return;
    setMins(n);
    setCustom('');
    setSave((s) => (s.phase === 'idle' ? s : { phase: 'idle', message: '' }));
  }, []);
  const typeMinutes = useCallback((text) => {
    if (busy.current) return;
    const clean = text.replace(/[^\d]/g, '').slice(0, 3);
    setCustom(clean);
    setMins(parseMinutesInput(clean));
    setSave((s) => (s.phase === 'idle' ? s : { phase: 'idle', message: '' }));
  }, []);

  async function submit() {
    if (busy.current || !dirty || !goal) return;
    busy.current = true;
    const sent = picked;
    const sentMinutes = dirtyMinutes ? mins : undefined;
    setSave({ phase: 'saving', message: '' });
    try {
      // The days and the time save together; the time alone is its own write that leaves the days and the pause as they are.
      const payload = dirtyDays ? goalSaveBody(sent.length, goal.pausedUntil, Date.now(), sent, sentMinutes) : { dailyMinutes: sentMinutes };
      const body = await api(GOAL_PATH, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const confirmedGoal = goalFromServer(body);
      // A server that kept the number but not the days (an older deploy) has not saved what was chosen.
      if (!confirmedGoal || (dirtyDays && !sameWeekdays(confirmedGoal.weekdays, sent))) { setSave({ phase: 'error', message: goalUncertainLine() }); return; }
      setLoad({ status: 'ready', goal: { ...confirmedGoal, set: true } });
      setPicked(confirmedGoal.weekdays || []);
      setMins(confirmedGoal.dailyMinutes);
      setCustom('');
      // The days saved but the time did not (the account cannot hold it yet): say so, never "saved".
      if (sentMinutes !== undefined && confirmedGoal.dailyMinutes !== sentMinutes) { setSave({ phase: 'error', message: GOAL_COPY.minutesNotSaved }); return; }
      setSave({ phase: 'saved', message: goalSavedLine(new Date()) });
      onSaved?.(confirmedGoal);
    } catch (error) {
      // Nothing was changed: the chips keep the choice so a retry is one tap.
      setSave({ phase: 'error', message: goalErrorLine(error) });
    } finally {
      busy.current = false;
    }
  }

  if (load.status === 'loading') {
    return (
      <div className="acct-goal" aria-busy="true">
        <span className="sr-only">Loading your study days</span>
        <span className="acct-sk acct-sk--line skeleton" aria-hidden="true" />
        <span className="acct-sk acct-sk--days skeleton" aria-hidden="true" />
      </div>
    );
  }
  if (load.status === 'error') {
    return (
      <div className="acct-goal">
        <p className="acct-note" role="alert" data-tone="err">{GOAL_COPY.loadFailedTitle}. {GOAL_COPY.loadFailedBody}</p>
        <div><button type="button" className="acct-key" onClick={() => { setLoad({ status: 'loading', goal: null }); setAttempt((n) => n + 1); }}>{GOAL_COPY.retry}</button></div>
      </div>
    );
  }

  const pause = goalPauseLine(goal.pausedUntil);
  const saving = save.phase === 'saving';
  let split;
  if (picked.length > 0) split = `${goalSplitLine(picked.length)} ${goalWeekdaysLine(picked)}`.trim();
  else split = goal.set ? goalDaysNotChosenLine(goal.days) : GOAL_COPY.notChosen;

  return (
    <div className="acct-goal">
      <p className="acct-goal__q" id="acct-goal-q">{GOAL_COPY.question}</p>
      <div className="acct-goal__days" role="group" aria-labelledby="acct-goal-q">
        {GOAL_WEEKDAYS.map((day) => (
          <button
            key={day.index}
            type="button"
            role="checkbox"
            aria-checked={picked.includes(day.index)}
            aria-label={day.name}
            className="acct-day acct-day--wd"
            disabled={saving}
            onClick={() => toggle(day.index)}
          >{day.short}</button>
        ))}
      </div>
      <p className="acct-goal__split" aria-live="polite">{split}</p>
      <p className="acct-goal__counts">{GOAL_COPY.counts}</p>
      <p className="acct-goal__q" id="acct-mins-q">{GOAL_COPY.minutesQuestion}</p>
      <div className="acct-goal__mins" role="radiogroup" aria-labelledby="acct-mins-q">
        {GOAL_MINUTES_CHIPS.map((n) => (
          <button key={n} type="button" role="radio" aria-checked={mins === n} className="acct-day acct-day--min" disabled={saving} onClick={() => pickMinutes(n)}>{goalMinutesLabel(n)}</button>
        ))}
      </div>
      <label className="acct-field acct-goal__own">
        <span>{GOAL_COPY.minutesOwn}</span>
        <input className="input acct-goal__input" inputMode="numeric" autoComplete="off" maxLength={3} value={custom} disabled={saving} aria-invalid={customInvalid || undefined} aria-describedby="acct-mins-line" onChange={(e) => typeMinutes(e.target.value)} />
      </label>
      <p className="acct-goal__split" id="acct-mins-line" aria-live="polite" data-tone={customInvalid ? 'err' : undefined}>
        {customInvalid ? GOAL_COPY.minutesRange : mins !== null ? goalMinutesLine(mins, picked.length || goal.days) : GOAL_COPY.minutesNotSet}
      </p>
      {pause ? <p className="acct-note">{pause}</p> : null}
      <div className="acct-goal__foot">
        <button type="button" className={`acct-key${dirty ? ' acct-key--volt' : ''}`} disabled={!dirty || saving} onClick={submit}>{saving ? GOAL_COPY.saving : GOAL_COPY.save}</button>
        <p className="acct-note" role={save.phase === 'error' ? 'alert' : 'status'} data-tone={save.phase === 'saved' ? 'ok' : save.phase === 'error' ? 'err' : undefined}>
          {save.phase === 'saved' ? <><DrawnCheck size={16} />{save.message}</> : save.phase === 'error' ? save.message : ''}
        </p>
      </div>
    </div>
  );
}
