"use client";
// Layer 1 of the result (RESULT-1017 4.2): what happened, in one glance. The one receipt line, the score with its
// denominator, a three-part marks bar (scored, lost to wrong answers, left on blanks) with its legend in the counts
// line (colour is never the only signal), and the chapter that cost the most. A key under re-check is one line here.
// No Mobi: a result arriving is the student's moment, not his (F11).
import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

const still = () => {
  try { return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; }
};

// The score counts up once, on the first open only (600 ms); a return visit and reduced motion show it at once.
function CountUp({ value, run }) {
  const [shown, setShown] = useState(() => (run ? 0 : value));
  useEffect(() => {
    if (!run || !value || still()) { queueMicrotask(() => setShown(value)); return undefined; }
    let raf; let start;
    const step = (t) => { start ??= t; const p = Math.min((t - start) / 600, 1); setShown(Math.round(value * (1 - (1 - p) ** 3))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, run]);
  return shown;
}

/**
 * receipt   "Accountancy full mock. Recorded 9:41 PM, 46m 36s."
 * marks     analysis.marks
 * finding   { line, detail } from costliestLine
 * notice    { text, number } a key under re-check or a correction, or null
 * arrive    first open: the arrival sequence plays
 */
export default function ResultHead({ receipt, marks, finding, notice = null, onNotice, arrive = false, unit = 'marks' }) {
  const pct = (v) => (marks.max ? Math.max(0, (v / marks.max) * 100) : 0);
  const scored = Math.max(marks.scored, 0);
  const tone = marks.scored < 0 ? 'bad' : undefined;
  return (
    <div className="rx-head" data-arrive={arrive || undefined}>
      <p className="rx-receipt">{receipt}</p>
      <h1 className="rx-score" aria-label={`${marks.scored} of ${marks.max} ${unit}`}>
        <b data-tone={tone}>{marks.scored < 0 ? '−' : ''}<CountUp value={Math.abs(marks.scored)} run={arrive} /></b>
        <span>/ {marks.max} {unit}</span>
      </h1>
      <div className="rx-bar" role="img" aria-label={`${scored} of ${marks.max} marks scored. ${marks.gapWrong} lost to wrong answers, ${marks.gapBlank} left on blanks.`}>
        <span className="rx-bar__seg" data-kind="scored" style={{ width: `${pct(scored)}%` }} />
        <span className="rx-bar__seg" data-kind="wrong" style={{ width: `${pct(marks.gapWrong)}%` }} />
        <span className="rx-bar__seg" data-kind="blank" style={{ width: `${pct(marks.gapBlank)}%` }} />
      </div>
      <ul className="rx-counts" aria-label="Your answers">
        <li data-kind="scored"><b>{marks.right}</b> right</li>
        <li data-kind="wrong"><b>{marks.wrong}</b> wrong</li>
        <li data-kind="blank"><b>{marks.blank}</b> blank</li>
      </ul>
      {finding ? (
        <div className="rx-finding">
          <p className="rx-finding__line">{finding.line}</p>
          {finding.detail ? <p className="rx-finding__detail">{finding.detail}</p> : null}
        </div>
      ) : null}
      {notice ? (
        <p className="rx-notice" role="status">
          <AlertTriangle size={15} strokeWidth={2.2} aria-hidden="true" />
          <span>{notice.text}{Number.isInteger(notice.number) && onNotice ? <> <button type="button" className="rx-link" onClick={() => onNotice(notice.number)}>See Q{notice.number}</button></> : null}</span>
        </p>
      ) : null}
    </div>
  );
}
