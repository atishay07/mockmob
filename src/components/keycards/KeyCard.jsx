"use client";
// The card itself, shared by Read, Study, Last look, Revise and "The line you needed" (KEYCARDS-BUILD-SPEC.md section 3).
//   CardHead     the kind label ("Definition"), "Must-know" when it is, "Asked in 2 past papers" when certain, and a small
//                overflow menu with "Report this card"
//   Prompt       the front; blanks drawn as short ruled gaps, never as underscores; a front that repeats the kind ("Formula:
//                Current ratio" under "Formula") drops the repeat (kinds.js cardFace)
//   NcertText    the back: NCERT's exact words in the reading face, the blanked words marked by weight and a fine rule.
//                Set as the book sets them: a list keeps NCERT's own numbers instead of adding bullets, a formula breaks before
//                its "=", a journal entry is drawn as one (Dr. lines, To lines set in, the narration below), and any other
//                line break in the book's words is kept.
//   CardSource   "Business Studies Part 1, Ch 1, p. 3"
//   InShort      the optional paraphrase, labelled, in the app's own face so it never passes for the book
//   KeyCardPlayer   one card to recall: front first, Show answer (space, the key, or a tap anywhere on the card), then
//                   Missed / Got it / Easy (1, 2, 3).
//                   The rating counts only once the server has it; until then the key shows it is saving.
//   ProGate      the one quiet Pro line with "See Pro" (opens the Upgrade sheet with the keycards reason)
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { LoaderCircle, MoreHorizontal } from 'lucide-react';
import { openUpgrade } from '@/components/pro/proNudgeStore';
import { BLANK_KINDS, LIST_KINDS, PRO_LINE, RATINGS, backLines, cardFace, entryRows, formulaLines, isNcert, limitKind, markBlanks, ownMarker, plural, sourceLine, splitBlanks, startsMidSentence, stampFor, withLead } from './kinds';
import { isProRequired, proReason, sendReport, sendReview } from './api';

const typing = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

export function Prompt({ card, as: Tag = 'p', className = 'kc-prompt', id }) {
  const parts = splitBlanks(cardFace(card).front);
  return (
    <Tag className={className} id={id}>
      {parts.map((p, i) => (p.blank
        ? <span key={i} className="kc-gap" role="img" aria-label={`blank ${p.n}`} />
        : <span key={i}>{p.text}</span>))}
    </Tag>
  );
}

// A list whose lines carry NCERT's own numbers or letters draws those, and no bullets at all (a lead-in line stays bare).
function ListLine({ line, first, card, bare }) {
  const own = ownMarker(line);
  if (own) return <li data-own=""><span className="kc-lm">{own[0]}</span><span>{own[1]}</span></li>;
  return <li data-bare={bare || undefined}>{first ? withLead(line, card) : line}</li>;
}

function EntryText({ rows, className }) {
  return (
    <div className={`${className} kc-ncert--entry`} role="group" aria-label="Journal entry">
      {rows.map((r, i) => (
        <p key={i} className="kc-je" data-k={r.kind}>
          <span className="kc-je__text">{r.text}</span>
          {r.kind === 'dr' ? <span className="kc-je__dr">Dr.</span> : null}
          {r.amount ? <span className="kc-je__amt">{r.amount}</span> : null}
        </p>
      ))}
    </div>
  );
}

export function NcertText({ card, className = '' }) {
  const lines = LIST_KINDS.includes(card?.kind) ? backLines(card.back) : [];
  const cls = `kc-ncert ${className}`.trim();
  if (lines.length > 1) {
    const Tag = card.kind === 'steps' ? 'ol' : 'ul';
    const bare = lines.some((l) => ownMarker(l));
    return <Tag className={`${cls} kc-ncert--list`}>{lines.map((l, i) => <ListLine key={i} line={l} first={i === 0} card={card} bare={bare} />)}</Tag>;
  }
  if (card?.kind === 'formula') {
    const [first, ...rest] = formulaLines(card.back);
    return (
      <div className={`${cls} kc-ncert--formula`}>
        {first?.rhs ? <p className="kc-formula"><span>{withLead(first.lhs, card)}</span> <span className="kc-formula__rhs">{first.rhs}</span></p>
          : <p className="kc-formula">{withLead(first?.text || '', card)}</p>}
        {rest.map((l, i) => <p key={i}>{l.text}</p>)}
      </div>
    );
  }
  const rows = card?.kind === 'entry' ? entryRows(card.back) : null;
  if (rows) return <EntryText rows={rows} className={cls} />;
  const marked = BLANK_KINDS.includes(card?.kind) ? markBlanks(card.back, card.blanks) : [{ text: card?.back || '' }];
  // A line break in the book's words starts a new paragraph (a fact's short answer above the NCERT line it comes from, a
  // rule's Wrong and Right). A paragraph that starts mid-sentence is an NCERT excerpt: shown with a leading ellipsis, the
  // stored text untouched.
  const paras = paragraphsOf(marked);
  const draw = (parts) => parts.map((p, i) => (p.mark ? <mark key={i} className="kc-mark">{p.mark}</mark> : <span key={i}>{p.text}</span>));
  const lead = (parts) => (parts[0]?.text && startsMidSentence(parts[0].text, card) ? '…' : null);
  if (paras.length < 2) return <p className={cls}>{lead(paras[0] || [])}{draw(paras[0] || [])}</p>;
  return <div className={`${cls} kc-ncert--paras`}>{paras.map((parts, i) => <p key={i}>{lead(parts)}{draw(parts)}</p>)}</div>;
}

