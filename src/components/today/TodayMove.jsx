"use client";
// Up next: the one move on Today (TODAY-1017 4.2). One card: what to do now (the subject, a big number with its
// meaning), why from the student's own record in one sentence, one volt key with the length inside it, and two
// pressable pills under it (Change length, Something else). Every other way into practice is in Something else.
// The key is the viewport's one volt (data-page-primary steps the shell's Start key back to an outline).
import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Clock3, Shuffle, FileText, Play, RotateCcw } from 'lucide-react';
import { SubjectObject } from '@/components/brand/SubjectObject';
import MobiReact from '@/components/brand/MobiReact';
import { useCountUpState } from '@/lib/motion/useCountUp';
import { fitMove, keepTogether } from '@/lib/today/move.mjs';
import TodaySheet from './TodaySheet';

const subscribeOnline = (cb) => { window.addEventListener('online', cb); window.addEventListener('offline', cb); return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb); }; };
const onlineNow = () => navigator.onLine !== false;

function BigNumber({ value }) {
  const { value: rolled, ink } = useCountUpState(value, { memoryKey: 'today-move-number' });
  return <span className="tm__num" data-ink={ink || undefined}><span aria-hidden="true">{rolled}</span><span className="sr-only">{value}</span></span>;
}

function Art({ move, failed }) {
  if (failed) return <span className="tm__art tm__art--mobi" aria-hidden="true"><MobiReact act="oops" size={104} /></span>;
  if (!move) return null;
  if (move.art === 'mobi') return <span className="tm__art tm__art--mobi" aria-hidden="true"><MobiReact act={move.mobiAct || 'hello'} size={104} /></span>;
  if (!move.subject) return null;
  return <span className="tm__art" aria-hidden="true"><SubjectObject id={move.subject} size={136} lit life={false} framed={false} /></span>;
}

const LENGTHS = [10, 20, 30];

function lengthLine(move, n) {
  const fitted = fitMove(move, n);
  if (!fitted || fitted === move && !['practice', 'dayOne'].includes(move.id)) return `${n} minutes`;
  return `${fitted.number} ${fitted.label}${fitted.review ? `, then ${fitted.review} minutes on what you missed` : ''}`;
}

function ChangeLength({ open, onClose, move, chosen, onChoose, saving }) {
  const current = chosen || move?.key?.minutes || 10;
  return (
    <TodaySheet open={open} onClose={onClose} id="tm-length" title="How long do you have?" lede="The move keeps its aim. The length sets how much of it fits.">
      <div className="tsh__options" role="radiogroup" aria-label="Length">
        {LENGTHS.map((n) => (
          <button key={n} type="button" role="radio" aria-checked={current === n} className="tsh__option" disabled={saving === 'saving'} onClick={() => onChoose(n)}>
            <b>{n} min</b>
            <span>{lengthLine(move, n)}</span>
          </button>
        ))}
      </div>
      <p className="tsh__status" role="status">{saving === 'saving' ? 'Saving…' : saving === 'saved' ? 'Saved.' : saving === 'local' ? 'Kept on this device for today.' : saving === 'failed' ? `Your time was not saved, so it stays at ${current} minutes.` : ''}</p>
    </TodaySheet>
  );
}

function SomethingElse({ open, onClose, items }) {
  return (
    <TodaySheet open={open} onClose={onClose} id="tm-else" title="Something else" lede="Each one, and why it might be the move tonight.">
      <ul className="tsh__list">
        {items.map((a) => (
          <li key={a.id}>
            <Link className="tsh__row" href={a.href} onClick={onClose}>
              <b>{a.title}</b>
              <span>{a.reason}</span>
            </Link>
          </li>
        ))}
      </ul>
    </TodaySheet>
  );
}

/**
 * `phase`: 'loading' | 'failed' | 'ready'. `move` from buildMove (fitted to the chosen length by the page).
 * `slow`: the read has taken over 8 s. `triedAt`: the time a retry also failed (a 12-hour clock string).
 */
