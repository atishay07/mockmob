'use client';
// Learn v2, the run player (B-chapters 3.5 and 3.6 with DESIGN-SPEC A2, A3, A4, A11).
//   A focus page: no dock, no sidebar. The top line holds Close, the chapter, "7 of 20", a progress bar that counts only
//   finished items, and "about 6 min left". A Key card turn is Study's front (the shared card face from keycards/KeyCard),
//   Show answer (Space), then Missed / Got it / Easy (1, 2, 3); the card leaves only after the server has the rating, and Got
//   it flies into the Revise pile with the server's real return day. A question is graded on the server; a wrong answer shows
//   the line you needed and its card comes back later in the run. kind=recap: one card at a time with the answer showing,
//   nothing scheduled. kind=cards: Study in rounds of 20. The end: what happened, what moved, one lead key and three options.
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, LoaderCircle, X } from 'lucide-react';
import MobiReact from '@/components/brand/MobiReact';
import { CardHead, CardSource, InShort, NcertText, Prompt, ReportForm } from '@/components/keycards/KeyCard';
import { RATINGS, cardFace } from '@/components/keycards/kinds';
import { ncertFont } from '@/components/keycards/ncertFont';
import { isMotionReduced } from '@/lib/motion';
import { answerItem, rateItem, runEnd, startRun } from '../api';
import { useLearnLinks } from '../links';
import RunEnd from './RunEnd';
import { FLIGHT, firstLine, minutesLeftLine, optionText, pipGroups, reinsertAt, stemParts, upNextLine } from './runMath';
import '@/components/keycards/keycards.css';
import './run.css';

const typing = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
const LIMIT_LINE = "Today's 10 free card ratings are used. Your cards show without ratings; questions are free.";
const ROUND = 20;

// A11: each first-run coach line shows once, then never again (this browser; nothing that must persist is kept here).
const COACH_KEY = 'mm:learn2:coach:v1';
function readCoach() { try { return JSON.parse(localStorage.getItem(COACH_KEY) || '{}') || {}; } catch { return {}; } }
function markCoach(name) { try { const seen = readCoach(); if (!seen[name]) localStorage.setItem(COACH_KEY, JSON.stringify({ ...seen, [name]: 1 })); } catch { /* shown again next time */ } }
function useCoach(name, wanted) {
  // What this browser had seen when the player opened; a line shown in this run stays until the run ends.
  const [seen] = useState(() => (typeof window === 'undefined' ? {} : readCoach()));
  const show = Boolean(wanted && !seen[name]);
  useEffect(() => { if (show) markCoach(name); }, [show, name]);
  return show;
}

const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const FLIGHT_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

const later = (ms) => new Promise((done) => { setTimeout(done, ms); });

/**
 * A4: the card's way out after a rating the server accepted. A copy of the card (a ghost, above the whole player) makes the
 * flight, so the next card can rise into the stage while it is still in the air: lift 4 px and scale 0.96 (100 ms), then a two
 * segment arc into the Revise pile, shrinking to 0.18 and fading (320 ms; Easy 280 ms). A missed card drops and fades (260 ms).
 * Returns { handoff, landed }: `handoff` is when the next card may rise (220 ms, R1), `landed` when the flight has ended.
 */
function launch(card, pile, kind) {
  const none = { handoff: Promise.resolve(), landed: Promise.resolve() };
  if (!card || typeof card.animate !== 'function') return none;
  if (isMotionReduced()) {
    const fade = card.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'linear', fill: 'forwards' }).finished.catch(() => {});
    return { handoff: fade, landed: fade };
  }
  const root = card.closest('.lr') || document.body;
  const a = card.getBoundingClientRect();
  const ghost = card.cloneNode(true);
  ghost.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  ghost.removeAttribute('data-tap');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.classList.add('lr-ghost');
  Object.assign(ghost.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
  root.appendChild(ghost);
  card.style.visibility = 'hidden';
  const done = (anim) => anim.finished.catch(() => {}).then(() => ghost.remove());
  if (kind === 'missed' || !pile) {
    const anim = ghost.animate([
      { transform: 'none', opacity: 1 },
      { transform: 'translateY(64px) rotate(-3deg)', opacity: 0 },
    ], { duration: 260, easing: FLIGHT_EASE, fill: 'forwards' });
    return { handoff: later(160), landed: done(anim) };
  }
  const b = pile.getBoundingClientRect();
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const lift = Math.min(90, Math.abs(dy) * 0.28 + 36);
  const fly = kind === 'easy' ? 280 : 320;
  const anim = ghost.animate([
    { offset: 0, transform: 'none', opacity: 1, easing: EASE_OUT },
    { offset: 100 / (100 + fly), transform: 'translateY(-4px) scale(0.96)', opacity: 1, easing: FLIGHT_EASE },
    { offset: (100 + fly * 0.45) / (100 + fly), transform: `translate(${dx * 0.45}px, ${dy * 0.45 - lift}px) scale(0.52) rotate(3deg)`, opacity: 0.92 },
    { offset: 1, transform: `translate(${dx}px, ${dy}px) scale(0.18) rotate(6deg)`, opacity: 0 },
  ], { duration: 100 + fly, fill: 'forwards' });
  return { handoff: later(220), landed: done(anim) };
}

