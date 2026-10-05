"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldAlert, Maximize, Eye } from 'lucide-react';
import { INTEGRITY_STRIKES, createIntegrityMonitor, readStoredStrikes, VIOLATION_LABEL } from '@/../data/exam_integrity.mjs';
import './exam-integrity.css';

export function useExamIntegrity({ enabled, storageKey, fullscreenTarget, onTerminate }) {
  const [strikes, setStrikes] = useState(0);
  const [alert, setAlert] = useState(null);
  const [fullscreenError, setFullscreenError] = useState('');
  const [entering, setEntering] = useState(false);
  const [supported, setSupported] = useState(true);
  const monitor = useRef(null); const requesting = useRef(false); const terminate = useRef(onTerminate);
  const blocked = useRef(true);
  useEffect(() => { terminate.current = onTerminate; }, [onTerminate]);

  useEffect(() => {
    if (!enabled) return undefined;
    let stored = 0; let disposed = false; let blurTimer;
    try { stored = readStoredStrikes(window.localStorage.getItem(storageKey)); } catch {}
    const fullscreenSupported = !!fullscreenTarget.current?.requestFullscreen && document.fullscreenEnabled !== false;
    const controller = createIntegrityMonitor({ count: stored,
      onViolation: violation => {
        blocked.current = true;
        setStrikes(violation.count); setAlert(violation);
        try { window.localStorage.setItem(storageKey, String(violation.count)); } catch {}
      }, onTerminate: () => terminate.current?.() });
    monitor.current = controller;
    blocked.current = true;
    queueMicrotask(() => {
      if (disposed) return;
      setSupported(fullscreenSupported); setStrikes(stored);
      setAlert(stored >= INTEGRITY_STRIKES ? { phase: 'terminated', count: stored, reason: 'reload' } : { phase: 'entry', count: stored });
      if (stored >= INTEGRITY_STRIKES) terminate.current?.();
    });
    const back = () => {
      if (!document.hidden && document.hasFocus() && (!fullscreenSupported || document.fullscreenElement === fullscreenTarget.current)) controller.returned();
    };
    const onVis = () => document.hidden ? controller.violation('hidden') : back();
    const onBlur = () => {
      clearTimeout(blurTimer);
      blurTimer = setTimeout(() => { if (!disposed && !requesting.current && !document.hasFocus()) controller.violation('blur'); }, 150);
    };
    const onFullscreen = () => {
      if (!requesting.current && document.fullscreenElement !== fullscreenTarget.current) controller.violation('fullscreen');
    };
    const stop = event => event.preventDefault();
    document.addEventListener('fullscreenchange', onFullscreen);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur); window.addEventListener('focus', back);
    for (const type of ['copy', 'cut', 'paste', 'contextmenu']) document.addEventListener(type, stop);
    return () => {
      disposed = true; controller.stop(); clearTimeout(blurTimer);
      document.removeEventListener('fullscreenchange', onFullscreen);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur); window.removeEventListener('focus', back);
      for (const type of ['copy', 'cut', 'paste', 'contextmenu']) document.removeEventListener(type, stop);
    };
  }, [enabled, storageKey, fullscreenTarget]);

  const resume = useCallback(async () => {
    if (requesting.current || monitor.current?.count >= INTEGRITY_STRIKES) return;
    requesting.current = true; setEntering(true); setFullscreenError('');
    try {
      if (supported && document.fullscreenElement !== fullscreenTarget.current) await fullscreenTarget.current.requestFullscreen();
      monitor.current?.enter(); blocked.current = false; setAlert(null);
    } catch {
      setFullscreenError('Fullscreen could not open. Allow fullscreen in your browser, then try again. The timer is still running.');
    } finally { requesting.current = false; setEntering(false); }
  }, [supported, fullscreenTarget]);
  const finish = useCallback(async () => {
    monitor.current?.stop();
    if (document.fullscreenElement === fullscreenTarget.current) await document.exitFullscreen().catch(() => {});
  }, [fullscreenTarget]);
  const canAnswer = useCallback(() => !enabled || !blocked.current, [enabled]);
  return { strikes, alert, resume, finish, canAnswer, supported, entering, fullscreenError };
}

export function IntegrityPill({ strikes }) {
  return <span className="ei-pill" data-strikes={strikes} title="Fullscreen exit or leaving the test is a warning. Warning 3 submits your answers."><Eye size={14} aria-hidden="true" />Warnings {strikes}/{INTEGRITY_STRIKES}</span>;
}

export function IntegrityOverlay({ alert, onResume, onRetry, submitting, error, supported, entering, fullscreenError }) {
  const dialog = useRef(null);
  useEffect(() => {
    if (alert && !dialog.current?.open) dialog.current?.showModal();
    else if (!alert && dialog.current?.open) dialog.current.close();
  }, [alert]);
  if (!alert) return null;
  const entry = alert.phase === 'entry'; const ended = alert.phase === 'terminated';
  return <dialog ref={dialog} className="ei-dialog" onCancel={event => event.preventDefault()} aria-labelledby="ei-title" aria-describedby="ei-body" data-phase={alert.phase}>
    <div className="ei-card" key={alert.count}>
      {entry ? <Maximize size={28} aria-hidden="true" /> : <ShieldAlert size={28} aria-hidden="true" />}
      <h2 id="ei-title">{entry ? 'Enter your exam space' : ended ? 'Session ended' : `Warning ${alert.count} of ${INTEGRITY_STRIKES}`}</h2>
      <p id="ei-body">{entry ? supported ? 'NTA Mode uses the entire screen. Enter fullscreen to answer. Your session timer is already running.' : 'This browser does not support fullscreen. Stay in this test window; leaving it still counts as a warning.' : ended ? 'You reached three warnings. Answering is locked. We will submit the answers you already saved.' : `${VIOLATION_LABEL[alert.reason] || 'You left the test'}. The timer keeps running. ${alert.remaining === 1 ? 'One more warning will end and submit your session.' : 'Two more warnings will end and submit your session.'}`}</p>
      {!ended ? <ul className="ei-rules"><li>Fullscreen exits, tab switches and leaving the window count as warnings.</li><li>Copy, paste and right-click are disabled.</li><li>The third warning submits your current answers.</li></ul> : null}
      <ol className="ei-strikes" aria-label={`${alert.count} of ${INTEGRITY_STRIKES} warnings`}>{Array.from({ length: INTEGRITY_STRIKES }, (_, i) => <li key={i} data-on={i < alert.count} aria-hidden="true" />)}</ol>
      {fullscreenError ? <p className="ei-error" role="alert">{fullscreenError}</p> : null}
      {ended ? <><p className="ei-submission" role="status">{submitting ? 'Submitting your saved answers…' : error || 'Confirming your result…'}</p>{!submitting && error ? <button type="button" className="ei-btn" onClick={onRetry}>Retry submission</button> : null}</> : <button type="button" className="ei-btn" disabled={entering} onClick={onResume}>{entering ? 'Opening fullscreen…' : supported ? entry ? 'Enter fullscreen' : 'Return to fullscreen' : 'Continue in this window'}</button>}
      <p className="ei-fine">Browser safeguards let you exit with Escape or switch apps. These exits are detected here; this is not server-verified proctoring.</p>
    </div>
  </dialog>;
}
