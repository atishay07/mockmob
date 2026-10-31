'use client';
// The card list Learn uses in the chapter's Cards view and in Find (DESIGN-SPEC A5, B 3.7).
//   Groups     one sticky bar per NCERT section (or per chapter in Find), with its count
//   A row      the kind line (kind, Must-know as a word, Missed lately; In Revise is a small dot before it), the front, and the
//              NCERT line folded behind "Show" (or open for every row with the "Show answers" switch). The line is clipped to two
//              lines until the row opens. A folded row is about 64 px tall. In Find, a card whose match is only in NCERT's words
//              shows that line without a tap, so the match is never hidden.
//   Open row   tap the front: the row grows in place to NCERT's full words, the source, In short and its actions
//              (Study this card, Add to Revise, Report). Only the open row shows actions.
//   Pick       a 28 px column inside the row: the box fades in on hover and focus (web) without moving the text, or shows on every
//              row while pick mode is on
//   Free       the open cards in full, then one locked line where the first locked card sits
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Lock } from 'lucide-react';
import { CardSource, InShort, NcertText, ReportForm } from '@/components/keycards/KeyCard';
import { cardFace, splitBlanks } from '@/components/keycards/kinds';
import { openUpgrade } from '@/components/pro/proNudgeStore';
import { hitParts, snippet } from './cardsShared';

function Marked({ text, query }) {
  return hitParts(text, query).map((p, i) => (p.hit ? <mark key={i} className="l2c-hit">{p.text}</mark> : <span key={i}>{p.text}</span>));
}

function Front({ card, query }) {
  const parts = splitBlanks(cardFace(card).front);
  return parts.map((p, i) => (p.blank
    ? <span key={i} className="kc-gap" role="img" aria-label={`blank ${p.n}`} />
    : <Marked key={i} text={p.text} query={query} />));
}

