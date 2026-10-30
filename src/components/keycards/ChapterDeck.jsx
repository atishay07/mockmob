"use client";
// /cards/[chapter]: one chapter's Key cards (KEYCARDS-BUILD-SPEC.md section 3).
//   Head      the unit (only when it differs from the title), the chapter title, "Business Studies Part 1 · Ch 1", the chip;
//             for Pro the reason line from /api/me/chapters ("7 of 12 right on the latest try at each question. Cards: 14 of 20 holding.")
//   Actions   Add chapter to Revise (the one volt key in Read), Print chapter sheet (Pro)
//   Modes     one segmented control: Read (the book, card by card), Study (a recall session), Last look (Must-know, nothing scheduled)
//   Free      the locked cards are one quiet row after the open ones, with their count and the one Pro line, never a wall of locks
// Read shows a card's front as a small prompt above the book's words, except where the front IS the book's line with gaps
// (Term, Key line): there the marked words already say what was blanked, so the line is not printed twice.
// States: loading (skeleton rows), empty ("No cards for this chapter yet"), error (Try again), off (Key cards not open).
// Motion: transform and opacity only, 150-300 ms ease-out (keycards.css); reduced motion lands at once.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Check, ChevronLeft, Lock, Printer } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { ErrorState } from '@/components/ui/Skeleton';
import { CardHead, CardSource, InShort, KeyCardPlayer, NcertText, Prompt, ProGate, ReportForm } from './KeyCard';
import { addToRevise, isOff, isProRequired, readChapters, readDeck, refreshHome } from './api';
import { BLANK_KINDS, MODES, chapterRef, chapterRefSpoken, endCounts, plural, readingRows, splitDeck } from './kinds';
import { useCardsLinks } from './links';
import { ncertFont } from './ncertFont';
import './keycards.css';

function useDeck(chapterKey) {
  const [read, setRead] = useState({ state: 'loading', deck: null });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    readDeck(chapterKey)
      .then((deck) => { if (alive) setRead({ state: 'ready', deck }); })
      .catch((e) => { if (alive) setRead({ state: isOff(e) ? 'off' : e?.status === 404 ? 'missing' : 'error', deck: null }); });
    return () => { alive = false; };
  }, [chapterKey, nonce]);
  const retry = useCallback(() => { setRead({ state: 'loading', deck: null }); setNonce((n) => n + 1); }, []);
  const setDeck = useCallback((fn) => setRead((r) => ({ ...r, deck: fn(r.deck) })), []);
  return { ...read, retry, setDeck };
}

/** The Pro reason line for this chapter, from GET /api/me/chapters (Pro only; nothing for Free or on a failed read). */
function useReason(chapterKey, isPro) {
  const [reason, setReason] = useState(null);
  useEffect(() => {
    if (!isPro) return undefined;
    let alive = true;
    const subject = String(chapterKey).split('.')[0];
    readChapters(subject).then((body) => {
      const row = (body?.units || []).flatMap((u) => u.chapters || []).find((c) => c.key === chapterKey);
      const text = typeof row?.reason === 'string' ? row.reason.trim() : '';
      if (alive) setReason(text ? (/[.!?]$/.test(text) ? text : `${text}.`) : null);
    }).catch(() => {});
    return () => { alive = false; };
  }, [chapterKey, isPro]);
  return reason;
}

function ModeTabs({ mode, onChange }) {
  const refs = useRef({});
  const move = (e, i) => {
    const to = e.key === 'ArrowRight' ? (i + 1) % MODES.length : e.key === 'ArrowLeft' ? (i + MODES.length - 1) % MODES.length : null;
    if (to === null) return;
    e.preventDefault();
    onChange(MODES[to].id);
    refs.current[MODES[to].id]?.focus();
  };
  return (
    <div className="kc-seg" role="tablist" aria-label="How to use these cards">
      {MODES.map((m, i) => (
        <button key={m.id} ref={(el) => { refs.current[m.id] = el; }} type="button" role="tab" id={`kc-tab-${m.id}`} aria-controls="kc-panel" aria-selected={mode === m.id} tabIndex={mode === m.id ? 0 : -1} className="kc-seg__btn" onClick={() => onChange(m.id)} onKeyDown={(e) => move(e, i)}>{m.label}</button>
      ))}
      <span className="kc-seg__thumb" aria-hidden="true" style={{ '--i': MODES.findIndex((m) => m.id === mode) }} />
    </div>
  );
}

