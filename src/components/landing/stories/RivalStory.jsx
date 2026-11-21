'use client';

// The Benchmarks row story (owner LK365, 21 Nov 2026): the feature working, worked by the demo cursor, one idea a beat.
// The script and every figure are in rivalStory.mjs (and where each comes from is said there).
// The screens mirror the real product:
//   * the lobby: src/components/ai/AIRivalArena.jsx (the rival list rows: a radio mark, the name, "78% accuracy  55 s a
//     question", the access line "Free today" or "2 credits" with a lock; the one volt "Start <name>" key);
//   * the run: AIRivalArena.jsx BattleScreen (its three figures: time left, answered, the benchmark's score; "Submit
//     benchmark"), with the run drawn as two lanes, you and the target, filling answer by answer;
//   * the result: AIRivalArena.jsx ResultScreen (its title, the rank title, "98 - 110", "You against <name>", your accuracy
//     against the benchmark's, your time against its time, Retry and Setup);
//   * the standing: src/app/(app)/leaderboard/LeaderboardPageClient.jsx (the big place "of N students who have sat a mock",
//     the ladder rows: place, a bar to one scale, the total, the mocks, "14 points to the next place up" and "You" on yours).
// Every change of state comes from a real click on a real button here (data-demo="rival-*"); what follows a click is CSS keyed
// off data-phase, data-ran and data-climb, or one short timeout (the run's end, the mock's points landing). The four views
// share one grid cell in a screen of fixed height, so nothing on the page moves between phases. Reduced motion: the end
// state of each step at once, every control still answers by hand.
import { useEffect, useState } from 'react';
import { Check, Lock, Play, RotateCcw, X } from 'lucide-react';
import {
  CLIMB_MS, DEFAULT_LEVEL, LEVELS, MOCK, MOCK_MARKS, MOCK_POINTS, QUESTIONS, RUN_MS, STANDING, STANDING_AFTER, SUBJECT,
  FREE_LINE, clock, landings, levelOf, ordinal, pointsTo, runFor,
} from './rivalStory.mjs';
import './rival-story.css';

function reducedNow() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';
}

// A value that changes on a state: the old one and the new one share a cell and cross over (opacity and a small rise).
function Swap({ from, to, className = '' }) {
  return (
    <span className={`st-rival__swap ${className}`.trim()}>
      <span className="st-rival__swap-from" aria-hidden="true">{from}</span>
      <span className="st-rival__swap-to">{to}</span>
    </span>
  );
}

