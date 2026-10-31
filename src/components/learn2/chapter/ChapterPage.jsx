'use client';
// Learn v2, the chapter page: what is lined up (docs/brain/learn-1031/design/B-chapters.md 3.3 and 3.4, with
// DESIGN-SPEC A1, A2, A9 and A11).
//   Head     a 44 px "Learn" back key, the unit line, the chapter title with the subject's lamp-lit object, the ref and state
//   Length   "How long have you got?": one segmented control (5 min | 10 min | 20 min | Your own), one sliding thumb;
//            Your own opens a small sheet (30 min, 45 min, 1 hour, then a 5-minute stepper up to 120)
//   Piles    the signature object: up to four paper-card fans (Key cards, Questions, Your mistakes, and at 20+ minutes with an
//            unread lesson, Lesson). Tap a pile to leave it out: it dims to 35% and reads "Left out", the others re-balance
//            from the server's dry run (POST /api/learn/runs/preview). The last pile in cannot be left out; it shakes 4 px once.
//            Each pile is three papers (critique C1) with a faint print hint and an in/left-out tick on the top paper. A chapter
//            that runs short adds a dashed "Next chapter" pile, and the chosen length reads the real minutes (C3).
//            Before the first dry run the whole main column is one outline at its real sizes, so nothing shifts (C5).
//   Start    the one volt key, "Start 10 minutes", then the note line and the quiet recap button (kind recap)
//   Shelf    "In this chapter": Key cards, Questions, Your mistakes, Lesson, Print sheet (locked on Free); a sticky 320 px
//            column at 1440, rows below at 390
// Every number on screen comes from the preview response. Links come from useLearnLinks, never built here.
// Motion: counts roll 180 ms, fans re-spread 220 ms, thumb slides 240 ms; transform and opacity only; reduced motion lands at once.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ChevronLeft, ChevronRight, Lock, Minus, Plus } from 'lucide-react';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { useCountUpState } from '@/lib/motion';
import { previewRun } from '../api';
import { useLearnLinks } from '../links';
import { StateRing } from '../home/ChapterMap';
import { stateShape } from '../home/homeModel.mjs';
import '../../keycards/keycards.css';
import './chapter.css';

const LENGTHS = [5, 10, 20];
const OWN_PRESETS = [30, 45, 60];
const OWN_MIN = 5;
const OWN_MAX = 120;
const OWN_STEP = 5;
const PILE_ORDER = ['lesson', 'cards', 'questions', 'mistakes'];
const MINUTES_KEY = 'mm:learn2:minutes';
const COACH_KEY = 'mm:learn2:coach:piles';