// ---------------------------------------------------------------- Read

function ReadEntry({ card, isPro, inRevise, onAdd, index }) {
  const [reporting, setReporting] = useState(false);
  const single = isPro && card.importance !== 'must';
  const menu = single && !inRevise ? [{ label: 'Add this card to Revise', onSelect: () => onAdd(card.id) }] : [];
  return (
    <li className="kc-entry" style={{ '--i': Math.min(index, 8) }}>
      <CardHead card={card} onReport={() => setReporting(true)} menu={menu}>{inRevise && single ? <span className="kc-in"><Check size={13} strokeWidth={2.6} aria-hidden="true" />In Revise</span> : null}</CardHead>
      {BLANK_KINDS.includes(card.kind) ? null : <Prompt card={card} />}
      <NcertText card={card} />
      <CardSource card={card} />
      <InShort card={card} />
      {reporting ? <ReportForm card={card} onClose={() => setReporting(false)} /> : null}
    </li>
  );
}

function ReadMode({ deck, isPro, added, onAdd }) {
  const rows = readingRows(deck.cards);
  const addedSet = new Set(added);
  return (
    <ol className="kc-read">
      {rows.map((row, i) => (row.card
        ? <ReadEntry key={row.card.id} card={row.card} index={i} isPro={isPro} inRevise={addedSet.has(row.card.id)} onAdd={onAdd} />
        : (
          <li key="stub" className="kc-stub">
            <p className="kc-stub__count"><Lock size={15} strokeWidth={2.2} aria-hidden="true" /><span><b>{plural(row.stub, 'more card')}</b> in this chapter.</span></p>
            <ProGate isPro={isPro} />
          </li>
        )))}
    </ol>
  );
}

// ---------------------------------------------------------------- Study

// A rating the server confirmed schedules that card (POST /api/keycards/review creates its state), so `onReviewed` tells the
// page, and "Add chapter to Revise" turns to "In Revise" once every card it would add is scheduled: the screen never offers to
// add what Study has already added.
function StudyMode({ cards, isPro, inRevise, onAddChapter, adding, readHref, onRead, onReviewed }) {
  const [round, setRound] = useState(0);
  const [at, setAt] = useState(0);
  const [ratings, setRatings] = useState({});
  const [limited, setLimited] = useState(false);
  const total = cards.length;
  const card = cards[at];
  const rated = useCallback(({ rating, cardId }) => {
    onReviewed?.(cardId);
    setRatings((r) => ({ ...r, [rating]: (r[rating] || 0) + 1 }));
    setAt((n) => n + 1);
  }, [onReviewed]);
  const again = () => { setRatings({}); setAt(0); setRound((r) => r + 1); };
  if (limited) {
    return (
      <div className="kc-end" role="status">
        <h2 className="kc-end__title">Today’s free reviews are used</h2>
        <p className="kc-end__line">Free includes 10 card reviews a day. Reading the cards stays open, and the reviews come back tomorrow.</p>
        <ProGate isPro={isPro} />
        <button type="button" className="kc-btn kc-btn--quiet" onClick={onRead}>Read the chapter</button>
      </div>
    );
  }
  if (!card) {
    const counts = endCounts(ratings);
    const done = counts.reduce((a, c) => a + c.n, 0);
    return (
      <div className="kc-end" aria-labelledby="kc-end-h">
        <h2 className="kc-end__title" id="kc-end-h" role="status">{plural(done, 'card')} studied</h2>
        <dl className="kc-counts">
          {counts.map((c) => <div key={c.label} data-k={c.label}><dt>{c.label}</dt><dd>{c.n}</dd></div>)}
        </dl>
        <div className="kc-end__keys">
          {!inRevise ? <button type="button" className="kc-btn kc-btn--volt" data-page-primary="" onClick={onAddChapter} disabled={adding}>{adding ? 'Adding' : 'Add chapter to Revise'}</button> : null}
          <button type="button" className={inRevise ? 'kc-btn kc-btn--volt' : 'kc-btn kc-btn--line'} data-page-primary={inRevise ? '' : undefined} onClick={again}>Study again</button>
          <a className="kc-btn kc-btn--quiet" href={readHref} onClick={(e) => { e.preventDefault(); onRead(); }}>Read the chapter</a>
        </div>
        {!isPro ? <ProGate isPro={isPro} lead={`You studied the ${plural(total, 'open card')}.`} /> : null}
      </div>
    );
  }
  return (
    <div className="kc-session">
      <div className="kc-progress" aria-hidden="true"><span style={{ transform: `scaleX(${at / total})` }} /></div>
      <KeyCardPlayer key={`${round}:${card.id}`} card={card} mode="study" position={`${at + 1} of ${total}`} onRated={rated} onLimit={() => setLimited(true)} />
      <p className="kc-fine">Each card you rate joins Revise: Missed brings it back soon, Got it and Easy space it out.<span className="kc-keyhint"> Space shows the answer; 1, 2 and 3 rate it.</span></p>
    </div>
  );
}

