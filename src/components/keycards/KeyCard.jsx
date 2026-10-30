"use client";
// The card itself, shared by Read, Study, Last look, Revise and "The line you needed" (KEYCARDS-BUILD-SPEC.md section 3).
//   CardHead     the kind label ("Definition"), "Must-know" when it is, "Asked in 2 past papers" when certain, and a small
//                overflow menu with "Report this card"
//   Prompt       the front; blanks drawn as short ruled gaps, never as underscores
//   NcertText    the back: NCERT's exact words in the reading face, the blanked words marked by weight and a fine rule
//   CardSource   "Business Studies Part 1, chapter 1, page 3"
//   InShort      the optional paraphrase, labelled, in the app's own face so it never passes for the book
//   KeyCardPlayer   one card to recall: front first, Show answer (space or tap), then Missed / Got it / Easy (1, 2, 3).
//                   The rating counts only once the server has it; until then the key shows it is saving.
//   ProGate      the one quiet Pro line with "See Pro" (opens the Upgrade sheet with the keycards reason)
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { LoaderCircle, MoreHorizontal } from 'lucide-react';
import { openUpgrade } from '@/components/pro/proNudgeStore';
import { BLANK_KINDS, LIST_KINDS, PRO_LINE, RATINGS, backLines, kindLabel, markBlanks, plural, sourceLine, splitBlanks } from './kinds';
import { isProRequired, sendReport, sendReview } from './api';

const typing = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

export function Prompt({ card, as: Tag = 'p', className = 'kc-prompt', id }) {
  const parts = splitBlanks(card?.front);
  return (
    <Tag className={className} id={id}>
      {parts.map((p, i) => (p.blank
        ? <span key={i} className="kc-gap" role="img" aria-label={`blank ${p.n}`} />
        : <span key={i}>{p.text}</span>))}
    </Tag>
  );
}

export function NcertText({ card, className = '' }) {
  const lines = LIST_KINDS.includes(card?.kind) ? backLines(card.back) : [];
  const cls = `kc-ncert ${className}`.trim();
  if (lines.length > 1) {
    const Tag = card.kind === 'steps' ? 'ol' : 'ul';
    return <Tag className={`${cls} kc-ncert--list`}>{lines.map((l, i) => <li key={i}>{l}</li>)}</Tag>;
  }
  if (card?.kind === 'formula') {
    const [first, ...rest] = backLines(card.back);
    return (
      <div className={`${cls} kc-ncert--formula`}>
        <p className="kc-formula">{first}</p>
        {rest.map((l, i) => <p key={i}>{l}</p>)}
      </div>
    );
  }
  const marked = BLANK_KINDS.includes(card?.kind) ? markBlanks(card.back, card.blanks) : [{ text: card?.back || '' }];
  return <p className={cls}>{marked.map((p, i) => (p.mark ? <mark key={i} className="kc-mark">{p.mark}</mark> : <span key={i}>{p.text}</span>))}</p>;
}

export function CardSource({ card }) {
  const line = sourceLine(card?.source);
  return line ? <p className="kc-source">{line}</p> : null;
}

export function InShort({ card }) {
  if (!card?.note) return null;
  return <p className="kc-short"><b>In short</b> {card.note}</p>;
}

/** The small "..." menu on a card: "Report this card", and any extra item the screen gives (Pro: add one card to Revise). */
function CardMenu({ onReport, label, items = [] }) {
  const [open, setOpen] = useState(false);
  const btn = useRef(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (e.type === 'keydown' && e.key !== 'Escape') return; if (e.type === 'pointerdown' && btn.current?.parentElement?.contains(e.target)) return; setOpen(false); if (e.type === 'keydown') btn.current?.focus(); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  return (
    <span className="kc-menu">
      <button ref={btn} type="button" className="kc-menu__btn" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} aria-label={`More for ${label}`} onClick={() => setOpen((o) => !o)}>
        <MoreHorizontal size={18} strokeWidth={2} aria-hidden="true" />
      </button>
      {open ? (
        <span className="kc-menu__list" role="menu" id={menuId}>
          {items.map((item) => (
            <button key={item.label} type="button" role="menuitem" className="kc-menu__item" onClick={() => { setOpen(false); item.onSelect(); }}>{item.label}</button>
          ))}
          <button type="button" role="menuitem" className="kc-menu__item" autoFocus={!items.length} onClick={() => { setOpen(false); onReport(); }}>Report this card</button>
        </span>
      ) : null}
    </span>
  );
}

/** "What looks wrong?" under a card. Sent once; says so only after the server has it. */
export function ReportForm({ card, onClose }) {
  const [reason, setReason] = useState('');
  const [state, setState] = useState('idle');
  const id = useId();
  const field = useRef(null);
  useEffect(() => { field.current?.focus(); }, []);
  async function send(e) {
    e.preventDefault();
    if (!reason.trim() || state === 'sending') return;
    setState('sending');
    try { await sendReport({ cardId: card.id, reason: reason.trim() }); setState('sent'); } catch { setState('failed'); }
  }
  if (state === 'sent') return <p className="kc-report kc-report--sent" role="status">Reported. Thank you. This card is checked against the book again.</p>;
  return (
    <form className="kc-report" onSubmit={send}>
      <label htmlFor={id}>What looks wrong with this card?</label>
      <textarea id={id} ref={field} maxLength={300} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: a word differs from the book, or the page is wrong" />
      <div className="kc-report__row">
        <button type="submit" className="kc-btn kc-btn--line" disabled={!reason.trim() || state === 'sending'}>{state === 'sending' ? 'Sending' : 'Send report'}</button>
        <button type="button" className="kc-btn kc-btn--quiet" onClick={onClose}>Cancel</button>
        <span className="kc-report__count" aria-hidden="true">{reason.length} / 300</span>
      </div>
      {state === 'failed' ? <p className="kc-err" role="alert">The report was not sent. Your words are still here. Try again.</p> : null}
    </form>
  );
}

