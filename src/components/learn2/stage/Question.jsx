'use client';
// A question on the study stage (BUILD-1101 B1, B7 B/D/F; A1 3.5; A8 3.1, 3.3): on the canvas, top-aligned, graded by the
// server (no key on the client before the answer).
//   <QuestionView head mistake stem options answer onChoose skipped error lineRef afterVerdict />
//     head      "Question 2 of 5" or an old mistake's own head ("You missed this in Mock 4 on 24 Oct"); mistake: boolean
//     options   [{ key, text }] as served; the letters are drawn A, B, C...
//     answer    null | { choice, pending } | { choice, res } where res = { correct, key, line, explanation, fixedText }
//     streak    right answers in a row including this one ("Right. 4 in a row." from 3)
//     skipped   null | text: the item was left out (409), shown in place of the options
//     locked    null | text: the run is closed, the options are shown but answer nothing
//   <Options>, <Verdict>, <LineInPlace> are exported for a screen that lays them out itself.
// The rows use aria-disabled (never disabled) so focus is not lost on answering (A8 F7); each row reads "Option B. <text>".
import { useEffect, useId, useRef } from 'react';
import { Check, LoaderCircle, X } from 'lucide-react';
import { CardSource, NcertText } from '@/components/keycards/KeyCard';
import { stemParts } from '../run/runMath';
import { assertionReason, matchLists, optionTexts, stemSize, twoColumns } from './stageText.mjs';

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function Stem({ text, id }) {
  const ar = assertionReason(text);
  if (ar) {
    return (
      <div className="st-stem st-ar" id={id} data-size={stemSize(text)}>
        <p><b>Assertion</b>{ar.assertion}</p>
        <p><b>Reason</b>{ar.reason}</p>
      </div>
    );
  }
  const lists = matchLists(text);
  if (lists) {
    return (
      <div className="st-stem" id={id} data-size={stemSize(text)}>
        {lists.lead ? <p>{lists.lead}</p> : null}
        <div className="st-lists">
          {[['List-I', lists.one], ['List-II', lists.two]].map(([name, rows]) => (
            <div key={name} className="st-list2">
              <b>{name}</b>
              <ol className="st-steps">{rows.map((r) => <li key={r.label}><span>({r.label})</span><span>{r.text}</span></li>)}</ol>
            </div>
          ))}
        </div>
        {lists.tail ? <p style={{ marginTop: 6 }}>{lists.tail}</p> : null}
      </div>
    );
  }
  const parts = stemParts(text);
  if (parts) {
    return (
      <div className="st-stem" id={id} data-size={stemSize(text)}>
        {parts.lead ? <p>{parts.lead}</p> : null}
        <ol className="st-steps">{parts.steps.map((s) => <li key={s.label}><span>({s.label})</span><span>{s.text}</span></li>)}</ol>
        {parts.tail ? <p style={{ marginTop: 6 }}>{parts.tail}</p> : null}
      </div>
    );
  }
  return <h2 className="st-stem" id={id} data-size={stemSize(text)}>{text}</h2>;
}