// ---------------------------------------------------------------- Last look

function LastLookMode({ cards }) {
  const [at, setAt] = useState(0);
  const start = useRef(null);
  const total = cards.length;
  const go = useCallback((d) => setAt((n) => Math.max(0, Math.min(total, n + d))), [total]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);
  if (!total) return <p className="kc-empty-line">No Must-know cards are open in this chapter yet.</p>;
  if (at >= total) {
    return (
      <div className="kc-end" role="status">
        <h2 className="kc-end__title">That was every Must-know card</h2>
        <p className="kc-end__line">{plural(total, 'card')}, nothing scheduled. Last look never changes when a card comes back.</p>
        <div className="kc-end__keys"><button type="button" className="kc-btn kc-btn--line" onClick={() => setAt(0)}>Look again</button></div>
      </div>
    );
  }
  const card = cards[at];
  const onDown = (e) => { start.current = { x: e.clientX, y: e.clientY }; };
  const onUp = (e) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.4) go(dx < 0 ? 1 : -1);
  };
  return (
    <div className="kc-session">
      <div className="kc-progress" aria-hidden="true"><span style={{ transform: `scaleX(${(at + 1) / total})` }} /></div>
      <p className="kc-pos">{at + 1} of {total}</p>
      <article key={card.id} className="kc-look" onPointerDown={onDown} onPointerUp={onUp} aria-live="polite" aria-label={`Card ${at + 1} of ${total}`}>
        <CardHead card={card} />
        {BLANK_KINDS.includes(card.kind) ? null : <Prompt card={card} />}
        <NcertText card={card} />
        <CardSource card={card} />
      </article>
      <div className="kc-look__keys">
        <button type="button" className="kc-btn kc-btn--line" onClick={() => go(-1)} disabled={at === 0}>Previous</button>
        <button type="button" className="kc-btn kc-btn--volt" data-page-primary="" onClick={() => go(1)}>{at + 1 === total ? 'Finish' : 'Next'}</button>
      </div>
      <p className="kc-fine">Must-know only, and nothing is scheduled. Swipe to move on<span className="kc-keyhint">, or use the arrow keys</span>.</p>
    </div>
  );
}

// ---------------------------------------------------------------- the print sheet (Pro)

