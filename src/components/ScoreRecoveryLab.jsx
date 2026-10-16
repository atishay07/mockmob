"use client";
// The Mistake Lab on the result page (shown as "Mistake Lab"; it was the Score Recovery Lab): where the marks went,
// then Find, Repair the mistakes, and Prove it on fresh questions. Facts come from the server-scored attempt;
// device events are labelled as such.
// Where the marks went: with the server's `lab` (data/mistake_lab.js, state ready or basic) the marks ledger
// (result/MarksLedger.jsx) replaces the old three-colour bar, its legend and the 6-marks rule, and Find's old
// observation cards are left out (the ledger states the same facts with marks). Without `lab` (an older server, a
// failed step, answer checks not ready) the bar and legend show exactly as before.
// Find opens with the Replay (result/Replay.jsx, from the server's lab.replay): the paper as a clock you can scrub,
// with the ledger's groups as its filter chips; each ledger row's "See it in the replay" opens it with that chip on.
// Without lab.replay (an old record, an older server) Find is exactly as before. Find always holds "Time and
// decisions" (data/time_decisions.js): the paper's pace, where the time went and every answer change with its clock
// times. Its chapter list is left out while the result page shows the SWOT, which already reads the chapters.
// Slice 3 (spec 4.7 to 4.10), each part only when the server sends it, so an older server shows the Lab as before:
// Repair follows lab.repairOrder (most other students got it right first, marked in the queue) and links to the Rule
// book ("Your rules (7)"); Prove opens with the rule check (result/RuleCheck.jsx); "Across your mocks" closes the Lab,
// folded (result/AcrossMocks.jsx).
// Slice 4 (spec 4.7 second part, 4.8, 4.11): Prove then also says which of this paper's wrong answers come back in Revise and
// when ("Same mistakes later", result/SameMistakesLater.jsx, from lab.prove.later); Find ends with "Your traps across mocks"
// (result/TrapsMeet.jsx, GET /api/me/traps); the trap tag itself sits under the wrong option in the opened answer (result page).
import { useContext, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Users } from 'lucide-react';
import { apiGet } from '@/lib/fetcher';
import { TIME_COPY } from '@/../data/time_decisions';
import MistakeLessonLink from './study/MistakeLessonLink';
import TimeDecisions from './result/TimeDecisions';
import MarksLedger from './result/MarksLedger';
import Replay from './result/Replay';
import AcrossMocks from './result/AcrossMocks';
import RuleCheck from './result/RuleCheck';
import SameMistakesLater from './result/SameMistakesLater';
import TrapsMeet from './result/TrapsMeet';
import OlderPaper from './result/OlderPaper';
import { cohortItems, inRepairOrder } from './result/labLoop';
import { AuthContext } from '@/components/AuthProvider';
import { useWalletSummary } from '@/components/useWalletSummary';
import { usesLine } from '@/lib/creditCopy.mjs';
import COPY from '../../data/mistake_lab.copy.json' with { type: 'json' };

// Adds data-in once the Lab scrolls into view, so its bars grow when the student actually sees them.
function useInView() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { queueMicrotask(() => setInView(true)); return undefined; }
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setInView(true); io.disconnect(); } }, { threshold: 0.01 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, inView];
}

// The repair total in the one spend line: each repair is 1 AI credit, so the ones left cost that many together.
// Nothing to repair, nothing to say. Unknown balance shows no number, never 0.
function RepairTotal({ remaining }) {
  const auth = useContext(AuthContext);
  const wallet = useWalletSummary(auth?.user?.id, { reuseFresh: true });
  if (!(remaining > 0)) return null;
  const what = remaining === 1 ? 'This repair' : `These ${remaining} repairs`;
  return <p className="srl-fine">{usesLine({ what, verb: remaining === 1 ? 'uses' : 'use', cost: remaining, pool: 'ai', balance: wallet.wallet?.known ? wallet.wallet.total : null })}</p>;
}

function QChips({ numbers, onJump }) {
  if (!numbers?.length) return null;
  return (
    <span className="srl-qchips">
      <span className="srl-qchips__label">See</span>
      {numbers.map(n => <button key={n} type="button" onClick={() => onJump(n)} aria-label={`Go to question ${n}`}>Q{n}</button>)}
    </span>
  );
}

