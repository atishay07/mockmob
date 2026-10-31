"use client";
// /cards, Key cards home (KEYCARDS-BUILD-SPEC.md section 3).
//   Head      "Key cards" and one line on what they are
//   Today     "14 cards due today" and "About 4 minutes in Revise", with the one primary key, Revise now (/review/revise)
//   Subjects  the student's subjects (a row of tabs); for Mathematics, Computer Science and Accountancy the one-tap option picker
//   Units     CUET units in order, each chapter in NCERT order: title, "Business Studies Part 1, Ch 1", the chip, the state in
//             words with a shape beside it (never colour alone), "27 cards, 6 due", and for Free "5 of 27 open" under it.
//             A subject whose units each hold one chapter is one plain list (blocksOf); otherwise each unit is a group,
//             headed only when the heading is not the one chapter's own name again.
//   Free      one quiet Pro line (InlineNudge, placement keycards), dismissable, never a modal on entry
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { InlineNudge } from '@/components/pro';
import { ErrorState } from '@/components/ui/Skeleton';
import { refreshHome, saveOption, useKeycardsHome } from './api';
import { blocksOf, chapterRef, chapterRefSpoken, countsLine, plural, stateCue } from './kinds';
import { useCardsLinks } from './links';
import { ncertFont } from './ncertFont';
import './keycards.css';

/** The shape beside a state word: the state is said in words; the shape is the second, non-colour cue. */
export function StateGlyph({ state }) {
  const r = 6.25;
  const c = 8;
  const fill = { thin: 0, weak: 0.25, mid: 0.5, strong: 1 }[state] ?? 0;
  const pie = (f) => {
    if (f >= 1) return <circle cx={c} cy={c} r={r} fill="currentColor" />;
    if (f <= 0) return null;
    const a = f * 2 * Math.PI;
    const x = c + r * Math.sin(a);
    const y = c - r * Math.cos(a);
    return <path d={`M${c} ${c} L${c} ${c - r} A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`} fill="currentColor" />;
  };
  return (
    <svg className="kc-glyph" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={state === 'none' ? '2.2 2.2' : undefined} />
      {pie(fill)}
    </svg>
  );
}

function ChapterRow({ ch, isPro, href, index, heading = null }) {
  const cue = stateCue(ch.state);
  // Under a unit heading that is the book's own name, the row says just "Ch 7"; the spoken label keeps the whole reference.
  const ref = chapterRef(ch.ncert, { title: ch.title, unit: heading });
  const counts = countsLine(ch, isPro);
  const unit = ch.unit && String(ch.unit).trim().toLowerCase() !== String(ch.title).trim().toLowerCase() ? `CUET unit: ${ch.unit}` : null;
  const spoken = [ch.title, chapterRefSpoken(ch.ncert), unit, ch.chip, cue.label, counts.line, counts.open].filter(Boolean).join('. ');
  return (
    <li className="kc-row" style={{ '--i': Math.min(index, 12) }}>
      <Link className="kc-row__link" href={href} aria-label={spoken}>
        <span className="kc-row__main">
          <b className="kc-row__title">{ch.title}</b>
          {ref || ch.chip ? <span className="kc-row__ref">{ref}{ch.chip ? <span className="kc-chip">{ch.chip}</span> : null}</span> : null}
        </span>
        <span className="kc-row__state" data-state={cue.state} data-fading={cue.fading || undefined}><StateGlyph state={cue.state} />{cue.label}</span>
        <span className="kc-row__counts" data-none={!ch.cards || undefined}>
          <span>{counts.line}</span>
          {counts.open ? <span className="kc-row__open">{counts.open}</span> : null}
        </span>
        <ChevronRight className="kc-row__chev" size={18} strokeWidth={2} aria-hidden="true" />
      </Link>
    </li>
  );
}

