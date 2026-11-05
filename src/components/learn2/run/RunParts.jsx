'use client';
// The run player's parts (A4-chapter-run.md 3.3, with A1 3.3 to 3.6 for the values the run shares with the feed, BUILD-1101 B1,
// B2 and B7): the top bar and its ticks, the session panel, the Key card face (fits its content, type by length, the source at
// its foot, the prompt kept small on the back), the question on the page (option rows, the verdict, the line you needed in
// place, "Why C"), the lesson item, the stop sheet. RunPlayer.jsx owns the state; these only draw it.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { BookOpen, Bookmark, Check, ChevronDown, History, LoaderCircle, X } from 'lucide-react';
import MobiReact from '@/components/brand/MobiReact';
import { CardHead, InShort, NcertText, Prompt } from '@/components/keycards/KeyCard';
import { cardFace, isNcert, kindFamily, sourceLine } from '@/components/keycards/kinds';
import { ncertFont } from '@/components/keycards/ncertFont';
import SwipeLabels from '@/components/keycards/SwipeLabels';
import { ClampLine, SciFront, SciNcert, Stem } from '../stage';
import { WORDS, pileLabel } from '../../../../data/learn/words.js';
import { firstLine, optionText } from './runMath';
import { frontStep, rightLine, stageTag } from './runView.mjs';

/** "NCERT, Accountancy Part 1, Ch 2, p. 70": where the answer will come from (B1). */
export function sourceText(card) {
  const line = sourceLine(card?.source);
  if (!line) return null;
  return isNcert(card) && card?.source?.kind !== 'wordnet' ? `NCERT, ${line}` : line;
}

// ---------------------------------------------------------------- the Revise pile glyph (the flight's target)

export function PileGlyph({ size = 'small', pileRef }) {
  return <span className={`lr-glyph lr-glyph--${size}`} ref={pileRef} aria-hidden="true"><i /><i /><i /></span>;
}

// ---------------------------------------------------------------- ticks (A4 3.3.2, A1 3.3)

export function Ticks({ total, done, current, offset = 0 }) {
  const all = offset + total;
  if (!all) return <span className="lr-ticks lr-ticks--none" aria-hidden="true" />;
  if (all > 40) {
    return (
      <span className="lr-ticks lr-ticks--bar" aria-hidden="true">
        <i style={{ transform: `scaleX(${Math.min(1, (offset + done) / all)})` }} />
        <b style={{ left: `${Math.min(100, ((offset + current) / all) * 100)}%` }} />
      </span>
    );
  }
  return (
    <span className="lr-ticks" aria-hidden="true">
      {Array.from({ length: all }, (_, i) => {
        const state = i < offset + done ? 'done' : i === offset + current ? 'now' : 'later';
        return <i key={i} data-s={state} />;
      })}
    </span>
  );
}

// ---------------------------------------------------------------- the top bar (phone and tablet; on desktop Close and the ticks)

/** The Revise-later pile's name for a screen reader: an image named "4 cards to revise later", from 1; nothing at 0. */
export const pileName = (pile) => (pile > 0 ? { role: 'img', 'aria-label': `${pile} ${pile === 1 ? 'card' : 'cards'} to revise later` } : { 'aria-hidden': true });

/**
 * The top bar (R3-SPEC L4): one row with the X, the ticks and the counter "4 of 20"; under it one quiet line with the chapter's
 * name (one line, an ellipsis), and from 768 px the time left at its end. The Revise-later pile is not in a phone's bar; from
 * 1024 px it is one card-stack glyph with "4 to revise" (role img, named "4 cards to revise later": R4 client-code#4), shown from
 * 1. The first time the pile goes from 0 to 1 a 1.6 s tip says "In Revise" (seen on desktop only; the player's live region
 * says it to a screen reader at every width, R4 client-code#11).
 */
