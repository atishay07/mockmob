"use client";
// The result's summary card (N12, 17 Oct night: the owner wants the earlier result back, with Mobi and the full
// screen of information). One card, in the order a student reads it:
//   Mobi's reveal beside the receipt (12-hour time), the score rolling into place beside its denominator, the plain finding
//   (which chapter cost the most, how many of the missed marks), Mobi's line, the four counts, the answer map
//   (every question, one bubble, opens that answer), then the one next move with Repair's value and cost.
// Mobi follows the server's recap tone (reaction.js, the app's table); never in NTA mode and never sleepy.
import { AlertTriangle } from 'lucide-react';
import MobiReact from '@/components/brand/MobiReact';
import { useCallback, useRef } from 'react';
import RollNumber from '@/lib/motion/RollNumber';
import { durations } from '@/lib/motion/tokens.g.js';
import { stampFigure } from '@/lib/motion/stampFigure';
import { earnsRing } from '@/lib/motion/stampPlan';
import { heroAct } from './heroAct.mjs';

// R8 PRAC-14: the receipt never breaks a time from its AM / PM, or a duration between its minutes and seconds.
const keepTogether = (text) => (typeof text === 'string' ? text.replace(/(\d)[ \u202f](AM|PM|am|pm)(?![a-z])/g, '$1\u00a0$2').replace(/(\d+m) (\d+s)/g, '$1\u00a0$2') : text);

// The score arrives as the app's finish does (owner LK95, 5 Nov: "how to build UI exactly like the app, animations"):
// on the first open each digit rolls up into its own slot (RollNumber, the app's MonumentalNumber, left to right, at the owner's
// 720 ms result tempo (G31, 19 Oct: a quicker roll felt rushed), once the page has settled, so the page's arrival never swallows it, G31), and the figure is stamped as the
// last digit lands (stampFigure, the app's FinishCeremony: 1.12 to 1, 420 ms). A good set (70% right or more) with
// Celebrations on Full also gets the one ink ring; never in NTA mode. Celebrations Off, reduced motion and a return
// visit show the score at once.
function Score({ value, negative, tone, run, ring }) {
  const figure = useRef(null);
  const ringRef = useRef(null);
  const onRoll = useCallback(({ landsIn }) => {
    stampFigure({ figure: figure.current, ring: ring ? ringRef.current : null, landsIn });
  }, [ring]);
  return (
    <b data-tone={tone}>
      <span ref={figure} className="mk-figure">
        {negative ? '−' : ''}<RollNumber value={value} run={run} settle ms={durations.countUp} onRoll={onRoll} />
        <span ref={ringRef} className="mk-figure__ring" aria-hidden="true" />
      </span>
    </b>
  );
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
export default function ResultHero({ receipt, marks, finding, reaction = null, holdStill = false, notice = null, onNotice, arrive = false, strip = null, next = null, unit = 'marks', repairReceipt = null, celebrations = 'full', nta = false }) {
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
        <p className="rp-eyebrow">{keepTogether(receipt)}</p>
        <h1 className="rp-hero__score" aria-label={`${marks.scored} of ${marks.max} ${unit}`}>
          <Score value={Math.abs(marks.scored)} negative={marks.scored < 0} tone={tone} run={arrive && celebrations !== 'off'}
            ring={celebrations === 'full' && !nta && earnsRing(marks)} /><span>/ {marks.max} {unit}</span>
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
