"use client";
// The Mistake Lab on the result page, as the bodies of the result's named folds (RESULT-1017 4.6, 17 Oct). Nothing in
// it is deleted; each part moved into the fold that names it:
//   LabLedger  "Where the marks went": the Lab's numeral (lab.hero), the marks ledger (result/MarksLedger.jsx) or, without
//              the server's lab, the bar, legend and the 6-marks rule; the older-paper line (lab.older).
//   LabTime    "Your time and changed answers": the first timed mock prompt, the Replay (result/Replay.jsx), the chapters
//              and observations when the SWOT is not shown, Time and decisions (data/time_decisions.js) and "Your traps
//              across mocks" (result/TrapsMeet.jsx).
//   LabProof   "Your rule and proof it stuck": the rule check (result/RuleCheck.jsx), "Same mistakes later", Try 5 fresh
//              questions, "Your rules (7)" and "Across your mocks" (result/AcrossMocks.jsx).
//   RepairTotal the one spend line for the repairs left (it sits under the mistakes list).
// The old Repair step (what a repair is, its progress, the queue and its second volt key) became the result's next-move
// panel and its mistakes list (src/components/result/NextMove.jsx, MistakeList.jsx). Facts come from the server-scored
// attempt; device events are labelled as such.
import { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/fetcher';
import { TIME_COPY } from '@/../data/time_decisions';
import TimeDecisions from './result/TimeDecisions';
import MarksLedger from './result/MarksLedger';
import ReplaySlots from './result/ReplaySlots';
import AcrossMocks from './result/AcrossMocks';
import RuleCheck from './result/RuleCheck';
import SameMistakesLater from './result/SameMistakesLater';
import TrapsMeet from './result/TrapsMeet';
import OlderPaper from './result/OlderPaper';
import FirstTimedMock from './timed/FirstTimedMock';
import { useFirstTimedMock } from './timed/useFirstTimedMock';
import { AuthContext } from '@/components/AuthProvider';
import { useWalletSummary } from '@/components/useWalletSummary';
import { usesLine } from '@/lib/creditCopy.mjs';
import COPY from '../../data/mistake_lab.copy.json' with { type: 'json' };

// The repair total in the one spend line: each repair is 1 AI credit, so the ones left cost that many together.
// Nothing to repair, nothing to say. Unknown balance shows no number, never 0.
export function RepairTotal({ remaining }) {
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

/** The ledger as the server sends it, or null (an older server, a failed step, checks not ready). */
export const ledgerOf = (lab) => (lab && (lab.state === 'ready' || lab.state === 'basic') && lab.groups?.length ? lab : null);

/** "Where the marks went". `changesId` links the ledger's changed-answers group to Time and decisions' list. */
export function LabLedger({ attempt, analysis, timeRead = null, lab = null, onJump, onSeeReplay = null, changesId = null, bare = false }) {
  const { marks } = analysis;
  const ledger = ledgerOf(lab);
  const hero = lab?.hero?.label ? lab.hero
    : lab?.state !== 'none' && marks.gap > 0 ? { value: marks.gap, label: `${marks.gap === 1 ? 'mark' : 'marks'} missed, of ${marks.max}` } : null;
  const pct = (v) => `${marks.max ? (v / marks.max) * 100 : 0}%`;
  const replay = lab?.replay?.rows?.length ? lab.replay : null;
  const older = lab?.older?.line ? lab.older : null;
  const firstTimed = useFirstTimedMock('result', { resultMode: attempt?.selectionMeta?.mode || attempt?.mode || null });
  const answered = marks.right + marks.wrong;
  const seeReplay = replay && onSeeReplay ? {
    label: replay.labels?.seeInReplay,
    ids: new Set((replay.chips || []).filter((c) => c.id !== 'all' && c.count).map((c) => c.id)),
    onSee: onSeeReplay,
  } : null;
  return (
    <div className="srl srl--fold" data-in="">
      {/* `bare`: the result's Mistake Lab card states the missed marks in its own heading, so the numeral is not repeated. */}
      {bare ? null : <header className="srl-head">
        {hero ? (
          <p className="srl-hero"><b className="srl-hero__n">{hero.value}</b><span className="srl-hero__label">{hero.label}</span></p>
        ) : (
          <p className="srl-hero__label">{lab?.heading ? lab.heading : 'You didn’t miss a mark this session.'}</p>
        )}
        {answered ? <p className="srl-fine">{Math.round((marks.right / answered) * 100)}% of answered questions right: {marks.right} of {answered}.</p> : null}
      </header>}
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
      {/* The older-paper line stays here; the first timed mock prompt lives with the time (one prompt on a page). */}
      {firstTimed ? null : <OlderPaper older={older} />}
    </div>
  );
}

/** "Your time and changed answers". `focus` brings the Replay in with a ledger group's chip on. */
export function LabTime({ attempt, analysis, timeRead = null, lab = null, onJump, swotShown = false, changesId = null }) {
  const { chapters } = analysis;
  const ledger = ledgerOf(lab);
  // With the ledger on the page its groups state the observations with marks, so the cards are left out. Without it,
  // the change observation sums up what Time and decisions lists in full, so it is left out when that list shows.
  const observations = ledger ? [] : timeRead?.state === 'ready' ? analysis.observations.filter(o => o.id !== 'changes') : analysis.observations;
  const maxGap = chapters[0]?.gap || 1;
  const [expanded, setExpanded] = useState(false);
  const replay = lab?.replay?.rows?.length ? lab.replay : null;
  const older = lab?.older?.line ? lab.older : null;
  const firstTimed = useFirstTimedMock('result', { resultMode: attempt?.selectionMeta?.mode || attempt?.mode || null });
  const timeReady = timeRead?.state === 'ready';
  return (
    <div className="srl srl--fold srl-find" data-in="" data-expanded={expanded}>
      {firstTimed ? <FirstTimedMock prompt={firstTimed} /> : null}
      {/* D17, pass 1018: one slot per question sized to the paper, play over real events, or one sentence when there is nothing to replay. */}
      {<ReplaySlots replay={replay} rows={analysis.rows} paceSec={timeRead?.pace?.perQuestionMs ? timeRead.pace.perQuestionMs / 1000 : null} onJump={onJump}
        cutLink={{ href: `/dashboard?${new URLSearchParams({ subject: attempt?.subject || '', mode: 'quick', count: String(analysis.rows.length || 10) })}`, label: `Practise ${analysis.rows.length || 10} more, no rush` }} />}
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
        ) : null}
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
        {(chapters.length > 1 || observations.length > 1) && <button type="button" className="srl-find-toggle" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Show the key finding' : observations.length ? 'See all chapters and observations' : 'See all chapters'}<span aria-hidden="true">{expanded ? '−' : '+'}</span></button>}
        {older && !timeReady ? null : <h4 className="td-h srl-find__time">{TIME_COPY.title}</h4>}
      </>}
      <TimeDecisions read={timeRead} onJump={onJump} changesId={ledger ? changesId : null} said={ledger?.state === 'basic'} quiet={!!older} />
      {lab ? <TrapsMeet label={COPY.traps.labels.open} /> : null}
    </div>
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
            <button type="button" className="srl-cta srl-cta--quiet" onClick={() => go(fresh.href)}>Try 5 fresh questions</button>
          </>
        : <>
            <p>{topChapter ? <>We don’t have five unseen, verified questions for <b>{topChapter}</b> yet, so this is a regular set on that chapter.</> : 'We don’t have five unseen, verified questions yet, so this is a regular set in the same subject.'} Questions you have seen before don’t count as proof.</p>
            <button type="button" className="srl-cta srl-cta--quiet" onClick={() => go(ordinary)}>{topChapter ? `Practise ${topChapter}` : 'Practise 10 more'}</button>
          </>}
    </div>
  );
}

/** "Your rule and proof it stuck". The free-text playbook note stays retired (spec 4.10); the rule for the next mock replaced it. */
export function LabProof({ attempt, analysis, lab = null }) {
  const { chapters } = analysis;
  const topChapter = chapters.find(c => c.wrong > 0)?.chapter || chapters[0]?.chapter || null;
  const rules = lab?.rules && typeof lab.rules.countLabel === 'string' ? lab.rules : null;
  return (
    <div className="srl srl--fold" data-in="">
      <Prove attempt={attempt} topChapter={topChapter} ruleCheck={lab?.prove?.ruleCheck || null} later={lab?.prove?.later || null} />
      {rules ? (
        <Link className="srl-rules" href="/review/rules">
          <span className="srl-rules__text"><b>{rules.countLabel}</b>{rules.active?.text ? <small>{COPY.rules.labels.inUse}: {rules.active.text}</small> : null}</span>
        </Link>
      ) : null}
      <AcrossMocks across={lab?.acrossMocks || null} />
    </div>
  );
}