export function CardHead({ card, onReport, menu = [], children = null }) {
  const label = kindLabel(card);
  return (
    <div className="kc-head">
      <span className="kc-head__tags">
        <span className="kc-kind">{label}</span>
        {card.importance === 'must' ? <span className="kc-tag">Must-know</span> : null}
        {card.asked > 0 ? <span className="kc-asked">Asked in {plural(card.asked, 'past paper')}</span> : null}
      </span>
      {children}
      {onReport ? <CardMenu onReport={onReport} items={menu} label={`${label}: ${card.front}`} /> : null}
    </div>
  );
}

/** The one Pro line on a screen (spec: factual, once per screen, never a modal on entry). Pro never sees it. */
export function ProGate({ isPro, lead = null, className = '' }) {
  if (isPro) return null;
  return (
    <div className={`kc-gate ${className}`.trim()} role="note">
      <p>{lead ? <b>{lead} </b> : null}{PRO_LINE}</p>
      <button type="button" className="kc-btn kc-btn--line" onClick={(e) => openUpgrade({ trigger: 'keycards', opener: e.currentTarget })}>See Pro</button>
    </div>
  );
}

/**
 * One card to recall. `onRated({ rating, result })` runs after the server acknowledged the rating; `onLimit()` when Free has
 * used the day's reviews (402). `mode` is the review mode the server records ('study' | 'revise'). `active` binds the keys.
 */
export function KeyCardPlayer({ card, mode, position = null, active = true, detail = null, onRated, onLimit }) {
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [reporting, setReporting] = useState(false);
  const showRef = useRef(null);
  const firstRate = useRef(null);
  const rateRow = useRef(null);
  const headId = useId();

  const reveal = useCallback(() => setRevealed(true), []);
  const rate = useCallback(async (rating) => {
    if (busy || !revealed) return;
    setBusy(rating);
    setError(null);
    try {
      const result = await sendReview({ cardId: card.id, rating, mode });
      if (!result?.ok) throw new Error('unconfirmed');
      onRated?.({ rating, result });
    } catch (e) {
      if (isProRequired(e)) { onLimit?.(); return; }
      setError('That rating was not saved. Try again.');
      setBusy(null);
    }
  }, [busy, revealed, card.id, mode, onRated, onLimit]);

  // The rating keys take focus and come into view (a long answer on a phone can push them under the dock).
  useEffect(() => {
    if (!revealed) return;
    firstRate.current?.focus({ preventScroll: true });
    let still = false;
    try { still = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* moves smoothly */ }
    rateRow.current?.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' });
  }, [revealed]);
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || reporting) return;
      if ((e.key === ' ' || e.key === 'Enter') && !revealed) {
        if (e.target?.tagName === 'BUTTON' && e.target !== showRef.current) return;
        e.preventDefault();
        reveal();
        return;
      }
      const r = RATINGS.find((x) => x.key === e.key);
      if (r && revealed) { e.preventDefault(); rate(r.rating); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, revealed, reveal, rate, reporting]);

  return (
    <section className="kc-play" aria-labelledby={headId} data-revealed={revealed || undefined}>
      {position ? <p className="kc-pos">{position}</p> : null}
      <div className="kc-play__card">
        <CardHead card={card} onReport={() => setReporting(true)} />
        {detail ? <p className="kc-detail">{detail}</p> : null}
        <Prompt card={card} as="h2" className="kc-play__prompt" id={headId} />
        {revealed ? (
          <div className="kc-play__answer">
            <NcertText card={card} />
            <CardSource card={card} />
            <InShort card={card} />
          </div>
        ) : null}
        {reporting ? <ReportForm card={card} onClose={() => setReporting(false)} /> : null}
      </div>
      {!revealed ? (
        <div className="kc-play__keys">
          <button ref={showRef} type="button" className="kc-btn kc-btn--volt kc-btn--wide" onClick={reveal}>Show answer<kbd className="kc-kbd" aria-hidden="true">Space</kbd></button>
        </div>
      ) : (
        <div className="kc-rate" ref={rateRow} role="group" aria-label="How well did you recall it?">
          {RATINGS.map((r, i) => (
            <button key={r.rating} ref={r.rating === 3 ? firstRate : undefined} type="button" className="kc-rate__btn" data-rating={r.rating} disabled={Boolean(busy)} aria-busy={busy === r.rating || undefined} onClick={() => rate(r.rating)}>
              {busy === r.rating ? <LoaderCircle className="kc-spin" size={16} strokeWidth={2.2} aria-hidden="true" /> : null}
              <span>{r.label}</span>
              <kbd className="kc-kbd" aria-hidden="true">{r.key}</kbd>
            </button>
          ))}
        </div>
      )}
      {error ? <p className="kc-err" role="alert">{error}</p> : null}
    </section>
  );
}
