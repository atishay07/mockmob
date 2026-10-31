'use client';
// The Explore feed v2 (docs/brain/learn-1031/FEED-2.md; DESIGN-SPEC A3, A6, A10): a full-screen vertical feed, one item per
// screen, swiped up like Reels. It stays a study tool: calm Night, volt on charcoal, the lamp-lit subject object behind.
//   Top         segmented progress ticks (one per item), the close X on the left, the chapter's real title on the right
//   Paging      native vertical scroll-snap, each item 100dvh; Arrow keys and Space on the desktop
//   Key card    the front; tap the card to turn it over (a 3D flip); the right rail keeps it (Revise) or opens the chapter
//   Question    answered in place, graded by the server (no key on the client before the answer); right fills the row volt
//               and counts the streak chip; wrong shakes the row and raises "The line you needed"
//   Checkpoint  after every 8 items, the one interstitial; it moves on only on a swipe or a key
//   End         the kept pile with its real return day, two lines, and the keys (Free: one feed a day, said in one line)
// A focus place over the whole shell (no tab row, no dock): it renders into the body; the shell's tokens live on <html>.
// Data: POST /api/learn/runs (kind 'feed'), .../answer, .../rate {keep}, GET .../end, POST /api/bookmarks (learn2/api.js).
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Bookmark, Check, LoaderCircle, X } from 'lucide-react';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { CardSource, NcertText } from '@/components/keycards/KeyCard';
import { cardFace, splitBlanks } from '@/components/keycards/kinds';
import { refreshHome } from '@/components/keycards/api';
import { ncertFont } from '@/components/keycards/ncertFont';
import { openUpgrade } from '@/components/pro/proNudgeStore';
import { CHECKPOINT_LINE, FREE_FEED_DONE, checkpointNumber, feedSlots } from '@/../data/learn/feed.js';
import { answerItem, keepItem, runEnd, saveQuestion, startRun } from '../api';
import { useLearnLinks } from '../links';
import '@/components/keycards/keycards.css';
import './feed.css';

const FLIP_HINT = 'learn2.feed2.flip.v1';
const SWIPE_HINT = 'learn2.feed2.swipe.v1';
const seen = (k) => { try { return localStorage.getItem(k) === '1'; } catch { return false; } };
const mark = (k) => { try { localStorage.setItem(k, '1'); } catch { /* shown again next time */ } };
const still = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const buzz = (p) => { try { if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(p); } catch { /* no haptics */ } };
const typing = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
const LETTERS = ['A', 'B', 'C', 'D', 'E'];
/** The option's words without the letter some questions print in front of them ("A Sacrifice ratio"). */
const optionText = (o) => String(o.text).replace(new RegExp('^' + o.key + '[\\s.):-]+'), '');

function Front({ card }) {
  return splitBlanks(cardFace(card).front).map((p, i) => (p.blank
    ? <span key={i} className="kc-gap" role="img" aria-label={`blank ${p.n}`} />
    : <span key={i}>{p.text}</span>));
}

/** The chapter's subject object behind each item: 18% opacity, softly blurred, bottom-right, bleeding off the edge. */
function Backdrop({ subject }) {
  return <span className="fx-obj" aria-hidden="true"><SubjectObject id={subject} size={220} framed={false} life={false} /></span>;
}

/** One key of the right rail: a 44 px glyph, a 12 px label under it. */
function RailKey({ icon: Icon, label, on, busy, onClick, href, pop, describedBy }) {
  const body = (
    <>
      <span className="fx-rail__glyph" data-pop={pop || undefined}>
        {busy ? <LoaderCircle className="kc-spin" size={22} strokeWidth={2} aria-hidden="true" /> : <Icon size={24} strokeWidth={1.9} fill={on ? 'currentColor' : 'none'} aria-hidden="true" />}
      </span>
      <span className="fx-rail__label">{label}</span>
    </>
  );
  if (href) return <Link className="fx-rail__key" href={href} aria-describedby={describedBy}>{body}</Link>;
  return <button type="button" className="fx-rail__key" data-on={on || undefined} aria-pressed={on} disabled={busy} onClick={onClick} aria-describedby={describedBy}>{body}</button>;
}

