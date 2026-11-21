'use client';

// The Mob row's screen for the home page's one-place frame (owner LK365, 21 Nov 2026). One app screen the demo cursor works
// (mobStory.mjs MOB_STORY.steps): the den with its code and its seats, the sprint card where everyone's five marks land, the
// podium order with the trap flagged, and Fix it together's fresh question on a sheet that rises over it.
// It mirrors the real screens (opened at 390x844 before building, tmp/1121-stories/story-mob/real/):
//   the den        src/components/mob/den/DenV3.jsx + DenStage.jsx (/preview/mob-den): Mob name, "Economics, 4 of you",
//                  the seat row of Folds with names and an open seat, the invite card's code and Copy the code.
//   the sprint     src/components/mob/den/DenMoments.jsx's open-game card and src/components/mob/v3/play/MobGame.jsx
//                  (/preview/mob-play): "Your sprint", "5 Economics questions. Be the first to set a run.", the volt key.
//   the podium     src/components/mob/v3/play/Podium.jsx (places by marks) and its trap card ("Question 3 caught most of you").
//   Fix it together src/components/mob/v3/play/FixTogether.jsx: RunHead "Fix it together" / "Chai Circle, one trap",
//                  "One fresh question, only for you", lettered options, "Right. That one is fixed for you." and the reason.
// Every word, rule and number comes from mobStory.mjs, which names each one's source. The fresh question is `sample`, the
// home page's public Economics question that page.js reads on the server (sampleFive.mjs publicSample('Economics')).
//
// Motion: transform and opacity only, keyed off data-phase and data attributes; what follows a click is a few short
// timeouts (friends arriving, the runs landing, the game closing), cleared on unmount. Reduced motion (the system setting or
// html[data-motion='reduced']): each click shows its end state at once. The height never changes: the den, the card and the
// sheet keep fixed rows, and the sheet shares the screen's grid cells.
import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Minus, X } from 'lucide-react';
import { MOB_DEN, MOB_RULES, MOB_TIMING, MOB_TRAP, MOB_WORDS, mobBoard } from './mobStory.mjs';
import './mob-story.css';

const BOARD = mobBoard();
const FRIENDS = BOARD.length - 1;
const LETTERS = ['A', 'B', 'C', 'D'];
const QUESTIONS = Array.from({ length: MOB_RULES.count }, (_, q) => q + 1);
const OPEN_SEATS = MOB_RULES.seats - BOARD.length;

function reducedNow() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';
}

const head = (fold) => `/mob/folds/fold-${fold}-head@128.webp`;
const signedMarks = (m) => (m > 0 ? `+${m}` : m < 0 ? `−${-m}` : '0');

