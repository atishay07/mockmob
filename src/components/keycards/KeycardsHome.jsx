"use client";
// /cards, Key cards home (KEYCARDS-BUILD-SPEC.md section 3).
//   Head      "Key cards" and one line on what they are
//   Today     "14 cards due today" and "About 4 minutes in Revise", with the one primary key, Revise now (/review/revise)
//   Subjects  the student's subjects (a row of tabs); for Mathematics, Computer Science and Accountancy the one-tap option picker
//   Units     CUET units in order, each chapter in NCERT order: title, "Business Studies Part 1 · Ch 1", the chip, the state in
//             words with a shape beside it (never colour alone), "27 cards · 6 due", and for Free "5 of 27 open" under it.
//             A subject whose units each hold one chapter is one plain list (blocksOf); otherwise each unit is headed.
//   Free      one quiet Pro line (InlineNudge, placement keycards), dismissable, never a modal on entry
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { InlineNudge } from '@/components/pro';
import { ErrorState } from '@/components/ui/Skeleton';
import { refreshHome, saveOption, useKeycardsHome } from './api';
import { chapterRef, chapterRefSpoken, countsLine, plural, stateCue } from './kinds';
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

function ChapterRow({ ch, isPro, href, index }) {
  const cue = stateCue(ch.state);
  const ref = chapterRef(ch.ncert);
  const counts = countsLine(ch, isPro);
  const unit = ch.unit && String(ch.unit).trim().toLowerCase() !== String(ch.title).trim().toLowerCase() ? `CUET unit: ${ch.unit}` : null;
  const spoken = [ch.title, chapterRefSpoken(ch.ncert), unit, ch.chip, cue.label, counts.line.replace(' · ', ', '), counts.open].filter(Boolean).join('. ');
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

/**
 * The subject's units as blocks [{ unit | null, chapters }]. When every unit holds one chapter (Business Studies, Economics)
 * the units are one plain list in CUET order, so no name is printed twice and no lone heading floats; otherwise every unit
 * is a headed group (Accountancy: "Accounting for Partnership Firms" with its chapters), so the grouping is never ambiguous.
 */
function blocksOf(units = []) {
  const live = units.filter((u) => (u.chapters || []).length);
  if (live.every((u) => u.chapters.length === 1)) return live.length ? [{ unit: null, chapters: live.map((u) => ({ ...u.chapters[0], unit: u.unit })) }] : [];
  return live.map((u) => ({ unit: u.unit, chapters: u.chapters }));
}

function OptionPicker({ subject }) {
  const opts = subject.options;
  const [pending, setPending] = useState(null);
  const [failed, setFailed] = useState(false);
  if (!opts?.choices?.length) return null;
  const current = subject.option || opts.default;
  const word = String(opts.label || 'option').toLowerCase();
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
          <button key={c.id} type="button" role="radio" aria-checked={(pending || current) === c.id} aria-busy={pending === c.id || undefined} className="kc-opt__btn" onClick={() => choose(c.id)}>{c.label}</button>
        ))}
      </div>
      {pending ? <p className="kc-fine" role="status">Saving your choice</p>
        : failed ? <p className="kc-err" role="alert">Your choice was not saved. Try again.</p>
          : <p className="kc-fine">Only that {word}’s chapters show here and in your practice. You can change it at any time.</p>}
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
  const pick = (id) => {
    setChosen(id);
    try { const u = new URL(window.location.href); u.searchParams.set('subject', id); window.history.replaceState(window.history.state, '', u); } catch { /* the URL keeps the old subject */ }
  };
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
          <div id="kc-units" role={subjects.length > 1 ? 'tabpanel' : undefined} aria-labelledby={subjects.length > 1 ? `kc-sub-${subject?.subject}` : undefined} className="kc-units" key={subject?.subject}>
            {blocks.length ? blocks.map((b, bi) => (
              <section key={b.unit || `plain-${bi}`} className="kc-unit" data-headed={b.unit ? '' : undefined} aria-label={b.unit || `${subject.title} chapters`}>
                {b.unit ? <h2 className="kc-unit__h">{b.unit}</h2> : null}
                <ul className="kc-rows">
                  {b.chapters.map((ch, i) => <ChapterRow key={ch.key} ch={ch} index={bi * 2 + i} isPro={isPro} href={links.deck(ch.key)} />)}
                </ul>
              </section>
            )) : <p className="kc-empty-line">No chapters with cards in {subject?.title} yet.</p>}
          </div>
        </div>
      )}
    </>,
  );
}
