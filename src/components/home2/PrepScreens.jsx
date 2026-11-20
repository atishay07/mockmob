'use client';

// The four screens of the one product frame (section 3), each a faithful, simplified picture of the app's own screen on the
// app's own surface (Day and Night follow the page): the exam runner, the Mistake Lab, Ask Mobi with a brought mistake, and
// DU Compass.
//
// Every figure is the product's: the runner's question 3 and its strings (homeCopy EXAM, from TestPageClient.jsx), the
// example mock of the Mistake Lab (labStory.mjs, the same student as section 5), the live home's worked example of a brought
// mistake (bringMistakeCopy.mjs) with its price from the app's constants (handed down as `price`), and DU's own 2026 Round 1
// cutoffs (src/lib/du/showcase.js, read on the server and handed down as `aim`). The one value chosen here is the Compass
// example score, said as an example ("If your score were").
//
// The demo: each screen comes in in its own order when its row is on show (CSS only: [data-s] parts rise in after their
// --d delay, opacity and transform). Reduced motion, or before the page has woken, shows each screen finished. Aim is a still
// (Revision 2: the page has one interactive Compass, section 7, and this screen links down to it).
import { Check, ShieldCheck, X } from 'lucide-react';
import { MobiMark } from '@/components/brand/BrandIcon';
import { labStory, signed } from '../landing/labStory.mjs';
import { AIM, FIX, PRACTICE } from './homeNextCopy.mjs';
import FullScreenTry from './FullScreenTry';

const S = labStory();
const LETTERS = ['A', 'B', 'C', 'D'];
const d = (ms) => ({ '--d': `${ms}ms` });
const ONE_DECIMAL = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const cutoff = (n) => ONE_DECIMAL.format(n);

