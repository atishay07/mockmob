'use client';
// Learn v2, the chapter page (A4-chapter-run.md 3.2 as amended by BUILD-1101 B2 and B7).
//   Head     a 44 px back key that names the subject, the unit only when it does not repeat the title, the title with the
//            subject's lamp-lit object (B7 keeps it: it appears once here), then "Part 1, Ch 1" and the state ring
//   Resume   when today's run of this chapter is unfinished (preview.resume): "You stopped at 6 of 21 today." and the volt
//            "Pick up where you stopped"; the Start key turns into a line key "Start a new 10 minutes" that sends fresh
//   Length   "How long have you got?": the site's SegmentedControl (5 min | 10 min | 20 min | Your own). The chosen segment
//            never rewrites itself: the real length is on the key and the reason in one quiet line under it (A4 F13)
//   Piles    up to four paper fans (Key cards, Questions, Your mistakes, Lesson) whose minutes add up to the key (S1 splits
//            them from the run's total). Tap to leave one out; the last one in shakes and says so. Free's held piles are not
//            buttons ("Tomorrow"). A short chapter offers "Add the next chapter" (the server's addNext dry run).
//   Start    the one volt key with the real length; one quiet line by priority (3.2.5); the quick recap as a text key. On a
//            phone the key sticks above the app dock while the lined-up block is on screen (A8 F12).
//   Shelf    "Everything in this chapter": only rows that lead somewhere; what is missing is one quiet line (3.2.6)
// Round 2 (R2 ruling 9, LK27, LK30): the head sits above the board (so the shelf lines up with "How long have you got?"), the
// title is 32 px on at most 2 lines, the only verdict beside the ref is "Needs work", the first-visit line under Start and the
// "No lesson yet. No open mistakes." line are gone, the recap is a quiet key ("Quick recap, 1 min"), and a "First up" row shows
// the 3 real card fronts the run opens with. With an unfinished run, "Pick up where you stopped" is the one main key and the
// length picker waits under "Start fresh instead". "Your own" reads "Other".
// Every number on screen comes from the preview response. Links come from useLearnLinks, never built here.
// Motion: counts roll 180 ms, fans re-spread 220 ms, the segment lens slides 240 ms; transform and opacity only.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Lock, Minus, Plus, Printer } from 'lucide-react';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { SegmentedControl } from '@/components/ui/controls/SegmentedControl';
import { useCountUpState } from '@/lib/motion';
import { previewRun } from '../api';
import { useLearnLinks } from '../links';
import { StateRing } from '../home/ChapterMap';
import { minutesFor } from '../run/runMath';
import { usePrintSheet } from '../print/ChapterPrintSheet';
import { chapterQuietLine, chapterVerdict, firstUpCards, headLines, isChapterMissing, pileView, recapLabel, shelfView, titleSize, withFlag } from './chapterModel.mjs';
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

/** The page's one read: the dry run for a length, the piles left out and the next chapter; newest request wins. */
function usePreview(chapterKey, minutes, leaveOut, addNext) {
  const [nonce, setNonce] = useState(0);
  const outKey = leaveOut.join(',');
  const want = `${chapterKey}|${minutes}|${outKey}|${addNext ? 1 : 0}|${nonce}`;
  const [got, setGot] = useState({ key: null, data: null, failed: null, error: null });
  useEffect(() => {
    let alive = true;
    previewRun({ chapterKey, minutes, leaveOut: outKey ? outKey.split(',') : [], addNext })
      .then((data) => { if (alive) setGot({ key: want, data, failed: null, error: null }); })
      .catch((error) => { if (alive) setGot((g) => ({ ...g, failed: want, error })); });
    return () => { alive = false; };
  }, [chapterKey, minutes, outKey, addNext, want]);
  const status = got.failed === want ? (got.data ? 'stale' : 'error') : got.key === want ? 'ready' : got.data ? 'refreshing' : 'loading';
  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { status, data: got.data, error: got.failed === want ? got.error : null, retry };
}

