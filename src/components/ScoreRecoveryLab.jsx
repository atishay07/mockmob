"use client";
// Score Recovery Lab on the result page: Find the marks you lost, Repair the mistakes, Prove it on
// fresh questions. Facts come from the server-scored attempt; device events are labelled as such.
import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/fetcher';
import { attemptScoring } from '@/../data/attempt_scoring';
import { formatDuration } from '@/../data/session_recovery';

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

function QChips({ numbers, onJump }) {
  if (!numbers?.length) return null;
  return (
    <span className="srl-qchips">
      <span className="srl-qchips__label">See</span>
      {numbers.map(n => <button key={n} type="button" onClick={() => onJump(n)} aria-label={`Go to question ${n}`}>Q{n}</button>)}
    </span>
  );
}

function Prove({ attempt, topChapter }) {
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
      {!replay ? <p className="srl-muted" role="status">Checking for fresh questions…</p>
        : fresh ? <>
            <p>Five questions you have not seen from <b>{fresh.chapter}</b>. Getting them right in a day or two is how you know a repair stuck.</p>
            <button type="button" className="srl-cta" onClick={() => go(fresh.href)}>Try 5 fresh questions <ArrowRight size={16} aria-hidden="true" /></button>
          </>
        : <>
            <p>{topChapter ? <>We don’t have five unseen, verified questions for <b>{topChapter}</b> yet, so this is a regular set on that chapter.</> : 'We don’t have five unseen, verified questions yet, so this is a regular set in the same subject.'} Questions you have seen before don’t count as proof.</p>
            <button type="button" className="srl-cta srl-cta--quiet" onClick={() => go(ordinary)}>{topChapter ? `Practise ${topChapter}` : 'Practise 10 more'} <ArrowRight size={16} aria-hidden="true" /></button>
          </>}
    </div>
  );
}

function DecisionLog({ attempt, analysis }) {
  const recovery = attempt.selectionMeta?.recovery;
  const changes = analysis.telemetry === 'self_reported' ? recovery?.observed?.answerChanges || [] : [];
  const [reflection, setReflection] = useState('');
  const [saveState, setSaveState] = useState('');
  const numberOf = (qid) => analysis.rows.find(r => r.q.id === qid)?.number;
  const letter = (i) => i === null || i === undefined ? 'blank' : 'ABCD'[i];
  return (
    <details className="srl-log">
      <summary>Every answer you changed, and a note for your playbook</summary>
      <div className="srl-log__body">
        {analysis.telemetry !== 'self_reported' ? (
          <p className="srl-muted">{analysis.telemetry === 'inconsistent' ? 'The record from your device didn’t match your submitted answers, so it isn’t used. Your score is unaffected.' : 'No answer-change record was captured for this session. Your score is unaffected.'}</p>
        ) : changes.length ? (
          <ol className="srl-changes">
            {changes.map(c => (
              <li key={`${c.qid}-${c.at}`}>
                <span className="srl-changes__time">{formatDuration(c.at)}</span>
                <span>Q{numberOf(c.qid)}: {letter(c.before)} → {letter(c.after)}</span>
                <b data-tone={c.markEffect > 0 ? 'good' : c.markEffect < 0 ? 'bad' : 'neutral'}>{c.markEffect > 0 ? '+' : c.markEffect < 0 ? '−' : '±'}{Math.abs(c.markEffect)}</b>
              </li>
            ))}
          </ol>
        ) : <p className="srl-muted">You didn’t change any answers this session.</p>}
        <form className="srl-note" onSubmit={async e => {
          e.preventDefault(); setSaveState('Saving…');
          try { await apiPost('/api/recovery', { attemptId: attempt.id, strategy: analysis.mistakes.length ? 'concept_repair' : 'two_pass', reflection }); setSaveState('Saved to your playbook.'); }
          catch { setSaveState('Could not save. Your note is still here; try again.'); }
        }}>
          <label htmlFor="srl-reflection">One line for next time</label>
          <textarea id="srl-reflection" maxLength={1000} value={reflection} onChange={e => setReflection(e.target.value)} placeholder="For example: I change answers without a real reason." />
          <div className="srl-note__row">
            <button type="submit" className="srl-cta srl-cta--quiet" disabled={saveState === 'Saving…' || !reflection.trim()}>Save note</button>
            <p role="status" className="srl-muted">{saveState}</p>
          </div>
        </form>
      </div>
    </details>
  );
}