function Prove({ attempt, topChapter, ruleCheck = null, later = null }) {
  const router = useRouter();
  const [replay, setReplay] = useState(null);
  useEffect(() => {
    let alive = true;
    apiGet(`/api/recovery/replay?attemptId=${encodeURIComponent(attempt.id)}`)
      .then(d => { if (alive) setReplay(d); })
      .catch(() => { if (alive) setReplay({ chapters: [], state: 'error' }); });
    return () => { alive = false; };
  }, [attempt.id]);
  const fresh = replay?.chapters?.find(c => c.state === 'available' && (!topChapter || c.chapter === topChapter)) || replay?.chapters?.find(c => c.state === 'available');
  const go = (href) => router.push(`${href}${href.includes('?') ? '&' : '?'}generationKey=${crypto.randomUUID()}`);
  const ordinary = `/test?${new URLSearchParams({ subject: attempt.subject, mode: 'quick', count: '10', ...(topChapter ? { chapter: topChapter } : {}) })}`;
  return (
    <div className="srl-step__body">
      <RuleCheck check={ruleCheck} />
      <SameMistakesLater later={later} />
      {!replay ? <p className="srl-muted" role="status">Checking for fresh questions…</p>
        : fresh ? <>
            <p>Five questions you have not seen from <b>{fresh.chapter}</b>. Getting them right in a day or two is how you know a repair stuck.</p>
            <button type="button" className="srl-cta" onClick={() => go(fresh.href)}>Try 5 fresh questions</button>
          </>
        : <>
            <p>{topChapter ? <>We don’t have five unseen, verified questions for <b>{topChapter}</b> yet, so this is a regular set on that chapter.</> : 'We don’t have five unseen, verified questions yet, so this is a regular set in the same subject.'} Questions you have seen before don’t count as proof.</p>
            <button type="button" className="srl-cta srl-cta--quiet" onClick={() => go(ordinary)}>{topChapter ? `Practise ${topChapter}` : 'Practise 10 more'}</button>
          </>}
    </div>
  );
}

// The free-text playbook note is retired (spec tmp/mistake-lab-v4/SPEC.md 4.10): its saved notes are kept, and the
// rule for the next mock (the Rule book's "Use in my next mock", /api/me/playbook) takes its place.

// swotShown: the result page's SWOT already reads the chapters, so Find shows only Time and decisions.
// timeRead: buildTimeDecisions(attempt) from the result page (the same read feeds each answer's own lines).
// lab: the server's Mistake Lab contract (attempt.lab), or null.
// The repair queue as a ranked list: the first three in repair order, each with its chapter, the reason it is early
// when other students' answers put it there, and the 6 marks the wrong answer cost (5 not won plus the 1 penalty).
// The rest wait behind "Show all N", so the one action under it ("Repair Q42") stays the thing to do.
const QUEUE_TOP = 3;
function RepairQueue({ queue, led, repaired, onJump }) {
  const [all, setAll] = useState(false);
  const listId = useId();
  const shown = all ? queue : queue.slice(0, QUEUE_TOP);
  return (
    <div className="srl-queue-wrap">
      <ol className="srl-queue" id={listId}>
        {shown.map((r, i) => {
          const first = led.get(r.q.id);
          const done = repaired.has(r.q.id);
          return (
            <li key={r.q.id}>
              <button type="button" className="srl-queue__item" data-done={done || undefined} data-led={first?.reason} onClick={() => onJump(r.number)}
                aria-label={`${i + 1}. Q${r.number}, ${r.chapter}.${first?.line ? ` ${first.line}` : ''} 6 marks lost.${done ? ' Explanation ready.' : ''}`}>
                <b className="srl-queue__n">Q{r.number}</b>
                <span className="srl-queue__what">
                  <span className="srl-queue__ch">{r.chapter}</span>
                  {first?.line ? <small><Users className="srl-queue__led" size={13} strokeWidth={2.4} aria-hidden="true" />{first.line}</small> : null}
                </span>
                {done ? <Check className="srl-queue__done" size={16} strokeWidth={3} aria-hidden="true" /> : <span className="srl-queue__marks">−6</span>}
              </button>
            </li>
          );
        })}
      </ol>
      {queue.length > QUEUE_TOP ? (
        <button type="button" className="srl-queue__more" aria-expanded={all} aria-controls={listId} onClick={() => setAll((v) => !v)}>
          {all ? `Show the first ${QUEUE_TOP}` : `Show all ${queue.length}`}<span aria-hidden="true">{all ? '−' : '+'}</span>
        </button>
      ) : null}
    </div>
  );
}

