"use client";
// Mistake Repair, the try before the key (data/repair_retry.mjs; app: review/widgets/retry_first.dart). The question comes back
// with no key and no marks; the student picks and presses "Check my answer"; the server marks it (POST /api/recovery/retry,
// free) and the verdict shows in words under the options, which now carry their words ("Key", "Your pick now", "Your pick in
// this paper"). The reason is written under the verdict. A right second try is said plainly; a wrong one leads into the reason.
//
// This file only draws. MistakeRepair owns the state and the calls; nothing here decides right or wrong.
import { useEffect, useId, useRef } from 'react';
import { Check } from 'lucide-react';
import { RETRY_COPY, retryOptionWords, retryVerdict } from '@/../data/repair_retry.mjs';
import './repair-try.css';

const LETTERS = 'ABCDEFGH';

/**
 * The verdict line: the verdict in words and one line of what comes next. It rises 8 px and fades in over 240 ms; a wrong pick
 * does not shake (the student is learning, not failing a paper). Focus moves to it once, when it first appears.
 */
export function RepairVerdict({ retry, focus = true, stagger = null }) {
  const ref = useRef(null);
  const verdict = retryVerdict(retry);
  const kind = verdict?.kind;
  useEffect(() => { if (focus && kind) ref.current?.focus({ preventScroll: true }); }, [focus, kind]);
  if (!verdict) return null;
  return (
    <div className="mr-verdict" data-kind={verdict.kind} data-stagger={stagger ? true : undefined} style={stagger || undefined} role="status">
      <h5 className="mr-verdict__title" ref={ref} tabIndex={-1}>
        {verdict.kind === 'right' ? <Check size={18} strokeWidth={2.6} aria-hidden="true" /> : null}
        <span>{verdict.title}</span>
      </h5>
      <p className="mr-verdict__line">{verdict.line}</p>
    </div>
  );
}

/**
 * The try step. `phase` is 'pick' (choosing), 'checking' (the server is marking) or 'checked' (the verdict is in and `children`
 * holds what is happening under it: the wait line, an error and its button). `mobi` is the one Mobi of the screen, placed here
 * so he keeps his state from the try into the reason.
 */
export default function RepairTry({
  number = null, question, options, before = null, source = null, phase = 'pick', pick = null, retry = null,
  onPick, onCheck, onSkip, failed = false, cost = null, mobi = null, children = null,
}) {
  const name = useId();
  const hintId = useId();
  const words = phase === 'checked' ? retryOptionWords(retry, source) : {};
  const locked = phase !== 'pick';
  const passage = question?.passage;
  return (
    <section className="mr mr--panel mr--try" data-phase={phase} aria-label="Try it once more">
      <header className="mr-try__head">
        {Number.isInteger(number) ? <p className="mr-try__q">Question {number}</p> : null}
        <h4 className="mr-title mr-try__title">{RETRY_COPY.title}</h4>
      </header>
      {passage ? <div className="mr-try__passage"><p className="mr-label">Passage</p><p>{passage}</p></div> : null}
      {question?.text ? <p className="mr-try__stem">{question.text}</p> : null}
      <fieldset className="mr-try__options" disabled={locked} aria-describedby={phase === 'pick' ? hintId : undefined}>
        <legend className="mr-sr">{RETRY_COPY.title}</legend>
        {options.map((text, i) => {
          const tag = words[i] || (phase !== 'checked' && before === i ? RETRY_COPY.yourPickIn(source) : null);
          const kind = phase === 'checked' ? (retry?.keyIndex === i ? 'key' : retry?.pick === i ? 'mine' : null) : null;
          return (
            <label key={i} className="mr-opt" data-picked={pick === i && phase !== 'checked' ? true : undefined} data-kind={kind || undefined} data-before={before === i ? true : undefined}>
              <input type="radio" className="mr-sr" name={name} value={i} checked={pick === i} onChange={() => onPick?.(i)} />
              <span className="mr-opt__letter" aria-hidden="true">{LETTERS[i]}</span>
              <span className="mr-opt__text"><span className="mr-sr">Option {LETTERS[i]}. </span>{text}</span>
              {tag ? <span className="mr-opt__tag">{tag}</span> : null}
            </label>
          );
        })}
      </fieldset>
      {phase === 'checked' ? (
        <div className="mr-try__after">
          <div className="mr-try__verdict">{mobi}<RepairVerdict retry={retry} /></div>
          {children}
        </div>
      ) : (
        <>
          <div className="mr-try__hintrow">
            {mobi}
            <p className="mr-try__hint" id={hintId}>{RETRY_COPY.hint}</p>
          </div>
          {failed ? <p className="mr-note" role="alert">{RETRY_COPY.checkFailed}</p> : null}
          <div className="mr-try__actions">
            <button type="button" className="mr-next-btn mr-try__check" disabled={pick === null || phase === 'checking'} aria-busy={phase === 'checking' || undefined}
              aria-label={pick === null ? RETRY_COPY.checkNeedsPick : undefined} onClick={onCheck}>
              {phase === 'checking' ? RETRY_COPY.checking : RETRY_COPY.check}
            </button>
            {cost}
            <button type="button" className="mr-textbtn mr-try__skip" disabled={phase === 'checking'} onClick={onSkip}>{RETRY_COPY.showReasonNow}</button>
          </div>
        </>
      )}
    </section>
  );
}
