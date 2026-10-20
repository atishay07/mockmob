"use client";

// Mobi's v13 jobs, drawn (C-dec 3 and 3b, D157). The words and every rule are in mobiJobs.mjs (pure, tested); this file
// only lays them out and talks to the routes of the contract:
//
//  * StandingCard / WhereYouStand: "Where you stand" leads the Ask your record door. GET /api/mobi/standing (free, no
//    model): the range against the student's colleges, the first college's 2026 Round 1 closing marks and the gap, the 2 or
//    3 chapters that close it fastest, and honest partial, thin, empty and no-colleges states. Always with the note.
//  * DoubtChecks: the 2 new CUET-style questions that end a doubt, answered in place (POST /api/mobi/thread op 'answer'), marked
//    by the server with the key and the bank explanation. With none attached, chapter chips ask for them (op 'checks').
//  * TonightBlock: "What should I revise tonight?", read from the record, free: chapters, rules, traps and the Revise count.
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Minus } from 'lucide-react';
import { newCheckRequestId } from '../../../data/repair_check_client.mjs';
import {
  JOB_COPY, chapterChips, checkRows, checksTally, planThreadAnswer, planThreadChecks, standingView, tonightView,
} from './mobiJobs.mjs';
import './mobi-jobs.css';

const THREAD_TIMEOUT_MS = 15_000;

async function postThread(payload) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, THREAD_TIMEOUT_MS);
  try {
    const res = await fetch('/api/mobi/thread', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
    const body = await res.json().catch(() => null);
    return timedOut ? { kind: 'timeout' } : { kind: 'response', res, body };
  } catch {
    return { kind: timedOut ? 'timeout' : 'network' };
  } finally { clearTimeout(timer); }
}

// ---- Where you stand ----------------------------------------------------------------------------------------------------

function RangeBar({ scale, cutoff }) {
  if (!scale) return null;
  const [from, to] = scale.band;
  return (
    <div className="mj-bar" aria-hidden="true">
      <span className="mj-bar__track">
        <span className="mj-bar__band" style={{ left: `${from}%`, width: `${Math.max(1.5, to - from)}%` }} />
        {scale.tick !== null ? <span className="mj-bar__tick" style={{ left: `${scale.tick}%` }}><i>{cutoff}</i></span> : null}
      </span>
      <span className="mj-bar__ends"><small>{scale.from}</small><small>{scale.to}</small></span>
    </div>
  );
}

