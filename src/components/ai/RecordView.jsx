"use client";

// "Your record": the student's own sessions, explained. Every figure states its sample;
// nothing here uses a model or credits, and nothing claims a cause or a prediction.
import { useState } from 'react';
import { AppIcon, StatusIcon } from '@/components/ui/Glyph';
import './prepos.css';
import { MIN_CHAPTER_SAMPLE } from '../../../data/prepos_insights';

const sec = (s) => (s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : `${Math.round(s)}s`);
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
const day = (t) => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

function Stack({ right, wrong, skip, label }) {
  const total = right + wrong + skip || 1;
  return (
    <span className="pp-stack" role="img" aria-label={label}>
      <i data-k="right" style={{ flexBasis: `${(right / total) * 100}%` }} />
      <i data-k="wrong" style={{ flexBasis: `${(wrong / total) * 100}%` }} />
      <i data-k="skip" style={{ flexBasis: `${(skip / total) * 100}%` }} />
    </span>
  );
}

const FREE_CHAPTERS = 3;

function ProLock({ what, onNavigate }) {
  return (
    <div className="pp-lock">
      <AppIcon name="lock" size={16} />
      <p>{what}</p>
      <button type="button" onClick={() => onNavigate('/pricing')}>See Pro</button>
    </div>
  );
}