function Row({ card, index, isPro, showAnswers, pickMode, picked, onPick, open, onToggle, query, inRevise, onAdd, adding, studyHref, chapterHref, rowRef }) {
  const [shown, setShown] = useState(false);
  const [reporting, setReporting] = useState(false);
  const panel = useId();
  const { label } = cardFace(card);
  const front = cardFace(card).front;
  const frontHit = Boolean(query) && hitParts(front, query).some((p) => p.hit);
  const backHit = Boolean(query) && [card.back, card.quote].some((t) => t && hitParts(t, query).some((p) => p.hit));
  // A match that sits only in NCERT's words is shown where it is; a match in the front needs no line.
  const lineOn = showAnswers || shown || open || (backHit && !frontHit);
  const source = query && card.quote && !hitParts(card.back, query).some((p) => p.hit) ? card.quote : card.back;
  const line = source ? snippet(source, query, 210) : '';
  const must = card.importance === 'must';
  return (
    <li ref={rowRef} className="l2c-row" id={`l2c-card-${card.id}`} data-open={open || undefined} data-line={lineOn || undefined} data-picked={picked || undefined} style={{ '--i': Math.min(index, 9) }}>
      <label className="l2c-pick">
        <input type="checkbox" checked={picked} onChange={() => onPick(card.id)} aria-label={`Pick this card: ${front}`} />
        <span className="l2c-pick__box" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
      </label>
      <p className="l2c-kind">
        {inRevise ? <span className="l2c-dot" role="img" aria-label="In Revise" title="In Revise" /> : null}
        <span>{label}</span>
        {must ? <span className="l2c-must">Must-know</span> : null}
        {card.missedLately ? <span className="l2c-missed">Missed lately</span> : null}
      </p>
      <button type="button" className="l2c-hit-area" aria-expanded={open} aria-controls={panel} onClick={onToggle}>
        <span className="l2c-front"><Front card={card} query={query} /></span>
        <span className="l2c-fold" data-on={lineOn && !open ? '' : undefined} aria-hidden={!(lineOn && !open)}>
          <span className="l2c-fold__in"><span className="l2c-clip"><Marked text={line} query={query} /></span></span>
        </span>
      </button>
      {!showAnswers && !open && !(backHit && !frontHit) ? (
        <button type="button" className="l2c-show" aria-pressed={shown} aria-label={`${shown ? 'Hide' : 'Show'} the NCERT line: ${front}`} onClick={() => setShown((s) => !s)}>{shown ? 'Hide' : 'Show'}</button>
      ) : null}
      <div className="l2c-more" id={panel}>
        {open ? (
          <div className="l2c-full">
            <NcertText card={card} />
            <CardSource card={card} />
            <InShort card={card} />
            <div className="l2c-actions">
              {studyHref ? <Link className="kc-btn kc-btn--line kc-btn--small" href={studyHref(card)}>Study this card</Link> : null}
              {inRevise
                ? <span className="l2c-inline-in"><Check size={15} strokeWidth={2.4} aria-hidden="true" />In Revise</span>
                : <button type="button" className="kc-btn kc-btn--quiet" disabled={adding} onClick={(e) => onAdd([card.id], e.currentTarget)}>Add to Revise</button>}
              {chapterHref ? <Link className="kc-btn kc-btn--quiet" href={chapterHref(card)}>Open in chapter</Link> : null}
              <button type="button" className="kc-btn kc-btn--quiet" onClick={() => setReporting((r) => !r)}>Report</button>
            </div>
            {reporting ? <ReportForm card={card} onClose={() => setReporting(false)} /> : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function LockedLine({ text }) {
  return (
    <li className="l2c-locked">
      <Lock size={16} strokeWidth={2.2} aria-hidden="true" />
      <p>{text}</p>
      <button type="button" className="kc-btn kc-btn--line kc-btn--small" onClick={(e) => openUpgrade({ trigger: 'keycards', opener: e.currentTarget })}>See Pro</button>
    </li>
  );
}

/**
 * The sections as drawn: open cards, and the locked line once. A section that holds locked cards puts it where the first
 * one sits; when the server sends only the open cards (Free's chapter read) it closes the last section.
 */
export function visibleSections(sections = [], lockedLine = null) {
  let lockedDone = false;
  const out = [];
  for (const s of sections) {
    const cards = (s.cards || []).filter((c) => !c.locked);
    const total = (s.cards || []).length;
    const hasLocked = total > cards.length;
    const locked = hasLocked && !lockedDone && lockedLine ? lockedLine : null;
    if (hasLocked && lockedLine) lockedDone = true;
    if (!cards.length && !locked) continue;
    out.push({ key: s.key || s.title, title: s.title, cards, total, locked });
  }
  if (lockedLine && !lockedDone && out.length) out[out.length - 1].locked = lockedLine;
  return out;
}

/**
 * One sticky slot for the section name. The bars in the list are plain; this slot (zero height, stuck under the top bar) shows the
 * name of the section whose own bar has scrolled up past it, so a pushed bar never stacks over the next one.
 */
function useStuckSection(groups, idPrefix, holder) {
  const [at, setAt] = useState(-1);
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const top = holder.current ? parseFloat(getComputedStyle(holder.current).top) || 0 : 0;
      let found = -1;
      for (let i = 0; i < groups.length; i += 1) {
        const el = document.getElementById(`${idPrefix}-${i}`);
        if (el && el.getBoundingClientRect().top <= top + 1) found = i;
      }
      setAt((cur) => (cur === found ? cur : found));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [groups, idPrefix, holder]);
  return at;
}

export default function CardList({
  sections, lockedLine = null, isPro, showAnswers, pickMode, picked, onPick, query = '', addedIds, onAdd, adding = false,
  studyHref = null, chapterHref = null, groupHref = null, initialOpen = null, idPrefix = 'l2c-sec', onSections,
}) {
  const groups = useMemo(() => visibleSections(sections, lockedLine), [sections, lockedLine]);
  const [openId, setOpenId] = useState(initialOpen);
  const rowRefs = useRef({});
  const slot = useRef(null);
  const stuck = useStuckSection(groups, idPrefix, slot);
  const reported = useRef('');
  useEffect(() => {
    const sig = groups.map((g) => `${g.key}:${g.cards.length}`).join('|');
    if (reported.current === sig) return;
    reported.current = sig;
    onSections?.(groups.map((g, i) => ({ id: `${idPrefix}-${i}`, title: g.title, count: g.cards.length, total: g.total })));
  }, [groups, idPrefix, onSections]);
  useEffect(() => {
    if (!initialOpen) return;
    const el = rowRefs.current[initialOpen];
    if (el) { try { el.scrollIntoView({ block: 'center' }); } catch { /* it stays where it is */ } }
  }, [initialOpen, groups]);
  let n = 0;
  return (
    <div className="l2c-groups">
      <div className="l2c-slot" ref={slot} aria-hidden="true">
        {stuck >= 0 && groups[stuck] ? (
          <div className="l2c-secbar l2c-secbar--stuck">
            <span className="l2c-secbar__t">{groups[stuck].title}</span>
            <span className="l2c-secbar__n">{groups[stuck].total > groups[stuck].cards.length ? `${groups[stuck].cards.length} of ${groups[stuck].total}` : groups[stuck].cards.length}</span>
          </div>
        ) : null}
      </div>
      {groups.map((g, gi) => (
        <section key={g.key} className="l2c-group" aria-labelledby={`${idPrefix}-${gi}`}>
          <h2 className="l2c-secbar" id={`${idPrefix}-${gi}`}>
            {groupHref ? <Link className="l2c-secbar__t l2c-secbar__link" href={groupHref(g)}>{g.title}</Link> : <span className="l2c-secbar__t">{g.title}</span>}
            <span className="l2c-secbar__n">{g.total > g.cards.length ? `${g.cards.length} of ${g.total}` : g.cards.length}</span>
          </h2>
          <ul className="l2c-list">
            {g.cards.map((card) => (
              <Row
                key={card.id}
                card={card}
                index={n++}
                isPro={isPro}
                showAnswers={showAnswers}
                pickMode={pickMode}
                picked={picked.has(card.id)}
                onPick={onPick}
                open={openId === card.id}
                onToggle={() => setOpenId((cur) => (cur === card.id ? null : card.id))}
                query={query}
                inRevise={Boolean(card.inRevise) || addedIds?.has(card.id)}
                onAdd={onAdd}
                adding={adding}
                studyHref={studyHref}
                chapterHref={chapterHref}
                rowRef={(el) => { if (el) rowRefs.current[card.id] = el; else delete rowRefs.current[card.id]; }}
              />
            ))}
            {g.locked ? <LockedLine text={g.locked} /> : null}
          </ul>
        </section>
      ))}
    </div>
  );
}
