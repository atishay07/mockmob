"use client";
import { useRef, useState } from 'react';
import { Volume2, X, Lightbulb } from 'lucide-react';
import MobiReact from '@/components/brand/MobiReact';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import { useMobiGate } from '@/lib/mobiHooks';
import { reactNow } from '@/lib/mobiRation.js';
import { FEEL, checkDelayMs, mobiShownFor, nudgeLine, pickedIndex, reactionAct, resultKind, ringDelayMs, rightIndex } from './studyFeel';

// Device text-to-speech only. Voices differ by phone; the label says so.
export function usePronounce() {
  const [notice, setNotice] = useState('');
  const speech = useRef(null);
  const speak = word => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) { setNotice('Audio isn’t available on this device. The word and its meaning are still here.'); return; }
    speech.current = window.speechSynthesis; speech.current.cancel();
    const utterance = new SpeechSynthesisUtterance(word); utterance.lang = 'en-IN'; utterance.rate = 0.85;
    utterance.onerror = () => setNotice('Audio could not play. Try again, or continue without it.');
    speech.current.speak(utterance); setNotice('Playing your device’s voice. Voices vary by phone.');
  };
  return { speak, notice, cancel: () => speech.current?.cancel() };
}
export function HearButton({ word, speak }) {
  return <button type="button" className="sx-hear" onClick={() => speak(word)} aria-label={`Hear “${word}” (device voice)`}><Volume2 size={18} aria-hidden="true" /><span>Hear it</span></button>;
}