export default function RecordView({ state, onNavigate, pro = false }) {
  const [showThin, setShowThin] = useState(false);
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
      <div className="pp-empty">
        <AppIcon name="practice" size={22} />
        <div><b>Nothing to analyse yet.</b><p>Finish one practice session. PrepOS will then show where your marks went: which chapters, which answer changes, and where the time went.</p></div>
        <button type="button" className="btn-volt sm" onClick={() => onNavigate('/dashboard?mode=quick')}>Start a set</button>
      </div>
    );
  }

  const { ledger, accuracy, chapters, changes, pace, week } = insights;
  const right = ledger.gained / 5;
  const wrong = ledger.penalty;
  const blank = ledger.openSkipped / 5;
  const maxChange = Math.max(changes.marksGained, changes.marksLost, 1);

  return (
    <div className="pp-record">
      <p className="pp-note">Based on {insights.sessions} session{insights.sessions === 1 ? '' : 's'} and {insights.questions} questions, {day(insights.window.first)} to {day(insights.window.last)}. Free to read, no credits used.</p>

      <dl className="pp-ledger">
        <div data-emph="true"><dt>Net marks</dt><dd>{signed(ledger.net)}</dd><small>+5 per right, −1 per wrong</small></div>
        <div><dt>Right</dt><dd>{right}</dd></div>
        <div><dt>Wrong</dt><dd>{wrong}</dd></div>
        <div><dt>Blank</dt><dd>{blank}</dd></div>
        <div><dt>Accuracy</dt><dd>{accuracy.pct === null ? '—' : `${accuracy.pct}%`}</dd><small>{accuracy.pct === null ? 'No attempted questions' : `Likely ${accuracy.low}–${accuracy.high}% (${accuracy.n} answered)`}</small></div>
      </dl>

      {findings.length > 0 && (
        <section aria-labelledby="pp-f">
          <h3 id="pp-f" className="pp-h">What stands out</h3>
          <ol className="pp-findings">
            {findings.map((f) => (
              <li key={f.id} data-kind={f.kind}>
                <span className="pp-findings__icon"><StatusIcon kind={f.kind === 'good' ? 'success' : f.kind === 'leak' ? 'warning' : 'info'} size={16} /></span>
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

      <section aria-labelledby="pp-c">
        <h3 id="pp-c" className="pp-h">Chapters, by marks left open</h3>
        {chapters.ranked.length === 0 ? (
          <p className="pp-note">No chapter has {MIN_CHAPTER_SAMPLE}+ answered questions with misses yet, so none is ranked. Rankings need a few questions per chapter to mean anything.</p>
        ) : (
          <ul className="pp-chapters">
            {chapters.ranked.slice(0, pro ? 8 : FREE_CHAPTERS).map((c) => (
              <li key={c.key}>
                <div className="pp-chapters__top"><b>{c.chapter}</b><span>{c.subjectName}</span></div>
                <Stack right={c.right} wrong={c.wrong} skip={c.skip} label={`${c.right} right, ${c.wrong} wrong, ${c.skip} blank`} />
                <div className="pp-chapters__meta"><span>{c.right} right · {c.wrong} wrong · {c.skip} blank</span><span>{c.open} marks open · {c.n} questions</span></div>
              </li>
            ))}
          </ul>
        )}
        {!pro && chapters.ranked.length > FREE_CHAPTERS && <ProLock what={`${chapters.ranked.length - FREE_CHAPTERS} more ranked chapters are part of Pro.`} onNavigate={onNavigate} />}
        {pro && chapters.thin.length > 0 && (
          <>
            <button type="button" className="pp-toggle" aria-expanded={showThin} onClick={() => setShowThin((v) => !v)}>
              {showThin ? 'Hide' : 'Show'} {chapters.thin.length} chapter{chapters.thin.length === 1 ? '' : 's'} with too few questions to rank
            </button>
            {showThin && <ul className="pp-thin">{chapters.thin.slice(0, 8).map((c) => <li key={c.key}>{c.chapter} · {c.subjectName} · {c.right}/{c.n} right</li>)}</ul>}
          </>
        )}
      </section>

      <section aria-labelledby="pp-a">
        <h3 id="pp-a" className="pp-h">Changed answers</h3>
        {!pro ? (
          <ProLock what="Changed-answer detail is part of Pro. The headline above already counts both gains and losses." onNavigate={onNavigate} />
        ) : changes.count === 0 ? (
          <p className="pp-note">No changed answers recorded{changes.sessionsWithTelemetry === 0 ? ' (no session has a usable replay yet)' : ''}.</p>
        ) : (
          <div className="pp-changes">
            <div><span>Helped</span><i data-k="gain" style={{ width: `${(changes.marksGained / maxChange) * 100}%` }} /><b>{signed(changes.marksGained)}</b><small>{changes.gains}</small></div>
            <div><span>Hurt</span><i data-k="loss" style={{ width: `${(changes.marksLost / maxChange) * 100}%` }} /><b>{signed(-changes.marksLost)}</b><small>{changes.losses}</small></div>
            <p className="pp-note">Net {signed(changes.net)} marks across {changes.count} changes in {changes.sessionsWithTelemetry} replayed session{changes.sessionsWithTelemetry === 1 ? '' : 's'}. This shows what happened, not why you changed.</p>
          </div>
        )}
      </section>

      <section aria-labelledby="pp-p">
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
            {pace.slowest.length > 0 && <ul className="pp-thin">{pace.slowest.slice(0, 3).map((s) => <li key={`${s.attemptId}-${s.position}`}>Q{s.position} · {s.chapter} · {sec(s.seconds)} ({s.outcome === 'skip' ? 'blank' : s.outcome})</li>)}</ul>}
            <p className="pp-note">Timing comes from device events across {pace.questionsTimed} questions in {pace.sessionsTimed} session{pace.sessionsTimed === 1 ? '' : 's'}.</p>
          </>
        )}
      </section>

      <section aria-labelledby="pp-w">
        <h3 id="pp-w" className="pp-h">This week and last</h3>
        <div className="pp-week">
          {[['Last 7 days', week.thisWeek], ['Week before', week.lastWeek]].map(([label, w]) => (
            <div key={label}>
              <span>{label}</span>
              <b>{w.sessions ? signed(w.net) : '—'}</b>
              <small>{w.sessions ? `${w.sessions} session${w.sessions === 1 ? '' : 's'} · ${w.questions} questions${w.accuracy.pct !== null ? ` · ${w.accuracy.pct}%` : ''}` : 'No sessions'}</small>
            </div>
          ))}
        </div>
        <p className="pp-note">Active on {week.activeDaysLast14} of the last 14 days. Small samples swing a lot, so read this as a description, not a verdict.</p>
      </section>
    </div>
  );
}