/** The small stacked-card glyph at the bottom right: "In Revise 4". */
function RevisePile({ count, pop, pileRef }) {
  return (
    <div className="lr-pile" aria-live="polite">
      <span className="lr-pile__glyph" ref={pileRef} aria-hidden="true"><i /><i /><i /></span>
      <span className="lr-pile__text">In Revise <b key={pop} data-pop={pop ? '' : undefined}>{count}</b></span>
    </div>
  );
}

/** Progress (B 3.5): one pip per item, grouped by kind, the finished ones volt. A long Study run falls back to a bar. */
function Progress({ items, total, done }) {
  const groups = pipGroups(items);
  const label = { role: 'progressbar', 'aria-label': 'Finished in this run', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': done };
  if (!groups) {
    const share = total ? Math.min(1, done / total) : 0;
    return <div className="lr-bar" {...label}><span style={{ transform: `scaleX(${share})` }} /></div>;
  }
  return (
    <div className="lr-pips" {...label}>
      {groups.map((g) => (
        <span key={`${g.from}-${g.type}`} className="lr-pips__group" data-kind={g.type} style={{ flexGrow: g.to - g.from + 1 }}>
          {Array.from({ length: g.to - g.from + 1 }, (_, k) => <i key={k} data-done={g.from + k < done || undefined} />)}
        </span>
      ))}
    </div>
  );
}

function TopLine({ closeHref, title, position, total, done, left, items, upNext }) {
  return (
    <header className="lr-top">
      <div className="lr-top__in">
        <div className="lr-top__row">
          <Link href={closeHref} className="lr-close"><X size={18} strokeWidth={2.2} aria-hidden="true" />Close</Link>
          <p className="lr-top__title">{title}</p>
          <p className="lr-top__pos">{position ? <><b>{position}</b> of {total}</> : null}</p>
        </div>
        <div className="lr-top__row lr-top__row--bar">
          <Progress items={items} total={total} done={done} />
          <p className="lr-top__left">{left || ''}</p>
        </div>
        {upNext !== undefined ? <p className="lr-next">{upNext || ' '}</p> : null}
      </div>
    </header>
  );
}

/** A Key card: Study's front; a tap anywhere on it (or Space, or the Show answer key) shows NCERT's words. */
function CardTurn({ item, revealed, recap, cardRef, coachFront, onReveal, onReport, report }) {
  const card = item.card;
  // A recap schedules nothing, so "Due today" would mean nothing there (R7).
  const tag = recap ? null : item.again ? 'Back from earlier' : item.stage === 'due' ? 'Due today' : null;
  return (
    <div className="lr-card kc-play__card" ref={cardRef} data-tap={revealed ? undefined : ''} data-revealed={revealed || undefined}
      onClick={(e) => { if (!revealed && !report && !e.target.closest('button, a, textarea, input, [role="menu"]')) onReveal(); }}>
      <CardHead card={card} onReport={onReport}>{tag ? <span className="lr-stage-tag">{tag}</span> : null}</CardHead>
      <Prompt card={card} as="h2" className="kc-play__prompt" id={`lr-q-${item.id}`} />
      {revealed ? (
        <div className="kc-play__answer lr-answer">
          <NcertText card={card} />
          <CardSource card={card} />
          <InShort card={card} />
        </div>
      ) : <div className="lr-rule" aria-hidden="true" />}
      {report}
      {!revealed && coachFront ? <p className="lr-coach">Say the answer in your head, then show it.</p> : null}
    </div>
  );
}

/** A stem that lists its steps inline shows them as a list (R2); any other stem is one paragraph. */
function Stem({ q, id }) {
  const parts = stemParts(q.body);
  const long = String(parts ? parts.lead : q.body || '').length > 200;
  if (!parts) return <h2 className="lr-q__stem" id={id} tabIndex={-1} data-long={long || undefined}>{q.body}</h2>;
  return (
    <div className="lr-q__stem lr-q__stem--steps" id={id} tabIndex={-1} role="heading" aria-level={2} data-long={long || undefined}>
      {parts.lead ? <p className="lr-q__lead">{parts.lead}</p> : null}
      <ol className="lr-steps">
        {parts.steps.map((x) => <li key={x.label}><span className="lr-steps__label">({x.label})</span><span>{x.text}</span></li>)}
      </ol>
      {parts.tail ? <p className="lr-q__ask">{parts.tail}</p> : null}
    </div>
  );
}

/** R4: fixing a mistake from a mock is the run's best moment. The check draws in, "Fixed." in the success ink, Mobi nods once. */
function FixedLine() {
  const [mobi, setMobi] = useState(true);
  useEffect(() => { const t = setTimeout(() => setMobi(false), 900); return () => clearTimeout(t); }, []);
  return (
    <p className="lr-verdict__line lr-fixed">
      <svg className="lr-fixed__check" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M20 6 9 17l-5-5" pathLength="1" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="lr-fixed__text"><b>Fixed.</b> You got it right this time.</span>
      <span className="lr-fixed__mobi" data-gone={mobi ? undefined : ''} aria-hidden="true"><MobiReact act="nod" size={40} /></span>
    </p>
  );
}

/** A question turn, on the same card face as the feed: options lock on the first tap; the server grades it. */
function QuestionTurn({ item, state, cardRef, onPick, onRetry }) {
  const result = state?.result;
  const picked = state?.choice ?? null;
  const [more, setMore] = useState(false);
  const [clipped, setClipped] = useState(false);
  const [lineOpen, setLineOpen] = useState(false);
  const why = useRef(null);
  const box = useRef(null);
  useEffect(() => {
    const el = why.current;
    if (!el || more) return;
    setClipped(el.scrollHeight > el.clientHeight + 2);
  }, [result, more]);
  // R3: when the verdict lands below the keys, scroll so the student's own pick is the top row in view.
  useEffect(() => {
    if (!result) return undefined;
    const raf = requestAnimationFrame(() => {
      const root = box.current;
      const scroller = root?.closest('.lr');
      const mine = root?.querySelector('.lr-opt[aria-pressed="true"]');
      const verdict = root?.querySelector('.lr-verdict');
      if (!scroller || !mine || !verdict) return;
      const dock = scroller.querySelector('.lr-dock');
      const limit = dock ? dock.getBoundingClientRect().top : window.innerHeight;
      if (verdict.getBoundingClientRect().top + 72 <= limit) return;
      const top = scroller.querySelector('.lr-top');
      const y = mine.getBoundingClientRect().top - (top ? top.getBoundingClientRect().bottom : 0) - 12;
      if (y > 0) scroller.scrollBy({ top: y, behavior: isMotionReduced() ? 'auto' : 'smooth' });
    });
    return () => cancelAnimationFrame(raf);
  }, [result]);
  const setRefs = useCallback((el) => { box.current = el; if (cardRef) cardRef.current = el; }, [cardRef]);
  const q = item.question;
  const mistake = item.mistake || null;
  const kindLine = item.origin === 'mistake' && mistake ? `You missed this in ${mistake.where}${mistake.when ? ` on ${mistake.when}` : ''}` : 'Question';
  const fixed = result?.correct && (result.fixed || item.origin === 'mistake');
  const line = result?.line?.locked ? null : result?.line?.card || null;
  const lockedLine = result?.line?.locked ? result.line.text : null;
  const showLine = line && (!result.correct || lineOpen);
  return (
    <div className="lr-q kc-play__card" ref={setRefs} data-qid={q.id}>
      <p className="lr-q__kind" data-mistake={item.origin === 'mistake' || undefined}>{kindLine}</p>
      <Stem q={q} id={`lr-q-${item.id}`} />
      <ul className="lr-opts">
        {(q.options || []).map((o) => {
          const isKey = result && o.key === result.key;
          const isMine = picked === o.key;
          const st = result ? (isKey ? 'key' : isMine ? 'mine' : 'rest') : isMine ? 'picked' : null;
          return (
            <li key={o.key}>
              <button type="button" className="lr-opt" data-state={st || undefined} disabled={Boolean(picked)} aria-pressed={isMine || undefined} onClick={() => onPick(o.key)}>
                <span className="lr-opt__letter" aria-hidden="true">{o.key}</span>
                <span className="lr-opt__text"><span className="sr-only">Option {o.key}. </span>{optionText(o)}</span>
                {st === 'key' ? <Check className="lr-opt__mark" size={18} strokeWidth={2.4} aria-label="The answer" /> : null}
                {st === 'mine' ? <X className="lr-opt__mark" size={18} strokeWidth={2.4} aria-label="Your answer" /> : null}
                {st === 'picked' && state?.status === 'sending' ? <LoaderCircle className="lr-opt__mark kc-spin" size={16} strokeWidth={2.2} aria-label="Checking" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {state?.status === 'failed' ? (
        <div className="lr-fail" role="alert">
          <p className="kc-err">Your answer did not reach us. Try again.</p>
          <button type="button" className="kc-btn kc-btn--line kc-btn--small" onClick={onRetry}>Try again</button>
        </div>
      ) : null}
      {result ? (
        <div className="lr-verdict" role="status" data-correct={result.correct || undefined}>
          {fixed ? <FixedLine /> : result.correct ? (
            <p className="lr-verdict__line"><Check size={18} strokeWidth={2.4} aria-hidden="true" />Right.{firstLine(result.explanation) ? <span> {firstLine(result.explanation)}</span> : null}</p>
          ) : (
            <p className="lr-verdict__line"><X size={18} strokeWidth={2.4} aria-hidden="true" />Not quite. The answer is {result.key}.</p>
          )}
          {!result.correct && result.explanation ? (
            <>
              <p className="lr-why" ref={why} data-open={more || undefined}>{result.explanation}</p>
              {clipped && !more ? <button type="button" className="lr-more" onClick={() => setMore(true)}>More</button> : null}
            </>
          ) : null}
          {result.correct && line ? (
            <button type="button" className="lr-more lr-more--line" aria-expanded={lineOpen} onClick={() => setLineOpen((o) => !o)}>
              See the line<ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" data-open={lineOpen || undefined} />
            </button>
          ) : null}
        </div>
      ) : null}
      {lockedLine && !result.correct ? <p className="kc-fine lr-locked">{lockedLine}</p> : null}
      {showLine ? (
        <section className={`lr-line kc-line ${ncertFont.variable}`} aria-label="The line you needed">
          <div className="kc-line__head">
            <h3 className="kc-line__title">The line you needed</h3>
            <span className="kc-line__src">{cardFace(line).label}{line.importance === 'must' ? ', Must-know' : ''}</span>
          </div>
          <NcertText card={line} className="kc-ncert--compact" />
          <CardSource card={line} />
          {result.reinsert ? <p className="lr-line__back">This card comes back later in this run.</p> : null}
        </section>
      ) : null}
    </div>
  );
}

function LessonTurn({ item, href, cardRef }) {
  return (
    <div className="lr-card lr-card--lesson kc-play__card" ref={cardRef}>
      <p className="kc-kind">Lesson, {item.lesson.minutes} min</p>
      <h2 className="kc-play__prompt" id={`lr-q-${item.id}`}>{item.lesson.title}</h2>
      <p className="kc-fine">Read it first; its cards follow in this run.</p>
      <Link className="kc-btn kc-btn--line" href={href}>Open the lesson</Link>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="lr-skel" aria-busy="true" aria-label="Lining up your run">
      <span className="skeleton lr-skel__top" />
      <span className="skeleton lr-skel__bar" />
      <span className="skeleton lr-skel__card" />
      <span className="skeleton lr-skel__key" />
    </div>
  );
}

function useBodyLock() {
  useEffect(() => {
    const html = document.documentElement;
    const was = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => { html.style.overflow = was; };
  }, []);
}

/** Pointer swipe for the recap: the card follows the finger 1:1; past 72 px it commits. */
function useSwipe(onPrev, onNext, enabled) {
  const s = useRef(null);
  const [dx, setDx] = useState(0);
  const handlers = enabled ? {
    onPointerDown(e) { if (e.pointerType === 'mouse' && e.button !== 0) return; if (e.target.closest('button, a')) return; s.current = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, lock: null }; },
    onPointerMove(e) {
      const st = s.current; if (!st || st.id !== e.pointerId) return;
      const mx = e.clientX - st.x; const my = e.clientY - st.y;
      if (!st.lock) { if (Math.abs(mx) < 8 && Math.abs(my) < 8) return; st.lock = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'; if (st.lock === 'x') e.currentTarget.setPointerCapture?.(e.pointerId); }
      if (st.lock === 'x') setDx(mx);
    },
    onPointerUp(e) {
      const st = s.current; s.current = null; if (!st || st.lock !== 'x') { setDx(0); return; }
      const mx = e.clientX - st.x; const v = Math.abs(mx) / Math.max(1, performance.now() - st.t);
      setDx(0);
      if (mx < -72 || (mx < -24 && v > 0.7)) onNext(); else if (mx > 72 || (mx > 24 && v > 0.7)) onPrev();
    },
    onPointerCancel() { s.current = null; setDx(0); },
  } : {};
  return { dx, handlers };
}

// The player is a focus page above the whole shell (no top bar, no dock), so it renders into the body, outside the shell's
// stacking contexts. The shell's tokens live on <html>, so Night and Day still apply.
const noop = () => () => {};
export default function RunPlayer(props) {
  const client = useSyncExternalStore(noop, () => true, () => false);
  return client ? createPortal(<Player {...props} />, document.body) : null;
}

function Player({ chapterKey, minutes = 10, kind = 'mix', leaveOut = [], cardIds = null }) {
  useBodyLock();
  const links = useLearnLinks();
  const [params, setParams] = useState(() => ({ chapterKey, minutes, kind, leaveOut, cardIds: cardIds?.length ? cardIds : null }));
  const [load, setLoad] = useState({ status: 'loading', error: null });
  const [run, setRun] = useState(null);
  const [items, setItems] = useState([]);
  const [at, setAt] = useState(0);
  const [phase, setPhase] = useState('play'); // play | round | recapEnd | end
  const [pile, setPile] = useState(0);
  const [pop, setPop] = useState(0);
  const [stamp, setStamp] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState(null);
  const [answers, setAnswers] = useState({});
  const [revealed, setRevealed] = useState({});
  const [reporting, setReporting] = useState(null);
  const [tally, setTally] = useState({ missed: 0, got: 0, easy: 0, right: 0, wrong: 0 });
  const [end, setEnd] = useState({ status: 'idle', data: null });
  const [leaving, setLeaving] = useState(false);
  const cardRef = useRef(null);
  const pileRef = useRef(null);
  const stage = useRef(null);
  const flying = useRef(false);
  const stampTimer = useRef(null);
  const nextKey = useRef(null);
  const pileNow = useRef(0);
  const [round, setRound] = useState(0);

  const isRecap = run?.kind === 'recap' || params.kind === 'recap';
  const begin = useCallback(async (p) => {
    setLoad({ status: 'loading', error: null });
    setRun(null); setItems([]); setAt(0); setPhase('play'); setAnswers({}); setRevealed({}); setLimit(null); setError(null); setBusy(null);
    setTally({ missed: 0, got: 0, easy: 0, right: 0, wrong: 0 }); setEnd({ status: 'idle', data: null }); setRound(0);
    try {
      const data = await startRun({ chapterKey: p.chapterKey, cardIds: p.cardIds || undefined, minutes: p.minutes, leaveOut: p.leaveOut, kind: p.kind });
      setRun(data);
      setItems(Array.isArray(data?.items) ? data.items : []);
      setPile(Number(data?.revisePile?.count) || 0);
      pileNow.current = Number(data?.revisePile?.count) || 0;
      if (data?.looks?.text) setLimit(data.looks.text);
      setLoad({ status: 'ready', error: null });
    } catch (e) {
      setLoad({ status: 'error', error: e });
    }
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- the run is read once per set of params
  useEffect(() => { begin(params); }, [params]);

  const item = items[at] || null;
  const answerState = item ? answers[item.id] : null;
  const answered = Boolean(answerState?.result);
  const finished = phase === 'play' ? at + (item?.type === 'question' && answered ? 1 : 0) : items.length;
  const chapterTitle = run?.chapter?.title || '';
  const closeHref = links.chapter(params.chapterKey || run?.chapter?.key, params.minutes);
  const look = Boolean(item?.look || (limit && item?.type === 'card'));
  // A11: the coach lines belong to the run's first card and its first wrong answer only.
  const isRevealed = Boolean(item && revealed[item.id]);
  const onFirstCard = phase === 'play' && !isRecap && at === items.findIndex((x) => x.type === 'card' && !x.look);
  const coachFront = useCoach('front', onFirstCard && !isRevealed);
  const coachRate = useCoach('rate', onFirstCard && isRevealed);

  const reveal = useCallback(() => { if (item && !flying.current) setRevealed((r) => ({ ...r, [item.id]: true })); }, [item]);

  const showStamp = useCallback((text) => {
    if (!text) return;
    clearTimeout(stampTimer.current);
    setStamp({ text, n: Date.now() });
    stampTimer.current = setTimeout(() => setStamp(null), isMotionReduced() ? 1500 : 900 + 220);
  }, []);
  useEffect(() => () => clearTimeout(stampTimer.current), []);

  const finish = useCallback(async () => {
    if (isRecap) { setPhase('recapEnd'); return; }
    setPhase('end');
    setEnd({ status: 'loading', data: null });
    try { setEnd({ status: 'ready', data: await runEnd(run.id) }); } catch (e) { setEnd({ status: 'error', data: null, error: e }); }
  }, [isRecap, run]);

  // The list as last rendered: an advance that follows an await sees a card re-inserted meanwhile.
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  const advance = useCallback(() => {
    setBusy(null); setError(null); setReporting(null);
    const items = itemsRef.current;
    const next = at + 1;
    if (next >= items.length) { finish(); return; }
    if (run?.kind === 'cards' && items[at]?.type === 'card') {
      const ratedCards = items.slice(0, next).filter((x) => x.type === 'card').length;
      if (ratedCards % ROUND === 0 && items.slice(next).some((x) => x.type === 'card')) { setRound(ratedCards / ROUND); setAt(next); setPhase('round'); return; }
    }
    setAt(next);
  }, [at, finish, run]);

  // Focus follows the item, so a keyboard or screen reader student lands on the new one.
  useEffect(() => {
    if (phase !== 'play' || !item) return;
    const el = document.getElementById(`lr-q-${item.id}`);
    el?.focus?.({ preventScroll: true });
    stage.current?.closest('.lr')?.scrollTo?.({ top: 0 });
  }, [at, phase, item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // The Next key takes focus once a question is answered, without pulling the page away from the verdict (R3).
  useEffect(() => { if (answered) nextKey.current?.focus({ preventScroll: true }); }, [answered, item?.id]);

  const insertAfter = useCallback((copy, where) => {
    setItems((list) => {
      if (list.some((x) => x.id === copy.id)) return list;
      const i = reinsertAt(list.length, at, where);
      return [...list.slice(0, i), copy, ...list.slice(i)];
    });
  }, [at]);

  const rate = useCallback(async (rating) => {
    if (!item || busy || flying.current || leaving) return;
    setBusy(rating); setError(null);
    let res;
    try {
      res = await rateItem(run.id, { itemId: item.id, rating });
      if (!res?.ok) throw new Error('unconfirmed');
    } catch (e) {
      if (e?.status === 402) { setLimit(e.data?.limit?.text || LIMIT_LINE); setBusy(null); return; }
      setError('That rating was not saved. Try again.'); setBusy(null); return;
    }
    flying.current = true;
    setLeaving(true);
    setBusy(null);
    const kindOf = FLIGHT[rating] || 'got';
    setTally((t) => ({ ...t, [kindOf]: t[kindOf] + 1 }));
    if (res.limit?.text) setLimit(res.limit.text);
    // A missed card comes back once, 3 items later (B 4.3 rule 4): the server places it in its list and says where.
    if (res.reinsert?.itemId) insertAfter({ ...(res.reinsert.item || item), id: res.reinsert.itemId, stage: 'again', again: true }, res.reinsert.at);
    showStamp(res.stamp);
    // A rating the server could not count (Free's 11th) finishes the card as a look: it slides away, no flight.
    const flight = launch(cardRef.current, pileRef.current, res.look ? 'missed' : kindOf);
    const nextCount = Number(res.revisePile?.count);
    // The pile ticks when the flight lands, with a 1.12 pop (R1); the next card has been rising since the handoff.
    flight.landed.then(() => {
      if (!Number.isFinite(nextCount) || nextCount === pileNow.current) return;
      pileNow.current = nextCount;
      setPile(nextCount);
      if (!isMotionReduced()) setPop((p) => p + 1);
    });
    await flight.handoff;
    flying.current = false;
    setLeaving(false);
    advance();
  }, [item, busy, leaving, run, insertAfter, showStamp, advance]);

  // A look (a recap card, or a card past Free's ratings) is logged without a schedule; the run does not wait for it.
  const logLook = useCallback((it) => { if (run?.id && it?.id) rateItem(run.id, { itemId: it.id, rating: 3 }).catch(() => {}); }, [run]);
  const lookNext = useCallback(async () => {
    if (flying.current) return;
    logLook(item);
    flying.current = true; setLeaving(true);
    await launch(cardRef.current, null, 'missed').handoff;
    flying.current = false; setLeaving(false);
    advance();
  }, [advance, logLook, item]);

  const pick = useCallback(async (choice) => {
    if (!item || item.type !== 'question') return;
    const prior = answers[item.id];
    if (prior?.status === 'sending' || prior?.result) return;
    setAnswers((a) => ({ ...a, [item.id]: { choice, status: 'sending' } }));
    try {
      const res = await answerItem(run.id, { itemId: item.id, choice });
      setAnswers((a) => ({ ...a, [item.id]: { choice, status: 'done', result: res } }));
      setTally((t) => ({ ...t, [res.correct ? 'right' : 'wrong']: t[res.correct ? 'right' : 'wrong'] + 1 }));
      if (res.reinsert?.itemId) insertAfter({ type: 'card', card: res.line?.card, ...(res.reinsert.item || {}), id: res.reinsert.itemId, stage: 'again', again: true }, res.reinsert.at);
    } catch {
      setAnswers((a) => ({ ...a, [item.id]: { choice, status: 'failed' } }));
    }
  }, [item, answers, run, insertAfter]);

  const retry = useCallback(() => {
    const prior = item && answers[item.id];
    if (!prior) return;
    setAnswers((a) => { const n = { ...a }; delete n[item.id]; return n; });
    setTimeout(() => pick(prior.choice), 0);
  }, [item, answers, pick]);

  const goRecap = useCallback((step) => {
    if (step > 0) { logLook(items[at]); if (at + 1 >= items.length) setPhase('recapEnd'); else setAt(at + 1); }
    else if (at > 0) setAt(at - 1);
  }, [at, items, logLook]);

  // Keys: 1, 2, 3 rate a revealed card; A-D (or 1-4) answer a question; Enter goes on; arrows move a recap.
  useEffect(() => {
    if (phase !== 'play' || !item) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || reporting) return;
      if (isRecap) {
        if (e.key === 'ArrowRight' || (e.key === 'Enter' && e.target?.tagName !== 'BUTTON' && e.target?.tagName !== 'A')) { e.preventDefault(); goRecap(1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); goRecap(-1); }
        return;
      }
      if (item.type === 'card' && !isRevealed) {
        if (e.key === ' ' || (e.key === 'Enter' && e.target?.tagName !== 'BUTTON' && e.target?.tagName !== 'A')) { e.preventDefault(); reveal(); }
        return;
      }
      if (item.type === 'card' && isRevealed) {
        if (look) { if (e.key === 'Enter' && e.target?.tagName !== 'BUTTON') { e.preventDefault(); lookNext(); } return; }
        const r = RATINGS.find((x) => x.key === e.key);
        if (r) { e.preventDefault(); rate(r.rating); }
        return;
      }
      if (item.type === 'question') {
        if (answered && e.key === 'Enter' && e.target?.tagName !== 'BUTTON' && e.target?.tagName !== 'A') { e.preventDefault(); advance(); return; }
        if (!answered && !answerState) {
          const k = e.key.toUpperCase();
          const byNumber = /^[1-6]$/.test(k) ? item.question.options?.[Number(k) - 1]?.key : null;
          const choice = byNumber || item.question.options?.find((o) => o.key === k)?.key;
          if (choice) { e.preventDefault(); pick(choice); }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const swipe = useSwipe(() => goRecap(-1), () => goRecap(1), isRecap && phase === 'play');

  const left = phase === 'play' ? minutesLeftLine(items, finished, run?.kind) : null;
  const upNext = phase === 'play' && !isRecap ? upNextLine(items, at) : null;

  if (load.status === 'loading') return <div className={`lr kc ${ncertFont.variable}`}><div className="lr-col"><Skeleton /></div></div>;
  if (load.status === 'error' || !run) {
    return (
      <div className={`lr kc ${ncertFont.variable}`}>
        <div className="lr-col">
          <div className="kc-quiet-state lr-state" role="alert">
            <h1>This run did not start</h1>
            <p>Nothing was lost. Check your connection and try again.</p>
            <div className="lr-state__keys">
              <button type="button" className="kc-btn kc-btn--volt" onClick={() => begin(params)}>Try again</button>
              <Link className="kc-btn kc-btn--quiet" href={closeHref}>Back to the chapter</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (!items.length) {
    return (
      <div className={`lr kc ${ncertFont.variable}`}>
        <div className="lr-col">
          <div className="kc-quiet-state lr-state">
            <h1>Nothing to line up here yet</h1>
            <p>This chapter has no cards or questions for this run.</p>
            <Link className="kc-btn kc-btn--line" href={closeHref}>Back to the chapter</Link>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'end') {
    return (
      <div className={`lr kc ${ncertFont.variable}`} data-phase="end">
        <div className="lr-col lr-col--end">
          <RunEnd state={end} tally={tally} kind={run.kind} closeHref={closeHref} links={links} onRetry={finish} />
        </div>
      </div>
    );
  }

  if (phase === 'recapEnd') {
    const ids = items.map((x) => x.card?.id).filter(Boolean);
    return (
      <div className={`lr kc ${ncertFont.variable}`} data-phase="end">
        <div className="lr-col lr-col--end">
          <section className="lr-recapend" aria-labelledby="lr-recapend-h">
            <h1 id="lr-recapend-h" className="lr-end__title">That was every Must-know card.</h1>
            <p className="kc-end__line">{ids.length} {ids.length === 1 ? 'card' : 'cards'}, nothing scheduled.</p>
            <div className="lr-recapend__keys">
              <button type="button" className="kc-btn kc-btn--volt" data-page-primary="" onClick={() => setParams({ chapterKey: params.chapterKey, cardIds: ids, minutes: Math.max(5, Math.ceil((ids.length * 15 * 1.1) / 60)), leaveOut: [], kind: 'cards' })}>Study these {ids.length}</button>
              <button type="button" className="kc-btn kc-btn--line" onClick={() => { setAt(0); setPhase('play'); }}>Quick recap again</button>
            </div>
            <Link className="kc-btn kc-btn--quiet lr-end__back" href={closeHref}>Back to the chapter</Link>
          </section>
        </div>
      </div>
    );
  }

  if (phase === 'round') {
    const leftCards = items.slice(at).filter((x) => x.type === 'card').length;
    return (
      <div className={`lr kc ${ncertFont.variable}`}>
        <div className="lr-col">
          <TopLine closeHref={closeHref} title={chapterTitle} position={null} total={items.length} done={at} left={minutesLeftLine(items, at, run.kind)} items={items} />
          <section className="lr-round" aria-labelledby="lr-round-h">
            <p className="kc-kind">Round {round} done</p>
            <h1 id="lr-round-h" className="lr-end__title">{ROUND} cards rated. {leftCards} more {leftCards === 1 ? 'is' : 'are'} lined up.</h1>
            <div className="lr-recapend__keys">
              <button type="button" className="kc-btn kc-btn--volt" autoFocus onClick={() => setPhase('play')}>Next round</button>
              <button type="button" className="kc-btn kc-btn--line" onClick={finish}>Finish here</button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // The play view
  const showKeys = item.type === 'card' && !isRecap && isRevealed;
  const recapCard = isRecap && item.type === 'card';
  const keysKind = recapCard ? 'two' : item.type === 'card' && showKeys && !look ? 'rate' : item.type === 'question' && !answered ? 'hint' : 'wide';
  // Under the keys, one line at a time: the stamp while it shows, else the first-run coach line (R1).
  const under = stamp
    ? <span key={stamp.n} className="lr-stamp" data-stamp="">{stamp.text}</span>
    : coachRate && showKeys && !look ? <span className="lr-coach lr-coach--dock">Got it sends the card to Revise. It comes back when it is due.</span>
      : recapCard ? <span className="lr-hint--recap">Nothing here is scheduled. Swipe or use the arrow keys.</span> : null;
  return (
    <div className={`lr kc ${ncertFont.variable}`} data-kind={run.kind} data-recap={isRecap || undefined} data-leaving={leaving || undefined}>
      <TopLine closeHref={closeHref} title={chapterTitle} position={at + 1} total={items.length} done={isRecap ? at : finished} left={left} items={items} upNext={isRecap ? undefined : upNext} />
      <div className="lr-main">
        <div className="lr-col">
          <div className="lr-stage" ref={stage} data-deck="">
            <div key={item.id} data-id={item.id} className="lr-enter" style={recapCard && swipe.dx ? { transform: `translateX(${swipe.dx}px)`, transition: 'none' } : undefined} {...(recapCard ? swipe.handlers : {})}>
              {item.type === 'card' ? (
                <CardTurn item={item} revealed={isRecap || isRevealed} recap={isRecap} cardRef={cardRef} coachFront={coachFront}
                  report={reporting === item.id ? <ReportForm card={item.card} onClose={() => setReporting(null)} /> : null}
                  onReport={() => setReporting(item.id)}
                  onReveal={reveal} />
              ) : item.type === 'question' ? (
                <QuestionTurn item={item} state={answerState} cardRef={cardRef} onPick={pick} onRetry={retry} />
              ) : (
                <LessonTurn item={item} cardRef={cardRef} href={links.lesson(item.lesson?.id)} />
              )}
            </div>
          </div>
        </div>

        <div className="lr-dock">
          <div className="lr-dock__in">
            <div className="lr-keyline" data-keys={keysKind}>
              {recapCard ? (
                <div className="lr-keys lr-keys--two">
                  <button type="button" className="kc-btn kc-btn--line" onClick={() => goRecap(-1)} disabled={at === 0}>Previous</button>
                  <button type="button" className="kc-btn kc-btn--volt" data-page-primary="" onClick={() => goRecap(1)}>{at + 1 >= items.length ? 'Finish' : 'Next'}</button>
                </div>
              ) : item.type === 'card' && !showKeys ? (
                <div className="lr-keys">
                  <button type="button" className="kc-btn kc-btn--volt kc-btn--wide" data-page-primary="" disabled={leaving} onClick={reveal}>Show answer<kbd className="kc-kbd" aria-hidden="true">Space</kbd></button>
                </div>
              ) : item.type === 'card' && look ? (
                <div className="lr-keys">
                  <button type="button" className="kc-btn kc-btn--volt kc-btn--wide" data-page-primary="" disabled={leaving} onClick={lookNext}>Next<kbd className="kc-kbd" aria-hidden="true">Enter</kbd></button>
                </div>
              ) : item.type === 'card' ? (
                <div className="kc-rate lr-keys lr-keys--rate" role="group" aria-label="How well did you recall it?">
                  {RATINGS.map((r) => (
                    <button key={r.rating} type="button" className="kc-rate__btn" data-rating={r.rating} data-page-primary={r.rating === 3 ? '' : undefined} disabled={Boolean(busy) || leaving} aria-busy={busy === r.rating || undefined} onClick={() => rate(r.rating)}>
                      {busy === r.rating ? <LoaderCircle className="kc-spin" size={16} strokeWidth={2.2} aria-hidden="true" /> : null}
                      <span>{r.label}</span>
                      <kbd className="kc-kbd" aria-hidden="true">{r.key}</kbd>
                    </button>
                  ))}
                </div>
              ) : item.type === 'question' ? (
                answered ? (
                  <div className="lr-keys">
                    <button type="button" ref={nextKey} className="kc-btn kc-btn--volt kc-btn--wide" data-page-primary="" onClick={advance}>{at + 1 >= items.length ? 'Finish' : 'Next'}<kbd className="kc-kbd" aria-hidden="true">Enter</kbd></button>
                  </div>
                ) : <p className="lr-hint">{answerState?.status === 'sending' ? 'Checking your answer' : 'Tap the answer you think is right.'}</p>
              ) : (
                <div className="lr-keys">
                  <button type="button" className="kc-btn kc-btn--volt kc-btn--wide" data-page-primary="" onClick={() => { logLook(item); advance(); }}>Next</button>
                </div>
              )}
              {!isRecap ? <RevisePile count={pile} pop={pop} pileRef={pileRef} /> : null}
            </div>
            <p className="lr-under" aria-live="polite">{under}</p>
            {error ? <p className="kc-err lr-err" role="alert">{error}</p> : null}
            {item.type === 'card' && look && !item.again && !isRecap ? <p className="lr-fine-dock kc-fine">{limit || LIMIT_LINE}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