function OptionPicker({ subject }) {
  const opts = subject.options;
  const [pending, setPending] = useState(null);
  const [failed, setFailed] = useState(false);
  if (!opts?.choices?.length) return null;
  // Nothing saved yet: no choice is shown as made, since every part's chapters are listed until one is chosen.
  const current = pending || subject.option || null;
  const word = String(opts.label || 'option').toLowerCase();
  const all = opts.choices.length === 2 ? `both ${word}s` : `every ${word}`;
  async function choose(id) {
    if (id === current || pending) return;
    setPending(id);
    setFailed(false);
    try { await saveOption({ subject: subject.subject, option: id }); refreshHome(); } catch { setFailed(true); } finally { setPending(null); }
  }
  const labelId = `kc-opt-${subject.subject}`;
  return (
    <div className="kc-opt">
      <p className="kc-opt__label" id={labelId}>{`Your ${word} in ${subject.title}`}</p>
      <div className="kc-opt__row" role="radiogroup" aria-labelledby={labelId}>
        {opts.choices.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={current === c.id} aria-busy={pending === c.id || undefined} className="kc-opt__btn" onClick={() => choose(c.id)}>{c.label}</button>
        ))}
      </div>
      {pending ? <p className="kc-fine" role="status">Saving your choice</p>
        : failed ? <p className="kc-err" role="alert">Your choice was not saved. Try again.</p>
          : subject.option ? <p className="kc-fine">Only that {word}’s chapters show here and in your practice. You can change it at any time.</p>
            : <p className="kc-fine">Choose your {word} and only its chapters show here and in your practice. Until then, {all} show.</p>}
    </div>
  );
}

const initialSubject = () => { try { return new URLSearchParams(window.location.search).get('subject'); } catch { return null; } };

function Head() {
  return (
    <header className="kc-hhead">
      <h1 className="kc-title">Key cards</h1>
      <p className="kc-lede">NCERT’s exact lines, chapter by chapter, each with the page it is on.</p>
    </header>
  );
}

