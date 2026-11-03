"use client";
// NTA mode integrity: leaving the test tab or window is a strike. Two warnings, then the third ends
// the session and submits what is answered. Strikes survive a reload (stored per session key).
// The timer keeps running throughout; nothing here pauses it.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldAlert, Eye } from 'lucide-react';
import { INTEGRITY_STRIKES, INTEGRITY_GRACE_MS, applyViolation, readStoredStrikes, VIOLATION_LABEL } from '@/../data/exam_integrity.mjs';
import './exam-integrity.css';

export function useExamIntegrity({ enabled, storageKey, onTerminate }) {
  const [strikes, setStrikes] = useState(0);
  const [alert, setAlert] = useState(null); // { reason, count, phase, remaining }
  const armedAt = useRef(0);
  const away = useRef(false);
  const strikesRef = useRef(strikes);
  const terminate = useRef(onTerminate);
  useEffect(() => { terminate.current = onTerminate; }, [onTerminate]);

  const strike = useCallback((reason) => {
    if (Date.now() - armedAt.current < INTEGRITY_GRACE_MS || strikesRef.current >= INTEGRITY_STRIKES) return;
    const v = applyViolation(strikesRef.current);
    strikesRef.current = v.count;
    setStrikes(v.count);
    setAlert({ reason, ...v });
    try { window.localStorage.setItem(storageKey, String(v.count)); } catch { /* the in-memory count still holds */ }
    if (v.phase === 'terminated') terminate.current?.();
  }, [storageKey]);

  useEffect(() => {
    if (!enabled) return undefined;
    armedAt.current = Date.now();
    // Strikes survive a reload; a session already at three is ended again rather than resumed.
    let stored = 0;
    try { stored = readStoredStrikes(window.localStorage.getItem(storageKey)); } catch { /* start clean */ }
    strikesRef.current = stored;
    queueMicrotask(() => {
      setStrikes(stored);
      if (stored >= INTEGRITY_STRIKES) { setAlert({ reason: 'hidden', ...applyViolation(INTEGRITY_STRIKES - 1) }); terminate.current?.(); }
    });
    // One episode of being away is one strike, however many events it fires (hidden + blur together).
    const leave = (reason) => { if (away.current) return; away.current = true; strike(reason); };
    const back = () => { if (!document.hidden) away.current = false; };
    const onVis = () => (document.hidden ? leave('hidden') : back());
    const onBlur = () => setTimeout(() => { if (!document.hasFocus()) leave('blur'); }, 150);
    const stop = (e) => e.preventDefault();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', back);
    document.addEventListener('copy', stop); document.addEventListener('cut', stop);
    document.addEventListener('paste', stop); document.addEventListener('contextmenu', stop);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', back);
      document.removeEventListener('copy', stop); document.removeEventListener('cut', stop);
      document.removeEventListener('paste', stop); document.removeEventListener('contextmenu', stop);
    };
  }, [enabled, strike, storageKey]);

  const dismiss = useCallback(() => setAlert(a => (a && a.phase === 'warning' ? null : a)), []);
  return { strikes, alert, dismiss };
}

// Header pill: always visible in NTA mode so the rule is never a surprise.
export function IntegrityPill({ strikes }) {
  return (
    <span className="ei-pill" data-strikes={strikes} title="Leaving this tab or window is a warning. The third ends the session.">
      <Eye size={14} aria-hidden="true" />
      <span>Warnings {strikes}/{INTEGRITY_STRIKES}</span>
    </span>
  );
}

export function IntegrityOverlay({ alert, onResume, submitting }) {
  const btn = useRef(null);
  useEffect(() => { if (alert?.phase === 'warning') btn.current?.focus(); }, [alert]);
  if (!alert) return null;
  const ended = alert.phase === 'terminated';
  return (
    <div className="ei-scrim" role="alertdialog" aria-modal="true" aria-labelledby="ei-title" aria-describedby="ei-body" data-phase={alert.phase}>
      <div className="ei-card" key={alert.count}>
        <span className="ei-icon" aria-hidden="true"><ShieldAlert size={30} strokeWidth={2.2} /></span>
        <h2 id="ei-title">{ended ? 'Session ended' : `Warning ${alert.count} of ${INTEGRITY_STRIKES}`}</h2>
        <p id="ei-body">
          {VIOLATION_LABEL[alert.reason] || 'You left the test.'}. {ended
            ? (submitting ? 'This was your third warning. Submitting your answers now…' : 'This was your third warning, so your answers are being submitted.')
            : `The timer kept running. ${alert.remaining === 1 ? 'One more and your session ends and is submitted.' : `${alert.remaining} more and your session ends and is submitted.`}`}
        </p>
        <ol className="ei-strikes" aria-hidden="true">{Array.from({ length: INTEGRITY_STRIKES }, (_, i) => <li key={i} data-on={i < alert.count} />)}</ol>
        {ended ? null : <button ref={btn} type="button" className="ei-btn" onClick={onResume}>Return to test</button>}
      </div>
    </div>
  );
}