export function TopBar({ title, position, total, done, current, offset, left, pile, pop, pileRef, posRef, onClose, closeHref, showPile = true }) {
  const [tip, setTip] = useState(false);
  const was = useRef(pile);
  useEffect(() => {
    const before = was.current;
    was.current = pile;
    if (!(before === 0 && pile === 1)) return undefined;
    setTip(true);
    const t = setTimeout(() => setTip(false), 1600);
    return () => clearTimeout(t);
  }, [pile]);
  return (
    <header className="lr-top">
      <Link href={closeHref} className="lr-close" aria-label="Close" onClick={onClose}>
        <X size={22} strokeWidth={2.2} aria-hidden="true" /><span className="lr-close__word">Close</span>
      </Link>
      <p className="lr-top__title" title={title || undefined}>{title}</p>
      {showPile ? (
        <span className="lr-top__pile" data-zero={pile ? undefined : ''} {...pileName(pile)}>
          <PileGlyph pileRef={pileRef} />
          <b key={pop} data-pop={pop ? '' : undefined} aria-hidden="true">{pile ? pileLabel(pile) : ''}</b>
          {tip ? <span className="lr-top__tip" aria-hidden="true">{WORDS.inRevise}</span> : null}
        </span>
      ) : <span className="lr-top__pile" />}
      <p className="lr-top__pos" ref={posRef} aria-label={position ? `${position} of ${total}` : undefined}>{position ? <><b>{position}</b> of {total}</> : null}</p>
      <div className="lr-top__ticks"><Ticks total={total - offset} done={done} current={current} offset={offset} /></div>
      <p className="lr-top__left">{left || ''}</p>
    </header>
  );
}

// ---------------------------------------------------------------- the session panel (1200 px and up, A4 3.3.3)

function MiniFan({ id }) {
  return (
    <span className="lr-mini" data-kind={id} aria-hidden="true">
      <i /><i /><i data-top="">{id === 'questions' || id === 'mistakes' ? <s /> : null}</i>
    </span>
  );
}

/**
 * The session panel (1200 px and up). Under the chapter's name its place in the roadmap, "Chapter 5 of 14" (R4 ruling N:
 * `placeLine` from chapterPlace; no line when the server sent no place, never "Part 1, Ch 2"). The Revise-later pile is the
 * card-stack glyph with "4 to revise" (pileLabel), named "4 cards to revise later", from 1 (R4 ui-correctness#14).
 */
export function SessionPanel({ chapter, placeLine, position, total, left, upNext, piles, pile, pop, pileRef, stamp, tally, onStop, recap, mustKnow }) {
  return (
    <aside className="lr-panel" aria-label="This session">
      <div className="lr-panel__ch">
        <p className="lr-panel__title">{chapter}</p>
        {placeLine ? <p className="lr-panel__ref">{placeLine}</p> : null}
      </div>
      <div className="lr-panel__where">
        <p className="lr-panel__pos"><b>{position}</b> of {total}</p>
        {left ? <p className="lr-panel__left">{left.charAt(0).toUpperCase() + left.slice(1)}</p> : null}
        {upNext ? <p className="lr-panel__next">{upNext}</p> : null}
      </div>
      {recap ? (
        mustKnow ? <p className="lr-panel__must">{mustKnow}</p> : null
      ) : (
        <>
          <ul className="lr-panel__piles" aria-label="The piles you chose">
            {piles.map((p) => (
              <li key={p.id} aria-current={p.current ? 'step' : undefined} data-current={p.current || undefined}>
                <MiniFan id={p.id} />
                <span className="lr-panel__pl">{p.label}</span>
                <span className="lr-panel__pv">{p.value}</span>
              </li>
            ))}
          </ul>
          <div className="lr-panel__revise" data-zero={pile ? undefined : ''}>
            <span className="lr-panel__pile" {...pileName(pile)}>
              <PileGlyph size="big" pileRef={pileRef} />
              <b className="lr-panel__rl" key={pop} data-pop={pop ? '' : undefined} aria-hidden="true">{pile ? pileLabel(pile) : ''}</b>
            </span>
            <p className="lr-panel__stamp" data-on={stamp ? '' : undefined}>{stamp?.text || ''}</p>
          </div>
          {tally.answered ? (
            <div className="lr-panel__right">
              <p>{tally.right ? `Right so far: ${tally.right} of ${tally.answered}` : `${tally.answered} ${tally.answered === 1 ? 'question' : 'questions'} tried`}</p>
              {tally.streak >= 3 ? <p className="lr-panel__streak"><b>{tally.streak}</b> in a row</p> : null}
            </div>
          ) : null}
        </>
      )}
      <button type="button" className="lr-textkey lr-panel__stop" onClick={onStop}>Stop here</button>
    </aside>
  );
}

