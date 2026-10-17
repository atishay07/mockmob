"use client";

// "Your record": the student's own sessions, explained. Every figure states its sample;
// nothing here uses a model or credits, and nothing claims a cause or a prediction.
import { useEffect, useState } from 'react';
import { StatusIcon } from '@/components/ui/Glyph';
import MobiReact from '@/components/brand/MobiReact';
import SceneVignette from '@/components/scenes/SceneVignette';
import { useCountUpState, useInView } from '@/lib/motion';
import AnswerSheet from './AnswerSheet';
import { lookChange, readLastLook, rememberLook } from './useInsights';
import './prepos.css';
import { MIN_CHAPTER_SAMPLE } from '../../../data/prepos_insights';

const sec = (s) => (s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : `${Math.round(s)}s`);
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
const day = (t) => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

function Stack({ right, wrong, skip, label }) {
  const total = right + wrong + skip || 1;
  const [ref, seen] = useInView({ threshold: 0.4 });
  return (
    <span className="pp-stack" ref={ref} data-in={seen ? 'true' : 'false'} role="img" aria-label={label}>
      <i data-k="right" style={{ flexBasis: `${(right / total) * 100}%`, '--i': 0 }} />
      <i data-k="wrong" style={{ flexBasis: `${(wrong / total) * 100}%`, '--i': 1 }} />
      <i data-k="skip" style={{ flexBasis: `${(skip / total) * 100}%`, '--i': 2 }} />
    </span>
  );
}

const FREE_CHAPTERS = 3;

// The marks ledger. The accuracy figure rolls from what the student saw last time to what is true
// now, and a line says what moved. Mobi hops only for a real rise of 5 points or more.
function Ledger({ userId, ledger, accuracy, right, wrong, blank }) {
  const [from] = useState(() => readLastLook(userId));
  const now = accuracy.pct;
  const change = lookChange(from, now);
  // The number remembers what it showed in this visit: back on this page with the same accuracy it just shows it;
  // a changed one rolls from the old figure, in volt when it rose and dimmed when it fell.
  const { value: shown, ink } = useCountUpState(now ?? 0, { from: from ?? undefined, memoryKey: `record-accuracy:${userId}` });
  useEffect(() => { rememberLook(userId, now); }, [userId, now]);
  return (
    <>
      <dl className="pp-ledger">
        <div data-emph="true"><dt>Net marks</dt><dd>{signed(ledger.net)}</dd><small>+5 per right, −1 per wrong</small></div>
        <div><dt>Right</dt><dd>{right}</dd></div>
        <div><dt>Wrong</dt><dd>{wrong}</dd></div>
        <div><dt>Blank</dt><dd>{blank}</dd></div>
        <div><dt>Accuracy</dt><dd className="mk-num" data-ink={ink || undefined}>{now === null ? 'None yet' : `${shown}%`}</dd><small>{now === null ? 'No attempted questions' : `Likely ${accuracy.low} to ${accuracy.high}% (${accuracy.n} answered)`}</small></div>
      </dl>
      {change ? (
        <p className="pp-look" data-dir={change.delta > 0 ? 'up' : 'down'} role="status">
          {change.delta >= 5 ? <MobiReact act="correct" size={40} /> : null}
          <b>{change.text}</b>
          <i>Accuracy was {from}%.</i>
        </p>
      ) : null}
    </>
  );
}

function ProLock({ what, onNavigate }) {
  return (
    <div className="pp-lock">
      <p>{what}</p>
      <button type="button" onClick={() => onNavigate('/pricing')}>See Pro</button>
    </div>
  );
}

