"use client";
// The free answer sheet (LEARN-REVIEW-1017 5.5, L13): an open mistake never needs a credit to be understood. It opens in
// place under its row. "Try it again" shows the question with the key hidden; "Show the answer" shows your pick, the
// correct answer and the book explanation. Both are free and record nothing. "Repair Q{n}" is the paid step inside it and
// runs the existing repair (recovery/MistakeRepair.jsx, which holds RepairCheck). A mistake that already has a saved repair
// (repaired, held, slipped) opens that repair, free, and is never offered a paid one (F17).
//
// The question itself (options, key, explanation) is read from the attempt, not from /api/me/review, which never carries a key.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/fetcher';
import MistakeRepair from '@/components/recovery/MistakeRepair';
import { haveLine } from '@/lib/creditCopy.mjs';
import { aiRenewsLine } from '@/../data/review_input.mjs';

const LETTERS = 'ABCDEFGH';
const SAVED = new Set(['repaired', 'held', 'slipped']);
const text = (v) => (v == null ? '' : typeof v === 'string' || typeof v === 'number' ? String(v) : v.text ?? v.label ?? v.name ?? '');

// One read per paper, shared by every sheet on the page. A failed read is forgotten, so Try again reads again.
const attempts = new Map();
export function loadAttempt(id) {
  if (!attempts.has(id)) attempts.set(id, apiGet(`/api/attempts/${encodeURIComponent(id)}`).catch((e) => { attempts.delete(id); throw e; }));
  return attempts.get(id);
}

/** The question an item points at in its paper: by id, else by its number. */
export function questionOf(attempt, item) {
  const snap = attempt?.questionsSnapshot || attempt?.questions_snapshot || [];
  const q = (item.qid && snap.find((x) => x?.id === item.qid)) || snap[item.number - 1] || null;
  if (!q) return null;
  const d = (attempt?.details || []).find((x) => x?.qid === q.id) || null;
  const given = Number.isInteger(d?.givenIndex) ? d.givenIndex : item.pick ? LETTERS.indexOf(item.pick) : null;
  return {
    id: q.id, stem: text(q.question ?? q.body), options: (q.options || []).map(text),
    key: Number.isInteger(q.correctIndex) ? q.correctIndex : null, given: given >= 0 ? given : null, explanation: text(q.explanation),
  };
}