// ---------------------------------------------------------------- the Key card (A4 3.3.6, B1)

/** The prompt, with a chemistry card's notation drawn (R4; display only). */
function Ask({ card, sci, as: Tag, className, id }) {
  if (!sci) return <Prompt card={card} as={Tag} className={className} id={id} />;
  return <Tag className={className} id={id}><SciFront text={cardFace(card).front} numbered /></Tag>;
}

export function CardItem({ item, turned, recap, still, cardRef, swipe = false, onTurn, onReport, sci = false }) {
  // No "Must-know" on a run's card face: the composer serves Must-know first, so every card would carry it (MAIN 03:55, LK13).
  const card = item.card ? { ...item.card, importance: null } : {};
  const face = cardFace(card);
  const tag = stageTag(item, { recap });
  const src = sourceText(card);
  const step = frontStep(face.front);
  const head = (
    <CardHead card={card} onReport={onReport}>{tag ? <span className="lr-stage-tag">{tag}</span> : null}</CardHead>
  );
  return (
    <div className={`lr-card ${ncertFont.variable}`} ref={cardRef} data-size={step} data-family={kindFamily(card.kind)} data-turned={turned || undefined} data-still={still || undefined}
      onClick={(e) => { if (!turned && !e.target.closest('button, a, textarea, input, [role="menu"]')) onTurn(); }}>
      {swipe ? <SwipeLabels /> : null}
      <div className="lr-card__in">
        <section className="lr-face lr-face--front" aria-hidden={turned || undefined} inert={turned || undefined}>
          {head}
          <div className="lr-face__body">
            <Ask card={card} sci={sci} as="h2" className="lr-front" id={turned ? undefined : `lr-q-${item.id}`} />
          </div>
          {src ? <p className="lr-src"><BookOpen size={14} strokeWidth={2} aria-hidden="true" />{src}</p> : <span />}
        </section>
        <section className="lr-face lr-face--back" aria-hidden={!turned || undefined} inert={!turned || undefined} tabIndex={turned ? 0 : -1} aria-label={turned ? 'The answer' : undefined}>
          {head}
          <div className="lr-back">
            <Ask card={card} sci={sci} as="p" className="lr-back__ask" id={turned ? `lr-q-${item.id}` : undefined} />
            <div className="lr-back__rule" aria-hidden="true" />
            {sci ? <SciNcert card={card} className="lr-ncert" /> : <NcertText card={card} className="lr-ncert" />}
            <InShort card={card} />
          </div>
          {/* R4 ui-correctness#20: the source is pinned to the card's foot on the back too; the words sit centred above it. */}
          {src ? <p className="lr-src lr-src--back"><BookOpen size={14} strokeWidth={2} aria-hidden="true" />{src}</p> : <span />}
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the lesson (A4 3.3.9)

export function LessonItem({ item, cardRef }) {
  const m = Number(item.lesson?.minutes) || null;
  return (
    <div className="lr-card lr-card--lesson" ref={cardRef} data-size={frontStep(item.lesson?.title)}>
      <div className="lr-card__in">
        <section className="lr-face lr-face--front">
          <div className="kc-head"><span className="kc-kind">{m ? `Lesson, ${m} min` : 'Lesson'}</span></div>
          <div className="lr-face__body">
            <h2 className="lr-front" id={`lr-q-${item.id}`}>{item.lesson?.title || 'This chapter’s lesson'}</h2>
            <p className="lr-lesson__line">Read this first. Its cards come next.</p>
          </div>
          <span />
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the question, on the page (A4 3.3.6, A1 3.5)

/** "Fixed." or "Right this time.": the check draws in, Mobi nods once (A4 3.3.6, BUILD 1.8). */
function FixedVerdict({ text }) {
  const [mobi, setMobi] = useState(true);
  useEffect(() => { const t = setTimeout(() => setMobi(false), 900); return () => clearTimeout(t); }, []);
  const m = String(text || 'Fixed.').match(/^(.+?\.)\s*(.*)$/);
  return (
    <p className="lr-verdict__line lr-fixed">
      <svg className="lr-fixed__check" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M20 6 9 17l-5-5" pathLength="1" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span><b>{m ? m[1] : text}</b>{m && m[2] ? ` ${m[2]}` : ''}</span>
      <span className="lr-fixed__mobi" data-gone={mobi ? undefined : ''} aria-hidden="true"><MobiReact act="nod" size={40} /></span>
    </p>
  );
}

function LinePanel({ line, back, sci = false }) {
  return (
    <section className={`lr-line ${ncertFont.variable}`} aria-label="The line you needed">
      <div className="lr-line__head">
        <h3 className="lr-line__title">The line you needed</h3>
        <span className="lr-line__kind">{cardFace(line).label}</span>
      </div>
      <ClampLine>{sci ? <SciNcert card={line} className="lr-ncert lr-ncert--line" /> : <NcertText card={line} className="lr-ncert lr-ncert--line" />}</ClampLine>
      {sourceText(line) ? <p className="lr-src">{sourceText(line)}</p> : null}
      {back ? <p className="lr-line__back">You&apos;ll see this card again later in this session.</p> : null}
    </section>
  );
}

/**
 * A question on the page. `hint` (WORDS.pickHint) shows once per student, on the first question they ever see, as a quiet line
 * above the options (R4 owner-eye#15, first-timer#12): read before the options, never under Skip.
 */
export function QuestionItem({ item, state, streak, cardRef, onPick, onSeePro, place = '', hint = null, sci = false }) {
  const result = state?.result || null;
  const picked = state?.choice ?? null;
  const skipped = state?.status === 'skipped';
  const sending = state?.status === 'sending';
  const [why, setWhy] = useState(false);
  const [lineOpen, setLineOpen] = useState(false);
  const q = item.question || {};
  const mistake = item.origin === 'mistake' ? item.mistake || null : null;
  const head = mistake ? (mistake.label || `You missed this${mistake.where ? ` in ${mistake.where}` : ''}${mistake.when ? ` on ${mistake.when}` : ''}`) : 'Question';
  const fixedText = result?.correct && (result.fixedText || (result.fixed ? 'Fixed.' : null));
  const line = result?.line && !result.line.locked ? result.line.card || null : null;
  const locked = result?.line?.locked ? result.line.text || null : null;
  const options = q.options || [];
  const twoCols = options.length >= 2 && options.length <= 4 && options.every((o) => optionText(o).length <= 28);
  const lineShown = Boolean(line && (!result?.correct || lineOpen));
  const explanation = String(result?.explanation || '').trim();
  return (
    <div className="lr-q" ref={cardRef} data-answered={result ? '' : undefined}>
      <h2 className="lr-q__head" id={`lr-q-${item.id}`} data-mistake={mistake ? '' : undefined}>
        {mistake ? <History size={14} strokeWidth={2.2} aria-hidden="true" /> : null}{head}{place ? <span className="sr-only">, {place}</span> : null}
      </h2>
      <div className="lr-stemwrap"><Stem text={q.body} /></div>
      {hint && !result ? <p className="lr-q__hint">{hint}</p> : null}
      <div className="lr-opts" role="group" aria-label="Choose one answer" data-cols={twoCols ? '2' : undefined}>
        {options.map((o) => {
          const isKey = result && o.key === result.key;
          const isMine = picked === o.key;
          const st = result ? (isKey && isMine ? 'right' : isKey ? 'key' : isMine ? 'wrong' : 'rest') : isMine && sending ? 'sending' : null;
          const locks = Boolean(result) || sending || skipped;
          return (
            <button key={o.key} type="button" className="lr-opt" data-state={st || undefined} aria-disabled={locks || undefined}
              aria-pressed={isMine || undefined} onClick={() => { if (!locks) onPick(o.key); }}>
              <span className="lr-opt__letter" aria-hidden="true">{o.key}</span>
              <span className="lr-opt__text"><span className="sr-only">Option {o.key}. </span>{optionText(o)}</span>
              <span className="lr-opt__mark" aria-hidden="true">
                {st === 'right' || st === 'key' ? <Check size={18} strokeWidth={2.6} /> : st === 'wrong' ? <X size={18} strokeWidth={2.6} /> : st === 'sending' ? <LoaderCircle className="kc-spin" size={16} strokeWidth={2.2} /> : null}
              </span>
            </button>
          );
        })}
      </div>
      {state?.status === 'failed' ? <p className="lr-q__fail" role="alert">That answer wasn&apos;t saved. Try again.</p> : null}
      {result ? (
        <div className="lr-verdict" data-correct={result.correct || undefined}>
          {fixedText ? <FixedVerdict text={fixedText} /> : result.correct ? (
            <p className="lr-verdict__line"><Check size={18} strokeWidth={2.6} aria-hidden="true" /><span><b>{rightLine(streak)}</b>{firstLine(explanation) ? ` ${firstLine(explanation)}` : ''}</span></p>
          ) : (
            <p className="lr-verdict__line"><X size={18} strokeWidth={2.6} aria-hidden="true" /><span><b>Not quite. The answer is {result.key}.</b></span></p>
          )}
          {!result.correct && locked ? (
            <p className="lr-locked">{locked} <button type="button" className="lr-textkey" onClick={onSeePro}>See Pro</button></p>
          ) : null}
          <div className="lr-fold" data-open={lineShown || undefined}>
            <div className="lr-fold__in">{line ? <LinePanel line={line} back={Boolean(result.reinsert)} sci={sci} /> : null}</div>
          </div>
          {result.correct && line ? (
            <button type="button" className="lr-textkey lr-textkey--fold" aria-expanded={lineOpen} onClick={() => setLineOpen((o) => !o)}>
              See the line<ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" data-open={lineOpen || undefined} />
            </button>
          ) : null}
          {!result.correct && explanation ? (
            line ? (
              <>
                <button type="button" className="lr-textkey lr-textkey--fold" aria-expanded={why} onClick={() => setWhy((o) => !o)}>
                  Why {result.key}<ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" data-open={why || undefined} />
                </button>
                <div className="lr-fold" data-open={why || undefined}><div className="lr-fold__in"><p className="lr-why">{explanation}</p></div></div>
              </>
            ) : <ClampedWhy text={explanation} />
          ) : null}
        </div>
      ) : null}
      {skipped ? <p className="lr-q__skip">{state.note}</p> : null}
    </div>
  );
}

/** With no line card, the explanation shows open: three lines, then More (A4 3.3.6). */
function ClampedWhy({ text }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || open) return undefined;
    const raf = requestAnimationFrame(() => setClipped(el.scrollHeight > el.clientHeight + 2));
    return () => cancelAnimationFrame(raf);
  }, [text, open]);
  return (
    <>
      <p className="lr-why lr-why--clamp" ref={ref} data-open={open || undefined}>{text}</p>
      {clipped && !open ? <button type="button" className="lr-textkey" onClick={() => setOpen(true)}>More</button> : null}
    </>
  );
}

// ---------------------------------------------------------------- Save, beside a question (A4 3.3.4)

export function SaveKey({ state, onSave, compact = false }) {
  const saved = state === 'saved';
  const label = state === 'pro' ? 'Pro' : saved ? 'Saved' : 'Save';
  return (
    <button type="button" className={`lr-rail${compact ? ' lr-rail--bar' : ''}`} data-on={saved || undefined} aria-pressed={saved} aria-busy={state === 'busy' || undefined}
      aria-label={saved ? 'Saved' : state === 'pro' ? 'Save, part of Pro' : 'Save this question'} onClick={onSave}>
      <span className="lr-rail__glyph" aria-hidden="true">{state === 'busy' ? <LoaderCircle className="kc-spin" size={20} strokeWidth={2.2} /> : <Bookmark size={22} strokeWidth={1.9} />}</span>
      <span className="lr-rail__label">{label}</span>
    </button>
  );
}
