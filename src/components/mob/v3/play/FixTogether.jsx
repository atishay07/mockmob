"use client";
// R9, Fix it together (Live 17's answer sheet; after the game closes only). The lamp-lit answer sheet shows the trap
// question with YOUR pick struck in pencil and the right one filled, then the bank's explanation. Only your own pick
// is ever shown (F3). Then one fresh question like it, only for you, with the answer and the why at once; and on
// Wednesday one more checks the fix holds. No timer.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Send } from 'lucide-react';
import { mobGameApi } from './playApi';
import { PlayFold } from './PlayFold';
import { RunHead } from './GameRun';
import { COPY, LETTERS, errorSentence } from './playModel.mjs';

export default function FixTogether({ gameId, game, mobName, hrefs }) {
  const [review, setReview] = useState(null);
  const [start, setStart] = useState(null);
  const [error, setError] = useState(null);
  const [stage, setStage] = useState('sheet'); // sheet | now | check
  const [question, setQuestion] = useState(null);
  const [pick, setPick] = useState(null);
  const [answer, setAnswer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const r = await mobGameApi.review(gameId);
        if (!on) return;
        setReview(r);
        if (!r.trap) return;
        const s = await mobGameApi.fixStart(gameId, r.trap.q, 'now');
        if (on) { setStart(s); setQuestion(s.question); }
      } catch (e) { if (on) setError(e); }
    })();
    return () => { on = false; };
  }, [gameId]);

  const openCheck = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      const s = await mobGameApi.fixStart(gameId, review.trap.q, 'check');
      setQuestion(s.question); setPick(null); setAnswer(null); setStage('check');
    } catch (e) { setNotice(errorSentence(e)); } finally { setBusy(false); }
  }, [gameId, review]);

  const check = async () => {
    if (pick === null || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const a = await mobGameApi.fixAnswer(gameId, review.trap.q, stage === 'check' ? 'check' : 'now', pick);
      setAnswer(a);
    } catch (e) { setNotice(errorSentence(e)); } finally { setBusy(false); }
  };

  const mob = mobName || COPY.yourMob;
  const trapNumber = review?.trap ? review.trap.number ?? review.trap.q + 1 : null;
  const headTitle = trapNumber ? COPY.fixTogether(trapNumber) : COPY.fixTitle;
  if (error) {
    return (
      <section className="mp-fix">
        <RunHead title={COPY.fixTitle} sub="" hrefs={hrefs} />
        <div className="mp-card mp-card--center" role="alert">
          <h2 className="mp-h2">{error.code === 'REVIEW_NOT_YET' || error.code === 'FIX_NOT_YET' ? COPY.fixNotYet : errorSentence(error)}</h2>
          <div className="mp-keys"><Link className="mp-key" href={hrefs.den}>{COPY.backToDen}</Link></div>
        </div>
      </section>
    );
  }
  if (!review || (review.trap && !start)) {
    return (
      <section className="mp-fix" aria-busy="true">
        <RunHead title={headTitle} sub={COPY.fixSub(mob)} hrefs={hrefs} />
        <div className="mp-skel mp-skel--sheet" aria-hidden="true" />
      </section>
    );
  }
  if (!review.trap) {
    return (
      <section className="mp-fix">
        <RunHead title={COPY.fixTitle} sub={COPY.gameTitle(game)} hrefs={hrefs} />
        <div className="mp-card mp-card--center"><p className="mp-line">{COPY.fixClosedNone}</p><div className="mp-keys"><Link className="mp-key" href={hrefs.den}>{COPY.backToDen}</Link></div></div>
      </section>
    );
  }

  const tq = review.questions?.find((q) => q.q === review.trap.q) || {};
  const yourPick = start?.trap?.yourPick ?? tq.yourPick;
  const rightIndex = start?.trap?.correctIndex ?? tq.correctIndex;
  const why = start?.trap?.why || tq.explanation;
  const fix = review.trap.fix || {};
  const checkState = fix.check?.state;
  const opensAt = fix.check?.opensAt;

  if (stage !== 'sheet' && question) {
    return (
      <section className="mp-fix mp-fix--q">
        <RunHead title={headTitle} sub={COPY.fixSub(mob)} hrefs={hrefs} />
        <p className="mp-label">{stage === 'check' ? COPY.checkTitle : COPY.freshTitle}</p>
        {question.passage ? <div className="mp-passage">{question.passage}</div> : null}
        <h2 className="mp-q__stem">{question.stem}</h2>
        <div className="mp-opts" role="radiogroup" aria-label={stage === 'check' ? COPY.checkTitle : COPY.freshTitle}>
          {(question.options || []).map((text, k) => {
            const isRight = answer && answer.correctIndex === k;
            const isWrong = answer && pick === k && !answer.correct;
            return (
              <button key={k} type="button" role="radio" aria-checked={pick === k} disabled={Boolean(answer) || busy}
                className={`mp-opt${pick === k ? ' is-picked' : ''}${isRight ? ' is-right' : ''}${isWrong ? ' is-wrong' : ''}${answer && !isRight && !isWrong ? ' is-dim' : ''}`}
                onClick={() => setPick(k)} aria-label={`${COPY.optionLabel(LETTERS[k], text)}${isRight ? `, ${COPY.rightAnswer.toLowerCase()}` : ''}${isWrong ? `, ${COPY.yourPick.toLowerCase()}` : ''}`}>
                <span className="mp-opt__letter">{LETTERS[k]}</span>
                <span className="mp-opt__text">{text}</span>
                {isRight ? <svg className="mp-tick" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M4.5 12.5l5 5 10-11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" pathLength="1" /></svg> : null}
              </button>
            );
          })}
        </div>
        {notice ? <p className="mp-error" role="alert">{notice}</p> : null}
        {answer ? (
          <div className={`mp-card mp-fix__result is-${answer.correct ? 'right' : 'wrong'}`} role="status">
            <p className="mp-panel__title">{answer.correct ? COPY.fixRight : COPY.fixWrong}</p>
            {answer.explanation ? <p className="mp-line">{answer.explanation}</p> : null}
            {answer.fixedTogether ? <p className="mp-hint">{COPY.fixTogetherDone}</p> : null}
          </div>
        ) : null}
        <div className="mp-keys mp-keys--end">
          {answer ? <Link className="btn-volt md mp-key-primary" href={hrefs.den}>{COPY.backToDen}</Link> : (
            <button type="button" className="btn-volt md mp-key-primary" onClick={check} disabled={pick === null || busy} aria-busy={busy || undefined}>{pick === null ? COPY.pickAnAnswer : COPY.checkKey}</button>
          )}
          {answer ? null : <button type="button" className="mp-link" onClick={() => { setStage('sheet'); setPick(null); }}>{COPY.back}</button>}
        </div>
      </section>
    );
  }

  return (
    <section className="mp-fix">
      <RunHead title={headTitle} sub={COPY.fixSub(mob)} hrefs={hrefs} />
      <div className="mp-fix__desk">
        <span className="mp-fix__lamp" aria-hidden="true" />
        <article className="mp-sheet">
          <p className="mp-sheet__q">{COPY.question(trapNumber)}</p>
          <h2 className="mp-sheet__h">{COPY.whyLooked}</h2>
          {tq.stem ? <p className="mp-sheet__stem">{tq.stem}</p> : null}
          <ul className="mp-bubbles" aria-label={COPY.question(trapNumber)}>
            {(tq.options || ['', '', '', '']).map((text, k) => {
              const yours = yourPick === k;
              const right = rightIndex === k;
              return (
                <li key={k} className={`mp-bubble${yours ? ' is-yours' : ''}${right ? ' is-right' : ''}`} aria-label={`${COPY.bubbleLabel(LETTERS[k], yours, right)}${text ? `: ${text}` : ''}`}>
                  <span className="mp-bubble__dot">{LETTERS[k]}{yours && !right ? <svg className="mp-bubble__strike" viewBox="0 0 40 40" aria-hidden="true"><path d="M8 32L32 8" pathLength="1" /></svg> : null}</span>
                  {text ? <span className="mp-bubble__text">{text}</span> : null}
                  {yours ? <span className="mp-bubble__tag">{COPY.yourPick}</span> : right ? <span className="mp-bubble__tag is-right">{COPY.rightAnswer}</span> : null}
                </li>
              );
            })}
          </ul>
          {why ? <p className="mp-sheet__why">{why}</p> : null}
        </article>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="mp-fix__mobi" src="/brand/mascot/thinking.webp" alt="" width="96" height="108" aria-hidden="true" />
      </div>

      <ol className="mp-path">
        <li><span className="mp-path__icon" aria-hidden="true"><Send size={18} /></span><p><b>{COPY.pathNow.split('. ')[0]}.</b> {COPY.pathNow.split('. ').slice(1).join('. ')}</p></li>
        {opensAt ? <li><span className="mp-path__icon" aria-hidden="true"><CalendarDays size={18} /></span><p><b>{COPY.pathCheck(opensAt).split('. ')[0]}.</b> {COPY.pathCheck(opensAt).split('. ').slice(1).join('. ')}</p></li> : null}
      </ol>
      {opensAt && checkState === 'not_yet' ? <p className="mp-hint">{COPY.checkOpens(opensAt)}</p> : null}

      {fix.fixed ? (
        <div className="mp-card mp-shelfstrip">
          <div>
            <p className="mp-shelfstrip__count"><span className="mp-segs" aria-hidden="true">{Array.from({ length: fix.fixed.of }, (_, i) => <i key={i} className={i < fix.fixed.count ? 'is-on' : ''} />)}</span><b>{COPY.ofThree(fix.fixed.count, fix.fixed.of)}</b></p>
            <p className="mp-hint">{COPY.fixShelf}</p>
          </div>
          <span className="mp-crane" aria-hidden="true"><PlayFold fold="crane" size={72} silhouette /></span>
        </div>
      ) : null}

      {notice ? <p className="mp-error" role="alert">{notice}</p> : null}
      <div className="mp-keys mp-keys--end">
        {checkState === 'open' ? (
          <button type="button" className="btn-volt md mp-key-primary" data-page-primary="" onClick={openCheck} disabled={busy}>{COPY.takeCheck}</button>
        ) : fix.now === 'done' ? (
          <Link className="btn-volt md mp-key-primary" data-page-primary="" href={hrefs.den}>{COPY.backToDen}</Link>
        ) : (
          <button type="button" className="btn-volt md mp-key-primary" data-page-primary="" onClick={() => { setStage('now'); setPick(null); setAnswer(null); }}>{COPY.tryFresh}</button>
        )}
      </div>
    </section>
  );
}
