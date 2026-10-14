"use client";

import React, { useEffect, useRef, useState } from 'react';
import { START_ON_OPTIONS, readStartOn, writeStartOn } from '@/../data/visitor_state.mjs';
import { AccountSection, AccountNote } from './AccountSection';

// Account > Start page (decision D2). Which page opens when this student visits mockmob.in fresh.
// Kept in this browser only: it is a per-device convenience, and signing out forgets it.
// States: reading (before mount), ready, saved (the browser accepted it), not saved (the write
// failed) and unavailable (this browser keeps no site data, so the default applies).

const NOTES = {
  practice: 'Opens Practice, where you start a session.',
  today: 'Opens Today, your next step for tonight.',
  home: 'Opens the home page.',
};

export default function StartOnSetting() {
  const [value, setValue] = useState(null);
  const [available, setAvailable] = useState(true);
  const [note, setNote] = useState({ type: null, message: '' });
  const sectionRef = useRef(null);

  useEffect(() => {
    let alive = true;
    queueMicrotask(() => {
      if (!alive) return;
      let storage = null;
      try { storage = window.localStorage; } catch { /* blocked */ }
      const read = readStartOn(storage);
      setValue(read.value);
      setAvailable(read.available);
      // Arriving from "Change start page" on the home page: bring the setting into view.
      if (window.location.hash === '#start-on' && sectionRef.current) {
        sectionRef.current.scrollIntoView({ block: 'start' });
        sectionRef.current.focus({ preventScroll: true });
      }
    });
    return () => { alive = false; };
  }, []);

  function choose(next) {
    if (next === value) return;
    let storage = null;
    try { storage = window.localStorage; } catch { /* blocked */ }
    if (storage && writeStartOn(storage, next)) {
      setValue(next);
      const label = START_ON_OPTIONS.find((option) => option.id === next)?.label || next;
      setNote({ type: 'ok', message: next === 'home' ? 'Saved on this device. Visits open the home page.' : `Saved on this device. Visits open ${label}.` });
    } else {
      setNote({ type: 'err', message: 'This browser did not keep the change. Visits keep opening Practice.' });
    }
  }

  return (
    <AccountSection
      id="start-on"
      ref={sectionRef}
      tabIndex={-1}
      title="Start page"
      lead="The page that opens when you visit mockmob.in on this device. The MockMob logo always takes you home."
    >
      <div className="acct-row">
        {value === null ? (
          <div className="acct-choice__opts" aria-hidden="true">
            {START_ON_OPTIONS.map((option) => <span key={option.id} className="ui-skeleton acct-opt-ghost" />)}
          </div>
        ) : (
          <fieldset className="acct-choice" disabled={!available}>
            <legend className="sr-only">Start page</legend>
            <div className="acct-choice__opts">
              {START_ON_OPTIONS.map((option) => (
                <label key={option.id} className="acct-opt">
                  <input
                    type="radio"
                    name="start-on"
                    value={option.id}
                    checked={value === option.id}
                    onChange={() => choose(option.id)}
                  />
                  <span className="acct-opt__bubble" aria-hidden="true" />
                  <span className="acct-opt__text">
                    <b>{option.label}</b>
                    <span>{NOTES[option.id] || ''}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {!available && value !== null ? (
          <p className="acct-help">This browser is not keeping site data, so visits open Practice. Allow site data for mockmob.in to choose another page.</p>
        ) : null}
      </div>
      <AccountNote tone={note.type === 'ok' ? 'ok' : note.type === 'err' ? 'bad' : null}>{note.message}</AccountNote>
    </AccountSection>
  );
}