function CardItem({ item, st, onFlip, onKeep, chapterHref, hint }) {
  const { card } = item;
  const { label } = cardFace(card);
  const keepLabel = st.kept ? 'Kept' : st.keepPro ? 'Pro' : 'Keep';
  return (
    <>
      <div className="fx-cardwrap">
        <div className="fx-card" data-flipped={st.flipped || undefined} role="button" tabIndex={0} aria-pressed={Boolean(st.flipped)}
          aria-label={st.flipped ? `${label}. The NCERT line is showing. Tap to turn it back.` : `${label}: ${cardFace(card).front}. Tap to turn it over.`}
          onClick={(e) => { if (!e.target.closest('a, button')) onFlip(); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onFlip(); } }}>
          <div className="fx-face fx-face--front" aria-hidden={st.flipped || undefined}>
            <p className="fx-kind"><span>{label}</span>{card.importance === 'must' ? <span className="fx-must">Must-know</span> : null}</p>
            <h2 className="fx-front"><Front card={card} /></h2>
          </div>
          <div className="fx-face fx-face--back" aria-hidden={!st.flipped || undefined}>
            <p className="fx-kind"><span>{label}</span>{card.importance === 'must' ? <span className="fx-must">Must-know</span> : null}</p>
            <div className="fx-back">
              <NcertText card={card} />
              <CardSource card={card} />
            </div>
          </div>
        </div>
      </div>
      <div className="fx-rail">
        <RailKey icon={Bookmark} label={keepLabel} on={st.kept} busy={st.keeping} pop={st.kept} onClick={onKeep} />
        <RailKey icon={BookOpen} label="Chapter" href={chapterHref} />
        <span className="fx-rail__foot" aria-hidden="true" />
      </div>
      {st.stamp ? <p className="fx-stamp" role="status">{st.stamp}</p> : null}
      {hint ? <p className="fx-hint" data-show="">Tap to turn it over</p> : null}
    </>
  );
}