export default function MobStory({ sample = null }) {
  const [copied, setCopied] = useState(false);
  const [arrived, setArrived] = useState(0);
  const [started, setStarted] = useState(false);
  const [closed, setClosed] = useState(false);
  const [hour, setHour] = useState(0);
  const [podium, setPodium] = useState(false);
  const [fixOpen, setFixOpen] = useState(false);
  const [pick, setPick] = useState(null);
  const timers = useRef(new Set());

  useEffect(() => {
    const set = timers.current;
    return () => { for (const id of set) window.clearTimeout(id); set.clear(); };
  }, []);
  const later = (ms, fn) => {
    const id = window.setTimeout(() => { timers.current.delete(id); fn(); }, ms);
    timers.current.add(id);
  };

  // Copy the code: the den never touches the clipboard here (a sample code); the friends who got it take their seats.
  const invite = () => {
    if (copied) return;
    setCopied(true);
    if (reducedNow()) { setArrived(FRIENDS); return; }
    MOB_TIMING.arrive.slice(0, FRIENDS).forEach((at, i) => later(at, () => setArrived((n) => Math.max(n, i + 1))));
  };
  // Start the sprint: everyone's runs land over the 24 hours, then the game closes. Pressed before the code went out, the
  // friends arrive at once (the screen never breaks out of order).
  const start = () => {
    if (started) return;
    if (!copied) { setCopied(true); setArrived(FRIENDS); }
    setStarted(true);
    if (reducedNow()) { setClosed(true); return; }
    // The clock moves on as each friend's run lands (the second run onward), then the game closes.
    MOB_TIMING.runs.slice(1, MOB_WORDS.hoursLeft.length).forEach((at, i) => later(at, () => setHour(i + 1)));
    later(MOB_TIMING.closed, () => setClosed(true));
  };

  const phase = fixOpen ? 'fix' : podium ? 'podium' : closed ? 'closed' : started ? 'play' : copied ? 'invite' : 'den';
  const answered = Number.isInteger(pick);
  const right = answered && sample && pick === sample.correct;
  const seated = 1 + arrived;

  return (
    <div className="st st-mob" data-phase={phase}>
      <div className="stm-screen" data-answered={answered ? 'true' : undefined}>
        {/* The den (DenV3 / DenStage): name, who is in, the seats, the code. */}
        <div role="group" className="stm-den stm-dim" aria-label={`${MOB_DEN.name}, ${MOB_WORDS.subtitle(seated)}`} inert={fixOpen || undefined}>
          <div className="stm-den__head">
            <p className="stm-den__name">{MOB_DEN.name}</p>
            <p className="stm-den__sub">{MOB_WORDS.subtitle(seated)}</p>
          </div>
          <ul className="stm-seats">
            {BOARD.map((m, i) => {
              const here = i === 0 || i <= arrived;
              return (
                <li key={m.id} className="stm-seat" data-here={here ? 'true' : 'false'} data-you={i === 0 ? 'true' : undefined}>
                  <span className="stm-seat__spot">
                    <span className="stm-seat__empty" aria-hidden="true">+</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="stm-seat__fold" src={head(m.fold)} alt="" width="48" height="48" decoding="async" />
                  </span>
                  <span className="stm-seat__name">{here ? m.name : <span className="lp-sr">{MOB_WORDS.openSeat}</span>}</span>
                </li>
              );
            })}
            {Array.from({ length: OPEN_SEATS }, (_, i) => (
              <li key={`open-${i}`} className="stm-seat" data-here="false" data-open="true">
                <span className="stm-seat__spot" role="img" aria-label={MOB_WORDS.openSeat}><span className="stm-seat__empty" aria-hidden="true">+</span></span>
                <span className="stm-seat__name stm-seat__name--open" aria-hidden="true">{MOB_WORDS.openSeat}</span>
              </li>
            ))}
          </ul>
          <div className="stm-code">
            <p className="stm-code__text"><span>Code</span><b>{MOB_DEN.code}</b></p>
            <button type="button" className="stm-key stm-key--line stm-code__key" data-demo="mob-share" data-done={copied ? 'true' : undefined} onClick={invite} aria-pressed={copied}>
              <span className="stm-code__icon stm-swap" aria-hidden="true">
                <span data-on={!copied ? 'true' : 'false'}><Copy size={16} /></span>
                <span data-on={copied ? 'true' : 'false'}><Check size={16} strokeWidth={3} /></span>
              </span>
              {MOB_WORDS.copyCode}
            </button>
          </div>
          <p className="lp-sr" aria-live="polite">{copied ? MOB_WORDS.codeCopied : ''}</p>
        </div>

        {/* The sprint card (the den's open game, MobGame), then the podium order with the trap. */}
        <div role="group" className="stm-game" aria-label={MOB_WORDS.gameTitle} inert={fixOpen || undefined}>
          <div className="stm-ghead stm-dim">
            <div className="stm-ghead__top">
              <p className="stm-ghead__title">{MOB_WORDS.gameTitle}</p>
              <span className="stm-clock" aria-hidden={!started || undefined}>
                <span className="stm-swap">
                  {MOB_WORDS.hoursLeft.map((text, i) => <span key={text} data-on={!closed && hour === i ? 'true' : 'false'}>{text}</span>)}
                  <span data-on={closed ? 'true' : 'false'}>{MOB_WORDS.closed}</span>
                </span>
              </span>
            </div>
            <span className="stm-hours" aria-hidden="true"><i style={{ '--run': `${MOB_TIMING.closed}ms` }} /></span>
            <p className="stm-ghead__line stm-swap">
              <span data-on={!started ? 'true' : 'false'}>{MOB_WORDS.openLine}</span>
              <span data-on={started && !podium ? 'true' : 'false'}>{MOB_WORDS.openLineRuns}</span>
              <span data-on={podium ? 'true' : 'false'} className="stm-trapline">{MOB_WORDS.trapCaught(MOB_TRAP)}</span>
            </p>
          </div>

          <div className="stm-rows stm-dim" role="table" aria-label="Everyone's five">
            <div className="stm-qs" role="row" aria-hidden="true">
              <span />
              {QUESTIONS.map((n) => <b key={n} data-trap={n === MOB_TRAP ? 'true' : undefined}>{n}</b>)}
              <span />
            </div>
            <div className="stm-runs">
              {BOARD.map((m, i) => {
                const here = i === 0 || i <= arrived;
                const runAt = MOB_TIMING.runs[i] ?? 0;
                return (
                  <div key={m.id} className="stm-run" role="row" data-here={here ? 'true' : 'false'} data-you={i === 0 ? 'true' : undefined}
                    style={{ '--shift': m.rank - m.seat }} aria-label={`${m.name}: ${signedMarks(m.marks)}`}>
                    <span className="stm-run__who" role="cell">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={head(m.fold)} alt="" width="30" height="30" decoding="async" />
                      <span>{m.name}</span>
                    </span>
                    {m.states.map((state, q) => (
                      <span key={q} className="stm-pip" role="cell" data-state={state} data-trap={q + 1 === MOB_TRAP ? 'true' : undefined}
                        style={{ '--d': `${runAt + q * MOB_TIMING.pip}ms` }}>
                        <span className="stm-pip__fill" aria-hidden="true">
                          {state === 'right' ? <Check size={14} strokeWidth={3} /> : state === 'wrong' ? <X size={14} strokeWidth={3} /> : <Minus size={14} strokeWidth={3} />}
                        </span>
                      </span>
                    ))}
                    <em className="stm-run__marks" role="cell">{signedMarks(m.marks)}</em>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="stm-foot stm-dim">
            <div className="stm-foot__slot" data-on={!started ? 'true' : 'false'}>
              <button type="button" className="stm-key stm-key--volt" data-demo="mob-start" onClick={start} disabled={started} tabIndex={started ? -1 : undefined}>{MOB_WORDS.startKey}</button>
            </div>
            <div className="stm-foot__slot" data-on={started && !closed ? 'true' : 'false'} aria-hidden={!(started && !closed) || undefined}>
              <p className="stm-sofar">{MOB_WORDS.runsSoFar}{BOARD.map((m, i) => <span key={m.id} style={{ '--d': `${(MOB_TIMING.runs[i] ?? 0) + MOB_RULES.count * MOB_TIMING.pip}ms` }}> {m.name}.</span>)}</p>
            </div>
            <div className="stm-foot__slot" data-on={closed && !podium ? 'true' : 'false'}>
              <button type="button" className="stm-key stm-key--volt" data-demo="mob-podium" onClick={() => setPodium(true)} disabled={!closed || podium} tabIndex={!closed || podium ? -1 : undefined}>{MOB_WORDS.seePodium}</button>
            </div>
            <div className="stm-foot__slot" data-on={podium ? 'true' : 'false'}>
              <button type="button" className="stm-key stm-key--volt" data-demo="mob-fix" onClick={() => setFixOpen(true)} disabled={!podium || !sample} tabIndex={!podium ? -1 : undefined} aria-expanded={fixOpen}>{MOB_WORDS.fixKey(MOB_TRAP)}</button>
            </div>
          </div>
        </div>

        {/* Fix it together (FixTogether.jsx, the fresh question): a sheet over the screen. */}
        {sample ? (
          <div role="group" className="stm-sheet" data-open={fixOpen ? 'true' : 'false'} inert={!fixOpen || undefined} aria-hidden={!fixOpen || undefined} aria-label={MOB_WORDS.fixTitle}>
            <div className="stm-sheet__head">
              <p className="stm-sheet__title">{MOB_WORDS.fixTitle}</p>
              <p className="stm-sheet__sub">{MOB_WORDS.fixSub}</p>
            </div>
            <p className="stm-sheet__label">{MOB_WORDS.freshTitle}</p>
            <p className="stm-sheet__stem">{sample.q}</p>
            <div className="stm-opts" role="radiogroup" aria-label={MOB_WORDS.freshTitle}>
              {sample.options.map((text, k) => {
                const isRight = answered && k === sample.correct;
                const isWrong = answered && k === pick && !right;
                return (
                  <button key={text} type="button" role="radio" aria-checked={pick === k} className="stm-opt" data-demo="mob-choice"
                    data-state={isRight ? 'right' : isWrong ? 'wrong' : answered ? 'dim' : undefined}
                    onClick={() => { if (!answered) setPick(k); }} aria-disabled={answered || undefined}>
                    <span className="stm-opt__letter">{LETTERS[k]}</span>
                    <span className="stm-opt__text">{text}</span>
                    {isRight ? <Check className="stm-opt__mark" size={18} strokeWidth={3} aria-hidden="true" /> : null}
                    {isWrong ? <X className="stm-opt__mark" size={18} strokeWidth={3} aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
            <div className="stm-result" role="status" data-on={answered ? 'true' : 'false'} data-tone={answered ? (right ? 'right' : 'wrong') : undefined}>
              {answered ? <><b>{right ? MOB_WORDS.fixRight : MOB_WORDS.fixWrong}</b> <span>{sample.why}</span></> : null}
            </div>
            <button type="button" className="stm-back" data-demo="mob-back" onClick={() => setFixOpen(false)}>{MOB_WORDS.backToDen}</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
