"use client";
// The result's summary card (N12, 17 Oct night: the owner wants the earlier result back, with Mobi and the full
// screen of information). One card, in the order a student reads it:
//   Mobi's reveal beside the receipt (12-hour time), the score counting up to its denominator, the plain finding
//   (which chapter cost the most, how many of the missed marks), Mobi's line, the four counts, the answer map
//   (every question, one bubble, opens that answer), then the one next move with Repair's value and cost.
// Mobi follows the server's recap tone (reaction.js, the app's table); never in NTA mode and never sleepy.
import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import MobiReact from '@/components/brand/MobiReact';
import { heroAct } from './heroAct.mjs';

const still = () => {
  try { return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; }
};

// The score counts up once on the first open (700 ms, ease-out); a return visit and reduced motion show it at once.
function CountUp({ value, run }) {
  const [shown, setShown] = useState(() => (run ? 0 : value));
  useEffect(() => {
    if (!run || !value || still()) { queueMicrotask(() => setShown(value)); return undefined; }
    let raf; let start;
    const step = (t) => { start ??= t; const p = Math.min((t - start) / 700, 1); setShown(Math.round(value * (1 - (1 - p) ** 3))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, run]);
  return shown;
}

/**
 * receipt   "Accountancy full mock. Recorded 9:41 PM, 46m 36s."
 * marks     analysis.marks
 * finding   { line, detail } from costliestLine, or null
 * reaction  mobiReaction(...) or null (NTA, Celebrations off)
 * still     Mobi holds still once the student is reading or repairing
 * notice    { text, number } a key under re-check or a correction, or null
 * strip     the answer map (rendered by the page; it owns the jumps)
 * repairReceipt  { lead, strong } what the repairs made before this paper did on it (data/repair_receipt.mjs), or null
 * next      the next-move panel (rendered by the page)
 */
export default function ResultHero({ receipt, marks, finding, reaction = null, holdStill = false, notice = null, onNotice, arrive = false, strip = null, next = null, unit = 'marks', repairReceipt = null }) {
  const answered = marks.right + marks.wrong;
  const accuracy = answered ? Math.round((marks.right / answered) * 100) : null;
  const tone = marks.scored < 0 ? 'bad' : marks.max && marks.scored / marks.max >= 0.4 ? 'good' : 'mid';
  const verdict = !marks.gap
    ? 'Every question right. Nothing to repair.'
    : finding?.line || (marks.wrong && marks.gapWrong >= marks.gapBlank
      ? `${marks.wrong} wrong answer${marks.wrong === 1 ? '' : 's'} cost ${marks.gapWrong} of the ${marks.gap} marks you missed.`
      : `${marks.blank} blank${marks.blank === 1 ? '' : 's'} left ${marks.gapBlank} marks unearned.`);
  return (
    <header className="rp-hero rh" data-mobi={reaction ? undefined : 'none'} data-arrive={arrive || undefined}>
      {reaction ? <div className="rp-hero__pip rh-pip"><MobiReact act={heroAct(reaction.act)} size={96} label={reaction.alt} still={holdStill} /></div> : null}
      <div className="rp-hero__main">
        <p className="rp-eyebrow">{receipt}</p>
        <h1 className="rp-hero__score" aria-label={`${marks.scored} of ${marks.max} ${unit}`}>
          <b data-tone={tone}>{marks.scored < 0 ? '−' : ''}<CountUp value={Math.abs(marks.scored)} run={arrive} /></b><span>/ {marks.max} {unit}</span>
        </h1>
        <p className="rh-verdict">{verdict}</p>
        {finding?.detail && marks.gap ? <p className="rp-hero__line">{finding.detail}{reaction?.line ? ` ${reaction.line}` : ''}</p> : reaction?.line ? <p className="rp-hero__line">{reaction.line}</p> : null}
        {repairReceipt ? <p className="rh-receipt">{repairReceipt.lead} <b>{repairReceipt.strong}</b></p> : null}
        {notice ? (
          <p className="rx-notice" role="status">
            <AlertTriangle size={15} strokeWidth={2.2} aria-hidden="true" />
            <span>{notice.text}{Number.isInteger(notice.number) && onNotice ? <> <button type="button" className="rx-link" onClick={() => onNotice(notice.number)}>See Q{notice.number}</button></> : null}</span>
          </p>
        ) : null}
      </div>
      <dl className="rp-stats">
        <div data-kind="right"><dt>Right</dt><dd><span className="rp-stat__value">{marks.right}</span><small>+{marks.right * 5}</small></dd></div>
        <div data-kind="wrong"><dt>Wrong</dt><dd><span className="rp-stat__value">{marks.wrong}</span><small>{marks.wrong ? `−${marks.wrong}` : '0'}</small></dd></div>
        <div data-kind="blank"><dt>Blank</dt><dd><span className="rp-stat__value">{marks.blank}</span><small>0</small></dd></div>
        <div><dt>Accuracy</dt><dd><span className="rp-stat__value">{accuracy === null ? 'None' : `${accuracy}%`}</span><small>of answered</small></dd></div>
      </dl>
      {strip}
      {next ? <div className="rh-next">{next}</div> : null}
    </header>
  );
}