function ChapterLinks({ title, rows }) {
  if (!rows?.length) return null;
  return (
    <div className="mj-sub">
      <h4 className="mj-sub__title">{title}</h4>
      <ul className="mj-chapters">
        {rows.map((r) => (
          <li key={r.key}>
            <Link className="mj-chapter" href={r.href} aria-label={`Practise ${r.chapter}. ${r.marks}.`}>
              <span className="mj-chapter__text"><b>{r.chapter}</b><small>{[r.subject, r.detail].filter(Boolean).join(', ')}</small></span>
              <span className="mj-chapter__marks">{r.marks}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Where you stand" for one view (standingView()). Exported so fixtures render it on their own. */
export function StandingCard({ view, onRetry = null }) {
  const titleId = useId();
  return (
    <section className="mj-stand" data-kind={view.kind} aria-labelledby={titleId} aria-busy={view.kind === 'loading' || undefined}>
      <header className="mj-stand__head">
        <h3 id={titleId}>{JOB_COPY.standTitle}</h3>
        <span className="amd-price" data-price="free">Free</span>
      </header>

      {view.kind === 'loading' ? (
        <div className="mj-stand__wait" role="status"><p className="mj-quiet">{view.line}</p><span className="mj-skel" aria-hidden="true"><s /><s /><s /></span></div>
      ) : null}
      {view.kind === 'error' ? (
        <div className="mj-stand__wait" role="status">
          <p className="mj-quiet">{view.line}</p>
          {onRetry ? <button type="button" className="amd-key" onClick={onRetry}>{JOB_COPY.tryAgain}</button> : null}
        </div>
      ) : null}
      {view.kind === 'empty' ? <p className="mj-body">{view.line}</p> : null}
      {view.kind === 'thin' ? (
        <>
          <p className="mj-body">{view.line}</p>
          <ul className="mj-thin">
            {view.thin.map((t) => <li key={t.key}><Link href={t.href} className="mj-thin__row"><b>{t.name}</b><span>{t.line}</span></Link></li>)}
          </ul>
        </>
      ) : null}

      {view.kind === 'partial' || view.kind === 'ready' ? (
        <>
          <p className="sr-only">{view.headline}</p>
          <p className="mj-figure" aria-hidden="true"><strong>{view.range.low} to {view.range.high}</strong><small>out of {view.range.max}, from your practice</small></p>
          <RangeBar scale={view.scale} cutoff={view.college?.cutoff} />
          {view.college ? (
            <div className="mj-college">
              <p className="mj-college__name">{view.college.name}</p>
              <p className="mj-college__line">{view.college.line}</p>
              {view.gap ? <p className="mj-gap">{view.gap}</p> : null}
            </div>
          ) : null}
          {view.addColleges ? (
            <div className="mj-add">
              <p className="mj-body">{view.addColleges}</p>
              <Link href={view.collegesHref} className="amd-key">{JOB_COPY.addColleges}</Link>
            </div>
          ) : null}
          {view.kind === 'partial' ? (
            <div className="mj-add">
              {view.from ? <p className="mj-body">{view.from}</p> : null}
              <p className="mj-quiet">{view.compare}</p>
              {view.thin?.length ? (
                <ul className="mj-thin">
                  {view.thin.map((t) => <li key={t.key}><Link href={t.href} className="mj-thin__row"><b>{t.name}</b><span>{t.line}</span></Link></li>)}
                </ul>
              ) : null}
            </div>
          ) : null}
          <ChapterLinks title={view.chaptersTitle} rows={view.chapters} />
          {view.others?.length ? (
            <details className="mj-others">
              <summary>{JOB_COPY.otherColleges(view.others.length)}</summary>
              <ul>
                {view.others.map((c, i) => (
                  <li key={`${c.name}-${i}`} data-position={c.position}><b>{c.name}</b><span>{[c.cutoff, c.where].filter(Boolean).join('. ')}</span></li>
                ))}
              </ul>
            </details>
          ) : null}
          <p className="mj-note">{view.note}</p>
        </>
      ) : null}
    </section>
  );
}

/** Reads GET /api/mobi/standing for the signed-in student and draws it. Free on every plan. */
export function WhereYouStand({ userId }) {
  const [read, setRead] = useState({ phase: 'loading', body: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    fetch('/api/mobi/standing', { cache: 'no-store' })
      .then(async (res) => ({ res, body: await res.json().catch(() => null) }))
      .then(({ res, body }) => { if (alive) setRead(res.ok && body?.ok ? { phase: 'done', body } : { phase: 'error', body: null }); })
      .catch(() => { if (alive) setRead({ phase: navigator.onLine === false ? 'offline' : 'error', body: null }); });
    return () => { alive = false; };
  }, [userId, tick]);
  return <StandingCard view={standingView(read)} onRetry={() => { setRead({ phase: 'loading', body: null }); setTick((n) => n + 1); }} />;
}

// ---- The 2 questions that end a doubt ----------------------------------------------------------------------------------

function CheckQuestion({ q, i, n, state, onPick, onAnswer, disabled }) {
  const stemId = useId();
  const answered = state.phase === 'answered';
  const sending = state.phase === 'sending';
  const verdict = useRef(null);
  const told = useRef(false);
  useEffect(() => { if (answered && !state.replayed && !told.current) { told.current = true; verdict.current?.focus(); } }, [answered, state.replayed]);
  const rows = checkRows(q, answered ? state.result : null);
  return (
    <fieldset className="mj-q" data-phase={state.phase || 'open'}>
      <legend className="mj-q__n">{JOB_COPY.questionOf(i + 1, n)}</legend>
      <p className="mj-q__stem" id={stemId}>{q.question}</p>
      <ul className="mj-opts" role="radiogroup" aria-labelledby={stemId} data-answered={answered || undefined}>
        {rows.map((row) => {
          const optionId = `${stemId}-o${row.index}`;
          return (
            <li key={row.index} data-state={row.state || undefined} data-picked={(!answered && state.pick === row.index) || undefined}>
              <input
                type="radio" className="mj-opt__radio" name={`${stemId}-pick`} value={row.index}
                checked={answered ? row.isPick : state.pick === row.index}
                disabled={answered || sending || disabled} aria-labelledby={optionId}
                onChange={() => onPick(row.index)}
              />
              <span className="mj-opt__letter" aria-hidden="true">{row.letter}</span>
              <span className="mj-opt__text" id={optionId}>{row.text}{row.tag ? <span className="mj-opt__tag">{row.tag}</span> : null}</span>
            </li>
          );
        })}
      </ul>
      {!answered ? (
        <div className="mj-q__actions">
          <button type="button" className="mj-submit" disabled={!Number.isInteger(state.pick) || sending || disabled} data-sending={sending || undefined} onClick={onAnswer}>
            {sending ? JOB_COPY.marking : JOB_COPY.submit}
          </button>
          <span className="mj-fine">{JOB_COPY.firstCounts}</span>
        </div>
      ) : null}
      {state.error ? <p className="mj-err" role="alert">{state.error}</p> : null}
      {answered ? (
        <div className="mj-q__result">
          <p className="mj-verdict" data-right={state.result.right || undefined} tabIndex={-1} ref={verdict}>
            <span className="mj-verdict__mark" aria-hidden="true">{state.result.right ? <Check size={15} strokeWidth={2.6} /> : <Minus size={15} strokeWidth={2.6} />}</span>
            <span>{state.result.line}</span>
          </p>
          {state.result.explanation ? (
            <div className="mj-expl"><b>{JOB_COPY.explanation}</b><p>{state.result.explanation}</p></div>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}

/**
 * The 2 questions of one doubt. `checks` and `note` come with the reply that opened it; the answers are the server's, never
 * the screen's. With no questions attached, the chips ask for them on a chapter (free: they are part of the doubt).
 */
export function DoubtChecks({ threadId, checks: given = [], note = null, subject = null, chapter = null, insights = null, subjects = [], offline = false }) {
  const [checks, setChecks] = useState(given);
  const [line, setLine] = useState(note);
  const [anchor, setAnchor] = useState({ subject, chapter });
  const [finding, setFinding] = useState(null);
  const [answers, setAnswers] = useState({});
  const busy = useRef(new Set());
  const titleId = useId();
  const patch = (id, next) => setAnswers((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...next } }));

  async function answer(q) {
    const id = q.checkQuestionId;
    const a = answers[id] || {};
    if (busy.current.has(id) || a.phase === 'answered' || !Number.isInteger(a.pick)) return;
    busy.current.add(id);
    // One request id per answer, reused on a retry, so the first answer counts once.
    const requestId = a.requestId || newCheckRequestId();
    patch(id, { phase: 'sending', requestId, error: null });
    try {
      const plan = planThreadAnswer(await postThread({ op: 'answer', threadId, checkQuestionId: id, pick: a.pick, requestId }));
      if (plan.state === 'answered') patch(id, { phase: 'answered', result: plan.result, replayed: plan.replayed });
      else patch(id, { phase: 'open', error: plan.message, requestId: plan.canRetry ? requestId : null });
    } finally { busy.current.delete(id); }
  }

  async function ask(chip) {
    if (finding || offline) return;
    setFinding(chip);
    setLine(null);
    const plan = planThreadChecks(await postThread({ op: 'checks', threadId, subject: chip.subject, chapter: chip.chapter }));
    setFinding(null);
    if (plan.state === 'ready') { setChecks(plan.checks); setAnchor(chip); } else setLine(plan.message);
  }

  const n = checks.length;
  const tally = checksTally(Object.fromEntries(checks.map((q) => [q.checkQuestionId, answers[q.checkQuestionId]?.result])), n);
  const chips = n ? [] : chapterChips({ subject: anchor.subject, insights, subjects });
  return (
    <section className="mj-checks" aria-labelledby={titleId}>
      <h4 className="mj-sub__title" id={titleId}>{JOB_COPY.checksTitle}</h4>
      {n ? <p className="mj-quiet">{JOB_COPY.checksLead(anchor.chapter || checks[0]?.chapter || null)}</p> : null}
      {checks.map((q, i) => (
        <CheckQuestion
          key={q.checkQuestionId} q={q} i={i} n={n} state={answers[q.checkQuestionId] || {}} disabled={offline}
          onPick={(pick) => patch(q.checkQuestionId, { pick, error: null })} onAnswer={() => answer(q)}
        />
      ))}
      {tally ? <p className="mj-tally" role="status">{tally}</p> : null}
      {!n ? (
        <div className="mj-pick">
          {line ? <p className="mj-body">{line}</p> : null}
          {finding ? <p className="mj-quiet" role="status">{JOB_COPY.checksFinding(finding.chapter)}</p> : null}
          {chips.length && !finding ? (
            <>
              <p className="mj-fine">{JOB_COPY.pickChapter}</p>
              <ul className="mj-chips">
                {chips.map((c) => <li key={`${c.subject}::${c.chapter}`}><button type="button" className="mj-chip" disabled={offline} onClick={() => ask(c)}>{c.chapter}</button></li>)}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

// ---- What should I revise tonight? -------------------------------------------------------------------------------------

/** Tonight's set from the record, free. `onNavigate(route)` keeps the panel's own way of leaving. */
export function TonightBlock({ tonight, actions = [], onNavigate }) {
  const view = tonightView(tonight);
  const keys = (actions || []).filter((a) => a?.label && (a.route || a.target)).slice(0, 3);
  if (!view && !keys.length) return null;
  return (
    <div className="mj-tonight">
      {view?.chapters.length ? (
        <div className="mj-sub">
          <h4 className="mj-sub__title">{JOB_COPY.tonightChapters}</h4>
          <ul className="mj-chapters">
            {view.chapters.map((c) => (
              <li key={c.key}>
                <button type="button" className="mj-chapter" onClick={() => onNavigate(c.href)} aria-label={`Practise ${c.chapter}${c.lost ? `. ${c.lost}` : ''}.`}>
                  <span className="mj-chapter__text"><b>{c.chapter}</b>{c.subject ? <small>{c.subject}</small> : null}</span>
                  {c.lost ? <span className="mj-chapter__marks">{c.lost}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {view?.rules.length ? (
        <div className="mj-sub"><h4 className="mj-sub__title">{JOB_COPY.tonightRules}</h4><ul className="mj-lines">{view.rules.map((r) => <li key={r}>{r}</li>)}</ul></div>
      ) : null}
      {view?.traps.length ? (
        <div className="mj-sub"><h4 className="mj-sub__title">{JOB_COPY.tonightTraps}</h4><ul className="mj-lines">{view.traps.map((t) => <li key={t}>{t}</li>)}</ul></div>
      ) : null}
      {view?.due ? <p className="mj-body">{view.due}</p> : null}
      {view?.line ? <p className="mj-body mj-tonight__line">{view.line}</p> : null}
      {keys.length ? (
        <div className="mj-keys">
          {keys.map((a, i) => <button key={a.label} type="button" className={`amb-btn ${i === 0 ? 'amb-btn--line' : 'amb-btn--line mj-quietkey'}`} onClick={() => onNavigate(a.route || a.target)}>{a.label}</button>)}
        </div>
      ) : null}
    </div>
  );
}
