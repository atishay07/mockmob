"use client";

// Interactive explainer for the core loop: replay -> find the leak -> one next move -> check later.
// Every number on this stage belongs to ONE illustrative session and is labelled as such.
// Steps 1-3 describe what the product records today (answers, changes, timing, skips). Step 4
// (delayed fresh checks) is shown with its real release state, never as available.
import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Check, Clock, Lock, Minus, Pause, Play, RotateCcw, X } from 'lucide-react';
import { pipReact } from '@/components/brand/pipEvents';
import { useReadableRegion } from './useReadableRegion';
import { MascotSeat } from '@/components/brand/Mascot';

const SESSION = [
  { n: 1, first: 'right', final: 'right', time: '0:48' },
  { n: 2, first: 'right', final: 'right', time: '0:55' },
  { n: 3, first: 'wrong', final: 'wrong', time: '1:20' },
  { n: 4, first: 'right', final: 'wrong', time: '3:18', change: { from: 'B', to: 'D', at: '3:18', firstAt: '0:42' } },
  { n: 5, first: 'right', final: 'right', time: '1:02' },
  { n: 6, first: 'skip', final: 'skip', time: '0:20' },
  { n: 7, first: 'right', final: 'right', time: '3:12', slow: true },
  { n: 8, first: 'right', final: 'wrong', time: '2:41', change: { from: 'A', to: 'C', at: '2:41', firstAt: '1:05' } },
  { n: 9, first: 'wrong', final: 'right', time: '1:50', change: { from: 'D', to: 'B', at: '1:50', firstAt: '0:30' } },
  { n: 10, first: 'skip', final: 'skip', time: '0:10' },
];
const MARK = { right: 5, wrong: -1, skip: 0 };
const STEPS = [
  { key: 'replay', title: 'Replay the session', body: 'See recorded answers and timing beside the session score.', ms: 4800 },
  { key: 'leak', title: 'Find where marks leaked', body: 'Compare mistakes, skips and answer changes when the session has timing data.', ms: 4800 },
  { key: 'move', title: 'Get one next move', body: 'One suggestion from your record, shared by Today, Radar and PrepOS. A next step, not a diagnosis.', ms: 4800 },
  { key: 'check', title: 'Check it on fresh questions', body: 'A fresh question checks what you remember later. The panel below shows whether this pathway is available.', ms: 4800 },
];
const REVEAL_MS = 360;

function statusLabel(tile) {
  const end = tile.final === 'right' ? 'ended right' : tile.final === 'wrong' ? 'ended wrong' : 'left blank';
  return `Question ${tile.n}: ${end}${tile.change ? ', answer changed' : ''}`;
}

function inspectorText(tile) {
  if (!tile) return 'Tap a question to see what happened.';
  if (tile.change) {
    const { from, to, at, firstAt } = tile.change;
    if (tile.first === 'right' && tile.final === 'wrong') return `Q${tile.n}: answered ${from} at ${firstAt} (right). Changed to ${to} at ${at}. That change turned +5 into −1, a 6-mark swing.`;
    return `Q${tile.n}: answered ${from} at ${firstAt} (wrong). Changed to ${to} at ${at} and got it right. That change gained 6 marks.`;
  }
  if (tile.final === 'skip') return `Q${tile.n}: left blank. Nothing gained, nothing lost.`;
  return `Q${tile.n}: ${tile.final === 'right' ? 'right' : 'wrong'} in ${tile.time}${tile.slow ? ', about three times your usual pace.' : '.'}`;
}

