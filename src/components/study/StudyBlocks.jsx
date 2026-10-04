"use client";
import { useRef, useState } from 'react';
import { Volume2, Check, X, Lightbulb } from 'lucide-react';

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
  return <div className="sx-table" role="region" aria-label={caption} tabIndex={0}><table><caption className="sr-only">{caption}</caption><thead><tr>{head.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
    <tbody>{body.map((row, r) => <tr key={r}>{row.map((cell, c) => c === 0 ? <th key={c} scope="row">{cell}</th> : <td key={c}>{cell}</td>)}</tr>)}</tbody></table></div>;
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
    {assistedToggle ? <label className="sx-check"><input type="checkbox" checked={assisted} onChange={e => setAssisted(e.target.checked)} disabled={busy || locked} />I looked it up or got help</label> : null}
    <div className="sx-actions">
      <button className="btn-volt md" type="submit" disabled={busy || locked || !ready}>Check answer</button>
      <button className="sx-quiet" type="button" disabled={busy || locked} onClick={() => onSkip(item.type === 'choice' ? -1 : '', assisted)}>I don’t know</button>
    </div>
    {item.type === 'numeric' ? <p className="sx-hint">Fractions like 3/20 and whole numbers both work.</p> : item.type === 'ratio' ? <p className="sx-hint">Write it with a colon, like 2:1. Any equivalent ratio is accepted.</p> : null}
  </form>;
}

export function Feedback({ feedback, item }) {
  const correct = feedback?.correct;
  return <div className={`sx-feedback ${correct === true ? 'is-right' : correct === false ? 'is-wrong' : ''}`} role="status" aria-live="polite">
    <p className="sx-feedback__head">{correct === true ? <><Check size={18} aria-hidden="true" />Correct</> : correct === false ? <><X size={18} aria-hidden="true" />{feedback.skipped ? 'Here’s the answer' : 'Not quite'}</> : 'The answer'}</p>
    {correct === false && feedback.chosen ? <p className="sx-feedback__chosen">You chose <b>{feedback.chosen}</b>.{feedback.whyChosen ? ` ${feedback.whyChosen}` : ''}</p> : null}
    {correct === false && feedback.given ? <p className="sx-feedback__chosen">You wrote <b>{feedback.given}</b>.</p> : null}
    {correct !== true ? <p className="sx-feedback__answer">Answer: <b>{feedback?.answer}</b></p> : null}
    {feedback?.explanation ? <p className="sx-prose">{feedback.explanation}</p> : null}
    {feedback?.cue ? <p className="sx-note"><Lightbulb size={16} aria-hidden="true" /><span>{feedback.cue}</span></p> : null}
  </div>;
}
