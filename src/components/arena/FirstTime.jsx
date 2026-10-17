"use client";
// A one-time line for a student's first visit to a place (W-064, F18: every feature has a way in at the moment it is
// useful, and a first-time student can say what to do next). It shows on the first visit on this device and is gone after
// the student closes it or comes back another day. Never a popup or a tour: one quiet line in the page's own flow.
// The seen mark is a per-device convenience (localStorage); without storage the line simply shows.
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import './first-time.css';

const KEY = (id) => `mm:first:${id}:v1`;
const DAY = 86400000;

export default function FirstTime({ id, title = 'First time here?', children }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(KEY(id));
        const first = raw ? Number(raw) : Date.now();
        if (!raw) window.localStorage.setItem(KEY(id), String(first));
        // The day of the first visit only; a closed line never comes back.
        setShow(first > 0 && Date.now() - first < DAY);
      } catch { setShow(true); }
    }, 0);
    return () => window.clearTimeout(t);
  }, [id]);
  if (!show) return null;
  const close = () => { setShow(false); try { window.localStorage.setItem(KEY(id), '-1'); } catch { /* it hides for this visit */ } };
  return (
    <aside className="ft" aria-label={title}>
      <p className="ft__text"><b>{title}</b> {children}</p>
      <button type="button" className="ft__x" onClick={close} aria-label="Close this note"><X size={16} aria-hidden="true" /></button>
    </aside>
  );
}