export default function ScoreRecoveryLab({ attempt, analysis, timeRead = null, lab = null, repaired, handled = repaired, onJump, onRepairNext, swotShown = false }) {
  const { marks, chapters, mistakes } = analysis;
  const ledger = lab && (lab.state === 'ready' || lab.state === 'basic') && lab.groups?.length ? lab : null;
  // With the ledger on the page its groups state the observations with marks, so the cards are left out. Without it,
  // the change observation sums up what Time and decisions lists in full, so it is left out when that list shows.
  const observations = ledger ? [] : timeRead?.state === 'ready' ? analysis.observations.filter(o => o.id !== 'changes') : analysis.observations;
  const [ref, inView] = useInView();
  const topChapter = chapters.find(c => c.wrong > 0)?.chapter || chapters[0]?.chapter || null;
  const done = mistakes.filter(r => repaired.has(r.q.id)).length;
  const pct = (v) => `${marks.max ? (v / marks.max) * 100 : 0}%`;
  const maxGap = chapters[0]?.gap || 1;
  const [expanded, setExpanded] = useState(false);
  const findId = useId();
  const changesId = `${useId()}-changes`;
  // The Replay, and the ledger's way into it: each new focus turns that group's chip on and brings the Replay in.
  const replay = lab?.replay?.rows?.length ? lab.replay : null;
  const [replayFocus, setReplayFocus] = useState(null);
  // Repair order (spec 4.7): the queue and its key follow the server's order; cohort-led items carry their line.
  const queue = inRepairOrder(mistakes, lab?.repairOrder);
  const led = cohortItems(lab?.repairOrder);
  const rules = lab?.rules && typeof lab.rules.countLabel === 'string' ? lab.rules : null;
  // An older paper (no clock record, or one from before the capture of 15 Oct): one line on what it cannot show and
  // one action (lab.older). Time and decisions then says nothing of its own, and Find is left out when it would be empty.
  const older = lab?.older?.line ? lab.older : null;
  const timeReady = timeRead?.state === 'ready';
  const findShown = !(older && swotShown && !replay && !timeReady);
  const repairNo = findShown ? 2 : 1;
  const seeReplay = replay ? {
    label: replay.labels?.seeInReplay,
    ids: new Set((replay.chips || []).filter((c) => c.id !== 'all' && c.count).map((c) => c.id)),
    onSee: (chip) => setReplayFocus((f) => ({ chip, n: (f?.n || 0) + 1 })),
  } : null;

  return (
    <section ref={ref} className="srl" data-in={inView || undefined} aria-labelledby="srl-title">
      <header className="srl-head">
        <h2 id="srl-title">{lab?.heading ? lab.heading : marks.gap ? <>You missed {marks.gap} marks. Here’s where they went.</> : 'You didn’t miss a mark this session.'}</h2>
      </header>

      {ledger ? <MarksLedger lab={ledger} attemptId={attempt.id} onJump={onJump} changesId={timeRead?.state === 'ready' ? changesId : null} replay={seeReplay} />
      : marks.gap ? <>
        <div className="srl-bar" role="img" aria-label={`${Math.max(marks.scored, 0)} of ${marks.max} marks scored. ${marks.gapWrong} lost to wrong answers, ${marks.gapBlank} left on blanks.`}>
          <span className="srl-bar__seg" data-kind="scored" style={{ width: pct(Math.max(marks.scored, 0)) }} />
          <span className="srl-bar__seg" data-kind="wrong" style={{ width: pct(marks.gapWrong) }} />
          <span className="srl-bar__seg" data-kind="blank" style={{ width: pct(marks.gapBlank) }} />
        </div>
        <ul className="srl-legend">
          <li data-kind="scored"><b>{marks.scored}</b> scored</li>
          {marks.wrong ? <li data-kind="wrong"><b>{marks.gapWrong}</b> lost to {marks.wrong} wrong answer{marks.wrong === 1 ? '' : 's'}</li> : null}
          {marks.blank ? <li data-kind="blank"><b>{marks.gapBlank}</b> left on {marks.blank} blank{marks.blank === 1 ? '' : 's'}</li> : null}
        </ul>
        {marks.wrong ? <p className="srl-rule">Each wrong answer costs 6: the 5 you didn’t get, plus the 1 penalty.</p> : null}
      </> : null}

      <OlderPaper older={older} />

      <ol className="srl-steps">
        {findShown ? <li className="srl-step">
          <div className="srl-step__num" aria-hidden="true">1</div>
          <div className="srl-step__main srl-find" id={findId} data-expanded={expanded}>
            <div className="srl-step__head"><h3>Find</h3><p>{swotShown ? TIME_COPY.sub : 'Which chapters cost you, and why'}</p></div>
            {replay ? <Replay replay={replay} lab={lab} timeRead={timeRead} onJump={onJump} focus={replayFocus} /> : null}
            {replay && swotShown ? <h4 className="td-h srl-find__time">{TIME_COPY.title}</h4> : null}
            {swotShown ? null : <>
              {chapters.length ? (
                <ul className="srl-chapters">
                  {chapters.slice(0, 4).map((c, i) => (
                    <li key={c.chapter} data-secondary={i > 0 || undefined} style={{ '--i': i }}>
                      <button type="button" onClick={() => onJump(c.first)} className="srl-chapter">
                        <span className="srl-chapter__name">{c.chapter}</span>
                        <span className="srl-chapter__meta">{[c.wrong && `${c.wrong} wrong`, c.blank && `${c.blank} blank`].filter(Boolean).join(', ')} of {c.n}</span>
                        <span className="srl-chapter__track" aria-hidden="true"><span style={{ width: `${(c.gap / maxGap) * 100}%` }} /></span>
                        <b className="srl-chapter__gap">−{c.gap}<small> marks</small></b>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <p>Every question was right. Try a harder or longer set to find what’s left.</p>}
              {observations.length ? (
                <ul className="srl-obs">
                  {observations.map((o, i) => (
                    <li key={o.id} data-tone={o.tone} data-secondary={i > 0 || undefined}>
                      <span className="srl-obs__tag">{o.label}</span>
                      <b>{o.headline}</b>
                      <span className="srl-obs__detail">{o.detail}</span>
                      <span className="srl-obs__tip">{o.tip}</span>
                      <QChips numbers={o.questions} onJump={onJump} />
                    </li>
                  ))}
                </ul>
              ) : null}
              {(chapters.length > 1 || observations.length > 1) && <button type="button" className="srl-find-toggle" aria-expanded={expanded} aria-controls={findId} onClick={() => setExpanded(value => !value)}>{expanded ? 'Show the key finding' : observations.length ? 'See all chapters and observations' : 'See all chapters'}<span aria-hidden="true">{expanded ? '−' : '+'}</span></button>}
              {older && !timeReady ? null : <h4 className="td-h srl-find__time">{TIME_COPY.title}</h4>}
            </>}
            <TimeDecisions read={timeRead} onJump={onJump} changesId={ledger ? changesId : null} said={ledger?.state === 'basic'} quiet={!!older} />
            {lab ? <TrapsMeet label={COPY.traps.labels.open} /> : null}
          </div>
        </li> : null}

        <li className="srl-step">
          <div className="srl-step__num" aria-hidden="true">{mistakes.length && done === mistakes.length ? <Check size={16} strokeWidth={3} /> : repairNo}</div>
          <div className="srl-step__main">
            <div className="srl-step__head"><h3>Repair</h3><p>Fix each wrong answer, one at a time</p></div>
            <MistakeLessonLink subject={attempt.subject} chapter={topChapter} chapters={Object.entries(analysis.mistakes.reduce((m,row)=>{if(row.chapter)m[row.chapter]=(m[row.chapter]||0)+1;return m;},{})).sort((x,y)=>y[1]-x[1]).map(([chapter,count])=>({chapter,count}))} conceptIds={analysis.mistakes.map(row=>row.q.conceptId).filter(Boolean)} />
            {mistakes.length ? <>
              <p>Each repair shows why your answer felt right, where it breaks, why the key is right and one rule to keep. It is written from the answer key. If our own working disagrees with the key, you get no repair and no charge.</p>
              <div className="srl-progress">
                <div className="srl-progress__track" aria-hidden="true"><span style={{ width: `${(done / mistakes.length) * 100}%` }} /></div>
                <span>{done} of {mistakes.length} explanations ready</span>
              </div>
              {handled.size > done ? <p className="srl-fine">{handled.size - done} held or without an explanation. These do not count as repaired.</p> : null}
              <RepairQueue queue={queue} led={led} repaired={repaired} onJump={onJump} />
              {handled.size < mistakes.length ? (
                <button type="button" className="srl-cta" onClick={onRepairNext}>{`Repair Q${queue.find(r => !handled.has(r.q.id)).number}`}</button>
              ) : done === mistakes.length ? <p className="srl-done">All explanations ready. Try fresh questions when you are ready.</p> : <p className="srl-fine">Review the recorded answers below or continue with ordinary practice.</p>}
              <RepairTotal remaining={mistakes.length - handled.size} />
              <p className="srl-fine">Reopening a repair is free. No charge if a question is held for review.</p>
            </> : <p>No wrong answers to repair this session.</p>}
            {rules ? (
              <Link className="srl-rules" href="/review/rules">
                <span className="srl-rules__text"><b>{rules.countLabel}</b>{rules.active?.text ? <small>{COPY.rules.labels.inUse}: {rules.active.text}</small> : null}</span>
              </Link>
            ) : null}
          </div>
        </li>

        <li className="srl-step">
          <div className="srl-step__num" aria-hidden="true">{repairNo + 1}</div>
          <div className="srl-step__main">
            <div className="srl-step__head"><h3>Prove</h3><p>Show it stuck, on questions you haven’t seen</p></div>
            <Prove attempt={attempt} topChapter={topChapter} ruleCheck={lab?.prove?.ruleCheck || null} later={lab?.prove?.later || null} />
          </div>
        </li>
      </ol>

      <AcrossMocks across={lab?.acrossMocks || null} />
    </section>
  );
}
