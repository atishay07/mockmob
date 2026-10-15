"use client";

// Account > Weekly goal: how many days a week the student wants to study (the app's Weekly goal
// screen, ported from the restructure's You page). It writes /api/me/goal, the same goal Today's ring
// and the week read. "Saved" is said only after the server answered with the goal; until then the
// picker shows the goal the server last confirmed. A pause made in the app is sent back with the new
// days, so changing the goal never ends it. Rules in accountModel.mjs, tested in data/tests/you_account.test.mjs.
import { useCallback, useEffect, useRef, useState } from 'react';
import { DrawnCheck } from '@/components/ui/DrawnCheck';
import { api } from '@/lib/fetcher';
import {
  GOAL_COPY, GOAL_DAYS, GOAL_PATH, goalErrorLine, goalFromServer, goalPauseLine, goalSaveBody, goalSavedLine, goalSplitLine, goalUncertainLine,
} from './accountModel.mjs';
import './account.css';

const STAGGER_MS = 40;

/** The app's beat: raising the goal fills the new circles left to right, lowering it empties them right to left. */
function delayFor(day, from, to) {
  if (to > from && day > from && day <= to) return STAGGER_MS * (day - from - 1);
  if (to < from && day > to && day <= from) return STAGGER_MS * (from - day);
  return 0;
}

export default function GoalControl({ onSaved = null }) {
  const [load, setLoad] = useState({ status: 'loading', goal: null });
  const [picked, setPicked] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [save, setSave] = useState({ phase: 'idle', message: '' });
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(false);
  const dayRefs = useRef([]);

  useEffect(() => {
    let alive = true;
    api(GOAL_PATH)
      .then((body) => {
        if (!alive) return;
        const goal = goalFromServer(body);
        if (!goal) { setLoad({ status: 'error', goal: null }); return; }
        setLoad({ status: 'ready', goal });
        setPicked(goal.set ? goal.days : null);
      })
      .catch(() => { if (alive) setLoad({ status: 'error', goal: null }); });
    return () => { alive = false; };
  }, [attempt]);

  const goal = load.goal;
  const confirmed = goal && goal.set ? goal.days : null;
  const dirty = picked !== null && picked !== confirmed;

  const choose = useCallback((days) => {
    if (busy.current) return;
    setPrevious(picked);
    setPicked(days);
    setSave((s) => (s.phase === 'idle' ? s : { phase: 'idle', message: '' }));
  }, [picked]);

  async function submit() {
    if (busy.current || !dirty || !goal) return;
    busy.current = true;
    setSave({ phase: 'saving', message: '' });
    try {
      const body = await api(GOAL_PATH, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(goalSaveBody(picked, goal.pausedUntil)) });
      const confirmedGoal = goalFromServer(body);
      if (!confirmedGoal) { setSave({ phase: 'error', message: goalUncertainLine() }); return; }
      setLoad({ status: 'ready', goal: { ...confirmedGoal, set: true } });
      setPicked(confirmedGoal.days);
      setSave({ phase: 'saved', message: goalSavedLine(new Date()) });
      onSaved?.(confirmedGoal);
    } catch (error) {
      // Nothing was changed: the picker keeps the choice so a retry is one tap.
      setSave({ phase: 'error', message: goalErrorLine(error) });
    } finally {
      busy.current = false;
    }
  }

  const onKeyDown = (event, day) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = Math.min(7, Math.max(1, day + step));
    dayRefs.current[next - 1]?.focus();
    choose(next);
  };

  if (load.status === 'loading') {
    return (
      <div className="acct-goal" aria-busy="true">
        <span className="sr-only">Loading your weekly goal</span>
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

  const shown = picked ?? 0;
  const from = previous ?? 0;
  const pause = goalPauseLine(goal.pausedUntil);
  const saving = save.phase === 'saving';
  const roving = picked ?? goal.days;

  return (
    <div className="acct-goal">
      <p className="acct-goal__q" id="acct-goal-q">{GOAL_COPY.question}</p>
      <div className="acct-goal__days" role="radiogroup" aria-labelledby="acct-goal-q">
        {GOAL_DAYS.map((day) => (
          <button
            key={day}
            ref={(node) => { dayRefs.current[day - 1] = node; }}
            type="button"
            role="radio"
            aria-checked={picked === day}
            aria-label={`${day} ${day === 1 ? 'day' : 'days'} a week`}
            tabIndex={day === roving ? 0 : -1}
            className="acct-day"
            data-study={picked !== null && day < picked ? 'true' : 'false'}
            style={{ '--acct-delay': `${delayFor(day, from, shown)}ms` }}
            disabled={saving}
            onClick={() => choose(day)}
            onKeyDown={(event) => onKeyDown(event, day)}
          >{day}</button>
        ))}
      </div>
      <p className="acct-goal__split" aria-live="polite">{picked === null ? GOAL_COPY.notChosen : goalSplitLine(picked)}</p>
      <p className="acct-goal__counts">{GOAL_COPY.counts}</p>
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