// ---------- Practise: the exam runner, question 3 of a quick practice ----------
// The demo picks A (a mock never says right or wrong mid-paper; the pick is saved as it is made, so the bar says so). Under the
// picture: the NTA line and the key into the full-screen runner (phones).
const PICK_AT = 1500;
export function PracticeScreen() {
  const q = PRACTICE.question;
  return (
    <div className="hn-s hn-s--run">
      <div className="hn-run__top">
        <p className="hn-run__who"><b>{PRACTICE.subject}</b><span>{PRACTICE.attempt}</span></p>
        <p className="hn-run__right">
          <span className="hn-run__saved" data-s style={d(PICK_AT + 300)}><Check size={13} strokeWidth={2.8} aria-hidden="true" />Saved</span>
          <span className="hn-run__timer"><span className="hn-sr">{PRACTICE.timer} </span>{PRACTICE.clock}</span>
        </p>
      </div>
      <p className="hn-run__meta">
        <b>{PRACTICE.heading}</b>
        <span className="hn-chip">{q.chapter}</span>
        <span className="hn-chip hn-chip--quiet">{q.difficulty}</span>
      </p>
      <p className="hn-run__stem" data-s style={d(60)}>{q.text}</p>
      <ul className="hn-run__opts">
        {q.options.map((text, i) => (
          <li key={text} data-s style={d(160 + i * 80)}>
            <b className="hn-run__key">{LETTERS[i]}</b>
            <span>{text}</span>
            {i === 0 ? (
              <span className="hn-run__pick" data-s="swap" style={d(PICK_AT)} aria-hidden="true">
                <b className="hn-run__key">{LETTERS[i]}</b>
                <Check size={15} strokeWidth={2.6} className="hn-run__tick" />
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="hn-run__nta">
        <p><span className="hn-chip hn-chip--nta">NTA style</span>{PRACTICE.nta}</p>
        <FullScreenTry label={PRACTICE.full} />
      </div>
    </div>
  );
}

// ---------- See: the Mistake Lab's chapter view of the example mock ----------
export function SeeScreen() {
  return (
    <div className="hn-s hn-s--see">
      <div className="hn-lab__top">
        <p className="hn-lab__who"><b>Accountancy</b><span>Sample mock</span></p>
        <p className="hn-lab__score"><b>{S.facts.marks}</b><span>/ {S.facts.outOf}</span></p>
      </div>
      <p className="hn-s__h">Where your marks went</p>
      <p className="hn-s__lead">You lost {S.lostMarks} marks in this mock. Here is where, by chapter.</p>
      <ol className="hn-lab__rows">
        {S.chapters.map((c, i) => (
          <li key={c.chapter} className="hn-lab__row" data-s style={d(140 + i * 140)} data-worst={i === 0 && c.lost ? 'true' : undefined} data-clear={c.lost ? undefined : 'true'}>
            <span className="hn-lab__name"><b>{c.chapter}</b><small>{c.right} of {c.of} right</small></span>
            {i === 0 && c.lost ? <em className="hn-flag">Fix first</em> : <span />}
            <b className="hn-lab__lost">{signed(-c.lost)}</b>
            <span className="hn-lab__track" aria-hidden="true"><i data-s="bar" style={{ '--w': c.share, ...d(320 + i * 140) }} /></span>
          </li>
        ))}
      </ol>
      {S.earlierLine ? <p className="hn-s__foot" data-s style={d(900)}>{S.earlierLine}</p> : null}
    </div>
  );
}

// ---------- Fix: a mistake brought from another test, Mobi's read, what you leave with and its price ----------
export function FixScreen({ price }) {
  return (
    <div className="hn-s hn-s--fix">
      <p className="hn-fix__meta"><MobiMark size={20} /><b>Ask Mobi</b><span className="hn-chip">{FIX.from}</span></p>
      <p className="hn-fix__stem">{FIX.q}</p>
      <ul className="hn-fix__picks">
        <li data-tone="bad" data-s style={d(120)}><em><X size={12} strokeWidth={3} aria-hidden="true" />You chose</em><b>{FIX.chose}</b></li>
        <li data-tone="good" data-s style={d(260)}><em><Check size={12} strokeWidth={3} aria-hidden="true" />Answer</em><b>{FIX.key}</b></li>
      </ul>
      <p className="hn-chat__mobi" data-s style={d(700)}><MobiMark size={20} className="hn-chat__face" /><span><b>{FIX.slipLabel}.</b> {FIX.slip}</span></p>
      <div className="hn-fix__leave" data-s style={d(1300)}>
        <p className="hn-fix__leave-h">{FIX.leave.label}</p>
        <ul>
          {FIX.leave.items.map((item) => (
            <li key={item.lead}><b>{item.figure != null ? `${item.figure} ${item.lead}` : item.lead}</b><span>{item.line}</span></li>
          ))}
        </ul>
      </div>
      {price ? <p className="hn-fix__price" data-s style={d(1500)}><ShieldCheck size={14} aria-hidden="true" />{price}</p> : null}
    </div>
  );
}

// ---------- Aim: a still of DU Compass, a score against DU's own 2026 cutoffs, and the way down to try it ----------
export function AimScreen({ aim }) {
  if (!aim) return <div className="hn-s hn-s--aim"><p className="hn-s__h">DU Compass</p><p className="hn-s__lead">Your score against real DU cutoffs.</p></div>;
  const cleared = aim.rows.filter((r) => aim.score >= r.cutoff).length;
  return (
    <div className="hn-s hn-s--aim">
      <p className="hn-aim__meta"><b>{aim.programme}</b><span>{aim.category}, {aim.round}, {aim.cycle}</span></p>
      <p className="hn-aim__q">{AIM.ask} <b>{aim.score}</b><span> / {aim.max}</span></p>
      <div className="hn-aim__track" aria-hidden="true">
        <i className="hn-aim__fill" style={{ '--w': aim.score / aim.max }} />
        {aim.rows.map((r) => <i key={r.college} className="hn-aim__cut" style={{ left: `${(r.cutoff / aim.max) * 100}%` }} />)}
      </div>
      <ol className="hn-aim__rows">
        {aim.rows.map((r) => {
          const clear = aim.score >= r.cutoff;
          return (
            <li key={r.college} data-clear={clear ? 'true' : 'false'}>
              <span className="hn-aim__name">{r.college}</span>
              <span className="hn-aim__cutoff">{cutoff(r.cutoff)}</span>
              <em className="hn-aim__verdict">{clear ? <><Check size={13} strokeWidth={3} aria-hidden="true" />Clears it</> : `Short by ${cutoff(r.cutoff - aim.score)}`}</em>
            </li>
          );
        })}
      </ol>
      <p className="hn-aim__sum"><b>{cleared} of {aim.rows.length}</b> cleared on DU’s {aim.cycle} {aim.round} cutoffs.</p>
      <a href={AIM.href} className="hn-aim__down">{AIM.down}</a>
    </div>
  );
}

export const PREP_SCREENS = { practise: PracticeScreen, see: SeeScreen, fix: FixScreen, aim: AimScreen };
