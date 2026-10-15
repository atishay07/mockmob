"use client";

// Start on: where MockMob opens when a signed-in student arrives (Today by default, or Practice).
// Kept on this device: the choice is written to localStorage (read after sign-in) and mirrored in a
// small cookie so the home page can send a signed-in visitor to the same place. Nothing here is sent
// to the account, so "saved" means saved on this device, and is said only after the write worked.
import { useEffect, useRef, useState } from 'react';
import { START_ON_OPTIONS } from '@/lib/navigation';
import { START_ON_COPY, readStartOn, writeStartOn } from './youModel.mjs';
import './you.css';

const NOTES = { today: "Tonight's move, your week and your record.", practice: 'Pick a mock or a practice set.' };

function store() {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}

export default function StartOnSetting() {
  const [choice, setChoice] = useState('today');
  const [note, setNote] = useState({ tone: null, text: '' });
  const refs = useRef([]);

  // The stored choice is read after the first paint, so the server and the browser agree on the markup.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setChoice(readStartOn(store())));
    return () => cancelAnimationFrame(frame);
  }, []);

  function pick(id) {
    if (id === choice) return;
    setChoice(id);
    const kept = writeStartOn(id, { store: store(), setCookie: (value) => { document.cookie = value; } });
    setNote(kept
      ? { tone: 'ok', text: START_ON_COPY.saved }
      : { tone: 'err', text: 'Your browser blocked saving this choice. MockMob will open on Today.' });
  }

  const onKeyDown = (event, index) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + START_ON_OPTIONS.length) % START_ON_OPTIONS.length;
    refs.current[next]?.focus();
    pick(START_ON_OPTIONS[next].id);
  };
  const active = Math.max(0, START_ON_OPTIONS.findIndex((o) => o.id === choice));

  return (
    <section className="you-card" id="start-on" aria-labelledby="start-on-h">
      <h2 id="start-on-h">{START_ON_COPY.title}</h2>
      <p>{START_ON_COPY.lead}</p>
      <div className="you-seg" role="radiogroup" aria-labelledby="start-on-h">
        {START_ON_OPTIONS.map((option, i) => (
          <button
            key={option.id}
            ref={(node) => { refs.current[i] = node; }}
            type="button"
            role="radio"
            aria-checked={choice === option.id}
            tabIndex={i === active ? 0 : -1}
            onClick={() => pick(option.id)}
            onKeyDown={(event) => onKeyDown(event, i)}
          >
            <b>{option.label}</b>
            <small>{NOTES[option.id]}</small>
          </button>
        ))}
      </div>
      <p className="you-note" role="status" data-tone={note.tone || undefined}>{note.text}</p>
    </section>
  );
}