// Radar passes `afterLedger` (its trend and subjects on narrow screens, right under the marks), `afterFindings`
// (Across your mocks), `oneLock` (the free plan's two Pro rows said once, at the end) and `emptyAction={false}`
// (its page already offers the next step) and `chaptersFirst` (the ranked chapters straight under the next step). The Mentor record tab passes none of them and is unchanged.
export default function RecordView({ state, onNavigate, pro = false, afterLedger = null, afterFindings = null, oneLock = false, emptyAction = true, chaptersFirst = false, chaptersInReview = false }) {
  const [showThin, setShowThin] = useState(false);
  const [changesRef, changesSeen] = useInView({ threshold: 0.4 });
  const { status, insights, findings } = state;

  if (status === 'loading') return <p className="pp-note" role="status">Reading your sessions…</p>;
  if (status === 'unavailable') {
    return (
      <div className="pp-empty" role="alert">
        <StatusIcon kind="warning" size={20} />
        <div><b>Your record could not be read just now.</b><p>Nothing was charged. Your attempts are safe, and Review still works.</p></div>
        <button type="button" className="btn-outline sm" onClick={() => onNavigate('/review')}>Open Review</button>
      </div>
    );
  }
  if (status === 'empty') {
    return (
      <div className="pp-empty pp-empty--room">
        <SceneVignette scene="nothingYet" compact />
        <div><b>Nothing to analyse yet.</b><p>Finish one practice session. Your record will then show where your marks went: which chapters, which answer changes, and where the time went.</p></div>
        {emptyAction ? <button type="button" className="btn-volt sm" onClick={() => onNavigate('/dashboard?mode=quick')}>Start a set</button> : null}
      </div>
    );
  }

  const { ledger, accuracy, chapters, changes, pace, week } = insights;
  const right = ledger.gained / 5;
  const wrong = ledger.penalty;
  const blank = ledger.openSkipped / 5;
  const maxChange = Math.max(changes.marksGained, changes.marksLost, 1);

  // N15 (17 Oct night): "Chapters, by marks left open" read as jargon. The ranking now says what it is in plain words:
  // the chapters costing the most marks, each with what happened in it, the marks a right answer would have added, and
  // for the first one the practice that wins them back. The chapter finding in "What stands out" said the same thing
  // again, so on a page that shows the ranking first it is left out there (one place for it, one action).
  const shownChapters = chapters.ranked.slice(0, pro ? 8 : FREE_CHAPTERS);
  const chapterFinding = findings.find((f) => f.id === 'chapter') || null;
  const shownFindings = chaptersFirst && chapters.ranked.length ? findings.filter((f) => f.id !== 'chapter') : findings;
  // Review 1018 (REVIEW-RESULT-1018 4.6, P-RR1): on Weak chapters the ranked list moved to Review, which leads with where you
  // lose marks; one row says so and links there. The trend and the subjects stay on this page.
  const chaptersSection = chaptersInReview ? (
      <section aria-labelledby="pp-c" className="pp-inreview">
        <h3 id="pp-c" className="sr-only">Your weak chapters</h3>
        <a className="pp-inreview__row" href="/review" onClick={(e) => { e.preventDefault(); onNavigate('/review'); }}>
          <b>Your weak chapters are in Review</b>
          <span>Each chapter with the marks it lost across your papers, its mistakes and a practice set for it.</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </a>
      </section>
  ) : (
      <section aria-labelledby="pp-c">
        <h3 id="pp-c" className="pp-h">Chapters costing you the most marks</h3>
        {chapters.ranked.length === 0 ? (
          <p className="pp-note">No chapter has {MIN_CHAPTER_SAMPLE} or more answered questions with a miss yet, so none is ranked. A few questions in a chapter are needed before a ranking means anything.</p>
        ) : (
          <>
            <ol className="pp-rank">
              {shownChapters.map((c, i) => (
                <li key={c.key}>
                  <span className="pp-rank__n" aria-hidden="true">{i + 1}</span>
                  <div className="pp-rank__main">
                    <div className="pp-rank__top"><b>{c.chapter}</b><span>{c.subjectName}</span></div>
                    <p className="pp-rank__what">{c.wrong} wrong{c.skip ? ` and ${c.skip} left blank` : ''}, out of {c.n} question{c.n === 1 ? '' : 's'}.</p>
                    <Stack right={c.right} wrong={c.wrong} skip={c.skip} label={`${c.right} right, ${c.wrong} wrong, ${c.skip} blank`} />
                    {i === 0 && chapterFinding?.action ? <button type="button" className="pp-rank__go" onClick={() => onNavigate(chapterFinding.action.href)}>{chapterFinding.action.label}</button> : null}
                  </div>
                  <p className="pp-rank__marks"><b>{c.open}</b><small>marks to win back</small></p>
                </li>
              ))}
            </ol>
            <p className="pp-note">A right answer adds 5 marks, so every wrong or blank answer is 5 marks you can still win. Each wrong one also cost 1 on its paper.</p>
          </>
        )}
        {!pro && chapters.ranked.length > FREE_CHAPTERS && <ProLock what={`${chapters.ranked.length - FREE_CHAPTERS} more ranked chapters are part of Pro.`} onNavigate={onNavigate} />}
        {pro && chapters.thin.length > 0 && (
          <>
            <button type="button" className="pp-toggle" aria-expanded={showThin} onClick={() => setShowThin((v) => !v)}>
              {showThin ? 'Hide' : 'Show'} {chapters.thin.length} chapter{chapters.thin.length === 1 ? '' : 's'} with too few questions to rank
            </button>
            {showThin && <ul className="pp-thin">{chapters.thin.slice(0, 8).map((c) => <li key={c.key}>{c.chapter}, {c.subjectName}: {c.right} of {c.n} right</li>)}</ul>}
          </>
        )}
      </section>
  );

  return (
    <div className="pp-record">
      <p className="pp-note">Based on {insights.sessions} session{insights.sessions === 1 ? '' : 's'} and {insights.questions} questions, {day(insights.window.first)} to {day(insights.window.last)}. Free to read, no credits used.</p>

      {/* Weak chapters answers its own question first: which chapters, ranked, then the marks behind them. */}
      {chaptersFirst ? chaptersSection : null}

      <Ledger userId={state.userId} ledger={ledger} accuracy={accuracy} right={right} wrong={wrong} blank={blank} />

      {afterLedger}

      <AnswerSheet right={right} wrong={wrong} blank={blank} />

      {shownFindings.length > 0 && (
        <section aria-labelledby="pp-f">
          <h3 id="pp-f" className="pp-h">What stands out</h3>
          <ol className="pp-findings">
            {shownFindings.map((f) => (
              <li key={f.id} data-kind={f.kind}>
                <div>
                  <b>{f.headline}</b>
                  <p>{f.detail}</p>
                  <span className="pp-findings__foot"><i>Based on {f.n} questions</i>{f.action ? <button type="button" onClick={() => onNavigate(f.action.href)}>{f.action.label}</button> : null}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {afterFindings}

      {chaptersFirst ? null : chaptersSection}

      {oneLock && !pro ? null : <section aria-labelledby="pp-a">
        <h3 id="pp-a" className="pp-h">Changed answers</h3>
        {!pro ? (
          <ProLock what="Changed-answer detail is part of Pro. The headline above already counts both gains and losses." onNavigate={onNavigate} />
        ) : changes.count === 0 ? (
          <p className="pp-note">No changed answers recorded{changes.sessionsWithTelemetry === 0 ? ' (no session has a usable replay yet)' : ''}.</p>
        ) : (
          <div className="pp-changes" ref={changesRef} data-in={changesSeen ? 'true' : 'false'}>
            <div><span>Helped</span><i data-k="gain" style={{ width: `${(changes.marksGained / maxChange) * 100}%` }} /><b>{signed(changes.marksGained)}</b><small>{changes.gains}</small></div>
            <div><span>Hurt</span><i data-k="loss" style={{ width: `${(changes.marksLost / maxChange) * 100}%` }} /><b>{signed(-changes.marksLost)}</b><small>{changes.losses}</small></div>
            <p className="pp-note">Net {signed(changes.net)} marks across {changes.count} changes in {changes.sessionsWithTelemetry} replayed session{changes.sessionsWithTelemetry === 1 ? '' : 's'}. This shows what happened, not why you changed.</p>
          </div>
        )}
      </section>}

      {oneLock && !pro ? null : <section aria-labelledby="pp-p">
        <h3 id="pp-p" className="pp-h">Pace</h3>
        {!pro ? (
          <ProLock what="Pace detail from your replayed sessions is part of Pro." onNavigate={onNavigate} />
        ) : !pace.usable ? (
          <p className="pp-note">Pace needs at least 8 timed questions from a replayed session. {pace.questionsTimed} so far.</p>
        ) : (
          <>
            <dl className="pp-pace">
              <div><dt>Typical question</dt><dd>{sec(pace.medianSec)}</dd></div>
              <div><dt>Slowest 10%</dt><dd>{sec(pace.p90Sec)}</dd></div>
              {pace.medianRightSec && pace.medianWrongSec ? <div><dt>Right vs wrong</dt><dd>{sec(pace.medianRightSec)} / {sec(pace.medianWrongSec)}</dd></div> : null}
              {pace.shareOnWrong !== null ? <div><dt>Time on wrong</dt><dd>{pace.shareOnWrong}%</dd></div> : null}
            </dl>
            {pace.slowest.length > 0 && <ul className="pp-thin">{pace.slowest.slice(0, 3).map((s) => <li key={`${s.attemptId}-${s.position}`}>Question {s.position}, {s.chapter}: {sec(s.seconds)} ({s.outcome === 'skip' ? 'blank' : s.outcome})</li>)}</ul>}
            <p className="pp-note">Timing comes from device events across {pace.questionsTimed} questions in {pace.sessionsTimed} session{pace.sessionsTimed === 1 ? '' : 's'}.</p>
          </>
        )}
      </section>}

      <section aria-labelledby="pp-w">
        <h3 id="pp-w" className="pp-h">This week and last</h3>
        <div className="pp-week">
          {[['Last 7 days', week.thisWeek], ['Week before', week.lastWeek]].map(([label, w]) => (
            <div key={label}>
              <span>{label}</span>
              <b>{w.sessions ? signed(w.net) : 'None'}</b>
              <small>{w.sessions ? `${w.sessions} session${w.sessions === 1 ? '' : 's'}, ${w.questions} questions${w.accuracy.pct !== null ? `, ${w.accuracy.pct}% accuracy` : ''}` : 'No sessions'}</small>
            </div>
          ))}
        </div>
        <p className="pp-note">Active on {week.activeDaysLast14} of the last 14 days.</p>
      </section>

      {oneLock && !pro ? (
        <section aria-labelledby="pp-pro" className="pp-pro">
          <h3 id="pp-pro" className="pp-h">Changed answers and pace</h3>
          <ProLock what="The detail from your replayed sessions is part of Pro. The marks above already count both gains and losses from changed answers." onNavigate={onNavigate} />
        </section>
      ) : null}
    </div>
  );
}