export default function RivalStory() {
  const [level, setLevel] = useState(DEFAULT_LEVEL);
  const [stage, setStage] = useState('lobby'); // lobby | run | result
  const [tab, setTab] = useState('bench'); // bench | standing
  const [done, setDone] = useState(false); // the run has finished
  const [runKey, setRunKey] = useState(0);
  const [standKey, setStandKey] = useState(0);
  const [climb, setClimb] = useState(false);

  const run = runFor(level);
  const lv = levelOf(level);
  const youAt = landings(run.youSeconds);
  const themAt = landings(run.target.seconds);
  const youEnd = youAt[youAt.length - 1];
  const themEnd = themAt[themAt.length - 1];

  // The run ends on its own (the last answer lands), then Submit wakes.
  useEffect(() => {
    if (stage !== 'run' || done) return undefined;
    const id = window.setTimeout(() => setDone(true), reducedNow() ? 0 : RUN_MS);
    return () => window.clearTimeout(id);
  }, [stage, done, runKey]);

  // The standing opens, then the latest mock's points land and your row climbs.
  useEffect(() => {
    if (tab !== 'standing') return undefined;
    const id = window.setTimeout(() => setClimb(true), reducedNow() ? 0 : CLIMB_MS);
    return () => window.clearTimeout(id);
  }, [tab, standKey]);

  const start = () => { setTab('bench'); setDone(false); setStage('run'); setRunKey((n) => n + 1); };
  const openStanding = () => { if (tab === 'standing') return; setClimb(false); setTab('standing'); setStandKey((n) => n + 1); };
  const openBench = () => setTab('bench');

  const view = tab === 'standing' ? 'standing' : stage;
  const phase = view === 'standing' ? 'standing' : view === 'lobby' ? 'pick' : view === 'run' ? (done ? 'done' : 'run') : 'result';
  const on = (v) => (view === v ? { 'data-on': '' } : { inert: true, 'aria-hidden': true });
  const yourShare = (p) => p / STANDING.above.points; // one scale: the largest total shown

  return (
    <div className="st st-rival" data-phase={phase} data-level={level} data-ran={stage !== 'lobby' ? '' : undefined} data-climb={climb ? '' : undefined}>
      <div className="st-rival__screen">
        <div className="st-rival__bar">
          <div className="st-rival__tabs" role="tablist" aria-label="Benchmarks and your standing">
            <button type="button" role="tab" aria-selected={tab === 'bench'} className="st-rival__tab" data-demo="rival-bench" onClick={openBench}>Benchmarks</button>
            <button type="button" role="tab" aria-selected={tab === 'standing'} className="st-rival__tab" data-demo="rival-standing" onClick={openStanding}>Your standing</button>
          </div>
          <span className="st-rival__example">Example</span>
        </div>

        <div className="st-rival__views">
          {/* ---- 1. The lobby: the ladder of levels, the target, Start ---- */}
          <section className="st-rival__view st-rival__lobby" aria-label="Choose a benchmark" {...on('lobby')}>
            <div className="st-rival__ladder" role="radiogroup" aria-label="Benchmark levels">
              {LEVELS.map((l) => (
                <button key={l.id} type="button" role="radio" aria-checked={level === l.id} className="st-rival__level"
                  data-demo={`rival-level-${l.id}`} onClick={() => setLevel(l.id)}>
                  <span className="st-rival__mark" aria-hidden="true" />
                  <span className="st-rival__lname">{l.name}</span>
                  <span className="st-rival__lnums"><span><b>{l.accuracy}%</b> accuracy</span><span><b>{l.perQuestion} s</b> a question</span></span>
                  <span className="st-rival__access" data-free={l.free ? '' : undefined}>{l.free ? null : <Lock size={13} aria-hidden="true" />}{l.access}</span>
                </button>
              ))}
            </div>
            <div className="st-rival__target" aria-live="polite">
              <p className="st-rival__target-label">Your target, {lv.short}</p>
              <p className="st-rival__target-nums" key={level}>
                <span><b>{lv.accuracy}%</b> right</span>
                <span><b>{lv.perQuestion} s</b> a question</span>
              </p>
              <p className="st-rival__target-meta" key={`m-${level}`}>{QUESTIONS} questions in {lv.minutes} minutes</p>
            </div>
            <div className="st-rival__go">
              <button type="button" className="st-rival__start" data-demo="rival-start" onClick={start}>
                <Play size={17} aria-hidden="true" /> Start {lv.name}
              </button>
              <p className="st-rival__with">{SUBJECT}<span>{QUESTIONS} questions</span></p>
            </div>
          </section>

          {/* ---- 2. The run: the clock steps down, two lanes fill, answers tick right and wrong ---- */}
          <section className="st-rival__view st-rival__run" aria-label="The run" key={`run-${runKey}`} {...on('run')}>
            <p className="st-rival__runhead"><b>{lv.name}</b><span>{SUBJECT}, {QUESTIONS} questions</span></p>
            <div className="st-rival__metrics">
              <div className="st-rival__metric"><span>Time left</span>
                <b className="st-rival__steps" aria-label={`Time left ${run.ticks[run.ticks.length - 1]}`}>
                  {run.ticks.map((t, i) => <i key={i} style={{ '--at': `${i ? youAt[i - 1] : 0}ms`, '--off': `${i < youAt.length ? youAt[i] : 1e7}ms` }}>{t}</i>)}
                </b>
              </div>
              <div className="st-rival__metric"><span>Answered</span>
                <b className="st-rival__steps" aria-label={`Answered ${QUESTIONS} of ${QUESTIONS}`}>
                  {Array.from({ length: QUESTIONS + 1 }, (_, i) => <i key={i} style={{ '--at': `${i ? youAt[i - 1] : 0}ms`, '--off': `${i < youAt.length ? youAt[i] : 1e7}ms` }}>{i}/{QUESTIONS}</i>)}
                </b>
              </div>
              <div className="st-rival__metric"><span>Benchmark</span><b>{run.them.score}</b></div>
            </div>
            <div className="st-rival__race">
              {[
                { who: 'you', name: 'You', right: run.youRight, at: youAt, end: youEnd, time: run.you.seconds },
                { who: 'target', name: `${lv.short} target`, right: run.target.right, at: themAt, end: themEnd, time: run.them.seconds },
              ].map((lane) => (
                <div key={lane.who} className="st-rival__lane" data-who={lane.who}>
                  <p className="st-rival__lane-head"><span>{lane.name}</span><em style={{ '--at': `${lane.end}ms` }}>{lane.right.filter(Boolean).length} right in {clock(lane.time)}</em></p>
                  <ol className="st-rival__cells" aria-label={`${lane.name}: ${lane.right.filter(Boolean).length} of ${QUESTIONS} right`}>
                    {lane.right.map((ok, i) => (
                      <li key={i} data-right={ok ? '' : undefined}><span style={{ '--at': `${lane.at[i]}ms` }}>{ok ? <Check size={15} strokeWidth={3} aria-hidden="true" /> : <X size={15} strokeWidth={3} aria-hidden="true" />}</span></li>
                    ))}
                  </ol>
                  <i className="st-rival__fill" style={{ '--dur': `${lane.end}ms` }} aria-hidden="true" />
                </div>
              ))}
            </div>
            <div className="st-rival__submit-row">
              <button type="button" className="st-rival__submit" data-demo="rival-submit" disabled={!done} onClick={() => setStage('result')}>Submit benchmark</button>
            </div>
          </section>

          {/* ---- 3. The result: accuracy and pace against the target's, the gap in plain words ---- */}
          <section className="st-rival__view st-rival__result" aria-label="Your result" {...on('result')}>
            <div className="st-rival__head">
              <h3 className="st-rival__title" style={{ '--i': 0 }}>{run.title}</h3>
              <div className="st-rival__score" style={{ '--i': 0 }}>
                <p className="st-rival__rank">{run.rank}</p>
                <p className="st-rival__scoreline" role="img" aria-label={`You ${run.you.score}, ${lv.name} ${run.them.score}`}>{run.you.score}<span aria-hidden="true">–</span>{run.them.score}</p>
                <p className="st-rival__against">You against {lv.name}</p>
              </div>
            </div>
            {/* The why, as a picture (critic round, 21 Nov 2026 evening): accuracy and pace, yours and the target's bars growing
                side by side; where you fall short, the gap on your bar in the volt (accuracy: the share you did not get right;
                pace: the seconds over the target's). Then the gap in a few words (the whole sentence from 520 px). */}
            <div className="st-rival__compare">
              {[
                { key: 'acc', label: 'Accuracy', you: run.you.accuracy, them: run.them.accuracy, unit: '%', max: 100, short: run.you.accuracy < run.them.accuracy, note: `${run.you.right} of ${run.you.answered} answered right` },
                { key: 'pace', label: 'Time a question', you: run.you.pace, them: run.them.pace, unit: ' s', max: Math.max(run.you.pace, run.them.pace), short: run.you.pace > run.them.pace, note: `${clock(run.you.seconds)} in all, the target ${clock(run.them.seconds)}` },
              ].map((c, n) => (
                <div key={c.key} className="st-rival__cmp" style={{ '--i': n + 1 }}>
                  <p className="st-rival__cmp-label">{c.label}<span className="st-rival__cmp-note">{c.note}</span></p>
                  <p className="st-rival__cmp-row" data-who="you"><span>You</span><i><b style={{ '--s': c.you / c.max }} />{c.short ? <u style={{ '--g0': Math.min(c.you, c.them) / c.max, '--gw': Math.abs(c.you - c.them) / c.max }} /> : null}</i><em>{c.you}{c.unit}</em></p>
                  <p className="st-rival__cmp-row" data-who="target"><span>Target</span><i><b style={{ '--s': c.them / c.max }} /></i><em>{c.them}{c.unit}</em></p>
                </div>
              ))}
              <p className="st-rival__gap" style={{ '--i': 3 }}><b className="st-rival__gap-short">{run.gapShort}</b><span className="st-rival__gap-long">{run.gap}</span></p>
            </div>
            <div className="st-rival__again" style={{ '--i': 4 }}>
              <button type="button" className="st-rival__retry" data-demo="rival-retry" onClick={start}><RotateCcw size={16} aria-hidden="true" /> Retry</button>
              <button type="button" className="st-rival__setup" data-demo="rival-setup" onClick={() => { setStage('lobby'); setDone(false); }}>Setup</button>
            </div>
          </section>

          {/* ---- 4. The standing: a finished mock's points land, your row moves up one place ---- */}
          <section className="st-rival__view st-rival__standing" aria-label="Your standing" key={`stand-${standKey}`} {...on('standing')}>
            <div className="st-rival__hero">
              <p className="st-rival__place"><Swap from={ordinal(STANDING.you.place)} to={ordinal(STANDING_AFTER.you.place)} /></p>
              <p className="st-rival__of">of {STANDING.students} students who have sat a mock</p>
            </div>
            <p className="st-rival__mock">
              <span>Latest mock, {MOCK.subject}</span>
              <b>{MOCK_MARKS} of {MOCK.total * 5} marks</b>
              <em>+{MOCK_POINTS} points</em>
            </p>
            <ol className="st-rival__board" aria-label="Places around you">
              <li className="st-rival__row">
                <span className="st-rival__row-place">{ordinal(STANDING.above.place)}</span>
                <i className="st-rival__row-bar"><b style={{ '--s': 1 }} /></i>
                <span className="st-rival__row-pts"><b>{STANDING.above.points}</b> {STANDING.above.mocks} mocks</span>
              </li>
              <li className="st-rival__row st-rival__row--next">
                <span className="st-rival__row-place"><Swap from={ordinal(STANDING.next.place)} to={ordinal(STANDING_AFTER.next.place)} /></span>
                <i className="st-rival__row-bar"><b style={{ '--s': yourShare(STANDING.next.points) }} /></i>
                <span className="st-rival__row-pts"><b>{STANDING.next.points}</b> {STANDING.next.mocks} mocks</span>
              </li>
              <li className="st-rival__row st-rival__ladder-you" data-you="">
                <span className="st-rival__row-place"><Swap from={ordinal(STANDING.you.place)} to={ordinal(STANDING_AFTER.you.place)} /></span>
                <i className="st-rival__row-bar"><b style={{ '--s': yourShare(STANDING.you.points), '--s2': yourShare(STANDING_AFTER.you.points) }} /></i>
                <span className="st-rival__row-pts"><b><Swap from={STANDING.you.points} to={STANDING_AFTER.you.points} /></b> <Swap from={`${STANDING.you.mocks} mocks`} to={`${STANDING_AFTER.you.mocks} mocks`} /></span>
                <span className="st-rival__row-gap"><Swap from={pointsTo(STANDING.next.points - STANDING.you.points)} to={pointsTo(STANDING.above.points - STANDING_AFTER.you.points)} /></span>
                <span className="st-rival__row-you">You</span>
              </li>
            </ol>
            <p className="st-rival__free">{FREE_LINE}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