// ---------------------------------------------------------------- Length

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
    const raf = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', place); };
  }, [open, anchorRef]);
  useEffect(() => {
    if (!open) return undefined;
    first.current?.focus({ preventScroll: true });
    const key = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Tab' && panel.current) {
        const f = [...panel.current.querySelectorAll('button:not(:disabled), [role="spinbutton"]')];
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

/** The site's segmented control for 5 | 10 | 20 | Other. Its segment keeps what was chosen; "Other" reopens its sheet. */
function LengthControl({ minutes, onChange, onOwn, labelledBy, wrapRef }) {
  const own = !LENGTHS.includes(minutes);
  const options = [...LENGTHS.map((m) => ({ value: m, label: `${m} min` })), { value: 'own', label: own ? minutesLabel(minutes) : 'Other' }];
  // The control ignores a press on the option already chosen; "Your own" chosen and pressed again opens its sheet.
  const reopen = (e) => {
    const radio = e.target.closest?.('[role="radio"]');
    if (own && radio && radio === wrapRef.current?.querySelectorAll('[role="radio"]')[3]) onOwn();
  };
  return (
    <div className="lc-len-wrap" ref={wrapRef} onClickCapture={reopen}>
      <SegmentedControl labelledBy={labelledBy} value={own ? 'own' : minutes} options={options} className="lc-seg" onChange={(v) => (v === 'own' ? onOwn() : onChange(v))} />
    </div>
  );
}

// ---------------------------------------------------------------- Piles

// What is printed on each pile's top paper, faint, so the pile reads as that kind of paper before its label is read:
// a Key card's two lines of print, a question's four option dots, a mistake's red margin, a lesson's lines by a spine.
export function FaceHint({ id }) {
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

function Pile({ pile, index, busy, onToggle, shaking, onShaken, describedBy }) {
  const { value } = useCountUpState(pile.count, { duration: 180, curve: 'out' });
  const v = pileView(pile);
  const paper = (
    <span className="lc-fan" key={`${pile.count}-${pile.left}`}>
      <span className="lc-sheet lc-sheet--c" aria-hidden="true" />
      <span className="lc-sheet lc-sheet--b" aria-hidden="true" />
      <span className="lc-sheet lc-sheet--a">
        <FaceHint id={pile.id} />
        <span className="lc-tick" aria-hidden="true">{v.state === 'in' ? <Check size={12} strokeWidth={3} /> : null}</span>
        {v.state === 'held' ? <span className="lc-face__left">Tomorrow</span>
          : v.state === 'left' ? <span className="lc-face__left">Left out</span>
            : <span className="lc-face__count">{value}{v.of ? <span className="lc-face__of">of {v.of}</span> : null}</span>}
      </span>
    </span>
  );
  const words = (
    <>
      <span className="lc-pile__label">{pile.label}</span>
      <span className="lc-pile__min">{v.line}</span>
      {v.note ? <span className="lc-pile__note">{v.note}</span> : null}
    </>
  );
  if (v.state === 'held') {
    return (
      <li className="lc-pile" data-kind={pile.id} data-left="" data-held="" style={{ '--i': index }}>
        <div className="lc-pile__btn" role="group" aria-disabled="true" aria-label={v.aria} aria-describedby={describedBy}>{paper}{words}</div>
      </li>
    );
  }
  return (
    <li className="lc-pile" data-kind={pile.id} data-left={pile.left || undefined} style={{ '--i': index }}>
      <button
        type="button"
        className={`lc-pile__btn${shaking ? ' lc-shake' : ''}`}
        aria-pressed={!pile.left}
        aria-label={v.aria}
        aria-busy={busy || undefined}
        onClick={() => onToggle(pile)}
        onAnimationEnd={(e) => { if (e.animationName === 'lc-shake') onShaken(); }}
      >
        {paper}{words}
      </button>
    </li>
  );
}

/** A short chapter: the next chapter can join this run (the server's addNext dry run); added, it can be taken out again. */
function NextPile({ next, added, plus, minutes, index, busy, onToggle }) {
  const ref = next?.ref || null;
  const title = added?.title || next?.title || '';
  return (
    <li className="lc-pile" data-kind="next" data-added={added ? '' : undefined} style={{ '--i': index }}>
      <button type="button" className="lc-pile__btn" aria-pressed={Boolean(added)} aria-busy={busy || undefined} onClick={onToggle}
        aria-label={added ? `${title} added to this run. Tap to remove it` : `Add the next chapter, ${title}, to fill your ${minutes} minutes`}>
        <span className="lc-fan">
          {added ? <><span className="lc-sheet lc-sheet--c" aria-hidden="true" /><span className="lc-sheet lc-sheet--b" aria-hidden="true" /></> : null}
          <span className={`lc-sheet lc-sheet--a${added ? '' : ' lc-sheet--dash'}`}>
            {added ? (
              <>
                <FaceHint id="cards" />
                <span className="lc-tick" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>
                <span className="lc-face__count lc-face__count--plus">{plus > 0 ? `+${plus}` : '+'}<span className="lc-face__of">min</span></span>
              </>
            ) : <Plus className="lc-next__plus" size={22} strokeWidth={2.2} aria-hidden="true" />}
          </span>
        </span>
        <span className="lc-pile__label">{added ? `${ref || 'Next chapter'} added` : 'Add the next chapter'}</span>
        <span className="lc-pile__min">{added ? 'Tap to remove' : `${ref ? `${ref}, fills` : 'Fills'} your ${minutes} min`}</span>
      </button>
    </li>
  );
}

/** Before the first dry run: the whole page in outline, so nothing on screen moves when the answer lands. */
function PageSkeleton() {
  return (
    <div className="lc-skel" aria-busy="true" aria-label="Lining up this chapter">
      <div className="lc-lined">
        <div className="lc-lined__in">
          <div className="lc-ctl"><span className="skeleton lc-skel__h" /><span className="skeleton lc-skel__len" /></div>
          <ul className="lc-piles" data-n="3">
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
          <div className="lc-go"><span className="skeleton lc-skel__key" /></div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Shelf

function ShelfRow({ href, title, line, locked = false, onPress = null, busy = false }) {
  const body = (
    <>
      <span className="lc-shelf__text">
        <span className="lc-shelf__title">{title}</span>
        <span className="lc-shelf__line">{locked ? <Lock size={13} strokeWidth={2.3} aria-hidden="true" /> : null}{line}</span>
      </span>
      {onPress ? <Printer className="lc-shelf__chev" size={18} strokeWidth={2.2} aria-hidden="true" /> : href ? <ChevronRight className="lc-shelf__chev" size={18} strokeWidth={2.2} aria-hidden="true" /> : null}
    </>
  );
  if (onPress) return <li><button type="button" className="lc-shelf__row lc-shelf__row--key" onClick={onPress} aria-busy={busy || undefined}>{body}</button></li>;
  return <li>{href ? <Link className="lc-shelf__row" href={href}>{body}</Link> : <div className="lc-shelf__row" data-still>{body}</div>}</li>;
}

function Shelf({ data, chapterKey, minutes, links, failed = false }) {
  const shelf = data?.shelf;
  const printer = usePrintSheet(chapterKey);
  if (!shelf && failed) {
    // The dry run failed: the counts are unknown, but the chapter's cards still open.
    return (
      <aside className="lc-shelf" aria-labelledby="lc-shelf-h">
        <h2 className="lc-shelf__h" id="lc-shelf-h">Everything in this chapter</h2>
        <ul className="lc-shelf__rows"><ShelfRow title="Key cards" line="Every card in this chapter, by section" href={links.cards(chapterKey)} /></ul>
      </aside>
    );
  }
  if (!shelf) {
    return (
      <aside className="lc-shelf lc-shelf--skel" aria-hidden="true">
        <span className="skeleton lc-skel-text lc-skel-text--h" />
        <ul className="lc-shelf__rows">{[0, 1, 2, 3].map((i) => <li key={i}><div className="lc-shelf__row" data-still><span className="lc-shelf__text"><span className="skeleton lc-skel-text" /><span className="skeleton lc-skel-text lc-skel-text--short" /></span></div></li>)}</ul>
      </aside>
    );
  }
  const view = shelfView(data, { mistakeMinutes: (n) => minutesFor(n * 60) });
  const only = (keep) => ['cards', 'questions', 'mistakes', 'lesson'].filter((k) => k !== keep);
  const hrefOf = {
    cards: links.cards(chapterKey),
    questions: links.run({ chapterKey, minutes, kind: 'mix', leaveOut: only('questions') }),
    mistakes: links.run({ chapterKey, minutes, kind: 'mix', leaveOut: only('mistakes') }),
    lesson: shelf.lesson ? links.lesson(shelf.lesson.id) : null,
    print: links.cards(chapterKey, 'must'),
  };
  return (
    <aside className="lc-shelf" aria-labelledby="lc-shelf-h">
      <h2 className="lc-shelf__h" id="lc-shelf-h">Everything in this chapter</h2>
      <ul className="lc-shelf__rows">
        {view.rows.map((r) => <ShelfRow key={r.id} title={r.title} line={r.id === 'print' && printer.busy ? 'Getting the sheet ready' : r.id === 'print' && printer.failed ? 'The sheet did not load. Try again.' : r.line} locked={r.locked} href={r.link ? hrefOf[r.id] : null} onPress={r.action === 'print' ? printer.start : null} busy={r.action === 'print' && printer.busy} />)}
      </ul>
      {printer.sheet}
    </aside>
  );
}

// ---------------------------------------------------------------- First up

/** "First up" (R2 ruling 9, LK10 "see what is lined up"): the fronts of the first 3 Key cards this run opens with, as small
 *  paper cards. A picture of what is coming, not a set of keys: Start plays them. They deal in from 12 px below, 50 ms apart. */
function FirstUp({ cards }) {
  const id = useId();
  if (!cards.length) return null;
  return (
    <section className="lc-first" aria-labelledby={id}>
      <h3 className="lc-first__h" id={id}>First up</h3>
      <ol className="lc-first__row">
        {cards.map((c, i) => (
          <li key={c.id || i} className="lc-first__card" style={{ '--i': i }} lang="en">
            {c.mustKnow ? <span className="lc-first__tag">Must-know</span> : null}
            <span className="lc-first__front">{c.front}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------- Page

function ResumeRow({ resume, href }) {
  return (
    <section className="lc-resume" aria-labelledby="lc-resume-h">
      <div className="lc-resume__text">
        <p className="lc-resume__h" id="lc-resume-h">You stopped at {resume.done} of {resume.of} today.{resume.minutesLeft ? <span className="lc-resume__left"> About {resume.minutesLeft} min left.</span> : null}</p>
      </div>
      <Link className="kc-btn kc-btn--volt lc-resume__key" data-page-primary="" href={href} aria-label={`Pick up where you stopped, ${resume.done} of ${resume.of} done`}>Pick up where you stopped</Link>
    </section>
  );
}

export default function ChapterPage({ chapterKey, minutes: asked = null }) {
  const links = useLearnLinks();
  const router = useRouter();
  const subject = String(chapterKey || '').split('.')[0];
  const [minutes, setMinutes] = useState(() => (validMinutes(asked) ? asked : 10));
  const [leaveOut, setLeaveOut] = useState([]);
  const [addNext, setAddNext] = useState(false);
  const [ownOpen, setOwnOpen] = useState(false);
  const [shake, setShake] = useState(null);
  const [lastIn, setLastIn] = useState(false);
  const [coach, setCoach] = useState(false);
  const [fresh, setFresh] = useState(false);
  const lenRef = useRef(null);
  const lastTimer = useRef(null);
  const quietId = useId();
  const headId = useId();

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
  useEffect(() => () => clearTimeout(lastTimer.current), []);

  const read = usePreview(chapterKey, minutes, leaveOut, addNext);
  const data = read.data;
  const chapter = data?.chapter;
  // The run's length without the next chapter, so the added pile can say what it adds ("+3 min").
  const [baseMinutes, setBaseMinutes] = useState(null);
  const base = data && !addNext && read.status === 'ready' ? data.realMinutes : null;
  useEffect(() => { if (base != null) setBaseMinutes(base); }, [base]); // eslint-disable-line react-hooks/set-state-in-effect -- remembered from the last dry run without it

  const closeOwn = useCallback(() => {
    setOwnOpen(false);
    requestAnimationFrame(() => lenRef.current?.querySelector('[aria-checked="true"]')?.focus({ preventScroll: true }));
  }, [setOwnOpen]);
  const choose = (m) => {
    closeOwn();
    if (m === minutes) return;
    setMinutes(m);
    setAddNext(false);
    store.set(MINUTES_KEY, String(m));
    router.replace(links.chapter(chapterKey, m), { scroll: false });
  };

  // The server's piles, in the page's order. A pile the student left out stays drawn (dimmed); an empty one is not drawn.
  const piles = useMemo(() => {
    const used = Boolean(data?.freeSession?.used);
    const list = (data?.piles || []).map((p) => {
      const held = p.held === 'free' || (used && p.left && (p.id === 'questions' || p.id === 'mistakes') && !leaveOut.includes(p.id));
      return { ...p, left: p.left || leaveOut.includes(p.id), held };
    });
    return list.filter((p) => p.left || p.count > 0).sort((a, b) => PILE_ORDER.indexOf(a.id) - PILE_ORDER.indexOf(b.id));
  }, [data, leaveOut]);

  const toggle = (pile) => {
    setCoach((c) => (c ? 'done' : c));
    if (pile.held) return;
    if (pile.left) { setLeaveOut((out) => out.filter((id) => id !== pile.id)); return; }
    const inRun = piles.filter((p) => !p.left);
    if (inRun.length <= 1) {
      setShake(pile.id);
      setLastIn(true);
      clearTimeout(lastTimer.current);
      lastTimer.current = setTimeout(() => setLastIn(false), 2400);
      return;
    }
    setLeaveOut((out) => [...out, pile.id]);
  };

  const ready = Boolean(data) && piles.some((p) => !p.left);
  const refreshing = read.status === 'refreshing';
  const startLabelNow = data?.startLabel || `Start ${minutes} minutes`;
  const resume = data?.resume && Number(data.resume.done) < Number(data.resume.of) ? data.resume : null;
  const startHref = withFlag(withFlag(links.run({ chapterKey, minutes, kind: 'mix', leaveOut }), 'next', addNext && data?.added ? '1' : null), 'fresh', resume ? '1' : null);
  const resumeHref = resume ? (resume.kind === 'feed' ? links.feed(chapterKey, minutes, { runId: resume.runId }) : links.run({ chapterKey, minutes, kind: resume.kind || 'mix', runId: resume.runId })) : null;
  const startLabel = resume ? startLabelNow.replace(/^Start /, 'Start a new ') : startLabelNow;
  const verdict = chapterVerdict(chapter?.state);
  const head = chapter ? headLines(chapter) : null;
  const firstUp = firstUpCards(data);
  const recap = recapLabel(data?.recap);
  // With an unfinished run the picker waits under "Start fresh instead", so the page has one main key (R2 ruling 9).
  const picker = !resume || fresh;
  const shrink = data?.shrink || null;
  const next = !data?.added && shrink?.addNext ? shrink.addNext : null;
  const added = data?.added || null;
  const plus = added && baseMinutes ? Math.max(0, Number(data.realMinutes) - Number(baseMinutes)) : 0;
  const quiet = lastIn ? 'Keep at least one pile in.' : chapterQuietLine(data);
  const n = piles.length + (next || added ? 1 : 0);
  const loading = !data && read.status !== 'error';
  const missing = read.status === 'error' && isChapterMissing(read.error);

  // While a new dry run is on its way the key keeps the last real length and does nothing, so it never starts what it does not say.
  const holdWhileRefreshing = (e) => { if (refreshing) e.preventDefault(); };

  return (
    <div className="student-page student-page--cards">
      <div className="kc lc" data-status={read.status}>
        <Link className="kc-back lc-back" href={links.home(subject)}><ChevronLeft size={18} strokeWidth={2.4} aria-hidden="true" />{subjectLabel(subject)}</Link>

        {loading ? <HeadSkeleton /> : missing ? null : (
          <header className="lc-head">
            <div className="lc-head__text">
              {head?.eyebrow ? <p className="lc-head__unit">{head.eyebrow}</p> : null}
              <h1 className="kc-title lc-head__title" data-size={titleSize(chapter?.title)}>{chapter ? chapter.title : 'Chapter'}</h1>
              {chapter ? (
                <p className="lc-head__ref">
                  {head.ref ? <span>{head.ref}</span> : null}
                  {verdict ? <span className="lc-state" data-state="weak"><StateRing shape="weak" />{verdict}</span> : null}
                </p>
              ) : null}
            </div>
            <SubjectObject id={subject} size={64} lit className="lc-head__obj" sizes="64px" />
          </header>
        )}

        <div className="lc-board">
          <div className="lc-board__in">
            <main className="lc-main">
              {loading ? <PageSkeleton /> : missing ? (
                <div className="lc-missing" role="alert">
                  <h1 className="kc-title lc-head__title">Chapter</h1>
                  <p className="lc-fine">This chapter is not in your book list.</p>
                  <Link className="kc-btn kc-btn--line" href={links.home(subject)}>Back to Learn</Link>
                </div>
              ) : (
                <>
                  {resume ? <ResumeRow resume={resume} href={resumeHref} /> : null}
                  {resume ? (
                    <button type="button" className="lc-fresh" aria-expanded={fresh} aria-controls={`${headId}-lined`} onClick={() => setFresh((f) => !f)}>
                      Start fresh instead<ChevronDown size={16} strokeWidth={2.4} aria-hidden="true" />
                    </button>
                  ) : null}

                  {picker ? (
                    <section className="lc-lined" id={`${headId}-lined`} aria-labelledby={headId} data-resume={resume ? '' : undefined}>
                      <div className="lc-lined__in">
                        <div className="lc-ctl">
                          <h2 id={headId} className="lc-lined__h">How long have you got?</h2>
                          <LengthControl minutes={minutes} onChange={choose} onOwn={() => setOwnOpen(true)} labelledBy={headId} wrapRef={lenRef} />
                          <OwnSheet key={ownOpen ? 'open' : 'shut'} open={ownOpen} minutes={minutes} onChoose={choose} onClose={closeOwn} anchorRef={lenRef} />
                        </div>

                        {read.status === 'error' ? (
                          <div className="lc-error" role="alert">
                            <p>We could not line this up.</p>
                            <button type="button" className="kc-btn kc-btn--line kc-btn--small" onClick={read.retry}>Try again</button>
                          </div>
                        ) : (
                          <>
                            <ul className="lc-piles" aria-label="Lined up for this run" data-n={n}>
                              {piles.map((p, i) => (
                                <Pile key={p.id} pile={p} index={i} busy={refreshing} onToggle={toggle} shaking={shake === p.id} onShaken={() => setShake(null)} describedBy={p.held ? quietId : undefined} />
                              ))}
                              {next || added ? (
                                <NextPile next={next} added={added} plus={plus} minutes={minutes} index={piles.length} busy={refreshing} onToggle={() => setAddNext((a) => !a)} />
                              ) : null}
                            </ul>
                            {coach && piles.length > 1 ? <p className="lc-coach" data-done={coach === 'done' || undefined} aria-hidden={coach === 'done' || undefined}>Tap a pile to leave it out.</p> : null}
                            {read.status === 'stale' ? <p className="lc-fine" role="status">We could not update this. The last lined-up run is shown.</p> : null}

                            <div className="lc-go" data-resume={resume ? '' : undefined}>
                              <div className="lc-go__bar">
                                {ready ? (
                                  <Link className={`kc-btn ${resume ? 'kc-btn--line' : 'kc-btn--volt'} lc-go__key`} data-page-primary={resume ? undefined : ''} href={startHref}
                                    aria-disabled={refreshing || undefined} onClick={holdWhileRefreshing}>
                                    <span key={startLabel} className="lc-go__label">{startLabel}</span>
                                  </Link>
                                ) : (
                                  <button type="button" className={`kc-btn ${resume ? 'kc-btn--line' : 'kc-btn--volt'} lc-go__key`} disabled>{startLabel}</button>
                                )}
                              </div>
                              <p className="lc-go__note" id={quietId} aria-live="polite" data-empty={quiet ? undefined : ''}>{quiet || ''}</p>
                            </div>
                            {recap ? (
                              <Link className="lc-recap" href={links.run({ chapterKey, minutes: data.recap.minutes, kind: 'recap' })}
                                aria-label={`Quick recap of the ${data.recap.count} Must-know ${data.recap.count === 1 ? 'line' : 'lines'}, about ${data.recap.minutes} min`}>
                                {recap}<ChevronRight size={16} strokeWidth={2.4} aria-hidden="true" />
                              </Link>
                            ) : null}
                            <FirstUp key={`${minutes}|${leaveOut.join(',')}`} cards={firstUp} />
                          </>
                        )}
                      </div>
                    </section>
                  ) : null}
                </>
              )}
            </main>

            {missing ? null : <Shelf data={data} chapterKey={chapterKey} minutes={minutes} links={links} failed={read.status === 'error'} />}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Before the first dry run: the head in outline at its real size. */
function HeadSkeleton() {
  return (
    <div className="lc-head lc-skel" aria-hidden="true">
      <div className="lc-head__text">
        <span className="skeleton lc-skel__title" />
        <span className="skeleton lc-skel__title lc-skel__title--2" />
        <span className="skeleton lc-skel__ref" />
      </div>
    </div>
  );
}

const NAMES = { accountancy: 'Accountancy', business_studies: 'Business Studies', economics: 'Economics', english: 'English' };
function subjectLabel(id) {
  return NAMES[id] || String(id || '').split('_').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') || 'Learn';
}
