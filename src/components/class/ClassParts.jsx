"use client";
// The class league's parts, drawn once and used by the Sunday Mock page's block, the dialogs, the join page and the result:
// the dialog, the ruler, one subject's figure, the code with its share keys, and the code field. No state of the class lives
// here. Every number on screen is one the server sent; under the floor no number is drawn at all.
import { useEffect, useId, useRef, useState } from 'react';
import { Check, Copy, EyeOff, Share2, X } from 'lucide-react';
import {
  CLASS_COPY, CLASS_FULL_MARKS, averageLine, displayClassCode, figureHeading, marksText, normalizeClassCode, rulerAt, satClassLine,
} from '@/lib/classLeague/model.mjs';

/** A native <dialog> with showModal: focus moves in, Escape closes, focus returns to the opener, the page behind is inert. */
export function ClassDialog({ open, onClose, title, children }) {
  const ref = useRef(null);
  const labelId = useId();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const closed = () => onClose?.();
    el.addEventListener('close', closed);
    return () => el.removeEventListener('close', closed);
  }, [onClose]);
  return (
    <dialog ref={ref} className="cls-dialog" aria-labelledby={labelId} onClick={(e) => { if (e.target === ref.current) ref.current.close(); }}>
      {open ? (
        <div className="cls-dialog__body">
          <header className="cls-dialog__head">
            <h2 id={labelId} className="cls-dialog__title">{title}</h2>
            <button type="button" className="cls-x" aria-label="Close" onClick={() => ref.current?.close()}><X size={18} aria-hidden="true" /></button>
          </header>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

const TICKS = Array.from({ length: CLASS_FULL_MARKS / 25 + 1 }, (_, i) => i * 25);

/**
 * The ruler from 0 to 250: the class average's notch above it (ink), yours under it (volt). `average` null draws no class
 * notch (under the floor); `you` null draws no notch of yours. Nothing else is ever marked on it.
 */
export function ClassRuler({ average = null, you = null, reveal = false }) {
  const label = [average !== null ? averageLine(average) : null, you !== null ? `your marks ${you} / ${CLASS_FULL_MARKS}` : null].filter(Boolean).join(', ');
  const mark = (kind, value, text) => {
    const at = rulerAt(value);
    return (
      <span className={`cls-ruler__mark cls-ruler__mark--${kind}`} style={{ '--x': `${(at * 100).toFixed(2)}%`, '--at': at.toFixed(3) }}>
        <span className="cls-ruler__tag">{text}</span>
      </span>
    );
  };
  return (
    <div className="cls-ruler" role="img" aria-label={`A ruler from 0 to ${CLASS_FULL_MARKS} marks: ${label}`} data-reveal={reveal ? '' : undefined}>
      <span className="cls-ruler__end" aria-hidden="true">0</span>
      <span className="cls-ruler__track" aria-hidden="true">
        <span className="cls-ruler__bar">
          {TICKS.slice(1, -1).map((t) => <span key={t} className="cls-ruler__tick" data-major={t % 50 === 0 ? '' : undefined} style={{ left: `${(t / CLASS_FULL_MARKS) * 100}%` }} />)}
        </span>
        {average !== null ? mark('class', average, `Class ${average}`) : null}
        {you !== null ? mark('you', you, `You ${you}`) : null}
      </span>
      <span className="cls-ruler__end" aria-hidden="true">{CLASS_FULL_MARKS}</span>
    </div>
  );
}

/** One subject's figure for a closed Sunday: the two numbers, the ruler and how many sat; under the floor, the floor's line. */
export function ClassFigure({ figure, week, reveal = false }) {
  const you = figure.you ? figure.you.scored : null;
  return (
    <div className="cls-row">
      <p className="cls-fig__head"><b>{figure.name}</b><span>{figureHeading(week)}</span></p>
      {figure.enough ? (
        <>
          <div className="cls-nums">
            <p className="cls-num">
              <span className="cls-num__v">{figure.average}<small>/ {CLASS_FULL_MARKS}</small></span>
              <span className="cls-num__k"><i aria-hidden="true" />Class average</span>
            </p>
            {figure.you ? (
              <p className="cls-num cls-num--you">
                <span className="cls-num__v">{figure.you.scored}<small>/ {figure.you.max}</small></span>
                <span className="cls-num__k"><i aria-hidden="true" />You</span>
              </p>
            ) : (
              <p className="cls-num cls-num--you cls-num--quiet">
                <span className="cls-num__v">Not sat</span>
                <span className="cls-num__k"><i aria-hidden="true" />You</span>
              </p>
            )}
          </div>
          <ClassRuler average={figure.average} you={you} reveal={reveal} />
          <p className="cls-sat">{satClassLine(figure.sat)}<span>. Never who, never a rank.</span></p>
        </>
      ) : (
        <>
          <p className="cls-floor"><EyeOff size={18} aria-hidden="true" /><span>{CLASS_COPY.floorLine}</span></p>
          <p className="cls-small">{figure.you ? `You: ${marksText(figure.you)}.` : 'You did not sit it.'}</p>
        </>
      )}
    </div>
  );
}

const shareText = (name, code) => `Join our class "${name}" on MockMob. Every Sunday we sit the free Sunday Mock, and on Monday we see the class average. No names, no ranks. Code ${displayClassCode(code)}:`;

/** The code, large, with Share (WhatsApp or the phone's share sheet) and Copy link. `volt` makes Share the view's volt key. */
export function ShareKeys({ name, code, url, volt = false }) {
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState('');
  const copy = async () => {
    setNote('');
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { setNote('Copy did not work here. Hold the code to select it.'); }
  };
  const share = async () => {
    setNote('');
    const text = shareText(name, code);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try { await navigator.share({ title: name, text, url }); return; } catch (e) { if (e?.name === 'AbortError') return; }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener,noreferrer');
  };
  return (
    <div className="cls-row">
      <p className="cls-code"><span className="cls-code__v">{displayClassCode(code)}</span><span className="cls-code__k">Your class code</span></p>
      <p className="cls-note">Send it to your class group. Anyone with it can join, and nobody in the class sees who did.</p>
      <div className="cls-keys">
        <button type="button" className={volt ? 'cls-key cls-key--volt' : 'cls-key'} onClick={share}><Share2 size={16} aria-hidden="true" />{CLASS_COPY.shareKey}</button>
        <button type="button" className="cls-key" onClick={copy}>{copied ? <><Check size={16} aria-hidden="true" />{CLASS_COPY.copied}</> : <><Copy size={16} aria-hidden="true" />{CLASS_COPY.copyKey}</>}</button>
      </div>
      <p className="cls-msg" role="status" aria-live="polite">{note}</p>
    </div>
  );
}

/** The code field and its key. Checks the shape here; the server says whether a class has it. */
export function CodeForm({ onJoin, busy = false, error = '', volt = false }) {
  const id = useId();
  const [value, setValue] = useState('');
  const [bad, setBad] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const code = normalizeClassCode(value);
    if (!code) { setBad('A class code is 6 letters and numbers, like K7P 2M9.'); return; }
    setBad('');
    onJoin(code);
  };
  const message = bad || error;
  return (
    <form className="cls-field" onSubmit={submit} noValidate>
      <label className="cls-label" htmlFor={id}>{CLASS_COPY.joinLabel}</label>
      <div className="cls-codeform">
        <input id={id} className="cls-input cls-input--code" value={value} onChange={(e) => { setValue(e.target.value); setBad(''); }} maxLength={12}
          placeholder="Type the code" autoCapitalize="characters" autoComplete="off" spellCheck={false} inputMode="text"
          aria-invalid={message ? true : undefined} aria-describedby={`${id}-hint ${id}-msg`} />
        <button type="submit" className={volt ? 'cls-key cls-key--volt' : 'cls-key'} disabled={busy} aria-busy={busy || undefined}>{busy ? CLASS_COPY.joining : CLASS_COPY.join}</button>
      </div>
      <p id={`${id}-hint`} className="cls-small">{CLASS_COPY.joinHint}</p>
      <p id={`${id}-msg`} className="cls-msg" role="status" aria-live="polite">{message}</p>
    </form>
  );
}