function useQuestion(item, wanted) {
  const [state, setState] = useState({ status: 'idle' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!wanted) return undefined;
    let alive = true;
    loadAttempt(item.attemptId)
      .then((a) => { if (alive) { const q = questionOf(a, item); setState(q ? { status: 'ready', q } : { status: 'missing' }); } })
      .catch(() => { if (alive) setState({ status: 'error' }); });
    return () => { alive = false; };
  }, [wanted, item.attemptId, item.qid, item.number, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  return [state, () => { setState({ status: 'loading' }); setTick((t) => t + 1); }];
}

function TryAgain({ q, number, onShow }) {
  const [picked, setPicked] = useState([]);
  const last = picked[picked.length - 1];
  const right = last !== undefined && last === q.key;
  return (
    <div className="rvw-try">
      <p className="rvw-try__stem">{q.stem}</p>
      <ul className="rvw-opts" aria-label={`Options for question ${number}`}>
        {q.options.map((o, i) => (
          <li key={i}>
            <button type="button" className="rvw-opt mk-press" disabled={right || picked.includes(i)} data-k={picked.includes(i) ? (i === q.key ? 'right' : 'wrong') : undefined} onClick={() => setPicked((p) => [...p, i])}>
              <i>{LETTERS[i]}</i><span>{o}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="rvw-try__said" role="status" aria-live="polite">
        {last === undefined ? 'Pick one. Nothing is recorded and nothing is charged.'
          : right ? `Right: ${LETTERS[last]}. This try is not recorded.`
            : <>Not {LETTERS[last]}. The answer stays hidden. Pick again, or <button type="button" className="rvw-inline" onClick={onShow}>show the answer</button>.</>}
      </p>
    </div>
  );
}

function Answer({ q }) {
  return (
    <div className="rvw-ans">
      <p className="rvw-try__stem">{q.stem}</p>
      <ul className="rvw-opts" aria-label="The options with your pick and the correct answer">
        {q.options.map((o, i) => {
          const mine = i === q.given;
          const key = i === q.key;
          return (
            <li key={i}>
              <span className="rvw-opt" data-k={key ? 'right' : mine ? 'wrong' : undefined}>
                <i>{LETTERS[i]}</i><span>{o}{key || mine ? <small>{key && mine ? 'Your pick, correct' : key ? 'Correct' : 'Your pick'}</small> : null}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="rvw-ans__expl">
        <b>Book explanation</b>
        <p>{q.explanation || 'This question has no book explanation yet. A repair writes why your pick looked right and why the key is right.'}</p>
      </div>
    </div>
  );
}

export default function AnswerSheet({ item, wallet, autoRepair = false, onChanged }) {
  const saved = SAVED.has(item.state) && !item.keyState;
  const repairable = item.repairable;
  const [mode, setMode] = useState(saved ? 'saved' : autoRepair && repairable ? 'repair' : 'hidden');
  const needs = mode !== 'hidden' && !(mode === 'saved' && item.qid) && !(mode === 'repair' && item.qid && item.pick);
  const [read, retry] = useQuestion(item, mode !== 'hidden');
  const q = read.status === 'ready' ? read.q : null;
  const noAi = Number.isFinite(wallet?.aiCredits) && wallet.aiCredits < 1;
  const settle = (_qid, status) => { if (status === 'explained' || status === 'stored') onChanged?.(); };

  const waiting = needs && (read.status === 'loading' || read.status === 'idle');
  const failed = needs && (read.status === 'error' || read.status === 'missing');

  const body = (() => {
    if (waiting) return <p className="rvw-sheet__note" role="status">Opening Question {item.number}.</p>;
    if (failed) return <p className="rvw-sheet__note" role="alert">Question {item.number} did not load. <button type="button" className="rvw-inline" onClick={retry}>Try again</button></p>;
    if (mode === 'try' && q) return <TryAgain q={q} number={item.number} onShow={() => setMode('answer')} />;
    if (mode === 'answer' && q) return <Answer q={q} />;
    if (mode === 'repair' || mode === 'saved') {
      const questionId = item.qid || q?.id;
      if (!questionId) return null;
      return (
        <MistakeRepair
          attemptId={item.attemptId} questionId={questionId} number={item.number}
          chosen={item.pick || (Number.isInteger(q?.given) ? LETTERS[q.given] : null)}
          answer={Number.isInteger(q?.key) ? LETTERS[q.key] : null}
          autoStart saved={mode === 'saved' ? item.repairedAt || 'saved' : null} paper={item.stamp}
          onSettled={settle} onCheck={() => onChanged?.()}
        />
      );
    }
    if (item.keyState) return <p className="rvw-sheet__note">The answer key for this question is being re-checked, so it is left out of repairs and marks until it is cleared. Trying it again is free.</p>;
    return <p className="rvw-sheet__note"><b>The answer stays hidden until you ask.</b> Try it again first, or see the correct answer and the book explanation. Both are free.</p>;
  })();

  const showKeys = mode === 'hidden' || mode === 'try' || mode === 'answer';
  return (
    <div className="rvw-sheet" data-mode={mode}>
      {body}
      {showKeys ? (
        <div className="rvw-sheet__keys">
          {mode !== 'try' ? <button type="button" className="rvw-key mk-press" onClick={() => setMode('try')}>Try it again</button> : null}
          {mode !== 'answer' && !item.keyState ? <button type="button" className="rvw-key mk-press" onClick={() => setMode('answer')}>Show the answer</button> : null}
          {repairable && !noAi ? <button type="button" className="rvw-key mk-press" onClick={() => setMode('repair')}>Repair Q{item.number}, 1 AI credit</button> : null}
        </div>
      ) : null}
      {showKeys && repairable && noAi ? (
        <p className="rvw-sheet__fine">A repair adds why {item.pick || 'your pick'} looked right, the trap, one rule and a Check it held, for 1 AI credit. {haveLine(0)}{aiRenewsLine(wallet) ? ` ${aiRenewsLine(wallet)}` : ''} <Link href="/pricing/ai-credits">See your AI credits</Link></p>
      ) : null}
    </div>
  );
}
