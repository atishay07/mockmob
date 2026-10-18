"use client";
// The free steps of an open mistake, shared by Review's answer sheet (AnswerSheet.jsx) and the result's "Your mistakes"
// (components/result/RetryFirst.jsx): the question as the sheet reads it, "Try it again" with the key hidden, the note that says
// the answer stays hidden, and the two free keys. Nothing here reaches the server: a try is not recorded, marked or charged
// (data/retry_first.mjs holds the rules and the words). The paid Repair is never in this file.
import { useState } from 'react';
import { RETRY_COPY } from '@/../data/retry_first.mjs';
import { plainOptionTexts } from '@/../data/option_text';
import './review-1017.css';

export const LETTERS = 'ABCDEFGH';
const text = (v) => (v == null ? '' : typeof v === 'string' || typeof v === 'number' ? String(v) : v.text ?? v.label ?? v.name ?? '');

/**
 * One question as the free steps read it: the stem, the options as plain text, the key and the student's pick as option
 * indexes, and the book explanation. `d` is the paper's detail for the question (its givenIndex); `pick` is the letter a row
 * already carries when the paper's detail is not at hand.
 */
export function questionModel(q, d = null, pick = null) {
  if (!q) return null;
  const given = Number.isInteger(d?.givenIndex) ? d.givenIndex : pick ? LETTERS.indexOf(pick) : null;
  return {
    id: q.id, stem: text(q.question ?? q.body), options: plainOptionTexts(q.options).map(text),
    key: Number.isInteger(q.correctIndex) ? q.correctIndex : null, given: given >= 0 ? given : null, explanation: text(q.explanation),
  };
}

/**
 * "Try it again": the question with the key hidden, one button per option.
 *   onShow     the student asks for the answer instead
 *   onPick     when given, the try is a single pick: it locks and tells the page ({ pick, right }), and the page decides what
 *              to show next (the result reveals the key and the book explanation). Without it, Review's own behaviour: a wrong
 *              pick stays marked and the student may pick again.
 *   showStem   false when the row above already shows the question (the result's open row does)
 *   tagPick    marks the option the student first picked ("Your pick"); it never says which option is the key
 */
export function TryAgain({ q, number, onShow, onPick = null, showStem = true, tagPick = false }) {
  const [picked, setPicked] = useState([]);
  const once = typeof onPick === 'function';
  const last = picked[picked.length - 1];
  const right = last !== undefined && last === q.key;
  const locked = once ? picked.length > 0 : right;
  const choose = (i) => {
    if (once && picked.length) return;
    setPicked((p) => [...p, i]);
    onPick?.({ pick: i, right: i === q.key });
  };
  return (
    <div className="rvw-try">
      {showStem ? <p className="rvw-try__stem">{q.stem}</p> : null}
      <ul className="rvw-opts" aria-label={`Options for question ${number}`}>
        {q.options.map((o, i) => (
          <li key={i}>
            <button type="button" className="rvw-opt mk-press" disabled={locked || picked.includes(i)} data-k={picked.includes(i) ? (i === q.key ? 'right' : 'wrong') : undefined} onClick={() => choose(i)}>
              <i>{LETTERS[i]}</i><span>{o}{tagPick && i === q.given ? <small>{RETRY_COPY.yourPick}</small> : null}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="rvw-try__said" role="status" aria-live="polite">
        {last === undefined ? RETRY_COPY.pick
          : right ? `Right: ${LETTERS[last]}. ${RETRY_COPY.notRecorded}`
            : <>Not {LETTERS[last]}. The answer stays hidden. Pick again, or <button type="button" className="rvw-inline" onClick={onShow}>show the answer</button>.</>}
      </p>
    </div>
  );
}

/** The note a sealed question carries: the answer stays hidden until the student asks, and both free steps cost nothing. */
export function HiddenNote() {
  return <p className="rvw-sheet__note"><b>{RETRY_COPY.hidden}</b> {RETRY_COPY.hiddenRest}</p>;
}

/**
 * The free keys: "Try it again" (until the try is open) and "Show the answer" (until it is shown). `children` are any
 * further keys the caller adds; Review adds its paid Repair there, the result adds none while the question is sealed.
 */
export function FreeKeys({ mode, onTry, onShow, showAnswer = true, children = null }) {
  return (
    <div className="rvw-sheet__keys">
      {mode !== 'try' ? <button type="button" className="rvw-key mk-press" onClick={onTry}>{RETRY_COPY.try}</button> : null}
      {mode !== 'answer' && showAnswer ? <button type="button" className="rvw-key mk-press" onClick={onShow}>{RETRY_COPY.show}</button> : null}
      {children}
    </div>
  );
}
