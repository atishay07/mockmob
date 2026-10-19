"use client";

// Account > Study days: which weekdays the student plans to study, and so how many a week (the app's
// Weekly goal screen, ported from the restructure's You page). It reads and writes /api/me/goal, the
// same goal Today's ring and the week read, and the same weekdays the app keeps on the account: the goal
// is the number of days picked, never a second number to keep in step. "Saved" is said only after the
// server answered with the goal AND the same days; until then the chips show what the server last
// confirmed. A pause made in the app is sent back with the new days, so changing the days never ends it.
// A goal held without chosen days (set in the app before this) shows its number and asks which days.
// The daily time sits above the days (D126, owner H1): 10, 20, 30 and More (1 hour, 2 hours, your own in steps of 15
// minutes). It saves with the days in one write; a server that cannot hold a longer day yet gets only what it accepts, the
// choice stays on this device, and the note under the choices says exactly that (src/lib/goalMinutesStore.js).
// Rules in accountModel.mjs, tested in data/tests/you_account.test.mjs; the minutes in data/tests/goal_minutes_web.test.mjs.
import { useCallback, useEffect, useRef, useState } from 'react';
import { DrawnCheck } from '@/components/ui/DrawnCheck';
import DailyMinutes from '@/components/goal/DailyMinutes';
import { api } from '@/lib/fetcher';
import { goalMinutesFromResponse, pickMinutes, savedMinutesLine } from '@/lib/goalMinutes.mjs';
import { mirrorToPlan, promoteDeviceMinutes, readDeviceMinutes, saveDailyMinutes, writeDeviceMinutes } from '@/lib/goalMinutesStore';
import {
  GOAL_COPY, GOAL_PATH, GOAL_WEEKDAYS, goalDaysNotChosenLine, goalErrorLine, goalFromServer, goalPauseLine, goalSaveBody, goalSavedLine,
  goalSplitLine, goalUncertainLine, goalWeekdaysLine, sameWeekdays, toggleWeekday,
} from './accountModel.mjs';
import './account.css';

export default function GoalControl({ onSaved = null }) {
  const [load, setLoad] = useState({ status: 'loading', goal: null });
  const [picked, setPicked] = useState([]);
  // The daily time: what the student has chosen on screen, and what the account or this device holds.
  const [minutes, setMinutes] = useState(null);
  const [kept, setKept] = useState({ minutes: null, source: null });
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
        const held = pickMinutes(body.dailyMinutes, readDeviceMinutes());
        setKept(held);
        setMinutes((m) => m ?? held.minutes);
        // A server that now knows the daily time and holds none takes what this device kept, once.
        promoteDeviceMinutes(body).then((promoted) => { if (alive && promoted !== null) setKept({ minutes: promoted, source: 'account' }); });
      })
      .catch(() => { if (alive) setLoad({ status: 'error', goal: null }); });
    return () => { alive = false; };
  }, [attempt]);

  const goal = load.goal;
  const daysDirty = picked.length > 0 && !sameWeekdays(picked, goal?.weekdays);
  const minutesDirty = minutes !== null && minutes !== kept.minutes;
  const dirty = daysDirty || minutesDirty;

  const toggle = useCallback((day) => {
    if (busy.current) return;
    setPicked((list) => toggleWeekday(list, day));
    setSave((s) => (s.phase === 'idle' ? s : { phase: 'idle', message: '' }));
  }, []);

  const chooseMinutes = useCallback((n) => {
    if (busy.current) return;
    setMinutes(n);
    setSave((s) => (s.phase === 'idle' ? s : { phase: 'idle', message: '' }));
  }, []);

  async function submit() {
    if (busy.current || !dirty || !goal) return;
    busy.current = true;
    const sent = picked;
    const wanted = minutesDirty ? minutes : null;
    setSave({ phase: 'saving', message: '' });
    const parts = [];
    try {
      let minutesWhere = null;
      let planMinutes = null;
      if (daysDirty) {
        const body = await api(GOAL_PATH, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(goalSaveBody(sent.length, goal.pausedUntil, Date.now(), sent, wanted ?? undefined)) });
        const confirmedGoal = goalFromServer(body);
        // A server that kept the number but not the days (an older deploy) has not saved what was chosen.
        if (!confirmedGoal || !sameWeekdays(confirmedGoal.weekdays, sent)) { setSave({ phase: 'error', message: goalUncertainLine() }); return; }
        setLoad({ status: 'ready', goal: { ...confirmedGoal, set: true } });
        setPicked(confirmedGoal.weekdays);
        parts.push(goalSavedLine(new Date()));
        onSaved?.(confirmedGoal);
        if (wanted !== null) {
          minutesWhere = goalMinutesFromResponse(body, wanted);
          if (minutesWhere === 'account') writeDeviceMinutes(wanted);
          else { writeDeviceMinutes(wanted); planMinutes = await mirrorToPlan(wanted); }
        }
      } else if (wanted !== null) {
        const result = await saveDailyMinutes(wanted);
        minutesWhere = result.where;
        planMinutes = result.planMinutes;
      }
      if (wanted !== null) {
        setKept({ minutes: wanted, source: minutesWhere });
        parts.push(minutesWhere === 'account' ? (daysDirty ? '' : goalSavedLine(new Date())) : savedMinutesLine(wanted, 'device', planMinutes));
      }
      setSave({ phase: 'saved', message: parts.filter(Boolean).join(' ') });
    } catch (error) {
      // Nothing was changed: the chips and the time keep the choice so a retry is one tap.
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
      <p className="acct-goal__q" id="acct-goal-m">{GOAL_COPY.minutesQuestion}</p>
      <DailyMinutes
        value={minutes} onChange={chooseMinutes} labelledBy="acct-goal-m" busy={saving} idPrefix="acct-gm"
        note={kept.source === 'device' && minutes === kept.minutes && save.phase !== 'saved' ? savedMinutesLine(kept.minutes, 'device') : null}
      />
      <p className="acct-goal__q acct-goal__q--days" id="acct-goal-q">{GOAL_COPY.question}</p>
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