const Paragraphs = ({ text }) => text ? String(text).split(/\n\n+/).map((p, i) => <p key={i} className="sx-prose">{p}</p>) : null;
function Table({ rows, caption }) {
  if (!rows?.length) return null;
  const [head, ...body] = rows;
  // Wide tables stack into labelled rows on phones, so no column hides behind a sideways scroll.
  const stack = head.length >= 3;
  return <div className={`sx-table${stack ? ' sx-table--stack' : ''}`} role="region" aria-label={caption} tabIndex={0}><table><caption className="sr-only">{caption}</caption><thead><tr>{head.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
    <tbody>{body.map((row, r) => <tr key={r}>{row.map((cell, c) => c === 0 ? <th key={c} scope="row">{cell}</th> : <td key={c} data-label={head[c]}>{cell}</td>)}</tr>)}</tbody></table></div>;
}
function Highlight({ text, words }) {
  if (!words?.length || !text) return text;
  const pattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const parts = String(text).split(new RegExp(`\\b(${pattern})\\b`, 'i'));
  return parts.map((part, i) => i % 2 ? <mark key={i}>{part}</mark> : part);
}
export function Passage({ passage }) {
  return <figure className="sx-passage"><figcaption>{passage.label}</figcaption><ol>{passage.sentences.map((s, i) => <li key={i}><span className="sx-passage__n" aria-hidden="true">{i + 1}</span><span>{s}{passage.highlight?.[i] ? <em className="sx-passage__tag">{passage.highlight[i]}</em> : null}</span></li>)}</ol></figure>;
}

export function ReadingBlock({ block, speak }) {
  return <div className={`sx-block sx-block--${block.kind}`}>
    {block.kind === 'mistake' ? <p className="sx-callout-head"><X size={16} aria-hidden="true" />Avoid this</p> : null}
    <Paragraphs text={block.kind === 'worked_example' && block.passage ? null : block.body} />
    {block.formula ? <p className="sx-formula">{block.formula.split(' · ').map((f, i) => <span key={i}>{f}</span>)}</p> : null}
    {block.passage ? <Passage passage={block.passage} /> : null}
    {block.kind === 'worked_example' && block.passage ? <Paragraphs text={block.body} /> : null}
    {block.steps ? <ol className="sx-steps">{block.steps.map((s, i) => <li key={i}>{s}</li>)}</ol> : null}
    {block.flow ? <ol className="sx-concept-map" aria-label={block.title}>{block.flow.map(s=><li key={s.label}><b>{s.label}</b><span>{s.detail}</span></li>)}</ol> : null}
    <Table rows={block.rows} caption={block.title} />
    {block.words ? <ul className="sx-words">{block.words.map(w => <li key={w.word}>
      <div className="sx-words__head"><b lang="en">{w.word}</b>{w.spellings?.length ? <small>also {w.spellings.join(', ')}</small> : null}{speak ? <HearButton word={w.word} speak={speak} /> : null}</div>
      <p>{w.meaning}</p>
      {w.example ? <p className="sx-words__example">“<Highlight text={w.example} words={[w.word, ...(w.spellings || [])]} />”</p> : null}
      {(w.synonym || w.opposite) ? <p className="sx-words__rel">{w.synonym ? <span>Similar: <b>{w.synonym}</b></span> : null}{w.opposite ? <span>Opposite: <b>{w.opposite}</b></span> : null}</p> : null}
    </li>)}</ul> : null}
    {block.note ? <p className="sx-note"><Lightbulb size={16} aria-hidden="true" /><span>{block.note}</span></p> : null}
  </div>;
}

// The question body for any checked item: context, prompt, and the answer control.
export function AnswerForm({ item, busy, locked, onSubmit, onSkip, assistedToggle = false }) {
  const [selected, setSelected] = useState(null), [value, setValue] = useState(''), [assisted, setAssisted] = useState(false);
  const ready = item.type === 'choice' ? selected !== null : value.trim().length > 0;
  return <form className="sx-answer" onSubmit={e => { e.preventDefault(); if (ready) onSubmit(item.type === 'choice' ? selected : value, assisted); }}>
    {item.type === 'choice' ? <fieldset className="sx-options" disabled={busy || locked}><legend className="sr-only">{item.prompt}</legend>
      {item.options.map((option, i) => <label key={i} className="sx-option"><input type="radio" name={`answer-${item.id}`} value={i} checked={selected === i} onChange={() => setSelected(i)} /><span className="sx-option__key" aria-hidden="true">{String.fromCharCode(65 + i)}</span><span>{option}</span></label>)}
    </fieldset> : <label className="sx-field"><span>{item.inputHint || 'Your answer'}</span>
      <input type="text" inputMode={item.type === 'numeric' ? 'decimal' : 'text'} value={value} onChange={e => setValue(e.target.value)} maxLength={200} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={busy || locked} enterKeyHint="done" />
    </label>}
    {item.hint ? <p className="sx-hint">{item.hint}</p> : null}
    {assistedToggle ? <div className="sx-retrieval"><p className="sx-small">How are you answering?</p><div role="group" aria-label="Recall assistance"><button type="button" aria-pressed={!assisted} disabled={busy || locked} onClick={()=>setAssisted(false)}>From memory</button><button type="button" aria-pressed={assisted} disabled={busy || locked} onClick={()=>setAssisted(true)}>I used help</button></div></div> : null}
    <div className="sx-actions">
      <button className="btn-volt md" type="submit" disabled={busy || locked || !ready}>Check answer</button>
      <button className="sx-quiet" type="button" disabled={busy || locked} onClick={() => onSkip(item.type === 'choice' ? -1 : '', assisted)}>I don’t know</button>
    </div>
    {item.type === 'numeric' ? <p className="sx-hint">Fractions like 3/20 and whole numbers both work.</p> : item.type === 'ratio' ? <p className="sx-hint">Write it with a colon, like 2:1. Any equivalent ratio is accepted.</p> : null}
  </form>;
}

// A check that draws itself in (the path needs pathLength="1"); without `fresh` it is simply there.
// The points are the app's MmPaths.check, in a 24 box.
function InkCheck({ fresh, delay, className = '' }) {
  return <span className={`sx-mark ${className}`.trim()} data-fresh={fresh || undefined} style={fresh ? { '--sx-check-delay': `${delay}ms` } : undefined} aria-hidden="true">
    <svg viewBox="0 0 24 24" focusable="false"><path pathLength="1" d="M5.3 12.7 10.1 17.3 18.7 7.7" /></svg>
  </span>;
}

/**
 * The options once the answer is known: the right row carries an ink outline that draws itself in
 * and a drawn check, a wrong pick carries a cross, "Your answer" and the wrong colours (never colour
 * alone). With `fresh` (answered here, just now) a miss nudges its row once, then the right row
 * inks; a right answer inks at once. Without it (a step reopened from a saved state) everything is
 * simply there. Reduced motion shows the finished marks (the end state is the base style).
 */
export function ResultOptions({ item, feedback, fresh = false }) {
  const right = rightIndex(item), picked = pickedIndex(item, feedback);
  const missed = picked !== null && picked !== right;
  const ringDelay = ringDelayMs(missed), checkDelay = checkDelayMs(missed);
  return <ul className="sx-results" aria-label="Answer options">
    {item.options.map((option, i) => {
      const isRight = i === right, isMiss = i === picked && !isRight;
      const words = isRight ? (i === picked ? 'Your answer' : 'Correct answer') : isMiss ? 'Your answer' : null;
      return <li key={i} className={`sx-result${isRight ? ' is-right' : ''}${isMiss ? ' is-miss' : ''}`} data-fresh={fresh || undefined}
        style={fresh && isRight ? { '--sx-ring-delay': `${ringDelay}ms` } : undefined}>
        <span className="sx-option__key" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
        <span className="sx-result__text"><span>{option}</span>{words ? <small>{words}</small> : null}</span>
        {isRight ? <><InkCheck fresh={fresh} delay={checkDelay} />
          <svg className="sx-inkring" aria-hidden="true" focusable="false"><rect x="1" y="1" width="99%" height="98%" rx="11" ry="11" pathLength="1" /></svg></> : null}
        {isMiss ? <span className="sx-mark sx-mark--miss" aria-hidden="true"><X size={18} /></span> : null}
      </li>;
    })}
  </ul>;
}

// Mobi beside the words of a result the student just produced: one small `correct` hop or one
// `encourage` lean (the app's FeedbackMobi). He says nothing himself. At most once every 2.5 s, and
// only under Celebrations Full: Quiet and Off keep the words alone. Mounted only for a fresh result,
// because asking the gate consumes it.
function FeedbackMobi({ act }) {
  const allowed = useMobiGate(() => reactNow(FEEL.mobi.gate, FEEL.mobi.gapMs), false);
  const { celebrations } = useMobiPrefs();
  if (!allowed || !mobiShownFor(celebrations)) return null;
  return <span className="sx-feedback__mobi"><MobiReact act={act} size={FEEL.mobi.slot} /></span>;
}

/**
 * What the server said about an answer. `fresh`: answered here just now (the check draws, the panel
 * rises, Mobi stands beside the words, a typed miss nudges the panel once). `compact`: the option
 * rows above already show what was chosen and what was right, so only the reason is added.
 * A miss or a skip carries one short line under its headline, whether Mobi is shown or not.
 */
export function Feedback({ feedback, fresh = false, compact = false }) {
  const correct = feedback?.correct;
  const kind = resultKind(feedback), line = nudgeLine(feedback), act = reactionAct(kind);
  return <div className={`sx-feedback ${correct === true ? 'is-right' : correct === false ? 'is-wrong' : ''}${fresh ? ' mk-rise' : ''}`} role="status" aria-live="polite"
    data-fresh={fresh || undefined} data-nudge={fresh && kind === 'miss' && !compact ? 'true' : undefined}>
    <div className="sx-feedback__top">
      <div className="sx-feedback__lead">
        <p className="sx-feedback__head">{correct === true ? <><InkCheck fresh={fresh} delay={FEEL.ink.panelCheckMs} className="sx-mark--head" />Correct</> : correct === false ? <><X size={18} aria-hidden="true" />{feedback.skipped ? 'Here’s the answer' : 'Not quite'}</> : 'The answer'}</p>
        {line ? <p className="sx-feedback__nudge">{line}</p> : null}
      </div>
      {fresh && act ? <FeedbackMobi act={act} /> : null}
    </div>
    {correct === false && feedback.chosen && !compact ? <p className="sx-feedback__chosen">You chose <b>{feedback.chosen}</b>.{feedback.whyChosen ? ` ${feedback.whyChosen}` : ''}</p> : null}
    {correct === false && feedback.chosen && compact && feedback.whyChosen ? <p className="sx-feedback__chosen">{feedback.whyChosen}</p> : null}
    {correct === false && feedback.given ? <p className="sx-feedback__chosen">You wrote <b>{feedback.given}</b>.</p> : null}
    {correct !== true && !compact ? <p className="sx-feedback__answer">Answer: <b>{feedback?.answer}</b></p> : null}
    {feedback?.explanation ? <p className="sx-prose">{feedback.explanation}</p> : null}
    {feedback?.cue ? <p className="sx-note"><Lightbulb size={16} aria-hidden="true" /><span>{feedback.cue}</span></p> : null}
  </div>;
}