export function Options({ options = [], answer = null, onChoose, labelledBy, locked = false, refEl }) {
  const texts = optionTexts(options);
  const res = answer?.res || null;
  const pending = Boolean(answer?.pending);
  return (
    <div className="st-opts" role="group" aria-labelledby={labelledBy} data-cols={twoColumns(texts) ? '2' : undefined} ref={refEl}>
      {options.map((o, i) => {
        const isChosen = answer?.choice === o.key;
        const isRight = res && res.key === o.key;
        const state = !res ? (pending && isChosen ? 'pending' : undefined) : isRight ? (isChosen ? 'right' : 'key') : isChosen ? 'wrong' : 'rest';
        const off = Boolean(res) || pending || locked;
        return (
          <button key={o.key} type="button" className="st-opt" data-state={state} data-key={o.key} aria-disabled={off || undefined} aria-pressed={isChosen || undefined}
            onClick={() => { if (!off) onChoose?.(o.key); }}>
            <span className="st-opt__k" aria-hidden="true">{LETTERS[i] || o.key}</span>
            <span className="st-opt__t"><span className="sr-only">{`Option ${LETTERS[i] || o.key}. `}</span>{texts[i]}</span>
            <span className="st-opt__mark" aria-hidden="true">
              {state === 'pending' ? <LoaderCircle className="kc-spin" size={16} strokeWidth={2.2} /> : null}
              {state === 'right' || state === 'key' ? <Check size={18} strokeWidth={2.6} /> : null}
              {state === 'wrong' ? <X size={18} strokeWidth={2.6} /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The answer's letter as drawn (A, B, ...), from the served options. */
export const letterOf = (options, key) => LETTERS[(options || []).findIndex((o) => o.key === key)] || key;

/** "Right." / "Right. 4 in a row." / the server's fixed text / "Not quite. The answer is B." (visual; the stage announces). */
export function Verdict({ res, letter, streak = 0 }) {
  if (!res) return null;
  if (res.correct) {
    const text = res.fixedText || (streak >= 3 ? null : 'Right.');
    return (
      <p className="st-verdict" data-good="" aria-hidden="true">
        <Check size={18} strokeWidth={2.6} />
        {text ? <span>{text}</span> : <span>Right. <b key={streak}>{streak}</b> in a row.</span>}
      </p>
    );
  }
  return <p className="st-verdict" data-bad="" aria-hidden="true"><X size={18} strokeWidth={2.6} /><span>{`Not quite. The answer is ${letter}.`}</span></p>;
}

/** The line you needed, opened in place under the options (never a sheet over them). */
export function LineInPlace({ res, open, titleRef, onSeePro }) {
  const line = res && !res.correct ? res.line : null;
  const show = Boolean(res && !res.correct);
  return (
    <div className="st-lineopen" data-open={(show && open) || undefined}>
      <div>
        {show ? (
          <section className="st-line" aria-labelledby={undefined}>
            <h3 className="st-line__title" ref={titleRef} tabIndex={-1}>{line?.card && !line.locked ? 'The line you needed' : line?.locked ? 'The line you needed' : 'Why'}</h3>
            {line?.locked ? (
              <>
                <p className="st-line__text">{line.text}</p>
                {onSeePro ? <button type="button" className="st-textkey" style={{ justifySelf: 'start' }} onClick={onSeePro}>See Pro</button> : null}
              </>
            ) : line?.card ? (
              <>
                <NcertText card={line.card} />
                <CardSource card={line.card} />
              </>
            ) : <p className="st-line__text">{res.explanation || 'The right answer is marked above.'}</p>}
          </section>
        ) : null}
      </div>
    </div>
  );
}

export function QuestionView({ head, mistake = false, stem, options, answer, onChoose, streak = 0, skipped = null, locked = null, error = null, lineTitleRef, onSeePro, optionsRef }) {
  const id = useId();
  const res = answer?.res || null;
  const line = useRef(null);
  const titleRef = lineTitleRef || line;
  // After a wrong answer the line's title is brought into view (+300 ms), clear of the action bar.
  useEffect(() => {
    if (!res || res.correct) return undefined;
    const t = setTimeout(() => {
      try { titleRef.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); } catch { /* old browser */ }
    }, 300);
    return () => clearTimeout(t);
  }, [res, titleRef]);
  return (
    <div className="st-q">
      <p className="st-qhead" data-mistake={mistake || undefined}>{head}</p>
      <Stem text={stem} id={`${id}-stem`} />
      {skipped ? <p className="st-leftout">{skipped}</p> : (
        <>
          <Options options={options} answer={answer} onChoose={onChoose} labelledBy={`${id}-stem`} locked={Boolean(locked)} refEl={optionsRef} />
          {locked && !res ? <p className="st-leftout">{locked}</p> : null}
          <Verdict res={res} letter={res ? letterOf(options, res.key) : null} streak={streak} />
          <LineInPlace res={res} open={Boolean(res)} titleRef={titleRef} onSeePro={onSeePro} />
        </>
      )}
      {error ? <p className="kc-err" role="alert">{error}</p> : null}
    </div>
  );
}