const store = {
  get(key) { try { return window.localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { window.localStorage.setItem(key, value); } catch { /* a private window keeps nothing */ } },
};

const minutesLabel = (m) => (m >= 60 && m % 60 === 0 ? (m === 60 ? '1 hour' : `${m / 60} hours`) : `${m} min`);
const validMinutes = (m) => Number.isFinite(m) && m >= OWN_MIN && m <= OWN_MAX;

/** The page's one read: the dry run for a length and the piles left out, newest request wins, old data stays on screen. */
function usePreview(chapterKey, minutes, leaveOut) {
  const [nonce, setNonce] = useState(0);
  const outKey = leaveOut.join(',');
  const want = `${chapterKey}|${minutes}|${outKey}|${nonce}`;
  const [got, setGot] = useState({ key: null, data: null, failed: null });
  useEffect(() => {
    let alive = true;
    previewRun({ chapterKey, minutes, leaveOut: outKey ? outKey.split(',') : [] })
      .then((data) => { if (alive) setGot({ key: want, data, failed: null }); })
      .catch(() => { if (alive) setGot((g) => ({ ...g, failed: want })); });
    return () => { alive = false; };
  }, [chapterKey, minutes, outKey, want]);
  const status = got.failed === want ? (got.data ? 'stale' : 'error') : got.key === want ? 'ready' : got.data ? 'refreshing' : 'loading';
  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { status, data: got.data, retry };
}

// ---------------------------------------------------------------- Length

function LengthControl({ minutes, capped = null, onChange, onOwn, ownOpen, ownRef }) {
  const refs = useRef([]);
  const own = !LENGTHS.includes(minutes);
  const index = own ? 3 : LENGTHS.indexOf(minutes);
  const pick = (i) => (i < 3 ? onChange(LENGTHS[i]) : onOwn());
  const keys = (e, i) => {
    const to = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % 4 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i + 3) % 4 : e.key === 'Home' ? 0 : e.key === 'End' ? 3 : null;
    if (to === null) return;
    e.preventDefault();
    refs.current[to]?.focus();
    if (to < 3) onChange(LENGTHS[to]);
  };
  return (
    <div className="lc-len" role="radiogroup" aria-label="How long have you got?">
      {[...LENGTHS, 'own'].map((m, i) => {
        const checked = i === index;
        // When the chapter holds less than the length asked, the chosen segment says what the run will really take.
        const real = checked && capped ? minutesLabel(capped) : null;
        const label = real || (m === 'own' ? (own ? minutesLabel(minutes) : 'Your own') : `${m} min`);
        return (
          <button
            key={m}
            ref={(el) => { refs.current[i] = el; if (m === 'own') ownRef.current = el; }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={real ? `${m === 'own' ? minutesLabel(minutes) : `${m} min`}, enough for ${real} today` : undefined}
            aria-haspopup={m === 'own' ? 'dialog' : undefined}
            aria-expanded={m === 'own' ? ownOpen : undefined}
            tabIndex={checked ? 0 : -1}
            className="lc-len__btn"
            onClick={() => pick(i)}
            onKeyDown={(e) => keys(e, i)}
          >
            {label}
          </button>
        );
      })}
      <span className="lc-len__thumb" aria-hidden="true" style={{ '--i': index }} />
    </div>
  );
}

/** "Your own": three ready lengths (one press chooses) and a stepper in 5-minute steps, chosen with its own key. */
function OwnSheet({ open, minutes, onChoose, onClose, returnRef, anchorRef }) {
  const titleId = useId();
  const [at, setAt] = useState(null);
  const [own, setOwn] = useState(() => (LENGTHS.includes(minutes) || OWN_PRESETS.includes(minutes) ? 35 : minutes));
  const first = useRef(null);
  const panel = useRef(null);
  // Above the app's dock and bars: the sheet is drawn into <body> (the arena tokens live on <html>). On a wide screen it
  // hangs under the length control, right-aligned to it.
  useEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (r) setAt({ top: r.bottom + window.scrollY + 8, right: document.documentElement.clientWidth - r.right });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, anchorRef]);
  useEffect(() => {
    if (!open) return undefined;
    first.current?.focus({ preventScroll: true });
    const key = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); returnRef.current?.focus(); }
      if (e.key === 'Tab' && panel.current) {
        const f = [...panel.current.querySelectorAll('button:not(:disabled)')];
        if (!f.length) return;
        const [a, z] = [f[0], f[f.length - 1]];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [open, onClose, returnRef]);
  if (!open || typeof document === 'undefined') return null;
  const step = (d) => setOwn((n) => Math.min(OWN_MAX, Math.max(OWN_MIN, n + d * OWN_STEP)));
  const spin = (e) => {
    const map = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 };
    if (map[e.key]) { e.preventDefault(); step(map[e.key]); }
    if (e.key === 'Home') { e.preventDefault(); setOwn(OWN_MIN); }
    if (e.key === 'End') { e.preventDefault(); setOwn(OWN_MAX); }
    if (e.key === 'Enter') { e.preventDefault(); onChoose(own); }
  };
  return createPortal(
    <div className="lc-own-layer">
      <button type="button" className="lc-own__scrim" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <div ref={panel} className="lc-own" role="dialog" aria-modal="true" aria-labelledby={titleId} style={at ? { '--lc-own-top': `${at.top}px`, '--lc-own-right': `${at.right}px` } : undefined}>
        <span className="lc-own__grab" aria-hidden="true" />
        <h2 id={titleId} className="lc-own__title">Your own length</h2>
        <div className="lc-own__presets">
          {OWN_PRESETS.map((m, i) => (
            <button key={m} ref={i === 0 ? first : undefined} type="button" className="lc-own__preset" aria-pressed={minutes === m} onClick={() => onChoose(m)}>{minutesLabel(m)}</button>
          ))}
        </div>
        <div className="lc-own__step">
          <button type="button" className="lc-own__nudge" aria-label="5 minutes less" disabled={own <= OWN_MIN} onClick={() => step(-1)}><Minus size={18} strokeWidth={2.4} aria-hidden="true" /></button>
          <div className="lc-own__read" role="spinbutton" tabIndex={0} aria-label="Minutes" aria-valuemin={OWN_MIN} aria-valuemax={OWN_MAX} aria-valuenow={own} aria-valuetext={`${own} minutes`} onKeyDown={spin}>
            <b>{own}</b> min
          </div>
          <button type="button" className="lc-own__nudge" aria-label="5 minutes more" disabled={own >= OWN_MAX} onClick={() => step(1)}><Plus size={18} strokeWidth={2.4} aria-hidden="true" /></button>
        </div>
        <button type="button" className="lc-own__use" onClick={() => onChoose(own)}>Use {own} minutes</button>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------- Piles

// What is printed on each pile's top paper, faint, so the pile reads as that kind of paper before its label is read:
// a Key card's two lines of print, a question's four option dots, a mistake's red margin, a lesson's lines by a spine.
function FaceHint({ id }) {
  if (id === 'questions' || id === 'mistakes') {
    return (
      <svg className="lc-hint" viewBox="0 0 60 22" aria-hidden="true">
        <rect x="0" y="0" width="52" height="1.6" rx=".8" fill="currentColor" />
        <rect x="0" y="5" width="34" height="1.6" rx=".8" fill="currentColor" />
        {[0, 1, 2, 3].map((i) => (
          <circle key={i} cx={3 + i * 11} cy="16" r="2.6" fill={id === 'mistakes' && i === 1 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.1" />
        ))}
      </svg>
    );
  }
  if (id === 'lesson') {
    return (
      <svg className="lc-hint" viewBox="0 0 60 22" aria-hidden="true">
        {[0, 5, 10, 15].map((y, i) => <rect key={y} x="0" y={y} width={i === 3 ? 30 : 56 - i * 4} height="1.6" rx=".8" fill="currentColor" />)}
      </svg>
    );
  }
  return (
    <svg className="lc-hint" viewBox="0 0 60 22" aria-hidden="true">
      <rect x="0" y="0" width="54" height="1.6" rx=".8" fill="currentColor" />
      <rect x="0" y="5" width="32" height="1.6" rx=".8" fill="currentColor" />
    </svg>
  );
}

function Pile({ pile, index, busy, onToggle, shaking, onShaken, line }) {
  const { value } = useCountUpState(pile.count, { duration: 180, curve: 'out' });
  const minutes = line || pile.minutesLabel || (pile.id === 'lesson' ? `${pile.minutes} min` : `about ${pile.minutes} min`);
  const label = pile.left ? `${pile.label}, left out. Tap to put it back` : `${pile.label}: ${pile.count}, ${minutes}. Tap to leave it out`;
  return (
    <li className="lc-pile" data-kind={pile.id} data-left={pile.left || undefined} style={{ '--i': index }}>
      <button
        type="button"
        className={`lc-pile__btn${shaking ? ' lc-shake' : ''}`}
        aria-pressed={!pile.left}
        aria-label={label}
        aria-busy={busy || undefined}
        onClick={() => onToggle(pile)}
        onAnimationEnd={(e) => { if (e.animationName === 'lc-shake') onShaken(); }}
      >
        <span className="lc-fan" key={`${pile.count}-${pile.left}`}>
          <span className="lc-sheet lc-sheet--c" aria-hidden="true" />
          <span className="lc-sheet lc-sheet--b" aria-hidden="true" />
          <span className="lc-sheet lc-sheet--a">
            <FaceHint id={pile.id} />
            <span className="lc-tick" aria-hidden="true">{pile.left ? null : <Check size={12} strokeWidth={3} />}</span>
            {pile.left
              ? <span className="lc-face__left">Left out</span>
              : <span className="lc-face__count">{value}</span>}
          </span>
        </span>
        <span className="lc-pile__label">{pile.label}</span>
        <span className="lc-pile__min">{pile.left ? 'Tap to put back' : minutes}</span>
      </button>
    </li>
  );
}

/** The next chapter, when this one runs short: a dashed, empty paper with a plus. It opens that chapter. */
function NextPile({ next, href, index }) {
  return (
    <li className="lc-pile" data-kind="next" style={{ '--i': index }}>
      <Link className="lc-pile__btn" href={href} aria-label={`Next chapter, ${next.title}`}>
        <span className="lc-fan">
          <span className="lc-sheet lc-sheet--a lc-sheet--dash"><Plus className="lc-next__plus" size={22} strokeWidth={2.2} aria-hidden="true" /></span>
        </span>
        <span className="lc-pile__label">Next chapter</span>
        <span className="lc-pile__min lc-pile__min--cut">{next.title}</span>
      </Link>
    </li>
  );
}

/** Before the first dry run: the whole page in outline, so nothing on screen moves when the answer lands. */
function PageSkeleton() {
  return (
    <div className="lc-skel" aria-busy="true" aria-label="Lining up this chapter">
      <div className="lc-head">
        <div className="lc-head__text">
          <span className="skeleton lc-skel__unit" />
          <span className="skeleton lc-skel__title" />
          <span className="skeleton lc-skel__title lc-skel__title--2" />
          <span className="skeleton lc-skel__ref" />
        </div>
      </div>
      <div className="lc-lined">
        <span className="skeleton lc-skel__h" />
        <span className="skeleton lc-skel__len" />
        <ul className="lc-piles" style={{ '--n': 3 }}>
          {[0, 1, 2].map((i) => (
            <li key={i} className="lc-pile lc-pile--skel">
              <span className="lc-pile__btn">
                <span className="lc-fan"><span className="lc-sheet lc-sheet--c" /><span className="lc-sheet lc-sheet--b" /><span className="lc-sheet lc-sheet--a" /></span>
                <span className="lc-pile__label"><span className="skeleton lc-skel-text" /></span>
                <span className="lc-pile__min"><span className="skeleton lc-skel-text lc-skel-text--short" /></span>
              </span>
            </li>
          ))}
        </ul>
        <span className="skeleton lc-skel__key" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Shelf

function ShelfRow({ href, title, line, locked = false }) {
  const body = (
    <>
      <span className="lc-shelf__text">
        <span className="lc-shelf__title">{title}</span>
        <span className="lc-shelf__line">{locked ? <Lock size={13} strokeWidth={2.3} aria-hidden="true" /> : null}{line}</span>
      </span>
      {href ? <ChevronRight className="lc-shelf__chev" size={18} strokeWidth={2.2} aria-hidden="true" /> : null}
    </>
  );
  return <li>{href ? <Link className="lc-shelf__row" href={href}>{body}</Link> : <div className="lc-shelf__row" data-still>{body}</div>}</li>;
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Shelf({ shelf, chapterKey, minutes, links, failed = false }) {
  if (!shelf && failed) {
    // The dry run failed: the counts are unknown, but the chapter's cards still open.
    return (
      <aside className="lc-shelf" aria-label="In this chapter">
        <h2 className="lc-shelf__h">In this chapter</h2>
        <ul className="lc-shelf__rows">
          <ShelfRow title="Key cards" line="Every card in this chapter, by section" href={links.cards(chapterKey)} />
        </ul>
      </aside>
    );
  }
  if (!shelf) {
    return (
      <aside className="lc-shelf lc-shelf--skel" aria-label="In this chapter">
        <h2 className="lc-shelf__h">In this chapter</h2>
        <ul className="lc-shelf__rows">{[0, 1, 2, 3, 4].map((i) => <li key={i}><div className="lc-shelf__row" data-still><span className="lc-shelf__text"><span className="skeleton lc-skel-text" /><span className="skeleton lc-skel-text lc-skel-text--short" /></span></div></li>)}</ul>
      </aside>
    );
  }
  const { cards, questions, mistakes, lesson, print } = shelf;
  const cardsLine = cards.count
    // Two facts at most: the count, then the one that matters most (what Free opens, what is in Revise, else Must-know).
    ? [plural(cards.count, 'card'), cards.open != null && cards.open < cards.count ? `${cards.open} open on Free` : cards.inRevise ? `${cards.inRevise} in Revise` : cards.mustKnow ? `${cards.mustKnow} Must-know` : null].filter(Boolean).join(', ')
    : 'No Key cards for this chapter yet';
  const qLine = questions.total
    ? (questions.linked === questions.total ? `${plural(questions.total, 'question')}, all tied to these cards` : questions.linked ? `${questions.linked} tied to these cards, ${questions.total} in all` : plural(questions.total, 'question'))
    : 'Questions for this chapter are being checked';
  const only = (keep) => ['cards', 'questions', 'mistakes', 'lesson'].filter((k) => k !== keep);
  return (
    <aside className="lc-shelf" aria-label="In this chapter">
      <h2 className="lc-shelf__h">In this chapter</h2>
      <ul className="lc-shelf__rows">
        <ShelfRow title="Key cards" line={cardsLine} href={cards.count ? links.cards(chapterKey) : null} />
        <ShelfRow title="Questions" line={qLine} href={questions.total ? links.run({ chapterKey, minutes, kind: 'mix', leaveOut: only('questions') }) : null} />
        <ShelfRow
          title="Your mistakes"
          line={mistakes.open ? `${mistakes.open} open. Fix them with their lines.` : 'None open in this chapter'}
          href={mistakes.open ? links.run({ chapterKey, minutes, kind: 'mix', leaveOut: only('mistakes') }) : null}
        />
        {lesson
          ? <ShelfRow title={lesson.title} line={`${lesson.minutes}-minute lesson${lesson.read ? ', read' : ', not read yet'}. Read it alone`} href={links.lesson(lesson.id)} />
          : <ShelfRow title="Lesson" line="No lesson for this chapter yet" />}
        {print.mustKnow
          ? <ShelfRow title="Print sheet" line={print.locked ? 'Part of Pro' : `${plural(print.mustKnow, 'Must-know line')}, with your name`} locked={print.locked} href={links.cards(chapterKey, 'must')} />
          : null}
      </ul>
    </aside>
  );
}

// ---------------------------------------------------------------- Page

// "Part 1, Partnership Accounts" reads "Part 1" beside the chapter ref ("Part 1, Ch 1"); a part without a number keeps its name.
const partShort = (title) => (title ? (String(title).match(/^Part \d+/)?.[0] || title) : null);

const NAMES = { accountancy: 'Accountancy', business_studies: 'Business Studies', economics: 'Economics', english: 'English', biology: 'Biology', political_science: 'Political Science', mathematics: 'Mathematics', physics: 'Physics', chemistry: 'Chemistry', computer_science: 'Computer Science', history: 'History', geography: 'Geography' };
const subjectName = (id) => NAMES[id] || String(id || '').split('_').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

/** The eyebrow and the ref line. A unit whose name only repeats the start of the title gives way to "Accountancy, Part 1". */
function headLines(chapter, subject) {
  const part = partShort(chapter.partTitle);
  const unit = chapter.unitTitle && chapter.unitTitle !== chapter.title ? chapter.unitTitle : null;
  const echoes = unit && String(chapter.title).toLowerCase().startsWith(String(unit).toLowerCase());
  if (unit && !echoes) return { eyebrow: unit, ref: [part, chapter.ref].filter(Boolean).join(', ') };
  const ref = part && chapter.ref && /^Part \d+/.test(part) ? String(chapter.ref) : [part, chapter.ref].filter(Boolean).join(', ');
  return { eyebrow: [subjectName(subject), part].filter(Boolean).join(', '), ref };
}

/** One quiet line under a pile, where the pile holds less than the chapter has (Free's open cards, mistakes not all in). */
function pileLine(pile, shelf) {
  if (!shelf || pile.left) return null;
  const about = `about ${pile.minutes} min`;
  if (pile.id === 'cards' && shelf.cards?.open != null && shelf.cards.open < shelf.cards.count) return `${shelf.cards.open} open on Free`;
  if (pile.id === 'mistakes' && shelf.mistakes?.open > pile.count) return `${pile.count} of ${shelf.mistakes.open}, ${about}`;
  return null;
}

export default function ChapterPage({ chapterKey, minutes: asked = null }) {
  const links = useLearnLinks();
  const router = useRouter();
  const subject = String(chapterKey || '').split('.')[0];
  const [minutes, setMinutes] = useState(() => (validMinutes(asked) ? asked : 10));
  const [leaveOut, setLeaveOut] = useState([]);
  const [ownOpen, setOwnOpen] = useState(false);
  const [shake, setShake] = useState(null);
  const [coach, setCoach] = useState(false);
  const ownRef = useRef(null);
  const lenRef = useRef(null);

  // Returning: the length used last in Learn (shown as chosen, editable), unless the link names one.
  // Browser storage is read after the first paint so the server render and the first client render agree.
  useEffect(() => {
    if (!validMinutes(asked)) {
      const kept = Number(store.get(MINUTES_KEY));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- a remembered preference, read once after mount
      if (validMinutes(kept)) setMinutes(kept);
    }
    if (!store.get(COACH_KEY)) { setCoach(true); store.set(COACH_KEY, '1'); }
  }, [asked]);

  const read = usePreview(chapterKey, minutes, leaveOut);
  const data = read.data;
  const chapter = data?.chapter;

  const choose = (m) => {
    setOwnOpen(false);
    if (m === minutes) return;
    setMinutes(m);
    store.set(MINUTES_KEY, String(m));
    router.replace(links.chapter(chapterKey, m), { scroll: false });
  };

  // The server's piles, in the page's order. A pile the student left out stays drawn (dimmed); an empty one is not drawn.
  const piles = useMemo(() => {
    const list = (data?.piles || []).map((p) => ({ ...p, left: p.left || leaveOut.includes(p.id) }));
    return list.filter((p) => p.left || p.count > 0).sort((a, b) => PILE_ORDER.indexOf(a.id) - PILE_ORDER.indexOf(b.id));
  }, [data, leaveOut]);

  const toggle = (pile) => {
    setCoach((c) => (c ? 'done' : c));
    if (pile.left) { setLeaveOut((out) => out.filter((id) => id !== pile.id)); return; }
    const inRun = piles.filter((p) => !p.left);
    if (inRun.length <= 1) { setShake(pile.id); return; }
    setLeaveOut((out) => [...out, pile.id]);
  };

  const startLabel = data?.startLabel || `Start ${minutes} minutes`;
  const ready = Boolean(data) && piles.some((p) => !p.left);
  const runHref = links.run({ chapterKey, minutes, kind: 'mix', leaveOut });
  const shape = stateShape(chapter?.state?.key);
  const head = chapter ? headLines(chapter, subject) : null;

  // A chapter that holds less than the length asked: the chosen segment reads the real length, and the next chapter
  // stands as a dashed pile. Free's limit is said on the Key cards pile. Under the key stays one quiet line.
  const shrink = data?.shrink || null;
  const capped = shrink?.minutes && shrink.minutes < minutes ? shrink.minutes : null;
  const next = shrink?.addNext || null;
  const lines = piles.map((p) => pileLine(p, data?.shelf));
  const freeSaid = piles.some((p, i) => p.id === 'cards' && lines[i]);
  const quiet = [freeSaid ? null : data?.free?.text, capped ? null : shrink?.text].filter(Boolean).join(' ') || data?.note || null;
  const n = piles.length + (next ? 1 : 0);
  const loading = !data && read.status !== 'error';

  return (
    <div className="student-page student-page--cards">
      <div className="kc lc" data-status={read.status}>
        <Link className="kc-back lc-back" href={links.home(subject)}><ChevronLeft size={18} strokeWidth={2.4} aria-hidden="true" />Learn</Link>

        <div className="lc-board">
          <main className="lc-main">
            {loading ? <PageSkeleton /> : (
              <>
                <header className="lc-head">
                  <div className="lc-head__text">
                    {chapter ? (
                      <>
                        {head.eyebrow ? <p className="lc-head__unit">{head.eyebrow}</p> : null}
                        <h1 className="kc-title lc-head__title">{chapter.title}</h1>
                        <p className="lc-head__ref">
                          {head.ref ? <span>{head.ref}</span> : null}
                          {chapter.state?.label ? <span className="lc-state" data-state={shape}><StateRing shape={shape} />{chapter.state.label}</span> : null}
                        </p>
                      </>
                    ) : (
                      <h1 className="kc-title lc-head__title">This chapter</h1>
                    )}
                  </div>
                  <SubjectObject id={subject} size={120} lit className="lc-head__obj" sizes="(max-width: 639px) 76px, 120px" />
                </header>

                <section className="lc-lined" aria-labelledby="lc-len-h">
                  <h2 id="lc-len-h" className="lc-lined__h">How long have you got?</h2>
                  <div className="lc-len-wrap" ref={lenRef}>
                    <LengthControl minutes={minutes} capped={capped} onChange={choose} onOwn={() => setOwnOpen(true)} ownOpen={ownOpen} ownRef={ownRef} />
                    <OwnSheet key={ownOpen ? 'open' : 'shut'} open={ownOpen} minutes={minutes} onChoose={choose} onClose={() => setOwnOpen(false)} returnRef={ownRef} anchorRef={lenRef} />
                  </div>

                  {read.status === 'error' ? (
                    <div className="lc-error" role="alert">
                      <p>We could not line this up. Try again.</p>
                      <button type="button" className="kc-btn kc-btn--line kc-btn--small" onClick={read.retry}>Try again</button>
                    </div>
                  ) : (
                    <>
                      <ul className="lc-piles" aria-label="Lined up for this run" data-n={n} style={{ '--n': Math.max(n, 3) }}>
                        {piles.map((p, i) => (
                          <Pile key={p.id} pile={p} index={i} line={lines[i]} busy={read.status === 'refreshing'} onToggle={toggle} shaking={shake === p.id} onShaken={() => setShake(null)} />
                        ))}
                        {next ? <NextPile next={next} index={piles.length} href={links.chapter(next.key, minutes)} /> : null}
                      </ul>
                      {coach && piles.length > 1 ? <p className="lc-coach" data-done={coach === 'done' || undefined} aria-hidden={coach === 'done' || undefined}>Tap a pile to leave it out.</p> : null}
                      {read.status === 'stale' ? <p className="lc-fine" role="status">We could not update this. The last lined-up run is shown.</p> : null}
                    </>
                  )}

                  {read.status === 'error' ? null : (
                    <div className="lc-go">
                      {ready ? (
                        <Link className="kc-btn kc-btn--volt lc-go__key" href={runHref} aria-busy={read.status === 'refreshing' || undefined}>
                          <span key={startLabel} className="lc-go__label">{startLabel}</span>
                        </Link>
                      ) : (
                        <button type="button" className="kc-btn kc-btn--volt lc-go__key" disabled>{startLabel}</button>
                      )}
                      {quiet ? <p className="lc-go__note">{quiet}</p> : null}
                      {data?.recap?.count ? (
                        <Link className="lc-recap" href={links.run({ chapterKey, minutes: data.recap.minutes, kind: 'recap' })}>{data.recap.label}</Link>
                      ) : null}
                    </div>
                  )}
                </section>
              </>
            )}
          </main>

          <Shelf shelf={data?.shelf} chapterKey={chapterKey} minutes={minutes} links={links} failed={read.status === 'error'} />
        </div>
      </div>
    </div>
  );
}