export default function MistakeLab({ recoveryState = 'blocked_content', recoveryReason = '' }) {
  const rootRef = useRef(null);
  const readingRef = useRef(null);
  const progressRef = useRef(null);
  const clockRef = useRef({ token: 0, elapsed: 0 });
  const [timeline, setTimeline] = useState({ step: 0, token: 0 });
  const { step, token } = timeline;
  const [playing, setPlaying] = useState(true);
  const inView = useReadableRegion(readingRef);
  const [hold, setHold] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [revealed, setRevealed] = useState(0);
  const [picked, setPicked] = useState(null);
  const [pipPresent, setPipPresent] = useState(false);
  const keyboardStep = useRef(false);
  useEffect(() => {
    const sync = () => setPipPresent(document.documentElement.dataset.pipPerch === 'lab' && document.documentElement.dataset.pipPerchVisible === 'true');
    sync(); window.addEventListener('pip:presence', sync);
    return () => window.removeEventListener('pip:presence', sync);
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const running = playing && inView && !hold && !reduced;

  // The page's peak: Pip (perched beside this lab) watches the replay and jumps once when the
  // leak becomes one next move. Later loops only get a nod.
  useEffect(() => {
    rootRef.current.dataset.pipMove = String(inView && step === 2);
    if (!inView || keyboardStep.current) return;
    const key = STEPS[step].key;
    if (key === 'move') {
      pipReact('lab', 'eureka');
    } else if (key === 'leak' && pipPresent) pipReact('lab', 'nod');
  }, [step, inView, pipPresent]);

  // A single elapsed clock owns the step, question reveals and visible progress.
  // Leaving the reading region preserves elapsed time; it never catches up offscreen.
  useEffect(() => {
    if (!running) return undefined;
    const duration = STEPS[step].ms;
    const elapsed = clockRef.current.elapsed;
    const start = performance.now();
    const bar = progressRef.current;
    const animation = bar?.animate([
      { transform: `scaleX(${elapsed / duration})` }, { transform: 'scaleX(1)' },
    ], { duration: Math.max(1, duration - elapsed), fill: 'forwards', easing: 'linear' });
    let timer;
    const tick = () => {
      const time = Math.min(duration, elapsed + performance.now() - start);
      if (step === 0) {
        const count = Math.min(SESSION.length, Math.floor(time / REVEAL_MS));
        setRevealed(count);
        if (count === SESSION.length) setPicked(value => value ?? 3);
      }
      if (time >= duration) {
        clockRef.current = { token: token + 1, elapsed: 0 };
        setTimeline({ step: (step + 1) % STEPS.length, token: token + 1 });
        if (step === STEPS.length - 1) { setRevealed(0); setPicked(null); }
        return;
      }
      const nextReveal = step === 0 && time < SESSION.length * REVEAL_MS ? REVEAL_MS - time % REVEAL_MS : duration - time;
      timer = window.setTimeout(tick, Math.max(1, Math.min(nextReveal, duration - time)));
    };
    timer = window.setTimeout(tick, 0);
    return () => {
      window.clearTimeout(timer);
      if (clockRef.current.token === token) {
        clockRef.current.elapsed = Math.min(duration, elapsed + performance.now() - start);
        if (bar) bar.style.transform = `scaleX(${clockRef.current.elapsed / duration})`;
      }
      animation?.cancel();
    };
  }, [step, token, running]);

  useEffect(() => {
    if (!reduced || step !== 0) return undefined;
    const id = window.setTimeout(() => { setRevealed(SESSION.length); setPicked(3); }, 0);
    return () => window.clearTimeout(id);
  }, [reduced, step]);

  const goTo = (index) => {
    const nextToken = clockRef.current.token + 1;
    clockRef.current = { token: nextToken, elapsed: 0 };
    setTimeline({ step: index, token: nextToken });
    if (index === 0) { setRevealed(reduced ? SESSION.length : 0); setPicked(reduced ? 3 : null); }
  };

  const shown = SESSION.slice(0, revealed);
  const marks = shown.reduce((sum, tile) => sum + MARK[tile.final], 0);
  const right = shown.filter((tile) => tile.final === 'right').length;
  const wrong = shown.filter((tile) => tile.final === 'wrong').length;
  const blank = shown.filter((tile) => tile.final === 'skip').length;
  const tilePicked = picked === null ? null : SESSION[picked];

  return (
    // The tour keeps playing under a passing cursor or a tap. Only keyboard focus holds it, so a
    // keyboard user is never moved on mid-read; the explicit button pauses it for everyone.
    <div className="ml" ref={rootRef} data-playing={running} onFocus={(event) => { if (event.target.matches?.(':focus-visible')) setHold(true); }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHold(false); }}>
      <div className="ml__rail">
        <ol className="ml__steps">
          {STEPS.map((item, index) => {
            const active = index === step;
            return (
              <li key={item.key} data-active={active} data-done={index < step}>
                <button type="button" aria-label={item.title} onClick={(event) => { keyboardStep.current = event.detail === 0; setPlaying(false); goTo(index); if (index === 0) { clockRef.current.elapsed = SESSION.length * REVEAL_MS; setRevealed(SESSION.length); setPicked(3); } }} aria-current={active ? 'step' : undefined}>
                  <span className="ml__num">{String(index + 1).padStart(2, '0')}</span>
                  <span className="ml__label">{item.title}</span>
                  <span className="ml__short" aria-hidden="true">{['Replay', 'Find', 'Next move', 'Check'][index]}</span>
                  <i className="ml__bar" aria-hidden="true">
                    {active ? <b ref={progressRef} key={token} data-auto={!reduced} /> : null}
                  </i>
                </button>
              </li>
            );
          })}
        </ol>
        {/* All four descriptions share one slot sized to the tallest, so changing step never
            changes the rail's height or moves anything below it. */}
        <div className="ml__caption">
          {STEPS.map((item, index) => <p key={item.key} data-active={index === step} aria-hidden={index !== step}>{item.body}</p>)}
        </div>
        <div className="ml__controls"><button type="button" className="ml__pause" onClick={() => { keyboardStep.current = false; setPlaying((value) => !value); }} disabled={reduced}>
          {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
          {reduced ? 'Auto-play is off (reduced motion)' : playing ? 'Pause the tour' : 'Resume the tour'}
        </button>
        <button type="button" className="ml__restart" onClick={(event) => { keyboardStep.current = event.detail === 0; goTo(0); setPlaying(true); }}><RotateCcw size={15} aria-hidden="true" />Replay</button></div>
      </div>

      <figure className="ml__stage" aria-label="Example session, illustrative data">
        <div className="ml__bar-top">
          <div className="ml__session-label"><span>Example session · Accountancy · 10 questions</span><span className="ml__tag">Illustrative data</span></div>
          <MascotSeat station="lab-inline" pose="attentive" label="Mobi follows the replay." className="pip-seat--lab-inline" />
        </div>

        <div className="ml__panels">
          <span className="ml__reading-region" ref={readingRef} aria-hidden="true" />
          {/* 1. Replay */}
          <section className="ml__panel" data-active={step === 0} aria-hidden={step !== 0} inert={step !== 0 ? true : undefined} aria-label="Replay the session">
            <div className="ml__score" aria-live={running ? 'off' : 'polite'}>
              <span className="ml__marks"><b>{marks}</b><small>/ 50 marks</small></span>
              <span className="ml__counts"><i data-k="right">{right} right</i><i data-k="wrong">{wrong} wrong</i><i data-k="skip">{blank} blank</i></span>
            </div>
            <ul className="ml__tiles">
              {SESSION.map((tile, index) => {
                const on = index < revealed;
                return (
                  <li key={tile.n}>
                    <button type="button" className="ml__tile" data-state={on ? tile.final : 'idle'} data-picked={picked === index} onClick={() => { if (on) setPicked(index); }} disabled={!on} aria-label={on ? statusLabel(tile) : `Question ${tile.n}`}>
                      <span className="ml__tn">{tile.n}</span>
                      {on ? (tile.final === 'right' ? <Check size={16} aria-hidden="true" /> : tile.final === 'wrong' ? <X size={16} aria-hidden="true" /> : <Minus size={16} aria-hidden="true" />) : null}
                      {on && tile.change ? <span className="ml__swap" aria-hidden="true"><ArrowLeftRight size={11} /></span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="ml__inspect" aria-live="polite">{inspectorText(tilePicked)}</p>
          </section>

          {/* 2. Leak */}
          <section className="ml__panel" data-active={step === 1} aria-hidden={step !== 1} inert={step !== 1 ? true : undefined} aria-label="Find where marks leaked">
            <p className="ml__eyebrow">From the session record</p>
            <ul className="ml__leaks">
              <li style={{ '--i': 0, '--w': '100%' }}>
                <div><b>Answer changes</b><span>3 changes, net −6 marks</span></div>
                <i aria-hidden="true"><em data-bad="true" /></i>
                <p>Q4 and Q8 changed from right to wrong. Q9 changed from wrong to right; its gain is counted too.</p>
              </li>
              <li style={{ '--i': 1, '--w': '62%' }}>
                <div><b>Slowest question</b><span>Q7 took 3:12</span></div>
                <i aria-hidden="true"><em /></i>
                <p>About three times the typical 1:05 in this session.</p>
              </li>
              <li style={{ '--i': 2, '--w': '38%' }}>
                <div><b>Left blank</b><span>2 questions, 10 marks open</span></div>
                <i aria-hidden="true"><em /></i>
                <p>Q6 and Q10. No penalty, no marks earned.</p>
              </li>
            </ul>
          </section>

          {/* 3. Move */}
          <section className="ml__panel" data-active={step === 2} aria-hidden={step !== 2} inert={step !== 2 ? true : undefined} aria-label="Get one next move">
            <p className="ml__eyebrow">Your next move</p>
            <div className="ml__move">
              <h3>Try 10 questions. Change an answer only when you can name the rule that makes it wrong.</h3>
              <p className="ml__why">Why this: in this session, changed answers cost the most (net −6 marks).</p>
              <div className="ml__where" aria-label="Shown in">
                <span>Today</span><span>Radar</span><span>PrepOS</span><span>Results</span>
              </div>
            </div>
            <p className="ml__note">A suggestion from one session, not a diagnosis of why you changed answers. More sessions strengthen the evidence.</p>
          </section>

          {/* 4. Check */}
          <section className="ml__panel" data-active={step === 3} aria-hidden={step !== 3} inert={step !== 3 ? true : undefined} aria-label="Check it on fresh questions">
            <p className="ml__eyebrow">Fresh checks, never repeated questions</p>
            <ol className="ml__checks">
              {[['Tomorrow', 'First check'], ['In 3 days', 'Second check'], ['In a week', 'Does it hold?']].map(([when, what], i) => (
                <li key={when} style={{ '--i': i }}>
                  <span className="ml__checkicon">{i === 0 ? <Clock size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}</span>
                  <div><b>{when}</b><span>{what}</span></div>
                  <em>New questions only</em>
                </li>
              ))}
            </ol>
            <p className="ml__status" data-state={recoveryState}>
              {recoveryState === 'available' ? 'Available on supported concepts.' : 'Rolling out. ' + (recoveryReason || 'Delayed checks open once their questions pass source and calibration review.')}
            </p>
          </section>
        </div>

        <figcaption>Illustrative. These values are an example, not your score, and not a prediction of marks you could recover.</figcaption>
      </figure>
    </div>
  );
}