/** Marked parts split into paragraphs at the back's line breaks, each paragraph's first text trimmed. */
function paragraphsOf(parts) {
  const out = [[]];
  for (const p of parts) {
    if (p.mark) { out[out.length - 1].push(p); continue; }
    String(p.text).split(/\n+/).forEach((t, i) => { if (i > 0) out.push([]); if (t) out[out.length - 1].push({ text: out[out.length - 1].length ? t : t.trimStart() }); });
  }
  return out.filter((ps) => ps.some((x) => String(x.mark || x.text).trim()));
}

export function CardSource({ card }) {
  const line = sourceLine(card?.source);
  return line ? <p className="kc-source">{line}</p> : null;
}

export function InShort({ card }) {
  if (!card?.note) return null;
  // The English deck's notes name themselves ("Synonym: clear. Antonym: obscure.", "Example: ..."); "In short" would mislabel them.
  if (!isNcert(card)) return <p className="kc-short">{card.note}</p>;
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
  if (state === 'sent') return <p className="kc-report kc-report--sent" role="status">Thank you. Your report is saved, and reported cards are checked against the book.</p>;
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
  const { label } = cardFace(card);
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
 * One card to recall. `onRated({ rating, result, cardId })` runs after the server acknowledged the rating; `onLimit()` when Free has
 * used the day's reviews (402; it gets the kind from limitKind: 'reviews', 'new' or 'card'). `mode` is the review mode the server records ('study' | 'revise'). `active` binds the keys.
 */
export function KeyCardPlayer({ card, mode, position = null, active = true, detail = null, onRated, onLimit }) {
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [reporting, setReporting] = useState(false);
  const showRef = useRef(null);
  const firstRate = useRef(null);
  const stamp = useRef(null);
  const rateRow = useRef(null);
  const headId = useId();

  const reveal = useCallback(() => setRevealed(true), []);
  const rate = useCallback(async (rating) => {
    if (busy || !revealed) return;
    setBusy(rating);
    setError(null);
    // One stamp per card shown, reused when the same rating is retried (the server treats it as the replay key).
    stamp.current = stampFor(stamp.current, card.id);
    try {
      const result = await sendReview({ cardId: card.id, rating, mode, clientReviewedAt: stamp.current.at });
      if (!result?.ok) throw new Error('unconfirmed');
      // { ok: true, late: true } is a review the server logged without scheduling: it counts as done, with nothing to show.
      onRated?.({ rating, result, cardId: card.id });
    } catch (e) {
      if (isProRequired(e)) { onLimit?.(limitKind(proReason(e))); return; }
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
      {/* A tap anywhere on the front shows the answer too (the Show answer key is the named, focusable way). */}
      <div className="kc-play__card" data-tap={revealed ? undefined : ''} onClick={(e) => { if (!revealed && !reporting && !e.target.closest('button, a, textarea, input, [role="menu"]')) reveal(); }}>
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
          <button ref={showRef} type="button" className="kc-btn kc-btn--volt kc-btn--wide" data-page-primary="" onClick={reveal}>Show answer<kbd className="kc-kbd" aria-hidden="true">Space</kbd></button>
        </div>
      ) : (
        <div className="kc-rate" ref={rateRow} role="group" aria-label="How well did you recall it?">
          {RATINGS.map((r, i) => (
            <button key={r.rating} ref={r.rating === 3 ? firstRate : undefined} type="button" className="kc-rate__btn" data-rating={r.rating} data-page-primary={r.rating === 3 ? '' : undefined} disabled={Boolean(busy)} aria-busy={busy === r.rating || undefined} onClick={() => rate(r.rating)}>
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