function PrintSheet({ deck, cards }) {
  // Drawn straight into <body>, so the print stylesheet can hide everything else and print only the sheet.
  const [host, setHost] = useState(null);
  useEffect(() => { queueMicrotask(() => setHost(document.body)); }, []);
  if (!host) return null;
  return createPortal(
    <section className={`kc-print ${ncertFont.variable}`} aria-hidden="true">
      <h1>{deck.chapter.title}</h1>
      <p className="kc-print__ref">{[chapterRef(deck.chapter.ncert), `${plural(cards.length, 'Must-know card')} in NCERT’s exact words, each with its page`].filter(Boolean).join('. ')}.</p>
      <ol>
        {cards.map((c) => (
          <li key={c.id}>
            {BLANK_KINDS.includes(c.kind) ? null : <Prompt card={c} />}
            <NcertText card={c} />
            <CardSource card={c} />
          </li>
        ))}
      </ol>
    </section>,
    host,
  );
}

// ---------------------------------------------------------------- the page

const readMode = () => {
  try { const m = new URLSearchParams(window.location.search).get('mode'); return m === 'study' || m === 'last' ? m : 'read'; } catch { return 'read'; }
};

export default function ChapterDeck({ chapterKey }) {
  const { user } = useAuth() || {};
  const isPro = user?.isPremium === true;
  const links = useCardsLinks();
  const { state, deck, retry, setDeck } = useDeck(chapterKey);
  const reason = useReason(chapterKey, isPro);
  const [mode, setModeState] = useState('read');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState(null);
  useEffect(() => { queueMicrotask(() => setModeState(readMode())); }, []);
  const setMode = useCallback((m) => {
    setModeState(m);
    try { const u = new URL(window.location.href); if (m === 'read') u.searchParams.delete('mode'); else u.searchParams.set('mode', m); window.history.replaceState(window.history.state, '', u); } catch { /* the URL just keeps the old mode */ }
  }, []);

  const { open } = useMemo(() => splitDeck(deck?.cards), [deck]);
  const must = useMemo(() => open.filter((c) => c.importance === 'must'), [open]);
  const addSet = isPro ? must : open;
  const added = deck?.added || [];
  const inRevise = addSet.length > 0 && addSet.every((c) => added.includes(c.id));

  const add = useCallback(async (input) => {
    setAdding(true);
    setAddError(null);
    try {
      await addToRevise(input);
      const ids = input.chapter ? addSet.map((c) => c.id) : input.cardIds;
      setDeck((d) => (d ? { ...d, added: [...new Set([...(d.added || []), ...ids])] } : d));
      refreshHome();
    } catch (e) {
      setAddError(isProRequired(e) ? 'Adding these cards needs Pro. Reading them stays open.' : 'The cards were not added. Try again.');
    } finally {
      setAdding(false);
    }
  }, [addSet, setDeck]);
  const addChapter = useCallback(() => add({ chapter: chapterKey }), [add, chapterKey]);
  const reviewed = useCallback((id) => {
    if (!id) return;
    setDeck((d) => (d && !(d.added || []).includes(id) ? { ...d, added: [...(d.added || []), id] } : d));
    refreshHome();
  }, [setDeck]);

  const back = <Link className="kc-back" href={links.home(String(chapterKey).split('.')[0])}><ChevronLeft size={18} strokeWidth={2.2} aria-hidden="true" />Key cards</Link>;
  const shell = (body) => <div className={`kc kc--deck ${ncertFont.variable}`}>{back}{body}</div>;

  if (state === 'loading') {
    return shell(
      <div className="kc-skel" role="status" aria-label="Loading the chapter's cards">
        <span className="skeleton kc-skel__title" /><span className="skeleton kc-skel__line" />
        {[0, 1, 2].map((i) => <span key={i} className="skeleton kc-skel__card" />)}
      </div>,
    );
  }
  if (state === 'off' || state === 'missing') {
    return shell(
      <div className="kc-quiet-state">
        <h1 className="kc-title">{state === 'off' ? 'Key cards are not open yet' : 'This chapter is not in Key cards'}</h1>
        <p>{state === 'off' ? 'Your lessons and practice are all still here.' : 'It may have left the CUET syllabus, or the link is old. Your other chapters are in Key cards.'}</p>
        <Link className="kc-btn kc-btn--line" href={links.home()}>See all chapters</Link>
      </div>,
    );
  }
  if (state === 'error' || !deck) return shell(<ErrorState title="The cards did not load" message="Check your connection and try again. Nothing you added is lost." onRetry={retry} />);

  const { chapter, counts } = deck;
  const ref = chapterRef(chapter.ncert);
  const empty = !deck.cards?.length;
  const addLine = isPro
    ? `Adds the ${plural(must.length, 'Must-know card')}. Good-to-know cards you add one at a time.`
    : `Adds the ${plural(open.length, 'open card')}. Free reviews 10 cards a day.`;

  return (
    <div className={`kc kc--deck ${ncertFont.variable}`} data-mode={mode}>
      {back}
      <header className="kc-dhead">
        {chapter.unit && chapter.unit !== chapter.title ? <p className="kc-dhead__unit">{chapter.unit}</p> : null}
        <h1 className="kc-title">{chapter.title}</h1>
        {ref || chapter.chip ? (
          <p className="kc-dhead__ref">
            {ref ? <span aria-label={chapterRefSpoken(chapter.ncert)}>{ref}</span> : null}
            {chapter.chip ? <span className="kc-chip">{chapter.chip}</span> : null}
          </p>
        ) : null}
        {reason ? <p className="kc-dhead__reason">{reason}</p> : null}
      </header>

      {empty ? (
        <div className="kc-quiet-state">
          <h2>No cards for this chapter yet</h2>
          <p>Cards are written from the NCERT book and checked word for word before they open here. Until then, practise the chapter or read another one.</p>
          <Link className="kc-btn kc-btn--line" href={links.home(String(chapterKey).split('.')[0])}>See all chapters</Link>
        </div>
      ) : (
        <div className="kc-board">
          <aside className="kc-side" aria-label="This chapter">
            <p className="kc-side__count">{counts.locked
              ? <><b>{open.length} of {counts.total}</b> cards open, {counts.mustKnow} Must-know in all</>
              : <><b>{plural(counts.total, 'card')}</b>, {counts.mustKnow} Must-know</>}</p>
            <div className="kc-side__keys">
              {inRevise ? (
                <p className="kc-inrevise" role="status"><Check size={16} strokeWidth={2.4} aria-hidden="true" />In Revise. Due cards come back there.</p>
              ) : (
                <button type="button" className={mode === 'read' ? 'kc-btn kc-btn--volt kc-btn--wide' : 'kc-btn kc-btn--line kc-btn--wide'} data-page-primary={mode === 'read' ? '' : undefined} onClick={addChapter} disabled={adding || !addSet.length}>{adding ? 'Adding' : 'Add chapter to Revise'}</button>
              )}
              {!inRevise ? <p className="kc-fine">{addLine}</p> : null}
              {addError ? <p className="kc-err" role="alert">{addError}</p> : null}
              {isPro && must.length ? <button type="button" className="kc-btn kc-btn--quiet" onClick={() => window.print()}><Printer size={16} strokeWidth={2} aria-hidden="true" />Print chapter sheet</button> : null}
            </div>
          </aside>
          <div className="kc-main">
            <ModeTabs mode={mode} onChange={setMode} />
            <div id="kc-panel" role="tabpanel" aria-labelledby={`kc-tab-${mode}`} className="kc-panel" key={mode}>
              {mode === 'read' ? <ReadMode deck={deck} isPro={isPro} added={added} onAdd={(id) => add({ cardIds: [id] })} /> : null}
              {mode === 'study' ? <StudyMode cards={open} isPro={isPro} inRevise={inRevise} onAddChapter={addChapter} adding={adding} readHref={links.deck(chapterKey)} onRead={() => setMode('read')} onReviewed={reviewed} /> : null}
              {mode === 'last' ? <LastLookMode cards={must} /> : null}
            </div>
          </div>
        </div>
      )}
      {isPro && must.length ? <PrintSheet deck={deck} cards={must} /> : null}
    </div>
  );
}