export default function KeycardsHome() {
  const { user } = useAuth() || {};
  const read = useKeycardsHome();
  const links = useCardsLinks();
  const [chosen, setChosen] = useState(null);
  useEffect(() => { queueMicrotask(() => setChosen(initialSubject())); }, []);
  const data = read.data;
  const isPro = data ? data.isPro === true : user?.isPremium === true;
  const subjects = useMemo(() => data?.subjects || [], [data]);
  const subject = subjects.find((s) => s.subject === chosen) || subjects[0] || null;
  const blocks = useMemo(() => blocksOf(subject?.units), [subject]);
  // A subject with no NCERT book behind any chapter (English) says where its cards come from, once, above its chapters.
  const bookless = blocks.length > 0 && blocks.every((b) => b.chapters.every((c) => !c.ncert));
  const pick = (id) => {
    setChosen(id);
    try { const u = new URL(window.location.href); u.searchParams.set('subject', id); window.history.replaceState(window.history.state, '', u); } catch { /* the URL keeps the old subject */ }
  };
  // Four subjects overflow a phone's row: the chosen one (English, from ?subject= or the back link) is scrolled into the row's
  // view, sideways only, so the student always sees which subject the chapters below belong to.
  const current = subject?.subject || null;
  useEffect(() => {
    if (!current) return;
    const tab = document.getElementById(`kc-sub-${current}`);
    const row = tab?.parentElement;
    if (!tab || !row || row.scrollWidth <= row.clientWidth) return;
    const left = tab.offsetLeft - row.offsetLeft;
    const right = left + tab.offsetWidth;
    if (left >= row.scrollLeft && right <= row.scrollLeft + row.clientWidth) return;
    let still = false;
    try { still = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* moves smoothly */ }
    // To a snap position of the row (a tab's start, or the last tab's end), so the row's snapping keeps it there.
    const to = left < row.scrollLeft ? left - 4 : right - row.clientWidth + 4;
    row.scrollTo({ left: Math.max(0, to), behavior: still ? 'auto' : 'smooth' });
  }, [current, read.state]);
  const frame = (body) => <div className={`kc kc--home ${ncertFont.variable}`}><Head />{body}</div>;

  if (read.state === 'loading') {
    return frame(
      <div className="kc-skel" role="status" aria-label="Loading Key cards">
        <span className="skeleton kc-skel__today" />
        <span className="skeleton kc-skel__tabs" />
        {[0, 1, 2, 3, 4].map((i) => <span key={i} className="skeleton kc-skel__row" />)}
      </div>,
    );
  }
  if (read.state === 'off') {
    return frame(
      <div className="kc-quiet-state">
        <h2>Key cards are not open yet</h2>
        <p>They open here once the first chapters are checked against the book. Lessons and practice are all still open.</p>
      </div>,
    );
  }
  if (read.state === 'error') return frame(<ErrorState title="Key cards did not load" message="Check your connection and try again. Your cards and their schedule are safe." onRetry={read.retry} />);

  const today = data.today || {};
  const due = Number(today.due) || 0;
  const minutes = Math.max(1, Number(today.minutes) || Math.ceil(due / 4));
  return frame(
    <>
      <section className="kc-today" aria-labelledby="kc-today-h" data-due={due ? '' : undefined}>
        <div className="kc-today__copy">
          <h2 id="kc-today-h" className="kc-today__line">{due ? <><b>{due}</b> {due === 1 ? 'card' : 'cards'} due today</> : 'Nothing due today'}</h2>
          <p>{due ? `About ${plural(minutes, 'minute')} in Revise, with the rest of today’s work.` : 'Open a chapter and add it to Revise. Its cards come back there when they are due.'}</p>
        </div>
        {due ? <Link className="kc-btn kc-btn--volt kc-today__key" href={links.revise()} data-page-primary="">Revise now</Link> : null}
      </section>
      {!isPro ? <InlineNudge placement="keycards" className="kc-nudge" /> : null}

      {!subjects.length ? (
        <div className="kc-quiet-state">
          <h2>No subjects to show</h2>
          <p>Key cards follow the subjects you chose. Add your CUET subjects in Account and their chapters appear here.</p>
        </div>
      ) : (
        <div className="kc-browse">
          {subjects.length > 1 ? (
            <div className="kc-subjects" role="tablist" aria-label="Subject">
              {subjects.map((s, i) => (
                <button key={s.subject} type="button" role="tab" id={`kc-sub-${s.subject}`} aria-selected={s.subject === subject?.subject} aria-controls="kc-units" tabIndex={s.subject === subject?.subject ? 0 : -1} className="kc-subjects__btn" onClick={() => pick(s.subject)}
                  onKeyDown={(e) => {
                    const to = e.key === 'ArrowRight' ? (i + 1) % subjects.length : e.key === 'ArrowLeft' ? (i + subjects.length - 1) % subjects.length : null;
                    if (to === null) return;
                    e.preventDefault();
                    pick(subjects[to].subject);
                    document.getElementById(`kc-sub-${subjects[to].subject}`)?.focus();
                  }}>
                  <SubjectObject id={s.subject} size={24} framed={false} life={false} />
                  <span>{s.title}</span>
                </button>
              ))}
            </div>
          ) : null}
          {subject ? <OptionPicker key={`opt-${subject.subject}`} subject={subject} /> : null}
          {bookless ? <p className="kc-fine">{subject.title} cards are written for MockMob, not taken from an NCERT book.</p> : null}
          <div id="kc-units" role={subjects.length > 1 ? 'tabpanel' : undefined} aria-labelledby={subjects.length > 1 ? `kc-sub-${subject?.subject}` : undefined} className="kc-units" key={subject?.subject}>
            {blocks.length ? blocks.map((b, bi) => (
              <section key={b.label || `plain-${bi}`} className="kc-unit" data-headed={b.unit ? '' : undefined} data-group={b.group ? '' : undefined} aria-label={b.label || `${subject.title} chapters`}>
                {b.unit ? <h2 className="kc-unit__h">{b.unit}</h2> : null}
                <ul className="kc-rows">
                  {b.chapters.map((ch, i) => <ChapterRow key={ch.key} ch={ch} index={bi * 2 + i} isPro={isPro} href={links.deck(ch.key)} heading={b.unit} />)}
                </ul>
              </section>
            )) : <p className="kc-empty-line">No chapters with cards in {subject?.title} yet.</p>}
          </div>
        </div>
      )}
    </>,
  );
}