export default function ScoreRecoveryLab({ attempt, analysis, repaired, handled = repaired, onJump, onRepairNext }) {
  const { marks, chapters, observations, mistakes } = analysis;
  const [ref, inView] = useInView();
  const device = attemptScoring(attempt) !== 'server';
  const topChapter = chapters.find(c => c.wrong > 0)?.chapter || chapters[0]?.chapter || null;
  const done = mistakes.filter(r => repaired.has(r.q.id)).length;
  const pct = (v) => `${marks.max ? (v / marks.max) * 100 : 0}%`;
  const maxGap = chapters[0]?.gap || 1;
  const [expanded, setExpanded] = useState(false);
  const findId = useId();

  return (
    <section ref={ref} className="srl" data-in={inView || undefined} aria-labelledby="srl-title">
      <header className="srl-head">
        <p className="srl-eyebrow">Score Recovery Lab</p>
        <h2 id="srl-title">{marks.gap ? <>You missed {marks.gap} marks. Here’s where they went.</> : 'You didn’t miss a mark this session.'}</h2>
      </header>

      {marks.gap ? <>
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

      <ol className="srl-steps">
        <li className="srl-step">
          <div className="srl-step__num" aria-hidden="true">1</div>
          <div className="srl-step__main srl-find" id={findId} data-expanded={expanded}>
            <div className="srl-step__head"><h3>Find</h3><p>Which chapters cost you, and why</p></div>
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
                    <span className="srl-obs__tip"><ArrowRight size={14} aria-hidden="true" />{o.tip}</span>
                    <QChips numbers={o.questions} onJump={onJump} />
                  </li>
                ))}
              </ul>
            ) : null}
            {(chapters.length > 1 || observations.length > 1) && <button type="button" className="srl-find-toggle" aria-expanded={expanded} aria-controls={findId} onClick={() => setExpanded(value => !value)}>{expanded ? 'Show the key finding' : 'See all chapters and observations'}<span aria-hidden="true">{expanded ? '−' : '+'}</span></button>}
            {device ? <p className="srl-fine">This earlier session was scored in your browser, so answer changes and timings aren’t available.</p> : null}
          </div>
        </li>

        <li className="srl-step">
          <div className="srl-step__num" aria-hidden="true">{mistakes.length && done === mistakes.length ? <Check size={16} strokeWidth={3} /> : 2}</div>
          <div className="srl-step__main">
            <div className="srl-step__head"><h3>Repair</h3><p>Fix each wrong answer, one at a time</p></div>
            {mistakes.length ? <>
              <p>Each repair shows why your answer felt right, where it breaks, and the one idea to keep. It’s checked against the answer key before you see it.</p>
              <div className="srl-progress">
                <div className="srl-progress__track" aria-hidden="true"><span style={{ width: `${(done / mistakes.length) * 100}%` }} /></div>
                <span>{done} of {mistakes.length} explanations ready</span>
              </div>
              {handled.size > done ? <p className="srl-fine">{handled.size - done} held or without an explanation. These do not count as repaired.</p> : null}
              <div className="srl-queue">
                {mistakes.map(r => (
                  <button key={r.q.id} type="button" className="srl-queue__item" data-done={repaired.has(r.q.id) || undefined} onClick={() => onJump(r.number)}>
                    Q{r.number}<span>{r.chapter}</span>
                  </button>
                ))}
              </div>
              {handled.size < mistakes.length ? (
                <button type="button" className="srl-cta" onClick={onRepairNext}>{`Repair Q${mistakes.find(r => !handled.has(r.q.id)).number}`} <ArrowRight size={16} aria-hidden="true" /></button>
              ) : done === mistakes.length ? <p className="srl-done">All explanations ready. Try fresh questions when you are ready.</p> : <p className="srl-fine">Review the recorded answers below or continue with ordinary practice.</p>}
              <p className="srl-fine">1 credit per repair · reopening a repair is free · no charge if a question is held for review</p>
            </> : <p>No wrong answers to repair this session.</p>}
          </div>
        </li>

        <li className="srl-step">
          <div className="srl-step__num" aria-hidden="true">3</div>
          <div className="srl-step__main">
            <div className="srl-step__head"><h3>Prove</h3><p>Show it stuck, on questions you haven’t seen</p></div>
            <Prove attempt={attempt} topChapter={topChapter} />
          </div>
        </li>
      </ol>

      <DecisionLog attempt={attempt} analysis={analysis} />
    </section>
  );
}