function QuestionItem({ item, st, onChoose, onSave, chapterHref, swipeHint, onCloseSheet }) {
  const q = item.question;
  const res = st.answer?.res;
  const chosen = st.answer?.choice;
  const mistake = item.origin === 'mistake' ? item.mistake : null;
  const line = res && !res.correct ? res.line : null;
  const keyLetter = res ? (LETTERS[q.options.findIndex((o) => o.key === res.key)] || res.key) : null;
  return (
    <>
      <div className="fx-q">
        <p className="fx-qhead">{mistake ? `You missed this in ${mistake.where} on ${mistake.when}` : 'Question'}</p>
        <h2 className="fx-stem">{q.body}</h2>
        <ul className="fx-opts" role="group" aria-label="Choose one answer">
          {q.options.map((o, i) => {
            const isChosen = chosen === o.key;
            const isRight = res && res.key === o.key;
            const state = !res ? (st.answer?.pending && isChosen ? 'pending' : undefined) : isRight ? (isChosen ? 'right' : 'key') : isChosen ? 'wrong' : 'rest';
            return (
              <li key={o.key}>
                <button type="button" className="fx-opt" data-state={state} disabled={Boolean(res) || Boolean(st.answer?.pending)} aria-pressed={isChosen || undefined} onClick={() => onChoose(o.key)}>
                  <span className="fx-opt__k" aria-hidden="true">{LETTERS[i] || o.key}</span>
                  <span className="fx-opt__t">{optionText(o)}</span>
                  <span className="fx-opt__mark" aria-hidden={state === 'pending' ? 'true' : undefined}>
                    {state === 'pending' ? <LoaderCircle className="kc-spin" size={16} strokeWidth={2.2} /> : null}
                    {state === 'right' || state === 'key' ? <Check size={18} strokeWidth={2.6} aria-label="The right answer" /> : null}
                    {state === 'wrong' ? <X size={18} strokeWidth={2.6} aria-label="Your answer" /> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {res ? <p className="fx-verdict sr-only" role="status">{res.correct ? 'Right.' : `Not quite. The answer is ${keyLetter}.`}</p> : null}
        {res?.correct && res.fixedText ? <p className="fx-fixed">{res.fixedText}</p> : null}
        {st.error ? <p className="kc-err" role="alert">{st.error}</p> : null}
      </div>
      <div className="fx-rail fx-rail--q">
        <RailKey icon={Bookmark} label={st.saved ? 'Saved' : st.savePro ? 'Pro' : 'Save'} on={st.saved} busy={st.saving} pop={st.saved} onClick={onSave} />
        <RailKey icon={BookOpen} label="Chapter" href={chapterHref} />
      </div>
      {swipeHint ? <p className="fx-hint fx-hint--swipe" data-show="">Swipe up for the next one</p> : null}
      {res && !res.correct && st.sheet ? (
        <section className="fx-sheet" aria-label={line?.card ? 'The line you needed' : 'Why'}>
          <div className="fx-sheet__head">
            <h3 className="fx-sheet__title">{line?.card ? 'The line you needed' : `The answer is ${keyLetter}`}</h3>
            <button type="button" className="fx-sheet__x" aria-label="Close" onClick={onCloseSheet}><X size={20} strokeWidth={2.2} aria-hidden="true" /></button>
          </div>
          <div className="fx-sheet__body">
            {line?.locked ? (
              <>
                <p className="fx-sheet__text">{line.text}</p>
                <button type="button" className="fx-textkey" onClick={(e) => openUpgrade({ trigger: 'keycards', opener: e.currentTarget })}>See Pro</button>
              </>
            ) : line?.card ? (
              <>
                <NcertText card={line.card} className="kc-ncert--compact" />
                <CardSource card={line.card} />
              </>
            ) : <p className="fx-sheet__text">{res.explanation || 'The key is marked above.'}</p>}
          </div>
        </section>
      ) : null}
    </>
  );
}

function Checkpoint({ number, onGo, onStop }) {
  return (
    <div className="fx-cp">
      <p className="fx-cp__n">{number}</p>
      <p className="fx-cp__line">{CHECKPOINT_LINE}</p>
      <div className="fx-cp__keys">
        <button type="button" className="kc-btn kc-btn--volt" onClick={onGo}>Keep going</button>
        <button type="button" className="kc-btn kc-btn--line" onClick={onStop}>Stop here</button>
      </div>
    </div>
  );
}

/** The kept cards as a small pile that fans open when the end comes into view. */
function KeptPile({ kept, open }) {
  const cards = kept.cards || [];
  const n = kept.count || 0;
  if (!n) return <p className="fx-end__none">Nothing kept this time. Keep a card and it comes back in Revise.</p>;
  const shown = cards.slice(0, 4);
  const mid = (shown.length - 1) / 2;
  const back = kept.stamp || (kept.groups || []).map((g) => `${g.count} ${g.label}`).join(', ');
  return (
    <div className="fx-pile">
      <div className="fx-pile__fan" data-open={open || undefined} aria-hidden="true">
        {shown.map((c, i) => (
          <span key={c.id} className="fx-pile__card" style={{ '--r': `${(i - mid) * 7}deg`, '--x': `${(i - mid) * 26}px`, '--d': `${i * 40}ms`, zIndex: i }}>
            <span className="fx-pile__k">{cardFace(c).label}</span>
            {i === shown.length - 1 ? <span className="fx-pile__f">{cardFace(c).front}</span> : <span className="fx-pile__lines"><i /><i /><i /></span>}
          </span>
        ))}
      </div>
      <p className="fx-pile__count"><b>{n} kept</b>{back ? <span>{back}</span> : null}</p>
    </div>
  );
}

function EndScreen({ end, open, links, onAgain, again }) {
  const f = end.feed || {};
  const next = f.next;
  return (
    <div className="fx-end">
      <h2 className="fx-end__title" id="fx-end-h">{f.title || end.title}</h2>
      <KeptPile kept={f.kept || { count: 0 }} open={open} />
      {f.lines?.length ? <ul className="fx-end__lines">{f.lines.map((l) => <li key={l.label}><b>{l.label}</b><span>{l.text}</span></li>)}</ul> : null}
      <div className="fx-end__keys">
        {f.free ? (
          <p className="fx-free"><span>{f.free.text}</span><button type="button" className="fx-textkey" onClick={(e) => openUpgrade({ trigger: 'learn_feed', opener: e.currentTarget })}>See Pro</button></p>
        ) : f.lead ? <button type="button" className="kc-btn kc-btn--volt" onClick={onAgain} disabled={again}>{again ? 'Starting' : f.lead.label}</button> : null}
        {next ? <Link className="kc-btn kc-btn--line" href={next.run ? links.feed(next.key, next.run.minutes) : links.chapter(next.key)}>{next.label}</Link> : null}
        <Link className="fx-textkey fx-textkey--center" href={links.explore()}>Back to Explore</Link>
      </div>
    </div>
  );
}

// The feed is a focus place above the whole shell, so it renders into the body. The page behind is not locked; the feed is
// its own scroll area with overscroll contained.
const noop = () => () => {};
export default function ChapterFeed(props) {
  const client = useSyncExternalStore(noop, () => true, () => false);
  return client ? createPortal(<Feed {...props} />, document.body) : null;
}

function Feed({ chapterKey, minutes = 10 }) {
  const links = useLearnLinks();
  const router = useRouter();
  const subject = String(chapterKey || '').split('.')[0];
  const [load, setLoad] = useState({ status: 'loading', run: null, line: null });
  const [list, setList] = useState([]);
  const [states, setStates] = useState({});
  const [active, setActive] = useState(0);
  const [stopAt, setStopAt] = useState(null);
  const [end, setEnd] = useState(null);
  const [again, setAgain] = useState(false);
  const [streak, setStreak] = useState(0);
  const [hints, setHints] = useState({ flip: false, swipe: false });
  const [swipeFor, setSwipeFor] = useState(null);
  const scroller = useRef(null);
  const slotEls = useRef([]);
  const rails = useRef({});
  const cardEls = useRef({});

  const begin = useCallback(async () => {
    setLoad((l) => ({ ...l, status: 'loading' }));
    setStates({}); setEnd(null); setStopAt(null); setActive(0); setStreak(0);
    try {
      const run = await startRun({ chapterKey, minutes, kind: 'feed', leaveOut: ['lesson'] });
      setList(run.items || []);
      setLoad({ status: 'ready', run, line: null });
      scroller.current?.scrollTo({ top: 0 });
    } catch (e) {
      if (e.status === 402) setLoad({ status: 'free', run: null, line: e.data?.line || FREE_FEED_DONE });
      else setLoad({ status: 'error', run: null, line: null });
    }
  }, [chapterKey, minutes]);
  // One feed per chapter and length: a second mount of the same feed (React's development double effect) does not start another
  // run (a second start would count as Free's second feed of the day).
  const started = useRef(null);
  useEffect(() => {
    const key = `${chapterKey}|${minutes}`;
    if (started.current === key) return;
    started.current = key;
    queueMicrotask(begin);
  }, [begin, chapterKey, minutes]);
  useEffect(() => { queueMicrotask(() => setHints({ flip: !seen(FLIP_HINT), swipe: !seen(SWIPE_HINT) })); }, []);

  const run = load.run;
  const items = useMemo(() => list.filter((i) => i.type === 'card' || i.type === 'question'), [list]);
  const allSlots = useMemo(() => feedSlots(items), [items]);
  const slots = useMemo(() => {
    const body = stopAt === null ? allSlots : allSlots.slice(0, stopAt + 1);
    return run ? [...body, { type: 'end', id: 'end' }] : body;
  }, [allSlots, stopAt, run]);
  const total = items.length;
  const endAt = slots.length - 1;
  const patch = useCallback((id, p) => setStates((s) => ({ ...s, [id]: { ...(s[id] || {}), ...(typeof p === 'function' ? p(s[id] || {}) : p) } })), []);

  // Which screen is in view: the one whose top is nearest the top of the feed (a tall question counts while any of it fills
  // the screen). Read on every scroll frame, so the ticks, the drift and the end screen follow the finger.
  useEffect(() => {
    const root = scroller.current;
    if (!root || load.status !== 'ready') return undefined;
    let frame = 0;
    const read = () => {
      frame = 0;
      const y = root.scrollTop + root.clientHeight * 0.45;
      let at = 0;
      slotEls.current.forEach((el, i) => { if (el && el.offsetTop <= y) at = i; });
      setActive(at);
    };
    // A safety net for the snap: if a scroll comes to rest between two screens (a browser that lost its snap mid-gesture),
    // it settles on the nearer one, in the direction it was going. A screen taller than the feed (a long question) scrolls freely.
    let settle = 0;
    let touching = false;
    let lastTop = root.scrollTop;
    let dir = 0;
    const rest = () => {
      settle = 0;
      if (touching) return;
      const top = root.scrollTop;
      const h = root.clientHeight;
      const els = slotEls.current.filter(Boolean);
      const at = els.findIndex((el, i) => el.offsetTop <= top + 1 && (i === els.length - 1 || els[i + 1].offsetTop > top + 1));
      const el = els[at];
      if (!el) return;
      const off = top - el.offsetTop;
      if (off < 2 || el.offsetHeight > h + 2) return;
      const next = els[at + 1];
      const target = !next ? el : (dir > 0 ? (off > h * 0.25 ? next : el) : (off > h * 0.75 ? next : el));
      root.scrollTo({ top: target.offsetTop, behavior: still() ? 'auto' : 'smooth' });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
      const top = root.scrollTop;
      if (top !== lastTop) dir = top > lastTop ? 1 : -1;
      lastTop = top;
      clearTimeout(settle);
      settle = setTimeout(rest, 180);
    };
    const down = () => { touching = true; };
    const up = () => { touching = false; clearTimeout(settle); settle = setTimeout(rest, 180); };
    root.addEventListener('scroll', onScroll, { passive: true });
    root.addEventListener('touchstart', down, { passive: true });
    root.addEventListener('touchend', up, { passive: true });
    root.addEventListener('touchcancel', up, { passive: true });
    read();
    return () => {
      root.removeEventListener('scroll', onScroll);
      root.removeEventListener('touchstart', down);
      root.removeEventListener('touchend', up);
      root.removeEventListener('touchcancel', up);
      clearTimeout(settle);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [load.status, slots.length]);

  // The end screen reads the session's numbers once it comes into view (after the last answer, so they are all counted).
  useEffect(() => {
    if (!run || active !== endAt || end) return undefined;
    let alive = true;
    runEnd(run.id).then((e) => { if (alive) setEnd(e); }).catch(() => { if (alive) setEnd({ title: `${minutes} minutes on ${run.chapter?.title || 'this chapter'}`, feed: { title: `${minutes} minutes on ${run.chapter?.title || 'this chapter'}`, kept: { count: 0 }, lines: [], lead: null, next: null } }); });
    return () => { alive = false; };
  }, [run, active, endAt, end, minutes]);

  const go = useCallback((i) => {
    const el = slotEls.current[Math.max(0, Math.min(i, slots.length - 1))];
    el?.scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'start' });
  }, [slots.length]);

  const flip = useCallback((item) => {
    if (hints.flip) { mark(FLIP_HINT); setHints((h) => ({ ...h, flip: false })); }
    patch(item.id, (s) => ({ flipped: !s.flipped }));
  }, [hints.flip, patch]);

  // Keep: the glyph fills volt with a pop, and a small copy of the card flies to the rail's foot (320 ms).
  const fly = useCallback((item) => {
    if (still()) return;
    const from = cardEls.current[item.id]?.getBoundingClientRect();
    const foot = rails.current[item.id]?.querySelector('.fx-rail__foot')?.getBoundingClientRect();
    if (!from || !foot) return;
    const ghost = document.createElement('span');
    ghost.className = 'fx-ghost';
    const w = 72; const h = 96;
    ghost.style.left = `${from.left + from.width / 2 - w / 2}px`;
    ghost.style.top = `${from.top + from.height / 2 - h / 2}px`;
    (scroller.current?.parentElement || document.body).appendChild(ghost);
    const dx = foot.left + foot.width / 2 - (from.left + from.width / 2);
    const dy = foot.top + foot.height / 2 - (from.top + from.height / 2);
    const a = ghost.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 0.95 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.32)`, opacity: 0 },
    ], { duration: 320, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', fill: 'forwards' });
    a.onfinish = () => ghost.remove();
    a.oncancel = () => ghost.remove();
  }, []);

  const keep = useCallback(async (item) => {
    const st = states[item.id] || {};
    if (st.keepPro) { openUpgrade({ trigger: 'keycards' }); return; }
    if (st.kept || st.keeping || !run) return;
    patch(item.id, { keeping: true });
    try {
      const res = await keepItem(run.id, item.id);
      fly(item);
      patch(item.id, { kept: true, keeping: false, stamp: res.stamp || null });
      refreshHome();
    } catch (e) {
      patch(item.id, { keeping: false, keepPro: e.status === 402 });
    }
  }, [states, run, patch, fly]);

  const save = useCallback(async (item) => {
    const st = states[item.id] || {};
    if (st.savePro) { openUpgrade({ trigger: 'saved' }); return; }
    if (st.saved || st.saving) return;
    patch(item.id, { saving: true });
    try { await saveQuestion(item.question.id); patch(item.id, { saved: true, saving: false }); } catch (e) { patch(item.id, { saving: false, savePro: e.status === 402 }); }
  }, [states, patch]);

  const choose = useCallback(async (item, key) => {
    const st = states[item.id] || {};
    if (st.answer || !run) return;
    patch(item.id, { answer: { choice: key, pending: true }, error: null });
    try {
      const res = await answerItem(run.id, { itemId: item.id, choice: key });
      patch(item.id, { answer: { choice: key, res }, sheet: !res.correct });
      setStreak((n) => (res.correct ? n + 1 : 0));
      buzz(res.correct ? 12 : [8, 40, 8]);
      if (hints.swipe) { mark(SWIPE_HINT); setHints((h) => ({ ...h, swipe: false })); setSwipeFor(item.id); }
      if (res.reinsert?.item) setList((l) => { const next = [...l]; next.splice(Math.min(res.reinsert.at, next.length), 0, res.reinsert.item); return next; });
    } catch {
      patch(item.id, { answer: null, error: 'That answer was not saved. Try again.' });
    }
  }, [states, run, patch, hints.swipe]);

  const stopHere = useCallback((slotIndex) => {
    setStopAt(slotIndex);
    requestAnimationFrame(() => requestAnimationFrame(() => slotEls.current[slotIndex + 1]?.scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'start' })));
  }, []);

  const anotherFeed = useCallback(async () => { setAgain(true); await begin(); setAgain(false); }, [begin]);
  const close = useCallback(() => (window.history.length > 1 ? router.back() : router.push(links.explore())), [router, links]);

  // Keys on the desktop: Down, Page Down or Space for the next screen, Up or Page Up for the one before; Space turns a card that
  // is face up; 1 to 4 (or A to D) answer; Escape closes the line you needed.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || load.status !== 'ready') return;
      const slot = slots[active];
      const onButton = /^(BUTTON|A)$/.test(e.target?.tagName || '');
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); go(active + 1); return; }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); go(active - 1); return; }
      if (e.key === ' ' && !onButton) {
        e.preventDefault();
        if (slot?.type === 'item' && slot.item.type === 'card' && !states[slot.item.id]?.flipped) flip(slot.item);
        else go(active + 1);
        return;
      }
      if (e.key === 'Escape' && slot?.type === 'item' && states[slot.item.id]?.sheet) { patch(slot.item.id, { sheet: false }); return; }
      if (slot?.type === 'item' && slot.item.type === 'question' && !states[slot.item.id]?.answer) {
        const i = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
        if (i >= 0 && slot.item.question.options[i]) { e.preventDefault(); choose(slot.item, slot.item.question.options[i].key); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [load.status, slots, active, states, go, flip, choose, patch]);

  // What the student did before a checkpoint: its large number.
  const numberBefore = (after) => {
    const before = items.slice(0, after);
    const qs = before.filter((i) => i.type === 'question' && states[i.id]?.answer?.res);
    const cards = before.filter((i) => i.type === 'card');
    return checkpointNumber({ answered: qs.length, right: qs.filter((i) => states[i.id].answer.res.correct).length, seen: cards.length, kept: cards.filter((i) => states[i.id]?.kept).length });
  };

  const title = run?.chapter?.title || '';
  const slot = slots[active];
  const done = slot?.type === 'end' ? total : slot?.type === 'checkpoint' ? slot.after : slot?.type === 'item' ? slot.n - 1 : 0;
  const current = slot?.type === 'item' ? slot.n - 1 : -1;
  const chapterHref = links.chapter(chapterKey);
  const shell = (body, extra = {}) => (
    <div className={`kc fx ${ncertFont.variable}`} {...extra}>
      <header className="fx-top">
        <div className="fx-ticks" aria-hidden="true">
          {(total ? items : [0, 1, 2, 3, 4, 5]).map((it, i) => <span key={it?.id || i} className="fx-tick" data-state={i < done ? 'done' : i === current ? 'now' : undefined}><i /></span>)}
        </div>
        <div className="fx-row">
          <button type="button" className="fx-close" aria-label="Close the feed" onClick={close}><X size={22} strokeWidth={2.2} aria-hidden="true" /></button>
          <p className="fx-title">{title}</p>
        </div>
      </header>
      {body}
    </div>
  );

  if (load.status === 'loading') {
    return shell(<div className="fx-feed"><div className="fx-slot" role="status" aria-label="Starting the feed"><Backdrop subject={subject} /><div className="fx-cardwrap"><span className="skeleton fx-skel" /></div></div></div>);
  }
  if (load.status === 'free') {
    return shell(
      <div className="fx-feed"><div className="fx-slot fx-slot--center"><Backdrop subject={subject} />
        <div className="fx-end fx-end--free">
          <h2 className="fx-end__title">One feed a day on Free</h2>
          <p className="fx-free"><span>{load.line}</span><button type="button" className="fx-textkey" onClick={(e) => openUpgrade({ trigger: 'learn_feed', opener: e.currentTarget })}>See Pro</button></p>
          <div className="fx-end__keys">
            <Link className="kc-btn kc-btn--line" href={links.chapter(chapterKey)}>Open the chapter</Link>
            <Link className="fx-textkey fx-textkey--center" href={links.explore()}>Back to Explore</Link>
          </div>
        </div>
      </div></div>,
    );
  }
  if (load.status === 'error' || !run) {
    return shell(
      <div className="fx-feed"><div className="fx-slot fx-slot--center">
        <div className="fx-end"><h2 className="fx-end__title">The feed did not start</h2><p className="fx-end__none">Check your connection and try again.</p>
          <div className="fx-end__keys"><button type="button" className="kc-btn kc-btn--volt" onClick={begin}>Try again</button></div></div>
      </div></div>,
    );
  }
  if (!total) {
    return shell(
      <div className="fx-feed"><div className="fx-slot fx-slot--center"><Backdrop subject={subject} />
        <div className="fx-end"><h2 className="fx-end__title">Nothing to play in this chapter yet.</h2><p className="fx-end__none">Its cards and questions are still being checked. Your other chapters have a feed.</p>
          <div className="fx-end__keys"><Link className="kc-btn kc-btn--line" href={links.explore()}>Back to Explore</Link></div></div>
      </div></div>,
    );
  }

  return shell(
    <>
      {streak >= 3 && slots[active]?.type === 'item' ? <p className="fx-streak" role="status" aria-live="polite"><b key={streak}>{streak}</b> in a row</p> : null}
      <div className="fx-feed" ref={scroller} role="feed" aria-roledescription="feed" aria-label={`${title}, ${total} items`} aria-busy={again || undefined}>
        {slots.map((s, i) => {
          const ref = (el) => { slotEls.current[i] = el; };
          const isActive = i === active;
          // The object is drawn only on the screens next to the one in view (one blurred picture each, light on a phone).
          const near = Math.abs(i - active) <= 1;
          if (s.type === 'checkpoint') {
            return (
              <article key={s.id} ref={ref} data-slot={i} className="fx-slot fx-slot--center" data-active={isActive || undefined} aria-label={`Checkpoint after ${s.after} of ${total}`}>
                {near ? <Backdrop subject={subject} /> : null}
                <Checkpoint number={numberBefore(s.after)} onGo={() => go(i + 1)} onStop={() => stopHere(i)} />
              </article>
            );
          }
          if (s.type === 'end') {
            return (
              <article key="end" ref={ref} data-slot={i} className="fx-slot fx-slot--end" data-active={isActive || undefined} aria-labelledby={end ? 'fx-end-h' : undefined} aria-label={end ? undefined : 'The end of the feed'}>
                {near ? <Backdrop subject={subject} /> : null}
                {end ? <EndScreen end={end} open={isActive} links={links} onAgain={anotherFeed} again={again} /> : <div className="fx-end" role="status" aria-label="Finishing"><span className="skeleton fx-skel fx-skel--end" /></div>}
              </article>
            );
          }
          const { item, n } = s;
          const st = states[item.id] || {};
          const kind = item.type === 'card' ? 'Card' : 'Question';
          return (
            <article key={item.id} ref={ref} data-slot={i} className={`fx-slot fx-slot--${item.type}`} data-active={isActive || undefined} data-sheet={st.sheet || undefined}
              aria-posinset={n} aria-setsize={total} aria-label={`${kind} ${n} of ${total}`}>
              {near ? <Backdrop subject={subject} /> : null}
              {item.type === 'card' ? (
                <div className="fx-cardslot" ref={(el) => { cardEls.current[item.id] = el?.querySelector('.fx-card') || null; rails.current[item.id] = el?.querySelector('.fx-rail') || null; }}>
                  <CardItem item={item} st={st} onFlip={() => flip(item)} onKeep={() => keep(item)} chapterHref={chapterHref} hint={hints.flip && n === 1} />
                </div>
              ) : (
                <QuestionItem item={item} st={st} onChoose={(k) => choose(item, k)} onSave={() => save(item)} chapterHref={chapterHref} swipeHint={swipeFor === item.id} onCloseSheet={() => patch(item.id, { sheet: false })} />
              )}
            </article>
          );
        })}
      </div>
    </>,
  );
}