export default function TodayMove({ phase, move, word = 'Tonight’s move', slow = false, triedAt = '', cause = '', onRetry, alternatives = [], chosen = null, onChoose, saving = '' }) {
  const online = useSyncExternalStore(subscribeOnline, onlineNow, () => true);
  const [sheet, setSheet] = useState(null);

  if (phase === 'loading') {
    return (
      <section className="tm tm--wait" aria-busy="true" aria-label={`Loading ${word.toLowerCase()}`}>
        <span className="tm__sk tm__sk--a" /><span className="tm__sk tm__sk--b" /><span className="tm__sk tm__sk--c" /><span className="tm__sk tm__sk--key" />
        {slow ? (
          <p className="tm__slow" role="status">Still loading. Your connection looks slow. <button type="button" className="tm__inline" onClick={onRetry}>Try again</button></p>
        ) : null}
      </section>
    );
  }

  if (phase === 'failed') {
    return (
      <section className="tm tm--failed" aria-labelledby="tm-title">
        <div className="tm__top">
          <div className="tm__head"><h2 id="tm-title" className="tm__subject">{word} did not load</h2></div>
          <Art failed />
        </div>
        <p className="tm__why">{cause || 'MockMob did not answer, so ' + word.toLowerCase() + ' could not be worked out.'} Your papers and mistakes are safe; Review still opens them.</p>
        {triedAt ? <p className="tm__caption" role="status">Tried again at {triedAt}. Still not loading.</p> : null}
        <button type="button" className="tm__key" data-page-primary onClick={onRetry}><RotateCcw size={18} strokeWidth={2} aria-hidden="true" />Try again</button>
        <div className="tm__pills"><Link className="tm__pill" href="/dashboard"><Play size={17} strokeWidth={1.75} aria-hidden="true" />Practise anyway</Link></div>
      </section>
    );
  }

  const m = move;
  const offline = !online;
  // Change length shows only when a length changes the move (a Revise of 4, or a timed mock, is the same at every length).
  const lengthMatters = new Set(LENGTHS.map((n) => { const f = fitMove(m.base || m, n); return `${f?.number}|${f?.key?.minutes}`; })).size > 1;
  const heading = m.number != null ? `${m.overline}: ${m.subjectName ? `${m.subjectName}, ` : ''}${m.number} ${m.label}` : `${m.overline}: ${m.title}`;
  return (
    <section className="tm" data-move={m.id} aria-labelledby="tm-title">
      <h2 id="tm-title" className="sr-only">{heading}</h2>
      <div className="tm__top">
        <div className="tm__head" aria-hidden="true">
          <p className="tm__over">{m.overline}</p>
          <p className="tm__subject">{m.subjectName || m.title || ''}</p>
        </div>
        <Art move={m} />
      </div>
      {m.number != null ? (
        <p className="tm__figure" aria-hidden="true"><BigNumber value={m.number} /><span className="tm__label">{m.label}</span></p>
      ) : null}
      <p className="tm__why">{keepTogether(m.why)}{m.link ? <> <Link className="tm__inline" href={m.link.href}>{m.link.label}</Link></> : null}</p>
      {offline ? <p className="tm__caption" role="status">Needs a connection to start.</p> : null}
      {offline ? (
        <span className="tm__key" aria-disabled="true" role="link">{m.key.label}{m.key.minutes ? <span className="tm__key-len">{m.key.minutes} min</span> : null}</span>
      ) : (
        <Link className="tm__key" data-page-primary href={m.key.href}>{m.key.label}{m.key.minutes ? <span className="tm__key-len">{m.key.minutes} min</span> : null}</Link>
      )}
      <div className="tm__pills">
        {m.pills.length && lengthMatters ? (
          <button type="button" className="tm__pill" aria-haspopup="dialog" onClick={() => setSheet('length')}><Clock3 size={17} strokeWidth={1.75} aria-hidden="true" />Change length</button>
        ) : null}
        {m.pills.second === 'mock' ? (
          <Link className="tm__pill" href={m.mockHref || '/dashboard?mode=full'}><FileText size={17} strokeWidth={1.75} aria-hidden="true" />Full mock instead</Link>
        ) : m.pills.second === 'open' ? (
          <Link className="tm__pill" href={m.pills.openHref}><FileText size={17} strokeWidth={1.75} aria-hidden="true" />Open the session</Link>
        ) : null}
        {m.pills.second !== 'mock' ? (
          <button type="button" className="tm__pill" aria-haspopup="dialog" onClick={() => setSheet('else')}><Shuffle size={17} strokeWidth={1.75} aria-hidden="true" />Something else</button>
        ) : null}
      </div>
      <ChangeLength open={sheet === 'length'} onClose={() => setSheet(null)} move={m.base || m} chosen={chosen} onChoose={onChoose} saving={saving} />
      <SomethingElse open={sheet === 'else'} onClose={() => setSheet(null)} items={alternatives} />
    </section>
  );
}
